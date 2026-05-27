import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const UserAnnouncements = () => {
  const { isDark } = useTheme();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInput, setCommentInput] = useState({});
  const [editingComment, setEditingComment] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getPublicAnnouncements();
      const items = Array.isArray(data) ? data : data.results || [];
      // Filter out expired announcements
      const now = new Date();
      const activeAnnouncements = items.filter(ann =>
        !ann.expires_at || new Date(ann.expires_at) > now
      );
      setAnnouncements(activeAnnouncements.sort((a, b) => {
        // Pin pinned announcements at top
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        // Sort by date descending
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }));
    } catch (_err) {
      setError(_err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (announcementId) => {
    try {
      const data = await apiService.getAnnouncementComments(announcementId);
      setCommentsMap(prev => ({ ...prev, [announcementId]: Array.isArray(data) ? data : data.results || [] }));
    } catch {
      setCommentsMap(prev => ({ ...prev, [announcementId]: [] }));
    }
  };

  const handleAddComment = async (announcementId) => {
    const message = (commentInput[announcementId] || '').trim();
    if (!message) return;
    try {
      await apiService.addAnnouncementComment(announcementId, message);
      setCommentInput(prev => ({ ...prev, [announcementId]: '' }));
      await loadComments(announcementId);
    } catch {
      // noop
    }
  };

  const handleEditComment = async (comment) => {
    const newMsg = (editingComment[comment.id] || '').trim();
    if (!newMsg) return;
    try {
      await apiService.updateAnnouncementComment(comment.id, newMsg);
      setEditingComment(prev => ({ ...prev, [comment.id]: undefined }));
      await loadComments(comment.announcement);
    } catch {
      // noop
    }
  };

  const handleDeleteComment = async (comment) => {
    try {
      await apiService.deleteAnnouncementComment(comment.id);
      await loadComments(comment.announcement);
    } catch {
      // noop
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 rounded-lg ${isDark ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
        <p className={`text-center ${isDark ? 'text-red-200' : 'text-red-600'}`}>
          {error}
        </p>
        <button
          onClick={loadAnnouncements}
          className="mt-4 mx-auto block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className={`p-12 text-center rounded-lg ${isDark ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="text-4xl mb-4">📢</div>
        <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          No announcements available at the moment
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          className={`rounded-lg border transition-all ${isDark
              ? 'bg-gray-800 border-gray-700 hover:border-blue-600'
              : 'bg-white border-gray-200 hover:border-blue-400'
            }`}
        >
          <div className="p-6 flex justify-between items-start">
            <div className="flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === announcement.id ? null : announcement.id)}>
              <div className="flex items-center gap-3">
                {announcement.is_pinned && (
                  <span className="text-red-500 text-lg">📌</span>
                )}
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {announcement.title}
                </h3>
              </div>
              <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {new Date(announcement.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              {announcement.expires_at && (
                <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setExpandedId(expandedId === announcement.id ? null : announcement.id);
                  if (!commentsMap[announcement.id]) loadComments(announcement.id);
                }}
                className={`px-3 py-1 rounded-md border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
              >
                Comments
              </button>
              <button
                className={`ml-4 p-2 rounded-full transition-colors ${isDark
                    ? 'hover:bg-gray-700'
                    : 'hover:bg-gray-100'
                  }`}
              >
                <span className={`text-xl transition-transform ${expandedId === announcement.id ? 'rotate-180' : ''
                  }`}></span>
              </button>
            </div>
          </div>

          {expandedId === announcement.id && (
            <div className={`px-6 pb-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <p className={`text-base leading-relaxed whitespace-pre-wrap ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {announcement.message}
              </p>

              <div className="mt-4">
                <div className="space-y-3">
                  {(commentsMap[announcement.id] || []).map((c) => (
                    <div key={c.id} className={`p-3 rounded-md ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="text-sm font-semibold">{c.user_name || 'Anonymous'}</div>
                          <div className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</div>
                        </div>
                        <div className="ml-4 text-right">
                          {c.user === user?.id && (
                            <div className="flex gap-2">
                              <button onClick={() => setEditingComment(prev => ({ ...prev, [c.id]: c.message }))} className="text-sm text-blue-600">Edit</button>
                              <button onClick={() => handleDeleteComment(c)} className="text-sm text-red-600">Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        {editingComment[c.id] !== undefined ? (
                          <div className="flex gap-2">
                            <input
                              value={editingComment[c.id]}
                              onChange={(e) => setEditingComment(prev => ({ ...prev, [c.id]: e.target.value }))}
                              className="flex-1 px-3 py-2 rounded border"
                            />
                            <button onClick={() => handleEditComment(c)} className="px-3 py-1 bg-green-600 text-white rounded">Save</button>
                            <button onClick={() => setEditingComment(prev => ({ ...prev, [c.id]: undefined }))} className="px-3 py-1 bg-gray-300 rounded">Cancel</button>
                          </div>
                        ) : (
                          <div className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.message}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <input
                    placeholder="Write a comment..."
                    value={commentInput[announcement.id] || ''}
                    onChange={(e) => setCommentInput(prev => ({ ...prev, [announcement.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded border"
                  />
                  <button onClick={() => handleAddComment(announcement.id)} className="px-4 py-2 bg-blue-600 text-white rounded">Send</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default UserAnnouncements;
