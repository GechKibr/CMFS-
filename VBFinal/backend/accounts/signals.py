import threading

from django.db import close_old_connections
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from complaints.models import Complaint, Assignment
from .email_service import EmailService


def _run_email_async(send_fn):
    # Keep email I/O out of request/ORM save paths.
    def worker():
        close_old_connections()
        try:
            send_fn()
        finally:
            close_old_connections()

    threading.Thread(target=worker, daemon=True).start()


def _run_email_after_commit(send_fn):
    transaction.on_commit(lambda: _run_email_async(send_fn))


@receiver(post_save, sender=Complaint)
def complaint_status_changed(sender, instance, created, **kwargs):
    if not created and instance.submitted_by:
        _run_email_after_commit(lambda: EmailService.send_complaint_notification(instance.submitted_by, instance))


@receiver(post_save, sender=Assignment)
def complaint_assigned(sender, instance, created, **kwargs):
    if created and instance.officer:
        _run_email_after_commit(lambda: EmailService.send_assignment_notification(instance.officer, instance.complaint))
