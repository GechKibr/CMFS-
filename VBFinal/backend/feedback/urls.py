from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FeedbackTemplateViewSet, FeedbackResponseViewSet

router = DefaultRouter()
router.register(r'templates', FeedbackTemplateViewSet)
router.register(r'responses', FeedbackResponseViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
