from django.utils import timezone
from datetime import timedelta
import secrets
from .models import PasswordResetToken, EmailVerificationToken, EmailLog


def generate_password_reset_token(user, expiry_hours=24):
    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(hours=expiry_hours)
    
    return PasswordResetToken.objects.create(
        user=user,
        token=token,
        expires_at=expires_at
    )


def generate_email_verification_token(user, expiry_hours=48):
    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(hours=expiry_hours)
    
    return EmailVerificationToken.objects.create(
        user=user,
        token=token,
        expires_at=expires_at
    )


def log_email(email, subject, message, email_type='general', recipient=None, status='pending', error_message=None):
    return EmailLog.objects.create(
        recipient=recipient,
        email=email,
        subject=subject,
        message=message,
        email_type=email_type,
        status=status,
        error_message=error_message
    )
