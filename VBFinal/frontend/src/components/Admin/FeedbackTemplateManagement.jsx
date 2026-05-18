import React, { useEffect, useState } from 'react';
import { FeedbackAnalytics, FeedbackFormBuilder } from '../feedback';
import FeedbackResponsesTable from '../feedback/FeedbackResponsesTable';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const FeedbackTemplateManagement = () => {
  const { isDark } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [selectedOfficer, setSelectedOfficer] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [viewingTemplateResponses, setViewingTemplateResponses] = useState(null);
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await apiService.getFeedbackTemplates();
      setTemplates(response.results || response || []);
    } catch (loadError) {
      console.error('Failed to load templates:', loadError);
      setTemplates([]);
      setError(loadError.message || 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  const exportResults = async (templateId, format = 'csv') => {
    try {
      const data = await apiService.getFeedbackTemplateAnalytics(templateId);

      if (format === 'csv') {
        const csv = convertToCSV(data);
        downloadFile(csv, `feedback-${templateId}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `feedback-${templateId}.json`, 'application/json');
      }
    } catch (exportError) {
      console.error('Failed to export template results:', exportError);
      alert('Failed to export template results');
    }
  };

  const convertToCSV = (data) => {
    const headers = ['Field', 'Type', 'Average/Count', 'Details'];
    const rows = Object.entries(data?.field_analytics || {}).map(([field, analytics]) => [
      field,
      analytics.type,
      analytics.average || analytics.count || 0,
      JSON.stringify(analytics.choices || analytics),
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
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

  const handleAction = async (action, templateId, successMessage) => {
    try {
      if (action === 'approve') await apiService.approveFeedbackTemplate(templateId);
      if (action === 'reject') await apiService.rejectFeedbackTemplate(templateId);
      if (action === 'activate') await apiService.activateFeedbackTemplate(templateId);
      if (action === 'deactivate') await apiService.deactivateFeedbackTemplate(templateId);
      if (action === 'close') await apiService.closeFeedbackTemplate(templateId);
      if (action === 'delete') await apiService.deleteFeedbackTemplate(templateId);
      await loadTemplates();
      alert(successMessage);
    } catch (actionError) {
      console.error(`Failed to ${action} template:`, actionError);
      alert(actionError.message || `Failed to ${action} template`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'closed': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTemplates = templates.filter(template => {
    let matchesType = true;
    let matchesOfficer = true;

    if (filterType === 'officer_created') matchesType = template.created_by_role === 'officer';
    if (filterType === 'admin_created') matchesType = template.created_by_role === 'admin';

    if (selectedOfficer !== 'all') {
      matchesOfficer = template.created_by === selectedOfficer;
    }

    return matchesType && matchesOfficer;
  });

  const getUniqueOfficers = () => {
    const officers = templates
      .filter(template => template.created_by_role === 'officer')
      .map(template => template.created_by);
    return [...new Set(officers)];
  };

  const getAudienceSummary = (template) => {
    if (template.audience_scope === 'campus') return `Campus: ${template.target_campus_name || 'N/A'}`;
    if (template.audience_scope === 'college') return `College: ${template.target_college_name || 'N/A'}`;
    if (template.audience_scope === 'department') return `Department: ${template.target_department_name || 'N/A'}`;
    if (template.audience_scope === 'users') return `Specific users: ${(template.target_user_ids || []).length}`;
    return 'All users';
  };

  const selectedTemplateData = templates.find((template) => String(template.id) === String(selectedTemplate));

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Feedback Template Management
            </h3>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Template
          </button>
        </div>
      </div>

      {error && (
        <div className={`${isDark ? 'bg-red-900/20 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700'} border rounded-lg p-4`}>
          {error}
        </div>
      )}

      {viewingTemplateResponses && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 space-y-4`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Responses for: {viewingTemplateResponses.title}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Same response view used on the officer dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewingTemplateResponses(null)}
              className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700"
            >
              Back to Templates
            </button>
          </div>
          <FeedbackResponsesTable templateId={viewingTemplateResponses.id} templateTitle={viewingTemplateResponses.title} />
        </div>
      )}

      {selectedTemplate && !viewingTemplateResponses && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6 space-y-4`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Feedback Analytics: {selectedTemplateData?.title || `Template #${selectedTemplate}`}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Same analytics view used on the officer dashboard.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportResults(selectedTemplate, 'csv')}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => exportResults(selectedTemplate, 'json')}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-700"
              >
                Back to Templates
              </button>
            </div>
          </div>
          <FeedbackAnalytics templateId={selectedTemplate} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <StatCard isDark={isDark} label="Active" value={templates.filter(t => t.status === 'active').length} color="text-green-500" />
        <StatCard isDark={isDark} label="Pending" value={templates.filter(t => t.status === 'pending').length} color="text-yellow-500" />
        <StatCard isDark={isDark} label="Inactive" value={templates.filter(t => t.status === 'inactive').length} color="text-gray-500" />
        <StatCard isDark={isDark} label="Closed" value={templates.filter(t => t.status === 'closed').length} color="text-red-500" />
        <StatCard isDark={isDark} label="By Officers" value={templates.filter(t => t.created_by_role === 'officer').length} color="text-orange-500" />
        <StatCard isDark={isDark} label="Total" value={templates.length} color="text-indigo-500" />
      </div>

      {templates.filter(t => t.created_by_role === 'officer').length > 0 && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            Templates by Officer
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getUniqueOfficers().map(officer => {
              const officerTemplates = templates.filter(template => template.created_by === officer);
              return (
                <div key={officer} className={`p-4 rounded-lg border ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{officer}</h4>
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
                      <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{officerTemplates.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Active:</span>
                      <span className="font-medium text-green-600">{officerTemplates.filter(t => t.status === 'active').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Pending:</span>
                      <span className="font-medium text-yellow-600">{officerTemplates.filter(t => t.status === 'pending').length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                    </div>

                    {template.description && (
                      <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                        {template.description}
                      </p>
                    )}

                    <div className="flex items-center space-x-4 text-sm flex-wrap">
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Office: <span className="font-medium">{template.office}</span>
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Created by: <span className={`font-medium ${template.created_by_role === 'officer' ? 'text-orange-600' : 'text-blue-600'}`}>
                          {template.created_by} ({template.created_by_role})
                        </span>
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Fields: {template.fields?.length || 0}
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Audience: {getAudienceSummary(template)}
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Created: {new Date(template.created_at).toLocaleString()}
                      </span>
                      {template.approved_by && (
                        <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Approved by: <span className="font-medium">{template.approved_by}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 ml-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(null);
                        setViewingTemplateResponses(template);
                      }}
                      className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 transition-colors"
                    >
                      View Responses
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewingTemplateResponses(null);
                        setSelectedTemplate(template.id);
                      }}
                      className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 transition-colors"
                    >
                      View Analytics
                    </button>

                    {(template.status === 'draft' || template.status === 'pending' || template.status === 'inactive') && (
                      <button
                        type="button"
                        onClick={() => handleAction('activate', template.id, 'Template activated successfully!')}
                        className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
                      >
                        Activate
                      </button>
                    )}

                    {template.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleAction('close', template.id, 'Template closed successfully!')}
                        className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 transition-colors"
                      >
                        Close
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => exportResults(template.id, 'csv')}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                    >
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => exportResults(template.id, 'json')}
                      className="bg-cyan-600 text-white px-4 py-2 rounded text-sm hover:bg-cyan-700 transition-colors"
                    >
                      Export JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('delete', template.id, 'Template deleted successfully!')}
                      className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-lg w-full max-w-7xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Create New Template
                </h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Uses the same builder and options as the officer template page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className={`px-4 py-2 rounded-lg ${isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Close
              </button>
            </div>

            <FeedbackFormBuilder
              onSave={async () => {
                setShowCreateModal(false);
                await loadTemplates();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ isDark, label, value, icon, color }) => (
  <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow hover:shadow-md transition-shadow`}>
    <div className="flex items-center justify-between">
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{label}</div>
      </div>
      <div className="text-3xl">{icon}</div>
    </div>
  </div>
);

export default FeedbackTemplateManagement;
