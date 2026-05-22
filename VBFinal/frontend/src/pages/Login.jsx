import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useMaintenanceMode } from '../contexts/MaintenanceContext';
import authService from '../services/auth';

const normalizeApiBase = (rawBase) => {
  const trimmed = (rawBase || '/api').trim().replace(/\/+$/, '');
  if (trimmed === '/api' || trimmed.endsWith('/api')) {
    return trimmed;
  }
  return `${trimmed}/api`;
};

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

const Login = () => {
  const { isDark } = useTheme();
  const { scheduledMaintenance, isMaintenanceMode } = useMaintenanceMode();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Check for Microsoft auth errors in URL
  useEffect(() => {
    const urlError = searchParams.get('error');
    const errorDetail = searchParams.get('detail');

    if (urlError) {
      const errorMessages = {
        'auth_failed': 'Social authentication failed. Please try again.',
        'token_exchange_failed': 'Failed to exchange authorization code. Please try again.',
        'user_info_failed': 'Failed to get user information from provider.',
        'no_email': 'No email found in social account.',
        'no_code': 'No authorization code received from provider.'
      };

      let errorMsg = errorMessages[urlError] || 'Authentication failed. Please try again.';
      if (errorDetail) {
        errorMsg += ` (${errorDetail})`;
      }

      setError(errorMsg);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if maintenance mode is enabled and user is not admin
      const loginId = formData.identifier.trim().toLowerCase();
      const isAdminIdentifier = loginId.includes('admin@') || loginId === 'admin';
      if (isMaintenanceMode && !isAdminIdentifier) {
        setError('System is currently under maintenance. Only administrators can access the system.');
        setLoading(false);
        return;
      }

      // Perform actual login through AuthContext
      await login(formData.identifier.trim(), formData.password);
      const roleRoute = authService.getRoleBasedRoute();
      navigate(roleRoute);
    } catch (error) {
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-gradient-to-br from-gray-900 to-gray-800' : 'bg-gradient-to-br from-blue-50 via-white to-blue-50'}`}>
      {/* Left Side - University Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 to-indigo-900">
          <div className="absolute inset-0 bg-black/20" />
          {/* Decorative pattern */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <svg className="w-full h-full" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="1000" height="1000" fill="url(#grid)" />
            </svg>
          </div>
        </div>
        
        {/* University Logo and Text */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-12 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="flex justify-center mb-6">
              <img
                src="/uog.png"
                alt="University of Gondar Logo"
                className="h-32 w-32 object-contain bg-white rounded-2xl p-3 shadow-2xl"
              />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">University of Gondar</h1>
            <p className="text-xl text-blue-100 mb-2">Complaint Management and</p>
            <p className="text-xl text-blue-100">Feedback Tracking System</p>
            <div className="mt-8 pt-6 border-t border-white/20">
              <p className="text-sm text-blue-200">
                ጎንደር ዩኒቨርሲቲ የቅሬታ አያያዝ ሥርዓት
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Home Page Link */}
          <div className="text-center">
            <Link 
              to="/" 
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>

          {/* Mobile University Logo (visible only on mobile) */}
          <div className="lg:hidden text-center">
            <div className="inline-block p-4 bg-white rounded-2xl shadow-lg">
              <img
                src="/uog.png"
                alt="University of Gondar"
                className="h-20 w-20 object-contain"
              />
            </div>
            <h2 className="mt-4 text-xl font-bold text-gray-800 dark:text-white">University of Gondar</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Complaint Management System</p>
          </div>

          {/* Scheduled Maintenance Notification */}
          {scheduledMaintenance && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-yellow-600 text-lg">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    Scheduled Maintenance
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    {scheduledMaintenance.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active Maintenance Mode Notification */}
          {isMaintenanceMode && (
            <div className="bg-red-50 border-l-4 border-red-400 rounded-lg p-4 dark:bg-red-900/20 dark:border-red-600">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-600 text-lg">🚫</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                    Maintenance Mode Active
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    System is currently under maintenance. Only administrators can log in.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Login Form Card */}
          <div className={`${isDark ? 'bg-gray-800/80 backdrop-blur-sm border-gray-700' : 'bg-white/80 backdrop-blur-sm border-gray-200'} p-8 rounded-2xl shadow-2xl border`}>
            <div className="text-center mb-8">
              <h3 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Welcome Back
              </h3>
              <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Sign in to access your account
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-lg dark:bg-red-900/20 dark:text-red-300">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="identifier" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email or Username
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  value={formData.identifier}
                  onChange={handleChange}
                  className={`mt-1 block w-full px-4 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                  placeholder="Enter your email or username"
                />
              </div>

              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-4 py-3 pr-12 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <svg className={`h-5 w-5 ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className={`h-5 w-5 ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="rememberMe" className={`ml-2 block text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Remember me
                  </label>
                </div>

                <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing In...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className={`w-full border-t ${isDark ? 'border-gray-600' : 'border-gray-300'}`}></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className={`px-3 ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
                    Or continue with
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.location.href = `${API_BASE}/accounts/microsoft/login/`}
                className={`w-full flex items-center justify-center py-3 px-4 rounded-xl border-2 transition-all duration-200 shadow-sm hover:shadow-md group ${isDark
                  ? 'border-gray-600 bg-[#2F2F2F] hover:bg-[#383838] text-white'
                  : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                  }`}
              >
                <div className="flex items-center font-semibold">
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  <span>Sign in with Microsoft Account</span>
                </div>
              </button>

              <div className="text-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  © 2024 University of Gondar. All rights reserved.
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Secure Login • Protected by SSL Encryption
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;