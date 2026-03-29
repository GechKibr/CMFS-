from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.shortcuts import redirect
from urllib.parse import urlencode


def generate_jwt_token(strategy, details, user=None, *args, **kwargs):
    """
    Generate JWT tokens after successful Microsoft authentication
    and redirect to frontend with tokens
    """
    if not user:
        return None

    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)
    refresh_token = str(refresh)

    is_new = kwargs.get('is_new', False)
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')

    redirect_path = '/register/complete' if is_new else '/auth/success'
    redirect_url = f"{frontend_url}{redirect_path}"

    params = {
        'access': access_token,
        'refresh': refresh_token,
        'user_id': user.id,
        'email': user.email,
        'is_new': str(is_new).lower(),
    }

    return redirect(f"{redirect_url}?{urlencode(params)}")
