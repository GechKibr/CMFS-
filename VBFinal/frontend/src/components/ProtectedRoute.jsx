import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, getUserRole } = useAuth();

  // Check if user is authenticated (has valid token and user data)
  if (!user || !localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && getUserRole() !== requiredRole) {
    // Redirect to appropriate dashboard based on user role
    const userRole = getUserRole();
    switch (userRole) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'officer':
        return <Navigate to="/officer" replace />;
      case 'user':
      default:
        return <Navigate to="/user" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
