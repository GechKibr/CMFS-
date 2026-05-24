import json
import logging
import os
from urllib.parse import urlencode

import jwt
import requests
from django.http import JsonResponse


from django.shortcuts import redirect
from jwt import InvalidTokenError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .microsoft_auth_service import (
    generate_jwt_pair_for_user,
    normalize_microsoft_profile,
    upsert_microsoft_user,
)


logger = logging.getLogger(__name__)


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

    additional_clients_raw = os.getenv('MICROSOFT_ADDITIONAL_CLIENT_IDS', '').strip()
    additional_clients = [client.strip() for client in additional_clients_raw.split(',') if client.strip()]
    allowed_audiences = [client_id] + additional_clients
    leeway_seconds = int(os.getenv('MICROSOFT_JWT_LEEWAY_SECONDS', '300') or '300')

    try:
        claims = jwt.decode(
            id_token,
            public_key,
            algorithms=['RS256'],
            audience=allowed_audiences,
            issuer=issuer,
            leeway=leeway_seconds,
        )
    except Exception:
        try:
            claims = jwt.decode(
                id_token,
                public_key,
                algorithms=['RS256'],
                options={'verify_aud': False},
                leeway=leeway_seconds,
            )
        except InvalidTokenError as exc:
            raise MicrosoftTokenValidationError(f'Invalid Microsoft ID token: {exc}')

        aud_claim = claims.get('aud')
        azp_claim = claims.get('azp')
        aud_values = []
        if isinstance(aud_claim, (list, tuple)):
            aud_values = list(aud_claim)
        elif aud_claim:
            aud_values = [aud_claim]

        matches_aud = any(value in allowed_audiences for value in aud_values)
        matches_azp = azp_claim in allowed_audiences

        if not (matches_aud or matches_azp):
            allow_relaxed = os.getenv('MICROSOFT_ALLOW_RELAXED_AUD', '').strip().lower() == 'true'
            if not allow_relaxed:
                raise MicrosoftTokenValidationError('Invalid Microsoft ID token audience.')

    if not claims.get('email') and not claims.get('preferred_username') and not claims.get('upn'):
        raise MicrosoftTokenValidationError('Microsoft ID token is missing required email claims.')

    return claims


def _profile_email_from_claims(claims):
    return (
        claims.get('email')
        or claims.get('preferred_username')
        or claims.get('upn')
        or ''
    ).strip().lower()


def _user_info_from_claims(claims):
    email = _profile_email_from_claims(claims)
    display_name = (claims.get('name') or '').strip()
    first_name = (claims.get('given_name') or '').strip()
    last_name = (claims.get('family_name') or '').strip()

    if not display_name and email:
        display_name = email.split('@')[0]

    if not first_name and display_name:
        first_name = display_name.split(' ')[0]

    if not last_name and display_name:
        name_parts = display_name.split(' ')
        if len(name_parts) > 1:
            last_name = ' '.join(name_parts[1:])

    return {
        'mail': email,
        'userPrincipalName': email,
        'id': claims.get('oid') or claims.get('sub') or email,
        'givenName': first_name,
        'surname': last_name,
        'displayName': display_name,
    }


def _build_auth_payload(user, profile, is_new):
    tokens = generate_jwt_pair_for_user(user)
    return {
        'access': tokens['access'],
        'refresh': tokens['refresh'],
        'user_exists': not is_new,
        'is_new': is_new,
        'requires_registration': is_new,
        'next_step': 'register' if is_new else 'home',
        'email': profile['email'].lower(),
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role,
            'auth_provider': user.auth_provider,
        },
    }


def _handle_mobile_microsoft_auth(request):
    access_token = (request.data.get('access_token') or '').strip()
    id_token = (request.data.get('id_token') or '').strip()

    if not access_token:
        return Response({'error': 'access_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        claims = None
        if id_token:
            try:
                claims = _validate_microsoft_id_token(id_token)
            except MicrosoftTokenValidationError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        user_info = None
        profile = None

        if claims:
            user_info = _user_info_from_claims(claims)
            profile = normalize_microsoft_profile(user_info)

        if profile is None and access_token:
            try:
                user_info = _fetch_microsoft_user_info(access_token)
                profile = normalize_microsoft_profile(user_info)
            except MicrosoftTokenValidationError as exc:
                logger.warning('Microsoft Graph lookup failed: %s', exc)

        if profile is None:
            return Response({'error': 'Unable to resolve Microsoft profile.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not profile['email'] and claims:
            profile['email'] = _profile_email_from_claims(claims)

        if not profile['email']:
            return Response({'error': 'No email found in Microsoft profile.'}, status=status.HTTP_400_BAD_REQUEST)

        if claims:
            token_email = _profile_email_from_claims(claims)
            if token_email and profile['email'].lower() != token_email.lower():
                raise MicrosoftTokenValidationError(
                    'Microsoft access token and ID token belong to different users.'
                )

        if user_info is None and claims:
            user_info = _user_info_from_claims(claims)

        user, is_new = upsert_microsoft_user(user_info)
        payload = _build_auth_payload(user, profile, is_new)

        return Response(payload, status=status.HTTP_200_OK)
    except MicrosoftTokenValidationError as exc:
        return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)


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
        payload = _build_auth_payload(user, profile, is_new)

        if is_new:
            params = {
                'access': payload['access'],
                'refresh': payload['refresh'],
                'email': profile['email'],
                'first_name': profile['first_name'],
                'last_name': profile['last_name'],
                'is_new': 'true',
            }
            return redirect(f'{frontend_url}/register/complete?{urlencode(params)}')

        params = {
            'access': payload['access'],
            'refresh': payload['refresh'],
        }
        return redirect(f'{frontend_url}/auth/success?{urlencode(params)}')

    except Exception as exc:
        logger.exception('Microsoft auth error')
        return redirect(f'{frontend_url}/login?error=auth_failed&detail={str(exc)[:50]}')


@api_view(['POST'])
@permission_classes([AllowAny])
def microsoft_mobile_auth(request):
    return _handle_mobile_microsoft_auth(request)


@api_view(['POST'])
@permission_classes([AllowAny])
def microsoft_flutter_auth(request):
    return _handle_mobile_microsoft_auth(request)