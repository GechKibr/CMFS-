import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import InstitutionManagement from '../components/Admin/InstitutionManagement';
import CategoryManagement from '../components/Admin/CategoryManagement';
import UserManagement from '../components/Admin/UserManagement';
import CategoryResolverManagement from '../components/Admin/CategoryResolverManagement';
import SystemManagement from '../components/Admin/SystemManagement';
import FeedbackTemplateManagement from '../components/Admin/FeedbackTemplateManagement';
import AdminComplaints from '../components/Admin/AdminComplaints';

const AdminDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNavbarDropdown, setShowNavbarDropdown] = useState(false);
  const [showSidebarDropdown, setShowSidebarDropdown] = useState(false);
  const [institutions, setInstitutions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    urgent: 0
  });
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user) return 'A';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'A';
  };

  useEffect(() => {
    loadData();
    loadSystemStats();
  }, []);

  const loadSystemStats = async () => {
    try {
      // Fetch all categories (handle pagination)
      let allCategories = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const categoriesData = await apiService.getCategories(page);
        if (categoriesData.results) {
          allCategories = [...allCategories, ...categoriesData.results];
          hasMore = !!categoriesData.next;
          page++;
        } else if (Array.isArray(categoriesData)) {
          allCategories = [...allCategories, ...categoriesData];
          hasMore = false;
        } else {
          hasMore = false;
        }
      }

      const [complaintsData, usersData, institutionsData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getAllUsers(),
        apiService.getInstitutions()
      ]);

      const complaints = complaintsData.results || complaintsData;
      const users = usersData.results || usersData;
      const institutions = institutionsData.results || institutionsData;
      const categories = allCategories;

      // Calculate resolution time
      const resolvedComplaints = complaints.filter(c => c.status === 'resolved');
      let avgResolutionDays = 0;
      if (resolvedComplaints.length > 0) {
        const totalDays = resolvedComplaints.reduce((sum, complaint) => {
          const created = new Date(complaint.created_at);
          const updated = new Date(complaint.updated_at);
          const diffDays = Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }, 0);
        avgResolutionDays = Math.round(totalDays / resolvedComplaints.length);
      }

      setSystemStats({
        totalComplaints: complaints.length,
        pendingComplaints: complaints.filter(c => c.status === 'pending').length,
        resolvedComplaints: complaints.filter(c => c.status === 'resolved').length,
        urgentComplaints: complaints.filter(c => c.priority === 'urgent').length,
        totalUsers: users.length,
        totalInstitutions: institutions.length,
        totalCategories: categories.length,
        avgResolutionTime: `${avgResolutionDays} days`,
        systemHealth: complaints.filter(c => c.status === 'pending').length > 10 ? 'Busy' : 'Good'
      });
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowNavbarDropdown(false);
        setShowSidebarDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [institutionsData, categoriesData, statsData] = await Promise.all([
        apiService.getInstitutions(),
        apiService.getCategories(),
        apiService.getDashboardStats()
      ]);
      
      setInstitutions(institutionsData);
      setCategories(categoriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { id: 'overview', name: 'Dashboard', icon: '📊' },
    { id: 'complaints', name: 'Complaints', icon: '📝' },
    { id: 'institutions', name: 'Institutions', icon: '🏛️' },
    { id: 'categories', name: 'Categories', icon: '📂' },
    { id: 'category-resolvers', name: 'Assignments', icon: '👥' },
    { id: 'users', name: 'Users', icon: '👤' },
    { id: 'feedback-templates', name: 'Feedback Templates', icon: '📋' },
    { id: 'system', name: 'System', icon: '⚙️' }
  ];

  const [systemStats, setSystemStats] = useState({
    totalComplaints: 0,
    pendingComplaints: 0,
    resolvedComplaints: 0,
    urgentComplaints: 0,
    totalUsers: 0,
    totalInstitutions: 0,
    totalCategories: 0,
    avgResolutionTime: '0 days',
    systemHealth: 'Good'
  });

  const renderOverview = () => {
    return (
      <div className="space-y-6">
        {/* System Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">📝</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Complaints</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.totalComplaints}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">⏳</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Pending</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.pendingComplaints}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Resolved</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.resolvedComplaints}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">🚨</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Urgent</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.urgentComplaints}</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">👥</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Users</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">🏛️</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Institutions</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.totalInstitutions}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-teal-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-lg">📂</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Categories</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.totalCategories}</p>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 ${systemStats.systemHealth === 'Good' ? 'bg-green-500' : 'bg-orange-500'} rounded-md flex items-center justify-center`}>
                  <span className="text-white text-lg">💚</span>
                </div>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>System Health</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.systemHealth}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Resolution Performance
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Average Resolution Time</span>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{systemStats.avgResolutionTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Resolution Rate</span>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {systemStats.totalComplaints > 0 
                    ? Math.round((systemStats.resolvedComplaints / systemStats.totalComplaints) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pending Rate</span>
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {systemStats.totalComplaints > 0 
                    ? Math.round((systemStats.pendingComplaints / systemStats.totalComplaints) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Recent Activity
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.resolvedComplaints} complaints resolved this month
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.totalUsers} active users in system
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.pendingComplaints} complaints awaiting review
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {systemStats.urgentComplaints} urgent complaints require attention
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'complaints':
        return <AdminComplaints />;
      case 'institutions':
        return <InstitutionManagement />;
      case 'categories':
        return <CategoryManagement />;
      case 'category-resolvers':
        return <CategoryResolverManagement />;
      case 'users':
        return <UserManagement />;
      case 'feedback-templates':
        return <FeedbackTemplateManagement />;
      case 'system':
        return <SystemManagement />;
      default:
        return (
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-neutral">{menuItems.find(t => t.id === activeTab)?.name}</h3>
            <p className="text-neutral mt-2">Content for {activeTab} will be implemented here.</p>
          </div>
        );
    }
  };

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg transition-all duration-300 flex flex-col`}>
        {/* Header */}
        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
          {sidebarOpen && (
            <div className="flex-1">
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Admin Panel</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Complaint System</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'} ${!sidebarOpen ? 'mx-auto' : ''}`}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === item.id
                  ? isDark 
                    ? 'bg-blue-900 text-blue-300'
                    : 'bg-blue-50 text-blue-700'
                  : isDark
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="font-medium">{item.name}</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {sidebarOpen ? (
            <div className="relative dropdown-container">
              <button
                onClick={() => setShowSidebarDropdown(!showSidebarDropdown)}
                className="w-full flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-2 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {getUserInitials()}
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {user?.email}
                  </p>
                </div>
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>⋮</span>
              </button>
              {showSidebarDropdown && (
                <div className={`absolute bottom-full left-0 right-0 mb-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-50`}>
                  <button
                    onClick={handleLogout}
                    className={`w-full text-left px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors rounded-lg`}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative dropdown-container">
              <button
                onClick={() => setShowSidebarDropdown(!showSidebarDropdown)}
                className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto hover:bg-blue-600 transition-colors"
              >
                {getUserInitials()}
              </button>
              {showSidebarDropdown && (
                <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-50 w-32`}>
                  <button
                    onClick={handleLogout}
                    className={`w-full text-left px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors rounded-lg`}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {menuItems.find(item => item.id === activeTab)?.name || 'Dashboard'}
              </h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Manage your complaint management system
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <button className={`p-2 transition-colors ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                🔔
              </button>
              <div className="relative dropdown-container">
                <button
                  onClick={() => setShowNavbarDropdown(!showNavbarDropdown)}
                  className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold hover:bg-blue-600 transition-colors"
                >
                  {getUserInitials()}
                </button>
                {showNavbarDropdown && (
                  <div className={`absolute right-0 mt-2 w-48 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-lg shadow-lg z-50`}>
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {user?.first_name} {user?.last_name}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className={`w-full text-left px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} transition-colors`}
                    >
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className={`flex-1 overflow-y-auto px-6 py-6 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</div>
              </div>
            </div>
          ) : (
            renderTabContent()
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
