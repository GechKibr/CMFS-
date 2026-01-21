import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TokenInterceptor = ({ children }) => {
  const { user, logout, verifyToken } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check token validity every 5 minutes
    const interval = setInterval(async () => {
      try {
        const isValid = await verifyToken();
        if (!isValid) {
          console.log('Token expired, logging out...');
          logout();
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        logout();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [user, logout, verifyToken]);

  return children;
};

export default TokenInterceptor;
