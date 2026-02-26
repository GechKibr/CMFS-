from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import redirect
from urllib.parse import urlencode


def generate_jwt_token(strategy, details, user=None, *args, **kwargs):
    """
    Generate JWT tokens after successful Microsoft authentication
    and redirect to frontend with tokens
    """
    if user:
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        # Determine if this is a new user
        is_new = kwargs.get('is_new', False)
        
        # Build redirect URL with tokens
        if is_new:
            redirect_url = 'http://localhost:5173/register/complete'
        else:
            redirect_url = 'http://localhost:5173/auth/success'
        
        params = {
            'access': access_token,
            'refresh': refresh_token,
            'user_id': user.id,
            'email': user.email,
            'is_new': str(is_new).lower()
        }
        
        # Redirect to frontend with tokens in URL params
        return redirect(f'{redirect_url}?{urlencode(params)}')
