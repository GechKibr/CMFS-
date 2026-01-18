from rest_framework import serializers
from .models import Institution, Category, ResolverLevel, CategoryResolver, Complaint, Comment, Assignment

from django.contrib.auth import get_user_model

User = get_user_model()


class ComplaintUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]
        ref_name = "ComplaintUser"


class InstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institution
        fields = ["id", "name", "domain", "created_at"]


class CategorySerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source='institution.name', read_only=True)

    class Meta:
        model = Category
        fields = ["category_id", "institution", "institution_name", "name", "description", "parent", "is_active", "created_at"]
        read_only_fields = ["category_id", "created_at"]


class ResolverLevelSerializer(serializers.ModelSerializer):
    institution_name = serializers.CharField(source='institution.name', read_only=True)

    class Meta:
        model = ResolverLevel
        fields = ["id", "institution", "institution_name", "name", "level_order", "escalation_time"]
        read_only_fields = ["id"]


class CategoryResolverSerializer(serializers.ModelSerializer):
    officer_name = serializers.CharField(source='officer.full_name', read_only=True)
    level_name = serializers.CharField(source='level.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = CategoryResolver
        fields = ["id", "category", "category_name", "level", "level_name", "officer", "officer_name", "active"]
        read_only_fields = ["id", "officer_name", "level_name", "category_name"]


class ComplaintCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ["title", "description", "attachment"]


class ComplaintSerializer(serializers.ModelSerializer):
    submitted_by = ComplaintUserSerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    assigned_officer = ComplaintUserSerializer(read_only=True)
    current_level = ResolverLevelSerializer(read_only=True)

    class Meta:
        model = Complaint
        fields = [
            "complaint_id",
            "institution",
            "submitted_by",
            "category",
            "title",
            "description",
            "attachment",
            "created_at",
            "updated_at",
            "status",
            "priority",
            "assigned_officer",
            "current_level",
            "escalation_deadline",
        ]
        read_only_fields = ["complaint_id", "institution", "submitted_by", "category", "status", "priority", "assigned_officer", "current_level", "escalation_deadline"]


class CommentSerializer(serializers.ModelSerializer):
    author = ComplaintUserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "complaint", "author", "message", "created_at", "updated_at"]


class AssignmentSerializer(serializers.ModelSerializer):
    officer = ComplaintUserSerializer(read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "complaint", "officer", "level", "assigned_at", "ended_at", "reason"]