import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import apiService from '../../services/api';

const formatDeadline = (value) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString();
};

const getDeadlineState = (value) => {
  if (!value) return { label: 'No deadline', tone: 'text-gray-500' };
  const deadline = new Date(value).getTime();
  if (Number.isNaN(deadline)) return { label: 'No deadline', tone: 'text-gray-500' };
  const diffHours = (deadline - Date.now()) / (1000 * 60 * 60);
  if (diffHours <= 0) return { label: 'Overdue', tone: 'text-red-600' };
  if (diffHours <= 24) return { label: 'Due soon', tone: 'text-amber-600' };
  return { label: 'On track', tone: 'text-emerald-600' };
};

const AdminComplaints = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSubTab, setActiveSubTab] = useState('complaints');
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [escalationDetails, setEscalationDetails] = useState({
    escalation_summary: { total_pending: 0, overdue_count: 0, warning_threshold_hours: 24 },
    pending_complaints: []
  });
  const [categories, setCategories] = useState([]);
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all'
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [editForm, setEditForm] = useState({
    category: '',
    campus: '',
    college: '',
    department: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const focusedComplaintId = new URLSearchParams(location.search).get('complaintId');

  const normalizeComplaintStatus = (status) => {
    if (status === 'claimed') return 'in_progress';
    if (status === 'rejected') return 'closed';
    return status || 'pending';
  };

  const normalizeValue = useCallback((value) => (value === null || value === undefined ? '' : String(value)), []);
  const normalizeText = useCallback((value) => normalizeValue(value).trim().toLowerCase(), [normalizeValue]);
  // Prefer department-specific fields before college fields to avoid showing colleges for department selects
  const getOptionValue = (option) => option?.id ?? option?.category_id ?? option?.campus_id ?? option?.department_id ?? option?.college_id ?? '';
  const getOptionLabel = (option) => option?.name ?? option?.category_name ?? option?.campus_name ?? option?.department_name ?? option?.college_name ?? option?.code ?? option?.department_college ?? '';
  const getComplaintFieldValue = (value) => normalizeValue(value);

  const getResolverFieldValue = (resolver, keys) => {
    for (const key of keys) {
      const value = resolver?.[key];
      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
    }
    return '';
  };

  const matchesResolverOption = useCallback((resolverValue, option, optionKeys) => {
    const normalizedResolverValue = normalizeText(resolverValue);
    if (!normalizedResolverValue) return false;

    return optionKeys.some((key) => normalizeText(option?.[key]) === normalizedResolverValue);
  }, [normalizeText]);

  const selectedCategoryResolvers = useMemo(() => {
    if (!editForm.category) return [];

    return categoryResolvers.filter((resolver) =>
      String(resolver.category) === String(editForm.category) && resolver.active
    );
  }, [categoryResolvers, editForm.category]);

  const filteredCampuses = useMemo(() => {
    if (!selectedCategoryResolvers.length) return campuses;
    return campuses.filter((campus) => selectedCategoryResolvers.some((resolver) =>
      matchesResolverOption(
        getResolverFieldValue(resolver, ['campus', 'campus_id', 'scope_campus', 'campus_name']),
        campus,
        ['id', 'code', 'campus_name', 'name']
      )
    ));
  }, [campuses, matchesResolverOption, selectedCategoryResolvers]);

  const filteredColleges = useMemo(() => {
    const resolversForCampus = editForm.campus
      ? selectedCategoryResolvers.filter((resolver) => matchesResolverOption(
        getResolverFieldValue(resolver, ['campus', 'campus_id', 'scope_campus', 'campus_name']),
        campuses.find((campus) => matchesResolverOption(editForm.campus, campus, ['id', 'code', 'campus_name', 'name'])),
        ['id', 'code', 'campus_name', 'name']
      ))
      : selectedCategoryResolvers;

    if (!resolversForCampus.length) return colleges;

    return colleges.filter((college) => resolversForCampus.some((resolver) =>
      matchesResolverOption(
        getResolverFieldValue(resolver, ['college', 'college_id', 'scope_college', 'college_name']),
        college,
        ['id', 'code', 'college_code', 'college_name', 'name']
      )
    ));
  }, [campuses, colleges, editForm.campus, matchesResolverOption, selectedCategoryResolvers]);

  const filteredDepartments = useMemo(() => {
    // Narrow departments by selected college first, then apply resolver-specified department filtering.
    const resolverDeptValues = selectedCategoryResolvers
      .map((resolver) => getResolverFieldValue(resolver, ['department', 'department_id', 'scope_department', 'department_name']))
      .filter(Boolean)
      .map((v) => String(v).trim().toLowerCase());

    // If a college is selected in the edit form, restrict departments to that college's departments
    let baseDepartments = departments;
    if (editForm.college) {
      const selectedCollegeObj = colleges.find((c) => String(getOptionValue(c)) === String(editForm.college) || matchesResolverOption(editForm.college, c, ['id', 'code', 'college_code', 'college_name', 'name']));
      if (selectedCollegeObj) {
        baseDepartments = departments.filter((department) => {
          const deptCollegeCandidates = [department.college, department.college_id, department.department_college, department.college_name]
            .filter(Boolean)
            .map((v) => String(v).trim().toLowerCase());

          const collegeCandidates = [selectedCollegeObj.id, selectedCollegeObj.code, selectedCollegeObj.college_id, selectedCollegeObj.college_name, selectedCollegeObj.name]
            .filter(Boolean)
            .map((v) => String(v).trim().toLowerCase());

          return deptCollegeCandidates.some((dc) => collegeCandidates.includes(dc));
        });
      }
    }

    // If no resolvers specify departments for this category/scope, return the base (college-filtered or all) departments
    if (!resolverDeptValues.length) {
      return baseDepartments;
    }

    // Otherwise, further filter by resolver department identifiers
    return baseDepartments.filter((department) => {
      const candidates = [department.id, department.department_id, department.department_name, department.name]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase());
      return resolverDeptValues.some((rv) => candidates.includes(rv));
    });
  }, [colleges, departments, editForm.college, matchesResolverOption, selectedCategoryResolvers]);

  useEffect(() => {
    loadData();
  }, []);

  const applyFilters = useCallback(() => {
    let filtered = complaints;

    if (filters.status !== 'all') {
      filtered = filtered.filter(c => normalizeComplaintStatus(c.status) === filters.status);
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter(c => c.category?.category_id === filters.category);
    }

    setFilteredComplaints(filtered);
  }, [complaints, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const loadData = async () => {
    try {
      const [complaintsData, categoriesData, resolversData, campusesData, collegesData, departmentsData] = await Promise.all([
        apiService.getComplaints(),
        apiService.getAllCategories(),
        apiService.getAllCategoryResolvers(),
        apiService.getCampuses(),
        apiService.getColleges(),
        apiService.getDepartments()
      ]);

      const escalationData = await apiService.getEscalationDetails().catch(() => null);

      setComplaints(complaintsData.results || complaintsData);
      setCategories(categoriesData.results || categoriesData || []);
      setCategoryResolvers(resolversData.results || resolversData || []);
      setCampuses(campusesData.results || campusesData || []);
      setColleges(collegesData.results || collegesData || []);
      setDepartments(departmentsData.results || departmentsData || []);
      if (escalationData) {
        setEscalationDetails(escalationData);
      }

    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateComplaintStatus = async (complaintId, newStatus) => {
    try {
      await apiService.updateComplaint(complaintId, { status: newStatus });
      setComplaints(prev =>
        prev.map(c =>
          c.complaint_id === complaintId ? { ...c, status: newStatus } : c
        )
      );
    } catch (error) {
      console.error('Failed to update complaint status:', error);
      alert('Failed to update complaint status');
    }
  };

  const openEditModal = (complaint) => {
    setEditingComplaint(complaint);
    setEditForm({
      category: getComplaintFieldValue(complaint?.category?.category_id ?? complaint?.category?.id ?? complaint?.category),
      campus: getComplaintFieldValue(complaint?.campus),
      college: getComplaintFieldValue(complaint?.college),
      department: getComplaintFieldValue(complaint?.department?.id ?? complaint?.department),
    });
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingComplaint(null);
    setSavingEdit(false);
  };

  const handleEditFieldChange = (field, value) => {
    setEditForm((prev) => {
      const next = { ...prev, [field]: String(value) };
      if (field === 'category') {
        next.campus = '';
        next.college = '';
        next.department = '';
      }
      if (field === 'campus') {
        next.college = '';
        next.department = '';
      }
      if (field === 'college') {
        next.department = '';
      }
      return next;
    });
  };

  const saveComplaintEdits = async () => {
    if (!editingComplaint) return;

    try {
      setSavingEdit(true);

      const normalize = (value) => {
        if (value === '' || value === null || value === undefined) return null;
        if (!Number.isNaN(Number(value))) return Number(value);
        return value;
      };

      await apiService.updateComplaint(editingComplaint.complaint_id, {
        category: normalize(editForm.category),
        campus: normalize(editForm.campus),
        college: normalize(editForm.college),
        department: normalize(editForm.department),
      });

      const refreshedComplaint = await apiService.getComplaint(editingComplaint.complaint_id);
      setComplaints((prev) => prev.map((complaint) => (
        complaint.complaint_id === refreshedComplaint.complaint_id ? refreshedComplaint : complaint
      )));
      closeEditModal();
    } catch (error) {
      console.error('Failed to update complaint scope:', error);
      alert('Failed to update complaint details');
      setSavingEdit(false);
    }
  };

  const getStatusBadge = (status) => {
    const normalizedStatus = normalizeComplaintStatus(status);
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      escalated: 'bg-red-100 text-red-800'
    };
    return badges[normalizedStatus] || 'bg-gray-100 text-gray-800';
  };

  const getResolverLabel = (complaint) => complaint?.current_resolver?.scope_label || complaint?.current_resolver?.category_name || 'Unassigned';

  const getClaimedLabel = (complaint) => {
    if (!complaint?.claimed_by) return 'Not claimed';
    return `${complaint.claimed_by.first_name || ''} ${complaint.claimed_by.last_name || ''}`.trim() || complaint.claimed_by.email;
  };

  const visibleComplaints = useMemo(() => {
    return filteredComplaints
      .slice()
      .sort((a, b) => {
        const aDeadline = new Date(a.escalation_deadline || 0).getTime();
        const bDeadline = new Date(b.escalation_deadline || 0).getTime();
        return aDeadline - bDeadline;
      });
  }, [filteredComplaints]);

  const escalationQueue = useMemo(() => {
    return (escalationDetails.pending_complaints || []).slice().sort((a, b) => {
      const aDeadline = new Date(a.escalation_deadline || 0).getTime();
      const bDeadline = new Date(b.escalation_deadline || 0).getTime();
      return aDeadline - bDeadline;
    });
  }, [escalationDetails.pending_complaints]);


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

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow`}>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('complaints')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${activeSubTab === 'complaints'
              ? 'bg-blue-600 text-white border-blue-600'
              : isDark
                ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
          >
            Complaints
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('escalations')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${activeSubTab === 'escalations'
              ? 'bg-red-600 text-white border-red-600'
              : isDark
                ? 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
          >
            Escalations Queue
          </button>
        </div>
      </div>

      {activeSubTab === 'complaints' && (
        <>
          {/* Filters */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Complaints Table */}
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
            {visibleComplaints.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-4">📝</div>
                <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  No complaints found
                </h3>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  No complaints match your current filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                        Complaint
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                        Status
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                        Escalation
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                        Category
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                        Submitted
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                        Workflow
                      </th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200`}>
                    {visibleComplaints.map((complaint) => {
                      const deadlineState = getDeadlineState(complaint.escalation_deadline);
                      return (
                        <tr
                          key={complaint.complaint_id}
                          className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} ${focusedComplaintId === complaint.complaint_id ? (isDark ? 'bg-blue-900/30' : 'bg-blue-50') : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {complaint.title}
                              </div>
                              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                ID: {complaint.complaint_id.slice(0, 8)}
                              </div>
                              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                By: {complaint.submitted_by?.first_name} {complaint.submitted_by?.last_name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={complaint.status}
                              onChange={(e) => updateComplaintStatus(complaint.complaint_id, e.target.value)}
                              className={`text-sm rounded px-2 py-1 ${getStatusBadge(complaint.status)} border-0`}
                            >
                              <option value="pending">Pending</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                              <option value="escalated">Escalated</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className={`font-semibold ${deadlineState.tone}`}>{deadlineState.label}</div>
                            <div className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {formatDeadline(complaint.escalation_deadline)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {complaint.category?.name || 'Uncategorized'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {new Date(complaint.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="space-y-1">
                              <div className="text-gray-700 dark:text-gray-200">{getResolverLabel(complaint)}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">Claimed: {getClaimedLabel(complaint)}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            <button
                              onClick={() => navigate(`/admin/complaints/${complaint.complaint_id}`)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View
                            </button>
                            <button
                              onClick={() => openEditModal(complaint)}
                              className="text-emerald-600 hover:text-emerald-900"
                            >
                              Reassign
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === 'escalations' && (
        <div className="space-y-6">
          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-5 rounded-lg shadow`}>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Escalation Queue</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
                <div className="text-2xl font-bold text-amber-500">{escalationDetails.escalation_summary.total_pending || 0}</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Pending escalations</div>
              </div>
              <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
                <div className="text-2xl font-bold text-red-500">{escalationDetails.escalation_summary.overdue_count || 0}</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Overdue</div>
              </div>
              <div className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4`}>
                <div className="text-2xl font-bold text-blue-500">{escalationQueue.filter((item) => (item.parent_category_resolvers || []).length > 0).length}</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Parent category matches</div>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
            {escalationQueue.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No pending escalations found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <tr>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Complaint</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Escalation Deadline</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Assigned Officer</th>
                      <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>Options</th>
                    </tr>
                  </thead>
                  <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200`}>
                    {escalationQueue.map((item) => {
                      const deadlineState = getDeadlineState(item.escalation_deadline);
                      return (
                        <tr key={item.complaint_id} className={isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</div>
                            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.category}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className={`font-semibold ${deadlineState.tone}`}>{deadlineState.label}</div>
                            <div className={`${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDeadline(item.escalation_deadline)}</div>
                            <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{item.time_until_escalation_hours} hours remaining</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {item.assigned_officer}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            <button onClick={() => navigate(`/admin/complaints/${item.complaint_id}`)} className="text-blue-600 hover:text-blue-900">View</button>
                            <button onClick={() => setActiveSubTab('complaints')} className="text-emerald-600 hover:text-emerald-900">Open Complaints</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {editModalOpen && editingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className={`${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} w-full max-w-2xl rounded-lg shadow-xl overflow-hidden`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h3 className="text-lg font-semibold">Reassign Complaint</h3>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{editingComplaint.title}</p>
              </div>
              <button
                onClick={closeEditModal}
                className={`px-3 py-2 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => handleEditFieldChange('category', e.target.value)}
                  className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                >
                  <option value="">No Category</option>
                  {categories.map((category) => (
                    <option key={category.category_id ?? category.id} value={String(getOptionValue(category))}>
                      {getOptionLabel(category)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Campus</label>
                  <select
                    value={editForm.campus}
                    onChange={(e) => handleEditFieldChange('campus', e.target.value)}
                    className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="">No Campus</option>
                    {filteredCampuses.map((campus) => (
                      <option key={campus.id ?? campus.code} value={String(getOptionValue(campus))}>
                        {getOptionLabel(campus)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>College</label>
                  <select
                    value={editForm.college}
                    onChange={(e) => handleEditFieldChange('college', e.target.value)}
                    className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="">No College</option>
                    {filteredColleges.map((college) => (
                      <option key={college.id ?? college.code} value={String(getOptionValue(college))}>
                        {getOptionLabel(college)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Department</label>
                  <select
                    value={editForm.department}
                    onChange={(e) => handleEditFieldChange('department', e.target.value)}
                    className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  >
                    <option value="">No Department</option>
                    {filteredDepartments.map((department) => (
                      <option key={department.id ?? department.department_name} value={String(getOptionValue(department))}>
                        {getOptionLabel(department)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Changing the scope updates routing for this complaint.
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${isDark ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'}`}>
              <button
                onClick={closeEditModal}
                disabled={savingEdit}
                className={`px-4 py-2 rounded ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-100 border border-gray-300'} disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={saveComplaintEdits}
                disabled={savingEdit}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminComplaints;
