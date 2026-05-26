import { useEffect, useState } from 'react';
import apiService from '../../services/api';

const UserFeedback = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [currentView, setCurrentView] = useState('list');
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState(null);

  useEffect(() => {
    fetchActiveTemplates();
  }, []);

  const fetchActiveTemplates = async () => {
    try {
      const data = await apiService.getFeedbackTemplates();
      const templateList = Array.isArray(data) ? data : data.results || [];
      setTemplates(templateList.filter(template => template.status === 'active'));
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setCurrentView('form');
    setAnswers({});
  };

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const formattedAnswers = selectedTemplate.fields.map(field => {
      const answer = { field_id: field.id };
      const value = answers[field.id];

      switch (field.field_type) {
        case 'text':
          answer.text_value = value || '';
          break;
        case 'number':
          answer.number_value = parseFloat(value) || null;
          break;
        case 'rating':
          answer.rating_value = parseInt(value, 10) || null;
          break;
        case 'choice':
          answer.choice_value = value || '';
          break;
        case 'checkbox':
          answer.checkbox_values = value || [];
          break;
        default:
          break;
      }

      return answer;
    });

    try {
      await apiService.submitFeedbackResponse({
        template: selectedTemplate.id,
        answers: formattedAnswers
      });
      setCurrentView('success');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert(error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedTemplate(null);
    setAnswers({});
    setReviewData(null);
  };

  const handleReviewSubmit = () => {
    // Format answers for review
    const formattedAnswers = selectedTemplate.fields.map(field => {
      const answer = { field_id: field.id };
      const value = answers[field.id];

      switch (field.field_type) {
        case 'text':
          answer.text_value = value || '';
          break;
        case 'number':
          answer.number_value = parseFloat(value) || null;
          break;
        case 'rating':
          answer.rating_value = parseInt(value, 10) || null;
          break;
        case 'choice':
          answer.choice_value = value || '';
          break;
        case 'checkbox':
          answer.checkbox_values = value || [];
          break;
        default:
          break;
      }

      return answer;
    });

    setReviewData(formattedAnswers);
    setCurrentView('review');
  };

  const handleConfirmSubmit = async () => {
    setSubmitting(true);

    try {
      await apiService.submitFeedbackResponse({
        template: selectedTemplate.id,
        answers: reviewData
      });
      setCurrentView('success');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert(error.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditForm = () => {
    setCurrentView('form');
    setReviewData(null);
  };

  const isSubmittedTemplate = Boolean(selectedTemplate?.has_submitted && selectedTemplate?.user_submission);

  const formatSubmissionValue = (value) => {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'No response';
    }

    if (value === null || value === undefined || value === '') {
      return 'No response';
    }

    return String(value);
  };

  const renderSubmittedData = (submission) => {
    if (!submission) {
      return null;
    }

    return (
      <div className="space-y-6">
        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">✓</span>
            <p className="font-bold text-green-900 text-lg">Submission Completed</p>
          </div>
          <p className="text-green-800 text-sm">Submitted on {new Date(submission.submitted_at).toLocaleString()}</p>
          <p className="text-green-700 text-sm mt-2">This feedback form is locked and cannot be modified.</p>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-gray-800 text-lg">Your Submitted Responses</h3>
          {submission.answers.map((answer, index) => (
            <div key={answer.field_id} className="rounded-lg border border-gray-300 bg-white p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex-shrink-0">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{answer.label}</p>
                  <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-gray-900 whitespace-pre-wrap break-words">{formatSubmissionValue(answer.value)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-gray-200">
          <button
            disabled
            className="w-full py-4 bg-gray-400 text-white text-lg font-semibold rounded-lg cursor-not-allowed opacity-75"
          >
            ✓ Already Submitted - Cannot Modify
          </button>
        </div>
      </div>
    );
  };

  if (currentView === 'form' && selectedTemplate) {
    const submission = selectedTemplate.user_submission;

    if (isSubmittedTemplate) {
      return (
        <div className="p-6">
          <button
            onClick={handleBackToList}
            className="mb-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Back to Forms
          </button>

          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{selectedTemplate.title}</h2>
              {selectedTemplate.description && (
                <p className="text-gray-600 text-lg">{selectedTemplate.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">Office: {selectedTemplate.office}</p>
              
              {/* Officer Information */}
              {selectedTemplate.created_by_officer_info && (
                <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 inline-block">
                  <p className="text-xs font-semibold text-purple-800 mb-2">👤 Created By Officer</p>
                  <div className="space-y-1 text-xs text-purple-700">
                    <p><strong>Officer:</strong> {selectedTemplate.created_by_officer_info.officer_name}</p>
                    {selectedTemplate.created_by_officer_info.employee_id && (
                      <p><strong>Employee ID:</strong> {selectedTemplate.created_by_officer_info.employee_id}</p>
                    )}
                    {selectedTemplate.created_by_officer_info.department_name && (
                      <p><strong>Department:</strong> {selectedTemplate.created_by_officer_info.department_name}</p>
                    )}
                    {selectedTemplate.created_by_officer_info.college_name && (
                      <p><strong>College:</strong> {selectedTemplate.created_by_officer_info.college_name}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {renderSubmittedData(submission)}
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <button
          onClick={handleBackToList}
          className="mb-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Back to Forms
        </button>

        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{selectedTemplate.title}</h2>
            {selectedTemplate.description && (
              <p className="text-gray-600 text-lg">{selectedTemplate.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">Office: {selectedTemplate.office}</p>
            
            {/* Officer Information */}
            {selectedTemplate.created_by_officer_info && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 inline-block">
                <p className="text-xs font-semibold text-purple-800 mb-2">👤 Created By Officer</p>
                <div className="space-y-1 text-xs text-purple-700">
                  <p><strong>Officer:</strong> {selectedTemplate.created_by_officer_info.officer_name}</p>
                  {selectedTemplate.created_by_officer_info.employee_id && (
                    <p><strong>Employee ID:</strong> {selectedTemplate.created_by_officer_info.employee_id}</p>
                  )}
                  {selectedTemplate.created_by_officer_info.department_name && (
                    <p><strong>Department:</strong> {selectedTemplate.created_by_officer_info.department_name}</p>
                  )}
                  {selectedTemplate.created_by_officer_info.college_name && (
                    <p><strong>College:</strong> {selectedTemplate.created_by_officer_info.college_name}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {selectedTemplate.fields.map(field => (
              <div key={field.id} className="space-y-2">
                <label className={`block font-semibold text-lg ${field.is_required ? 'text-red-600' : 'text-gray-700'
                  }`}>
                  {field.label}
                  {field.is_required && <span className="text-red-500 ml-1">*</span>}
                  {field.field_type === 'number' && (field.min_value !== null || field.max_value !== null) && (
                    <span className="text-gray-500 font-normal text-sm ml-2">
                      ({field.min_value !== null && field.min_value !== undefined ? `Min: ${field.min_value}` : ''}{field.min_value !== null && field.min_value !== undefined && field.max_value !== null && field.max_value !== undefined ? ', ' : ''}{field.max_value !== null && field.max_value !== undefined ? `Max: ${field.max_value}` : ''})
                    </span>
                  )}
                </label>

                <FieldInput
                  field={field}
                  value={answers[field.id]}
                  onChange={(value) => handleAnswerChange(field.id, value)}
                />
              </div>
            ))}

            <div className="pt-6">
              <button
                type="button"
                onClick={handleReviewSubmit}
                disabled={submitting}
                className="w-full py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Processing...' : 'Review & Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (currentView === 'review' && selectedTemplate && reviewData) {
    return (
      <div className="p-6">
        <button
          onClick={handleEditForm}
          className="mb-6 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          ← Edit Form
        </button>

        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Review Your Feedback</h2>
            <p className="text-gray-600 text-lg">Please review your responses before submitting</p>
            <p className="text-sm text-gray-500 mt-2">Office: {selectedTemplate.office}</p>
            
            {/* Officer Information */}
            {selectedTemplate.created_by_officer_info && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3 inline-block">
                <p className="text-xs font-semibold text-purple-800 mb-2">👤 Created By Officer</p>
                <div className="space-y-1 text-xs text-purple-700">
                  <p><strong>Officer:</strong> {selectedTemplate.created_by_officer_info.officer_name}</p>
                  {selectedTemplate.created_by_officer_info.employee_id && (
                    <p><strong>Employee ID:</strong> {selectedTemplate.created_by_officer_info.employee_id}</p>
                  )}
                  {selectedTemplate.created_by_officer_info.department_name && (
                    <p><strong>Department:</strong> {selectedTemplate.created_by_officer_info.department_name}</p>
                  )}
                  {selectedTemplate.created_by_officer_info.college_name && (
                    <p><strong>College:</strong> {selectedTemplate.created_by_officer_info.college_name}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 font-semibold">📋 Review Mode</p>
            <p className="text-blue-700 text-sm mt-1">Check your answers below. Click "Edit Form" to make changes or "Confirm & Submit" to proceed.</p>
          </div>

          <div className="space-y-6">
            {selectedTemplate.fields.map((field, index) => {
              const answer = reviewData.find(a => a.field_id === field.id);
              const value = answer ? (answer.text_value || answer.number_value || answer.rating_value || answer.choice_value || answer.checkbox_values) : '';

              return (
                <div key={field.id} className="rounded-lg border border-gray-300 bg-gray-50 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-lg">
                        {field.label}
                        {field.field_type === 'number' && (field.min_value !== null || field.max_value !== null) && (
                          <span className="text-gray-500 font-normal text-sm ml-2">
                            ({field.min_value !== null && field.min_value !== undefined ? `Min: ${field.min_value}` : ''}{field.min_value !== null && field.min_value !== undefined && field.max_value !== null && field.max_value !== undefined ? ', ' : ''}{field.max_value !== null && field.max_value !== undefined ? `Max: ${field.max_value}` : ''})
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Type: {field.field_type}</p>
                      <div className="mt-3 p-4 bg-white rounded border-2 border-gray-200">
                        <ReviewFieldDisplay
                          field={field}
                          value={value}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-8 mt-8 border-t border-gray-200 space-y-3">
            <button
              onClick={handleConfirmSubmit}
              disabled={submitting}
              className="w-full py-4 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : '✓ Confirm & Submit'}
            </button>
            <button
              onClick={handleEditForm}
              disabled={submitting}
              className="w-full py-4 bg-gray-300 text-gray-800 text-lg font-semibold rounded-lg hover:bg-gray-400 disabled:opacity-50 transition-colors"
            >
              ← Edit Form
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'success') {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-green-800 mb-4">Thank You!</h2>
            <p className="text-green-700 mb-6">Your feedback has been submitted successfully.</p>
            <button
              onClick={handleBackToList}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Submit More Feedback
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Available Feedback Forms</h1>
      </div>

      {loading ? (
        <div className="text-center py-10 text-lg text-gray-600">Loading forms...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => {
            const isSubmitted = Boolean(template.has_submitted && template.user_submission);

            return (
              <div key={template.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-xl font-semibold text-gray-800">{template.title}</h3>
                    {isSubmitted && (
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                        ✓ Submitted
                      </span>
                    )}
                  </div>
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                    {template.office}
                  </span>
                </div>

                {template.description && (
                  <p className="text-gray-600 mb-4 line-clamp-3">{template.description}</p>
                )}

                {isSubmitted && (
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Submitted data</p>
                    <div className="space-y-2">
                      {template.user_submission.answers.slice(0, 2).map(answer => (
                        <div key={answer.field_id}>
                          <p className="text-xs font-semibold text-gray-600">{answer.label}</p>
                          <p className="text-sm text-gray-700 truncate">{formatSubmissionValue(answer.value)}</p>
                        </div>
                      ))}
                      {template.user_submission.answers.length > 2 && (
                        <p className="text-xs text-gray-600">Open the submission to view the full response.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-600 mb-4">
                  <p>Fields: {template.fields?.length || 0}</p>
                  <p>Created by: {template.created_by || 'System'}</p>
                </div>

                {/* Officer Information */}
                {template.created_by_officer_info && (
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">👤 Created By Officer</p>
                    <div className="space-y-1 text-xs text-gray-600">
                      <p><strong>Officer:</strong> {template.created_by_officer_info.officer_name}</p>
                      {template.created_by_officer_info.employee_id && (
                        <p><strong>Employee ID:</strong> {template.created_by_officer_info.employee_id}</p>
                      )}
                      {template.created_by_officer_info.department_name && (
                        <p><strong>Department:</strong> {template.created_by_officer_info.department_name}</p>
                      )}
                      {template.created_by_officer_info.college_name && (
                        <p><strong>College:</strong> {template.created_by_officer_info.college_name}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Scope Information */}
                {template.scope_info && (
                  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-semibold text-blue-800 mb-2">📍 Template Scope</p>
                    <div className="space-y-1 text-xs text-blue-700">
                      {template.scope_info.scope === 'all' && (
                        <p>Available to: All Users</p>
                      )}
                      {template.scope_info.scope === 'campus' && template.scope_info.campus_name && (
                        <p><strong>Campus:</strong> {template.scope_info.campus_name}</p>
                      )}
                      {template.scope_info.scope === 'college' && template.scope_info.college_name && (
                        <p><strong>College:</strong> {template.scope_info.college_name}</p>
                      )}
                      {template.scope_info.scope === 'department' && (
                        <>
                          {template.scope_info.department_name && (
                            <p><strong>Department:</strong> {template.scope_info.department_name}</p>
                          )}
                          {template.scope_info.college_name && (
                            <p><strong>College:</strong> {template.scope_info.college_name}</p>
                          )}
                        </>
                      )}
                      {template.scope_info.scope === 'users' && (
                        <p>Available to: Specific Users</p>
                      )}
                    </div>
                  </div>
                )}

                {isSubmitted ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      className="w-full py-3 bg-gray-200 text-gray-600 font-semibold rounded-lg cursor-not-allowed"
                    >
                      Submitted
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate(template)}
                      className="w-full py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      View Submitted Data
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full py-3 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Fill Form
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {templates.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-xl mb-2">No feedback forms available</p>
        </div>
      )}
    </div>
  );
};

const FieldInput = ({ field, value, onChange }) => {
  switch (field.field_type) {
    case 'text':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          placeholder={`Enter your ${field.label.toLowerCase()}`}
          className="w-full min-h-32 p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-y"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.is_required}
          min={field.min_value}
          max={field.max_value}
          className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      );

    case 'rating':
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={`text-3xl transition-all ${value >= star ? 'text-yellow-400 scale-110' : 'text-gray-300 hover:text-yellow-200'
                }`}
              onClick={() => onChange(star)}
            >
              ★
            </button>
          ))}
          {value && (
            <span className="ml-4 text-lg font-semibold text-gray-700">
              {value}/5
            </span>
          )}
        </div>
      );

    case 'choice':
      return (
        <div className="space-y-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name={field.id}
                value={option}
                checked={value === option}
                onChange={(e) => onChange(e.target.value)}
                required={field.is_required}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={(value || []).includes(option)}
                onChange={(e) => {
                  const currentValues = value || [];
                  if (e.target.checked) {
                    onChange([...currentValues, option]);
                  } else {
                    onChange(currentValues.filter(v => v !== option));
                  }
                }}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      );

    default:
      return <div className="text-red-500">Unknown field type: {field.field_type}</div>;
  }
};

const ReviewFieldDisplay = ({ field, value }) => {
  const formatValue = (val) => {
    if (Array.isArray(val)) {
      return val.length > 0 ? val.join(', ') : 'No response';
    }
    if (val === null || val === undefined || val === '') {
      return 'No response';
    }
    return String(val);
  };

  switch (field.field_type) {
    case 'text':
      return (
        <p className="text-gray-900 whitespace-pre-wrap break-words">{formatValue(value)}</p>
      );

    case 'number':
      return (
        <p className="text-gray-900 text-lg font-semibold">{formatValue(value)}</p>
      );

    case 'rating':
      return (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <span key={star} className={`text-2xl ${value >= star ? 'text-yellow-400' : 'text-gray-300'}`}>
                ★
              </span>
            ))}
          </div>
          <span className="text-lg font-semibold text-gray-900">{value}/5</span>
        </div>
      );

    case 'choice':
      return (
        <div className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-semibold">
          {formatValue(value)}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex flex-wrap gap-2">
          {Array.isArray(value) && value.length > 0 ? (
            value.map((item, index) => (
              <span key={index} className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                ✓ {item}
              </span>
            ))
          ) : (
            <span className="text-gray-500 italic">No response</span>
          )}
        </div>
      );

    default:
      return <div className="text-red-500">Unknown field type: {field.field_type}</div>;
  }
};

export default UserFeedback;
