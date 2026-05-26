import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';

const FeedbackList = ({ userRole, onSelectTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeedbackTemplates();
      setTemplates(data.results || data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (templateId, newStatus) => {
    try {
      if (newStatus === 'active') {
        await apiService.activateFeedbackTemplate(templateId);
      } else if (newStatus === 'closed') {
        await apiService.closeFeedbackTemplate(templateId);
      } else {
        await apiService.deactivateFeedbackTemplate(templateId);
      }
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template status:', error);
    }
  };

  if (loading) return <div className="text-center py-10 text-lg text-gray-600">Loading templates...</div>;

  const filteredTemplates = userRole === 'user'
    ? templates.filter(template => template.status === 'active')
    : templates;

  return (
    <div className="max-w-6xl mx-auto p-5">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 m-0">Feedback Forms</h2>
        {userRole === 'officer' && (
          <button
            className="px-6 py-3 rounded-lg font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            onClick={() => onSelectTemplate('create')}
          >
            Create New Form
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map(template => (
          <div key={template.id} className="bg-white border border-gray-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-800 m-0">{template.title}</h3>
              <span className="px-3 py-1 rounded text-xs font-semibold uppercase bg-gray-100 text-gray-700">
                {template.status}
              </span>
            </div>

            {template.description && (
              <p className="text-gray-600 mb-4 leading-relaxed">{template.description}</p>
            )}

            <div className="flex flex-col gap-1 mb-5 text-sm text-gray-600">
              <span>Office: {template.office}</span>
              <span>Created: {new Date(template.created_at).toLocaleDateString()}</span>
              {template.created_by && (
                <span>By: {template.created_by}</span>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {userRole === 'user' && template.status === 'active' && (
                <button
                  className="px-4 py-2 text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
                  onClick={() => onSelectTemplate(template.id)}
                >
                  Fill Form
                </button>
              )}

              {userRole === 'officer' && (
                <>
                  <button
                    className="px-4 py-2 text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
                    onClick={() => onSelectTemplate(template.id, 'analytics')}
                  >
                    View Responses
                  </button>

                  {template.status === 'draft' && (
                    <button
                      className="px-4 py-2 text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
                      onClick={() => handleStatusChange(template.id, 'active')}
                    >
                      Activate
                    </button>
                  )}

                  {template.status === 'active' && (
                    <button
                      className="px-4 py-2 text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
                      onClick={() => handleStatusChange(template.id, 'closed')}
                    >
                      Close
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg mb-5">No feedback forms available</p>
          {userRole === 'officer' && (
            <button
              className="px-6 py-3 rounded-lg font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
              onClick={() => onSelectTemplate('create')}
            >
              Create Your First Form
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedbackList;
