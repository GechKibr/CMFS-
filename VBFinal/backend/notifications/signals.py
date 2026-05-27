from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
import threading

from django.db import transaction
from django.db import close_old_connections

from .models import Notification
from .realtime import notification_group_name, serialize_notification, _send


def _send_notification_after_commit(user_id, notification_id=None, event_type=None):
    def worker():
        close_old_connections()
        try:
            channel_payload = None
            if notification_id:
                try:
                    notif = Notification.objects.select_related("complaint").get(pk=notification_id)
                    channel_payload = {"notification": serialize_notification(notif)}
                except Notification.DoesNotExist:
                    channel_payload = {"notification": {"id": notification_id}}

            # Send specific notification payload if available
            if channel_payload and event_type:
                _send(notification_group_name(user_id), event_type, channel_payload)

            # Always notify clients that the user's notification list changed
            _send(notification_group_name(user_id), "notification.updated", {"user_id": user_id})
        finally:
            close_old_connections()

    threading.Thread(target=worker, daemon=True).start()


@receiver(post_save, sender=Notification)
def notification_saved(sender, instance, created, **kwargs):
    if not instance.user_id:
        return

    event_type = "notification.created" if created else "notification.updated"
    notification_id = instance.pk
    transaction.on_commit(lambda: _send_notification_after_commit(instance.user_id, notification_id=notification_id, event_type=event_type))


@receiver(post_delete, sender=Notification)
def notification_deleted(sender, instance, **kwargs):
    if not instance.user_id:
        return

    # After delete, inform clients the list changed
    transaction.on_commit(lambda: _send_notification_after_commit(instance.user_id))
