from django.db.models.signals import post_save
from django.dispatch import receiver
from complaints.models import Complaint, Assignment
from .email_service import EmailService


@receiver(post_save, sender=Complaint)
def complaint_status_changed(sender, instance, created, **kwargs):
    if not created and instance.submitted_by:
        EmailService.send_complaint_notification(instance.submitted_by, instance)


@receiver(post_save, sender=Assignment)
def complaint_assigned(sender, instance, created, **kwargs):
    if created and instance.officer:
        EmailService.send_assignment_notification(instance.officer, instance.complaint)
