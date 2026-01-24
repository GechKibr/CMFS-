import React, { useState } from 'react';
import {
  FeedbackFormBuilder,
  FeedbackForm,
  FeedbackList,
  FeedbackAnalytics
} from '../components/feedback';

const FeedbackPage = ({ user }) => {
  const [currentView, setCurrentView] = useState('list');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleSelectTemplate = (templateId, action = 'fill') => {
    setSelectedTemplate(templateId);
    
    if (templateId === 'create') {
      setCurrentView('create');
    } else if (action === 'analytics') {
      setCurrentView('analytics');
    } else {
      setCurrentView('fill');
    }
  };

  const handleBack = () => {
    setCurrentView('list');
    setSelectedTemplate(null);
  };

  const handleFormSubmit = () => {
    alert('Thank you for your feedback!');
    handleBack();
  };

  const handleFormSave = () => {
    alert('Feedback form created successfully!');
    handleBack();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {currentView === 'list' && (
        <FeedbackList
          userRole={user?.role}
          onSelectTemplate={handleSelectTemplate}
        />
      )}

      {currentView === 'create' && (
        <div>
          <button 
            onClick={handleBack} 
            className="m-5 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to List
          </button>
          <FeedbackFormBuilder onSave={handleFormSave} />
        </div>
      )}

      {currentView === 'fill' && selectedTemplate && (
        <div>
          <button 
            onClick={handleBack} 
            className="m-5 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to List
          </button>
          <FeedbackForm
            templateId={selectedTemplate}
            onSubmit={handleFormSubmit}
          />
        </div>
      )}

      {currentView === 'analytics' && selectedTemplate && (
        <div>
          <button 
            onClick={handleBack} 
            className="m-5 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to List
          </button>
          <FeedbackAnalytics templateId={selectedTemplate} />
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
