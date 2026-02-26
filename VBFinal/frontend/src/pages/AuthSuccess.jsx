import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const access = searchParams.get('access');
    const refresh = searchParams.get('refresh');
    const email = searchParams.get('email');
    const isNew = searchParams.get('is_new') === 'true';

    if (access && refresh) {
      // Store tokens
      localStorage.setItem('token', access);
      localStorage.setItem('refreshToken', refresh);
      localStorage.setItem('userEmail', email);

      // Redirect based on user type
      if (isNew) {
        // New user - redirect to complete registration
        navigate('/register/complete');
      } else {
        // Existing user - redirect to dashboard
        navigate('/dashboard');
      }
    } else {
      // No tokens - redirect to login
      navigate('/login?error=authentication_failed');
    }
  }, [navigate, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthSuccess;
