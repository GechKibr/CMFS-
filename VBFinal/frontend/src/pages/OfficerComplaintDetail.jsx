import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import ComplaintConversation from '../components/complaints/ComplaintConversation';
import DashboardNavbar from '../components/UI/DashboardNavbar';
import Sidebar from '../components/UI/Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { OFFICER_NAV_ITEMS } from '../constants/navigation';
import apiService from '../services/api';

const getFileIcon = (contentType = '', filename = '') => {
  const ext = filename.toLowerCase();
  const type = contentType.toLowerCase();

  if (type.includes('image') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(ext)) return 'IMG';
  if (type.includes('pdf') || ext.endsWith('.pdf')) return 'PDF';
  if (type.includes('word') || type.includes('document') || /\.(doc|docx|txt)$/.test(ext)) return 'DOC';
  if (type.includes('excel') || type.includes('sheet') || /\.(xls|xlsx|csv)$/.test(ext)) return 'XLS';
  return 'FILE';
};

const getResolverFieldValue = (resolver, field) => resolver?.[field] ?? '';

const buildUniqueOptions = (items, valueField, labelField, fallbackPrefix) => {
  const options = new Map();

  items.forEach((item) => {
    const value = getResolverFieldValue(item, valueField);
    if (value === '' || value === null || value === undefined) return;

    const key = String(value);
    if (!options.has(key)) {
      const label = String(getResolverFieldValue(item, labelField) || `${fallbackPrefix} ${key}`);
      options.set(key, { value: key, label });
    }
  });

  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
};

const OfficerComplaintDetail = () => {
  const navigate = useNavigate();
  const { complaintId } = useParams();
  const { logout } = useAuth();
  const { isDark } = useTheme();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStatus, setNewStatus] = useState('pending');
  const [showOtherResolvers, setShowOtherResolvers] = useState(false);
  const [otherResolvers, setOtherResolvers] = useState([]);
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [resolverFilters, setResolverFilters] = useState({ campus: '', college: '', department: '' });
  const [loadingResolvers, setLoadingResolvers] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const loadComplaint = useCallback(async () => {
    if (!complaintId) return;
    setLoading(true);
    try {
      const data = await apiService.getComplaint(complaintId);
      setComplaint(data);
      setNewStatus(data?.status || 'pending');
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

  useEffect(() => {
    let cancelled = false;

    const loadCategoryResolvers = async () => {
      try {
        const resolversData = await apiService.getAllCategoryResolvers();
        if (cancelled) return;

        setCategoryResolvers(resolversData?.results || resolversData || []);
      } catch {
        if (!cancelled) {
          setCategoryResolvers([]);
        }
      }
    };

    loadCategoryResolvers();
    return () => {
      cancelled = true;
    };
  }, []);

  const attachments = useMemo(() => {
    if (!complaint) return [];
    const items = Array.isArray(complaint.attachments) ? complaint.attachments : [];
    return items.map((attachment, index) => ({
      id: attachment.id || `attachment-${index}`,
      url: attachment.download_url || attachment.file,
      filename: attachment.filename || `Attachment ${index + 1}`,
      file_size: attachment.file_size,
      content_type: attachment.content_type || '',
      uploaded_at: attachment.uploaded_at || complaint.created_at,
    })).filter((file) => Boolean(file.url));
  }, [complaint]);

  const complaintCategoryId = complaint?.category?.category_id || complaint?.category?.id || '';
  const currentResolver = complaint?.current_resolver?.scope_label || complaint?.current_resolver?.category_name || 'Unassigned';
  const resolverPoolForCategory = useMemo(() => {
    if (!complaintCategoryId) return [];
    return categoryResolvers.filter((resolver) => String(getResolverFieldValue(resolver, 'category')) === String(complaintCategoryId));
  }, [categoryResolvers, complaintCategoryId]);
  const campusOptions = useMemo(() => buildUniqueOptions(resolverPoolForCategory, 'campus', 'campus_name', 'Campus'), [resolverPoolForCategory]);
  const collegeOptions = useMemo(() => {
    const campusScopedResolvers = resolverPoolForCategory.filter((resolver) => !resolverFilters.campus || String(getResolverFieldValue(resolver, 'campus')) === String(resolverFilters.campus));
    return buildUniqueOptions(campusScopedResolvers, 'college', 'college_name', 'College');
  }, [resolverPoolForCategory, resolverFilters.campus]);
  const departmentOptions = useMemo(() => {
    const collegeScopedResolvers = resolverPoolForCategory.filter((resolver) => (
      (!resolverFilters.campus || String(getResolverFieldValue(resolver, 'campus')) === String(resolverFilters.campus)) &&
      (!resolverFilters.college || String(getResolverFieldValue(resolver, 'college')) === String(resolverFilters.college))
    ));
    return buildUniqueOptions(collegeScopedResolvers, 'department', 'department_name', 'Department');
  }, [resolverPoolForCategory, resolverFilters.campus, resolverFilters.college]);
  const claimedByLabel = complaint?.claimed_by
    ? `${complaint.claimed_by.first_name || ''} ${complaint.claimed_by.last_name || ''}`.trim() || complaint.claimed_by.email
    : 'Not claimed';

  const handleUpdateStatus = async () => {
    if (!complaint) return;
    try {
      await apiService.changeComplaintStatus(complaint.complaint_id, newStatus);
      await loadComplaint();
      window.alert('Status updated successfully');
    } catch (err) {
      window.alert(err.message || 'Failed to update status');
    }
  };

  const openOtherResolvers = async () => {
    if (!complaint) return;
    setShowOtherResolvers(true);
    setLoadingResolvers(true);
    try {
      const params = {
        exclude_category: null,
        category: complaint?.category?.category_id || complaint?.category?.id || null,
        complaint: complaint.complaint_id,
        campus: resolverFilters.campus || null,
        college: resolverFilters.college || null,
        department: resolverFilters.department || null,
      };
      const resp = await apiService.getOtherCategoryResolvers(params);
      const items = (resp?.results) || resp || [];
      setOtherResolvers(items);
    } catch {
      setOtherResolvers([]);
      window.alert('Failed to load other resolvers');
    } finally {
      setLoadingResolvers(false);
    }
  };

  const handleResolverFilterChange = (key, value) => {
    setResolverFilters((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'campus') {
        next.college = '';
        next.department = '';
      }

      if (key === 'college') {
        next.department = '';
      }

      return next;
    });
  };

  const handleOpenAttachment = async (file) => {
    try {
      await apiService.openAuthenticatedFile(file.url, file.filename);
    } catch (err) {
      window.alert(err.message || 'Failed to open attachment');
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
      <DashboardNavbar onSidebarToggle={handleSidebarToggle} showOfficerNotifications />

      <div className="flex pt-16">
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={isDesktopSidebarCollapsed}
          items={OFFICER_NAV_ITEMS}
          activeItem="complaints"
          onItemClick={(id) => {
            navigate(`/officer?tab=${id}`, { replace: true });
            setSidebarOpen(false);
          }}
          onLogout={() => {
            logout();
            navigate('/login');
          }}
          onProfileClick={() => {
            navigate('/officer?tab=profile', { replace: true });
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
          <div className="max-w-6xl mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => navigate(-1)} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
                Back
              </button>
              <button onClick={loadComplaint} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200">
                Refresh
              </button>
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
                  <div className="text-xs uppercase tracking-wide text-gray-500">Current resolver</div>
                  <div className="mt-1 font-medium text-gray-800">{currentResolver}</div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Claimed by</div>
                  <div className="mt-1 font-medium text-gray-800">{claimedByLabel}</div>
                </div>
                {/* <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Reassign Options</div>
                  <div className="mt-1 text-sm text-gray-800">
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={openOtherResolvers} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Reassign</button>
                      <button type="button" onClick={openOtherResolvers} className="px-3 py-1 rounded bg-gray-200 text-sm">Browse other resolvers</button>
                    </div>
                  </div>
                </div> */}
                <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">Category</div>
                  <div className="mt-1 font-medium text-gray-800">{complaint.category?.name || complaint.category?.office_name || 'Uncategorized'}</div>
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
                  <div className="text-xs uppercase tracking-wide text-gray-500">Submitted by</div>
                  <div className="mt-1 font-medium text-gray-800">
                    {!complaint.is_anonymous && complaint.submitted_by
                      ? `${complaint.submitted_by?.first_name || ''} ${complaint.submitted_by?.last_name || ''}`.trim() || complaint.submitted_by?.email
                      : 'Anonymous'}
                  </div>
                </div>
              </div>
            </section>

            {/* Recent workflow activity removed per request */}

            <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="escalated">Escalated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button onClick={handleUpdateStatus} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
                  Update Status
                </button>
                {/* <button onClick={openOtherResolvers} className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700">
                  Reassign
                </button> */}
              </div>

              {showOtherResolvers && (
                <>
                  <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowOtherResolvers(false)} />
                  <aside className={`fixed right-0 top-16 bottom-0 z-50 w-full max-w-xl ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} shadow-2xl border-l ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-col`}>
                    <div className={`px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex items-center justify-between`}>
                      <div>
                        <h4 className="font-semibold text-lg">Reassign Complaint</h4>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Update scope, then select the officer and resolver.</p>
                      </div>
                      <button type="button" onClick={() => setShowOtherResolvers(false)} className={`px-3 py-1 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        Close
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                      <section className={`rounded-lg border p-4 ${isDark ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Campus</label>
                            <select
                              name="campus"
                              value={resolverFilters.campus}
                              onChange={(e) => handleResolverFilterChange('campus', e.target.value)}
                              className={`w-full px-3 py-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                            >
                              <option value="">Select campus</option>
                              {campusOptions.map((campus) => (
                                <option key={campus.value} value={campus.value}>
                                  {campus.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>College</label>
                            <select
                              name="college"
                              value={resolverFilters.college}
                              onChange={(e) => handleResolverFilterChange('college', e.target.value)}
                              className={`w-full px-3 py-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                            >
                              <option value="">Select college</option>
                              {collegeOptions.map((college) => (
                                <option key={college.value} value={college.value}>
                                  {college.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={`block text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Department</label>
                            <select
                              name="department"
                              value={resolverFilters.department}
                              onChange={(e) => handleResolverFilterChange('department', e.target.value)}
                              className={`w-full px-3 py-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                            >
                              <option value="">Select department</option>
                              {departmentOptions.map((department) => (
                                <option key={department.value} value={department.value}>
                                  {department.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </section>

                      <section className={`rounded-lg border p-4 ${isDark ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h5 className="font-semibold">Resolver Matches</h5>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{loadingResolvers ? 'Loading resolvers...' : `${otherResolvers.length} resolver(s) found`}</p>
                          </div>
                          <button type="button" onClick={openOtherResolvers} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">
                            Refresh
                          </button>
                        </div>

                        <div className="space-y-2 max-h-[42vh] overflow-auto pr-1">
                          {loadingResolvers ? (
                            <div className="text-sm text-gray-600">Loading resolvers...</div>
                          ) : otherResolvers.length === 0 ? (
                            <div className="text-sm text-gray-600">No resolvers found.</div>
                          ) : otherResolvers.map((r) => (
                            <div key={r.resolver_id} className={`p-3 rounded border ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-white'}`}>
                              <div className="flex justify-between items-start gap-3">
                                <div>
                                  <div className="font-medium">{r.category_name || r.scope_label}</div>
                                  <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {r.scope_label || 'University'}{r.campus_name ? ` · ${r.campus_name}` : ''}{r.college_name ? ` · ${r.college_name}` : ''}{r.department_name ? ` · ${r.department_name}` : ''}
                                  </div>
                                </div>
                                <div className="text-sm whitespace-nowrap">{r.officers_count} officers</div>
                              </div>
                              {r.officers && r.officers.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 gap-2">
                                  {r.officers.map((off) => (
                                    <div key={off.id} className="flex items-center justify-between gap-2">
                                      <div className="text-sm">{`${off.first_name || ''} ${off.last_name || ''}`.trim() || off.email}</div>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await apiService.updateComplaint(complaint.complaint_id, {
                                              category: resolverFilters.category || complaint.category?.category_id || complaint.category?.id || null,
                                              campus: resolverFilters.campus || null,
                                              college: resolverFilters.college || null,
                                              department: resolverFilters.department || null,
                                            });

                                            await apiService.reassignComplaint(complaint.complaint_id, {
                                              officer_id: Number(off.id),
                                              resolver_id: r.resolver_id,
                                              reason: 'Reassigned by officer',
                                            });

                                            setShowOtherResolvers(false);
                                            await loadComplaint();
                                            window.alert('Complaint reassigned successfully');
                                          } catch (err) {
                                            window.alert(err.message || 'Failed to reassign complaint');
                                          }
                                        }}
                                        className="px-2 py-1 rounded bg-green-600 text-white text-sm"
                                      >
                                        Select
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </section>

                      <div className="flex items-center justify-end gap-3">
                        <button type="button" onClick={() => setShowOtherResolvers(false)} className={`px-4 py-2 rounded ${isDark ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'}`}>
                          Cancel
                        </button>
                        <button type="button" onClick={openOtherResolvers} className="px-4 py-2 rounded bg-blue-600 text-white">
                          Reassign
                        </button>
                      </div>
                    </div>
                  </aside>
                </>
              )}
            </section>

            {attachments.length > 0 && (
              <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
                <h3 className="text-lg font-semibold">Attachments</h3>
                <div className="space-y-2">
                  {attachments.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => handleOpenAttachment(file)}
                      className="flex items-center justify-between p-3 rounded border border-gray-200 hover:bg-gray-50"
                    >
                      <span className="text-sm text-gray-700">{getFileIcon(file.content_type, file.filename)} - {file.filename}</span>
                      <span className="text-xs text-gray-500">Open</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <ComplaintConversation complaint={complaint} role="officer" />
          </div>
        </main>
      </div>
    </div>
  );
};

export default OfficerComplaintDetail;
