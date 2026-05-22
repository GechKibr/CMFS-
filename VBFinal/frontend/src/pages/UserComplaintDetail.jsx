import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import ComplaintConversation from '../components/complaints/ComplaintConversation';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { getUserNavItems } from '../constants/navigation';
import apiService from '../services/api';

const UserComplaintDetail = () => {
  const navigate = useNavigate();
  const { complaintId } = useParams();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [unreadCount] = useState(0);

  const menuItems = getUserNavItems(t, unreadCount);

  const loadComplaint = useCallback(async () => {
    if (!complaintId) return;
    setLoading(true);
    try {
      const data = await apiService.getComplaint(complaintId);
      setComplaint(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load complaint details');
      setComplaint(null);
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    loadComplaint();
  }, [loadComplaint]);

  const attachments = useMemo(() => {
    if (!complaint) return [];
    const items = Array.isArray(complaint.attachments) ? complaint.attachments : [];
    return items.map((attachment, index) => ({
      id: attachment.id || `attachment-${index}`,
      url: attachment.download_url || attachment.file,
      filename: attachment.filename || `Attachment ${index + 1}`,
    })).filter((file) => Boolean(file.url));
  }, [complaint]);

  // REMOVED: timelineHighlights - no longer needed
  // const timelineHighlights = useMemo(() => {
  //   if (!complaint) return [];
  //   const entries = Array.isArray(complaint.timeline_entries) ? complaint.timeline_entries : [];
  //   return entries.slice(-4).reverse();
  // }, [complaint]);

  const resolverLabel = complaint?.current_resolver?.scope_label || complaint?.current_resolver?.category_name || 'Unassigned';
  const claimedByLabel = complaint?.claimed_by
    ? `${complaint.claimed_by.first_name || ''} ${complaint.claimed_by.last_name || ''}`.trim() || complaint.claimed_by.email
    : 'No officer claim yet';

  const handleDeleteComplaint = async () => {
    if (!complaint) return;
    if (!(complaint.status === 'pending' || complaint.status === 'draft')) {
      window.alert('Only pending complaints can be deleted.');
      return;
    }
    if (!window.confirm('Delete this complaint? This cannot be undone.')) {
      return;
    }

    try {
      await apiService.deleteComplaint(complaint.complaint_id);
      navigate(-1);
    } catch (err) {
      window.alert(err.message || 'Failed to delete complaint');
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className={`mt-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Loading complaint details...</p>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
        <div className="max-w-5xl mx-auto">
          <button 
            onClick={() => navigate(-1)} 
            className={`px-4 py-2 rounded-lg transition-colors ${
              isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            ← Back
          </button>
          <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'}`}>
            {error || 'Complaint not found'}
          </div>
        </div>
      </div>
    );
  }

  const handleSidebarToggle = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsDesktopSidebarCollapsed((prev) => !prev);
      return;
    }
    setSidebarOpen((prev) => !prev);
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <DashboardNavbar onSidebarToggle={handleSidebarToggle} />

      <div className="flex pt-16">
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isDesktopSidebarCollapsed}
          items={menuItems}
          activeItem="my-complaints"
          onItemClick={(id) => {
            navigate(`/user?tab=${id}`);
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            navigate('/user?tab=profile');
            setSidebarOpen(false);
          }}
          onHideSidebar={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-20 top-16"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className={`flex-1 ${isDesktopSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
          <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
            {/* Header with buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <button 
                onClick={() => navigate(-1)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button 
                  onClick={loadComplaint} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700' : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                
                {(complaint.status === 'pending' || complaint.status === 'draft') && (
                  <button 
                    onClick={handleDeleteComplaint} 
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Complaint Details Card */}
            <section className={`rounded-xl border shadow-sm overflow-hidden ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <div className="p-5 md:p-6 space-y-4">
                <h2 className={`text-xl md:text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {complaint.title}
                </h2>
                <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
                  {complaint.description}
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Complaint ID</div>
                    <div className={`mt-1 font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{complaint.complaint_id}</div>
                  </div>
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Status</div>
                    <div className={`mt-1 font-medium text-sm capitalize ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {String(complaint.status || 'pending').replace('_', ' ')}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Category</div>
                    <div className={`mt-1 font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {complaint.category?.name || complaint.category?.office_name || 'Uncategorized'}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Current resolver</div>
                    <div className={`mt-1 font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{resolverLabel}</div>
                  </div>
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Claimed by</div>
                    <div className={`mt-1 font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{claimedByLabel}</div>
                  </div>
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>SLA escalation</div>
                    <div className={`mt-1 font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {complaint.escalation_deadline ? new Date(complaint.escalation_deadline).toLocaleString() : 'Not set'}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Resolution deadline</div>
                    <div className={`mt-1 font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {complaint.resolution_deadline ? new Date(complaint.resolution_deadline).toLocaleString() : 'Not set'}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-gray-900/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                    <div className={`text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Created</div>
                    <div className={`mt-1 font-medium text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      {new Date(complaint.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* REMOVED: Latest timeline updates section - completely deleted */}

            {/* Attachments Section */}
            {attachments.length > 0 && (
              <section className={`rounded-xl border shadow-sm overflow-hidden ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className="p-5 md:p-6">
                  <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Attachments
                  </h3>
                  <div className="space-y-2">
                    {attachments.map((file) => (
                      <a
                        key={file.id}
                        href={file.url}
                        onClick={async (e) => {
                          e.preventDefault();
                          try {
                            await apiService.openAuthenticatedFile(file.url, file.filename);
                          } catch (err) {
                            window.alert(err.message || 'Failed to open attachment');
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                          isDark ? 'border border-gray-700 hover:bg-gray-700/50' : 'border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className={`text-sm truncate flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {file.filename}
                        </span>
                        <svg className="w-4 h-4 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Chat Component */}
            <ComplaintConversation complaint={complaint} role="user" />
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserComplaintDetail;