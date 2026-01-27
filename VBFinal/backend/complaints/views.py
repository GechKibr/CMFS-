from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response as DRFResponse
from django.utils import timezone

from .models import Institution, Category, ResolverLevel, CategoryResolver, Complaint, ComplaintAttachment, Comment, Assignment, Response
from .serializers import (
    InstitutionSerializer,
    CategorySerializer,
    ResolverLevelSerializer,
    CategoryResolverSerializer,
    ComplaintSerializer,
    ComplaintCreateSerializer,
    ComplaintAttachmentSerializer,
    CommentSerializer,
    AssignmentSerializer,
    ResponseSerializer,
)
from .ai_service import ai_service


class InstitutionViewSet(viewsets.ModelViewSet):
    queryset = Institution.objects.all()
    serializer_class = InstitutionSerializer
    permission_classes = [permissions.AllowAny]  # For development


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]  # For development

    @action(detail=False, methods=["get"], url_path="by-language")
    def by_language(self, request):
        """Get categories with language-specific names"""
        language = request.query_params.get('lang', 'en')
        categories = self.get_queryset()
        
        data = []
        for cat in categories:
            category_data = {
                'category_id': cat.category_id,
                'name': cat.name_amharic if language == 'am' and cat.name_amharic else cat.name,
                'description': cat.description_amharic if language == 'am' and cat.description_amharic else cat.description,
                'is_active': cat.is_active
            }
            data.append(category_data)
        
        return DRFResponse(data)

    @action(detail=True, methods=["post"], url_path="add-officer")
    def add_officer(self, request, pk=None):
        """Assign an officer to a category"""
        category = self.get_object()
        officer_id = request.data.get("officer_id")
        category.officers.add(officer_id)
        return DRFResponse({"detail": "Officer added successfully"}, status=status.HTTP_200_OK)


class ResolverLevelViewSet(viewsets.ModelViewSet):
    queryset = ResolverLevel.objects.all()
    serializer_class = ResolverLevelSerializer
    permission_classes = [permissions.AllowAny]  # For development


class CategoryResolverViewSet(viewsets.ModelViewSet):
    queryset = CategoryResolver.objects.all()
    serializer_class = CategoryResolverSerializer
    permission_classes = [permissions.AllowAny]  # For development


class ComplaintViewSet(viewsets.ModelViewSet):
    queryset = Complaint.objects.all()
    def get_serializer_class(self):
        if self.action == 'create':
            return ComplaintCreateSerializer
        return ComplaintSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and hasattr(user, 'can_view_all_complaints') and user.can_view_all_complaints():
            return Complaint.objects.all()
        elif user.is_authenticated and hasattr(user, 'get_accessible_complaints'):
            return user.get_accessible_complaints()
        else:
            # For development/testing, return all complaints
            return Complaint.objects.all()

    def create(self, request, *args, **kwargs):
        # Extract user ID from request data if provided
        user_id = request.data.get('user')
        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                submitted_by = User.objects.get(id=user_id)
            except User.DoesNotExist:
                submitted_by = None
        else:
            submitted_by = request.user if request.user.is_authenticated else None
        
        # Create mutable copy of request data
        data = request.data.copy()
        if 'user' in data:
            del data['user']  # Remove user from data as it's handled separately
            
        serializer = self.get_serializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        complaint = serializer.save(submitted_by=submitted_by)
        
        try:
            ai_service.process_complaint(complaint)
            complaint.refresh_from_db()
        except Exception as e:
            # Continue even if AI processing fails
            pass
            
        output_serializer = ComplaintSerializer(complaint)
        return DRFResponse(output_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Assign complaint to an officer"""
        complaint = self.get_object()
        officer_id = request.data.get("officer_id")
        level_id = request.data.get("level_id")
        
        Assignment.objects.create(
            complaint=complaint,
            officer_id=officer_id,
            level_id=level_id,
            reason='manual'
        )
        complaint.assigned_officer_id = officer_id
        complaint.current_level_id = level_id
        complaint.set_escalation_deadline()
        complaint.save()
        
        return DRFResponse({"detail": "Complaint assigned successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        """Update complaint status"""
        complaint = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict(Complaint.STATUS_CHOICES):
            return DRFResponse({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        complaint.status = new_status
        complaint.save()
        return DRFResponse({"detail": f"Status updated to {new_status}"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        """Escalate complaint to next resolver level"""
        complaint = self.get_object()
        if not complaint.current_level:
            return DRFResponse({"error": "No current level set"}, status=status.HTTP_400_BAD_REQUEST)
        
        next_level = ResolverLevel.objects.filter(
            institution=complaint.institution,
            level_order=complaint.current_level.level_order + 1
        ).first()
        
        if not next_level:
            return DRFResponse({"error": "No higher level available"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Find officer at next level for this category
        category_resolver = CategoryResolver.objects.filter(
            category=complaint.category,
            level=next_level,
            active=True
        ).first()
        
        if category_resolver:
            # Create escalation assignment
            Assignment.objects.create(
                complaint=complaint,
                officer=category_resolver.officer,
                level=next_level,
                reason='escalation'
            )
            
            complaint.current_level = next_level
            complaint.assigned_officer = category_resolver.officer
            complaint.set_escalation_deadline()
            complaint.status = "escalated"
            complaint.save()
            
            return DRFResponse({
                "detail": f"Escalated to {next_level.name}",
                "assigned_to": category_resolver.officer.email
            }, status=status.HTTP_200_OK)
        
        return DRFResponse({"error": "No resolver found at next level"}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=["get"], url_path="responses")
    def get_responses(self, request, pk=None):
        """Get all responses for a complaint"""
        complaint = self.get_object()
        responses = Response.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = ResponseSerializer(responses, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=["get"], url_path="comments")
    def get_comments(self, request, pk=None):
        """Get all comments for a complaint"""
        complaint = self.get_object()
        comments = Comment.objects.filter(complaint=complaint).order_by('-created_at')
        serializer = CommentSerializer(comments, many=True)
        return DRFResponse(serializer.data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=["post"], url_path="ai-categorize")
    def ai_categorize(self, request, pk=None):
        """Manually trigger AI categorization"""
        complaint = self.get_object()
        result = ai_service.process_complaint(complaint)
        
        if result:
            return DRFResponse({
                "category": result['category'].name if result['category'] else None,
                "priority": result['priority'],
                "assigned_officer": result['assigned_officer'].email if result['assigned_officer'] else None
            }, status=status.HTTP_200_OK)
        
        return DRFResponse({"error": "AI processing failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def perform_create(self, serializer):
        # For development, use a default user if not authenticated
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(author=user)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        # Check if user owns the comment
        if request.user.is_authenticated and comment.author != request.user:
            return DRFResponse({"error": "You can only edit your own comments"}, status=status.HTTP_403_FORBIDDEN)
        
        # Allow partial updates
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        # Check if user owns the comment
        if request.user.is_authenticated and comment.author != request.user:
            return DRFResponse({"error": "You can only delete your own comments"}, status=status.HTTP_403_FORBIDDEN)
        
        return super().destroy(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Comment.objects.all()
        complaint_id = self.request.query_params.get('complaint', None)
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        # Only allow author to delete their own comments
        if request.user != comment.author:
            return DRFResponse({"error": "You can only delete your own comments"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        comment = self.get_object()
        # Only allow author to edit their own comments
        if request.user != comment.author:
            return DRFResponse({"error": "You can only edit your own comments"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class ResponseViewSet(viewsets.ModelViewSet):
    queryset = Response.objects.all()
    serializer_class = ResponseSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def perform_create(self, serializer):
        # Set the responder to the current user
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(responder=user)

    def get_queryset(self):
        queryset = Response.objects.all()
        complaint_id = self.request.query_params.get('complaint', None)
        if complaint_id:
            queryset = queryset.filter(complaint=complaint_id)
        return queryset.order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        response = self.get_object()
        # Only allow responder to delete their own responses
        if request.user != response.responder:
            return DRFResponse({"error": "You can only delete your own responses"}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        response = self.get_object()
        # Only allow responder to edit their own responses
        if request.user != response.responder:
            return DRFResponse({"error": "You can only edit your own responses"}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.AllowAny]  # For development
