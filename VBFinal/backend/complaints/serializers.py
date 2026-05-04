from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
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
    Comment,
    Complaint,
    ComplaintAttachment,
    ComplaintCC,
    PublicAnnouncement,
    Response,
)

User = get_user_model()

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


def _attachment_payload(uploaded_file):
    file_bytes = uploaded_file.read()
    uploaded_file.seek(0)
    return {
        "file": uploaded_file,
        "file_data": file_bytes,
        "filename": uploaded_file.name,
        "file_size": uploaded_file.size,
        "content_type": uploaded_file.content_type,
    }


class ComplaintUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role"]
        ref_name = "ComplaintUser"


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.office_name", read_only=True)

    class Meta:
        model = Category
        fields = [
            "category_id",
            "office_name",
            "office_description",
            "parent",
            "parent_name",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["category_id", "created_at"]

    def validate(self, attrs):
        if not attrs.get("office_name"):
            legacy_name = self.initial_data.get("name")
            if legacy_name:
                attrs["office_name"] = legacy_name

        if "office_description" not in attrs:
            legacy_description = self.initial_data.get("description")
            if legacy_description is not None:
                attrs["office_description"] = legacy_description

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["name"] = data.get("office_name", "")
        data["description"] = data.get("office_description", "")
        return data


class CategoryResolverSerializer(serializers.ModelSerializer):
    officer_name = serializers.CharField(source="officer.full_name", read_only=True)
    category_name = serializers.CharField(source="category.office_name", read_only=True)
    campus_name = serializers.CharField(source="get_campus_display", read_only=True, allow_null=True)
    college_name = serializers.CharField(source="get_college_display", read_only=True, allow_null=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True, allow_null=True)
    scope_label = serializers.SerializerMethodField()

    class Meta:
        model = CategoryResolver
        fields = [
            "id",
            "category",
            "category_name",
            "campus",
            "campus_name",
            "college",
            "college_name",
            "department",
            "department_name",
            "officer",
            "officer_name",
            "scope_label",
            "escalation_time",
            "active",
        ]
        read_only_fields = ["id", "officer_name", "category_name", "campus_name", "college_name", "department_name", "scope_label"]

    def get_scope_label(self, obj):
        return obj.scope_label()


class ComplaintCreateSerializer(serializers.ModelSerializer):
    cc_emails = serializers.ListField(child=serializers.EmailField(), required=False, write_only=True, default=list)
    cc_office_ids = serializers.ListField(child=serializers.CharField(), required=False, write_only=True, default=list)
    cc_officer_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, write_only=True, default=list)

    class Meta:
        model = Complaint
        fields = [
            "title",
            "description",
            "category",
            "attachment",
            "is_anonymous",
            "cc_emails",
            "cc_office_ids",
            "cc_officer_ids",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        uploaded_files = []

        if request and hasattr(request, "FILES"):
            uploaded_files = [
                uploaded_file
                for key, uploaded_file in request.FILES.items()
                if key.startswith("attachment_")
            ]

        if attrs.get("attachment"):
            uploaded_files.append(attrs["attachment"])

        if len(uploaded_files) > MAX_ATTACHMENTS_PER_COMPLAINT:
            raise serializers.ValidationError(
                f"Maximum {MAX_ATTACHMENTS_PER_COMPLAINT} files are allowed per complaint."
            )

        for uploaded_file in uploaded_files:
            _validate_uploaded_file(uploaded_file)

        submitter = attrs.get("submitted_by")
        if submitter is None and request and getattr(request, "user", None) and request.user.is_authenticated:
            submitter = request.user
        category = attrs.get("category")
        if submitter and category:
            draft = Complaint(
                submitted_by=submitter,
                category=category,
                title=attrs.get("title", ""),
                description=attrs.get("description", ""),
                attachment=attrs.get("attachment"),
                is_anonymous=attrs.get("is_anonymous", False),
            )
            try:
                draft.full_clean(exclude=["complaint_id", "created_at", "updated_at", "status"])
            except DjangoValidationError as exc:
                if hasattr(exc, "message_dict"):
                    raise serializers.ValidationError(exc.message_dict)
                raise serializers.ValidationError({"detail": exc.messages})

        return attrs

    def create(self, validated_data):
        from accounts.email_service import EmailService

        cc_emails = validated_data.pop("cc_emails", [])
        cc_office_ids = validated_data.pop("cc_office_ids", [])
        cc_officer_ids = validated_data.pop("cc_officer_ids", [])
        request = self.context.get("request")

        office_category_ids = [str(category_id) for category_id in cc_office_ids if str(category_id).strip()]
        office_categories = Category.objects.filter(category_id__in=office_category_ids, is_active=True)
        found_office_ids = {str(category.category_id) for category in office_categories}
        missing_office_ids = [category_id for category_id in office_category_ids if category_id not in found_office_ids]
        if missing_office_ids:
            raise serializers.ValidationError({"cc_office_ids": [f"Invalid office selection: {', '.join(sorted(set(missing_office_ids)))}"]})

        try:
            complaint = Complaint.objects.create(**validated_data)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"detail": exc.messages})

        if request and hasattr(request, "FILES"):
            for key, file in request.FILES.items():
                if key.startswith("attachment_"):
                    ComplaintAttachment.objects.create(complaint=complaint, **_attachment_payload(file))

        for email in cc_emails:
            ComplaintCC.objects.get_or_create(complaint=complaint, email=email)

        cc_office_officer_ids = set()
        if office_categories.exists():
            cc_office_officer_ids.update(
                CategoryResolver.objects.filter(
                    category__in=office_categories,
                    active=True,
                ).values_list("officer_id", flat=True)
            )

        cc_officer_ids = {int(officer_id) for officer_id in cc_officer_ids}
        cc_officer_ids.update(cc_office_officer_ids)

        cc_officers = User.objects.filter(id__in=cc_officer_ids, role="officer").distinct()
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
                    f"by {complaint.submitted_by.first_name} {complaint.submitted_by.last_name}."
                ),
            )

            try:
                EmailService.send_cc_complaint_notification(officer, complaint)
            except Exception:
                continue

        return complaint


class ComplaintAttachmentSerializer(serializers.ModelSerializer):
    stored_in_database = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = ComplaintAttachment
        fields = ["id", "file", "filename", "file_size", "content_type", "uploaded_at", "stored_in_database", "download_url"]
        read_only_fields = ["id", "uploaded_at"]

    def get_stored_in_database(self, obj):
        return bool(obj.file_data)

    def get_download_url(self, obj):
        path = reverse("complaint-download-attachment", kwargs={"pk": obj.complaint_id, "attachment_id": obj.id})
        request = self.context.get("request")
        return request.build_absolute_uri(path) if request else path


class CCSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplaintCC
        fields = ["email"]


class ComplaintSerializer(serializers.ModelSerializer):
    submitted_by = serializers.SerializerMethodField()
    category = CategorySerializer(read_only=True)
    assigned_officer = ComplaintUserSerializer(read_only=True)
    current_resolver = CategoryResolverSerializer(read_only=True)
    attachments = ComplaintAttachmentSerializer(many=True, read_only=True)
    cc_list = CCSerializer(many=True, read_only=True)
    is_cc_user = serializers.SerializerMethodField()

    class Meta:
        model = Complaint
        fields = [
            "complaint_id", "submitted_by", "category",
            "title", "description", "attachment", "attachments", "cc_list",
            "created_at", "updated_at", "status",
            "submitter_campus", "submitter_college", "submitter_department",
            "assigned_officer", "current_resolver", "escalation_deadline",
            "is_cc_user", "is_anonymous",
        ]
        read_only_fields = ["complaint_id", "created_at", "updated_at", "escalation_deadline"]

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

        return ComplaintUserSerializer(obj.submitted_by, context=self.context).data

    def get_is_cc_user(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.cc_list.filter(email=request.user.email).exists()
        return False


class CommentSerializer(serializers.ModelSerializer):
    author = ComplaintUserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "complaint", "author", "comment_type", "message", "rating", "created_at", "updated_at"]


class ResponseSerializer(serializers.ModelSerializer):
    responder = ComplaintUserSerializer(read_only=True)

    class Meta:
        model = Response
        fields = ["id", "complaint", "responder", "response_type", "title", "message", "attachment", "is_public", "created_at", "updated_at"]


class AssignmentSerializer(serializers.ModelSerializer):
    officer = ComplaintUserSerializer(read_only=True)
    resolver = CategoryResolverSerializer(read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "complaint", "officer", "resolver", "assigned_at", "ended_at", "reason"]


class PublicAnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    likes_count = serializers.SerializerMethodField(read_only=True)
    comments_count = serializers.SerializerMethodField(read_only=True)
    liked_by_user = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PublicAnnouncement
        fields = [
            "id", "title", "message", "created_by", "created_by_name",
            "is_active", "is_pinned", "expires_at", "created_at", "updated_at",
            "likes_count", "comments_count", "liked_by_user",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        full_name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return full_name or obj.created_by.email

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_liked_by_user(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()


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
            "available_date", "start_time", "end_time", "is_active", "is_free",
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
