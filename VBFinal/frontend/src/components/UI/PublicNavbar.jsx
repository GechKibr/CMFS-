import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const PublicNavbar = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout, getUserRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Features', path: '/#features' },
    { name: 'Workflow', path: '/#workflow' },
  ];
  
  const showPublicLinks = !user;

  const getDashboardPath = () => {
    const role = getUserRole();
    if (role === 'admin') return '/admin';
    if (role === 'officer') return '/officer';
    return '/user';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user?.first_name || '';
    const lastName = user?.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const handleNavClick = (e, path) => {
    e.preventDefault();
    if (path === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (path.includes('#')) {
      const hash = path.split('#')[1];
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setMobileMenuOpen(false);
  };

  // NEUTRAL HEADER CLASSES - No blue borders
  const headerClasses = isDark
    ? 'bg-slate-950/90 border-slate-800'
    : 'bg-white/90 border-gray-200';
  
  // NEUTRAL ICON BUTTONS - No blue hover
  const iconButtonClasses = isDark
    ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    : 'text-slate-600 hover:bg-gray-100 hover:text-slate-900';
  
  // NEUTRAL NAVIGATION LINKS - No gradient, just clean gray
  const navLinkClasses = `px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 
    ${isDark 
      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' 
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;
  
  // NEUTRAL USER MENU - No blue
  const userMenuTriggerClasses = isDark
    ? 'hover:bg-slate-800'
    : 'hover:bg-gray-100';
  
  // NEUTRAL DIVIDER
  const dividerClasses = isDark ? 'bg-slate-700' : 'bg-gray-300';
  
  // NEUTRAL AVATAR BACKGROUND
  const avatarClasses = isDark
    ? 'bg-slate-700 text-slate-200'
    : 'bg-gray-200 text-gray-700';

  return (
    <header className={`${headerClasses} backdrop-blur-md shadow-md border-b fixed top-0 left-0 right-0 z-50`}>
      <nav className="px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        {/* Logo - LEFT SIDE */}
        <div className="flex items-center space-x-6 min-w-0">
          <button
            onClick={() => navigate(user ? getDashboardPath() : '/login')}
            className={`p-2.5 rounded-lg transition-all duration-200 ${iconButtonClasses}`}
            title={user ? 'Go to Dashboard' : 'Sign In'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity duration-200" onClick={() => navigate('/')}>
            <div className="flex items-center space-x-3.5">
              {/* NEUTRAL LOGO ICON - No gradient */}
              <div className={`p-2.5 rounded-lg shadow-md ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`}>
                <svg className={`w-6 h-6 ${isDark ? 'text-slate-200' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>CMTS</h1>
                <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Service System</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items - RIGHT SIDE - Neutral colors */}
        {showPublicLinks && (
          <div className="hidden lg:flex items-center space-x-1 ml-auto">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.path}
                onClick={(e) => handleNavClick(e, item.path)}
                className={navLinkClasses}
              >
                {item.name}
              </a>
            ))}
          </div>
        )}

        {/* Right Side Controls */}
        <div className="flex items-center space-x-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`lg:hidden p-2.5 rounded-lg transition-all duration-200 ${iconButtonClasses}`}
            title="Toggle Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-lg transition-all duration-200 ${iconButtonClasses}`}
            title="Toggle Theme"
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          <div className={`hidden sm:block h-8 ${dividerClasses}`} style={{ width: '1px' }}></div>

          {/* User Menu or Sign In Button - NEUTRAL Sign In button */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${userMenuTriggerClasses}`}
              >
                <div className={`w-9 h-9 ${avatarClasses} rounded-full flex items-center justify-center text-sm font-bold shadow-sm`}>
                  {getUserInitials()}
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {user?.first_name || 'User'}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Member'}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 ${isDark ? 'text-gray-500' : 'text-gray-500'} transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {dropdownOpen && (
                <div className={`absolute right-0 mt-3 w-56 rounded-xl shadow-xl py-2 z-50 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} backdrop-blur-sm`}>
                  <div className={`px-5 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Account
                    </p>
                    <p className={`text-sm font-medium mt-1.5 ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                      {user.first_name} {user.last_name}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'} mt-1`}>
                      {user.email}
                    </p>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => { navigate(getDashboardPath()); setDropdownOpen(false); }}
                      className={`flex items-center w-full px-5 py-2.5 text-sm font-medium transition-colors duration-150 ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Profile Settings
                    </button>
                  </div>
                  <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'} py-2`}>
                    <button
                      onClick={() => { handleLogout(); setDropdownOpen(false); }}
                      className={`flex items-center w-full px-5 py-2.5 text-sm font-medium transition-colors duration-150 ${isDark ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300' : 'text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                    >
                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            location.pathname !== '/login' && (
              <button
                onClick={() => navigate('/login')}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg 
                  ${isDark 
                    ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' 
                    : 'bg-gray-800 text-white hover:bg-gray-900'}`}
              >
                Sign In
              </button>
            )
          )}
        </div>
      </nav>

      {/* Mobile Menu - Neutral colors */}
      {showPublicLinks && (
        <div className={`lg:hidden absolute top-full left-0 right-0 px-6 sm:px-8 pb-4 border-t shadow-md ${isDark ? 'border-slate-800 bg-slate-950/95' : 'border-gray-200 bg-white/95'} ${mobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.path}
                onClick={(e) => { handleNavClick(e, item.path); setMobileMenuOpen(false); }}
                className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 text-center
                  ${isDark 
                    ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {item.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNavbar;