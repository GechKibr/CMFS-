import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

const PublicNavbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Home', path: '/landing' },
    { name: 'Features', path: '/landing#features' },
    { name: 'About', path: '/landing#about' },
    { name: 'Contact', path: '/landing#contact' },
  ];

  return (
    <header className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b sticky top-0 z-50`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/landing')}>
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  CMFS
                </h1>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Complaint Management & Feedback System
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.path}
                className={`text-sm font-medium transition-colors ${location.pathname === item.path || (item.path.includes('#') && location.pathname === '/landing')
                    ? isDark ? 'text-blue-400' : 'text-blue-600'
                    : isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                {item.name}
              </a>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              aria-label="Toggle theme"
            >
              {isDark ? '🌞' : '🌙'}
            </button>

            {/* Login Button */}
            {location.pathname !== '/login' && (
              <button
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden pb-4">
          <div className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.path}
                className={`text-sm font-medium px-3 py-2 rounded-lg transition-colors ${location.pathname === item.path
                    ? isDark ? 'bg-gray-700 text-blue-400' : 'bg-gray-100 text-blue-600'
                    : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {item.name}
              </a>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default PublicNavbar;
