import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const OfficerDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('assigned');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNavbarDropdown, setShowNavbarDropdown] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all'
  });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    assigned: 0,
    resolved: 0,
    pending: 0,
    urgent: 0
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user) return 'O';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'O';
  };

  const menuItems = [
    { id: 'assigned', name: 'Assigned Complaints', icon: '📋' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'history', name: 'History', icon: '📊' },
    { id: 'settings', name: 'Settings', icon: '⚙️' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowNavbarDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [complaints, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const complaintsData = await apiService.getComplaints();
      const complaintsArray = complaintsData.results || complaintsData;
      
      // Filter complaints for current officer
      const assignedComplaints = complaintsArray.filter(complaint => {
        // Direct assignment to this officer
        const directlyAssigned = complaint.assigned_officer?.id === user?.id || 
                                complaint.assigned_officer === user?.id;
        
        // Previously handled by this officer (escalated complaints they worked on)
        const previouslyHandled = complaint.status === 'escalated' && 
                                 complaint.assignments?.some(assignment => 
                                   assignment.officer?.id === user?.id || assignment.officer === user?.id
                                 );
        
        return directlyAssigned || previouslyHandled;
      });
      
      setComplaints(assignedComplaints);
      
      // Calculate stats
      const stats = {
        assigned: assignedComplaints.length,
        resolved: assignedComplaints.filter(c => c.status === 'resolved').length,
        pending: assignedComplaints.filter(c => c.status === 'pending' || c.status === 'escalated').length,
        urgent: assignedComplaints.filter(c => c.priority === 'urgent').length
      };
      setStats(stats);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    if (!Array.isArray(complaints)) return;
    
    let filtered = complaints;
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(c => c.category?.name === filters.category);
    }
    if (filters.priority !== 'all') {
      filtered = filtered.filter(c => c.priority === filters.priority);
    }
    
    setFilteredComplaints(filtered);
  };

  const getStatusBadge = (status) => {
    const badges = {
      resolved: 'bg-green-100 text-green-800',
      urgent: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      escalated: 'bg-purple-100 text-purple-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      urgent: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-green-500 text-white'
    };
    return badges[priority] || 'bg-gray-500 text-white';
  };

  const updateComplaintStatus = async (complaintId, newStatus) => {
    try {
      await apiService.updateComplaint(complaintId, { status: newStatus });
      await loadData();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const escalateComplaint = async (complaintId) => {
    try {
      const result = await apiService.escalateComplaint(complaintId);
      alert('Complaint escalated successfully to the next level.');
      await loadData(); // Reload complaints to update the list
      setShowModal(false);
    } catch (error) {
      console.error('Failed to escalate:', error);
      alert('Failed to escalate complaint. It may already be at the highest level.');
    }
  };

  const renderAssignedComplaints = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow`}>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`border rounded px-3 py-1 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="escalated">Escalated</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
              className={`border rounded px-3 py-1 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Priority</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaints Table */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>ID</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Title</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Category</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Status</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Priority</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Date</th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {Array.isArray(filteredComplaints) && filteredComplaints.map((complaint) => (
                <tr key={complaint.complaint_id} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {complaint.complaint_id?.slice(0, 8)}...
                  </td>
                  <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    <div className="max-w-xs truncate">{complaint.title}</div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-900'}`}>
                    {complaint.category?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(complaint.status)}`}>
                        {complaint.status}
                      </span>
                      {complaint.status === 'escalated' && (
                        <span className="text-orange-500 text-xs" title="Escalated complaint">
                          ⬆️
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadge(complaint.priority)}`}>
                      {complaint.priority}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                    {new Date(complaint.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => {
                        setSelectedComplaint(complaint);
                        setShowModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!Array.isArray(filteredComplaints) || filteredComplaints.length === 0) && (
            <div className={`p-6 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              No complaints found
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-4">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow border-l-4 border-red-500`}>
        <div className="flex items-center">
          <span className="text-red-500 text-lg mr-3">🚨</span>
          <div>
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Urgent Complaint Assigned</h4>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>New urgent complaint requires immediate attention</p>
          </div>
        </div>
      </div>
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow border-l-4 border-yellow-500`}>
        <div className="flex items-center">
          <span className="text-yellow-500 text-lg mr-3">⏰</span>
          <div>
            <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Escalation Deadline Approaching</h4>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Complaint #12345 deadline in 2 hours</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Resolved Complaints</h3>
          <p className="text-3xl font-bold text-green-500 mt-2">{stats.resolved}</p>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Avg Resolution Time</h3>
          <p className="text-3xl font-bold text-blue-500 mt-2">2.5 days</p>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Escalations</h3>
          <p className="text-3xl font-bold text-orange-500 mt-2">3</p>
        </div>
      </div>

      {/* Recent History */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
        <div className="p-6 border-b border-gray-200">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Resolutions</h3>
        </div>
        <div className="p-6">
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>History data will be displayed here</p>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>Officer Settings</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email Notifications</span>
          <button className="bg-green-500 text-white px-3 py-1 rounded text-sm">ON</button>
        </div>
        <div className="flex items-center justify-between">
          <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Auto-assign New Complaints</span>
          <button className="bg-red-500 text-white px-3 py-1 rounded text-sm">OFF</button>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'assigned':
        return renderAssignedComplaints();
      case 'notifications':
        return renderNotifications();
      case 'history':
        return renderHistory();
      case 'settings':
        return renderSettings();
      default:
        return renderAssignedComplaints();
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
              <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Officer Panel</h2>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Complaint Management</p>
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

        {/* Stats */}
        <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {sidebarOpen && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Assigned</span>
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stats.assigned}</span>
              </div>
              <div className="flex justify-between">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Urgent</span>
                <span className="text-sm font-bold text-red-500">{stats.urgent}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {menuItems.find(item => item.id === activeTab)?.name || 'Dashboard'}
              </h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Manage your assigned complaints
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
              <div className="flex items-center space-x-2">
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Officer:</span>
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
          </div>
        </header>

        {/* Content */}
        <main className={`flex-1 overflow-y-auto px-6 py-6`}>
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

      {/* Modal for complaint details */}
      {showModal && selectedComplaint && (
        <ComplaintModal 
          complaint={selectedComplaint}
          onClose={() => setShowModal(false)}
          onUpdateStatus={updateComplaintStatus}
          onEscalate={escalateComplaint}
          isDark={isDark}
        />
      )}
    </div>
  );
};

// Complaint Modal Component
const ComplaintModal = ({ complaint, onClose, onUpdateStatus, onEscalate, isDark }) => {
  const { user } = useAuth();
  const [newResponse, setNewResponse] = useState('');
  const [responseTitle, setResponseTitle] = useState('');
  const [responseType, setResponseType] = useState('update');
  const [comments, setComments] = useState([]);
  const [responses, setResponses] = useState([]);
  const [editingResponse, setEditingResponse] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');

  useEffect(() => {
    loadComments();
    loadResponses(complaint?.complaint_id);
  }, [complaint?.complaint_id]);

  const loadComments = async () => {
    try {
      const commentsData = await apiService.getComplaintComments(complaint.complaint_id);
      setComments(commentsData.results || commentsData || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
      setComments([]);
    }
  };

  const loadResponses = async (complaintId) => {
    try {
      const responsesData = await apiService.getComplaintResponses(complaintId || complaint?.complaint_id);
      setResponses(responsesData.results || responsesData || []);
    } catch (error) {
      console.error('Failed to load responses:', error);
      setResponses([]);
    }
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      urgent: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-green-500 text-white'
    };
    return badges[priority] || 'bg-gray-500 text-white';
  };

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'escalated', label: 'Escalated' }
  ];

  const responseTypeOptions = [
    { value: 'initial', label: 'Initial Response' },
    { value: 'update', label: 'Status Update' },
    { value: 'resolution', label: 'Final Resolution' },
    { value: 'escalation', label: 'Escalation Response' }
  ];

  const addResponse = async () => {
    if (!newResponse.trim() || !responseTitle.trim()) {
      alert('Please fill in both title and message');
      return;
    }
    
    try {
      await apiService.createResponse({
        complaint: complaint.complaint_id,
        title: responseTitle,
        message: newResponse,
        response_type: responseType,
        is_public: true
      });
      setNewResponse('');
      setResponseTitle('');
      setResponseType('update');
      await loadResponses(complaint.complaint_id);
    } catch (error) {
      console.error('Failed to add response:', error);
      alert('Failed to add response. Please try again.');
    }
  };

  const editResponse = async (responseId, newTitle, newMessage) => {
    try {
      await apiService.updateResponse(responseId, {
        title: newTitle,
        message: newMessage
      });
      setEditingResponse(null);
      await loadResponses(complaint.complaint_id);
    } catch (error) {
      console.error('Failed to update response:', error);
      alert('Failed to update response.');
    }
  };

  const deleteResponse = async (responseId) => {
    if (!confirm('Are you sure you want to delete this response?')) return;
    
    try {
      await apiService.deleteResponse(responseId);
      await loadResponses(complaint.complaint_id);
    } catch (error) {
      console.error('Failed to delete response:', error);
      alert('Failed to delete response.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Complaint Details
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Complaint ID
              </label>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {complaint.complaint_id}
              </p>
            </div>
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Submitted By
              </label>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {complaint.submitted_by?.username || 'N/A'}
              </p>
            </div>
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Category
              </label>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {complaint.category?.name || 'N/A'}
              </p>
            </div>
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                Priority
              </label>
              <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadge(complaint.priority)}`}>
                {complaint.priority}
              </span>
            </div>
          </div>

          {/* Title and Description */}
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Title
            </label>
            <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {complaint.title}
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Description
            </label>
            <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
              {complaint.description}
            </p>
          </div>

          {/* Status Update */}
          <div className="flex flex-wrap gap-4">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Update Status
              </label>
              <select
                defaultValue={complaint.status}
                onChange={(e) => onUpdateStatus(complaint.complaint_id, e.target.value)}
                className={`border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => onEscalate(complaint.complaint_id)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded transition-colors flex items-center space-x-2"
                title="Escalate to next level officer"
              >
                <span>⬆️</span>
                <span>Escalate to Higher Level</span>
              </button>
            </div>
          </div>

          {/* Response Section */}
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Add Response
            </label>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <select
                    value={responseType}
                    onChange={(e) => setResponseType(e.target.value)}
                    className={`w-full border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    {responseTypeOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    value={responseTitle}
                    onChange={(e) => setResponseTitle(e.target.value)}
                    placeholder="Response title..."
                    className={`w-full border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                  />
                </div>
              </div>
              <div className="flex space-x-2">
                <textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Write your response..."
                  className={`flex-1 border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                  rows="3"
                />
                <button
                  onClick={addResponse}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
                >
                  Add Response
                </button>
              </div>
            </div>
          </div>

          {/* Existing Responses */}
          <div>
            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Responses
            </h4>
            <div className="space-y-3">
              {responses.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  No responses yet
                </p>
              ) : (
                responses.map((response, index) => (
                  <div key={index} className={`p-4 rounded border-l-4 ${
                    response.response_type === 'resolution' ? 'border-green-500' :
                    response.response_type === 'escalation' ? 'border-red-500' :
                    response.response_type === 'initial' ? 'border-blue-500' :
                    'border-yellow-500'
                  } ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <h5 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {editingResponse === response.id ? (
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className={`w-full border rounded px-2 py-1 ${isDark ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300'}`}
                          />
                        ) : (
                          response.title
                        )}
                      </h5>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          response.response_type === 'resolution' ? 'bg-green-100 text-green-800' :
                          response.response_type === 'escalation' ? 'bg-red-100 text-red-800' :
                          response.response_type === 'initial' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {response.response_type}
                        </span>
                        {response.responder?.id === user?.id && (
                          <div className="flex space-x-1">
                            {editingResponse === response.id ? (
                              <>
                                <button
                                  onClick={() => editResponse(response.id, editTitle, editMessage)}
                                  className="text-green-600 hover:text-green-800 text-xs"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingResponse(null)}
                                  className="text-gray-600 hover:text-gray-800 text-xs"
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingResponse(response.id);
                                    setEditTitle(response.title);
                                    setEditMessage(response.message);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => deleteResponse(response.id)}
                                  className="text-red-600 hover:text-red-800 text-xs"
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mb-2">
                      {editingResponse === response.id ? (
                        <textarea
                          value={editMessage}
                          onChange={(e) => setEditMessage(e.target.value)}
                          className={`w-full border rounded px-2 py-1 ${isDark ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300'}`}
                          rows="3"
                        />
                      ) : (
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {response.message}
                        </p>
                      )}
                    </div>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      By {response.responder?.first_name || 'Officer'} - {new Date(response.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Internal Comments
            </label>
            <div className="space-y-2">
              {comments.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  No internal comments yet
                </p>
              ) : (
                comments.map((comment, index) => (
                  <div key={index} className={`p-3 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      {comment.message || comment.comment}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                      By {comment.author?.first_name || comment.author?.name || 'Officer'} - {new Date(comment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfficerDashboard;
