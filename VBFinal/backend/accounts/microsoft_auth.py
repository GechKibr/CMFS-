from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import redirect
from django.http import JsonResponse
from urllib.parse import urlencode
import json
import os

import jwt
import requests
from jwt import InvalidTokenError

from .microsoft_auth_service import generate_jwt_pair_for_user, normalize_microsoft_profile, upsert_microsoft_user


class MicrosoftTokenValidationError(Exception):
    pass


def _build_microsoft_redirect_uri(request):
    explicit_redirect_uri = os.getenv('MICROSOFT_REDIRECT_URI', '').strip()
    if explicit_redirect_uri:
        return explicit_redirect_uri

    backend_url = os.getenv('BACKEND_URL', '').strip()
    if backend_url:
        return f"{backend_url.rstrip('/')}/api/accounts/microsoft/callback/"

    return request.build_absolute_uri('/api/accounts/microsoft/callback/')


def _fetch_microsoft_user_info(access_token):
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get('https://graph.microsoft.com/v1.0/me', headers=headers, timeout=15)
    if response.status_code != 200:
        raise MicrosoftTokenValidationError('Unable to validate Microsoft access token.')
    return response.json()


def _fetch_azure_openid_config(tenant_id):
    metadata_url = f'https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration'
    response = requests.get(metadata_url, timeout=15)
    if response.status_code != 200:
        raise MicrosoftTokenValidationError('Unable to fetch Azure OpenID configuration.')
    return response.json()


def _fetch_azure_jwks(jwks_uri):
    response = requests.get(jwks_uri, timeout=15)
    if response.status_code != 200:
        raise MicrosoftTokenValidationError('Unable to fetch Azure JWKS.')
    return response.json()


def _validate_microsoft_id_token(id_token):
    client_id = os.getenv('MICROSOFT_CLIENT_ID', '').strip()
    tenant_id = os.getenv('MICROSOFT_TENANT_ID', 'common').strip()
    if not client_id:
        raise MicrosoftTokenValidationError('Microsoft client ID is not configured.')

    config = _fetch_azure_openid_config(tenant_id)
    jwks = _fetch_azure_jwks(config.get('jwks_uri'))
    unverified_header = jwt.get_unverified_header(id_token)
    kid = unverified_header.get('kid')
    key_data = next((key for key in jwks.get('keys', []) if key.get('kid') == kid), None)
    if not key_data:
        raise MicrosoftTokenValidationError('Unable to locate matching Azure signing key.')

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
    issuer = config.get('issuer', '')

    try:
        claims = jwt.decode(
            id_token,
            public_key,
            algorithms=['RS256'],
            audience=client_id,
            issuer=issuer,
        )
    except InvalidTokenError as exc:
        raise MicrosoftTokenValidationError(f'Invalid Microsoft ID token: {exc}')

    if not claims.get('email') and not claims.get('preferred_username') and not claims.get('upn'):
        raise MicrosoftTokenValidationError('Microsoft ID token is missing required email claims.')

    return claims


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_config_test(request):
    """Test endpoint to verify Microsoft OAuth configuration"""
    client_id = os.getenv('MICROSOFT_CLIENT_ID', '')
    tenant_id = os.getenv('MICROSOFT_TENANT_ID', '')
    
    return JsonResponse({
        'client_id_configured': bool(client_id),
        'client_id_length': len(client_id) if client_id else 0,
        'tenant_id_configured': bool(tenant_id),
        'client_id_preview': client_id[:8] + '...' if client_id else 'NOT SET'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_login(request):
    """Redirect user to Microsoft login page"""
    client_id = os.getenv('MICROSOFT_CLIENT_ID', '')
    tenant_id = os.getenv('MICROSOFT_TENANT_ID', 'common')
    
    redirect_uri = _build_microsoft_redirect_uri(request)
    
    # Debug: Check if client_id is loaded
    if not client_id:
        return JsonResponse({
            'error': 'MICROSOFT_CLIENT_ID not configured',
            'message': 'Please check backend/.env file',
            'env_check': {
                'client_id': bool(client_id),
                'tenant_id': bool(tenant_id)
            }
        }, status=500)
    
    params = {
        'client_id': client_id,
        'response_type': 'code',
        'redirect_uri': redirect_uri,
        'response_mode': 'query',
        'scope': 'openid profile email User.Read',
    }
    
    auth_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize?{urlencode(params)}'
    return redirect(auth_url)


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_callback(request):
    """Handle Microsoft OAuth callback"""
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    code = request.GET.get('code')
    error = request.GET.get('error')
    
    if error:
        return redirect(f'{frontend_url}/login?error={error}')
    
    if not code:
        return redirect(f'{frontend_url}/login?error=no_code')
    
    try:
        # Exchange code for access token
        client_id = os.getenv('MICROSOFT_CLIENT_ID', '')
        client_secret = os.getenv('MICROSOFT_CLIENT_SECRET', '')
        tenant_id = os.getenv('MICROSOFT_TENANT_ID', 'common')
        
        redirect_uri = _build_microsoft_redirect_uri(request)
        
        token_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token'
        token_data = {
            'client_id': client_id,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
        }
        
        token_response = requests.post(token_url, data=token_data)
        
        if token_response.status_code != 200:
            return redirect(f'{frontend_url}/login?error=token_exchange_failed')
        
        access_token = token_response.json().get('access_token')
        
        try:
            user_info = _fetch_microsoft_user_info(access_token)
        except MicrosoftTokenValidationError:
            return redirect(f'{frontend_url}/login?error=user_info_failed')

        profile = normalize_microsoft_profile(user_info)
        if not profile['email']:
            return redirect(f'{frontend_url}/login?error=no_email')

        user, is_new = upsert_microsoft_user(user_info)
        tokens = generate_jwt_pair_for_user(user)
        
        # Redirect based on whether user is new
        if is_new:
            params = {
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'email': profile['email'],
                'first_name': profile['first_name'],
                'last_name': profile['last_name'],
                'is_new': 'true'
            }
            return redirect(f'{frontend_url}/register/complete?{urlencode(params)}')
        else:
            params = {
                'access': tokens['access'],
                'refresh': tokens['refresh'],
            }
            return redirect(f'{frontend_url}/auth/success?{urlencode(params)}')
        
    except Exception as e:
        # Log the error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Microsoft auth error: {str(e)}")
        return redirect(f'{frontend_url}/login?error=auth_failed&detail={str(e)[:50]}')


@api_view(['POST'])
@permission_classes([AllowAny])
def microsoft_mobile_auth(request):
    access_token = (request.data.get('access_token') or '').strip()
    id_token = (request.data.get('id_token') or '').strip()

    if not access_token:
        return Response({'error': 'access_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        claims = None
        if id_token:
            claims = _validate_microsoft_id_token(id_token)

        user_info = _fetch_microsoft_user_info(access_token)
        profile = normalize_microsoft_profile(user_info)

        if not profile['email'] and claims:
            profile['email'] = (
                claims.get('email') or
                claims.get('preferred_username') or
                claims.get('upn') or
                ''
            ).strip().lower()

        if not profile['email']:
            return Response({'error': 'No email found in Microsoft profile.'}, status=status.HTTP_400_BAD_REQUEST)

        if claims:
            token_email = (
                claims.get('email') or
                claims.get('preferred_username') or
                claims.get('upn') or
                ''
            ).strip().lower()
            if token_email and profile['email'].lower() != token_email.lower():
                raise MicrosoftTokenValidationError(
                    'Microsoft access token and ID token belong to different users.'
                )

        user, is_new = upsert_microsoft_user(user_info)
        tokens = generate_jwt_pair_for_user(user)

        return Response(
            {
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'is_new': is_new,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'auth_provider': user.auth_provider,
                },
            },
            status=status.HTTP_200_OK,
        )
    except MicrosoftTokenValidationError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([AllowAny])
def microsoft_flutter_auth(request):
    """
    Endpoint for Flutter mobile app Microsoft authentication.
    Accepts a Microsoft access_token from client-side OAuth flow,
    validates it with Microsoft Graph API, and returns JWT tokens.
    
    URL: POST /auth/microsoft/flutter/
    """
    access_token = (request.data.get('access_token') or '').strip()
    id_token = (request.data.get('id_token') or '').strip()

    if not access_token:
        return Response({'error': 'access_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        claims = None
        if id_token:
            claims = _validate_microsoft_id_token(id_token)

        user_info = _fetch_microsoft_user_info(access_token)
        profile = normalize_microsoft_profile(user_info)

        if not profile['email'] and claims:
            profile['email'] = (
                claims.get('email') or
                claims.get('preferred_username') or
                claims.get('upn') or
                ''
            ).strip().lower()

        if not profile['email']:
            return Response({'error': 'No email found in Microsoft profile.'}, status=status.HTTP_400_BAD_REQUEST)

        if claims:
            token_email = (
                claims.get('email') or
                claims.get('preferred_username') or
                claims.get('upn') or
                ''
            ).strip().lower()
            if token_email and profile['email'].lower() != token_email.lower():
                raise MicrosoftTokenValidationError(
                    'Microsoft access token and ID token belong to different users.'
                )

        user, is_new = upsert_microsoft_user(user_info)
        tokens = generate_jwt_pair_for_user(user)

        return Response(
            {
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'email': profile['email'].lower(),
            },
            status=status.HTTP_200_OK,
        )
    except MicrosoftTokenValidationError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)
    """
    Endpoint for Flutter mobile app Microsoft authentication.
    Accepts a Microsoft access_token from client-side OAuth flow,
    validates it with Microsoft Graph API, and returns JWT tokens.
    
    URL: POST /auth/microsoft/flutter/
    """
    access_token = (request.data.get('access_token') or '').strip()

    if not access_token:
        return Response({'error': 'access_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_info = _fetch_microsoft_user_info(access_token)
        profile = normalize_microsoft_profile(user_info)
        if not profile['email']:
            return Response({'error': 'No email found in Microsoft profile.'}, status=status.HTTP_400_BAD_REQUEST)

        user, is_new = upsert_microsoft_user(user_info)
        tokens = generate_jwt_pair_for_user(user)

        return Response(
            {
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'email': profile['email'].lower(),
            },
            status=status.HTTP_200_OK,
        )
    except MicrosoftTokenValidationError:
        return Response({'error': 'Invalid or expired Microsoft access token.'}, status=status.HTTP_401_UNAUTHORIZED)
