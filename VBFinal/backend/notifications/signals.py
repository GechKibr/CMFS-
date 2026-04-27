from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Notification
from .realtime import broadcast_notification_update, notification_group_name, serialize_notification, _send


@receiver(post_save, sender=Notification)
def notification_saved(sender, instance, created, **kwargs):
    broadcast_notification_update(instance.user_id)
    payload = serialize_notification(instance)
    if instance.user_id:
        _send(
            notification_group_name(instance.user_id),
            "notification.updated" if not created else "notification.created",
            {"notification": payload},
        )


@receiver(post_delete, sender=Notification)
def notification_deleted(sender, instance, **kwargs):
    broadcast_notification_update(instance.user_id)
