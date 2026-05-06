import React, { useCallback, useEffect, useState } from 'react';
import apiService from '../../services/api';

const FeedbackResponsesTable = ({ templateId, _templateTitle }) => {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.getFeedbackResponses(templateId);
      setResponses(data.responses || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
      setResponses([]);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const exportToCSV = () => {
    if (responses.length === 0) {
      alert('No responses to export');
      return;
    }

    // Collect all unique field names
    const allFields = new Set();
    responses.forEach(response => {
      if (response.answers) {
        Object.keys(response.answers).forEach(field => allFields.add(field));
      }
    });
    const fieldArray = Array.from(allFields).sort();

    // Create CSV headers - only include Submitted At and form fields
    const headers = ['Submitted At', ...fieldArray];

    // Create CSV rows
    const rows = responses.map(response => [
      response.submitted_at ? new Date(response.submitted_at).toLocaleString() : 'N/A',
      ...fieldArray.map(field => {
        const value = response.answers?.[field] || '';
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value || '');
        // Escape quotes and wrap in quotes if contains comma or newline
        return stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"` 
          : stringValue;
      })
    ]);

    // Add headers and rows together
    const csvContent = [
      headers.map(h => h.includes(',') || h.includes('"') ? `"${h}"` : h).join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `feedback-responses-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-800">All Submissions ({responses.length})</h3>
        {responses.length > 0 && (
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <span>📥</span>
            Export to CSV
          </button>
        )}
      </div>

      {responses.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No responses submitted yet
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map((response, index) => (
            <div
              key={response.id || index}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => setExpandedRow(expandedRow === index ? null : index)}
                className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-800">
                    Submitted: {response.submitted_at ? new Date(response.submitted_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <span className="text-blue-600 font-semibold text-sm">
                  {expandedRow === index ? '▼ Hide Details' : '▶ View Details'}
                </span>
              </button>

              {expandedRow === index && (
                <div className="px-6 py-4 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {response.answers && Object.entries(response.answers).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 rounded p-3 border border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
                          {key}
                        </p>
                        <p className="text-sm text-gray-800 break-words">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value || 'N/A')}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(!response.answers || Object.keys(response.answers).length === 0) && (
                    <p className="text-gray-600 text-sm italic">No answers provided</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackResponsesTable;
