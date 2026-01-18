import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, isAuthenticated, getUserRole } = useAuth();

  if (!isAuthenticated) {
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
