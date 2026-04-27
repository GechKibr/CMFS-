from __future__ import annotations

from asgiref.sync import async_to_sync

from .models import Notification

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
            "type": "broadcast.event",
            "event_type": event_type,
            "payload": payload,
        },
    )


def notification_group_name(user_id):
    return f"notifications-user-{user_id}"


def serialize_notification(notification):
    return {
        "id": notification.id,
        "user": notification.user_id,
        "complaint": notification.complaint_id,
        "complaint_id": str(notification.complaint_id) if notification.complaint_id else None,
        "complaint_title": notification.complaint.title if notification.complaint_id else None,
        "helpdesk_session_id": str(notification.helpdesk_session_id) if getattr(notification, "helpdesk_session_id", None) else None,
        "notification_type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "is_read": notification.is_read,
        "read_at": notification.read_at.isoformat() if notification.read_at else None,
        "created_at": notification.created_at.isoformat(),
    }


def build_notification_snapshot(user):
    notifications = Notification.objects.filter(user=user).select_related("complaint").order_by("-created_at")[:25]
    unread_count = Notification.get_unread_for_user(user).count()
    return {
        "notifications": [serialize_notification(item) for item in notifications],
        "unread_count": unread_count,
    }


def broadcast_notification_update(user_id):
    _send(
        notification_group_name(user_id),
        "notification.updated",
        {"user_id": user_id},
    )
