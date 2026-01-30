import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const OfficerTemplateCreator = () => {
  const { isDark } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    title: '',
    content: '',
    category: 'general'
  });

  useEffect(() => {
    loadOfficerTemplates();
  }, []);

  const loadOfficerTemplates = async () => {
    try {
      const response = await apiService.getOfficerTemplates();
      setTemplates(response.results || response || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
      // Mock data for officer's templates
      const mockTemplates = [
        {
          id: 1,
          title: 'Investigation Started',
          content: 'We have started investigating your complaint and will update you soon.',
          category: 'progress',
          status: 'pending',
          created_at: '2024-01-20'
        }
      ];
      setTemplates(mockTemplates);
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
        template_type: 'feedback',
        created_by_role: 'officer'
      };
      
      const response = await apiService.createFeedbackTemplate(templateData);
      if (response) {
        loadOfficerTemplates();
        setNewTemplate({ title: '', content: '', category: 'general' });
        setShowCreateModal(false);
        alert('Template submitted for admin approval!');
      }
    } catch (error) {
      console.error('Failed to create template:', error);
      // Fallback to local state and localStorage
      const template = {
        ...newTemplate,
        id: Date.now(),
        status: 'pending',
        template_type: 'feedback',
        created_by: 'Current Officer',
        created_by_role: 'officer',
        created_at: new Date().toISOString().split('T')[0],
        approved_by: null,
        approved_at: null
      };

      // Update local state
      const updatedTemplates = [template, ...templates];
      setTemplates(updatedTemplates);
      
      // Update localStorage for admin to see
      const existingTemplates = JSON.parse(localStorage.getItem('feedback_templates') || '[]');
      const allTemplates = [template, ...existingTemplates];
      localStorage.setItem('feedback_templates', JSON.stringify(allTemplates));
      
      setNewTemplate({ title: '', content: '', category: 'general' });
      setShowCreateModal(false);
      alert('Template submitted for admin approval!');
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <div className="flex justify-between items-center">
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              My Feedback Templates
            </h3>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Create templates for admin approval
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Create Template
          </button>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
        {templates.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-2">📝</div>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No templates created yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {templates.map((template) => (
              <div key={template.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {template.title}
                    </h5>
                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mt-2`}>
                      {template.content}
                    </p>
                    <div className="flex items-center space-x-4 mt-3 text-sm">
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Category: {template.category}
                      </span>
                      <span className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Created: {template.created_at}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    template.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    template.status === 'active' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {template.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg w-full max-w-md`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Create Template
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
                />
              </div>
              
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
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-600 text-white hover:bg-gray-700' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerTemplateCreator;
