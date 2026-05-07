from __future__ import annotations

from datetime import timedelta
from collections import Counter, defaultdict

from asgiref.sync import async_to_sync
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from .models import Appointment, CategoryResolver, Category

from .models import Comment, Complaint, Response

try:
    from channels.layers import get_channel_layer
except ImportError:  # pragma: no cover - graceful fallback when channels is unavailable
    get_channel_layer = None


def _channel_layer():
    if get_channel_layer is None:
        return None
    try:
        return get_channel_layer()
    except Exception:
        return None


def _send(group_name, event_type, payload):
    channel_layer = _channel_layer()
    if not channel_layer:
        return
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'broadcast.event',
            'event_type': event_type,
            'payload': payload,
        },
    )


def complaint_thread_group_name(complaint_id):
    return f'complaint-thread-{complaint_id}'


def analytics_group_name(scope, user_id=None):
    if scope == 'officer' and user_id is not None:
        return f'analytics-officer-{user_id}'
    return 'analytics-admin'


def serialize_user(user):
    if not user:
        return None
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
    }


def serialize_comment(comment):
    return {
        'id': comment.id,
        'kind': 'comment',
        'complaint': str(comment.complaint_id),
        'message': comment.message,
        'comment_type': comment.comment_type,
        'author': serialize_user(comment.author),
        'created_at': comment.created_at.isoformat(),
        'updated_at': comment.updated_at.isoformat(),
    }


def serialize_response(response):
    return {
        'id': response.id,
        'kind': 'response',
        'complaint': str(response.complaint_id),
        'title': response.title,
        'message': response.message,
        'response_type': response.response_type,
        'attachment': response.attachment.url if response.attachment else None,
        'is_public': response.is_public,
        'responder': serialize_user(response.responder),
        'created_at': response.created_at.isoformat(),
        'updated_at': response.updated_at.isoformat(),
    }


def build_thread_snapshot(complaint):
    responses = Response.objects.filter(complaint=complaint).select_related('responder').order_by('created_at')
    comments = Comment.objects.filter(complaint=complaint).select_related('author').order_by('created_at')
    return {
        'complaint_id': str(complaint.complaint_id),
        'responses': [serialize_response(item) for item in responses],
        'comments': [serialize_comment(item) for item in comments],
    }


def build_complaint_analytics(user):
    if user.is_admin():
        queryset = Complaint.objects.all()
        scope = 'admin'
    else:
        queryset = Complaint.objects.filter(assigned_officer=user)
        scope = 'officer'

    status_counts = {
        status_value: queryset.filter(status=status_value).count()
        for status_value, _ in Complaint.STATUS_CHOICES
    }

    today = timezone.localdate()
    start_date = today - timedelta(days=6)
    raw_trend = (
        queryset.filter(created_at__date__gte=start_date)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('complaint_id'))
        .order_by('day')
    )
    trend_lookup = {item['day']: item['count'] for item in raw_trend}
    daily_trend = []
    for offset in range(7):
        current_day = start_date + timedelta(days=offset)
        daily_trend.append({
            'date': current_day.isoformat(),
            'label': current_day.strftime('%b %d'),
            'count': trend_lookup.get(current_day, 0),
        })

    category_breakdown = (
        queryset.values('category__office_name')
        .annotate(count=Count('complaint_id'))
        .order_by('-count', 'category__office_name')[:6]
    )

    recent_complaints = [
        {
            'complaint_id': str(item.complaint_id),
            'title': item.title,
            'status': item.status,
            'category': item.category.office_name if item.category else 'Uncategorized',
            'created_at': item.created_at.isoformat(),
            'updated_at': item.updated_at.isoformat(),
        }
        for item in queryset.select_related('category').order_by('-updated_at')[:5]
    ]

    return {
        'scope': scope,
        'total': queryset.count(),
        'status_counts': status_counts,
        'daily_trend': daily_trend,
        'category_breakdown': [
            {
                'label': item['category__office_name'] or 'Uncategorized',
                'count': item['count'],
            }
            for item in category_breakdown
        ],
        'recent_complaints': recent_complaints,
        'admin_dashboard': build_admin_dashboard_stats() if scope == 'admin' else None,
    }


def _duration_hours(delta):
    if delta is None:
        return None
    return round(delta.total_seconds() / 3600, 2)


def _format_duration_hours(hours_value):
    if hours_value is None:
        return None
    if hours_value >= 24:
                days = hours_value / 24
                return f'{days:.1f} days'
    return f'{hours_value:.1f} hours'


def build_admin_dashboard_stats():
    from accounts.models import ACADEMIC_UNITS, CAMPUS_CHOICES, Department, Officer, Student, User
    from feedback.models import FeedbackAnswer, TemplateField

    now = timezone.now()
    today = timezone.localdate()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    complaints_qs = (
        Complaint.objects.all()
        .select_related('category', 'assigned_officer', 'current_resolver', 'submitter_department')
        .prefetch_related('responses', 'assignments')
    )
    complaints = list(complaints_qs)
    total_complaints = len(complaints)

    resolved_statuses = {'resolved', 'closed'}
    active_statuses = {'pending', 'in_progress', 'escalated'}

    status_counts = Counter(complaint.status for complaint in complaints)
    resolved_complaints = [complaint for complaint in complaints if complaint.status in resolved_statuses]
    pending_complaints = [complaint for complaint in complaints if complaint.status == 'pending']
    in_progress_complaints = [complaint for complaint in complaints if complaint.status == 'in_progress']
    rejected_complaints = [complaint for complaint in complaints if complaint.status == 'rejected']
    escalated_complaints = [complaint for complaint in complaints if complaint.status == 'escalated']
    closed_complaints = [complaint for complaint in complaints if complaint.status == 'closed']

    resolution_durations = [
        _duration_hours(complaint.updated_at - complaint.created_at)
        for complaint in resolved_complaints
        if complaint.created_at and complaint.updated_at
    ]
    average_resolution_hours = round(sum(resolution_durations) / len(resolution_durations), 2) if resolution_durations else 0

    complaint_response_hours = []
    for complaint in complaints:
        responses = sorted(list(complaint.responses.all()), key=lambda item: item.created_at)
        if responses:
            complaint_response_hours.append(_duration_hours(responses[0].created_at - complaint.created_at))

    overall_resolution_rate = round((len(resolved_complaints) / total_complaints) * 100, 2) if total_complaints else 0
    submitted_today = sum(1 for complaint in complaints if complaint.created_at.date() == today)
    submitted_this_month = sum(1 for complaint in complaints if complaint.created_at.date() >= month_start)
    submitted_this_year = sum(1 for complaint in complaints if complaint.created_at.date() >= year_start)
    anonymous_count = sum(1 for complaint in complaints if complaint.is_anonymous)

    overdue_complaints = [
        complaint for complaint in complaints
        if complaint.escalation_deadline and complaint.escalation_deadline < now and complaint.status in active_statuses
    ]
    resolved_within_deadline = [
        complaint for complaint in resolved_complaints
        if complaint.escalation_deadline and complaint.updated_at <= complaint.escalation_deadline
    ]
    overdue_delay_hours = [
        _duration_hours(now - complaint.escalation_deadline)
        for complaint in overdue_complaints
        if complaint.escalation_deadline
    ]
    sla_compliance_rate = round((len(resolved_within_deadline) / len(resolved_complaints)) * 100, 2) if resolved_complaints else 0
    average_delay_hours = round(sum(overdue_delay_hours) / len(overdue_delay_hours), 2) if overdue_delay_hours else 0

    students_total = Student.objects.count()
    active_staff_total = User.objects.filter(role__in=[User.ROLE_OFFICER, User.ROLE_ADMIN], is_active=True).count()
    active_handlers = Officer.objects.filter(user__is_active=True).count()

    complaint_trend_daily = (
        complaints_qs.filter(created_at__date__gte=today - timedelta(days=29))
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('complaint_id'))
        .order_by('day')
    )
    daily_lookup = {item['day']: item['count'] for item in complaint_trend_daily}
    daily_trend = []
    for offset in range(30):
        current_day = today - timedelta(days=29 - offset)
        daily_trend.append({
            'date': current_day.isoformat(),
            'label': current_day.strftime('%b %d'),
            'count': daily_lookup.get(current_day, 0),
        })

    monthly_trend = []
    for offset in range(11, -1, -1):
        year = today.year if today.month - offset > 0 else today.year - 1
        month = ((today.month - offset - 1) % 12) + 1
        month_start_point = today.replace(year=year, month=month, day=1)
        if month == 12:
            month_end = month_start_point.replace(year=year + 1, month=1, day=1)
        else:
            month_end = month_start_point.replace(month=month + 1, day=1)
        month_count = complaints_qs.filter(created_at__gte=month_start_point, created_at__lt=month_end).count()
        monthly_trend.append({
            'label': month_start_point.strftime('%b %Y'),
            'count': month_count,
        })

    peak_hour = None
    peak_month = None
    if complaints:
        by_hour = Counter(complaint.created_at.hour for complaint in complaints)
        peak_hour = max(by_hour.items(), key=lambda item: item[1])[0] if by_hour else None
        by_month = Counter(complaint.created_at.strftime('%b %Y') for complaint in complaints)
        peak_month = max(by_month.items(), key=lambda item: item[1])[0] if by_month else None

    status_distribution = [
        {'label': label, 'key': key, 'count': status_counts.get(key, 0)}
        for key, label in Complaint.STATUS_CHOICES
    ]

    category_counts = Counter((complaint.category.office_name if complaint.category else 'Uncategorized') for complaint in complaints)
    category_breakdown = [
        {'label': label, 'count': count}
        for label, count in category_counts.most_common(8)
    ]

    college_labels = dict(ACADEMIC_UNITS)
    campus_labels = dict(CAMPUS_CHOICES)

    feedback_ratings = list(
        FeedbackAnswer.objects.filter(field__field_type=TemplateField.FIELD_RATING)
        .select_related('response__user')
    )
    feedback_rating_values = [answer.rating_value for answer in feedback_ratings if answer.rating_value is not None]
    overall_satisfaction = round(sum(feedback_rating_values) / len(feedback_rating_values), 2) if feedback_rating_values else 0

    department_feedback = defaultdict(list)
    for answer in feedback_ratings:
        user = answer.response.user if answer.response_id and answer.response.user_id else None
        if not user:
            continue
        student_profile = getattr(user, 'student_profile', None)
        officer_profile = getattr(user, 'officer_profile', None)
        department = None
        if student_profile and student_profile.department_id:
            department = student_profile.department.department_name
        elif officer_profile and officer_profile.department_id:
            department = officer_profile.department.department_name
        if department and answer.rating_value is not None:
            department_feedback[department].append(answer.rating_value)

    complaints_by_college = defaultdict(list)
    complaints_by_department = defaultdict(list)
    complaints_by_campus = defaultdict(list)
    staff_groups = defaultdict(list)

    for complaint in complaints:
        college_key = college_labels.get(complaint.submitter_college, complaint.submitter_college or 'Unspecified')
        department_key = complaint.submitter_department.department_name if complaint.submitter_department else 'Unspecified'
        campus_key = campus_labels.get(complaint.submitter_campus, complaint.submitter_campus or 'Unspecified')
        staff_key = complaint.assigned_officer.full_name if complaint.assigned_officer_id else 'Unassigned'

        complaints_by_college[college_key].append(complaint)
        complaints_by_department[department_key].append(complaint)
        complaints_by_campus[campus_key].append(complaint)
        staff_groups[staff_key].append(complaint)

    def _group_summary(grouped_items):
        output = []
        for label, items in grouped_items.items():
            total = len(items)
            resolved = sum(1 for item in items if item.status in resolved_statuses)
            pending = sum(1 for item in items if item.status in active_statuses)
            escalated = sum(1 for item in items if item.status == 'escalated')
            avg_resolution = [
                _duration_hours(item.updated_at - item.created_at)
                for item in items
                if item.status in resolved_statuses and item.created_at and item.updated_at
            ]
            first_response = []
            for item in items:
                responses = sorted(list(item.responses.all()), key=lambda response: response.created_at)
                if responses:
                    first_response.append(_duration_hours(responses[0].created_at - item.created_at))
            top_category = Counter(
                item.category.office_name if item.category else 'Uncategorized' for item in items
            ).most_common(1)
            overdue = sum(1 for item in items if item.escalation_deadline and item.escalation_deadline < now and item.status in active_statuses)
            feedback_values = department_feedback.get(label, [])
            output.append({
                'label': label,
                'total': total,
                'resolved': resolved,
                'pending': pending,
                'escalated': escalated,
                'resolution_rate': round((resolved / total) * 100, 2) if total else 0,
                'average_resolution_time': round(sum(avg_resolution) / len(avg_resolution), 2) if avg_resolution else 0,
                'first_response_time': round(sum(first_response) / len(first_response), 2) if first_response else 0,
                'average_satisfaction': round(sum(feedback_values) / len(feedback_values), 2) if feedback_values else 0,
                'overdue': overdue,
                'most_common_category': top_category[0][0] if top_category else 'Uncategorized',
            })
        return sorted(output, key=lambda row: (row['resolution_rate'], row['total']), reverse=True)

    college_performance = _group_summary(complaints_by_college)
    department_performance = _group_summary(complaints_by_department)
    campus_performance = _group_summary(complaints_by_campus)
    staff_performance = _group_summary(staff_groups)

    top_staff = staff_performance[:5]
    status_colors = {
        'pending': 'bg-yellow-500',
        'in_progress': 'bg-blue-500',
        'escalated': 'bg-orange-500',
        'resolved': 'bg-green-500',
        'rejected': 'bg-red-500',
        'closed': 'bg-gray-500',
    }

    return {
        'summary': {
            'total_complaints': total_complaints,
            'total_resolved_complaints': len(resolved_complaints),
            'total_pending_complaints': len(pending_complaints),
            'total_in_progress_complaints': len(in_progress_complaints),
            'total_rejected_complaints': len(rejected_complaints),
            'complaint_resolution_rate': overall_resolution_rate,
            'average_resolution_time_hours': average_resolution_hours,
            'average_resolution_time_label': _format_duration_hours(average_resolution_hours),
            'total_registered_students': students_total,
            'total_active_staff': active_staff_total,
            'active_handlers': active_handlers,
            'complaints_submitted_today': submitted_today,
            'complaints_this_month': submitted_this_month,
            'complaints_this_year': submitted_this_year,
            'anonymous_complaints': anonymous_count,
            'identified_complaints': total_complaints - anonymous_count,
            'complaints_overdue': len(overdue_complaints),
            'complaints_resolved_within_deadline': len(resolved_within_deadline),
            'sla_compliance_rate': sla_compliance_rate,
            'average_delay_hours': average_delay_hours,
            'overall_satisfaction_score': overall_satisfaction,
        },
        'status_distribution': status_distribution,
        'college_performance': college_performance,
        'department_performance': department_performance,
        'campus_performance': campus_performance,
        'category_statistics': category_breakdown,
        'daily_trend': daily_trend,
        'monthly_trend': monthly_trend,
        'peak_hour': peak_hour,
        'peak_month': peak_month,
        'sla': {
            'within_deadline': len(resolved_within_deadline),
            'overdue': len(overdue_complaints),
            'compliance_rate': sla_compliance_rate,
            'average_delay_hours': average_delay_hours,
        },
        'staff_performance': staff_performance,
        'top_staff': top_staff,
        'transparency': {
            'anonymous': anonymous_count,
            'identified': total_complaints - anonymous_count,
        },
        'color_map': status_colors,
    }

def build_public_dashboard_stats():
    today = timezone.localdate()
    start_date = today - timedelta(days=6)

    complaint_queryset = Complaint.objects.all()
    appointment_queryset = Appointment.objects.all()

    complaint_status_counts = {
        status_value: complaint_queryset.filter(status=status_value).count()
        for status_value, _ in Complaint.STATUS_CHOICES
    }
    appointment_status_counts = {
        status_value: appointment_queryset.filter(status=status_value).count()
        for status_value, _ in Appointment.STATUS_CHOICES
    }

    complaint_trend = (
        complaint_queryset.filter(created_at__date__gte=start_date)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('complaint_id'))
        .order_by('day')
    )
    appointment_trend = (
        appointment_queryset.filter(created_at__date__gte=start_date)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    complaint_trend_lookup = {item['day']: item['count'] for item in complaint_trend}
    appointment_trend_lookup = {item['day']: item['count'] for item in appointment_trend}

    daily_trend = []
    for offset in range(7):
        current_day = start_date + timedelta(days=offset)
        daily_trend.append({
            'date': current_day.isoformat(),
            'label': current_day.strftime('%b %d'),
            'complaints': complaint_trend_lookup.get(current_day, 0),
            'appointments': appointment_trend_lookup.get(current_day, 0),
        })

    recent_items = []
    for complaint in complaint_queryset.select_related('category', 'assigned_officer').order_by('-updated_at')[:4]:
        recent_items.append({
            'kind': 'complaint',
            'title': complaint.title,
            'detail': complaint.category.office_name if complaint.category else 'Uncategorized',
            'status': complaint.status,
            'timestamp': complaint.updated_at.isoformat(),
        })

    for appointment in appointment_queryset.select_related('officer').order_by('-updated_at')[:4]:
        recent_items.append({
            'kind': 'appointment',
            'title': appointment.get_status_display(),
            'detail': appointment.description[:90],
            'status': appointment.status,
            'timestamp': appointment.updated_at.isoformat(),
        })

    recent_items.sort(key=lambda item: item['timestamp'], reverse=True)

    return {
        'summary': {
            'total_complaints': complaint_queryset.count(),
            'open_complaints': complaint_queryset.filter(status__in=['pending', 'in_progress', 'escalated']).count(),
            'resolved_complaints': complaint_queryset.filter(status__in=['resolved', 'closed']).count(),
            'total_appointments': appointment_queryset.count(),
            'pending_appointments': appointment_queryset.filter(status='pending').count(),
            'completed_appointments': appointment_queryset.filter(status='completed').count(),
            'active_officers': CategoryResolver.objects.filter(active=True).values('officer_id').distinct().count(),
            'active_category_resolvers': CategoryResolver.objects.filter(active=True).count(),
            'active_categories': Category.objects.filter(is_active=True).count(),
        },
        'today': {
            'complaints_created': complaint_queryset.filter(created_at__date=today).count(),
            'appointments_created': appointment_queryset.filter(created_at__date=today).count(),
            'responses_created': Response.objects.filter(created_at__date=today).count(),
        },
        'status_breakdown': [
            {'label': label, 'count': complaint_status_counts[value]}
            for value, label in Complaint.STATUS_CHOICES
        ],
        'appointment_breakdown': [
            {'label': label, 'count': appointment_status_counts[value]}
            for value, label in Appointment.STATUS_CHOICES
        ],
        'daily_trend': daily_trend,
        'recent_activity': recent_items[:6],
    }


def broadcast_thread_update(complaint_id):
    _send(
        complaint_thread_group_name(complaint_id),
        'thread.updated',
        {'complaint_id': str(complaint_id)},
    )


def broadcast_admin_analytics_update():
    summary = build_complaint_analytics(type('AdminProxy', (), {'is_admin': lambda self: True})())
    _send(
        analytics_group_name('admin'),
        'analytics.updated',
        {'summary': summary},
    )


def broadcast_officer_analytics_update(officer_user):
    if not officer_user:
        return
    summary = build_complaint_analytics(officer_user)
    _send(
        analytics_group_name(summary['scope'], officer_user.id if summary['scope'] == 'officer' else None),
        'analytics.updated',
        {'summary': summary},
    )
