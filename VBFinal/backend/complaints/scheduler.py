"""
Configuration for automated escalation checks using APScheduler
This file shows how to set up periodic escalation checks in your Django application.

Options:
1. Using APScheduler (for single-threaded servers)
2. Using Celery Beat (for distributed systems)
3. Using Cron jobs (system-level scheduling)
"""

from apscheduler.schedulers.background import BackgroundScheduler
from django.core.management import call_command
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


def check_escalations_task():
    """Background task to check and process escalations"""
    try:
        from complaints.escalation_service import EscalationService
        results = EscalationService.check_and_escalate_complaints()
        logger.info(f"Escalation check completed: {results}")
    except Exception as e:
        logger.error(f"Error in escalation check: {str(e)}")


def start_escalation_scheduler():
    """
    Start the background scheduler for automatic escalation checks
    Call this in your Django app's ready() method
    """
    scheduler = BackgroundScheduler()
    
    # Schedule to run every 30 minutes
    scheduler.add_job(
        check_escalations_task,
        'interval',
        minutes=30,
        id='check_escalations',
        name='Check for complaint escalations',
        replace_existing=True,
        max_instances=1,  # Prevent multiple instances running simultaneously
    )
    
    if not scheduler.running:
        scheduler.start()
        logger.info("Escalation scheduler started")
    
    return scheduler


# CELERY BEAT SCHEDULE (Alternative approach using Celery)
# Add this to your Django settings if using Celery:
"""
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'check-escalations': {
        'task': 'complaints.tasks.check_escalations',
        'schedule': crontab(minute='*/30'),  # Run every 30 minutes
    },
}
"""

# CRON JOB SETUP (System-level scheduling)
# Add this to your crontab (crontab -e):
"""
# Run escalation check every 30 minutes
*/30 * * * * cd /path/to/project && python manage.py check_escalations >> /var/log/cmfs_escalations.log 2>&1
"""
