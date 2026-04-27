from __future__ import annotations

from datetime import timedelta

from asgiref.sync import async_to_sync
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

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
        'rating': comment.rating,
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
