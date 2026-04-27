from django.conf import settings
from django.db import models
from django.utils import timezone

from complaints.models import Complaint


class Notification(models.Model):
	"""Model for storing notifications about complaints and escalations."""

	NOTIFICATION_TYPE_CHOICES = [
		('escalation_assigned', 'Escalation Assigned'),
		('escalation_update', 'Escalation Update'),
		('max_escalation', 'Max Escalation'),
		('complaint_update', 'Complaint Update'),
		('appointment', 'Appointment'),
		('helpdesk_invitation', 'Helpdesk Invitation'),
		('new_assignment', 'New Assignment'),
		('resolution_reminder', 'Resolution Reminder'),
		('general', 'General'),
	]

	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='notifications',
	)
	complaint = models.ForeignKey(
		Complaint,
		on_delete=models.CASCADE,
		null=True,
		blank=True,
		related_name='notifications',
	)
	helpdesk_session_id = models.UUIDField(null=True, blank=True)
	notification_type = models.CharField(
		max_length=30,
		choices=NOTIFICATION_TYPE_CHOICES,
		default='general',
	)
	title = models.CharField(max_length=255)
	message = models.TextField()
	is_read = models.BooleanField(default=False)
	read_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['user', 'is_read']),
			models.Index(fields=['notification_type', 'created_at']),
		]
		db_table = 'complaints_notification'

	def __str__(self):
		return f"{self.title} - {self.user.email}"

	def mark_as_read(self):
		"""Mark notification as read."""
		if not self.is_read:
			self.is_read = True
			self.read_at = timezone.now()
			self.save()

	@classmethod
	def get_unread_for_user(cls, user):
		"""Get unread notifications for a user."""
		return cls.objects.filter(user=user, is_read=False)

	@classmethod
	def get_escalation_notifications(cls, user):
		"""Get escalation-related notifications for a user."""
		escalation_types = [
			'escalation_assigned',
			'escalation_update',
			'max_escalation',
		]
		return cls.objects.filter(
			user=user,
			notification_type__in=escalation_types,
		)
