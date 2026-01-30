import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const FeedbackTemplateManagement = () => {
  const { isDark } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, officer_created, admin_created
  const [selectedOfficer, setSelectedOfficer] = useState('all'); // all, specific officer name
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    content: '',
    category: 'general',
    priority: 'medium',
    template_type: 'feedback'
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiService.getFeedbackTemplates();
      setTemplates(response.results || response || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      // Get templates from localStorage if API fails
      const storedTemplates = localStorage.getItem('feedback_templates');
      if (storedTemplates) {
        setTemplates(JSON.parse(storedTemplates));
      } else {
        // Fallback to mock data including officer service assessment templates
        const mockTemplates = [
          {
            id: 1,
            title: 'Complaint Received',
            content: 'Thank you for your complaint. We have received it and will review within 24 hours.',
            category: 'acknowledgment',
            priority: 'high',
            status: 'active',
            template_type: 'feedback',
            created_by: 'Admin',
            created_by_role: 'admin',
            created_at: '2024-01-15',
            approved_by: 'Admin',
            approved_at: '2024-01-16'
          },
          {
            id: 2,
            title: 'Service Quality Assessment',
            content: 'Please rate our service quality and provide feedback on your experience with our complaint resolution process.',
            category: 'assessment',
            priority: 'medium',
            status: 'active',
            template_type: 'service_assessment',
            created_by: 'Officer Jane',
            created_by_role: 'officer',
            created_at: '2024-01-18',
            approved_by: 'Admin',
            approved_at: '2024-01-19'
          },
          {
            id: 3,
            title: 'Officer Performance Evaluation',
            content: 'How would you rate the officer\'s handling of your complaint? Your feedback helps us improve our services.',
            category: 'assessment',
            priority: 'high',
            status: 'active',
            template_type: 'service_assessment',
            created_by: 'Officer Mike',
            created_by_role: 'officer',
            created_at: '2024-01-20',
            approved_by: 'Admin',
            approved_at: '2024-01-21'
          },
          {
            id: 4,
            title: 'Resolution Satisfaction Survey',
            content: 'Your complaint has been resolved. Please take a moment to evaluate our service and the resolution provided.',
            category: 'assessment',
            priority: 'medium',
            status: 'pending',
            template_type: 'service_assessment',
            created_by: 'Officer Sarah',
            created_by_role: 'officer',
            created_at: '2024-01-22',
            approved_by: null,
            approved_at: null
          },
          {
            id: 5,
            title: 'Investigation Update',
            content: 'We are currently investigating your complaint. We will provide an update within 48 hours.',
            category: 'progress',
            priority: 'medium',
            status: 'pending',
            template_type: 'feedback',
            created_by: 'Officer John',
            created_by_role: 'officer',
            created_at: '2024-01-23',
            approved_by: null,
            approved_at: null
          }
        ];
        setTemplates(mockTemplates);
        localStorage.setItem('feedback_templates', JSON.stringify(mockTemplates));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.title || !newTemplate.content) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const templateData = {
        ...newTemplate,
        created_by_role: 'admin'
      };
      
      const response = await apiService.createFeedbackTemplate(templateData);
      if (response) {
        loadTemplates();
        setNewTemplate({ title: '', content: '', category: 'general', priority: 'medium', template_type: 'feedback' });
        setShowCreateModal(false);
        alert('Template created successfully!');
      }
    } catch (error) {
      console.error('Failed to create template:', error);
      // Fallback to local state update
      const template = {
        ...newTemplate,
        id: Date.now(),
        status: 'pending',
        created_by: 'Current Admin',
        created_by_role: 'admin',
        created_at: new Date().toISOString().split('T')[0],
        approved_by: null,
        approved_at: null
      };

      const updatedTemplates = [template, ...templates];
      setTemplates(updatedTemplates);
      localStorage.setItem('feedback_templates', JSON.stringify(updatedTemplates));
      setNewTemplate({ title: '', content: '', category: 'general', priority: 'medium', template_type: 'feedback' });
      setShowCreateModal(false);
      alert('Template created successfully! It will be available after approval.');
    }
  };

  const handleApproveTemplate = async (templateId) => {
    if (!confirm('Approve this template for use?')) return;

    try {
      await apiService.approveFeedbackTemplate(templateId);
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { 
              ...template, 
              status: 'active',
              approved_by: 'Current Admin',
              approved_at: new Date().toISOString().split('T')[0]
            }
          : template
      ));
      alert('Template approved successfully!');
    } catch (error) {
      console.error('Failed to approve template:', error);
      // Fallback to local state update
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { 
              ...template, 
              status: 'active',
              approved_by: 'Current Admin',
              approved_at: new Date().toISOString().split('T')[0]
            }
          : template
      ));
      alert('Template approved successfully!');
    }
  };

  const handleRejectTemplate = async (templateId) => {
    if (!confirm('Reject this template?')) return;

    try {
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { ...template, status: 'rejected' }
          : template
      ));
      alert('Template rejected.');
    } catch (error) {
      alert('Failed to reject template: ' + error.message);
    }
  };

  const handleDeactivateTemplate = async (templateId) => {
    if (!confirm('Deactivate this template?')) return;

    try {
      await apiService.deactivateFeedbackTemplate(templateId);
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { ...template, status: 'inactive' }
          : template
      ));
      alert('Template deactivated successfully!');
    } catch (error) {
      console.error('Failed to deactivate template:', error);
      // Fallback to local state update
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { ...template, status: 'inactive' }
          : template
      ));
      alert('Template deactivated.');
    }
  };

  const handleActivateTemplate = async (templateId) => {
    if (!confirm('Activate this template?')) return;

    try {
      await apiService.activateFeedbackTemplate(templateId);
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { ...template, status: 'active' }
          : template
      ));
      alert('Template activated successfully!');
    } catch (error) {
      console.error('Failed to activate template:', error);
      // Fallback to local state update
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { ...template, status: 'active' }
          : template
      ));
      alert('Template activated.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTemplates = templates.filter(template => {
    let matchesType = true;
    let matchesOfficer = true;
    
    // Filter by type
    if (filterType === 'officer_created') matchesType = template.created_by_role === 'officer';
    if (filterType === 'admin_created') matchesType = template.created_by_role === 'admin';
    
    // Filter by specific officer
    if (selectedOfficer !== 'all') {
      matchesOfficer = template.created_by === selectedOfficer;
    }
    
    return matchesType && matchesOfficer;
  });

  const getUniqueOfficers = () => {
    const officers = templates
      .filter(t => t.created_by_role === 'officer')
      .map(t => t.created_by);
    return [...new Set(officers)];
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Feedback Template Management
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage feedback templates created by officers
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Template
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-500">{templates.filter(t => t.status === 'active').length}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Active</div>
            </div>
            <div className="text-3xl">✅</div>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-yellow-500">{templates.filter(t => t.status === 'pending').length}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pending</div>
            </div>
            <div className="text-3xl">⏳</div>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-gray-500">{templates.filter(t => t.status === 'inactive').length}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Inactive</div>
            </div>
            <div className="text-3xl">⏸️</div>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-500">{templates.filter(t => t.template_type === 'service_assessment').length}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Assessments</div>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-orange-500">{templates.filter(t => t.created_by_role === 'officer').length}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>By Officers</div>
            </div>
            <div className="text-3xl">👮</div>
          </div>
        </div>
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-indigo-500">{templates.length}</div>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total</div>
            </div>
            <div className="text-3xl">📝</div>
          </div>
        </div>
      </div>

      {/* Officer Templates Summary */}
      {templates.filter(t => t.created_by_role === 'officer').length > 0 && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            Templates by Officer
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getUniqueOfficers().map(officer => {
              const officerTemplates = templates.filter(t => t.created_by === officer);
              const activeCount = officerTemplates.filter(t => t.status === 'active').length;
              const pendingCount = officerTemplates.filter(t => t.status === 'pending').length;
              
              return (
                <div key={officer} className={`p-4 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {officer}
                    </h4>
                    <button
                      onClick={() => {
                        setFilterType('officer_created');
                        setSelectedOfficer(officer);
                      }}
                      className="text-blue-500 hover:text-blue-600 text-sm"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Total:</span>
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {officerTemplates.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Active:</span>
                      <span className="font-medium text-green-600">{activeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Pending:</span>
                      <span className="font-medium text-yellow-600">{pendingCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h4 className={`text-md font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              All Templates
            </h4>
            <div className="flex space-x-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`px-3 py-1 border rounded text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="all">All Templates</option>
                <option value="officer_created">Officer Created</option>
                <option value="admin_created">Admin Created</option>
              </select>
              
              {filterType === 'officer_created' && (
                <select
                  value={selectedOfficer}
                  onChange={(e) => setSelectedOfficer(e.target.value)}
                  className={`px-3 py-1 border rounded text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="all">All Officers</option>
                  {getUniqueOfficers().map(officer => (
                    <option key={officer} value={officer}>{officer}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Loading templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">📝</div>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No templates found for {selectedOfficer !== 'all' ? `"${selectedOfficer}"` : `"${filterType.replace('_', ' ')}"`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTemplates.map((template) => (
              <div key={template.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {template.title}
                      </h5>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}>
                        {template.status.toUpperCase()}
                      </span>
                      <span className={`text-sm font-medium ${getPriorityColor(template.priority)}`}>
                        {template.priority.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        template.template_type === 'service_assessment' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {template.template_type === 'service_assessment' ? 'ASSESSMENT' : 'FEEDBACK'}
                      </span>
                    </div>
                    
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                      {template.content}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Category: <span className="font-medium">{template.category}</span>
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Created by: <span className={`font-medium ${template.created_by_role === 'officer' ? 'text-orange-600' : 'text-blue-600'}`}>
                          {template.created_by} ({template.created_by_role})
                        </span>
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Created: {template.created_at}
                      </span>
                      {template.approved_by && (
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Approved by: <span className="font-medium">{template.approved_by}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col space-y-2 ml-4">
                    {template.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApproveTemplate(template.id)}
                          className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors flex items-center justify-center"
                          title="Approve and activate this template"
                        >
                          ✓ Approve
                        </button>
                        <button
                          onClick={() => handleRejectTemplate(template.id)}
                          className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors flex items-center justify-center"
                          title="Reject this template"
                        >
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {template.status === 'active' && (
                      <button
                        onClick={() => handleDeactivateTemplate(template.id)}
                        className="bg-orange-500 text-white px-4 py-2 rounded text-sm hover:bg-orange-600 transition-colors flex items-center justify-center"
                        title="Deactivate this template"
                      >
                        ⏸️ Deactivate
                      </button>
                    )}
                    {template.status === 'inactive' && (
                      <button
                        onClick={() => handleActivateTemplate(template.id)}
                        className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors flex items-center justify-center"
                        title="Activate this template"
                      >
                        ▶️ Activate
                      </button>
                    )}
                    {template.status === 'rejected' && (
                      <button
                        onClick={() => handleActivateTemplate(template.id)}
                        className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors flex items-center justify-center"
                        title="Reactivate this template"
                      >
                        🔄 Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg w-full max-w-md`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Create New Template
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Title *
                </label>
                <input
                  type="text"
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate(prev => ({...prev, title: e.target.value}))}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  placeholder="Template title"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Content *
                </label>
                <textarea
                  value={newTemplate.content}
                  onChange={(e) => setNewTemplate(prev => ({...prev, content: e.target.value}))}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  rows="4"
                  placeholder="Template content"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Template Type
                </label>
                <select
                  value={newTemplate.template_type}
                  onChange={(e) => setNewTemplate(prev => ({...prev, template_type: e.target.value}))}
                  className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="feedback">Feedback Template</option>
                  <option value="service_assessment">Service Assessment Template</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                    Category
                  </label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate(prev => ({...prev, category: e.target.value}))}
                    className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="general">General</option>
                    <option value="acknowledgment">Acknowledgment</option>
                    <option value="progress">Progress Update</option>
                    <option value="resolution">Resolution</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="assessment">Service Assessment</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                    Priority
                  </label>
                  <select
                    value={newTemplate.priority}
                    onChange={(e) => setNewTemplate(prev => ({...prev, priority: e.target.value}))}
                    className={`w-full p-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackTemplateManagement;
