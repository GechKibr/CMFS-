from django.db import models
from django.contrib.auth.models import (
    AbstractBaseUser,
    PermissionsMixin,
    BaseUserManager
)
from django.contrib.auth.models import Group, Permission
from django.utils import timezone
from django.conf import settings
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError

CAMPUS_CHOICES = [
    ("maraki", "Maraki Campus"),
    ("atse_tewodros", "Atse Tewodros Campus"),
    ("atse_fasil", "Atse Fasil Campus"),
    ("cmhs", "College of Medicine & Health Sciences Campus"),
    ("tseda", "Tseda Campus"),
]

ACADEMIC_UNITS = [
    ("medicine_health_sciences", "College of Medicine and Health Sciences"),
    ("agriculture_env_sciences", "College of Agriculture & Environmental Sciences"),
    ("business_economics", "College of Business and Economics"),
    ("natural_comp_sciences", "College of Natural and Computational Sciences"),
    ("social_sciences_humanities", "College of Social Sciences and Humanities"),
    ("veterinary_medicine", "College of Veterinary Medicine and Animal Sciences"),
    ("education", "College of Education"),
    ("informatics", "College of Informatics"),
    ("institute_technology", "Institute of Technology"),
    ("institute_biotechnology", "Institute of Biotechnology"),
    ("school_of_law", "School of Law"),
]

STUDENT_TYPE_CHOICES = [
    ("undergraduate", "Undergraduate Student"),
    ("postgraduate", "Postgraduate Student"),
    ("phd", "PhD / Doctoral Student"),
    ("specialty", "Specialty / Sub-specialty Student"),
    ("international", "International Student"),
    ("prospective", "Prospective Student"),
    ("regular", "Regular (Full-time) Student"),
    ("extension", "Extension / Part-time Student"),
    ("summer", "Summer / Special Term Student"),
]

class SystemLog(models.Model):
    LEVEL_CHOICES = [
        ('INFO', 'Info'),
        ('WARN', 'Warning'),
        ('ERROR', 'Error'),
        ('SUCCESS', 'Success'),
    ]
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='INFO')
    message = models.TextField()
    category = models.CharField(max_length=50, default='SYSTEM')
    user = models.CharField(max_length=255, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    method = models.CharField(max_length=10, blank=True, null=True)
    path = models.CharField(max_length=500, blank=True, null=True)
    status_code = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['level', 'created_at'])]

    def __str__(self):
        return f"[{self.level}] {self.category}: {self.message[:60]}"


class MaintenanceConfiguration(models.Model):
    singleton_enforcer = models.BooleanField(default=True, unique=True, editable=False)
    is_enabled = models.BooleanField(default=False)
    message = models.TextField(
        blank=True,
        default='System is currently under maintenance. Please try again later.',
    )
    scheduled_start = models.DateTimeField(null=True, blank=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='maintenance_config_updates',
    )

    class Meta:
        verbose_name = 'Maintenance Configuration'
        verbose_name_plural = 'Maintenance Configuration'

    def clean(self):
        if self.scheduled_start and self.scheduled_end and self.scheduled_end <= self.scheduled_start:
            raise ValidationError("Scheduled end time must be after scheduled start time.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        config, _ = cls.objects.get_or_create(singleton_enforcer=True)
        return config

    @property
    def active_now(self):
        now = timezone.now()
        if self.is_enabled:
            return True
        if self.scheduled_start and self.scheduled_end:
            return self.scheduled_start <= now < self.scheduled_end
        if self.scheduled_start and not self.scheduled_end:
            return self.scheduled_start <= now
        return False

    def __str__(self):
        return "Maintenance Configuration"


class EmailLog(models.Model):
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('pending', 'Pending'),
    ]
    
    EMAIL_TYPE_CHOICES = [
        ('verification', 'Email Verification'),
        ('password_reset', 'Password Reset'),
        ('password_reset_otp', 'Password Reset OTP'),
        ('complaint_notification', 'Complaint Notification'),
        ('assignment_notification', 'Assignment Notification'),
        ('escalation_alert', 'Escalation Alert'),
        ('general', 'General'),
    ]
    
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='email_logs'
    )
    email = models.EmailField()
    subject = models.CharField(max_length=255)
    message = models.TextField()
    email_type = models.CharField(max_length=50, choices=EMAIL_TYPE_CHOICES, default='general')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-sent_at']
        indexes = [
            models.Index(fields=['email', 'status']),
            models.Index(fields=['email_type', 'sent_at']),
        ]
    
    def __str__(self):
        return f"{self.email_type} to {self.email} - {self.status}"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('role', User.ROLE_ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_superuser') is not True:
            raise ValueError("Superuser must have is_superuser=True")

        return self.create_user(email, password, **extra_fields)


class Department(models.Model):
    department_name    = models.CharField(max_length=100, null=True, blank=True)
    department_college = models.CharField(max_length=100, null=True, blank=True,choices=ACADEMIC_UNITS)
    description        = models.TextField(blank=True, null=True)
    is_active          = models.BooleanField(default=True)
    created_at         = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.department_name or ''


def _role_is_officer_like(role):
    value = str(role or '').strip().lower()
    return bool(value) and 'officer' in value


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_USER = 'user'  # Student
    ROLE_OFFICER = 'officer'  # Resolver
    ROLE_ADMIN = 'admin'  # System Admin
    ROLE_CHOICES = [
        (ROLE_USER, 'User (Student)'),
        (ROLE_OFFICER, 'Officer (Resolver)'),
        (ROLE_ADMIN, 'Admin (System Admin)'),
    ]

    ROLE_LEVEL = {
        ROLE_USER: 1,
        ROLE_OFFICER: 2,
        ROLE_ADMIN: 3,
    }
   
    
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,10}$',
        message="Phone number must be entered in the format: '+0918121314'. Up to 10 digits allowed."
    )

    email = models.EmailField(unique=True, db_index=True)
    gmail_account = models.EmailField(unique=True, null=True, blank=True, db_index=True)
    username = models.CharField(max_length=150, unique=True, null=True, blank=True, db_index=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    phone = models.CharField(
        validators=[phone_regex],
        max_length=17,
        null=True,
        blank=True
    )

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_USER,
        db_index=True
    )

    AUTH_LOCAL = 'local'
    AUTH_MICROSOFT = 'microsoft'
    AUTH_GOOGLE = 'google'
    AUTH_PROVIDER_CHOICES = [
        (AUTH_LOCAL, 'Local'),
        (AUTH_MICROSOFT, 'Microsoft'),
        (AUTH_GOOGLE, 'Google'),
    ]

    auth_provider = models.CharField(
        max_length=20,
        choices=AUTH_PROVIDER_CHOICES,
        default=AUTH_LOCAL,
        db_index=True
    )
    microsoft_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True
    )
    google_id = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        db_index=True
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    groups = models.ManyToManyField(
        Group,
        verbose_name='groups',
        blank=True,
        related_name="custom_user_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name='user permissions',
        blank=True,
        related_name="custom_user_set",
        related_query_name="user",
    )

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['role']),
            models.Index(fields=['auth_provider']),
            models.Index(fields=['is_active', 'role']),
        ]
    
    def clean(self):
        if self.auth_provider == self.AUTH_MICROSOFT and not self.microsoft_id:
            raise ValidationError("Microsoft ID is required for Microsoft auth provider")

        if self.gmail_account and not self.gmail_account.lower().endswith('@gmail.com'):
            raise ValidationError("Gmail account must be a valid @gmail.com address")

        if not self.pk:
            return

        student_profile_exists = Student.objects.filter(user_id=self.pk).exists()
        officer_profile_exists = Officer.objects.filter(user_id=self.pk).exists()

        if student_profile_exists and officer_profile_exists:
            raise ValidationError("A user cannot have both student and officer profiles.")

        if student_profile_exists and self.role != self.ROLE_USER:
            raise ValidationError("Users with a student profile must have the student role.")

        if officer_profile_exists and self.role != self.ROLE_OFFICER:
            if not _role_is_officer_like(self.role):
                raise ValidationError("Users with an officer profile must have the officer role.")

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        if self.gmail_account:
            self.gmail_account = self.gmail_account.strip().lower()
        else:
            self.gmail_account = None

        if self.username:
            self.username = self.username.strip() or None
        else:
            self.username = None

        # Backward compatibility for legacy records that still carry super_admin.
        if self.role == 'super_admin':
            self.role = self.ROLE_ADMIN

        self.is_staff = self.role == self.ROLE_ADMIN or self.is_superuser

        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.full_name} | {self.role.upper()}"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def role_level(self):
        if _role_is_officer_like(self.role):
            return self.ROLE_LEVEL[self.ROLE_OFFICER]
        return self.ROLE_LEVEL.get(self.role, 0)

    def is_complainter(self):
        return self.role == self.ROLE_USER

    def is_resolver(self):
        return _role_is_officer_like(self.role)

    def is_admin(self):
        return self.role == self.ROLE_ADMIN

    def is_officer(self):
        return _role_is_officer_like(self.role)

    @property
    def is_anonymous(self):
        return False

    @property
    def is_authenticated(self):
        return True

    def can_manage(self, other_user):
        return self.role_level > other_user.role_level

    def can_submit_complaint(self):
        return self.role == self.ROLE_USER

    def can_be_assigned_complaints(self):
        return _role_is_officer_like(self.role)

    def can_assign_complaints(self):
        return _role_is_officer_like(self.role) or self.role == self.ROLE_ADMIN
    
    def can_escalate_complaints(self):
        return _role_is_officer_like(self.role) or self.role == self.ROLE_ADMIN
    
    def can_view_all_complaints(self):
        return self.role == self.ROLE_ADMIN

    def mark_password_as_local_auth(self):
        if self.auth_provider in [self.AUTH_MICROSOFT, self.AUTH_GOOGLE]:
            self.auth_provider = self.AUTH_LOCAL
            self.save(update_fields=['auth_provider'])

    @property
    def preferred_notification_email(self):
        return self.gmail_account or self.email

    @property
    def campus_id(self):
        student_profile = getattr(self, 'student_profile', None)
        return student_profile.campus_id if student_profile else None

    @property
    def user_campus(self):
        student_profile = getattr(self, 'student_profile', None)
        if student_profile and student_profile.campus_id:
            return student_profile.campus_id

        officer_profile = getattr(self, 'officer_profile', None)
        if officer_profile:
            return None
        return None

    @property
    def college(self):
        student_profile = getattr(self, 'student_profile', None)
        if student_profile and student_profile.department_id:
            return student_profile.department.department_college

        officer_profile = getattr(self, 'officer_profile', None)
        if officer_profile:
            return officer_profile.college or (
                officer_profile.department.department_college if officer_profile.department_id else None
            )
        return None

    @property
    def department(self):
        student_profile = getattr(self, 'student_profile', None)
        if student_profile:
            return student_profile.department_id

        officer_profile = getattr(self, 'officer_profile', None)
        return officer_profile.department_id if officer_profile else None

    @property
    def employee_id(self):
        officer_profile = getattr(self, 'officer_profile', None)
        return officer_profile.employee_id if officer_profile else None

    @property
    def student_type(self):
        student_profile = getattr(self, 'student_profile', None)
        return student_profile.student_type if student_profile else None

    @property
    def year_of_study(self):
        student_profile = getattr(self, 'student_profile', None)
        return student_profile.year_of_study if student_profile else None
    
    def get_accessible_complaints(self):
        from complaints.models import Complaint
        
        if self.can_view_all_complaints():
            return Complaint.objects.all()
        elif self.is_resolver():
            return Complaint.objects.filter(
                models.Q(assigned_officer=self) | models.Q(submitted_by=self)
            ).distinct()
        else:
            return Complaint.objects.filter(submitted_by=self)


class DeletedAccount(models.Model):
    original_user_id = models.IntegerField(db_index=True)
    email = models.EmailField(db_index=True)
    full_name = models.CharField(max_length=120)
    username = models.CharField(max_length=150, blank=True, null=True)
    role = models.CharField(max_length=20, db_index=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    gmail_account = models.EmailField(blank=True, null=True)
    campus_id = models.CharField(max_length=20, blank=True, null=True)
    college = models.CharField(max_length=100, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    student_type = models.CharField(max_length=50, blank=True, null=True)
    year_of_study = models.PositiveIntegerField(blank=True, null=True)
    employee_id = models.CharField(max_length=20, blank=True, null=True)
    auth_provider = models.CharField(max_length=20, blank=True, null=True)
    deleted_by = models.CharField(max_length=255, blank=True, null=True)
    deletion_source = models.CharField(max_length=30, default='self_delete')
    snapshot = models.JSONField(default=dict, blank=True)
    deleted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-deleted_at']
        indexes = [
            models.Index(fields=['deleted_at']),
            models.Index(fields=['email']),
            models.Index(fields=['role']),
        ]

    def __str__(self):
        return f"Deleted account: {self.full_name} <{self.email}>"

# Student types are represented as choices in `STUDENT_TYPE_CHOICES`.

class Student(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    student_type = models.CharField(max_length=50, choices=STUDENT_TYPE_CHOICES, null=True, blank=True, db_index=True)
    campus_id = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    year_of_study = models.PositiveIntegerField(null=True, blank=True)
    
    class Meta:
        ordering = ['user__first_name', 'user__last_name']
        indexes = [
            models.Index(fields=['department']),
        ]

    def clean(self):
        if self.user and self.user.role != User.ROLE_USER:
            raise ValidationError("Only users with the student role can have a student profile.")

        if self.user_id:
            existing_officer = Officer.objects.filter(user_id=self.user_id)
            if self.pk:
                existing_officer = existing_officer.exclude(user_id=self.user_id, pk=self.pk)
            if existing_officer.exists():
                raise ValidationError("This user already has an officer profile and cannot also be assigned a student profile.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
    
    def __str__(self):
        return self.user.full_name

class Officer(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='officer_profile'
    )
    employee_id = models.CharField(max_length=20, unique=True, null=True, blank=True, db_index=True)
    college = models.CharField(max_length=100, null=True, blank=True, choices=ACADEMIC_UNITS)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='officers')
    
    class Meta:
        ordering = ['user__first_name', 'user__last_name']
        indexes = [
            models.Index(fields=['employee_id']),
            models.Index(fields=['college']),
            models.Index(fields=['department']),
        ]

    def clean(self):
        if self.user and self.user.role != User.ROLE_OFFICER:
            raise ValidationError("Only users with the officer role can have an officer profile.")

        if self.user_id:
            existing_student = Student.objects.filter(user_id=self.user_id)
            if self.pk:
                existing_student = existing_student.exclude(user_id=self.user_id, pk=self.pk)
            if existing_student.exists():
                raise ValidationError("This user already has a student profile and cannot also be assigned an officer profile.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.full_name} ({self.employee_id})"
class PasswordResetToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token', 'is_used']),
        ]
    
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
    
    def __str__(self):
        return f"Reset token for {self.user.email}"


class PasswordResetOTP(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_otps'
    )
    otp_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_used']),
            models.Index(fields=['user', 'expires_at']),
        ]

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def can_attempt(self):
        return self.attempt_count < self.max_attempts

    def register_attempt(self, succeeded=False):
        if not succeeded:
            self.attempt_count = self.attempt_count + 1
        if succeeded or self.attempt_count >= self.max_attempts:
            self.is_used = True
        self.save(update_fields=['attempt_count', 'is_used'])

    def __str__(self):
        return f"Reset OTP for {self.user.email}"


class EmailVerificationToken(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_verification_tokens'
    )
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['token', 'is_used']),
        ]
    
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
    
    def __str__(self):
        return f"Verification token for {self.user.email}"
