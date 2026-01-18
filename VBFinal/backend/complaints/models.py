from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class Institution(models.Model):
    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Category(models.Model):
    category_id = models.CharField(
        max_length=30,
        primary_key=True,
        editable=False
    )
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="categories",
        null=True,
        blank=True,
        default=None
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

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
        ordering = ["name"]
        unique_together = ("institution", "name")

    def save(self, *args, **kwargs):
        if not self.category_id:
            self.category_id = f"CAT-{uuid.uuid4().hex[:10].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name



class ResolverLevel(models.Model):
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="resolver_levels"
    )
    name = models.CharField(max_length=100)  # e.g. Department, Dean, President
    level_order = models.PositiveIntegerField()  # 1, 2, 3...
    escalation_time = models.DurationField(
        help_text="Time before escalation (e.g. 48 hours)"
    )

    class Meta:
        ordering = ["level_order"]
        unique_together = ("institution", "level_order")

    def __str__(self):
        return f"{self.institution.name} - {self.name} (L{self.level_order})"




class CategoryResolver(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name="resolvers"
    )
    level = models.ForeignKey(
        ResolverLevel,
        on_delete=models.CASCADE,
        related_name="category_resolvers"
    )
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_categories"
    )

    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("category", "level", "officer")

    def __str__(self):
        return f"{self.officer} → {self.category} (L{self.level.level_order})"



class Complaint(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("in_progress", "In Progress"),
        ("escalated", "Escalated"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
    ]

    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    complaint_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="complaints",
        null=True,
        blank=True
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

    title = models.CharField(max_length=255)
    description = models.TextField()
    attachment = models.FileField(
        upload_to="attachments/",
        null=True,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )
    priority = models.CharField(
        max_length=10,
        choices=PRIORITY_CHOICES,
        default="medium"
    )

    current_level = models.ForeignKey(
        ResolverLevel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaints"
    )
    # under review 
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

    def __str__(self):
        return f"{self.complaint_id}  {self.title}  ({self.status})"

    def set_escalation_deadline(self):
        if self.current_level:
            self.escalation_deadline = timezone.now() + self.current_level.escalation_time

    def save(self, *args, **kwargs):
        if self.current_level and not self.escalation_deadline:
            self.set_escalation_deadline()
        super().save(*args, **kwargs)


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
    # under review 
    officer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignment_history"
    )
    level = models.ForeignKey(
        ResolverLevel,
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
        return f"{self.complaint.complaint_id}  → {self.officer} (L{self.level.level_order})"


class Comment(models.Model):
    complaint = models.ForeignKey(Complaint,on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    message = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.author} on {self.complaint.complaint_id}"
