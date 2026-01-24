"""
URL configuration for conf project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
# project/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from accounts.urls import router as accounts_router
from complaints.urls import router as complaints_router
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.registry.extend(accounts_router.registry)
router.registry.extend(complaints_router.registry)




schema_view = get_schema_view(
    openapi.Info(
        title="Complaint Management API",
        default_version='v1',
        description="API documentation for Gondar University Complaint Management System",
        terms_of_service="https://www.gondar.edu.et/terms/",
        contact=openapi.Contact(email="support@gondar.edu.et"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/', include('accounts.urls')),
    path('api/', include('complaints.urls')),
    path('api/feedback/', include('feedback.urls')),
    path('api-auth/', include('rest_framework.urls')),

    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='redoc-ui'),
]
