from datetime import timedelta
import secrets

from django.contrib.auth.hashers import make_password
from django.utils import timezone

from .models import EmailLog, EmailVerificationToken, PasswordResetOTP, PasswordResetToken


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


def generate_password_reset_otp(user, expiry_minutes=10, length=6, max_attempts=5):
    length = max(4, min(6, int(length)))
    otp_int = secrets.randbelow(10 ** length)
    otp = f"{otp_int:0{length}d}"
    expires_at = timezone.now() + timedelta(minutes=expiry_minutes)

    otp_entry = PasswordResetOTP.objects.create(
        user=user,
        otp_hash=make_password(otp),
        expires_at=expires_at,
        max_attempts=max_attempts,
    )

    return otp, otp_entry


def mask_email(email):
    if not email or '@' not in email:
        return email
    local, domain = email.split('@', 1)
    if len(local) <= 1:
        masked = '*'
    elif len(local) == 2:
        masked = f"{local[0]}*"
    else:
        masked = f"{local[0]}***{local[-1]}"
    return f"{masked}@{domain}"


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
