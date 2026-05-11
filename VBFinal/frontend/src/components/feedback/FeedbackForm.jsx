import React, { useCallback, useEffect, useState } from 'react';
import apiService from '../../services/api';

const FeedbackForm = ({ templateId, onSubmit }) => {
  const [template, setTemplate] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeedbackTemplate(templateId);
      setTemplate(data);
    } catch (error) {
      console.error('Error fetching template:', error);
      setTemplate(null);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleAnswerChange = (fieldId, value) => {
    setAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Validate number fields with min/max constraints
    let validationError = null;
    for (const field of template.fields) {
      const value = answers[field.id];

      if (field.field_type === 'number' && value !== '' && value != null) {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          if (field.min_value != null && numValue < field.min_value) {
            validationError = `"${field.label}" must be at least ${field.min_value}`;
            break;
          }
          if (field.max_value != null && numValue > field.max_value) {
            validationError = `"${field.label}" must not exceed ${field.max_value}`;
            break;
          }
        }
      }

      // Check required fields
      if (field.is_required) {
        if (field.field_type === 'checkbox' && (!value || value.length === 0)) {
          validationError = `"${field.label}" is required`;
          break;
        } else if (field.field_type !== 'checkbox' && (!value || (typeof value === 'string' && value.trim() === ''))) {
          validationError = `"${field.label}" is required`;
          break;
        }
      }
    }

    if (validationError) {
      alert(validationError);
      setSubmitting(false);
      return;
    }

    const formattedAnswers = template.fields.map(field => {
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
        template: templateId,
        answers: formattedAnswers
      });
      onSubmit && onSubmit();
      alert('Feedback submitted successfully!');
    } catch (error) {
      console.error('Error submitting feedback:', error);

      // Handle server validation errors
      if (error.response && error.response.data) {
        const data = error.response.data;
        if (data.answers && Array.isArray(data.answers)) {
          // Find the first validation error
          for (const answerError of data.answers) {
            if (answerError && typeof answerError === 'object') {
              const fieldErrors = Object.values(answerError).filter(err => err && typeof err === 'string');
              if (fieldErrors.length > 0) {
                alert(`Validation Error: ${fieldErrors[0]}`);
                setSubmitting(false);
                return;
              }
            }
          }
        }
        if (data.detail) {
          alert(`Error: ${data.detail}`);
        } else if (data.message) {
          alert(`Error: ${data.message}`);
        } else {
          alert('Failed to submit feedback. Please check your inputs.');
        }
      } else {
        alert('Failed to submit feedback');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-10 text-lg text-gray-600">Loading form...</div>;
  if (!template) return <div className="text-center py-10 text-lg text-red-600">Form not found</div>;

  return (
    <div className="max-w-3xl mx-auto p-5 bg-white rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">{template.title}</h2>
        {template.description && <p className="text-gray-600">{template.description}</p>}
      </div>

      <form onSubmit={handleSubmit}>
        {template.fields.map(field => (
          <div key={field.id} className="mb-6">
            <label className={`block font-semibold mb-2 ${field.is_required ? 'text-red-600' : 'text-gray-700'}`}>
              {field.label}
              {field.is_required && <span className="text-red-600 ml-1">*</span>}
            </label>

            <FieldInput
              field={field}
              value={answers[field.id]}
              onChange={(value) => handleAnswerChange(field.id, value)}
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-blue-500 text-white text-lg font-semibold rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>
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
          className="w-full min-h-24 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none resize-y"
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
          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      );

    case 'rating':
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              className={`text-2xl transition-opacity ${value >= star ? 'opacity-100' : 'opacity-30'} hover:opacity-70`}
              onClick={() => onChange(star)}
            >
              RATE
            </button>
          ))}
        </div>
      );

    case 'choice':
      return (
        <div className="flex flex-col gap-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name={field.id}
                value={option}
                checked={value === option}
                onChange={(e) => onChange(e.target.value)}
                required={field.is_required}
                className="m-0"
              />
              {option}
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex flex-col gap-3">
          {field.options.map((option, index) => (
            <label key={index} className="flex items-center gap-2 p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
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
                className="m-0"
              />
              {option}
            </label>
          ))}
        </div>
      );

    default:
      return <div>Unknown field type</div>;
  }
};

export default FeedbackForm;
