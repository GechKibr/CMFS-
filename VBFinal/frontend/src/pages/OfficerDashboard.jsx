import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FeedbackFormBuilder, FeedbackAnalytics } from '../components/feedback';
import MaintenanceNotification from '../components/UI/MaintenanceNotification';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import apiService from '../services/api';
import OfficerSchedule from '../components/Officer/OfficerSchedule';
import OfficerProfile from '../components/Officer/OfficerProfile';
import PublicAnnouncementBoard from '../components/Officer/PublicAnnouncementBoard';

const OfficerDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [responseText, setResponseText] = useState('');
  const [responses, setResponses] = useState([]);
  const [comments, setComments] = useState([]);
  const [editingResponse, setEditingResponse] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({
    assignedComplaints: 0,
    resolvedComplaints: 0,
    pendingComplaints: 0,
    totalTemplates: 0
  });
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignOfficerId, setReassignOfficerId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [officers, setOfficers] = useState([]);

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'complaints', name: 'Manage Complaints', icon: '📋' },
    { id: 'announcements', name: 'Public Announcements', icon: '📢' },
    { id: 'schedule', name: 'Schedule', icon: '📅' },
    { id: 'create-template', name: 'Create Template', icon: '➕' },
    { id: 'manage-templates', name: 'Manage Templates', icon: '📝' },
    { id: 'analytics', name: 'Analytics', icon: '📈' },
    { id: 'profile', name: 'Profile', icon: '👤' },
  ];

  useEffect(() => {
    if (activeTab === 'manage-templates') {
      fetchTemplates();
    }
    if (activeTab === 'complaints') {
      fetchComplaints();
    }
    if (activeTab === 'dashboard') {
      fetchDashboardStats();
      fetchTemplates();
    }
  }, [activeTab]);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch complaints to calculate stats
      const complaintsResponse = await fetch('/api/complaints/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (complaintsResponse.ok) {
        const complaintsData = await complaintsResponse.json();
        const allComplaints = complaintsData.results || complaintsData;
        
        // Calculate stats
        const assignedComplaints = allComplaints.filter(c => c.assigned_to?.id === user?.id).length;
        const resolvedComplaints = allComplaints.filter(c => c.assigned_to?.id === user?.id && c.status === 'resolved').length;
        const pendingComplaints = allComplaints.filter(c => c.assigned_to?.id === user?.id && c.status === 'pending').length;
        
        setDashboardStats({
          assignedComplaints,
          resolvedComplaints,
          pendingComplaints,
          totalTemplates: Array.isArray(templates) ? templates.length : 0
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No access token found - user may need to login');
        setTemplates([]);
        return;
      }

      const response = await fetch('/api/feedback/templates/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        console.error('Authentication failed - token may be expired');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setTemplates(Array.isArray(data) ? data : data.results || []);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };



  const fetchComplaints = async () => {
    setComplaintsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No access token found - user may need to login');
        setComplaints([]);
        return;
      }

      const response = await fetch('/api/complaints/', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        console.error('Authentication failed - token may be expired');
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        const data = await response.json();
        // Filter complaints assigned to current user only
        const assignedComplaints = (Array.isArray(data) ? data : data.results || [])
          .filter(complaint => complaint.assigned_officer?.id === user?.id);
        setComplaints(assignedComplaints);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  };

  const fetchOfficers = async () => {
    try {
      const usersData = await apiService.getAllUsers();
      const allUsers = Array.isArray(usersData?.results)
        ? usersData.results
        : Array.isArray(usersData)
          ? usersData
          : [];

      const officerUsers = allUsers.filter((u) => {
        const role = (u.role || '').toString().toLowerCase();
        return role === 'officer' || role.includes('officer') || u.is_staff === true;
      });

      setOfficers(officerUsers.length > 0 ? officerUsers : allUsers);
    } catch (error) {
      console.error('Error fetching officers:', error);
      setOfficers([]);
    }
  };

  const handleReassign = async () => {
    if (!reassignOfficerId) {
      alert('Please select an officer to reassign to');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/complaints/${selectedComplaint.complaint_id}/reassign/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          officer_id: reassignOfficerId,
          reason: reassignReason || 'Reassigned by officer'
        })
      });

      if (response.ok) {
        alert('Complaint reassigned successfully');
        setShowReassignModal(false);
        setReassignOfficerId('');
        setReassignReason('');
        fetchComplaints();
      } else {
        const error = await response.json();
        alert('Failed to reassign: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error reassigning complaint:', error);
      alert('Failed to reassign complaint');
    }
  };

  const handleUpdateStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/complaints/${selectedComplaint.complaint_id}/change-status/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchComplaints();
        setNewStatus('');
        alert('Status updated successfully');
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleAddResponse = async () => {
    if (!responseText.trim()) {
      alert('Please enter a response message');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/responses/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          complaint: selectedComplaint.complaint_id,
          title: 'Officer Response',
          message: responseText,
          response_type: 'update'
        })
      });

      if (response.ok) {
        setResponseText('');
        fetchResponses();
        alert('Response added successfully');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        alert('Failed to add response');
      }
    } catch (error) {
      console.error('Error adding response:', error);
      alert('Failed to add response');
    }
  };

  const fetchResponses = async () => {
    if (!selectedComplaint) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/complaints/${selectedComplaint.complaint_id}/responses/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setResponses(data);
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const fetchComments = async () => {
    if (!selectedComplaint) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/complaints/${selectedComplaint.complaint_id}/comments/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleDeleteResponse = async (responseId) => {
    if (!confirm('Are you sure you want to delete this response?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/responses/${responseId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchResponses();
        alert('Response deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting response:', error);
    }
  };

  const handleEditResponse = async (responseId, newMessage) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/responses/${responseId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: newMessage })
      });
      if (response.ok) {
        setEditingResponse(null);
        fetchResponses();
        alert('Response updated successfully');
      }
    } catch (error) {
      console.error('Error updating response:', error);
    }
  };

  const handleStatusChange = async (templateId, newStatus) => {
    const action = newStatus === 'active' ? 'activate' : 'deactivate';
    try {
      const response = await fetch(`/api/feedback/templates/${templateId}/${action}/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        fetchTemplates();
        alert(`Template ${action}d successfully!`);
      } else {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        alert(`Failed to ${action} template`);
      }
    } catch (error) {
      console.error('Error updating template status:', error);
      alert(`Failed to ${action} template`);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await fetch(`/api/feedback/templates/${templateId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const exportResults = async (templateId, format = 'csv') => {
    try {
      const response = await fetch(`/api/feedback/templates/${templateId}/analytics/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      
      if (format === 'csv') {
        const csv = convertToCSV(data);
        downloadFile(csv, `feedback-${templateId}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `feedback-${templateId}.json`, 'application/json');
      }
    } catch (error) {
      console.error('Error exporting results:', error);
    }
  };

  const convertToCSV = (data) => {
    const headers = ['Field', 'Type', 'Average/Count', 'Details'];
    const rows = Object.entries(data.field_analytics).map(([field, analytics]) => [
      field,
      analytics.type,
      analytics.average || analytics.count || 0,
      JSON.stringify(analytics.choices || analytics)
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadFile = (content, filename, contentType) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredTemplates = Array.isArray(templates) ? templates.filter(template => 
    statusFilter === 'all' || template.status === statusFilter
  ).reverse() : [];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Officer Dashboard</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-800">Assigned Complaints</h3>
                  <p className="text-3xl font-bold text-blue-600">{dashboardStats.assignedComplaints}</p>
                  <p className="text-sm text-blue-600">Total assigned</p>
                </div>
                <div className="bg-yellow-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-yellow-800">Pending</h3>
                  <p className="text-3xl font-bold text-yellow-600">{dashboardStats.pendingComplaints}</p>
                  <p className="text-sm text-yellow-600">Awaiting action</p>
                </div>
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-800">Resolved</h3>
                  <p className="text-3xl font-bold text-green-600">{dashboardStats.resolvedComplaints}</p>
                  <p className="text-sm text-green-600">Successfully resolved</p>
                </div>
                <div className="bg-purple-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-purple-800">Templates</h3>
                  <p className="text-3xl font-bold text-purple-600">{dashboardStats.totalTemplates}</p>
                  <p className="text-sm text-purple-600">Feedback templates</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">Recent Complaints</h3>
                {complaints.filter(c => c.assigned_to?.id === user?.id).slice(0, 5).length > 0 ? (
                  <div className="space-y-3">
                    {complaints.filter(c => c.assigned_to?.id === user?.id).slice(0, 5).map((complaint) => (
                      <div key={complaint.complaint_id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-sm">{complaint.title}</h4>
                            <p className="text-xs text-gray-600">{complaint.category?.name}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            complaint.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {complaint.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <p className="mb-4">No assigned complaints</p>
                  </div>
                )}
                <div className="mt-4">
                  <button 
                    onClick={() => setActiveTab('complaints')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Manage All Complaints
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-4">Recent Templates</h3>
                {loading ? (
                  <div className="text-center py-8 text-gray-600">Loading...</div>
                ) : !Array.isArray(templates) || templates.length === 0 ? (
                  <div className="text-center py-8 text-gray-600">
                    <p className="mb-4">No templates created yet</p>
                    <button 
                      onClick={() => setActiveTab('create-template')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Create Template
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.slice().reverse().slice(0, 5).map(template => (
                      <div key={template.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <h4 className="font-medium text-sm">{template.title}</h4>
                          <p className="text-xs text-gray-600">
                            Created: {new Date(template.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          template.status === 'active' ? 'bg-green-100 text-green-800' :
                          template.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {template.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <button 
                    onClick={() => setActiveTab('manage-templates')}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    Manage All Templates
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'complaints':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Complaints</h2>
            <div className="bg-white rounded-lg shadow p-6">
              {complaintsLoading ? (
                <div className="text-center py-8 text-gray-600">Loading complaints...</div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-xl mb-2">No Complaints Assigned</p>
                  <p>You don't have any complaints assigned to you yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Assigned Complaints ({complaints.length})</h3>
                    <select 
                      value={statusFilter} 
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="escalated">Escalated</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  
                  <div className="space-y-3">
                    {complaints
                      .filter(complaint => statusFilter === 'all' || complaint.status === statusFilter)
                      .map(complaint => (
                        <div key={complaint.complaint_id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-lg">{complaint.title}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              complaint.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              complaint.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              complaint.status === 'escalated' ? 'bg-red-100 text-red-800' :
                              complaint.status === 'resolved' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {complaint.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          
                          <p className="text-gray-600 mb-3">{complaint.description}</p>
                          
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <div className="space-x-4">
                              <span>ID: {complaint.complaint_id.slice(0, 8)}...</span>
                              <span>Category: {complaint.category?.name || 'Uncategorized'}</span>
                            </div>
                            <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button 
                              onClick={() => {
                                setSelectedComplaint(complaint);
                                setNewStatus(complaint.status);
                                setShowComplaintModal(true);
                                fetchResponses();
                                fetchComments();
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              View & Manage
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'create-template':
        return (
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Feedback Template</h2>
            
            {/* Only Feedback Template is supported */}
            <FeedbackFormBuilder onSave={() => {
              setActiveTab('manage-templates');
              fetchTemplates();
            }} />
          </div>
        );

      case 'manage-templates':
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Manage Templates</h2>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Templates</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-10 text-gray-600">Loading templates...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTemplates.map(template => (
                  <div key={template.id} className="bg-white rounded-lg shadow p-6 border border-gray-200">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">{template.title}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        template.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                        template.status === 'active' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {template.status}
                      </span>
                    </div>

                    {template.description && (
                      <p className="text-gray-600 mb-4">{template.description}</p>
                    )}

                    <div className="text-sm text-gray-500 mb-4">
                      <p>Created: {new Date(template.created_at).toLocaleDateString()}</p>
                      <p>Fields: {template.fields?.length || 0}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => {
                          setSelectedTemplate(template.id);
                          setActiveTab('analytics');
                        }}
                        className="px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                      >
                        View Analytics
                      </button>

                      {template.status === 'draft' && (
                        <button 
                          onClick={() => handleStatusChange(template.id, 'active')}
                          className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Activate
                        </button>
                      )}

                      {template.status === 'active' && (
                        <button 
                          onClick={() => handleStatusChange(template.id, 'closed')}
                          className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                        >
                          Close
                        </button>
                      )}

                      <button 
                        onClick={() => exportResults(template.id, 'csv')}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Export CSV
                      </button>

                      <button 
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'analytics':
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
              {selectedTemplate && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => exportResults(selectedTemplate, 'csv')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Export CSV
                  </button>
                  <button 
                    onClick={() => exportResults(selectedTemplate, 'json')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Export JSON
                  </button>
                </div>
              )}
            </div>
            
            {selectedTemplate ? (
              <FeedbackAnalytics templateId={selectedTemplate} />
            ) : (
              <div className="text-center py-16 text-gray-600">
                <p className="text-lg mb-4">Select a template to view analytics</p>
                <button 
                  onClick={() => setActiveTab('manage-templates')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Go to Templates
                </button>
              </div>
            )}
          </div>
        );

      case 'schedule':
        return <OfficerSchedule />;

      case 'announcements':
        return <PublicAnnouncementBoard />;

      case 'profile':
        return <OfficerProfile />;

      default:
        return <div>Page not found</div>;
    }
  };

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setSidebarOpen((prev) => !prev);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <DashboardNavbar onSidebarToggle={handleSidebarToggle} />
      
      <div className="flex pt-20">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isDesktopSidebarCollapsed}
          items={menuItems}
          activeItem={activeTab}
          onItemClick={(id) => {
            setActiveTab(id);
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            setActiveTab('profile');
            setSidebarOpen(false);
          }}
          onHideSidebar={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
        />

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20 top-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className={`flex-1 ${isDesktopSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <MaintenanceNotification />
            {renderTabContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default OfficerDashboard;
