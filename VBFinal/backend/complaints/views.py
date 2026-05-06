from datetime import datetime

from django.db import models, transaction
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_duration, parse_date
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response as DRFResponse

from accounts.models import User

from .models import (
    AnnouncementComment,
    Appointment,
    AppointmentAvailability,
    AvailabilityBlock,
    AvailabilityRule,
    Assignment,
    Category,
    CategoryResolver,
    Comment,
    Complaint,
    ComplaintAttachment,
    ComplaintCC,
    PublicAnnouncement,
    Response,
)
from notifications.models import Notification
from .serializers import (
    AnnouncementCommentSerializer,
    AppointmentSerializer,
    AppointmentAvailabilitySerializer,
    AvailabilityBlockSerializer,
    AvailabilityRuleSerializer,
    AssignmentSerializer,
    CategoryResolverSerializer,
    CategorySerializer,
    CommentSerializer,
    ComplaintCreateSerializer,
    ComplaintUserSerializer,
    ComplaintSerializer,
    PublicAnnouncementSerializer,
    ResponseSerializer,
)
from .realtime import build_complaint_analytics
from notifications.realtime import broadcast_notification_update
from .service import service
from .availability_service import AvailabilityService
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin())


class AuthenticatedReadAdminWriteMixin:
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'by_language', 'officers']:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]


def accessible_complaints_for(user):
    if not user or not user.is_authenticated:
        return Complaint.objects.none()
    if user.is_admin():
        return Complaint.objects.all()
    if user.is_officer():
        resolver_categories = list(
            CategoryResolver.objects.filter(
                officer=user,
                active=True,
            ).select_related('category', 'department', 'officer')
        )

        complaints = Complaint.objects.filter(
            models.Q(assigned_officer=user)
            | models.Q(submitted_by=user)
            | models.Q(cc_list__email=user.email)
            | models.Q(category__resolvers__officer=user, category__resolvers__active=True)
        ).distinct().select_related('category', 'current_resolver', 'assigned_officer')

        visible_ids = []
        for complaint in complaints:
            if complaint.submitted_by_id == user.id or complaint.assigned_officer_id == user.id:
                visible_ids.append(complaint.pk)
                continue

            if complaint.cc_list.filter(email=user.email).exists():
                visible_ids.append(complaint.pk)
                continue

            if complaint.category_id and any(
                resolver.category_id == complaint.category_id and resolver.matches_complaint_scope(complaint)
                for resolver in resolver_categories
            ):
                visible_ids.append(complaint.pk)

        return Complaint.objects.filter(pk__in=visible_ids)
    return Complaint.objects.filter(submitted_by=user)


def can_manage_complaint(user, complaint):
    is_category_resolver = False
    if (
        user
        and user.is_authenticated
        and user.is_officer()
        and complaint
        and complaint.category_id
    ):
        is_category_resolver = any(
            resolver.matches_complaint_scope(complaint)
            for resolver in CategoryResolver.objects.filter(
                officer=user,
                category_id=complaint.category_id,
                active=True,
            ).select_related('category', 'department', 'officer')
        )

    return bool(
        user
        and user.is_authenticated
        and (
            user.is_admin()
            or (user.is_officer() and complaint.assigned_officer_id == user.id)
            or is_category_resolver
        )
    )


def _appointment_notification_title(status):
    return {
        'pending': 'Appointment Request Submitted',
        'confirmed': 'Appointment Confirmed',
        'rejected': 'Appointment Rejected',
        'completed': 'Appointment Completed',
        'canceled': 'Appointment Canceled',
    }.get(status, 'Appointment Updated')


def _appointment_notification_message(appointment, status):
    slot_text = ''
    if appointment.scheduled_at:
        slot_text = f" for {appointment.scheduled_at:%Y-%m-%d %H:%M}"

    if status == 'pending':
        return f"Your appointment request{slot_text} has been submitted and is awaiting officer review."
    if status == 'confirmed':
        return f"Your appointment{slot_text} has been confirmed by the officer."
    if status == 'rejected':
        reason_text = f" Reason: {appointment.rejection_reason}" if appointment.rejection_reason else ''
        return f"Your appointment{slot_text} has been rejected.{reason_text}"
    if status == 'completed':
        return f"Your appointment{slot_text} has been marked as completed."
    if status == 'canceled':
        return f"Your appointment{slot_text} has been canceled."
    return f"Your appointment{slot_text} has been updated."


def _send_appointment_notifications(appointment, status, actor=None):
    recipients = []
    if appointment.requested_by_id:
        recipients.append(appointment.requested_by)
    if appointment.officer_id and appointment.officer_id != appointment.requested_by_id:
        recipients.append(appointment.officer)

    recipient_ids = set()
    for recipient in recipients:
        if not recipient or recipient.id in recipient_ids:
            continue
        recipient_ids.add(recipient.id)

        if status == 'pending' and recipient.id != appointment.officer_id:
            continue

        Notification.objects.create(
            user=recipient,
            complaint=appointment.complaint,
            notification_type='appointment',
            title=_appointment_notification_title(status),
            message=_appointment_notification_message(appointment, status),
        )
        broadcast_notification_update(recipient.id)


class CategoryViewSet(AuthenticatedReadAdminWriteMixin, viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    @action(detail=False, methods=['get'], url_path='by-language')
    def by_language(self, request):
        categories = self.get_queryset()
        data = []
        for cat in categories:
            data.append(
                {
                    'category_id': cat.category_id,
                    'name': cat.office_name,
                    'description': cat.office_description,
                    'is_active': cat.is_active,
                }
            )
        return DRFResponse(data)

    @action(detail=True, methods=['get'], url_path='officers')
    def officers(self, request, pk=None):
        category = self.get_object()
        officer_ids = CategoryResolver.objects.filter(
            category=category,
            active=True,
        ).values_list('officer_id', flat=True)

        officers = User.objects.filter(id__in=officer_ids).order_by('first_name', 'last_name', 'email')
        serializer = ComplaintUserSerializer(officers, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='add-officer')
    def add_officer(self, request, pk=None):
        return DRFResponse(
            {'error': 'Direct officer assignment on categories is not supported. Use resolver assignments instead.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


class CategoryResolverViewSet(AuthenticatedReadAdminWriteMixin, viewsets.ModelViewSet):
    queryset = CategoryResolver.objects.select_related('category', 'department', 'officer').order_by(
        'category_id',
        'officer_id',
        'id',
    )
    serializer_class = CategoryResolverSerializer

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        payload = request.data or {}
        category_id = payload.get('category')
        campus_id = payload.get('campus') or None
        college_id = payload.get('college') or None
        department_id = payload.get('department') or None
        active = payload.get('active', True)
        officer_ids = payload.get('officer_ids')
        escalation_time = payload.get('escalation_time')

        if not category_id or escalation_time is None:
            return DRFResponse(
                {'error': 'category and escalation_time are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(officer_ids, list) or not officer_ids:
            return DRFResponse(
                {'error': 'officer_ids must be a non-empty array.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed_escalation_time = parse_duration(str(escalation_time))
        if parsed_escalation_time is None:
            return DRFResponse(
                {'error': 'Invalid escalation_time format. Use Django duration format.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_ids = []
        for officer_id in officer_ids:
            try:
                normalized_ids.append(int(officer_id))
            except (TypeError, ValueError):
                return DRFResponse(
                    {'error': f'Invalid officer id: {officer_id}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        unique_officer_ids = list(dict.fromkeys(normalized_ids))
        valid_officer_ids = set(
            User.objects.filter(
                id__in=unique_officer_ids,
            ).filter(
                models.Q(role=User.ROLE_OFFICER) | models.Q(is_staff=True)
            ).values_list('id', flat=True)
        )
        invalid_ids = [officer_id for officer_id in unique_officer_ids if officer_id not in valid_officer_ids]
        if invalid_ids:
            return DRFResponse(
                {'error': f'Invalid officer_ids: {invalid_ids}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignments = []
        try:
            with transaction.atomic():
                for officer_id in unique_officer_ids:
                    resolver, _ = CategoryResolver.objects.update_or_create(
                        category_id=category_id,
                        campus=campus_id,
                        college=college_id,
                        department_id=department_id,
                        officer_id=officer_id,
                        defaults={
                            'escalation_time': parsed_escalation_time,
                            'active': active,
                        },
                    )
                    assignments.append(resolver)
        except Exception as exc:
            return DRFResponse(
                {'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(assignments, many=True)
        return DRFResponse(
            {
                'count': len(assignments),
                'results': serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class ComplaintViewSet(viewsets.ModelViewSet):
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return ComplaintCreateSerializer
        return ComplaintSerializer

    def get_queryset(self):
        return accessible_complaints_for(self.request.user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        import json

        data = request.data.copy()
        data.pop('user', None)

        def _normalize_list_field(payload, key):
            raw_value = payload.get(key, '[]')
            try:
                parsed_value = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
            except (ValueError, TypeError):
                parsed_value = []

            if hasattr(payload, 'setlist'):
                payload.setlist(key, parsed_value)
            else:
                payload[key] = parsed_value

        _normalize_list_field(data, 'cc_emails')
        _normalize_list_field(data, 'cc_officer_ids')
        _normalize_list_field(data, 'cc_office_ids')

        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save(submitted_by=request.user)

        try:
            service.process_complaint(complaint)
            complaint.refresh_from_db()
        except Exception:
            pass

        output_serializer = ComplaintSerializer(complaint, context={'request': request})
        return DRFResponse(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='analytics')
    def analytics(self, request):
        if not (request.user.is_admin() or request.user.is_officer()):
            return DRFResponse({'error': 'Only officers and admins can view complaint analytics.'}, status=status.HTTP_403_FORBIDDEN)

        scope = (request.query_params.get('scope') or '').strip().lower()

        # Officers can only access their own assigned-complaint analytics.
        if request.user.is_officer() and not request.user.is_admin():
            return DRFResponse(build_complaint_analytics(request.user), status=status.HTTP_200_OK)

        if scope in ('', 'auto', 'admin'):
            return DRFResponse(build_complaint_analytics(request.user), status=status.HTTP_200_OK)

        if scope == 'officer':
            officer_id = request.query_params.get('officer_id')
            if not officer_id:
                return DRFResponse(
                    {'error': 'officer_id is required when scope=officer.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            officer_user = get_object_or_404(User, id=officer_id, role='officer')
            return DRFResponse(build_complaint_analytics(officer_user), status=status.HTTP_200_OK)

        return DRFResponse(
            {'error': "Invalid scope. Use 'admin' or 'officer'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @action(detail=True, methods=['post'], url_path='assign')
    def assign(self, request, pk=None):
        complaint = get_object_or_404(Complaint, pk=pk)
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to assign this complaint.'}, status=status.HTTP_403_FORBIDDEN)
        officer_id = request.data.get('officer_id')
        resolver_id = request.data.get('resolver_id')

        if not officer_id:
            return DRFResponse({'error': 'officer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        officer = get_object_or_404(User, id=officer_id, role='officer')

        resolver = None
        if resolver_id:
            resolver = get_object_or_404(CategoryResolver, id=resolver_id, active=True)
            if resolver.category_id != getattr(complaint.category, 'id', None) and resolver.category_id != getattr(complaint.category, 'category_id', None):
                return DRFResponse({'error': 'Selected resolver does not belong to this complaint category.'}, status=status.HTTP_400_BAD_REQUEST)
            if resolver.officer_id != officer.id:
                return DRFResponse({'error': 'Selected resolver officer does not match the provided officer.'}, status=status.HTTP_400_BAD_REQUEST)
            if not resolver.matches_complaint_scope(complaint):
                return DRFResponse({'error': 'Selected resolver does not match the complainant\'s campus/college/department.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            for candidate in CategoryResolver.objects.filter(
                category=complaint.category,
                officer=officer,
                active=True,
            ).select_related('category', 'department', 'officer').order_by('department_id', 'college', 'campus', 'id'):
                if candidate.matches_complaint_scope(complaint):
                    resolver = candidate
                    break

        if resolver is None:
            return DRFResponse({'error': 'No matching resolver found for the selected officer.'}, status=status.HTTP_400_BAD_REQUEST)

        Assignment.objects.create(
            complaint=complaint,
            officer=officer,
            resolver=resolver,
            reason='manual',
        )
        complaint.assigned_officer = officer
        complaint.current_resolver = resolver
        complaint.set_escalation_deadline(
            resolver.escalation_time,
            base_time=complaint.created_at,
        )
        complaint.save()

        return DRFResponse({'detail': 'Complaint assigned successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='eligible-officers')
    def eligible_officers(self, request, pk=None):
        complaint = get_object_or_404(Complaint, pk=pk)
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to manage this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        officers_qs = User.objects.filter(role='officer', is_active=True).select_related('officer_profile')

        if complaint.category_id:
            officers = [officer for officer in officers_qs if complaint.category.matches_officer(officer)]
        else:
            officers = list(officers_qs)

        data = [
            {
                'id': officer.id,
                'email': officer.email,
                'first_name': officer.first_name,
                'last_name': officer.last_name,
                'full_name': officer.full_name,
                'is_current_assignee': complaint.assigned_officer_id == officer.id,
            }
            for officer in officers
        ]

        return DRFResponse(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reassign')
    def reassign(self, request, pk=None):
        complaint = get_object_or_404(Complaint, pk=pk)
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to reassign this complaint.'}, status=status.HTTP_403_FORBIDDEN)
        new_officer_id = request.data.get('officer_id')
        resolver_id = request.data.get('resolver_id')
        reason = request.data.get('reason', 'manual reassignment')
        if not new_officer_id:
            return DRFResponse({'error': 'officer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        officer = get_object_or_404(User, id=new_officer_id, role='officer')

        resolver = None
        if resolver_id:
            resolver = get_object_or_404(CategoryResolver, id=resolver_id, active=True)
            if resolver.category_id != getattr(complaint.category, 'id', None) and resolver.category_id != getattr(complaint.category, 'category_id', None):
                return DRFResponse({'error': 'Selected resolver does not belong to this complaint category.'}, status=status.HTTP_400_BAD_REQUEST)
            if resolver.officer_id != officer.id:
                return DRFResponse({'error': 'Selected resolver officer does not match the provided officer.'}, status=status.HTTP_400_BAD_REQUEST)
            if not resolver.matches_complaint_scope(complaint):
                return DRFResponse({'error': 'Selected resolver does not match the complainant\'s campus/college/department.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            for candidate in CategoryResolver.objects.filter(
                category=complaint.category,
                officer=officer,
                active=True,
            ).select_related('category', 'department', 'officer').order_by('department_id', 'college', 'campus', 'id'):
                if candidate.matches_complaint_scope(complaint):
                    resolver = candidate
                    break

        if resolver is None:
            return DRFResponse(
                {'error': 'Unable to determine a resolver for this complaint. Select an officer that matches the complaint scope.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Assignment.objects.create(
            complaint=complaint,
            officer=officer,
            resolver=resolver,
            reason=reason,
        )

        complaint.assigned_officer = officer
        complaint.current_resolver = resolver
        complaint.save()

        return DRFResponse(
            {'detail': 'Complaint reassigned successfully', 'assigned_officer_id': officer.id},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['get'], url_path='eligible-resolvers')
    def eligible_resolvers(self, request, pk=None):
        """Return CategoryResolver records for this complaint, optionally filtered by campus/college/department query params."""
        complaint = get_object_or_404(Complaint, pk=pk)
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to view resolvers for this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        campus = request.query_params.get('campus')
        college = request.query_params.get('college')
        department_id = request.query_params.get('department')

        qs = CategoryResolver.objects.filter(category=complaint.category, active=True).select_related('officer', 'department')
        if campus is not None:
            qs = qs.filter(campus=campus)
        if college is not None:
            qs = qs.filter(college=college)
        if department_id is not None:
            qs = qs.filter(department_id=department_id)

        # Only include resolvers that actually match the complaint's scope
        resolvers = [r for r in qs if r.matches_complaint_scope(complaint)]
        serializer = CategoryResolverSerializer(resolvers, many=True)
        return DRFResponse({'count': len(resolvers), 'results': serializer.data}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, pk=None):
        complaint = get_object_or_404(Complaint, pk=pk)
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to update this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('status')
        if new_status not in dict(Complaint.STATUS_CHOICES):
            return DRFResponse({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        complaint.status = new_status
        complaint.save()

        from .models import Notification

        if complaint.submitted_by_id:
            Notification.objects.create(
                user=complaint.submitted_by,
                complaint=complaint,
                notification_type='complaint_update',
                title='Complaint status updated',
                message=f"Your complaint '{complaint.title}' status changed to {complaint.get_status_display()}.",
            )
            broadcast_notification_update(complaint.submitted_by_id)

        if complaint.assigned_officer_id and complaint.assigned_officer_id != complaint.submitted_by_id:
            Notification.objects.create(
                user=complaint.assigned_officer,
                complaint=complaint,
                notification_type='complaint_update',
                title='Complaint status updated',
                message=f"Complaint '{complaint.title}' changed to {complaint.get_status_display()}.",
            )
            broadcast_notification_update(complaint.assigned_officer_id)

        return DRFResponse({'detail': f'Status updated to {new_status}'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='escalate')
    def escalate(self, request, pk=None):
        complaint = get_object_or_404(Complaint, pk=pk)
        if not can_manage_complaint(request.user, complaint):
            return DRFResponse({'error': 'You do not have permission to escalate this complaint.'}, status=status.HTTP_403_FORBIDDEN)

        if not complaint.current_resolver:
            return DRFResponse({'error': 'No current resolver set'}, status=status.HTTP_400_BAD_REQUEST)

        if complaint.escalate_to_next_level():
            complaint.refresh_from_db()
            return DRFResponse(
                {
                    'detail': f'Escalated to {complaint.current_resolver.scope_label()}',
                    'assigned_to': complaint.assigned_officer.email if complaint.assigned_officer_id else None,
                },
                status=status.HTTP_200_OK,
            )

        return DRFResponse({'error': 'No broader resolver available'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='responses')
    def get_responses(self, request, pk=None):
        complaint = self.get_object()
        responses = Response.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = ResponseSerializer(responses, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='comments')
    def get_comments(self, request, pk=None):
        complaint = self.get_object()
        comments = Comment.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = CommentSerializer(comments, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path=r'attachments/(?P<attachment_id>[^/.]+)/download')
    def download_attachment(self, request, pk=None, attachment_id=None):
        complaint = self.get_object()
        attachment = get_object_or_404(ComplaintAttachment, id=attachment_id, complaint=complaint)

        filename = attachment.filename or 'attachment'
        content_type = attachment.content_type or 'application/octet-stream'

        if attachment.file_data:
            response = HttpResponse(attachment.file_data, content_type=content_type)
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response

        if attachment.file:
            try:
                file_handle = attachment.file.open('rb')
                response = FileResponse(file_handle, content_type=content_type)
                response['Content-Disposition'] = f'inline; filename="{filename}"'
                return response
            except Exception as exc:
                raise Http404('Attachment file is unavailable') from exc

        raise Http404('Attachment file is unavailable')

    @action(detail=False, methods=['get'], url_path='cc')
    def cc_complaints(self, request):
        user_email = request.user.email
        cc_complaints = Complaint.objects.filter(cc_list__email=user_email).distinct().order_by('-created_at')
        serializer = ComplaintSerializer(cc_complaints, many=True, context={'request': request})
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)


class CommentViewSet(viewsets.ModelViewSet):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        complaint_qs = accessible_complaints_for(self.request.user)
        queryset = Comment.objects.filter(complaint__in=complaint_qs)
        complaint_id = self.request.query_params.get('complaint')
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        complaint = serializer.validated_data.get('complaint')
        user = self.request.user
        if not accessible_complaints_for(user).filter(pk=complaint.pk).exists():
            raise PermissionDenied('You do not have access to this complaint.')

        comment_type = serializer.validated_data.get('comment_type', 'comment')
        if complaint.submitted_by == user and comment_type in ['comment', 'rating']:
            has_response = Response.objects.filter(complaint=complaint).exists()
            if not has_response:
                raise ValidationError({'detail': 'You can add a comment or rating only after an officer responds to your complaint.'})

        serializer.save(author=user)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        if request.user != comment.author:
            return DRFResponse({'error': 'You can only edit your own comments'}, status=status.HTTP_403_FORBIDDEN)
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if request.user != comment.author:
            return DRFResponse({'error': 'You can only delete your own comments'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ResponseViewSet(viewsets.ModelViewSet):
    serializer_class = ResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        complaint_qs = accessible_complaints_for(self.request.user)
        queryset = Response.objects.filter(complaint__in=complaint_qs)
        complaint_id = self.request.query_params.get('complaint')
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_admin() or user.is_officer()):
            raise PermissionDenied('Only officers and admins can respond to complaints.')

        complaint = serializer.validated_data.get('complaint')
        if not accessible_complaints_for(user).filter(pk=complaint.pk).exists():
            raise PermissionDenied('You do not have access to this complaint.')

        serializer.save(responder=user)

    def destroy(self, request, *args, **kwargs):
        response = self.get_object()
        if request.user != response.responder:
            return DRFResponse({'error': 'You can only delete your own responses'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        response = self.get_object()
        if request.user != response.responder:
            return DRFResponse({'error': 'You can only edit your own responses'}, status=status.HTTP_403_FORBIDDEN)
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)


class PublicAnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = PublicAnnouncementSerializer

    def _can_manage_announcement(self, user, announcement):
        if not user.is_authenticated:
            return False
        if getattr(user, 'role', None) == 'admin':
            return True
        if getattr(user, 'role', None) == 'officer':
            return announcement.created_by_id == user.id
        return False

    def get_authenticators(self):
        if getattr(self, 'action', None) in ['list', 'retrieve']:
            return []
        return super().get_authenticators()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        if self.action == 'comments' and self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = PublicAnnouncement.objects.select_related('created_by').all()
        user = self.request.user

        # Allow public listing/retrieving of active announcements
        if self.action in ['list', 'retrieve']:
            if user.is_authenticated and getattr(user, 'role', None) in ('officer', 'admin'):
                if user.role == 'admin':
                    return queryset
                return queryset.filter(created_by=user)

            now = timezone.now()
            return queryset.filter(is_active=True).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
            )

        # Allow comments action to access active announcements for listing by anyone,
        # and for posting by authenticated users.
        if self.action == 'comments':
            now = timezone.now()
            active_qs = queryset.filter(is_active=True).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
            )
            # GET comments: public
            if self.request.method == 'GET':
                return active_qs
            # POST comments: require authenticated user
            if self.request.method == 'POST':
                if user.is_authenticated:
                    return active_qs
                return PublicAnnouncement.objects.none()

        if not user.is_authenticated:
            return PublicAnnouncement.objects.none()
        if getattr(user, 'role', None) == 'admin':
            return queryset
        if getattr(user, 'role', None) == 'officer':
            return queryset.filter(created_by=user)
        return PublicAnnouncement.objects.none()

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) not in ('officer', 'admin'):
            return DRFResponse(
                {'error': 'Only officers and admins can create announcements.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get', 'post'], url_path='comments')
    def comments(self, request, pk=None):
        announcement = self.get_object()

        if request.method == 'GET':
            queryset = announcement.comments.select_related('user').order_by('-created_at')
            serializer = AnnouncementCommentSerializer(queryset, many=True)
            return DRFResponse(serializer.data, status=status.HTTP_200_OK)

        message = (request.data.get('message') or '').strip()
        if not message:
            return DRFResponse({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

        comment = AnnouncementComment.objects.create(
            announcement=announcement,
            user=request.user,
            message=message,
        )
        serializer = AnnouncementCommentSerializer(comment)
        return DRFResponse(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='hide')
    def hide(self, request, pk=None):
        announcement = self.get_object()
        if not self._can_manage_announcement(request.user, announcement):
            return DRFResponse(
                {'error': 'You do not have permission to hide this announcement.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        announcement.is_active = False
        announcement.save(update_fields=['is_active', 'updated_at'])
        return DRFResponse(PublicAnnouncementSerializer(announcement).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='show')
    def show(self, request, pk=None):
        announcement = self.get_object()
        if not self._can_manage_announcement(request.user, announcement):
            return DRFResponse(
                {'error': 'You do not have permission to show this announcement.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        announcement.is_active = True
        announcement.save(update_fields=['is_active', 'updated_at'])
        return DRFResponse(PublicAnnouncementSerializer(announcement).data, status=status.HTTP_200_OK)


class AnnouncementCommentViewSet(viewsets.ModelViewSet):
    """ViewSet to allow users to edit/delete their own announcement comments."""
    queryset = AnnouncementComment.objects.all()
    serializer_class = AnnouncementCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and getattr(user, 'role', None) == 'admin':
            return AnnouncementComment.objects.select_related('user', 'announcement').all()
        # Allow users to see comments for active announcements and their own comments
        return AnnouncementComment.objects.select_related('user', 'announcement').filter(
            models.Q(announcement__is_active=True) | models.Q(user=user)
        )

    def perform_update(self, serializer):
        comment = self.get_object()
        if comment.user_id != self.request.user.id:
            raise PermissionDenied('You can only edit your own comments')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.user_id != request.user.id and not request.user.is_admin():
            return DRFResponse({'error': 'You can only delete your own comments'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAdminRole]

    @action(detail=False, methods=['get'], url_path='my-complaints')
    def my_complaints(self, request):
        user = request.user
        if not user or not user.is_authenticated or (not user.is_officer() and not user.is_admin()):
            return DRFResponse({'error': 'Only officers and admins can view assigned complaints.'}, status=status.HTTP_403_FORBIDDEN)

        # Active assignments (ended_at is null) for this officer
        assignments = Assignment.objects.filter(officer=user, ended_at__isnull=True).select_related('complaint__category', 'resolver', 'officer')
        complaints = [a.complaint for a in assignments if a.complaint is not None]
        serializer = ComplaintSerializer(complaints, many=True, context={'request': request})
        return DRFResponse({'count': len(complaints), 'results': serializer.data}, status=status.HTTP_200_OK)


class AvailabilityRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilityRuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return AvailabilityRule.objects.none()

        user = self.request.user
        if user.is_admin():
            return AvailabilityRule.objects.all()
        if user.is_officer():
            return AvailabilityRule.objects.filter(officer=user)
        return AvailabilityRule.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_officer():
            rule = serializer.save(officer=user)
        elif user.is_admin():
            if not serializer.validated_data.get('officer'):
                raise ValidationError({'officer_id': 'Officer is required for availability rules.'})
            rule = serializer.save()
        else:
            raise PermissionDenied('Only officers can create availability rules.')

        AvailabilityService.ensure_generated_slots(
            [rule.officer_id],
            timezone.localdate(),
            range_days=30,
        )

    def perform_update(self, serializer):
        rule = serializer.save()
        AvailabilityService.ensure_generated_slots(
            [rule.officer_id],
            timezone.localdate(),
            range_days=30,
        )


class AvailabilityBlockViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilityBlockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return AvailabilityBlock.objects.none()

        user = self.request.user
        if user.is_admin():
            return AvailabilityBlock.objects.all()
        if user.is_officer():
            return AvailabilityBlock.objects.filter(officer=user)
        return AvailabilityBlock.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_officer():
            block = serializer.save(officer=user)
        elif user.is_admin():
            if not serializer.validated_data.get('officer'):
                raise ValidationError({'officer_id': 'Officer is required for availability blocks.'})
            block = serializer.save()
        else:
            raise PermissionDenied('Only officers can create availability blocks.')

        AvailabilityService.apply_block_to_slots(block)


class AppointmentAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def _maybe_generate_slots(self, officer_ids, preferred_date):
        if not officer_ids:
            return
        start_date = parse_date(preferred_date) if preferred_date else timezone.localdate()
        if not start_date:
            start_date = timezone.localdate()
        AvailabilityService.ensure_generated_slots(officer_ids, start_date)

    def _deactivate_overlapping_generated(self, officer_id, available_date, start_time, end_time):
        if not officer_id or not available_date or not start_time or not end_time:
            return

        overlaps = AppointmentAvailability.objects.filter(
            officer_id=officer_id,
            available_date=available_date,
            is_active=True,
            source=AppointmentAvailability.SOURCE_RULE,
        ).exclude(start_time__gte=end_time).exclude(end_time__lte=start_time)

        if overlaps.exists():
            overlaps.update(is_active=False)

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return AppointmentAvailability.objects.none()

        queryset = AppointmentAvailability.objects.select_related('officer').all()
        user = self.request.user
        if user.is_admin():
            return queryset
        if user.is_officer():
            return queryset.filter(officer=user)

        active_statuses = ['pending', 'confirmed', 'completed']
        return queryset.filter(is_active=True).exclude(appointments__status__in=active_statuses).distinct()

    def perform_create(self, serializer):
        user = self.request.user
        available_date = serializer.validated_data.get('available_date')
        start_time = serializer.validated_data.get('start_time')
        end_time = serializer.validated_data.get('end_time')
        if user.is_officer():
            self._deactivate_overlapping_generated(user.id, available_date, start_time, end_time)
            serializer.save(officer=user, source=AppointmentAvailability.SOURCE_MANUAL)
            return
        if user.is_admin():
            if not serializer.validated_data.get('officer'):
                raise ValidationError({'officer_id': 'Officer is required for availability slots.'})
            officer = serializer.validated_data.get('officer')
            self._deactivate_overlapping_generated(officer.id if officer else None, available_date, start_time, end_time)
            serializer.save(source=AppointmentAvailability.SOURCE_MANUAL)
            return
        raise PermissionDenied('Only officers can create availability slots.')

    @action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        queryset = AppointmentAvailability.objects.select_related('officer').filter(is_active=True)
        preferred_date = request.query_params.get('preferred_date')
        officer_id = request.query_params.get('officer_id')
        category_id = request.query_params.get('category_id')

        officer_ids = []
        if officer_id:
            officer_ids = [officer_id]
        elif category_id:
            officer_ids = list(CategoryResolver.objects.filter(
                category_id=category_id,
                active=True,
            ).values_list('officer_id', flat=True))
        self._maybe_generate_slots(officer_ids, preferred_date)

        if preferred_date:
            queryset = queryset.filter(available_date=preferred_date)
        if officer_id:
            queryset = queryset.filter(officer_id=officer_id)
        if category_id:
            officer_ids = CategoryResolver.objects.filter(
                category_id=category_id,
                active=True,
            ).values_list('officer_id', flat=True)
            queryset = queryset.filter(officer_id__in=officer_ids)

        queryset = queryset.exclude(appointments__status__in=['pending', 'confirmed', 'completed']).distinct()
        serializer = self.get_serializer(queryset, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='free-slots')
    def free_slots(self, request):
        """Return free slots grouped by date, optionally filtered by preferred_date."""
        from collections import defaultdict
        queryset = AppointmentAvailability.objects.select_related('officer').filter(is_active=True)
        preferred_date = request.query_params.get('preferred_date')
        officer_id = request.query_params.get('officer_id')
        category_id = request.query_params.get('category_id')

        if not category_id:
            return DRFResponse(
                {'error': 'category_id is required to fetch free slots.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        officer_ids = []
        if officer_id:
            officer_ids = [officer_id]
        elif category_id:
            officer_ids = list(CategoryResolver.objects.filter(
                category_id=category_id,
                active=True,
            ).values_list('officer_id', flat=True))
        self._maybe_generate_slots(officer_ids, preferred_date)

        if preferred_date:
            queryset = queryset.filter(available_date__gte=preferred_date)
        if officer_id:
            queryset = queryset.filter(officer_id=officer_id)
        if category_id:
            officer_ids = CategoryResolver.objects.filter(
                category_id=category_id,
                active=True,
            ).values_list('officer_id', flat=True)
            queryset = queryset.filter(officer_id__in=officer_ids)

        queryset = queryset.exclude(
            appointments__status__in=['pending', 'confirmed', 'completed']
        ).distinct().order_by('available_date', 'start_time')

        grouped = defaultdict(list)
        for slot in queryset:
            date_key = str(slot.available_date)
            grouped[date_key].append(self.get_serializer(slot).data)

        result = [{'date': date, 'slots': slots} for date, slots in sorted(grouped.items())]
        return DRFResponse(result, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        if request.user.role not in ('officer', 'admin'):
            return DRFResponse(
                {'error': 'Only officers and admins can define appointment availability.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Appointment.objects.none()

        user = self.request.user
        if user.is_admin():
            return Appointment.objects.all()
        if user.is_officer():
            return Appointment.objects.filter(
                models.Q(officer=user) | models.Q(requested_by=user)
            ).distinct()
        return Appointment.objects.filter(requested_by=user)

    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        complaint = serializer.validated_data.get('complaint')
        if complaint and not accessible_complaints_for(self.request.user).filter(pk=complaint.pk).exists():
            raise PermissionDenied('You do not have access to this complaint.')

        if complaint and not (self.request.user.is_admin() or self.request.user.is_officer()):
            if complaint.submitted_by_id != self.request.user.id:
                raise PermissionDenied('You can only request appointments for your own complaints.')

        slot = serializer.validated_data.get('availability_slot')
        with transaction.atomic():
            locked_slot = None
            if slot:
                locked_slot = AppointmentAvailability.objects.select_for_update().get(pk=slot.pk)
                active_appointments = Appointment.objects.select_for_update().filter(
                    availability_slot=locked_slot,
                    status__in=['pending', 'confirmed', 'completed'],
                )
                if active_appointments.exists():
                    raise ValidationError({'availability_slot_id': 'Selected time slot is no longer available.'})

            save_kwargs = {'requested_by': self.request.user}
            if locked_slot:
                save_kwargs['availability_slot'] = locked_slot
                save_kwargs['officer'] = locked_slot.officer
                scheduled_at = datetime.combine(locked_slot.available_date, locked_slot.start_time)
                if timezone.is_naive(scheduled_at):
                    scheduled_at = timezone.make_aware(scheduled_at)
                save_kwargs['scheduled_at'] = scheduled_at

            appointment = serializer.save(**save_kwargs)
        if appointment.status != 'pending':
            appointment.status = 'pending'
            appointment.save(update_fields=['status', 'updated_at'])

        if appointment.officer_id:
            _send_appointment_notifications(appointment, 'pending', actor=self.request.user)

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        appointment = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Appointment.STATUS_CHOICES):
            return DRFResponse({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        if request.user.is_admin() or request.user.id == appointment.officer_id:
            if new_status not in {'confirmed', 'rejected', 'completed', 'canceled'}:
                return DRFResponse({'error': 'Officers can only confirm, reject, complete, or cancel appointments.'}, status=status.HTTP_400_BAD_REQUEST)
            if new_status == 'rejected' and not request.data.get('rejection_reason'):
                return DRFResponse({'error': 'rejection_reason is required when rejecting an appointment.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = new_status
            if request.data.get('rejection_reason') is not None:
                appointment.rejection_reason = request.data.get('rejection_reason', '')
            appointment.save()
            _send_appointment_notifications(appointment, new_status, actor=request.user)
            return DRFResponse(AppointmentSerializer(appointment, context={'request': request}).data)

        if request.user.id == appointment.requested_by_id and new_status == 'canceled' and appointment.status in {'pending', 'confirmed'}:
            appointment.status = new_status
            appointment.save()
            _send_appointment_notifications(appointment, new_status, actor=request.user)
            return DRFResponse(AppointmentSerializer(appointment, context={'request': request}).data)

        return DRFResponse({'error': 'You do not have permission to update this appointment.'}, status=status.HTTP_403_FORBIDDEN)
