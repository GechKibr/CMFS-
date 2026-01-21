from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import UserViewSet
from .system_monitor import get_system_stats

router = DefaultRouter()
router.register(r'accounts', UserViewSet, basename='accounts')

urlpatterns = [
    path('', include(router.urls)),
    path('accounts/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('accounts/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('accounts/system/stats/', get_system_stats, name='system_stats'),
]


