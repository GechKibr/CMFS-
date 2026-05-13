import logging

from complaints.models import Assignment, CategoryResolver

logger = logging.getLogger(__name__)


class ComplaintService:
    def _matching_resolvers(self, complaint, preferred_officer_ids=None):
        queryset = CategoryResolver.objects.filter(
            category=complaint.category,
            active=True,
        )

        if preferred_officer_ids:
            queryset = queryset.filter(officer_id__in=preferred_officer_ids)

        return list(
            queryset.select_related('officer', 'category', 'department').order_by(
                'department_id',
                'college',
                'campus',
                'id',
            )
        )

    def assign_to_first_level_officer(self, complaint, preferred_officer_ids=None):
        try:
            if not complaint.category:
                return None

            candidates = [
                resolver
                for resolver in self._matching_resolvers(complaint, preferred_officer_ids=preferred_officer_ids)
                if resolver.matches_complaint_scope(complaint)
            ]

            if not candidates and preferred_officer_ids:
                candidates = [
                    resolver
                    for resolver in self._matching_resolvers(complaint)
                    if resolver.matches_complaint_scope(complaint)
                ]

            if not candidates:
                return None

            top_rank = max(resolver.scope_rank() for resolver in candidates)
            matched_resolvers = [resolver for resolver in candidates if resolver.scope_rank() == top_rank]
            representative = matched_resolvers[0]

            complaint.current_resolver = representative
            complaint.assigned_officer = representative.officer
            complaint.set_escalation_deadline(representative.escalation_time, base_time=complaint.created_at)
            complaint.save()

            for resolver in matched_resolvers:
                Assignment.objects.create(
                    complaint=complaint,
                    officer=resolver.officer,
                    resolver=resolver,
                    reason='initial',
                )

            return matched_resolvers
        except Exception as e:
            logger.error(f"Assignment failed: {e}")
            return None

    def process_complaint(self, complaint, preferred_officer_ids=None):
        try:
            complaint.save()
            assigned_officer = self.assign_to_first_level_officer(complaint, preferred_officer_ids=preferred_officer_ids)
            return {
                'category': complaint.category,
                'assigned_officer': assigned_officer,
            }
        except Exception as e:
            logger.error(f"Complaint processing failed: {e}")
            return None


service = ComplaintService()
