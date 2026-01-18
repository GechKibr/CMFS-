from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Institution, Category, ResolverLevel, CategoryResolver, Complaint, Comment, Assignment
from .serializers import (
    InstitutionSerializer,
    CategorySerializer,
    ResolverLevelSerializer,
    CategoryResolverSerializer,
    ComplaintSerializer,
    ComplaintCreateSerializer,
    CommentSerializer,
    AssignmentSerializer,
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

    @action(detail=True, methods=["post"], url_path="add-officer")
    def add_officer(self, request, pk=None):
        """Assign an officer to a category"""
        category = self.get_object()
        officer_id = request.data.get("officer_id")
        category.officers.add(officer_id)
        return Response({"detail": "Officer added successfully"}, status=status.HTTP_200_OK)


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
    serializer_class = ComplaintSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def get_serializer_class(self):
        if self.action == 'create':
            return ComplaintCreateSerializer
        return ComplaintSerializer

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
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # For development, allow creation without authenticated user
        submitted_by = request.user if request.user.is_authenticated else None
        complaint = serializer.save(submitted_by=submitted_by)
        try:
            ai_service.process_complaint(complaint)
            complaint.refresh_from_db()
        except Exception as e:
            # Continue even if AI processing fails
            pass
        output_serializer = ComplaintSerializer(complaint)
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

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
        
        return Response({"detail": "Complaint assigned successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        """Update complaint status"""
        complaint = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict(Complaint.STATUS_CHOICES):
            return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        complaint.status = new_status
        complaint.save()
        return Response({"detail": f"Status updated to {new_status}"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        """Escalate complaint to next resolver level"""
        complaint = self.get_object()
        if not complaint.current_level:
            return Response({"error": "No current level set"}, status=status.HTTP_400_BAD_REQUEST)
        
        next_level = ResolverLevel.objects.filter(
            institution=complaint.institution,
            level_order=complaint.current_level.level_order + 1
        ).first()
        
        if not next_level:
            return Response({"error": "No higher level available"}, status=status.HTTP_400_BAD_REQUEST)
        
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
            
            return Response({
                "detail": f"Escalated to {next_level.name}",
                "assigned_to": category_resolver.officer.email
            }, status=status.HTTP_200_OK)
        
        return Response({"error": "No resolver found at next level"}, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=["post"], url_path="ai-categorize")
    def ai_categorize(self, request, pk=None):
        """Manually trigger AI categorization"""
        complaint = self.get_object()
        result = ai_service.process_complaint(complaint)
        
        if result:
            return Response({
                "category": result['category'].name if result['category'] else None,
                "priority": result['priority'],
                "assigned_officer": result['assigned_officer'].email if result['assigned_officer'] else None
            }, status=status.HTTP_200_OK)
        
        return Response({"error": "AI processing failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.AllowAny]  # For development

    def perform_create(self, serializer):
        # For development, use a default user if not authenticated
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(author=user)


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.AllowAny]  # For development
