from django.core.management.base import BaseCommand
from django.utils import timezone
from complaints.models import Complaint, ResolverLevel, CategoryResolver, Assignment
from accounts.email_service import EmailService


class Command(BaseCommand):
    help = 'Auto-escalate complaints that have exceeded their escalation deadline'

    def handle(self, *args, **options):
        now = timezone.now()
        
        # Find complaints that need escalation
        complaints_to_escalate = Complaint.objects.filter(
            escalation_deadline__lte=now,
            status__in=['pending', 'in_progress'],
            current_level__isnull=False
        )
        
        escalated_count = 0
        
        for complaint in complaints_to_escalate:
            # Get next level
            next_level = ResolverLevel.objects.filter(
                institution=complaint.institution,
                level_order=complaint.current_level.level_order + 1
            ).first()
            
            if not next_level:
                self.stdout.write(
                    self.style.WARNING(f'No higher level for complaint {complaint.complaint_id}')
                )
                continue
            
            # Find resolver at next level
            category_resolver = CategoryResolver.objects.filter(
                category=complaint.category,
                level=next_level,
                active=True
            ).first()
            
            if not category_resolver:
                self.stdout.write(
                    self.style.WARNING(f'No resolver at level {next_level.name} for complaint {complaint.complaint_id}')
                )
                continue
            
            # Create escalation assignment
            Assignment.objects.create(
                complaint=complaint,
                officer=category_resolver.officer,
                level=next_level,
                reason='escalation'
            )
            
            # Update complaint
            complaint.current_level = next_level
            complaint.assigned_officer = category_resolver.officer
            complaint.set_escalation_deadline()
            complaint.status = 'escalated'
            complaint.save()
            
            # Send notification
            EmailService.send_escalation_alert(category_resolver.officer, complaint)
            
            escalated_count += 1
            self.stdout.write(
                self.style.SUCCESS(f'Escalated complaint {complaint.complaint_id} to {next_level.name}')
            )
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully escalated {escalated_count} complaints')
        )
