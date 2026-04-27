from datetime import datetime

from django.db import models, transaction
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_duration
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response as DRFResponse

from accounts.models import User

from .models import (
    AnnouncementComment,
    AnnouncementLike,
    Appointment,
    AppointmentAvailability,
    Assignment,
    Category,
    CategoryResolver,
    Comment,
    Complaint,
    ComplaintAttachment,
    ComplaintCC,
    PublicAnnouncement,
    ResolverLevel,
    Response,
)
from notifications.models import Notification
from .serializers import (
    AnnouncementCommentSerializer,
    AppointmentSerializer,
    AppointmentAvailabilitySerializer,
    AssignmentSerializer,
    CategoryResolverSerializer,
    CategorySerializer,
    CommentSerializer,
    ComplaintCreateSerializer,
    ComplaintUserSerializer,
    ComplaintSerializer,
    PublicAnnouncementSerializer,
    ResolverLevelSerializer,
    ResponseSerializer,
)
from .realtime import build_complaint_analytics
from notifications.realtime import broadcast_notification_update
from .service import service
class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin())


class AuthenticatedReadAdminWriteMixin:
    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'by_language']:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]


def accessible_complaints_for(user):
    if not user or not user.is_authenticated:
        return Complaint.objects.none()
    if user.is_admin():
        return Complaint.objects.all()
    if user.is_officer():
        resolver_category_ids = CategoryResolver.objects.filter(
            officer=user,
            active=True,
        ).values_list('category_id', flat=True)
        return Complaint.objects.filter(
            models.Q(assigned_officer=user)
            | models.Q(submitted_by=user)
            | models.Q(category_id__in=resolver_category_ids)
        ).distinct()
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
        is_category_resolver = CategoryResolver.objects.filter(
            officer=user,
            category_id=complaint.category_id,
            active=True,
        ).exists()

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


class ResolverLevelViewSet(AuthenticatedReadAdminWriteMixin, viewsets.ModelViewSet):
    queryset = ResolverLevel.objects.all()
    serializer_class = ResolverLevelSerializer


class CategoryResolverViewSet(AuthenticatedReadAdminWriteMixin, viewsets.ModelViewSet):
    queryset = CategoryResolver.objects.select_related('category', 'level', 'officer').order_by(
        'category_id',
        'level__level_order',
        'officer_id',
        'id',
    )
    serializer_class = CategoryResolverSerializer

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        payload = request.data or {}
        category_id = payload.get('category')
        level_id = payload.get('level')
        escalation_time = payload.get('escalation_time')
        active = payload.get('active', True)
        officer_ids = payload.get('officer_ids')

        if not category_id or not level_id or escalation_time is None:
            return DRFResponse(
                {'error': 'category, level, and escalation_time are required.'},
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
                        level_id=level_id,
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
        level_id = request.data.get('level_id')
        if not officer_id or not level_id:
            return DRFResponse({'error': 'officer_id and level_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        officer = get_object_or_404(User, id=officer_id, role='officer')
        level = get_object_or_404(ResolverLevel, id=level_id)

        Assignment.objects.create(
            complaint=complaint,
            officer=officer,
            level=level,
            reason='manual',
        )
        complaint.assigned_officer = officer
        complaint.current_level = level
        assignment_config = CategoryResolver.objects.filter(
            category=complaint.category,
            level=level,
            officer=officer,
            active=True,
        ).first()
        complaint.set_escalation_deadline(
            assignment_config.escalation_time if assignment_config else None,
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
        requested_level_id = request.data.get('level_id')
        reason = request.data.get('reason', 'manual reassignment')
        if not new_officer_id:
            return DRFResponse({'error': 'officer_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        officer = get_object_or_404(User, id=new_officer_id, role='officer')

        level = None
        if requested_level_id:
            level = ResolverLevel.objects.filter(id=requested_level_id).first()

        if level is None and complaint.category_id:
            level = CategoryResolver.objects.filter(
                category=complaint.category,
                officer=officer,
                active=True,
            ).select_related('level').order_by('level__level_order', 'id').first()
            level = level.level if level else None

        if level is None and complaint.category_id:
            level = CategoryResolver.objects.filter(
                category=complaint.category,
                active=True,
            ).select_related('level').order_by('level__level_order', 'id').first()
            level = level.level if level else None

        if level is None:
            level = complaint.current_level

        if level is None:
            return DRFResponse(
                {'error': 'Unable to determine a resolver level for this complaint. Assign a category first or include a level.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Assignment.objects.create(
            complaint=complaint,
            officer=officer,
            level=level,
            reason=reason,
        )

        complaint.assigned_officer = officer
        complaint.current_level = level
        complaint.save()

        return DRFResponse(
            {'detail': 'Complaint reassigned successfully', 'assigned_officer_id': officer.id},
            status=status.HTTP_200_OK,
        )

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

        if not complaint.current_level:
            return DRFResponse({'error': 'No current level set'}, status=status.HTTP_400_BAD_REQUEST)

        next_level = ResolverLevel.objects.filter(level_order=complaint.current_level.level_order + 1).first()
        if not next_level:
            return DRFResponse({'error': 'No higher level available'}, status=status.HTTP_400_BAD_REQUEST)

        category_resolver = CategoryResolver.objects.filter(
            category=complaint.category,
            level=next_level,
            active=True,
        ).first()

        if not category_resolver:
            return DRFResponse({'error': 'No resolver found at next level'}, status=status.HTTP_400_BAD_REQUEST)

        Assignment.objects.create(
            complaint=complaint,
            officer=category_resolver.officer,
            level=next_level,
            reason='escalation',
        )

        complaint.current_level = next_level
        complaint.assigned_officer = category_resolver.officer
        complaint.set_escalation_deadline(category_resolver.escalation_time, base_time=complaint.created_at)
        complaint.status = 'escalated'
        complaint.save()

        return DRFResponse(
            {
                'detail': f'Escalated to {next_level.name}',
                'assigned_to': category_resolver.officer.email,
            },
            status=status.HTTP_200_OK,
        )

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

        if self.action in ['list', 'retrieve']:
            if user.is_authenticated and getattr(user, 'role', None) in ('officer', 'admin'):
                if user.role == 'admin':
                    return queryset
                return queryset.filter(created_by=user)

            now = timezone.now()
            return queryset.filter(is_active=True).filter(
                models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
            )

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

    @action(detail=True, methods=['post'], url_path='toggle-like')
    def toggle_like(self, request, pk=None):
        announcement = self.get_object()
        existing = AnnouncementLike.objects.filter(announcement=announcement, user=request.user).first()
        if existing:
            existing.delete()
            liked = False
        else:
            AnnouncementLike.objects.create(announcement=announcement, user=request.user)
            liked = True

        return DRFResponse(
            {
                'liked': liked,
                'likes_count': announcement.likes.count(),
            },
            status=status.HTTP_200_OK,
        )

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


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [IsAdminRole]


class AppointmentAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentAvailabilitySerializer
    permission_classes = [permissions.IsAuthenticated]

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
        if user.is_officer():
            serializer.save(officer=user)
            return
        if user.is_admin():
            if not serializer.validated_data.get('officer'):
                raise ValidationError({'officer_id': 'Officer is required for availability slots.'})
            serializer.save()
            return
        raise PermissionDenied('Only officers can create availability slots.')

    @action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        queryset = AppointmentAvailability.objects.select_related('officer').filter(is_active=True)
        preferred_date = request.query_params.get('preferred_date')
        officer_id = request.query_params.get('officer_id')
        category_id = request.query_params.get('category_id')

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

    def perform_create(self, serializer):
        if self.request.user.is_officer() and not self.request.user.is_admin():
            serializer.save(officer=self.request.user)
            return
        serializer.save()


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
