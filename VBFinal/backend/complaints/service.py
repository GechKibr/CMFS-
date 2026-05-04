import logging

from complaints.models import Assignment, CategoryResolver

logger = logging.getLogger(__name__)


class ComplaintService:
    def _matching_resolvers(self, complaint):
        return list(
            CategoryResolver.objects.filter(
                category=complaint.category,
                active=True,
            ).select_related('officer', 'category', 'department').order_by(
                'department_id',
                'college',
                'campus',
                'id',
            )
        )

    def assign_to_first_level_officer(self, complaint):
        try:
            if not complaint.category:
                return None

            candidates = [
                resolver
                for resolver in self._matching_resolvers(complaint)
                if resolver.matches_complaint_scope(complaint)
            ]

            if not candidates:
                return None

            matched_resolver = max(candidates, key=lambda resolver: (resolver.scope_rank(), -resolver.id))

            complaint.assigned_officer = matched_resolver.officer
            complaint.current_resolver = matched_resolver
            complaint.set_escalation_deadline(matched_resolver.escalation_time, base_time=complaint.created_at)
            complaint.save()

            Assignment.objects.create(
                complaint=complaint,
                officer=matched_resolver.officer,
                resolver=matched_resolver,
                reason='initial',
            )

            return matched_resolver.officer
        except Exception as e:
            logger.error(f"Assignment failed: {e}")
            return None

    def process_complaint(self, complaint):
        try:
            complaint.save()
            assigned_officer = self.assign_to_first_level_officer(complaint)
            return {
                'category': complaint.category,
                'assigned_officer': assigned_officer,
            }
        except Exception as e:
            logger.error(f"Complaint processing failed: {e}")
            return None


service = ComplaintService()
