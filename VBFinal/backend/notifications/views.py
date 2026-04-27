from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
	serializer_class = NotificationSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		if getattr(self, "swagger_fake_view", False):
			return Notification.objects.none()

		return Notification.objects.filter(user=self.request.user)

	@action(detail=False, methods=["get"], url_path="unread")
	def unread(self, request):
		notifications = Notification.get_unread_for_user(request.user)
		serializer = self.get_serializer(notifications, many=True)
		return DRFResponse({"count": notifications.count(), "notifications": serializer.data})

	@action(detail=False, methods=["get"], url_path="escalations")
	def escalations(self, request):
		notifications = Notification.get_escalation_notifications(request.user)
		serializer = self.get_serializer(notifications, many=True)
		return DRFResponse({"count": notifications.count(), "notifications": serializer.data})

	@action(detail=True, methods=["post"], url_path="mark-as-read")
	def mark_as_read(self, request, pk=None):
		notification = self.get_object()
		notification.mark_as_read()
		return DRFResponse(
			{
				"message": "Notification marked as read",
				"notification": NotificationSerializer(notification).data,
			},
			status=status.HTTP_200_OK,
		)

	@action(detail=False, methods=["post"], url_path="mark-all-as-read")
	def mark_all_as_read(self, request):
		notifications = Notification.get_unread_for_user(request.user)
		count = notifications.count()
		for notification in notifications:
			notification.mark_as_read()
		return DRFResponse({"message": f"{count} notifications marked as read"}, status=status.HTTP_200_OK)
