import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import apiService from '../services/api';

const UserDashboard = () => {
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('submit');
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Form state for complaint submission
  const [complaintForm, setComplaintForm] = useState({
    title: '',
    description: '',
    institution: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const menuItems = [
    { id: 'submit', name: t('submit_complaint'), icon: '📝' },
    { id: 'my-complaints', name: t('my_complaints'), icon: '📋' },
    { id: 'notifications', name: t('notifications'), icon: '🔔', badge: unreadCount },
    { id: 'profile', name: t('profile'), icon: '👤' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [complaints, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [complaintsData, institutionsData, categoriesData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getInstitutions(),
        apiService.getCategories()
      ]);
      
      setComplaints(complaintsData.results || complaintsData || []);
      setInstitutions(institutionsData.results || institutionsData || []);
      setCategories(categoriesData.results || categoriesData || []);
      
      // Mock notifications
      setNotifications([
        { id: 1, message: 'Your complaint has been assigned to an officer', type: 'info', read: false },
        { id: 2, message: 'Status updated: In Progress', type: 'success', read: false },
        { id: 3, message: 'New comment on your complaint', type: 'info', read: false }
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = complaints || [];
    
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

  const validateForm = () => {
    const errors = {};
    if (!complaintForm.title.trim()) errors.title = t('required');
    if (!complaintForm.description.trim()) errors.description = t('required');
    if (!complaintForm.institution) errors.institution = t('required');
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await apiService.createComplaint(complaintForm);
      setSubmitSuccess(true);
      setComplaintForm({
        title: '',
        description: '',
        institution: ''
      });
      setTimeout(() => setSubmitSuccess(false), 3000);
      await loadData();
    } catch (error) {
      console.error('Failed to submit complaint:', error);
    }
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

  const renderSubmitComplaint = () => (
    <div className="max-w-2xl">
      {submitSuccess && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {t('complaint_submitted')}
        </div>
      )}
      
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
          {t('submit_new_complaint')}
        </h3>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
          {t('ai_will_detect')}
        </p>
        
        <form onSubmit={submitComplaint} className="space-y-6">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('title')} *
            </label>
            <input
              type="text"
              value={complaintForm.title}
              onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})}
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${formErrors.title ? 'border-red-500' : ''}`}
              placeholder={t('brief_title')}
            />
            {formErrors.title && <p className="text-red-500 text-sm mt-1">{formErrors.title}</p>}
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('description')} *
            </label>
            <textarea
              value={complaintForm.description}
              onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})}
              rows="4"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${formErrors.description ? 'border-red-500' : ''}`}
              placeholder={t('detailed_description')}
            />
            {formErrors.description && <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>}
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('institution')} *
            </label>
            <select
              value={complaintForm.institution}
              onChange={(e) => setComplaintForm({...complaintForm, institution: e.target.value})}
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${formErrors.institution ? 'border-red-500' : ''}`}
            >
              <option value="">{t('select_institution')}</option>
              {(institutions || []).map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
            {formErrors.institution && <p className="text-red-500 text-sm mt-1">{formErrors.institution}</p>}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors"
            >
              {t('submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderMyComplaints = () => (
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
              {(filteredComplaints || []).map((complaint) => (
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
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(complaint.status)}`}>
                      {complaint.status}
                    </span>
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
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredComplaints.length === 0 && (
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
      <div className="flex justify-between items-center">
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Notifications
        </h3>
        <button
          onClick={() => {
            setNotifications(notifications.map(n => ({...n, read: true})));
            setUnreadCount(0);
          }}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          Mark all as read
        </button>
      </div>
      
      {(notifications || []).map((notification) => (
        <div
          key={notification.id}
          className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow border-l-4 ${
            notification.type === 'success' ? 'border-green-500' : 
            notification.type === 'warning' ? 'border-yellow-500' : 'border-blue-500'
          } ${!notification.read ? 'ring-2 ring-blue-200' : ''}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <span className="text-lg mr-3">
                {notification.type === 'success' ? '✅' : 
                 notification.type === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              <div>
                <p className={`${isDark ? 'text-white' : 'text-gray-900'} ${!notification.read ? 'font-medium' : ''}`}>
                  {notification.message}
                </p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                  2 hours ago
                </p>
              </div>
            </div>
            {!notification.read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderProfile = () => (
    <div className="max-w-4xl space-y-6">
      {/* Personal Information */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
          {t('personal_information')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('first_name')} *
            </label>
            <input
              type="text"
              defaultValue="John"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('last_name')} *
            </label>
            <input
              type="text"
              defaultValue="Doe"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('username')}
            </label>
            <input
              type="text"
              defaultValue="john.doe"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('email')} *
            </label>
            <input
              type="email"
              defaultValue="john.doe@university.edu"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('phone')}
            </label>
            <input
              type="tel"
              defaultValue="+1 (555) 123-4567"
              placeholder="+999999999"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('campus_id')}
            </label>
            <input
              type="text"
              defaultValue="STU-2024-001"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-1">
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('college')}
            </label>
            <select className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
              <option value="">{t('college')}</option>
              <option value="CMHS">{t('college_medicine')}</option>
              <option value="CNCS">{t('college_natural')}</option>
              <option value="CBE">{t('college_business')}</option>
              <option value="CSSH">{t('college_social')}</option>
              <option value="CVMAS">{t('college_veterinary')}</option>
              <option value="CAES">{t('college_agriculture')}</option>
              <option value="COI" selected>{t('college_informatics')}</option>
              <option value="COE">{t('college_education')}</option>
              <option value="IOT">{t('institute_technology')}</option>
              <option value="IOB">{t('institute_biotechnology')}</option>
              <option value="SOL">{t('school_law')}</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('role')}
            </label>
            <input
              type="text"
              defaultValue="Student"
              disabled
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-600 border-gray-500 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('account_status')}
            </label>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                {t('active')}
              </span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                {t('verified')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors">
            {t('update_profile')}
          </button>
        </div>
      </div>

      {/* Account Information */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
          {t('account_information')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('authentication_provider')}
            </label>
            <input
              type="text"
              defaultValue="Local"
              disabled
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-600 border-gray-500 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('date_joined')}
            </label>
            <input
              type="text"
              defaultValue="January 15, 2024"
              disabled
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-600 border-gray-500 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('last_login')}
            </label>
            <input
              type="text"
              defaultValue="Today, 2:30 PM"
              disabled
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-600 border-gray-500 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('user_id')}
            </label>
            <input
              type="text"
              defaultValue="USR-2024-001"
              disabled
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-600 border-gray-500 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
            />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
          {t('notification_settings')}
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{t('email_notifications')}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('receive_updates_email')}</p>
            </div>
            <button className="bg-green-500 text-white px-3 py-1 rounded text-sm">ON</button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{t('sms_notifications')}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('receive_urgent_sms')}</p>
            </div>
            <button className="bg-red-500 text-white px-3 py-1 rounded text-sm">OFF</button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium`}>{t('push_notifications')}</p>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('browser_notifications')}</p>
            </div>
            <button className="bg-green-500 text-white px-3 py-1 rounded text-sm">ON</button>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
          {t('change_password')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('current_password')}
            </label>
            <input
              type="password"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('new_password')}
            </label>
            <input
              type="password"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              {t('confirm_password')}
            </label>
            <input
              type="password"
              className={`w-full border rounded-lg px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded-lg transition-colors">
            {t('change_password')}
          </button>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'submit':
        return renderSubmitComplaint();
      case 'my-complaints':
        return renderMyComplaints();
      case 'notifications':
        return renderNotifications();
      case 'profile':
        return renderProfile();
      default:
        return renderSubmitComplaint();
    }
  };

  return (
    <div className={`flex h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-lg transition-all duration-300 flex flex-col`}>
        <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{t('student_portal')}</h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('complaint_system')}</p>
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

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors relative ${
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
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-sm border-b px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {menuItems.find(item => item.id === activeTab)?.name || t('dashboard')}
              </h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('submit_track_complaints')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={toggleLanguage}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={language === 'en' ? 'Switch to Amharic' : 'Switch to English'}
              >
                {language === 'en' ? '🇪🇹' : '🇺🇸'}
              </button>
              <button 
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={isDark ? t('switch_light_mode') : t('switch_dark_mode')}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                J
              </div>
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto p-6`}>
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t('loading')}</div>
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

// Complaint Details Modal Component
const ComplaintDetailsModal = ({ complaint, onClose, isDark }) => {
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);

  const addComment = async () => {
    if (!newComment.trim()) return;
    console.log('Adding comment:', newComment);
    setNewComment('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
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

        <div className="p-6 space-y-6">
          <div>
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {complaint.title}
            </h3>
            <p className={`mt-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {complaint.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status:</span>
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800`}>
                {complaint.status}
              </span>
            </div>
            <div>
              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Priority:</span>
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded bg-yellow-500 text-white`}>
                {complaint.priority}
              </span>
            </div>
          </div>

          <div>
            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
              Add Comment
            </h4>
            <div className="flex space-x-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add your comment..."
                className={`flex-1 border rounded px-3 py-2 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300'}`}
                rows="3"
              />
              <button
                onClick={addComment}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
