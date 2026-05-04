from datetime import datetime

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
import uuid

from accounts.models import CAMPUS_CHOICES, ACADEMIC_UNITS

class Category(models.Model):
    category_id = models.CharField(
        max_length=30,
        primary_key=True,
        editable=False
    )

    office_name = models.CharField(max_length=150)
    office_description = models.TextField(blank=True)

    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.CASCADE
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["office_name"]
        unique_together = ("office_name", "parent")

    def save(self, *args, **kwargs):
        if not self.category_id:
            self.category_id = f"CAT-{uuid.uuid4().hex[:10].upper()}"
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.office_name


class CategoryResolver(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="resolvers"
    )
    campus = models.CharField(max_length=50, choices=CAMPUS_CHOICES, null=True, blank=True)
    college = models.CharField(max_length=50, choices=ACADEMIC_UNITS, null=True, blank=True)
    department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaint_resolvers",
    )
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_categories"
    )
    escalation_time = models.DurationField(
        help_text="Time before escalation for this category-officer assignment (e.g. 48:00:00)."
    )

    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("category", "campus", "college", "department", "officer")

    @property
    def campus_id(self):
        return self.campus

    def clean(self):
        if self.department_id:
            # department.department_college is an academic-unit code now
            if self.department.department_college and self.college and self.department.department_college != self.college:
                raise ValidationError("Selected department does not belong to the selected academic unit.")
        # cannot reliably validate college->campus mapping without a lookup; skip campus/college mapping check

    def scope_rank(self):
        if self.department_id:
            return 3
        if self.college:
            return 2
        if self.campus_id:
            return 1
        return 0

    def scope_label(self):
        if self.department_id:
            return "Department"
        if self.college:
            return "College"
        if self.campus_id:
            return "Campus"
        return "General"

    def matches_scope(self, campus=None, college=None, department=None):
        if self.department_id:
            return bool(department and self.department_id == getattr(department, 'id', department))
        if self.college:
            # college param can be a code (string) or an object; support both
            if isinstance(college, str):
                return bool(college and self.college == college)
            return bool(college and (getattr(college, 'department_college', None) == self.college or getattr(college, 'college_code', None) == self.college or getattr(college, 'id', None) == self.college))
        if self.campus_id:
            return bool(campus and self.campus_id == campus)
        return True

    def matches_user_scope(self, user):
        profile = getattr(user, "officer_profile", None) or getattr(user, "student_profile", None)
        if profile is None:
            return False

        department = getattr(profile, "department", None)
        # profile.college is an academic-unit code for officers; for students derive from department
        college_code = getattr(profile, "college", None) or (department.department_college if department else None)
        # student_profile stores campus_id directly; officers may not have campus info
        campus_code = getattr(profile, "campus_id", None)
        return self.matches_scope(campus=campus_code, college=college_code, department=department)

    def matches_complaint_scope(self, complaint):
        return self.matches_scope(
            campus=complaint.submitter_campus,
            college=complaint.submitter_college,
            department=complaint.submitter_department,
        )

    def matches_officer(self, officer_user):
        return self.matches_user_scope(officer_user)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.officer} → {self.category} ({self.scope_label()})"



class Complaint(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("escalated", "Escalated"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
    ]

    complaint_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="complaints_made"
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints"
    )

    submitter_campus = models.CharField(max_length=50, choices=CAMPUS_CHOICES, null=True, blank=True)
    # store academic-unit code instead of FK to removed College model
    submitter_college = models.CharField(max_length=50, choices=ACADEMIC_UNITS, null=True, blank=True)
    submitter_department = models.ForeignKey(
        "accounts.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="submitted_complaints",
    )

    title = models.CharField(max_length=255)
    description = models.TextField()
    attachment = models.FileField(
        upload_to="attachments/",
        null=True,
        blank=True
    )
    is_anonymous = models.BooleanField(default=False)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    current_resolver = models.ForeignKey(
        CategoryResolver,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints"
    )
    assigned_officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_complaints"
    )
    escalation_deadline = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def _get_submitter_scope(self):
        student_profile = getattr(self.submitted_by, "student_profile", None)
        if student_profile is not None:
            department = student_profile.department
            # department.department_college is an academic-unit code
            college = department.department_college if department else None
            campus = student_profile.campus_id
            return campus, college, department

        officer_profile = getattr(self.submitted_by, "officer_profile", None)
        if officer_profile is not None:
            department = officer_profile.department
            college = officer_profile.college or (department.department_college if department else None)
            # officers do not have a campus field; campus may be unknown here
            campus = None
            return campus, college, department

        return None, None, None

    def _sync_submitter_scope_snapshot(self):
        campus, college, department = self._get_submitter_scope()
        self.submitter_campus = campus
        self.submitter_college = college
        self.submitter_department = department

    def clean(self):
        if self.submitted_by_id:
            self._sync_submitter_scope_snapshot()

        if self.current_resolver_id and self.category:
            if self.current_resolver.category_id != self.category_id:
                raise ValidationError("Current resolver does not belong to the selected complaint category.")

            if not self.current_resolver.matches_complaint_scope(self):
                raise ValidationError("Current resolver does not match the complainant's campus/college/department.")

        if self.assigned_officer_id and self.current_resolver_id:
            if self.current_resolver.officer_id != self.assigned_officer_id:
                raise ValidationError("Assigned officer does not match the current resolver.")

    def __str__(self):
        return f"{self.complaint_id}  {self.title}  ({self.status})"

    def _get_current_assignment(self):
        if not (self.category_id and self.current_resolver_id and self.assigned_officer_id):
            return None

        return CategoryResolver.objects.filter(
            category_id=self.category_id,
            id=self.current_resolver_id,
            officer_id=self.assigned_officer_id,
            active=True,
        ).first()

    def calculate_escalation_deadline(self, escalation_time=None, base_time=None):
        if not self.current_resolver:
            return None

        effective_escalation_time = escalation_time
        if effective_escalation_time is None:
            assignment = self._get_current_assignment()
            effective_escalation_time = assignment.escalation_time if assignment else None

        if not effective_escalation_time:
            return None

        deadline_base = base_time or self.created_at or timezone.now()
        return deadline_base + effective_escalation_time

    def set_escalation_deadline(self, escalation_time=None, base_time=None):
        self.escalation_deadline = self.calculate_escalation_deadline(
            escalation_time=escalation_time,
            base_time=base_time,
        )

    def save(self, *args, **kwargs):
        if self.category_id and self.assigned_officer_id and not self.current_resolver_id:
            candidate = CategoryResolver.objects.filter(
                category_id=self.category_id,
                officer_id=self.assigned_officer_id,
                active=True,
            ).select_related("officer", "category").first()
            if candidate and candidate.matches_complaint_scope(self):
                self.current_resolver = candidate

        if self.current_resolver and not self.escalation_deadline:
            self.set_escalation_deadline()
        self.full_clean()
        super().save(*args, **kwargs)

    def escalate_to_next_level(self):
        """Escalate complaint to the next broader resolver scope."""
        if not self.category or not self.current_resolver:
            return False

        candidates = [
            resolver for resolver in CategoryResolver.objects.filter(
                category=self.category,
                active=True,
            ).select_related("officer", "category")
            if resolver.matches_complaint_scope(self) and resolver.scope_rank() < self.current_resolver.scope_rank()
        ]

        if not candidates:
            return False

        next_resolver = max(candidates, key=lambda resolver: (resolver.scope_rank(), -resolver.id))

        Assignment.objects.create(
            complaint=self,
            officer=next_resolver.officer,
            resolver=next_resolver,
            reason='escalation'
        )

        self.current_resolver = next_resolver
        self.assigned_officer = next_resolver.officer
        self.status = 'escalated'
        self.set_escalation_deadline(next_resolver.escalation_time, base_time=self.created_at)
        self.save()

        return True

        return False


class ComplaintCC(models.Model):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name='cc_list'
    )
    email = models.EmailField()

    class Meta:
        unique_together = ('complaint', 'email')

    def __str__(self):
        return f"CC {self.email} on {self.complaint.complaint_id}"


class ComplaintAttachment(models.Model):
    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="attachments"
    )
    file = models.FileField(upload_to="complaint_attachments/")
    file_data = models.BinaryField(null=True, blank=True)
    filename = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField()
    content_type = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.complaint.complaint_id} - {self.filename}"


class Assignment(models.Model):
    ASSIGNMENT_REASON = [
        ("initial", "Initial Assignment"),
        ("escalation", "Escalation"),
        ("manual", "Manual Reassignment"),
    ]

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="assignments"
    )
    
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignment_history"
    )
    resolver = models.ForeignKey(
        CategoryResolver,
        on_delete=models.CASCADE
    )

    assigned_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    reason = models.CharField(
        max_length=20,
        choices=ASSIGNMENT_REASON
    )

    class Meta:
        ordering = ["-assigned_at"]

    def __str__(self):
        return f"{self.complaint.complaint_id}  → {self.officer} ({self.resolver.scope_label()})"


class Comment(models.Model):
    COMMENT_TYPE_CHOICES = [
        ('comment', 'Comment'),
        ('rating', 'Rating'),
    ]

    complaint = models.ForeignKey(Complaint,on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    comment_type = models.CharField(
        max_length=20,
        choices=COMMENT_TYPE_CHOICES,
        default='comment'
    )
    message = models.TextField()
    
    # Rating fields
    rating = models.IntegerField(
        null=True,
        blank=True,
        help_text="Rating from 1 to 5 stars"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=['complaint', 'comment_type']),
            models.Index(fields=['author', 'created_at']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.comment_type == 'rating':
            if not self.rating or self.rating < 1 or self.rating > 5:
                raise ValidationError("Rating must be between 1 and 5")
        
    def __str__(self):
        if self.comment_type == 'rating':
            return f"Rating ({self.rating}/5) by {self.author} on {self.complaint.complaint_id}"
        return f"Comment by {self.author} on {self.complaint.complaint_id}"


class Response(models.Model):
    RESPONSE_TYPE_CHOICES = [
        ('initial', 'Initial Response'),
        ('update', 'Status Update'),
        ('resolution', 'Final Resolution'),
        ('escalation', 'Escalation Response'),
    ]

    complaint = models.ForeignKey(
        Complaint,
        on_delete=models.CASCADE,
        related_name="responses"
    )
    responder = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="complaint_responses"
    )
    response_type = models.CharField(
        max_length=20,
        choices=RESPONSE_TYPE_CHOICES,
        default='update'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    attachment = models.FileField(
        upload_to="response_attachments/",
        null=True,
        blank=True
    )
    is_public = models.BooleanField(
        default=True,
        help_text="Whether this response is visible to the complainant"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['complaint', 'response_type']),
            models.Index(fields=['responder', 'created_at']),
        ]

    def __str__(self):
        return f"{self.response_type.title()} response by {self.responder} on {self.complaint.complaint_id}"

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
        ).exclude(pk=self.pk)

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


class AnnouncementLike(models.Model):
    announcement = models.ForeignKey(
        PublicAnnouncement,
        on_delete=models.CASCADE,
        related_name='likes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='announcement_likes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('announcement', 'user')
        ordering = ['-created_at']


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
