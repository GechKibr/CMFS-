from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class FeedbackTemplate(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_ACTIVE = 'active'
    STATUS_CLOSED = 'closed'
    STATUS_PENDING = 'pending'
    STATUS_REJECTED = 'rejected'
    STATUS_INACTIVE = 'inactive'
    
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_ACTIVE, 'Active'),
        (STATUS_CLOSED, 'Closed'),
        (STATUS_PENDING, 'Pending'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_INACTIVE, 'Inactive'),
    ]
    
    PRIORITY_LOW = 'low'
    PRIORITY_MEDIUM = 'medium'
    PRIORITY_HIGH = 'high'
    
    PRIORITY_CHOICES = [
        (PRIORITY_LOW, 'Low'),
        (PRIORITY_MEDIUM, 'Medium'),
        (PRIORITY_HIGH, 'High'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feedback_templates'
    )
    office = models.CharField(max_length=100)  # Based on user's college
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='approved_templates',
        null=True,
        blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'office']),
            models.Index(fields=['created_by', 'status']),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.office}"


class TemplateField(models.Model):
    FIELD_TEXT = 'text'
    FIELD_NUMBER = 'number'
    FIELD_RATING = 'rating'
    FIELD_CHOICE = 'choice'
    FIELD_CHECKBOX = 'checkbox'
    
    FIELD_TYPE_CHOICES = [
        (FIELD_TEXT, 'Text'),
        (FIELD_NUMBER, 'Number'),
        (FIELD_RATING, 'Rating'),
        (FIELD_CHOICE, 'Choice'),
        (FIELD_CHECKBOX, 'Checkbox'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        FeedbackTemplate,
        on_delete=models.CASCADE,
        related_name='fields'
    )
    label = models.CharField(max_length=200)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPE_CHOICES)
    options = models.JSONField(default=list, blank=True)  # For choice/checkbox fields
    is_required = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['order']
        indexes = [
            models.Index(fields=['template', 'order']),
        ]
    
    def __str__(self):
        return f"{self.template.title} - {self.label}"


class FeedbackResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        FeedbackTemplate,
        on_delete=models.CASCADE,
        related_name='responses'
    )
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='feedback_responses',
        null=True,
        blank=True
    )
    session_token = models.CharField(max_length=100, unique=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['template', 'submitted_at']),
            models.Index(fields=['session_token']),
            models.Index(fields=['template', 'user']),
        ]
    
    def __str__(self):
        return f"Response to {self.template.title} at {self.submitted_at}"


class FeedbackAnswer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response = models.ForeignKey(
        FeedbackResponse,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    field = models.ForeignKey(
        TemplateField,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    text_value = models.TextField(blank=True, null=True)
    number_value = models.FloatField(blank=True, null=True)
    rating_value = models.IntegerField(blank=True, null=True)
    choice_value = models.CharField(max_length=200, blank=True, null=True)
    checkbox_values = models.JSONField(default=list, blank=True)
    
    class Meta:
        unique_together = ['response', 'field']
        indexes = [
            models.Index(fields=['response', 'field']),
        ]
    
    def __str__(self):
        return f"Answer to {self.field.label}"
    
    @property
    def value(self):
        """Get the appropriate value based on field type"""
        if self.field.field_type == TemplateField.FIELD_TEXT:
            return self.text_value
        elif self.field.field_type == TemplateField.FIELD_NUMBER:
            return self.number_value
        elif self.field.field_type == TemplateField.FIELD_RATING:
            return self.rating_value
        elif self.field.field_type == TemplateField.FIELD_CHOICE:
            return self.choice_value
        elif self.field.field_type == TemplateField.FIELD_CHECKBOX:
            return self.checkbox_values
        return None
