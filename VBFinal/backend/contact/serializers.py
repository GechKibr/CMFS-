from rest_framework import serializers
from .models import ContactMessage

class ContactMessageSerializer(serializers.ModelSerializer):
    is_replied = serializers.SerializerMethodField()

    def get_is_replied(self, obj):
        return bool((obj.response_message or '').strip())

    class Meta:
        model = ContactMessage
        fields = [
            'id', 'user', 'name', 'email', 'subject', 'message',
            'response_message', 'replied_at', 'replied_by', 'is_replied',
            'created_at'
        ]
        read_only_fields = ['id', 'user', 'replied_at', 'replied_by', 'is_replied', 'created_at']
