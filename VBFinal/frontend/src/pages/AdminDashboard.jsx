import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';
import ApiTest from '../components/ApiTest';
import ResolverLevelManagement from '../components/Admin/ResolverLevelManagement';
import CategoryResolverManagement from '../components/Admin/CategoryResolverManagement';
import InstitutionManagement from '../components/Admin/InstitutionManagement';
import CategoryManagement from '../components/Admin/CategoryManagement';

const AdminDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [institutions, setInstitutions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    resolved: 0,
    urgent: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
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
    { id: 'resolver-levels', name: 'Resolver Levels', icon: '⚡' },
    { id: 'category-resolvers', name: 'Assignments', icon: '👥' },
    { id: 'users', name: 'Users', icon: '👤' },
    { id: 'ai-settings', name: 'AI Settings', icon: '🤖' },
    { id: 'system', name: 'System', icon: '⚙️' }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <ApiTest />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-neutral">Total Complaints</h3>
          <p className="text-3xl font-bold text-primary mt-2">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-neutral">Pending</h3>
          <p className="text-3xl font-bold text-warning mt-2">{stats.pending}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-neutral">Resolved</h3>
          <p className="text-3xl font-bold text-success mt-2">{stats.resolved}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-neutral">Urgent</h3>
          <p className="text-3xl font-bold text-error mt-2">{stats.urgent}</p>
        </div>
      </div>
    </div>
  );

  const renderInstitutions = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-neutral">Institutions</h3>
          <button className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-800">
            Add Institution
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {institutions.map((institution) => (
              <tr key={institution.id}>
                <td className="px-6 py-4 text-sm text-neutral">{institution.name}</td>
                <td className="px-6 py-4 text-sm text-neutral">{institution.domain}</td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button className="text-primary hover:text-blue-800">Edit</button>
                  <button className="text-error hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {institutions.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No institutions found
          </div>
        )}
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-neutral">Categories</h3>
          <button className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-800">
            Add Category
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map((category) => (
              <tr key={category.category_id}>
                <td className="px-6 py-4 text-sm text-neutral">{category.name}</td>
                <td className="px-6 py-4 text-sm text-neutral">{category.description}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    category.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {category.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button className="text-primary hover:text-blue-800">Edit</button>
                  <button className="text-error hover:text-red-600">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No categories found
          </div>
        )}
      </div>
    </div>
  );

  const renderAISettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-neutral mb-4">AI Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-neutral">Automatic Category Detection</span>
            <button className="bg-success text-white px-3 py-1 rounded text-sm">ON</button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral">Automatic Officer Assignment</span>
            <button className="bg-error text-white px-3 py-1 rounded text-sm">OFF</button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral">Assignment Strategy</span>
            <select className="border rounded px-3 py-1">
              <option>Round Robin</option>
              <option>Workload Based</option>
              <option>Random</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-neutral mb-4">Priority Detection</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span className="bg-error text-white px-2 py-1 rounded text-xs">URGENT</span>
            <span className="text-sm text-neutral">emergency, urgent, critical, immediate</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-warning text-white px-2 py-1 rounded text-xs">HIGH</span>
            <span className="text-sm text-neutral">important, high priority, asap</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'institutions':
        return <InstitutionManagement />;
      case 'categories':
        return <CategoryManagement />;
      case 'resolver-levels':
        return <ResolverLevelManagement />;
      case 'category-resolvers':
        return <CategoryResolverManagement />;
      case 'ai-settings':
        return renderAISettings();
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
        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Admin Panel</h2>
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
                    ? 'bg-blue-900 text-blue-300 border-r-2 border-blue-400'
                    : 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : isDark
                    ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span className="font-medium">{item.name}</span>}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {sidebarOpen ? (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                A
              </div>
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Admin User</p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>admin@system.com</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto">
              A
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
              <button className={`p-2 transition-colors ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                ⚙️
              </button>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                A
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className={`flex-1 overflow-y-auto p-6`}>
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
