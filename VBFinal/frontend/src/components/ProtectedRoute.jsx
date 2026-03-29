import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { user, getUserRole } = useAuth();

  // Check if user is authenticated (has valid token and user data)
  if (!user || !localStorage.getItem('token')) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && getUserRole() !== requiredRole) {
    const role = getUserRole();
    const isSuperAdmin = user?.is_superuser || role === 'super_admin';
    const canAccessAdmin = requiredRole === 'admin' && (role === 'admin' || isSuperAdmin);
    const canAccessSuperAdmin = requiredRole === 'super_admin' && isSuperAdmin;

    if (canAccessAdmin || canAccessSuperAdmin) {
      return children;
    }

    // Redirect to appropriate dashboard based on user role
    switch (role) {
      case 'super_admin':
        return <Navigate to="/super-admin" replace />;
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
