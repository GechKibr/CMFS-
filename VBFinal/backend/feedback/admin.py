from django.contrib import admin

from django.contrib import admin
from .models import FeedbackTemplate, TemplateField, FeedbackResponse, FeedbackAnswer


class TemplateFieldInline(admin.TabularInline):
    model = TemplateField
    extra = 1
    ordering = ['order']


@admin.register(FeedbackTemplate)
class FeedbackTemplateAdmin(admin.ModelAdmin):
    list_display = ['title', 'office', 'status', 'created_by', 'created_at']
    list_filter = ['status', 'office', 'created_at']
    search_fields = ['title', 'description', 'office']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [TemplateFieldInline]


@admin.register(TemplateField)
class TemplateFieldAdmin(admin.ModelAdmin):
    list_display = ['label', 'template', 'field_type', 'is_required', 'order']
    list_filter = ['field_type', 'is_required']
    search_fields = ['label', 'template__title']


class FeedbackAnswerInline(admin.TabularInline):
    model = FeedbackAnswer
    extra = 0
    readonly_fields = ['field', 'text_value', 'number_value', 'rating_value', 
                      'choice_value', 'checkbox_values']


@admin.register(FeedbackResponse)
class FeedbackResponseAdmin(admin.ModelAdmin):
    list_display = ['template', 'submitted_at', 'ip_address']
    list_filter = ['template', 'submitted_at']
    readonly_fields = ['session_token', 'submitted_at', 'ip_address']
    inlines = [FeedbackAnswerInline]


@admin.register(FeedbackAnswer)
class FeedbackAnswerAdmin(admin.ModelAdmin):
    list_display = ['response', 'field', 'value']
    list_filter = ['field__field_type']
    readonly_fields = ['response', 'field']
