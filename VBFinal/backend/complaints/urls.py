from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    InstitutionViewSet,
    CategoryViewSet,
    ResolverLevelViewSet,
    CategoryResolverViewSet,
    ComplaintViewSet,
    CommentViewSet,
    AssignmentViewSet,
    ResponseViewSet,
    NotificationViewSet,
)


router = DefaultRouter()

router.register(r'institutions', InstitutionViewSet, basename='institution')
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'resolver-levels', ResolverLevelViewSet, basename='resolver-level')
router.register(r'resolver-assignments', CategoryResolverViewSet, basename='resolver-assignment')
router.register(r'complaints', ComplaintViewSet, basename='complaint')
router.register(r'comments', CommentViewSet, basename='comment')
router.register(r'assignments', AssignmentViewSet, basename='assignment')
router.register(r'responses', ResponseViewSet, basename='response')
router.register(r'notifications', NotificationViewSet, basename='notification')
urlpatterns = router.urls