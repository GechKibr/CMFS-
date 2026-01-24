from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from .views import UserViewSet
from conf.system_monitor import get_system_stats, get_system_alerts
from conf.jwt_session import jwt_session_config, check_token_expiry

router = DefaultRouter()
router.register(r'accounts', UserViewSet, basename='accounts')

urlpatterns = [
    path('', include(router.urls)),
    path('accounts/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('accounts/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('accounts/token/check-expiry/', check_token_expiry, name='check_token_expiry'),
    path('system/stats/', get_system_stats, name='system_stats'),
    path('system/alerts/', get_system_alerts, name='system_alerts'),
    path('system/jwt-session/', jwt_session_config, name='jwt_session_config'),
]


