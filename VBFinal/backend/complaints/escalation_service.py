"""
Escalation Service for handling automatic complaint escalations
"""
from django.utils import timezone
from django.db.models import Q

from .models import Complaint, CategoryResolver
from accounts.email_service import EmailService
from accounts.models import User


class EscalationService:
    """Service for handling automatic escalation of complaints"""

    @staticmethod
    def _matching_resolvers_for_category(category, complaint):
        if not category:
            return []

        resolvers = [
            resolver
            for resolver in category.resolvers.filter(active=True).select_related('department')
            if resolver.matches_complaint_scope(complaint)
        ]
        resolvers.sort(
            key=lambda resolver: (
                resolver.escalation_level,
                -resolver.scope_rank(),
                resolver.created_at,
                str(resolver.resolver_id),
            )
        )
        return resolvers

    @staticmethod
    def _parent_category_resolvers(complaint):
        if not complaint.category_id or not complaint.category or not complaint.category.parent_id:
            return []

        parent = complaint.category.parent
        resolvers = EscalationService._matching_resolvers_for_category(parent, complaint)
        if not resolvers:
            return []

        return [{
            'category_id': str(parent.category_id),
            'category_name': parent.name,
            'resolvers': resolvers,
        }]

    @staticmethod
    def _get_due_complaints(now=None):
        """
        Recalculate and persist escalation deadlines based on complaint creation time
        and the current resolver escalation_time, then return due complaints.
        """
        now = now or timezone.now()
        active_complaints = Complaint.objects.filter(
            Q(status='in_progress') | Q(status='pending'),
            current_resolver__isnull=False,
            claimed_by__isnull=False,
        )

        due_complaints = []
        for complaint in active_complaints:
            previous_deadline = complaint.escalation_deadline
            complaint.refresh_workflow_deadlines(base_time=complaint.created_at)
            recalculated_deadline = complaint.escalation_deadline

            if previous_deadline != recalculated_deadline:
                Complaint.objects.filter(pk=complaint.pk).update(escalation_deadline=recalculated_deadline)

            if recalculated_deadline and recalculated_deadline <= now:
                due_complaints.append(complaint)

        return due_complaints

    @staticmethod
    def check_and_escalate_complaints():
        """
        Check all pending and in_progress complaints for escalation deadline.
        If deadline passed:
        1. First try to escalate to next level within same category (broader scope)
        2. If no next level available, escalate to parent category
        """
        now = timezone.now()
        escalatable_complaints = EscalationService._get_due_complaints(now)

        escalation_results = {
            'total_checked': len(escalatable_complaints),
            'escalated_same_category': 0,
            'escalated_parent_category': 0,
            'failed': 0,
            'skipped': 0,
            'errors': []
        }

        for complaint in escalatable_complaints:
            try:
                # Try to escalate within same category first (to broader scope)
                if complaint.escalate_to_next_level():
                    escalation_results['escalated_same_category'] += 1
                    EscalationService.send_escalation_notifications(complaint)
                # If no next level in same category, try parent category escalation
                elif complaint.escalate_to_parent_category():
                    escalation_results['escalated_parent_category'] += 1
                    EscalationService.send_parent_escalation_notifications(complaint)
                else:
                    # No escalation path available for this scope; keep it silent.
                    escalation_results['skipped'] += 1
            except Exception as e:
                escalation_results['failed'] += 1
                escalation_results['errors'].append({
                    'complaint_id': str(complaint.complaint_id),
                    'error': str(e)
                })

        return escalation_results

    @staticmethod
    def send_escalation_notifications(complaint):
        """Send notifications about escalation to all relevant parties"""
        try:
            if complaint.assigned_officer:
                EmailService.send_escalation_alert(
                    complaint.assigned_officer,
                    complaint
                )
                EscalationService._create_notification(
                    user=complaint.assigned_officer,
                    complaint=complaint,
                    notification_type='escalation_assigned',
                    title=f"Complaint Escalated: {complaint.title}",
                    message=f"Complaint {complaint.complaint_id} has been escalated for resolution."
                )

            EmailService.send_complaint_notification(
                complaint.submitted_by,
                complaint
            )
            EscalationService._create_notification(
                user=complaint.submitted_by,
                complaint=complaint,
                notification_type='escalation_update',
                title="Your Complaint Has Been Escalated",
                message=f"Your complaint {complaint.complaint_id} has been escalated to a broader resolver scope for faster resolution."
            )

        except Exception as e:
            print(f"Error sending escalation notifications for complaint {complaint.complaint_id}: {str(e)}")

    @staticmethod
    def send_parent_escalation_notifications(complaint):
        """Send notifications about parent category escalation to all relevant parties"""
        try:
            if complaint.assigned_officer:
                EmailService.send_escalation_alert(
                    complaint.assigned_officer,
                    complaint
                )
                EscalationService._create_notification(
                    user=complaint.assigned_officer,
                    complaint=complaint,
                    notification_type='parent_escalation_assigned',
                    title=f"Complaint Escalated to Parent Category: {complaint.title}",
                    message=f"Complaint {complaint.complaint_id} has been escalated to parent category {complaint.category.office_name} for resolution."
                )

            EmailService.send_complaint_notification(
                complaint.submitted_by,
                complaint
            )
            EscalationService._create_notification(
                user=complaint.submitted_by,
                complaint=complaint,
                notification_type='parent_escalation_update',
                title="Your Complaint Escalated to Higher Category",
                message=f"Your complaint {complaint.complaint_id} has been escalated to {complaint.category.office_name} for faster resolution."
            )

        except Exception as e:
            print(f"Error sending parent escalation notifications for complaint {complaint.complaint_id}: {str(e)}")

    @staticmethod
    def notify_admin_max_escalation(complaint):
        """Notify admin when complaint reaches maximum escalation level"""
        try:
            admin_users = User.objects.filter(
                role=User.ROLE_ADMIN,
                is_active=True
            )

            subject = f"URGENT: Complaint Requires Admin Intervention - {complaint.title}"
            message = f"""
Complaint ID: {complaint.complaint_id}
Title: {complaint.title}
Status: {complaint.get_status_display()}

This complaint has reached the maximum resolver scope and requires administrative intervention.
            """

            for admin in admin_users:
                EmailService.send_email(
                    subject=subject,
                    message=message,
                    recipient_list=[admin.email],
                    email_type='escalation_alert',
                    recipient_user=admin
                )
                EscalationService._create_notification(
                    user=admin,
                    complaint=complaint,
                    notification_type='max_escalation',
                    title="URGENT: Complaint Requires Admin Intervention",
                    message=f"Complaint {complaint.complaint_id} has reached maximum escalation and needs immediate attention."
                )
        except Exception as e:
            print(f"Error notifying admin for max escalation: {str(e)}")

    @staticmethod
    def _create_notification(user, complaint, notification_type, title, message):
        """Create a notification record for a user"""
        try:
            from notifications.models import Notification

            Notification.objects.create(
                user=user,
                complaint=complaint,
                notification_type=notification_type,
                title=title,
                message=message
            )
        except ImportError:
            pass
        except Exception as e:
            print(f"Error creating notification: {str(e)}")

    @staticmethod
    def get_escalation_statistics():
        """Get statistics about escalations including parent category escalations"""
        from .models import Assignment
        
        escalated_complaints = Complaint.objects.filter(status='escalated')
        
        # Count same-category escalations
        same_category_escalations = Assignment.objects.filter(
            reason='escalation'
        ).values('complaint').distinct().count()
        
        # Count parent category escalations
        parent_escalations = Assignment.objects.filter(
            reason='parent_escalation'
        ).values('complaint').distinct().count()
        
        pending_escalation = EscalationService._get_due_complaints(timezone.now())

        return {
            'total_escalated': escalated_complaints.count(),
            'same_category_escalations': same_category_escalations,
            'parent_category_escalations': parent_escalations,
            'pending_escalation': len(pending_escalation),
        }

    @staticmethod
    def set_escalation_deadline(complaint):
        """Manually set escalation deadline for a complaint"""
        if complaint.current_resolver and not complaint.escalation_deadline:
            complaint.refresh_workflow_deadlines(base_time=complaint.created_at)
            complaint.save()
            return True
        return False

    @staticmethod
    def get_escalation_details():
        """Get detailed escalation information for all complaints"""
        from .models import Assignment, CategoryResolver
        now = timezone.now()
        
        pending_escalation = EscalationService._get_due_complaints(now)
        
        details = {
            'escalation_summary': {
                'total_pending': len(pending_escalation),
                'overdue_count': 0,
                'warning_threshold_hours': 24,
            },
            'pending_complaints': []
        }
        
        for complaint in pending_escalation:
            if complaint.escalation_deadline <= now:
                details['escalation_summary']['overdue_count'] += 1
            
            time_until_escalation = complaint.escalation_deadline - now if complaint.escalation_deadline else None
            hours_until = time_until_escalation.total_seconds() / 3600 if time_until_escalation else 0
            
            has_next_level = bool([
                resolver for resolver in CategoryResolver.objects.filter(
                    category=complaint.category,
                    active=True,
                ) if resolver.matches_complaint_scope(complaint) and resolver.scope_rank() < complaint.current_resolver.scope_rank()
            ]) if complaint.current_resolver else False
            
            parent_category_resolvers = []
            if complaint.category_id and complaint.category:
                for parent_detail in EscalationService._parent_category_resolvers(complaint):
                    parent_category_resolvers.extend([
                        {
                            'resolver_id': str(resolver.resolver_id),
                            'category_id': str(resolver.category_id),
                            'category_name': resolver.category.name if resolver.category else None,
                            'scope_label': resolver.scope_label(),
                            'scope_rank': resolver.scope_rank(),
                            'escalation_level': resolver.escalation_level,
                            'escalation_time': str(resolver.escalation_time),
                            'resolution_time': str(resolver.resolution_time),
                            'active': resolver.active,
                            'is_parent_category': True,
                            'parent_category_id': parent_detail['category_id'],
                            'parent_category_name': parent_detail['category_name'],
                        }
                        for resolver in parent_detail['resolvers']
                    ])
            
            complaint_detail = {
                'complaint_id': str(complaint.complaint_id),
                'title': complaint.title,
                'category': complaint.category.office_name if complaint.category else 'N/A',
                'current_resolver': str(complaint.current_resolver),
                'assigned_officer': complaint.assigned_officer.full_name if complaint.assigned_officer else 'N/A',
                'escalation_deadline': complaint.escalation_deadline.isoformat() if complaint.escalation_deadline else None,
                'time_until_escalation_hours': round(hours_until, 2),
                'escalation_options': {
                    'can_escalate_same_category': has_next_level,
                    'can_escalate_parent_category': bool(parent_category_resolvers),
                },
                'parent_category_resolvers': parent_category_resolvers,
                'last_assignment': None
            }
            
            # Get last assignment info
            last_assignment = Assignment.objects.filter(
                complaint=complaint
            ).select_related('officer', 'resolver').order_by('-assigned_at').first()
            
            if last_assignment:
                complaint_detail['last_assignment'] = {
                    'officer': last_assignment.officer.full_name,
                    'reason': last_assignment.reason,
                    'created_at': last_assignment.assigned_at.isoformat()
                }
            
            details['pending_complaints'].append(complaint_detail)
        
        return details
