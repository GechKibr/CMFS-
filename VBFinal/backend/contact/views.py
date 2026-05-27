from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import ContactMessage
from .serializers import ContactMessageSerializer

class ContactMessageViewSet(viewsets.ModelViewSet):
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        if self.action == 'my_messages':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user and request.user.is_authenticated:
            serializer.save(user=request.user)
        else:
            serializer.save()
        return Response({'message': 'Your message has been sent successfully!'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-messages')
    def my_messages(self, request):
        queryset = ContactMessage.objects.filter(user=request.user).order_by('-created_at')
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        contact_message = self.get_object()
        response_message = (request.data.get('response_message') or '').strip()

        if not response_message:
            return Response({'detail': 'response_message is required.'}, status=status.HTTP_400_BAD_REQUEST)

        contact_message.response_message = response_message
        contact_message.replied_at = timezone.now()
        contact_message.replied_by = request.user
        contact_message.is_read = True
        contact_message.save(update_fields=['response_message', 'replied_at', 'replied_by', 'is_read'])

        serializer = self.get_serializer(contact_message)
        return Response(serializer.data, status=status.HTTP_200_OK)
