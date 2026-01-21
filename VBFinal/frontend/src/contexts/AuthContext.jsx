import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/auth';
import apiService from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const currentUser = authService.getCurrentUser();
    const token = authService.getToken();
    
    if (currentUser && token) {
      // Verify token is still valid
      const isValid = await authService.verifyToken();
      if (isValid) {
        setUser(currentUser);
        apiService.setToken(token);
      } else {
        // Try to refresh token
        try {
          await authService.refreshToken();
          setUser(currentUser);
          apiService.setToken(authService.getToken());
        } catch (error) {
          console.error('Token refresh failed:', error);
          logout();
        }
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      apiService.setToken(response.access);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      if (response.user) {
        setUser(response.user);
        apiService.setToken(response.access);
      }
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    apiService.setToken(null);
  };

  const getUserRole = () => {
    return user?.role || authService.getUserRole();
  };

  const isAdmin = () => getUserRole() === 'admin';
  const isOfficer = () => getUserRole() === 'officer';
  const isUser = () => getUserRole() === 'user';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      register,
      logout,
      getUserRole,
      isAdmin,
      isOfficer,
      isUser,
      refreshToken: authService.refreshToken.bind(authService),
      verifyToken: authService.verifyToken.bind(authService)
    }}>
      {children}
    </AuthContext.Provider>
  ); 
      register, 
      logout, 
      getUserRole, 
      isAdmin, 
      isOfficer, 
      isUser,
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
