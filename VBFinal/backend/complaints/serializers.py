from pathlib import Path
import threading

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import close_old_connections
from django.db import transaction
from django.urls import reverse
from rest_framework import serializers

from .models import (
    AnnouncementComment,
    Appointment,
    AppointmentAvailability,
    AvailabilityBlock,
    AvailabilityRule,
    Assignment,
    Category,
    CategoryResolver,
    ResolverOfficer,
    Comment,
    Complaint,
    ComplaintAttachment,
    ComplaintCC,
    ComplaintTimelineEntry,
    PublicAnnouncement,
    Response,
)

User = get_user_model()
from notifications.models import Notification

ALLOWED_ATTACHMENT_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".pdf", ".txt", ".doc", ".docx"}
ALLOWED_ATTACHMENT_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _send_cc_complaint_notifications_async(complaint_id, officer_ids):
    def worker():
        close_old_connections()
        try:
            from accounts.email_service import EmailService

            complaint = Complaint.objects.select_related("submitted_by", "category").get(pk=complaint_id)
            officers = User.objects.filter(id__in=officer_ids, role="officer").distinct()

            for officer in officers:
                try:
                    EmailService.send_cc_complaint_notification(officer, complaint)
                except Exception:
                    continue
        finally:
            close_old_connections()

    threading.Thread(target=worker, daemon=True).start()
MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
MAX_ATTACHMENTS_PER_COMPLAINT = 5


def _validate_uploaded_file(uploaded_file):
    extension = Path(uploaded_file.name).suffix.lower()
    content_type = (uploaded_file.content_type or "").lower()

    if extension not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise serializers.ValidationError(
            f"Unsupported file extension '{extension or 'none'}'. Allowed: {', '.join(sorted(ALLOWED_ATTACHMENT_EXTENSIONS))}."
        )

    if content_type and content_type not in ALLOWED_ATTACHMENT_CONTENT_TYPES:
        raise serializers.ValidationError(f"Unsupported file type '{content_type}'.")

    if uploaded_file.size > MAX_ATTACHMENT_SIZE:
        raise serializers.ValidationError(f"File '{uploaded_file.name}' exceeds 5MB size limit.")


class ComplaintUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]
        ref_name = "ComplaintUser"


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True)
    office_name = serializers.CharField(write_only=True, required=False)
    office_description = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Category
        fields = [
            "category_id",
            "name",
            "office_name",
            "office_description",
            "description",
            "parent",
            "parent_name",
            "allow_anonymous",
            "is_sensitive",
            "auto_escalate_to_parent",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["category_id", "created_at", "updated_at"]

    def validate(self, attrs):
        if not attrs.get("name"):
            legacy_name = self.initial_data.get("office_name")
            if legacy_name:
                attrs["name"] = legacy_name

        if "description" not in attrs:
            legacy_description = self.initial_data.get("office_description")
            if legacy_description is not None:
                attrs["description"] = legacy_description

        return attrs

    def to_internal_value(self, data):
        data = data.copy()
        # Accept legacy frontend keys and map them to canonical fields before validation
        if "office_name" in data and not data.get("name"):
            data["name"] = data.pop("office_name")
        if "office_description" in data and not data.get("description"):
            data["description"] = data.pop("office_description")
        return super().to_internal_value(data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["office_name"] = data.get("name", "")
        data["office_description"] = data.get("description", "")
        return data


class CategoryResolverSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    campus_name = serializers.CharField(source="get_campus_display", read_only=True, allow_null=True)
    college_name = serializers.CharField(source="get_college_display", read_only=True, allow_null=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True, allow_null=True)
    scope_label = serializers.SerializerMethodField()
    officers_count = serializers.SerializerMethodField()
    officers = serializers.SerializerMethodField()

    class Meta:
        model = CategoryResolver
        fields = [
            "resolver_id",
            "category",
            "category_name",
            "campus",
            "campus_name",
            "college",
            "college_name",
            "department",
            "department_name",
            "scope_label",
            "escalation_level",
            "escalation_time",
            "resolution_time",
            "active",
            "officers_count",
            "officers",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "resolver_id",
            "category_name",
            "campus_name",
            "college_name",
            "department_name",
            "scope_label",
            "officers_count",
            "officers",
            "created_at",
            "updated_at",
        ]

    def get_scope_label(self, obj):
        return obj.scope_label()

    def get_officers_count(self, obj):
        return obj.officers.filter(active=True, officer__is_active=True).count()

    def get_officers(self, obj):
        officers = []
        try:
            for ro in obj.officers.select_related("officer").filter(active=True, officer__is_active=True):
                officer = ro.officer
                officers.append({
                    "id": officer.id,
                    "first_name": officer.first_name,
                    "last_name": officer.last_name,
                    "email": officer.email,
                    "active": ro.active,
                })
        except Exception:
            return []
        return officers


class ResolverOfficerSerializer(serializers.ModelSerializer):
    resolver_name = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="resolver.category.name", read_only=True)
    scope_label = serializers.SerializerMethodField()
    officer_name = serializers.SerializerMethodField()
    officer_email = serializers.CharField(source="officer.email", read_only=True)

    class Meta:
        model = ResolverOfficer
        fields = [
            "id",
            "resolver",
            "resolver_name",
            "category_name",
            "scope_label",
            "officer",
            "officer_name",
            "officer_email",
            "can_claim",
            "can_close",
            "can_escalate",
            "receives_notifications",
            "notification_preferences",
            "active",
            "joined_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "resolver_name",
            "category_name",
            "scope_label",
            "officer_name",
            "officer_email",
            "joined_at",
            "updated_at",
        ]

    def get_officer_name(self, obj):
        officer = obj.officer
        if not officer:
            return ""
        full_name = f"{officer.first_name or ''} {officer.last_name or ''}".strip()
        return full_name or officer.full_name or officer.username or officer.email

    def get_resolver_name(self, obj):
        return str(obj.resolver) if obj.resolver else ""

    def get_scope_label(self, obj):
        return obj.resolver.scope_label() if obj.resolver else ""


class ComplaintAttachmentSerializer(serializers.ModelSerializer):
    stored_in_database = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintAttachment
        fields = [
            "id",
            "complaint",
            "timeline_entry",
            "file",
            "filename",
            "file_size",
            "content_type",
            "uploaded_at",
            "stored_in_database",
            "download_url",
        ]
        read_only_fields = ["id", "uploaded_at", "filename", "file_size", "content_type"]

    def get_stored_in_database(self, obj):
        return False

    def get_download_url(self, obj):
        path = reverse("complaint-download-attachment", kwargs={"pk": obj.complaint_id, "attachment_id": obj.id})
        request = self.context.get("request")
        return request.build_absolute_uri(path) if request else path


class CCSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintCC
        fields = ["email"]


class ComplaintTimelineEntrySerializer(serializers.ModelSerializer):
    author = ComplaintUserSerializer(read_only=True)
    attachments = ComplaintAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = ComplaintTimelineEntry
        fields = [
            "id",
            "complaint",
            "author",
            "entry_type",
            "title",
            "message",
            "is_internal",
            "is_public",
            "attachments",
            "created_at",
            "updated_at",
        ]


class ComplaintCreateSerializer(serializers.ModelSerializer):
    attachment = serializers.FileField(required=False, write_only=True, allow_null=True)
    attachments = serializers.ListField(child=serializers.FileField(), required=False, write_only=True, default=list)
    cc_emails = serializers.ListField(child=serializers.EmailField(), required=False, write_only=True, default=list)
    cc_office_ids = serializers.ListField(child=serializers.CharField(), required=False, write_only=True, default=list)
    cc_officer_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, write_only=True, default=list)
    resolver_officer_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, write_only=True, default=list)
    resolver_ids = serializers.ListField(child=serializers.CharField(), required=False, write_only=True, default=list)

    class Meta:
        model = Complaint
        fields = [
            "title",
            "description",
            "category",
            "campus",
            "college",
            "department",
            "reporter_name",
            "reporter_email",
            "is_anonymous",
            "is_confidential",
            "attachment",
            "attachments",
            "cc_emails",
            "cc_office_ids",
            "cc_officer_ids",
            "resolver_officer_ids",
            "resolver_ids",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        uploaded_files = []

        if request and hasattr(request, "FILES"):
            uploaded_files.extend(
                uploaded_file
                for key, uploaded_file in request.FILES.items()
                if key.startswith("attachment_")
            )

        if attrs.get("attachment"):
            uploaded_files.append(attrs["attachment"])

        uploaded_files.extend(attrs.get("attachments", []) or [])

        if len(uploaded_files) > MAX_ATTACHMENTS_PER_COMPLAINT:
            raise serializers.ValidationError(
                f"Maximum {MAX_ATTACHMENTS_PER_COMPLAINT} files are allowed per complaint."
            )

        for uploaded_file in uploaded_files:
            _validate_uploaded_file(uploaded_file)

        request_user = getattr(request, "user", None)
        draft = Complaint(
            submitted_by=request_user if request_user and request_user.is_authenticated else None,
            category=attrs.get("category"),
            title=attrs.get("title", ""),
            description=attrs.get("description", ""),
            campus=attrs.get("campus"),
            college=attrs.get("college"),
            department=attrs.get("department"),
            reporter_name=attrs.get("reporter_name", ""),
            reporter_email=attrs.get("reporter_email", ""),
            is_anonymous=attrs.get("is_anonymous", False),
            is_confidential=attrs.get("is_confidential", False),
        )
        try:
            draft.full_clean(exclude=["complaint_id", "created_at", "updated_at", "status", "current_resolver", "claimed_by", "escalation_deadline", "resolution_deadline", "resolved_at", "closed_at", "last_escalated_at"])
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"detail": exc.messages})

        return attrs

    def create(self, validated_data):
        from .service import service

        cc_emails = validated_data.pop("cc_emails", [])
        cc_office_ids = validated_data.pop("cc_office_ids", [])
        cc_officer_ids = validated_data.pop("cc_officer_ids", [])
        resolver_officer_ids = validated_data.pop("resolver_officer_ids", [])
        resolver_ids = validated_data.pop("resolver_ids", [])
        attachment = validated_data.pop("attachment", None)
        extra_attachments = validated_data.pop("attachments", [])
        request = self.context.get("request")

        office_category_ids = [str(category_id).strip() for category_id in cc_office_ids if str(category_id).strip()]
        office_categories = Category.objects.filter(category_id__in=office_category_ids, is_active=True)
        found_office_ids = {str(category.category_id) for category in office_categories}
        missing_office_ids = [category_id for category_id in office_category_ids if category_id not in found_office_ids]
        if missing_office_ids:
            raise serializers.ValidationError({"cc_office_ids": [f"Invalid category selection: {', '.join(sorted(set(missing_office_ids)))}"]})

        try:
            with transaction.atomic():
                complaint = Complaint.objects.create(**validated_data)

                files = []
                if attachment:
                    files.append(attachment)
                files.extend(extra_attachments or [])
                if request and hasattr(request, "FILES"):
                    files.extend(
                        uploaded_file
                        for key, uploaded_file in request.FILES.items()
                        if key.startswith("attachment_")
                    )

                for uploaded_file in files:
                    ComplaintAttachment.objects.create(
                        complaint=complaint,
                        file=uploaded_file,
                        uploaded_by=getattr(request, "user", None) if request and request.user.is_authenticated else None,
                    )

                for email in cc_emails:
                    ComplaintCC.objects.get_or_create(complaint=complaint, email=email)

                cc_office_officer_ids = set()
                if office_categories.exists():
                    office_resolvers = CategoryResolver.objects.filter(
                        category__in=office_categories,
                        active=True,
                    ).select_related("category", "department").prefetch_related("officers__officer")

                    for resolver in office_resolvers:
                        if resolver.matches_complaint_scope(complaint):
                            for resolver_officer in resolver.officers.all():
                                if resolver_officer.active and resolver_officer.officer and resolver_officer.officer.is_active:
                                    cc_office_officer_ids.add(resolver_officer.officer_id)

                cc_officer_ids = {int(officer_id) for officer_id in cc_officer_ids}
                cc_officer_ids.update(cc_office_officer_ids)

                cc_officers = list(User.objects.filter(id__in=cc_officer_ids, role="officer").distinct())
                seen_emails = set()
                for officer in cc_officers:
                    if not officer.email or officer.email in seen_emails:
                        continue

                    seen_emails.add(officer.email)
                    ComplaintCC.objects.get_or_create(complaint=complaint, email=officer.email)

                    Notification.objects.create(
                        user=officer,
                        complaint=complaint,
                        notification_type="complaint_update",
                        title=f"CC Complaint: {complaint.title}",
                        message=(
                            f"You were added as CC on complaint '{complaint.title}' "
                            f"by {complaint.submitted_by.full_name if complaint.submitted_by_id else 'a complainant'}."
                        ),
                    )

                if cc_officers:
                    officer_ids = [officer.id for officer in cc_officers if officer.id]
                    transaction.on_commit(lambda officer_ids=officer_ids, complaint_id=complaint.pk: _send_cc_complaint_notifications_async(complaint_id, officer_ids))

                if resolver_ids:
                    selected_resolvers = list(
                        CategoryResolver.objects.filter(resolver_id__in=resolver_ids, active=True).select_related("category", "department")
                    )

                    if len(selected_resolvers) != len(set(resolver_ids)):
                        raise serializers.ValidationError({"resolver_ids": ["One or more selected resolvers are invalid or inactive."]})

                    selected_resolvers = [
                        resolver
                        for resolver in selected_resolvers
                        if resolver.category_id == complaint.category_id and resolver.matches_complaint_scope(complaint)
                    ]

                    if not selected_resolvers:
                        raise serializers.ValidationError({"resolver_ids": ["No selected resolvers matched the complaint category and scope."]})

                    representative = min(selected_resolvers, key=lambda resolver: (resolver.escalation_level, -resolver.scope_rank(), str(resolver.resolver_id)))
                    complaint.current_resolver = representative
                    complaint.routing_attempted = True
                    complaint.refresh_workflow_deadlines(base_time=complaint.created_at)
                    complaint.save()
                    complaint._record_assignment(representative, None, "initial")
                    complaint._record_system_entry("system", "Complaint routed manually to selected resolver.")
                else:
                    preferred_resolver_officer_ids = [int(officer_id) for officer_id in resolver_officer_ids if str(officer_id).strip()]
                    service.route_complaint(
                        complaint,
                        preferred_officer_ids=preferred_resolver_officer_ids if preferred_resolver_officer_ids else None,
                    )
                    # Mark routing as attempted
                    complaint.routing_attempted = True
                    complaint.save(update_fields=['routing_attempted'])
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"detail": exc.messages})

        return complaint


class ComplaintSerializer(serializers.ModelSerializer):
    submitted_by = serializers.SerializerMethodField()
    assigned_officer = ComplaintUserSerializer(source="claimed_by", read_only=True)
    claimed_by = ComplaintUserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    current_resolver = CategoryResolverSerializer(read_only=True)
    attachments = ComplaintAttachmentSerializer(many=True, read_only=True)
    timeline_entries = ComplaintTimelineEntrySerializer(many=True, read_only=True)
    cc_list = CCSerializer(many=True, read_only=True)
    is_cc_user = serializers.SerializerMethodField()
    current_resolver_officers_count = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            "complaint_id",
            "submitted_by",
            "reporter_name",
            "reporter_email",
            "category",
            "title",
            "description",
            "campus",
            "college",
            "department",
            "attachments",
            "timeline_entries",
            "cc_list",
            "created_at",
            "updated_at",
            "status",
            "current_resolver",
            "claimed_by",
            "assigned_officer",
            "escalation_deadline",
            "resolution_deadline",
            "resolved_at",
            "closed_at",
            "last_escalated_at",
            "is_cc_user",
            "is_anonymous",
            "is_confidential",
            "current_resolver_officers_count",
        ]
        read_only_fields = [
            "complaint_id",
            "created_at",
            "updated_at",
            "escalation_deadline",
            "resolution_deadline",
            "resolved_at",
            "closed_at",
            "last_escalated_at",
        ]

    def get_submitted_by(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if obj.is_anonymous and user and user.is_authenticated and user.is_officer() and not user.is_admin():
            return {
                "id": None,
                "username": "anonymous",
                "email": "",
                "first_name": "Anonymous",
                "last_name": "Complainant",
                "role": "user",
            }

        return ComplaintUserSerializer(obj.submitted_by, context=self.context).data if obj.submitted_by_id else None

    def get_is_cc_user(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.cc_list.filter(email=request.user.email).exists()
        return False

    def get_current_resolver_officers_count(self, obj):
        if not obj.current_resolver_id:
            return 0
        return obj.current_resolver.officers.filter(active=True, officer__is_active=True).count()

    def update(self, instance, validated_data):
        scope_fields = {'category', 'campus', 'college', 'department'}
        scope_changed = any(field in validated_data for field in scope_fields)

        next_category = validated_data.get('category', instance.category)
        next_campus = validated_data.get('campus', instance.campus)
        next_college = validated_data.get('college', instance.college)
        next_department = validated_data.get('department', instance.department)

        if scope_changed and instance.current_resolver_id:
            matches_category = not next_category or instance.current_resolver.category_id == getattr(next_category, 'category_id', None)
            matches_campus = not next_campus or instance.current_resolver.campus == next_campus
            matches_college = not next_college or instance.current_resolver.college == next_college
            matches_department = not next_department or instance.current_resolver.department_id == getattr(next_department, 'id', None)

            if not (matches_category and matches_campus and matches_college and matches_department):
                instance.current_resolver = None
                instance.claimed_by = None

        return super().update(instance, validated_data)


class CommentSerializer(serializers.ModelSerializer):
    author = ComplaintUserSerializer(read_only=True)
    attachments = ComplaintAttachmentSerializer(many=True, read_only=True)
    comment_type = serializers.CharField(source="entry_type", required=False)

    class Meta:
        model = Comment
        fields = ["id", "complaint", "author", "comment_type", "message", "attachments", "created_at", "updated_at"]


class ResponseSerializer(serializers.ModelSerializer):
    responder = ComplaintUserSerializer(source="author", read_only=True)
    attachments = ComplaintAttachmentSerializer(many=True, read_only=True)
    response_type = serializers.CharField(source="entry_type", required=False)
    attachment = serializers.SerializerMethodField()

    class Meta:
        model = Response
        fields = [
            "id",
            "complaint",
            "responder",
            "response_type",
            "title",
            "message",
            "attachment",
            "attachments",
            "is_public",
            "created_at",
            "updated_at",
        ]

    def get_attachment(self, obj):
        attachment = obj.attachments.order_by("uploaded_at").first()
        return ComplaintAttachmentSerializer(attachment, context=self.context).data if attachment else None

    def validate(self, attrs):
        # Normalize frontend aliases to model entry_type choices
        entry = attrs.get('entry_type')
        if entry:
            val = str(entry).lower()
            if val in ('update', 'initial', 'status_update'):
                attrs['entry_type'] = 'response'
            elif val in ('resolution', 'final', 'final_resolution'):
                attrs['entry_type'] = 'resolution_note'
            elif val in ('escalation', 'system', 'response', 'resolution_note', 'comment'):
                attrs['entry_type'] = val
            else:
                # default to a normal response when unknown alias provided
                attrs['entry_type'] = 'response'
        return attrs


class AssignmentSerializer(serializers.ModelSerializer):
    officer = ComplaintUserSerializer(read_only=True)
    resolver = CategoryResolverSerializer(read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "complaint", "officer", "resolver", "assigned_at", "ended_at", "reason", "note"]


class PublicAnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    comments_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PublicAnnouncement
        fields = [
            "id", "title", "message", "created_by", "created_by_name",
            "is_active", "is_pinned", "expires_at", "created_at", "updated_at",
            "comments_count",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        full_name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return full_name or obj.created_by.email

    def get_comments_count(self, obj):
        return obj.comments.count()


class AnnouncementCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AnnouncementComment
        fields = ["id", "announcement", "user", "user_name", "message", "created_at", "updated_at"]
        read_only_fields = ["id", "announcement", "user", "user_name", "created_at", "updated_at"]

    def get_user_name(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return full_name or obj.user.email


class AvailabilityRuleSerializer(serializers.ModelSerializer):
    officer = ComplaintUserSerializer(read_only=True)
    officer_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="officer", write_only=True, required=False
    )

    class Meta:
        model = AvailabilityRule
        fields = [
            "id", "officer", "officer_id", "weekday", "start_time", "end_time",
            "slot_duration_minutes", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "officer", "created_at", "updated_at"]

    def validate(self, attrs):
        rule = AvailabilityRule(**attrs)
        rule.clean()
        return attrs


class AvailabilityBlockSerializer(serializers.ModelSerializer):
    officer = ComplaintUserSerializer(read_only=True)
    officer_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="officer", write_only=True, required=False
    )

    class Meta:
        model = AvailabilityBlock
        fields = [
            "id", "officer", "officer_id", "start_datetime", "end_datetime",
            "reason", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "officer", "created_at", "updated_at"]

    def validate(self, attrs):
        block = AvailabilityBlock(**attrs)
        block.clean()
        return attrs


class AppointmentAvailabilitySerializer(serializers.ModelSerializer):
    officer = ComplaintUserSerializer(read_only=True)
    officer_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    rule_id = serializers.IntegerField(source="rule.id", read_only=True)
    officer_name = serializers.SerializerMethodField(read_only=True)
    is_free = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AppointmentAvailability
        fields = [
            "id", "officer", "officer_id", "officer_name", "rule_id", "source",
            "available_date", "start_time", "end_time", "notes", "is_active", "is_free",
            "generated_at", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "officer", "officer_name", "rule_id", "source", "generated_at",
            "is_free", "created_at", "updated_at",
        ]

    def to_internal_value(self, data):
        # Remove officer_id if not provided or None, since it's handled by the view
        data = data.copy()
        if 'officer_id' in data and not data.get('officer_id'):
            data.pop('officer_id', None)
        return super().to_internal_value(data)

    def get_officer_name(self, obj):
        full_name = f"{obj.officer.first_name} {obj.officer.last_name}".strip()
        return full_name or obj.officer.email

    def get_is_free(self, obj):
        return obj.is_free


class AppointmentSerializer(serializers.ModelSerializer):
    requested_by = ComplaintUserSerializer(read_only=True)
    officer = ComplaintUserSerializer(read_only=True)
    complaint_title = serializers.CharField(source="complaint.title", read_only=True)
    complaint_id = serializers.CharField(source="complaint.complaint_id", read_only=True)
    availability_slot = AppointmentAvailabilitySerializer(read_only=True)
    availability_slot_id = serializers.PrimaryKeyRelatedField(
        queryset=AppointmentAvailability.objects.select_related("officer").all(),
        source="availability_slot",
        write_only=True,
        required=False,
        allow_null=True,
    )
    issue_type_display = serializers.SerializerMethodField(read_only=True)
    status_display = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "complaint", "complaint_id", "complaint_title", "issue_type", "issue_type_display",
            "description", "preferred_date", "availability_slot", "availability_slot_id",
            "requested_by", "officer", "scheduled_at", "location", "note", "status",
            "status_display", "rejection_reason", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "requested_by", "created_at", "updated_at"]

    def get_issue_type_display(self, obj):
        return obj.get_issue_type_display()

    def get_status_display(self, obj):
        return obj.get_status_display()

    def validate(self, attrs):
        request = self.context.get("request")
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            if not (request.user.is_officer() or request.user.is_admin()):
                if not attrs.get("availability_slot"):
                    raise serializers.ValidationError({
                        "availability_slot_id": "Selecting a time slot is required."
                    })
        appointment = Appointment(**attrs)
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            appointment.requested_by = request.user

        try:
            appointment.full_clean(exclude=["created_at", "updated_at"])
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"detail": exc.messages})

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and getattr(request, "user", None) and request.user.is_authenticated:
            validated_data["requested_by"] = request.user
        return super().create(validated_data)
