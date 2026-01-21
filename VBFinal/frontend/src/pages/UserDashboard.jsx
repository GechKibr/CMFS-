import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import SubmitComplaint from '../components/User/SubmitComplaint';
import MyComplaints from '../components/User/MyComplaints';
import Notifications from '../components/User/Notifications';
import UserProfile from '../components/User/UserProfile';

const UserDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('submit');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNavbarDropdown, setShowNavbarDropdown] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all'
  });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(3);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [complaints, filters]);

  const loadData = async () => {
    try {
      const [complaintsData, institutionsData, categoriesData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getInstitutions(),
        apiService.getCategories()
      ]);
      
      setComplaints(complaintsData.results || complaintsData);
      setInstitutions(institutionsData.results || institutionsData);
      setCategories(categoriesData.results || categoriesData);
      
      setNotifications([
        { id: 1, type: 'success', message: 'Your complaint has been resolved', read: false },
        { id: 2, type: 'info', message: 'New update on your complaint', read: false },
        { id: 3, type: 'warning', message: 'Complaint requires additional information', read: true }
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = complaints;
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(c => c.category?.category_id === filters.category);
    }
    if (filters.priority !== 'all') {
      filtered = filtered.filter(c => c.priority === filters.priority);
    }
    
    setFilteredComplaints(filtered);
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      low: 'bg-green-500 text-white',
      medium: 'bg-yellow-500 text-white',
      high: 'bg-orange-500 text-white',
      urgent: 'bg-red-500 text-white'
    };
    return badges[priority] || 'bg-gray-500 text-white';
  };

  const renderTabContent = () => {
    if (submitSuccess) {
      return (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-3">
            <span className="text-white text-xs">✓</span>
          </div>
          <div>
            <h4 className="font-medium">Complaint Submitted Successfully!</h4>
            <p className="text-sm text-green-600">Your complaint has been received and will be processed shortly.</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'submit':
        return <SubmitComplaint institutions={institutions} setSubmitSuccess={setSubmitSuccess} />;
      case 'my-complaints':
        return (
          <MyComplaints 
            getStatusBadge={getStatusBadge}
            getPriorityBadge={getPriorityBadge}
          />
        );
      case 'notifications':
        return (
          <Notifications 
            setUnreadCount={setUnreadCount}
          />
        );
      case 'profile':
        return <UserProfile user={user} />;
      default:
        return <SubmitComplaint institutions={institutions} setSubmitSuccess={setSubmitSuccess} />;
    }
  };

  const menuItems = [
    { id: 'submit', name: t('submit_complaint'), icon: '📝' },
    { id: 'my-complaints', name: t('my_complaints'), icon: '📋' },
    { id: 'notifications', name: t('notifications'), icon: '🔔', badge: unreadCount },
    { id: 'profile', name: t('profile'), icon: '👤' }
  ];

  if (loading) {
    return (
      <div className={`flex h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'} items-center justify-center`}>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg transition-all duration-300 flex flex-col`}>
        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
          {sidebarOpen && (
            <div className="flex-1">
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Dashboard</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Complaint System</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors relative ${
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
              {sidebarOpen && (
                <>
                  <span className="font-medium">{item.name}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-700 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
          >
            <span className="text-lg">🚪</span>
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {menuItems.find(item => item.id === activeTab)?.name || 'Dashboard'}
              </h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Welcome back, {user?.first_name}!
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <button 
                onClick={toggleLanguage}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                {language === 'en' ? '🇪🇹' : '🇺🇸'}
              </button>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {getUserInitials()}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

export default UserDashboard;
