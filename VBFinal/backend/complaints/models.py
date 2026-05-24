from __future__ import annotations

import uuid
from datetime import datetime
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from accounts.models import ACADEMIC_UNITS, CAMPUS_CHOICES


def _now():
    return timezone.now()


class Category(models.Model):
    category_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    parent = models.ForeignKey("self", null=True, blank=True, related_name="children", on_delete=models.SET_NULL)
    allow_anonymous = models.BooleanField(default=True)
    is_sensitive = models.BooleanField(default=False)
    auto_escalate_to_parent = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["parent", "name"], name="unique_category_name_per_parent"),
        ]
        indexes = [
            models.Index(fields=["is_active", "name"]),
            models.Index(fields=["parent", "name"]),
        ]

    def clean(self):
        if self.parent_id and self.parent_id == self.category_id:
            raise ValidationError({"parent": "A category cannot be its own parent."})

        ancestor = self.parent
        seen = {self.category_id} if self.category_id else set()
        while ancestor:
            if ancestor.category_id in seen:
                raise ValidationError({"parent": "Category hierarchy cannot contain cycles."})
            seen.add(ancestor.category_id)
            ancestor = ancestor.parent

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    @property
    def office_name(self):
        return self.name

    @property
    def office_description(self):
        return self.description

    @property
    def root(self):
        node = self
        while node.parent_id:
            node = node.parent
        return node

    @property
    def depth(self):
        depth = 0
        node = self.parent
        while node:
            depth += 1
            node = node.parent
        return depth

    def ancestors(self):
        current = self.parent
        while current:
            yield current
            current = current.parent

    def get_best_resolver(self, complaint: "Complaint"):
        resolvers = [
            resolver
            for resolver in self.resolvers.filter(active=True).select_related("department")
            if resolver.matches_complaint_scope(complaint)
        ]
        if not resolvers:
            return None
        resolvers.sort(key=lambda resolver: (resolver.escalation_level, -resolver.scope_rank(), resolver.created_at, str(resolver.resolver_id)))
        return resolvers[0]

    def matches_officer(self, officer, complaint: "Complaint" = None):
        """Return True if the given `officer` is eligible for this category.

        If a `complaint` is provided, only consider resolvers that match the
        complaint's scope. The check looks for active `CategoryResolver`
        entries for this category and an active `ResolverOfficer` membership
        linking the resolver to the officer.
        """
        if not officer or not getattr(officer, "is_active", False):
            return False

        resolvers_qs = self.resolvers.filter(active=True)
        for resolver in resolvers_qs.select_related("department"):
            if complaint is not None and not resolver.matches_complaint_scope(complaint):
                continue
            if resolver.officers.filter(officer_id=getattr(officer, "id", None), active=True, officer__is_active=True).exists():
                return True
        return False


class CategoryResolver(models.Model):
    resolver_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="resolvers")
    campus = models.CharField(max_length=50, choices=CAMPUS_CHOICES, null=True, blank=True, db_index=True)
    college = models.CharField(max_length=50, choices=ACADEMIC_UNITS, null=True, blank=True, db_index=True)
    department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaint_resolvers",
    )
    escalation_level = models.PositiveIntegerField(default=1)
    escalation_time = models.DurationField()
    resolution_time = models.DurationField(null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "escalation_level", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "campus", "college", "department", "escalation_level"],
                name="unique_resolver_scope_level",
            ),
        ]
        indexes = [
            models.Index(fields=["category", "active", "escalation_level"]),
            models.Index(fields=["campus", "college", "department", "active"]),
        ]

    def clean(self):
        if self.escalation_time is not None and self.escalation_time <= timedelta(0):
            raise ValidationError({"escalation_time": "Escalation time must be greater than zero."})

        if self.resolution_time is not None and self.resolution_time <= timedelta(0):
            raise ValidationError({"resolution_time": "Resolution time must be greater than zero."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.category} - Level {self.escalation_level} - {self.scope_label()}"

    def scope_rank(self):
        if self.department_id:
            return 3
        if self.college:
            return 2
        if self.campus:
            return 1
        return 0

    def scope_label(self):
        if self.department:
            return self.department.department_name or str(self.department)
        if self.college:
            return dict(ACADEMIC_UNITS).get(self.college, self.college)
        if self.campus:
            return dict(CAMPUS_CHOICES).get(self.campus, self.campus)
        return "University"

    def matches_complaint_scope(self, complaint: "Complaint"):
        if self.campus and complaint.campus != self.campus:
            return False
        if self.college and complaint.college != self.college:
            return False
        if self.department_id and complaint.department_id != self.department_id:
            return False
        return True


class ResolverOfficer(models.Model):
    resolver = models.ForeignKey(CategoryResolver, on_delete=models.CASCADE, related_name="officers")
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="resolver_memberships",
    )
    can_claim = models.BooleanField(default=True)
    can_close = models.BooleanField(default=True)
    can_escalate = models.BooleanField(default=True)
    notification_preferences = models.JSONField(default=dict, blank=True)
    receives_notifications = models.BooleanField(default=True)
    active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["resolver", "officer"], name="unique_resolver_officer"),
        ]
        indexes = [
            models.Index(fields=["resolver", "active"]),
            models.Index(fields=["officer", "active"]),
        ]

    def __str__(self):
        return f"{self.officer} -> {self.resolver}"


class Complaint(models.Model):
    STATUS_PENDING = "pending"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_ESCALATED = "escalated"
    STATUS_RESOLVED = "resolved"
    STATUS_CLOSED = "closed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_ESCALATED, "Escalated"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_CLOSED, "Closed"),
    ]

    complaint_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_complaints",
    )
    reporter_name = models.CharField(max_length=150, blank=True, default="")
    reporter_email = models.EmailField(blank=True, default="")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaints")
    campus = models.CharField(max_length=50, choices=CAMPUS_CHOICES, null=True, blank=True, db_index=True)
    college = models.CharField(max_length=50, choices=ACADEMIC_UNITS, null=True, blank=True, db_index=True)
    department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints",
    )
    current_resolver = models.ForeignKey(
        CategoryResolver,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_complaints",
    )
    claimed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="claimed_complaints",
    )
    routing_attempted = models.BooleanField(default=False, help_text="Whether automatic routing was attempted for this complaint")
    title = models.CharField(max_length=255)
    description = models.TextField()
    is_anonymous = models.BooleanField(default=False)
    is_confidential = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    escalation_deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    resolution_deadline = models.DateTimeField(null=True, blank=True, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    last_escalated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["category", "status"]),
            models.Index(fields=["current_resolver", "status"]),
            models.Index(fields=["claimed_by", "status"]),
            models.Index(fields=["campus", "college", "department"]),
            models.Index(fields=["escalation_deadline"]),
            models.Index(fields=["resolution_deadline"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.status})"

    def clean(self):
        if self.category and self.category.is_sensitive:
            self.is_confidential = True

        if self.is_anonymous and self.category and not self.category.allow_anonymous:
            raise ValidationError({"is_anonymous": "This category does not support anonymous complaints."})

        if not self.is_anonymous and not self.submitted_by_id and not self.reporter_email:
            raise ValidationError({"submitted_by": "A complainant or contact email is required unless the complaint is anonymous."})

        if self.current_resolver and self.category and self.current_resolver.category_id != self.category_id:
            raise ValidationError({"current_resolver": "Current resolver must belong to the complaint category."})

        if self.current_resolver and not self.current_resolver.matches_complaint_scope(self):
            raise ValidationError({"current_resolver": "Current resolver does not match the complaint scope."})

        if self.claimed_by_id and self.current_resolver_id:
            membership_exists = self.current_resolver.officers.filter(
                officer_id=self.claimed_by_id,
                active=True,
                officer__is_active=True,
            ).exists()
            if not membership_exists:
                raise ValidationError({"claimed_by": "Claimed officer must be an active officer on the current resolver."})

        if self.resolution_deadline and self.escalation_deadline and self.resolution_deadline < self.escalation_deadline:
            raise ValidationError({"resolution_deadline": "Resolution deadline must be on or after the escalation deadline."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def assigned_officer(self):
        return self.claimed_by

    @property
    def assigned_officer_id(self):
        return self.claimed_by_id

    @property
    def current_resolver_officers(self):
        if not self.current_resolver_id:
            return ResolverOfficer.objects.none()
        return self.current_resolver.officers.select_related("officer").filter(active=True, officer__is_active=True)

    def get_matching_resolvers(self):
        """Get all resolvers that match this complaint's scope and category."""
        if not self.category_id:
            return CategoryResolver.objects.none()
        
        candidates = []
        for resolver in self.category.resolvers.filter(active=True).select_related("department"):
            if resolver.matches_complaint_scope(self):
                candidates.append(resolver)
        
        return candidates

    def is_visible_to_officer(self, officer):
        if not officer or not getattr(officer, "is_authenticated", False):
            return False
        if officer.is_admin():
            return True
        if self.submitted_by_id == officer.id:
            return True
        if self.claimed_by_id == officer.id:
            return True
        if self.current_resolver_id:
            return self.current_resolver.officers.filter(officer_id=officer.id, active=True, officer__is_active=True).exists()
        if self.category_id:
            matching_resolvers = self.get_matching_resolvers()
            for resolver in matching_resolvers:
                if resolver.officers.filter(officer_id=officer.id, active=True, officer__is_active=True).exists():
                    return True
        return False

    def _record_assignment(self, resolver, officer, reason):
        Assignment.objects.filter(complaint=self, ended_at__isnull=True).update(ended_at=_now())
        return Assignment.objects.create(
            complaint=self,
            resolver=resolver,
            officer=officer,
            reason=reason,
        )

    def _record_system_entry(self, entry_type, message, actor=None, title="", is_internal=False):
        return ComplaintTimelineEntry.objects.create(
            complaint=self,
            author=actor,
            entry_type=entry_type,
            title=title,
            message=message,
            is_internal=is_internal,
        )

    def _set_deadlines_from_resolver(self, resolver=None, base_time=None):
        resolver = resolver or self.current_resolver
        if not resolver:
            self.escalation_deadline = None
            self.resolution_deadline = None
            return

        reference_time = base_time or self.created_at or _now()
        self.escalation_deadline = reference_time + resolver.escalation_time if resolver.escalation_time else None
        self.resolution_deadline = reference_time + resolver.resolution_time if resolver.resolution_time else None

    def refresh_workflow_deadlines(self, base_time=None):
        self._set_deadlines_from_resolver(base_time=base_time)

    def _best_matching_resolver(self, category=None, minimum_level=None):
        category = category or self.category
        if not category:
            return None

        queryset = category.resolvers.filter(active=True)
        if minimum_level is not None:
            queryset = queryset.filter(escalation_level__gt=minimum_level)

        candidates = [resolver for resolver in queryset.select_related("department") if resolver.matches_complaint_scope(self)]
        if not candidates:
            return None

        candidates.sort(key=lambda resolver: (resolver.escalation_level, -resolver.scope_rank(), resolver.created_at, str(resolver.resolver_id)))
        return candidates[0]

    def _advance_to_resolver(self, resolver, reason, actor=None, status=None):
        if not resolver:
            return None

        with transaction.atomic():
            self.current_resolver = resolver
            self.claimed_by = None
            self.status = status or self.STATUS_ESCALATED
            self.last_escalated_at = _now()
            self._set_deadlines_from_resolver(resolver=resolver, base_time=self.last_escalated_at)
            self.save(update_fields=[
                "current_resolver",
                "claimed_by",
                "status",
                "last_escalated_at",
                "escalation_deadline",
                "resolution_deadline",
                "updated_at",
            ])
            self._record_assignment(resolver, None, reason)
            self._record_system_entry("escalation", reason, actor=actor, title="Complaint escalated")
        return resolver

    def escalate_to_next_resolver(self, actor=None):
        if not self.current_resolver_id:
            return self.escalate_to_parent_category(actor=actor)

        next_resolver = self._best_matching_resolver(minimum_level=self.current_resolver.escalation_level)
        if not next_resolver:
            return self.escalate_to_parent_category(actor=actor)

        return self._advance_to_resolver(
            next_resolver,
            reason="Escalated to next resolver level",
            actor=actor,
        )

    def escalate_to_parent_category(self, actor=None):
        parent = self.category.parent if self.category_id and self.category and self.category.parent_id else None
        while parent:
            resolver = parent.get_best_resolver(self)
            if resolver:
                return self._advance_to_resolver(
                    resolver,
                    reason=f"Escalated to parent category {parent.name}",
                    actor=actor,
                )
            if not parent.auto_escalate_to_parent:
                break
            parent = parent.parent
        return None

    def claim(self, officer, note=""):
        if not self.current_resolver_id:
            raise ValidationError({"current_resolver": "Complaint is not routed to a resolver yet."})

        membership = self.current_resolver.officers.filter(
            officer=officer,
            active=True,
            officer__is_active=True,
            can_claim=True,
        ).first()
        if not membership:
            raise ValidationError({"claimed_by": "Officer is not allowed to claim this complaint."})

        with transaction.atomic():
            self.claimed_by = officer
            self.status = self.STATUS_IN_PROGRESS
            self.save(update_fields=["claimed_by", "status", "updated_at"])
            self._record_assignment(self.current_resolver, officer, "claim")
            self._record_system_entry("comment", note or f"Complaint claimed by {officer.full_name}.", actor=officer, title="Complaint claimed")
        return self

    def mark_in_progress(self, actor=None, note=""):
        self.status = self.STATUS_IN_PROGRESS
        self.save(update_fields=["status", "updated_at"])
        self._record_system_entry("comment", note or "Complaint marked in progress.", actor=actor, title="Complaint in progress")
        return self

    def resolve(self, actor=None, note=""):
        self.status = self.STATUS_RESOLVED
        self.resolved_at = _now()
        self.save(update_fields=["status", "resolved_at", "updated_at"])
        self._record_system_entry("resolution_note", note or "Complaint resolved.", actor=actor, title="Complaint resolved")
        return self

    def close(self, actor=None, note=""):
        self.status = self.STATUS_CLOSED
        self.closed_at = _now()
        self.save(update_fields=["status", "closed_at", "updated_at"])
        self._record_system_entry("system", note or "Complaint closed.", actor=actor, title="Complaint closed")
        return self

    def reject(self, actor=None, note=""):
        self.status = self.STATUS_CLOSED
        self.closed_at = _now()
        self.save(update_fields=["status", "closed_at", "updated_at"])
        self._record_system_entry("system", note or "Complaint rejected.", actor=actor, title="Complaint closed")
        return self


class ComplaintCC(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="cc_list")
    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["complaint", "email"], name="unique_complaint_cc_email"),
        ]
        indexes = [models.Index(fields=["email"])]

    def __str__(self):
        return f"CC {self.email} on {self.complaint_id}"


class ComplaintAttachment(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="attachments")
    timeline_entry = models.ForeignKey(
        "ComplaintTimelineEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attachments",
    )
    file = models.FileField(upload_to="complaint_attachments/")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaint_attachments")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["complaint", "uploaded_at"]),
            models.Index(fields=["timeline_entry", "uploaded_at"]),
            models.Index(fields=["uploaded_by", "uploaded_at"]),
        ]

    def clean(self):
        if not self.complaint_id and not self.timeline_entry_id:
            raise ValidationError({"complaint": "An attachment must belong to a complaint or timeline entry."})
        if self.timeline_entry_id and not self.complaint_id:
            self.complaint = self.timeline_entry.complaint

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.filename

    @property
    def filename(self):
        return Path(self.file.name).name if self.file else "attachment"

    @property
    def file_size(self):
        try:
            return self.file.size
        except Exception:
            return None

    @property
    def content_type(self):
        file_obj = getattr(self.file, "file", None)
        return getattr(file_obj, "content_type", None)

    @property
    def file_data(self):
        return None


class Assignment(models.Model):
    REASON_INITIAL = "initial"
    REASON_CLAIM = "claim"
    REASON_ESCALATION = "escalation"
    REASON_MANUAL = "manual"

    REASON_CHOICES = [
        (REASON_INITIAL, "Initial"),
        (REASON_CLAIM, "Claim"),
        (REASON_ESCALATION, "Escalation"),
        (REASON_MANUAL, "Manual"),
    ]

    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="assignments")
    resolver = models.ForeignKey(CategoryResolver, on_delete=models.CASCADE, related_name="assignment_history")
    officer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaint_assignments")
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    note = models.TextField(blank=True, default="")
    assigned_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["assigned_at"]
        indexes = [
            models.Index(fields=["complaint", "assigned_at"]),
            models.Index(fields=["resolver", "ended_at"]),
            models.Index(fields=["officer", "ended_at"]),
        ]

    def __str__(self):
        officer_label = self.officer.full_name if self.officer_id else "Unassigned"
        return f"{self.complaint_id} -> {self.resolver} ({officer_label}, {self.reason})"


class ComplaintTimelineEntry(models.Model):
    KIND_COMMENT = "comment"
    KIND_RESPONSE = "response"
    KIND_SYSTEM = "system"
    KIND_ESCALATION = "escalation"
    KIND_RESOLUTION_NOTE = "resolution_note"

    ENTRY_CHOICES = [
        (KIND_COMMENT, "Comment"),
        (KIND_RESPONSE, "Response"),
        (KIND_SYSTEM, "System Message"),
        (KIND_ESCALATION, "Escalation Log"),
        (KIND_RESOLUTION_NOTE, "Resolution Note"),
    ]

    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="timeline_entries")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaint_timeline_entries")
    entry_type = models.CharField(max_length=24, choices=ENTRY_CHOICES, default=KIND_COMMENT, db_index=True)
    title = models.CharField(max_length=255, blank=True, default="")
    message = models.TextField(blank=True, default="")
    is_internal = models.BooleanField(default=False)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["complaint", "created_at"]),
            models.Index(fields=["complaint", "entry_type", "created_at"]),
        ]

    def clean(self):
        if self.entry_type in {self.KIND_COMMENT, self.KIND_RESPONSE} and not self.author_id:
            raise ValidationError({"author": "Timeline comments and responses require an author."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.complaint_id} - {self.entry_type}"

    @property
    def comment_type(self):
        return self.entry_type

    @comment_type.setter
    def comment_type(self, value):
        self.entry_type = value

    @property
    def response_type(self):
        return self.entry_type

    @response_type.setter
    def response_type(self, value):
        self.entry_type = value

    @property
    def responder(self):
        return self.author

    @responder.setter
    def responder(self, value):
        self.author = value

    @property
    def attachment(self):
        attachment = self.attachments.order_by("uploaded_at").first()
        return attachment.file if attachment else None


class _EntryProxyManager(models.Manager):
    entry_type = None

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.entry_type is None:
            return queryset
        return queryset.filter(entry_type=self.entry_type)

    def create(self, **kwargs):
        if self.entry_type is not None:
            kwargs.setdefault("entry_type", self.entry_type)
        return super().create(**kwargs)


class Comment(ComplaintTimelineEntry):
    objects = _EntryProxyManager()
    objects.entry_type = ComplaintTimelineEntry.KIND_COMMENT

    class Meta:
        proxy = True
        verbose_name = "Comment"
        verbose_name_plural = "Comments"


class Response(ComplaintTimelineEntry):
    objects = _EntryProxyManager()
    objects.entry_type = ComplaintTimelineEntry.KIND_RESPONSE

    class Meta:
        proxy = True
        verbose_name = "Response"
        verbose_name_plural = "Responses"


ComplaintMessage = ComplaintTimelineEntry


class AppointmentAvailability(models.Model):
    SOURCE_MANUAL = 'manual'
    SOURCE_RULE = 'rule'
    SOURCE_CHOICES = [
        (SOURCE_MANUAL, 'Manual'),
        (SOURCE_RULE, 'Generated from rule'),
    ]

    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='appointment_availabilities'
    )
    rule = models.ForeignKey(
        'AvailabilityRule',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='generated_slots'
    )
    available_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    notes = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    generated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['available_date', 'start_time']
        constraints = [
            models.UniqueConstraint(
                fields=['officer', 'available_date', 'start_time', 'end_time'],
                name='unique_officer_availability_slot',
            ),
        ]
        indexes = [
            models.Index(fields=['officer', 'available_date']),
            models.Index(fields=['available_date', 'start_time']),
        ]

    def clean(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValidationError('Availability end time must be after start time.')

        if not self.officer_id or not self.available_date or not self.start_time or not self.end_time:
            return

        overlapping = AppointmentAvailability.objects.filter(
            officer_id=self.officer_id,
            available_date=self.available_date,
            is_active=True,
        )

        if self.pk:
            overlapping = overlapping.exclude(pk=self.pk)

        for slot in overlapping:
            if self.start_time < slot.end_time and self.end_time > slot.start_time:
                raise ValidationError('Availability overlaps with an existing slot.')

    @property
    def is_free(self):
        active_statuses = ['pending', 'confirmed', 'completed']
        return not self.appointments.filter(status__in=active_statuses).exists()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.officer} - {self.available_date} {self.start_time:%H:%M}"


class AvailabilityRule(models.Model):
    WEEKDAY_CHOICES = [
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    ]

    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='availability_rules'
    )
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration_minutes = models.PositiveSmallIntegerField(default=30)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['weekday', 'start_time']
        constraints = [
            models.UniqueConstraint(
                fields=['officer', 'weekday', 'start_time', 'end_time'],
                name='unique_officer_weekday_rule',
            ),
        ]
        indexes = [
            models.Index(fields=['officer', 'weekday']),
        ]

    def clean(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValidationError('Rule end time must be after start time.')
        if self.slot_duration_minutes <= 0:
            raise ValidationError('Slot duration must be a positive number of minutes.')

    def __str__(self):
        return f"{self.officer} - {self.get_weekday_display()} ({self.start_time:%H:%M}-{self.end_time:%H:%M})"


class AvailabilityBlock(models.Model):
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='availability_blocks'
    )
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    reason = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-start_datetime']
        indexes = [
            models.Index(fields=['officer', 'start_datetime']),
        ]

    def clean(self):
        if self.end_datetime and self.start_datetime and self.end_datetime <= self.start_datetime:
            raise ValidationError('Block end time must be after start time.')

    def __str__(self):
        return f"{self.officer} blocked {self.start_datetime} - {self.end_datetime}"


class PublicAnnouncement(models.Model):
    title = models.CharField(max_length=200)
    message = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='public_announcements'
    )
    is_active = models.BooleanField(default=True)
    is_pinned = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_pinned', '-created_at']
        indexes = [
            models.Index(fields=['is_active', 'created_at']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"{self.title} ({'active' if self.is_active else 'inactive'})"


class AnnouncementComment(models.Model):
    announcement = models.ForeignKey(
        PublicAnnouncement,
        on_delete=models.CASCADE,
        related_name='comments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcement_comments'
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class Appointment(models.Model):
    ISSUE_TYPE_CHOICES = [
        ('complaint', 'Complaint'),
        ('support', 'Support'),
        ('inquiry', 'Inquiry'),
        ('service_request', 'Service Request'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
        ('canceled', 'Canceled'),
    ]

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='appointments',
        null=True,
        blank=True,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='appointments_requested'
    )
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments_assigned'
    )
    availability_slot = models.ForeignKey(
        AppointmentAvailability,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appointments'
    )
    issue_type = models.CharField(max_length=30, choices=ISSUE_TYPE_CHOICES, default='complaint')
    description = models.TextField()
    preferred_date = models.DateField(null=True, blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-scheduled_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['requested_by', 'status']),
            models.Index(fields=['officer', 'status']),
        ]

    def clean(self):
        if self.availability_slot_id:
            slot = self.availability_slot
            if self.officer_id and slot.officer_id != self.officer_id:
                raise ValidationError('Selected availability slot does not belong to the assigned officer.')
            if not self.officer_id:
                self.officer = slot.officer
            if self.scheduled_at is None:
                self.scheduled_at = datetime.combine(slot.available_date, slot.start_time)
                if timezone.is_naive(self.scheduled_at):
                    self.scheduled_at = timezone.make_aware(self.scheduled_at)

            active_appointments = Appointment.objects.filter(
                availability_slot=slot,
                status__in=['pending', 'confirmed', 'completed'],
            ).exclude(pk=self.pk)
            if active_appointments.exists():
                raise ValidationError('Selected time slot is no longer available.')

        if self.complaint_id is None and not self.description:
            raise ValidationError({'description': 'Description is required for appointment requests.'})

        if self.preferred_date and self.availability_slot_id and self.availability_slot.available_date < self.preferred_date:
            raise ValidationError({'preferred_date': 'Preferred date cannot be after the selected slot date.'})

        if self.status == 'rejected' and not self.rejection_reason:
            self.rejection_reason = 'Request rejected by officer.'

    def __str__(self):
        target = self.complaint.complaint_id if self.complaint_id else self.issue_type
        if self.scheduled_at:
            return f"Appointment for {target} on {self.scheduled_at:%Y-%m-%d %H:%M}"
        return f"Appointment for {target}"
