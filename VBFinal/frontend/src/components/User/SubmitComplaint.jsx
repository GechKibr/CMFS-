import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const SubmitComplaint = ({ institutions, setSubmitSuccess }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [complaintForm, setComplaintForm] = useState({
    title: '',
    description: '',
    institution: ''
  });
  const [files, setFiles] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    if (!complaintForm.title.trim()) errors.title = 'Title is required';
    if (!complaintForm.description.trim()) errors.description = 'Description is required';
    if (!complaintForm.institution) errors.institution = 'Institution is required';
    if (complaintForm.description.length > 500) errors.description = 'Description must be under 500 characters';
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      return validTypes.includes(file.type) && file.size <= maxSize;
    });
    
    if (validFiles.length !== selectedFiles.length) {
      alert('Some files were rejected. Only images, PDFs, and documents under 5MB are allowed.');
    }
    
    setFiles(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 files
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', complaintForm.title);
      formData.append('description', complaintForm.description);
      formData.append('institution', complaintForm.institution);
      formData.append('status', 'pending');
      if (user?.id) formData.append('user', user.id);
      
      // Add files to form data
      files.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });

      const response = await apiService.createComplaint(formData);
      
      if (response) {
        setComplaintForm({ title: '', description: '', institution: '' });
        setFiles([]);
        setFormErrors({});
        setSubmitSuccess(true);
        
        // Hide success message after 5 seconds
        setTimeout(() => setSubmitSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Failed to submit complaint:', error);
      alert('Failed to submit complaint. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type === 'application/pdf') return '📄';
    if (file.type.includes('word')) return '📝';
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Submit New Complaint
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            🤖 Our AI will automatically categorize and assign your complaint to the appropriate department
          </p>
        </div>
        
        <div className="p-6">
          <form onSubmit={submitComplaint} className="space-y-6">
            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Complaint Title *
              </label>
              <input
                type="text"
                value={complaintForm.title}
                onChange={(e) => setComplaintForm({...complaintForm, title: e.target.value})}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} ${formErrors.title ? 'border-red-500' : ''}`}
                placeholder="Brief, descriptive title of your complaint"
              />
              {formErrors.title && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.title}</p>}
            </div>

            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Detailed Description *
              </label>
              <textarea
                value={complaintForm.description}
                onChange={(e) => setComplaintForm({...complaintForm, description: e.target.value})}
                rows="5"
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'} ${formErrors.description ? 'border-red-500' : ''}`}
                placeholder="Please provide detailed information about your complaint..."
              />
              <div className="flex justify-between items-center mt-1">
                {formErrors.description && <p className="text-red-500 text-sm flex items-center"><span className="mr-1">⚠️</span>{formErrors.description}</p>}
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} ml-auto`}>
                  {complaintForm.description.length}/500 characters
                </p>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Institution/Department *
              </label>
              <select
                value={complaintForm.institution}
                onChange={(e) => setComplaintForm({...complaintForm, institution: e.target.value})}
                className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} ${formErrors.institution ? 'border-red-500' : ''}`}
              >
                <option value="">Select the relevant institution or department</option>
                {(institutions || []).map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
              {formErrors.institution && <p className="text-red-500 text-sm mt-1 flex items-center"><span className="mr-1">⚠️</span>{formErrors.institution}</p>}
            </div>

            {/* File Upload Section */}
            <div>
              <label className={`block text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Attachments (Optional)
              </label>
              <div className={`border-2 border-dashed rounded-lg p-4 ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}`}>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center py-4"
                >
                  <div className="text-4xl mb-2">📎</div>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} text-center`}>
                    Click to upload files or drag and drop
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    Images, PDFs, Documents (Max 5MB each, up to 5 files)
                  </p>
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getFileIcon(file)}</span>
                        <div>
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {file.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'} border ${isDark ? 'border-gray-600' : 'border-blue-200'}`}>
              <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-blue-900'} mb-2`}>
                🤖 AI-Powered Processing:
              </h4>
              <ul className={`text-xs ${isDark ? 'text-gray-400' : 'text-blue-800'} space-y-1`}>
                <li>• AI will automatically detect and assign priority level</li>
                <li>• AI will categorize your complaint to the right department</li>
                <li>• Be specific about the issue and when it occurred</li>
                <li>• Include relevant details like dates, locations, or reference numbers</li>
                <li>• Attach supporting documents or images if available</li>
              </ul>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setComplaintForm({ title: '', description: '', institution: '' });
                  setFiles([]);
                  setFormErrors({});
                }}
                className={`px-6 py-3 border rounded-lg font-medium transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                Clear Form
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Submitting...</span>
                  </div>
                ) : (
                  'Submit Complaint'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitComplaint;
