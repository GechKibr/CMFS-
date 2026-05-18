from __future__ import annotations

import logging

from django.db import transaction

from .models import Assignment, CategoryResolver, Complaint

logger = logging.getLogger(__name__)


class ComplaintService:
    def _matching_resolvers(self, complaint, preferred_officer_ids=None, preferred_resolver_ids=None):
        queryset = CategoryResolver.objects.filter(category=complaint.category, active=True).select_related(
            "category",
            "department",
        )

        if preferred_resolver_ids:
            queryset = queryset.filter(resolver_id__in=preferred_resolver_ids)

        resolvers = [resolver for resolver in queryset if resolver.matches_complaint_scope(complaint)]

        if preferred_officer_ids:
            preferred_officer_ids = {int(officer_id) for officer_id in preferred_officer_ids}
            preferred_resolvers = [
                resolver
                for resolver in resolvers
                if resolver.officers.filter(active=True, officer__is_active=True, officer_id__in=preferred_officer_ids).exists()
            ]
            if preferred_resolvers:
                resolvers = preferred_resolvers

        resolvers.sort(key=lambda resolver: (resolver.escalation_level, -resolver.scope_rank(), resolver.created_at, str(resolver.resolver_id)))
        return resolvers

    def _set_initial_routing(self, complaint, resolver):
        with transaction.atomic():
            complaint.current_resolver = resolver
            complaint.claimed_by = None
            complaint.status = Complaint.STATUS_PENDING
            complaint.refresh_workflow_deadlines(base_time=complaint.created_at)
            complaint.save()

            Assignment.objects.create(
                complaint=complaint,
                resolver=resolver,
                officer=None,
                reason=Assignment.REASON_INITIAL,
            )

            complaint._record_system_entry(
                "system",
                f"Complaint routed to {resolver.scope_label()} at level {resolver.escalation_level}.",
            )

        return resolver

    def route_complaint(self, complaint, preferred_officer_ids=None, preferred_resolver_ids=None):
        try:
            if not complaint.category_id:
                return None

            candidates = self._matching_resolvers(
                complaint,
                preferred_officer_ids=preferred_officer_ids,
                preferred_resolver_ids=preferred_resolver_ids,
            )

            if not candidates:
                return None

            resolver = candidates[0]
            return self._set_initial_routing(complaint, resolver)
        except Exception as exc:
            logger.error("Complaint routing failed: %s", exc, exc_info=True)
            return None

    def process_complaint(self, complaint, preferred_officer_ids=None):
        return self.route_complaint(complaint, preferred_officer_ids=preferred_officer_ids)


service = ComplaintService()
