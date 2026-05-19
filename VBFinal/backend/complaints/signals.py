from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from accounts.email_service import EmailService

from .models import Assignment, Comment, Complaint, Response
from notifications.models import Notification
from .realtime import (
    broadcast_admin_analytics_update,
    broadcast_officer_analytics_update,
    broadcast_thread_update,
)
from notifications.realtime import broadcast_notification_update


def _safe_create_notification(**kwargs):
    user = kwargs.get('user')
    if not user:
        return None
    return Notification.objects.create(**kwargs)


@receiver(post_save, sender=Complaint)
def complaint_saved(sender, instance, created, **kwargs):
    # Auto-route complaints that weren't routed during creation
    if created and instance.category_id and not instance.current_resolver_id and not instance.routing_attempted:
        try:
            from .service import service
            
            # Mark as routing attempted to prevent infinite loops
            Complaint.objects.filter(complaint_id=instance.complaint_id).update(routing_attempted=True)
            
            # Attempt routing
            service.route_complaint(instance)
        except Exception:
            pass
    
    if created and instance.submitted_by_id:
        try:
            _safe_create_notification(
                user=instance.submitted_by,
                complaint=instance,
                notification_type='complaint_update',
                title='Complaint submitted',
                message=f"Your complaint '{instance.title}' has been received and is being processed.",
            )
        except Exception:
            pass

    broadcast_thread_update(instance.complaint_id)
    if instance.submitted_by_id:
        broadcast_notification_update(instance.submitted_by_id)
    if instance.assigned_officer_id:
        broadcast_notification_update(instance.assigned_officer_id)
    if instance.submitted_by_id:
        try:
            EmailService.send_complaint_notification(instance.submitted_by, instance)
        except Exception:
            pass
    try:
        broadcast_admin_analytics_update()
        if instance.assigned_officer_id:
            broadcast_officer_analytics_update(instance.assigned_officer)
    except Exception:
        pass


@receiver(post_save, sender=Assignment)
def assignment_saved(sender, instance, created, **kwargs):
    if not created:
        return

    try:
        _safe_create_notification(
            user=instance.officer,
            complaint=instance.complaint,
            notification_type='new_assignment',
            title='New complaint assigned',
            message=f"Complaint '{instance.complaint.title}' has been assigned to you.",
        )
    except Exception:
        pass

    try:
        _safe_create_notification(
            user=instance.complaint.submitted_by,
            complaint=instance.complaint,
            notification_type='complaint_update',
            title='Complaint assigned',
            message=f"Your complaint '{instance.complaint.title}' has been assigned to {instance.officer.full_name}.",
        )
    except Exception:
        pass

    broadcast_thread_update(instance.complaint_id)
    broadcast_notification_update(instance.officer_id)
    broadcast_notification_update(instance.complaint.submitted_by_id)
    try:
        broadcast_admin_analytics_update()
        broadcast_officer_analytics_update(instance.officer)
    except Exception:
        pass


@receiver(post_save, sender=Comment)
def comment_saved(sender, instance, created, **kwargs):
    if not created:
        return

    target_user = instance.complaint.assigned_officer or instance.complaint.submitted_by
    if target_user and (target_user_id := getattr(target_user, 'id', None)):
        if target_user_id != instance.author_id:
            try:
                _safe_create_notification(
                    user=target_user,
                    complaint=instance.complaint,
                    notification_type='complaint_update',
                    title='New comment on complaint',
                    message=f"New comment on complaint '{instance.complaint.title}'.",
                )
            except Exception:
                pass
            broadcast_notification_update(target_user_id)

    broadcast_thread_update(instance.complaint_id)
    try:
        broadcast_admin_analytics_update()
        if instance.complaint.assigned_officer_id:
            broadcast_officer_analytics_update(instance.complaint.assigned_officer)
    except Exception:
        pass


@receiver(post_save, sender=Response)
def response_saved(sender, instance, created, **kwargs):
    if not created:
        return

    target_user = instance.complaint.submitted_by
    if target_user and target_user.id != instance.author_id:
        try:
            _safe_create_notification(
                user=target_user,
                complaint=instance.complaint,
                notification_type='complaint_update',
                title='Officer response received',
                message=f"An officer responded to your complaint '{instance.complaint.title}'.",
            )
        except Exception:
            pass
        broadcast_notification_update(target_user.id)

    broadcast_thread_update(instance.complaint_id)
    try:
        broadcast_admin_analytics_update()
        if instance.complaint.assigned_officer_id:
            broadcast_officer_analytics_update(instance.complaint.assigned_officer)
    except Exception:
        pass


