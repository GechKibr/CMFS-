from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


def normalize_microsoft_profile(user_info):
    email = (user_info.get('mail') or user_info.get('userPrincipalName') or '').strip().lower()
    microsoft_id = (user_info.get('id') or '').strip() or None
    first_name = (user_info.get('givenName') or '').strip()
    last_name = (user_info.get('surname') or '').strip()
    return {
        'email': email,
        'microsoft_id': microsoft_id,
        'first_name': first_name,
        'last_name': last_name,
    }


def upsert_microsoft_user(user_info):
    profile = normalize_microsoft_profile(user_info)
    email = profile['email']
    microsoft_id = profile['microsoft_id']
    first_name = profile['first_name']
    last_name = profile['last_name']

    if not email:
        raise ValueError('Microsoft profile did not include an email or userPrincipalName.')

    user = None
    if microsoft_id:
        user = User.objects.filter(microsoft_id=microsoft_id).first()

    if not user:
        user = User.objects.filter(email__iexact=email).first()

    if user:
        is_new = False
        update_fields = []

        if microsoft_id and not user.microsoft_id:
            user.microsoft_id = microsoft_id
            update_fields.append('microsoft_id')

        if user.auth_provider == User.AUTH_LOCAL:
            user.auth_provider = User.AUTH_MICROSOFT
            update_fields.append('auth_provider')

        if not user.is_email_verified:
            user.is_email_verified = True
            update_fields.append('is_email_verified')

        if first_name and not user.first_name:
            user.first_name = first_name
            update_fields.append('first_name')

        if last_name and not user.last_name:
            user.last_name = last_name
            update_fields.append('last_name')

        if update_fields:
            user.save(update_fields=update_fields)

        return user, is_new

    base_username = email.split('@')[0]
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}{counter}"
        counter += 1

    try:
        user = User.objects.create_user(
            email=email,
            password=None,
            username=username,
            first_name=first_name,
            last_name=last_name,
            microsoft_id=microsoft_id,
            auth_provider=User.AUTH_MICROSOFT,
            is_email_verified=True,
            role=User.ROLE_USER,
        )
        return user, True
    except (ValidationError, IntegrityError):
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise
        return user, False


def generate_jwt_pair_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }