"""
Celery tasks for complaint management
Use this if you have Celery set up in your project
"""
from celery import shared_task
from django.utils import timezone
from complaints.escalation_service import EscalationService
import logging

logger = logging.getLogger(__name__)


@shared_task
def check_escalations():
    """
    Celery task to check and process escalations
    This can be scheduled using celery beat
    """
    try:
        logger.info("Starting escalation check task...")
        results = EscalationService.check_and_escalate_complaints()
        
        logger.info(
            f"Escalation check completed - "
            f"Escalated: {results['escalated']}, "
            f"Failed: {results['failed']}, "
            f"Total checked: {results['total_checked']}"
        )
        
        return results
    except Exception as e:
        logger.error(f"Error during escalation check: {str(e)}", exc_info=True)
        raise


@shared_task
def send_escalation_reminders():
    """
    Celery task to send reminders about pending escalations
    Sent to officers about complaints approaching escalation deadline
    """
    try:
        from datetime import timedelta
        from complaints.models import Complaint
        from accounts.email_service import EmailService
        
        # Get complaints that will escalate within 24 hours
        now = timezone.now()
        upcoming_escalation = Complaint.objects.filter(
            escalation_deadline__lte=now + timedelta(hours=24),
            escalation_deadline__gt=now,
            status__in=['pending', 'in_progress']
        )
        
        count = 0
        for complaint in upcoming_escalation:
            if complaint.assigned_officer:
                subject = f"Resolution Reminder: {complaint.title}"
                message = (
                    f"Complaint {complaint.complaint_id} needs resolution before escalation.\n"
                    f"Time remaining: {complaint.escalation_deadline - now}"
                )
                EmailService.send_email(
                    subject=subject,
                    message=message,
                    recipient_list=[complaint.assigned_officer.email],
                    email_type='resolution_reminder',
                    recipient_user=complaint.assigned_officer
                )
                count += 1
        
        logger.info(f"Sent {count} escalation reminders")
        return {'count': count}
    except Exception as e:
        logger.error(f"Error sending escalation reminders: {str(e)}", exc_info=True)
        raise


@shared_task
def get_escalation_statistics():
    """
    Celery task to gather escalation statistics
    Can be used for monitoring and analytics
    """
    try:
        stats = EscalationService.get_escalation_statistics()
        logger.info(f"Escalation statistics: {stats}")
        return stats
    except Exception as e:
        logger.error(f"Error gathering escalation statistics: {str(e)}", exc_info=True)
        raise
