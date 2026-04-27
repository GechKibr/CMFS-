from __future__ import annotations

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .realtime import build_notification_snapshot, notification_group_name


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = notification_group_name(self.user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            "type": "notification.snapshot",
            **await build_notification_snapshot_async(self.user),
        })

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def broadcast_event(self, event):
        await self.send_json({
            "type": event.get("event_type"),
            **event.get("payload", {}),
        })


@database_sync_to_async
def build_notification_snapshot_async(user):
    return build_notification_snapshot(user)
