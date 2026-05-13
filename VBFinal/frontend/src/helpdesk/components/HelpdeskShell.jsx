import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import DashboardNavbar from '../../components/UI/DashboardNavbar';
import Sidebar from '../../components/UI/Sidebar';
import { OFFICER_NAV_ITEMS, getUserNavItems } from '../../constants/navigation';

const ADMIN_NAV_ITEMS = [
  { id: 'overview', name: 'Dashboard', icon: '📊' },
  { id: 'complaints', name: 'Complaints', icon: '📝' },
  { id: 'institutions', name: 'Institutions', icon: '🏛️' },
  { id: 'users', name: 'Users', icon: '👤' },
  { id: 'feedback-templates', name: 'Feedback Templates', icon: '📋' },
  // { id: 'contact', name: 'Contact', icon: '✉️' },
  { id: 'system', name: 'System', icon: '⚙️' },
  { id: 'helpdesk', name: 'Helpdesk', icon: '🎧' },
];

const HelpdeskShell = ({
  children,
  contentClassName = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8',
  showChrome = true,
}) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { logout, getUserRole } = useAuth();
  const navigate = useNavigate();
  const role = getUserRole();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const menuItems = useMemo(() => {
    if (role === 'admin') return ADMIN_NAV_ITEMS;
    if (role === 'officer') return OFFICER_NAV_ITEMS;
    return getUserNavItems(t);
  }, [role, t]);

  const activeItem = 'helpdesk';

  const navigateToRolePage = (id) => {
    if (role === 'admin') {
      if (id === 'helpdesk') return navigate('/helpdesk', { replace: true });
      if (id === 'overview') return navigate('/admin', { replace: true });
      return navigate(`/admin?tab=${id}`, { replace: true });
    }

    if (role === 'officer') {
      if (id === 'helpdesk') return navigate('/helpdesk', { replace: true });
      if (id === 'dashboard') return navigate('/officer', { replace: true });
      if (id === 'profile') return navigate('/officer?tab=profile', { replace: true });
      return navigate(`/officer?tab=${id}`, { replace: true });
    }

    if (id === 'helpdesk') return navigate('/helpdesk', { replace: true });
    if (id === 'profile') return navigate('/user?tab=profile', { replace: true });
    return navigate(`/user?tab=${id}`, { replace: true });
  };

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setSidebarOpen((prev) => !prev);
  };

  const handleItemClick = (id) => {
    navigateToRolePage(id);
    setSidebarOpen(false);
  };

  const showBottomSection = role !== 'admin';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {showChrome ? (
        <>
          <DashboardNavbar onSidebarToggle={handleSidebarToggle} showLanguageToggle={role === 'user'} />

          <div className="flex pt-16">
            <Sidebar
              isOpen={sidebarOpen}
              isCollapsed={isDesktopSidebarCollapsed}
              items={menuItems}
              activeItem={activeItem}
              onItemClick={handleItemClick}
              onLogout={() => {
                logout();
                navigate('/login');
              }}
              onProfileClick={() => { }}
              onHideSidebar={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
              showBottomSection={showBottomSection}
            />

            {sidebarOpen && (
              <div
                className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20 top-16"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            <main className={`flex-1 ${isDesktopSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
              <div className={contentClassName}>{children}</div>
            </main>
          </div>
        </>
      ) : (
        <div className={contentClassName}>{children}</div>
      )}
    </div>
  );
};

export default HelpdeskShell;
