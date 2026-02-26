from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.shortcuts import redirect
import requests

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def microsoft_auth(request):
    """
    Handle Microsoft OAuth authentication
    Expects: { "access_token": "..." } from Microsoft
    """
    access_token = request.data.get('access_token')
    
    if not access_token:
        return Response(
            {'error': 'Access token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Get user info from Microsoft Graph API
        headers = {'Authorization': f'Bearer {access_token}'}
        response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers=headers
        )
        
        if response.status_code != 200:
            return Response(
                {'error': 'Invalid access token'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        user_info = response.json()
        email = user_info.get('mail') or user_info.get('userPrincipalName')
        first_name = user_info.get('givenName', '')
        last_name = user_info.get('surname', '')
        
        if not email:
            return Response(
                {'error': 'Email not found in Microsoft account'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get or create user
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email.split('@')[0],
                'first_name': first_name,
                'last_name': last_name,
                'auth_provider': 'microsoft',
                'is_email_verified': True,
                'role': 'user'
            }
        )
        
        # If user exists but was created with different auth provider
        if not created and user.auth_provider != 'microsoft':
            user.auth_provider = 'microsoft'
            user.is_email_verified = True
            user.save()
        
        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        from accounts.serialzers import UserSerializer
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user, context={'request': request}).data,
            'created': created
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def microsoft_login_url(request):
    """
    Return the Microsoft OAuth login URL
    """
    import os
    from urllib.parse import urlencode
    
    client_id = os.environ.get('MICROSOFT_CLIENT_ID', '')
    tenant_id = os.environ.get('MICROSOFT_TENANT_ID', 'common')
    redirect_uri = request.build_absolute_uri('/api/accounts/microsoft/callback/')
    
    params = {
        'client_id': client_id,
        'response_type': 'code',
        'redirect_uri': redirect_uri,
        'response_mode': 'query',
        'scope': 'openid profile email User.Read',
        'state': 'random_state_string'
    }
    
    auth_url = f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize?{urlencode(params)}'
    
    return Response({'auth_url': auth_url})
