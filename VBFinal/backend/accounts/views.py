from django.conf import settings
from django.contrib.auth.hashers import check_password
from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from .email_service import EmailService
from .models import (
    ACADEMIC_UNITS,
    CAMPUS_CHOICES,
    STUDENT_TYPE_CHOICES,
    Department,
    EmailVerificationToken,
    DeletedAccount,
    MaintenanceConfiguration,
    Officer,
    PasswordResetOTP,
    PasswordResetToken,
    Student,
    SystemLog,
    User,
)
from .serializers import (
    AdminUserSerializer,
    DepartmentSerializer,
    DeletedAccountSerializer,
    LoginSerializer,
    MaintenanceConfigurationSerializer,
    OfficerSerializer,
    RegisterSerializer,
    SelfUserSerializer,
    StudentSerializer,
    SystemLogSerializer,
)
from .utils import (
    generate_email_verification_token,
    generate_password_reset_otp,
    generate_password_reset_token,
    mask_email,
)


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin())


class PublicReadAdminWriteMixin:
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.AllowAny()]
        return [IsAdminRole()]


class AdminOnlyModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('student_profile__department', 'officer_profile__department').all()
    public_actions = {
        'register',
        'login',
        'request_password_reset',
        'verify_password_reset_otp',
        'reset_password_otp',
        'reset_password',
        'verify_email',
    }

    def _get_otp_rate_limit_config(self):
        return {
            'limit': getattr(settings, 'PASSWORD_RESET_OTP_RATE_LIMIT', 3),
            'window_minutes': getattr(settings, 'PASSWORD_RESET_OTP_RATE_WINDOW_MINUTES', 10),
        }

    def _increment_otp_rate_limit(self, email):
        email_key = (email or '').strip().lower()
        config = self._get_otp_rate_limit_config()
        window_seconds = int(config['window_minutes']) * 60
        cache_key = f"password-reset-otp:requests:{email_key}"

        current = cache.get(cache_key)
        if current is None:
            cache.set(cache_key, 1, timeout=window_seconds)
            return True

        if current >= int(config['limit']):
            return False

        try:
            cache.incr(cache_key)
        except Exception:
            cache.set(cache_key, current + 1, timeout=window_seconds)
        return True

    def get_serializer_class(self):
        if self.action == 'register':
            return RegisterSerializer
        if self.action == 'login':
            return LoginSerializer
        if self.action == 'me':
            return SelfUserSerializer
        if self.action == 'deleted_accounts':
            return DeletedAccountSerializer
        return AdminUserSerializer

    def get_authenticators(self):
        if getattr(self, 'action', None) in self.public_actions:
            return []
        return super().get_authenticators()

    def get_permissions(self):
        action = getattr(self, 'action', None)
        if action in self.public_actions:
            return [permissions.AllowAny()]
        if action in ['me', 'logout']:
            return [permissions.IsAuthenticated()]
        if action == 'deleted_accounts':
            return [IsAdminRole()]
        # Allow authenticated users to update their own profile via detail PATCH/PUT
        if action in ['update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        return [IsAdminRole()]

    def _archive_deleted_account(self, user, deleted_by=None, deletion_source='self_delete'):
        student_profile = getattr(user, 'student_profile', None)
        officer_profile = getattr(user, 'officer_profile', None)

        department = None
        college = None
        campus_id = None
        student_type = None
        year_of_study = None
        employee_id = None

        if student_profile:
            department = student_profile.department.department_name if student_profile.department else None
            college = student_profile.department.department_college if student_profile.department else None
            campus_id = student_profile.campus_id
            student_type = student_profile.student_type
            year_of_study = student_profile.year_of_study

        if officer_profile:
            department = officer_profile.department.department_name if officer_profile.department else department
            college = officer_profile.college or (officer_profile.department.department_college if officer_profile.department else college)
            employee_id = officer_profile.employee_id

        snapshot = {
            'user_id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'username': user.username,
            'role': user.role,
            'phone': user.phone,
            'gmail_account': user.gmail_account,
            'auth_provider': user.auth_provider,
            'campus_id': campus_id,
            'college': college,
            'department': department,
            'student_type': student_type,
            'year_of_study': year_of_study,
            'employee_id': employee_id,
        }

        return DeletedAccount.objects.create(
            original_user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            username=user.username,
            role=user.role,
            phone=user.phone,
            gmail_account=user.gmail_account,
            campus_id=campus_id,
            college=college,
            department=department,
            student_type=student_type,
            year_of_study=year_of_study,
            employee_id=employee_id,
            auth_provider=user.auth_provider,
            deleted_by=deleted_by,
            deletion_source=deletion_source,
            snapshot=snapshot,
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # If non-admin updating their own profile, use SelfUserSerializer
        if request.user.is_authenticated and request.user.id == instance.id and not request.user.is_admin():
            serializer = SelfUserSerializer(instance, data=request.data, partial=False, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if request.user.is_authenticated and request.user.id == instance.id and not request.user.is_admin():
            serializer = SelfUserSerializer(instance, data=request.data, partial=True, context={'request': request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        deleted_by = request.user.email if request.user and request.user.is_authenticated else None
        with transaction.atomic():
            self._archive_deleted_account(instance, deleted_by=deleted_by, deletion_source='admin_delete')
            self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='login')
    def login(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        maintenance_config = MaintenanceConfiguration.get_solo()
        if maintenance_config.active_now and not user.is_admin():
            return Response(
                {'error': 'System is currently under maintenance. Only administrators can access the system.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        refresh = RefreshToken.for_user(user)

        try:
            ip_address = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
            if ',' in ip_address:
                ip_address = ip_address.split(',')[0].strip()

            SystemLog.objects.create(
                level='SUCCESS',
                message=f'User {user.email} logged in',
                category='AUTH',
                user=user.email,
                ip_address=ip_address or None,
                method='POST',
                path='/api/accounts/login/',
                status_code=200,
            )
        except Exception:
            pass

        return Response(
            {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': SelfUserSerializer(user, context={'request': request}).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='register')
    def register(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = generate_email_verification_token(user)
        EmailService.send_verification_email(user, token)
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'user': SelfUserSerializer(user, context={'request': request}).data,
                'message': 'Verification email sent',
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='logout')
    def logout(self, request):
        try:
            refresh_token = request.data['refresh']
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get', 'put', 'patch', 'delete'], url_path='me')
    def me(self, request):
        if request.method == 'GET':
            serializer = SelfUserSerializer(request.user, context={'request': request})
            return Response(serializer.data)

        if request.method == 'DELETE':
            # Prevent officers from self-deleting via the API; deletion must be performed by admin.
            if request.user and getattr(request.user, 'is_officer', lambda: False)() or getattr(request.user, 'role', None) == 'officer':
                return Response({'error': 'Officers cannot delete their own account. Contact an administrator.'}, status=status.HTTP_403_FORBIDDEN)

            with transaction.atomic():
                self._archive_deleted_account(request.user, deleted_by=request.user.email, deletion_source='self_delete')
                request.user.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = SelfUserSerializer(
            request.user,
            data=request.data,
            partial=request.method == 'PATCH',
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='deleted-accounts')
    def deleted_accounts(self, request):
        deleted_accounts = DeletedAccount.objects.all()
        serializer = DeletedAccountSerializer(deleted_accounts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='verify-email')
    def verify_email(self, request):
        token_str = request.data.get('token')
        if not token_str:
            return Response({'error': 'Token required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = EmailVerificationToken.objects.get(token=token_str)
            if not token.is_valid():
                return Response({'error': 'Token expired or already used'}, status=status.HTTP_400_BAD_REQUEST)

            token.user.is_email_verified = True
            token.user.save()
            token.is_used = True
            token.save()

            return Response({'message': 'Email verified successfully'}, status=status.HTTP_200_OK)
        except EmailVerificationToken.DoesNotExist:
            return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='request-password-reset')
    def request_password_reset(self, request):
        email = (
            request.data.get('email')
            or request.data.get('identifier')
            or request.data.get('gmail_account')
        )

        if not email:
            return Response({'error': 'Email required'}, status=status.HTTP_400_BAD_REQUEST)

        if not self._increment_otp_rate_limit(email):
            return Response(
                {'message': 'If an account exists for this email, an OTP has been sent.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = User.objects.filter(Q(email__iexact=email) | Q(gmail_account__iexact=email)).first()
        if user:
            otp_length = getattr(settings, 'PASSWORD_RESET_OTP_LENGTH', 6)
            otp_expiry = getattr(settings, 'PASSWORD_RESET_OTP_EXPIRY_MINUTES', 10)
            max_attempts = getattr(settings, 'PASSWORD_RESET_OTP_MAX_ATTEMPTS', 5)
            PasswordResetOTP.objects.filter(user=user, is_used=False).update(is_used=True)
            otp_code, _ = generate_password_reset_otp(
                user,
                expiry_minutes=otp_expiry,
                length=otp_length,
                max_attempts=max_attempts,
            )
            EmailService.send_password_reset_otp_email(user, otp_code, expires_minutes=otp_expiry)

        return Response(
            {
                'message': 'If an account exists for this email, an OTP has been sent.',
                'masked_email': mask_email(email),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='verify-password-reset-otp')
    def verify_password_reset_otp(self, request):
        email = request.data.get('email')
        otp = str(request.data.get('otp', '')).strip()

        if not email or not otp:
            return Response({'error': 'Email and OTP are required'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(Q(email__iexact=email) | Q(gmail_account__iexact=email)).first()
        if not user:
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)

        otp_entry = (
            PasswordResetOTP.objects.filter(user=user, is_used=False)
            .order_by('-created_at')
            .first()
        )
        if not otp_entry or not otp_entry.is_valid() or not otp_entry.can_attempt():
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)

        if not check_password(otp, otp_entry.otp_hash):
            otp_entry.register_attempt(succeeded=False)
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)

        otp_entry.register_attempt(succeeded=True)

        reset_token_expiry = getattr(settings, 'PASSWORD_RESET_OTP_RESET_TOKEN_MINUTES', 15)
        reset_token = generate_password_reset_token(user, expiry_hours=reset_token_expiry / 60)

        return Response(
            {
                'message': 'OTP verified. You can now reset your password.',
                'reset_token': reset_token.token,
                'reset_token_expires_at': reset_token.expires_at,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='reset-password-otp')
    def reset_password_otp(self, request):
        token_str = request.data.get('reset_token', '').strip()
        new_password = request.data.get('password')

        if not token_str or not new_password:
            return Response(
                {'error': 'Reset token and password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = PasswordResetToken.objects.get(token=token_str)
            if not token.is_valid():
                return Response(
                    {'error': 'Reset token has expired or has already been used.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            token.user.set_password(new_password)
            token.user.save()
            token.user.mark_password_as_local_auth()
            token.is_used = True
            token.save()

            return Response(
                {'message': 'Password reset successfully. You can now log in with your new password.'},
                status=status.HTTP_200_OK,
            )
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid reset token. Please request a new OTP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=['post'], url_path='reset-password')
    def reset_password(self, request):
        token_str = request.data.get('token', '').strip()
        new_password = request.data.get('password')

        if not token_str or not new_password:
            return Response(
                {'error': 'Token and password are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = PasswordResetToken.objects.get(token=token_str)
            if not token.is_valid():
                return Response(
                    {'error': 'Reset link has expired or has already been used. Please request a new password reset.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            token.user.set_password(new_password)
            token.user.save()
            token.user.mark_password_as_local_auth()
            token.is_used = True
            token.save()

            return Response(
                {'message': 'Password reset successfully. You can now log in with your new password.'},
                status=status.HTTP_200_OK,
            )
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'Invalid reset link. This link may not exist or has expired. Please request a new password reset.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class SystemViewSet(viewsets.ViewSet):
    def get_permissions(self):
        if getattr(self, 'action', None) == 'maintenance' and self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [IsAdminRole()]

    @action(detail=False, methods=['get', 'post'], url_path='jwt-session')
    def jwt_session(self, request):
        from conf.jwt_session import jwt_session_config

        return jwt_session_config(request._request)

    @action(detail=False, methods=['get', 'post', 'patch'], url_path='maintenance')
    def maintenance(self, request):
        if request.method == 'GET':
            # Cache maintenance config for 60 seconds to reduce DB load
            cache_key = 'maintenance_config_get'
            cached_data = cache.get(cache_key)
            if cached_data:
                return Response(cached_data)
            
            config = MaintenanceConfiguration.get_solo()
            data = MaintenanceConfigurationSerializer(config).data
            cache.set(cache_key, data, 60)  # Cache for 1 minute
            return Response(data)

        # POST/PATCH: fetch fresh config, update, and invalidate cache
        config = MaintenanceConfiguration.get_solo()
        serializer = MaintenanceConfigurationSerializer(
            config,
            data=request.data,
            partial=request.method == 'PATCH',
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        config.refresh_from_db()
        
        # Invalidate cache after update
        cache.delete('maintenance_config_get')
        
        data = MaintenanceConfigurationSerializer(config).data
        return Response(data, status=status.HTTP_200_OK)


class MicrosoftAuthViewSet(viewsets.ViewSet):
    def get_permissions(self):
        if getattr(self, 'action', None) in ['login', 'callback']:
            return [permissions.AllowAny()]
        if settings.DEBUG:
            return [permissions.AllowAny()]
        return [IsAdminRole()]

    def get_authenticators(self):
        if getattr(self, 'action', None) in ['login', 'callback']:
            return []
        if settings.DEBUG and getattr(self, 'action', None) == 'test':
            return []
        return super().get_authenticators()

    @action(detail=False, methods=['get'], url_path='login')
    def login(self, request):
        from .microsoft_auth import microsoft_login

        return microsoft_login(request._request)

    @action(detail=False, methods=['get'], url_path='callback')
    def callback(self, request):
        from .microsoft_auth import microsoft_callback

        return microsoft_callback(request._request)

    @action(detail=False, methods=['get'], url_path='test')
    def test(self, request):
        from .microsoft_auth import microsoft_config_test

        return microsoft_config_test(request._request)


class TokenViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def dispatch(self, request, *args, **kwargs):
        self._skip_token_auth = request.path.endswith('/refresh/') or request.path.endswith('/verify/')
        return super().dispatch(request, *args, **kwargs)

    def get_authenticators(self):
        if getattr(self, '_skip_token_auth', False):
            return []
        return super().get_authenticators()

    @action(detail=False, methods=['post'], url_path='refresh')
    def refresh(self, request):
        return TokenRefreshView.as_view()(request._request)

    @action(detail=False, methods=['post'], url_path='verify')
    def verify(self, request):
        return TokenVerifyView.as_view()(request._request)

    @action(detail=False, methods=['post'], url_path='check-expiry', permission_classes=[permissions.IsAuthenticated])
    def check_expiry(self, request):
        from conf.jwt_session import check_token_expiry

        return check_token_expiry(request._request)


class CampusListViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def get_authenticators(self):
        return []

    def list(self, request):
        payload = [
            {
                'id': code,
                'campus_name': label,
                'code': code,
                'is_active': True,
            }
            for code, label in CAMPUS_CHOICES
        ]
        return Response(payload)


class CollegeListViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def get_authenticators(self):
        return []

    def list(self, request):
        # College endpoint now serves academic-unit choices.
        payload = [
            {
                'id': code,
                'college_name': label,
                'college_code': code,
                'code': code,
                'is_active': True,
            }
            for code, label in ACADEMIC_UNITS
        ]
        return Response(payload)


class StudentTypeListViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]

    def get_authenticators(self):
        return []

    def list(self, request):
        payload = [
            {
                'id': code,
                'type_name': label,
                'code': code,
                'is_active': True,
            }
            for code, label in STUDENT_TYPE_CHOICES
        ]
        return Response(payload)



class DepartmentViewSet(PublicReadAdminWriteMixin, viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        college = self.request.query_params.get('college')
        qs = Department.objects.order_by('id')
        if college:
            qs = qs.filter(department_college=college)
        return qs


class SystemLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SystemLogSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        qs = SystemLog.objects.all()
        level = self.request.query_params.get('level')
        category = self.request.query_params.get('category')
        if level:
            qs = qs.filter(level=level.upper())
        if category:
            qs = qs.filter(category=category.upper())
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        total_count = queryset.count()

        try:
            limit = max(1, int(request.query_params.get('limit', 100)))
        except (TypeError, ValueError):
            limit = 100

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (TypeError, ValueError):
            page = 1

        offset = (page - 1) * limit
        results = queryset[offset:offset + limit]

        stats = queryset.aggregate(
            total=Count('id'),
            info=Count('id', filter=Q(level='INFO')),
            warn=Count('id', filter=Q(level='WARN')),
            error=Count('id', filter=Q(level='ERROR')),
            success=Count('id', filter=Q(level='SUCCESS')),
        )

        next_exists = offset + limit < total_count
        previous_exists = page > 1 and total_count > 0

        return Response({
            'count': total_count,
            'next': next_exists,
            'previous': previous_exists,
            'page': page,
            'page_size': limit,
            'stats': stats,
            'results': self.get_serializer(results, many=True).data,
        })

# StudentType was converted to static choices; remove its viewset.


class StudentViewSet(AdminOnlyModelViewSet):
    serializer_class = StudentSerializer

    def get_queryset(self):
        qs = Student.objects.select_related('user', 'department').order_by('id')
        student_type = self.request.query_params.get('student_type')
        department_id = self.request.query_params.get('department')
        if student_type:
            qs = qs.filter(student_type=student_type)
        if department_id:
            qs = qs.filter(department_id=department_id)
        return qs


class OfficerViewSet(AdminOnlyModelViewSet):
    serializer_class = OfficerSerializer

    def get_queryset(self):
        qs = Officer.objects.select_related('user', 'department').order_by('id')
        college = self.request.query_params.get('college')
        department_id = self.request.query_params.get('department')
        if college:
            qs = qs.filter(college=college)
        if department_id:
            qs = qs.filter(department_id=department_id)
        return qs
