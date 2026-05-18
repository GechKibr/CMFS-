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

  const timelineHighlights = useMemo(() => {
    if (!complaint) return [];
    const entries = Array.isArray(complaint.timeline_entries) ? complaint.timeline_entries : [];
    return entries.slice(-4).reverse();
  }, [complaint]);

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
    return <div className="p-6">Loading complaint details...</div>;
  }

  if (error || !complaint) {
    return (
      <div className="p-6 space-y-4">
        <button onClick={() => navigate(-1)} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
          Back
        </button>
        <p className="text-red-600">{error || 'Complaint not found'}</p>
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
          <div className="max-w-5xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate(-1)} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
                Back
              </button>
              <div className="flex items-center gap-2">
                <button onClick={loadComplaint} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">
                  Refresh
                </button>
                {(complaint.status === 'pending' || complaint.status === 'draft') && (
                  <button onClick={handleDeleteComplaint} className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">
                    Delete
                  </button>
                )}
              </div>
            </div>

            <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <h2 className="text-2xl font-semibold">{complaint.title}</h2>
              <p className="text-gray-700">{complaint.description}</p>
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-gray-600">
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Complaint ID</div>
                  <div className="mt-1 font-medium text-gray-800">{complaint.complaint_id}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                  <div className="mt-1 font-medium text-gray-800">{String(complaint.status || 'pending').replace('_', ' ')}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Category</div>
                  <div className="mt-1 font-medium text-gray-800">{complaint.category?.name || complaint.category?.office_name || 'Uncategorized'}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Current resolver</div>
                  <div className="mt-1 font-medium text-gray-800">{resolverLabel}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Claimed by</div>
                  <div className="mt-1 font-medium text-gray-800">{claimedByLabel}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">SLA escalation</div>
                  <div className="mt-1 font-medium text-gray-800">{complaint.escalation_deadline ? new Date(complaint.escalation_deadline).toLocaleString() : 'Not set'}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Resolution deadline</div>
                  <div className="mt-1 font-medium text-gray-800">{complaint.resolution_deadline ? new Date(complaint.resolution_deadline).toLocaleString() : 'Not set'}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Created</div>
                  <div className="mt-1 font-medium text-gray-800">{new Date(complaint.created_at).toLocaleString()}</div>
                </div>
              </div>
            </section>

            {timelineHighlights.length > 0 && (
              <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                <h3 className="text-lg font-semibold">Latest timeline updates</h3>
                <div className="space-y-2">
                  {timelineHighlights.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium capitalize">{entry.entry_type?.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-500">{new Date(entry.created_at).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-700">{entry.message || entry.title || 'System update'}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {attachments.length > 0 && (
              <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
                <h3 className="text-lg font-semibold">Attachments</h3>
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
                    className="block p-3 rounded border border-gray-200 hover:bg-gray-50"
                  >
                    {file.filename}
                  </a>
                ))}
              </section>
            )}

            <ComplaintConversation complaint={complaint} role="user" />
          </div>
        </main>
      </div>
    </div>
  );
};

export default UserComplaintDetail;
