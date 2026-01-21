import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const MyComplaints = ({ getStatusBadge, getPriorityBadge }) => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all'
  });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showRatingForm, setShowRatingForm] = useState(false);

  useEffect(() => {
    loadComplaints();
    loadCategories();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [complaints, filters]);

  const loadComplaints = async () => {
    try {
      const data = await apiService.getComplaints();
      const userComplaints = (data.results || data).filter(
        complaint => complaint.submitted_by?.id === user?.id
      );
      setComplaints(userComplaints);
    } catch (error) {
      console.error('Failed to load complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await apiService.getCategories();
      setCategories(data.results || data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const applyFilters = () => {
    let filtered = complaints;
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(c => c.status === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(c => c.category?.category_id === filters.category);
    }
    if (filters.priority !== 'all') {
      filtered = filtered.filter(c => c.priority === filters.priority);
    }
    
    setFilteredComplaints(filtered);
  };

  const getStats = () => {
    const total = complaints.length;
    const pending = complaints.filter(c => c.status === 'pending').length;
    const inProgress = complaints.filter(c => c.status === 'in_progress').length;
    const resolved = complaints.filter(c => c.status === 'resolved').length;
    
    return { total, pending, inProgress, resolved };
  };

  const loadComments = async (complaintId) => {
    try {
      const data = await apiService.getComplaintComments(complaintId);
      setComments(data.results || data);
    } catch (error) {
      console.error('Failed to load comments:', error);
      setComments([]);
    }
  };

  const submitRating = async () => {
    if (!rating || !selectedComplaint) return;
    
    try {
      await apiService.addComplaintRating(selectedComplaint.complaint_id, rating, feedback);
      setShowRatingForm(false);
      setRating(0);
      setFeedback('');
      alert('Rating submitted successfully!');
    } catch (error) {
      console.error('Failed to submit rating:', error);
      alert('Failed to submit rating');
    }
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading complaints...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-blue-500">{stats.total}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Complaints</div>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pending</div>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>In Progress</div>
        </div>
        <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Resolved</div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Category
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Priority
            </label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Complaints List */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        {filteredComplaints.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📝</div>
            <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
              No complaints found
            </h3>
            <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {complaints.length === 0 
                ? "You haven't submitted any complaints yet." 
                : "No complaints match your current filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredComplaints.map((complaint) => (
              <div key={complaint.complaint_id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {complaint.title}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(complaint.status)}`}>
                        {complaint.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getPriorityBadge(complaint.priority)}`}>
                        {complaint.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-2`}>
                      {complaint.description.length > 100 
                        ? `${complaint.description.substring(0, 100)}...` 
                        : complaint.description}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>ID: {complaint.complaint_id.slice(0, 8)}</span>
                      <span>Category: {complaint.category?.name || 'Uncategorized'}</span>
                      <span>Created: {new Date(complaint.created_at).toLocaleDateString()}</span>
                      {complaint.attachments?.length > 0 && (
                        <span className="flex items-center">
                          📎 {complaint.attachments.length} file(s)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedComplaint(complaint);
                      setShowModal(true);
                      loadComments(complaint.complaint_id);
                    }}
                    className="ml-4 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedComplaint && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Complaint Details
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  {selectedComplaint.title}
                </h3>
                <div className="flex items-center space-x-2 mb-4">
                  <span className={`px-3 py-1 rounded-full text-sm ${getStatusBadge(selectedComplaint.status)}`}>
                    {selectedComplaint.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded text-sm ${getPriorityBadge(selectedComplaint.priority)}`}>
                    {selectedComplaint.priority.toUpperCase()}
                  </span>
                </div>
                <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} mb-4`}>
                  {selectedComplaint.description}
                </p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>ID:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedComplaint.complaint_id}
                    </span>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {selectedComplaint.category?.name || 'Uncategorized'}
                    </span>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Created:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {new Date(selectedComplaint.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Updated:</span>
                    <span className={`ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {new Date(selectedComplaint.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                {selectedComplaint.attachments?.length > 0 && (
                  <div className="mt-4">
                    <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                      Attachments:
                    </h4>
                    <div className="space-y-2">
                      {selectedComplaint.attachments.map((attachment, index) => (
                        <div key={index} className={`flex items-center p-2 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <span className="text-lg mr-2">📎</span>
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {attachment.filename}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Officer Responses */}
                {comments.length > 0 && (
                  <div className="mt-6">
                    <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                      Officer Responses:
                    </h4>
                    <div className="space-y-3">
                      {comments.map((comment, index) => (
                        <div key={index} className={`p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                              {comment.author?.name || 'Officer'}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {comment.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rating Section */}
                {selectedComplaint.status === 'resolved' && (
                  <div className="mt-6">
                    {!showRatingForm ? (
                      <button
                        onClick={() => setShowRatingForm(true)}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                      >
                        Rate This Resolution
                      </button>
                    ) : (
                      <div className={`p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <h4 className={`font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-3`}>
                          Rate the Resolution:
                        </h4>
                        <div className="flex items-center space-x-2 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRating(star)}
                              className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                            >
                              ⭐
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          placeholder="Optional feedback..."
                          className={`w-full p-2 rounded border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-white border-gray-300'} mb-3`}
                          rows="3"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={submitRating}
                            disabled={!rating}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
                          >
                            Submit Rating
                          </button>
                          <button
                            onClick={() => {
                              setShowRatingForm(false);
                              setRating(0);
                              setFeedback('');
                            }}
                            className={`px-4 py-2 rounded transition-colors ${isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyComplaints;
