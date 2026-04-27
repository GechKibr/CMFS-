from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "user",
            "complaint",
            "helpdesk_session_id",
            "notification_type",
            "title",
            "message",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
