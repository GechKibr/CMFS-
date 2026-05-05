from django.db import transaction
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.exceptions import PermissionDenied, ValidationError
from notifications.models import Notification
from .models import HelpdeskMessage, HelpdeskSession, HelpdeskSessionParticipant

User = get_user_model()

class HelpdeskService:
    @staticmethod
    def _is_admin(user):
        return bool(getattr(user, 'is_superuser', False) or getattr(user, 'role', None) == 'admin')

    @staticmethod
    def allowed_invitee_roles(user):
        if HelpdeskService._is_admin(user):
            return {User.ROLE_USER, User.ROLE_OFFICER, User.ROLE_ADMIN}

        if getattr(user, 'role', None) == User.ROLE_OFFICER:
            return {User.ROLE_USER, User.ROLE_OFFICER, User.ROLE_ADMIN}

        return {User.ROLE_OFFICER, User.ROLE_ADMIN}

    @staticmethod
    def candidate_users_for_creator(user):
        if not user or not user.is_authenticated:
            return User.objects.none()

        return (
            User.objects.filter(
                is_active=True,
                role__in=HelpdeskService.allowed_invitee_roles(user),
            )
            .exclude(id=user.id)
            .order_by('first_name', 'last_name', 'email')
        )

    @staticmethod
    def sessions_for_user(user):
        if not user or not user.is_authenticated:
            return HelpdeskSession.objects.none()
        if HelpdeskService._is_admin(user):
            return (
                HelpdeskSession.objects.all()
                .select_related('created_by')
                .prefetch_related('participants__user')
                .order_by('-created_at')
            )
        return (
            HelpdeskSession.objects.filter(participants__user_id=user.id)
            .select_related('created_by')
            .prefetch_related('participants__user')
            .distinct()
            .order_by('-created_at')
        )

    @staticmethod
    def ensure_session_access(user, session):
        if not user or not user.is_authenticated:
            raise PermissionDenied('Authentication required.')
        if HelpdeskService._is_admin(user):
            return
        if not session.participants.filter(user_id=user.id).exists():
            raise PermissionDenied('You do not have access to this helpdesk session.')

    @staticmethod
    def ensure_session_delete_access(user, session):
        if not user or not user.is_authenticated:
            raise PermissionDenied('Authentication required.')

        if HelpdeskService._is_admin(user):
            return

        if session.created_by_id != user.id:
            raise PermissionDenied('Only the session creator or admins can delete this session.')

    @staticmethod
    @transaction.atomic
    def create_session(*, creator, kind, title='', participant_ids=None):
        participant_ids = set(participant_ids or [])
        participant_ids.add(creator.id)

        if kind in [HelpdeskSession.KIND_AUDIO_CALL, HelpdeskSession.KIND_VIDEO_CALL] and len(participant_ids) != 2:
            raise ValidationError('Audio and video calls must include exactly 2 participants.')

        if kind in [HelpdeskSession.KIND_AUDIO_CONFERENCE, HelpdeskSession.KIND_VIDEO_CONFERENCE] and len(participant_ids) < 2:
            raise ValidationError('Conferences require at least 2 participants.')

        session = HelpdeskSession.objects.create(
            created_by=creator,
            kind=kind,
            title=(title or '').strip(),
            status=HelpdeskSession.STATUS_PENDING,
        )

        participants = []
        for user_id in participant_ids:
            role = HelpdeskSessionParticipant.ROLE_HOST if user_id == creator.id else HelpdeskSessionParticipant.ROLE_PARTICIPANT
            participants.append(
                HelpdeskSessionParticipant(
                    session=session,
                    user_id=user_id,
                    role=role,
                )
            )
        HelpdeskSessionParticipant.objects.bulk_create(participants)

        invitees = User.objects.filter(id__in=participant_ids - {creator.id}, is_active=True)
        for invitee in invitees:
            Notification.objects.create(
                user=invitee,
                notification_type='helpdesk_invitation',
                helpdesk_session_id=session.id,
                title='Helpdesk invitation',
                message=f"You were invited to a helpdesk {session.get_kind_display().lower()} session{f' titled \"{session.title}\"' if session.title else ''}.",
            )

        return session

    @staticmethod
    def start_session(session):
        if session.status == HelpdeskSession.STATUS_PENDING:
            session.status = HelpdeskSession.STATUS_ACTIVE
            session.started_at = timezone.now()
            session.save(update_fields=['status', 'started_at', 'updated_at'])
        return session

    @staticmethod
    def end_session(session):
        if session.status != HelpdeskSession.STATUS_ENDED:
            session.status = HelpdeskSession.STATUS_ENDED
            if not session.ended_at:
                session.ended_at = timezone.now()
            session.save(update_fields=['status', 'ended_at', 'updated_at'])
        return session

    @staticmethod
    def create_message(*, session, sender, message_type, content='', payload=None):
        HelpdeskService.ensure_session_access(sender, session)

        payload = payload or {}
        if message_type == HelpdeskMessage.TYPE_TEXT and not (content or '').strip():
            raise ValidationError('Text message content cannot be empty.')

        return HelpdeskMessage.objects.create(
            session=session,
            sender=sender,
            message_type=message_type,
            content=(content or '').strip(),
            payload=payload,
        )

    @staticmethod
    def ensure_session_creator_access(user, session):
        """Ensure the user is the session creator or admin."""
        if not user or not user.is_authenticated:
            raise PermissionDenied('Authentication required.')

        if HelpdeskService._is_admin(user):
            return

        if session.created_by_id != user.id:
            raise PermissionDenied('Only the session creator can manage participants.')

    @staticmethod
    @transaction.atomic
    def add_participants(user, session, participant_ids):
        """Add participants to a helpdesk session."""
        HelpdeskService.ensure_session_creator_access(user, session)

        participant_ids = set(participant_ids or [])
        if not participant_ids:
            raise ValidationError('At least one participant must be provided.')

        # Validate that all users exist and are active
        participants = list(User.objects.filter(id__in=participant_ids, is_active=True))
        if len(participants) != len(participant_ids):
            raise ValidationError('One or more participants were not found or inactive.')

        # Validate that the user has permission to add these participants
        allowed_roles = HelpdeskService.allowed_invitee_roles(user)
        disallowed_participants = [
            participant for participant in participants if participant.role not in allowed_roles
        ]
        if disallowed_participants:
            raise ValidationError('You are not allowed to add one or more selected participants.')

        # Exclude participants already in the session
        existing_ids = set(session.participants.values_list('user_id', flat=True))
        new_participant_ids = participant_ids - existing_ids

        if not new_participant_ids:
            raise ValidationError('All selected participants are already in this session.')

        # Create new participant entries
        new_participants = []
        for user_id in new_participant_ids:
            new_participants.append(
                HelpdeskSessionParticipant(
                    session=session,
                    user_id=user_id,
                    role=HelpdeskSessionParticipant.ROLE_PARTICIPANT,
                )
            )
        HelpdeskSessionParticipant.objects.bulk_create(new_participants)

        # Send notifications to new participants
        invitees = User.objects.filter(id__in=new_participant_ids, is_active=True)
        for invitee in invitees:
            Notification.objects.create(
                user=invitee,
                notification_type='helpdesk_invitation',
                helpdesk_session_id=session.id,
                title='Helpdesk invitation',
                message=f"You were invited to a helpdesk {session.get_kind_display().lower()} session{f' titled \"{session.title}\"' if session.title else ''}.",
            )

        return session

    @staticmethod
    @transaction.atomic
    def remove_participants(user, session, participant_ids):
        """Remove participants from a helpdesk session."""
        HelpdeskService.ensure_session_creator_access(user, session)

        participant_ids = set(participant_ids or [])
        if not participant_ids:
            raise ValidationError('At least one participant must be provided.')

        # Prevent removing the session creator
        if user.id in participant_ids:
            raise ValidationError('Cannot remove the session creator.')

        # Remove the participants
        session.participants.filter(user_id__in=participant_ids).delete()

        return session


service = HelpdeskService()