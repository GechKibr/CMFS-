from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
from datetime import timedelta
import json

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def jwt_session_config(request):
    """Get or update JWT session timeout configuration"""
    
    if request.method == "GET":
        # Get current JWT session timeout
        current_timeout = getattr(settings, 'JWT_SESSION_TIMEOUT_MINUTES', 30)
        return Response({
            'session_timeout_minutes': current_timeout,
            'available_options': [15, 30, 60, 120, 240],  # 15min, 30min, 1h, 2h, 4h
            'current_setting': f"{current_timeout} minutes"
        })
    
    elif request.method == "POST":
        # Check if user is admin
        if not (request.user.is_admin() if hasattr(request.user, 'is_admin') else request.user.is_staff):
            return Response({'error': 'Admin privileges required'}, status=403)
            
        try:
            new_timeout = int(request.data.get('timeout_minutes', 30))
            
            # Validate timeout value
            if new_timeout not in [15, 30, 60, 120, 240]:
                return Response({
                    'error': 'Invalid timeout value. Must be 15, 30, 60, 120, or 240 minutes.'
                }, status=400)
            
            # Update the setting (this would require restart in production)
            settings.JWT_SESSION_TIMEOUT_MINUTES = new_timeout
            
            # Update SIMPLE_JWT settings
            settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'] = timedelta(minutes=new_timeout)
            
            return Response({
                'success': True,
                'new_timeout': new_timeout,
                'message': f'JWT session timeout updated to {new_timeout} minutes. Note: Existing tokens remain valid until they expire.'
            })
            
        except (ValueError, TypeError) as e:
            return Response({'error': 'Invalid request data'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_token_expiry(request):
    """Check if current token is about to expire"""
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        from rest_framework_simplejwt.exceptions import TokenError
        
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'No valid token provided'}, status=401)
        
        token_string = auth_header.split(' ')[1]
        
        try:
            token = AccessToken(token_string)
            
            # Get token expiry time
            exp_timestamp = token.payload.get('exp')
            current_timestamp = token.current_time.timestamp()
            
            # Calculate time until expiry
            time_until_expiry = exp_timestamp - current_timestamp
            minutes_until_expiry = int(time_until_expiry / 60)
            
            # Check if token expires within 5 minutes
            expires_soon = minutes_until_expiry <= 5
            
            return Response({
                'valid': True,
                'expires_in_minutes': minutes_until_expiry,
                'expires_soon': expires_soon,
                'should_refresh': expires_soon
            })
            
        except TokenError:
            return Response({
                'valid': False,
                'expired': True,
                'should_refresh': True
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=500)
