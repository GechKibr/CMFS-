from rest_framework.routers import DefaultRouter
from .views import UserViewSet, SystemViewSet, MicrosoftAuthViewSet, TokenViewSet, CampusViewSet, CollegeViewSet, DepartmentViewSet, RoleViewSet, GroupViewSet, PermissionViewSet, SystemLogViewSet

router = DefaultRouter()
router.register(r'accounts', UserViewSet, basename='accounts')
router.register(r'accounts/token', TokenViewSet, basename='token')
router.register(r'accounts/microsoft', MicrosoftAuthViewSet, basename='microsoft')
router.register(r'campuses', CampusViewSet, basename='campuses')
router.register(r'colleges', CollegeViewSet, basename='colleges')
router.register(r'departments', DepartmentViewSet, basename='departments')
router.register(r'roles', RoleViewSet, basename='roles')
router.register(r'groups', GroupViewSet, basename='groups')
router.register(r'permissions', PermissionViewSet, basename='permissions')
router.register(r'system', SystemViewSet, basename='system')
router.register(r'system-logs', SystemLogViewSet, basename='system-logs')

urlpatterns = router.urls
