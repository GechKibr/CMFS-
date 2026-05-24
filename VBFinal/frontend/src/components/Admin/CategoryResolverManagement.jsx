import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const BackButton = ({ isDark, onClick, label = 'Back' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
  >
    <span>←</span>
    <span>{label}</span>
  </button>
);

const getLabel = (...values) => values.find((value) => value !== null && value !== undefined && value !== '') || '';
const getCategoryLabel = (item) => getLabel(item?.name, item?.office_name, item?.category_name, `Category ${item?.category_id ?? item?.id ?? ''}`);
const getCampusLabel = (item) => getLabel(item?.campus_name, item?.name, `Campus ${item?.id ?? ''}`);
const getCollegeLabel = (item) => getLabel(item?.college_name, item?.name, `College ${item?.id ?? ''}`);
const getDepartmentLabel = (item) => getLabel(item?.department_name, item?.name, `Department ${item?.id ?? ''}`);
const getUserLabel = (user) => {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return getLabel(fullName, user?.full_name, user?.email, `User ${user?.id ?? ''}`);
};
const getResolverId = (resolver) => resolver?.resolver_id || resolver?.id || '';
const DEFAULT_ESCALATION_DAYS = '0';
const DEFAULT_ESCALATION_TIME = '02:00:00';

const durationToFormValues = (duration) => {
  if (!duration) {
    return { days: DEFAULT_ESCALATION_DAYS, time: DEFAULT_ESCALATION_TIME };
  }

  const text = String(duration).trim();
  const match = text.match(/^(?:(\d+)\s+)?(\d{1,2}):(\d{2}):(\d{2})$/);

  if (!match) {
    return { days: DEFAULT_ESCALATION_DAYS, time: text || DEFAULT_ESCALATION_TIME };
  }

  const days = Number(match[1] || 0);
  const totalHours = Number(match[2] || 0) + (days * 24);
  const derivedDays = Math.floor(totalHours / 24);
  const derivedHours = totalHours % 24;

  return {
    days: String(derivedDays),
    time: `${String(derivedHours).padStart(2, '0')}:${match[3]}:${match[4]}`,
  };
};

const timeValueToDuration = (days, timeValue) => {
  if (!timeValue) return '';

  const value = String(timeValue).trim();
  const parts = value.split(':');
  const dayCount = Number(days || 0);

  if (parts.length === 2) {
    const duration = `${parts[0]}:${parts[1]}:00`;
    return dayCount > 0 ? `${dayCount} ${duration}` : duration;
  }

  return dayCount > 0 ? `${dayCount} ${value}` : value;
};

const CategoryResolverManagement = () => {
  const { isDark } = useTheme();
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [filteredResolvers, setFilteredResolvers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [collegeOptions, setCollegeOptions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [editingResolver, setEditingResolver] = useState(null);
  const [pageMode, setPageMode] = useState('home');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
  });
  const [filters, setFilters] = useState({
    category: 'all',
    campus: 'all',
    college: 'all',
    department: 'all',
    status: 'all',
    search: '',
  });
  const [formData, setFormData] = useState({
    category: '',
    campus: '',
    college: '',
    department: '',
    officer: '',
    officer_ids: [],
    escalation_days: DEFAULT_ESCALATION_DAYS,
    escalation_time: DEFAULT_ESCALATION_TIME,
    active: true,
  });

  const resetForm = () => setFormData({
    category: '',
    campus: '',
    college: '',
    department: '',
    officer: '',
    officer_ids: [],
    escalation_days: DEFAULT_ESCALATION_DAYS,
    escalation_time: DEFAULT_ESCALATION_TIME,
    active: true,
  });

  const openHomePage = () => setPageMode('home');
  const openViewPage = () => setPageMode('view');
  const openCreatePage = () => {
    setEditingResolver(null);
    resetForm();
    setPageMode('add');
  };

  const loadData = useCallback(async () => {
    try {
      const [resolversData, campusesData, collegesData, departmentsData, usersData, categoriesData] = await Promise.all([
        apiService.getAllCategoryResolvers(),
        apiService.getCampuses(),
        apiService.getColleges(),
        apiService.getDepartments(),
        apiService.getAllUsers(),
        apiService.getAllCategories({ forceRefresh: true }),
      ]);

      setCategoryResolvers(resolversData?.results || resolversData || []);
      setCampuses(campusesData?.results || campusesData || []);
      setColleges(collegesData?.results || collegesData || []);
      setCollegeOptions(collegesData?.results || collegesData || []);
      setDepartments(departmentsData?.results || departmentsData || []);
      setUsers(usersData?.results || usersData || []);
      setCategories(categoriesData?.results || categoriesData || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;

    const loadCollegeOptions = async () => {
      try {
        const response = formData.campus ? await apiService.getColleges(formData.campus) : await apiService.getColleges();
        if (cancelled) return;
        setCollegeOptions(response?.results || response || []);
      } catch {
        if (!cancelled) {
          setCollegeOptions([]);
        }
      }
    };

    loadCollegeOptions();

    return () => {
      cancelled = true;
    };
  }, [formData.campus]);

  const filteredDepartments = departments.filter((department) => !formData.college || String(department.department_college ?? '') === String(formData.college));
  const officerOptions = users.filter((user) => user.role === 'officer' || user.is_staff);

  const handleFormChange = (key, value) => {
    setFormData((prev) => {
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

  const toggleOfficerSelection = (officerId) => {
    setFormData((prev) => {
      const id = String(officerId);
      const exists = prev.officer_ids.includes(id);
      return {
        ...prev,
        officer_ids: exists
          ? prev.officer_ids.filter((item) => item !== id)
          : [...prev.officer_ids, id],
      };
    });
  };

  const applyFilters = useCallback(() => {
    let filtered = categoryResolvers;

    if (filters.category !== 'all') {
      filtered = filtered.filter((resolver) => String(resolver.category ?? '') === String(filters.category));
    }

    if (filters.campus !== 'all') {
      filtered = filtered.filter((resolver) => String(resolver.campus ?? '') === String(filters.campus));
    }

    if (filters.college !== 'all') {
      filtered = filtered.filter((resolver) => String(resolver.college ?? '') === String(filters.college));
    }

    if (filters.department !== 'all') {
      filtered = filtered.filter((resolver) => String(resolver.department ?? '') === String(filters.department));
    }

    if (filters.status !== 'all') {
      const isActive = filters.status === 'active';
      filtered = filtered.filter((resolver) => Boolean(resolver.active) === isActive);
    }

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter((resolver) => [
        resolver.category_name,
        resolver.campus_name,
        resolver.college_name,
        resolver.department_name,
        resolver.officer_name,
        resolver.scope_label,
      ].some((value) => value?.toLowerCase().includes(searchTerm)));
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pagination.itemsPerPage));
    const currentPage = Math.min(pagination.currentPage, totalPages);

    setPagination((prev) => ({
      ...prev,
      totalItems,
      totalPages,
      currentPage,
    }));

    const startIndex = (currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    setFilteredResolvers(filtered.slice(startIndex, endIndex));
  }, [categoryResolvers, filters, pagination.currentPage, pagination.itemsPerPage]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        category: formData.category,
        campus: formData.campus || null,
        college: formData.college || null,
        department: formData.department || null,
        escalation_time: timeValueToDuration(formData.escalation_days, formData.escalation_time),
        active: formData.active,
      };

      if (!payload.category) {
        throw new Error('Please select a category.');
      }

      const selectedOfficerIds = formData.officer_ids?.length
        ? formData.officer_ids
        : (formData.officer ? [formData.officer] : []);

      if (!selectedOfficerIds.length) {
        throw new Error('Please select at least one officer.');
      }

      // Use bulk-create for both create and edit so we can manage multiple officers
      // for a resolver. The backend will update_or_create the resolver and create
      // or update ResolverOfficer rows for the provided officer_ids.
      await apiService.createCategoryResolverBulk({
        ...payload,
        officer_ids: selectedOfficerIds,
        escalation_level: editingResolver?.escalation_level || 1,
      });

      setEditingResolver(null);
      resetForm();
      setPageMode('view');
      await loadData();
    } catch (error) {
      console.error('Failed to save category resolver:', error);
    }
  };

  const handleEdit = (resolver) => {
    setEditingResolver(resolver);
    // Try to read existing officer membership from resolver.officer_ids or resolver.officers
    let existingOfficerIds = [];
    
    if (resolver.officer_ids && Array.isArray(resolver.officer_ids) && resolver.officer_ids.length) {
      existingOfficerIds = resolver.officer_ids.map((id) => String(id));
    } else if (resolver.officers && Array.isArray(resolver.officers) && resolver.officers.length) {
      existingOfficerIds = resolver.officers.map((officer) => String(officer.id));
    } else if (resolver.officer_id) {
      existingOfficerIds = [String(resolver.officer_id)];
    } else if (resolver.officer) {
      existingOfficerIds = [String(resolver.officer)];
    }

    setFormData({
      category: resolver.category || '',
      campus: resolver.campus || '',
      college: resolver.college || '',
      department: resolver.department || '',
      officer: resolver.officer_id || resolver.officer || '',
      officer_ids: existingOfficerIds,
      ...durationToFormValues(resolver.escalation_time),
      active: resolver.active ?? true,
    });
    setPageMode('edit');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await apiService.deleteCategoryResolver(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete category resolver:', error);
      }
    }
  };

  const renderViewPage = () => (
    <div className="space-y-6">
      <BackButton isDark={isDark} onClick={openHomePage} />
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <h3 className="text-lg font-semibold text-gray-700">Category Resolver Assignments</h3>
        <button onClick={openCreatePage} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full sm:w-auto">
          Add Assignment
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Search</label>
            <input
              type="text"
              placeholder="Search assignment..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Categories</option>
              {categories.map((category) => (
                <option key={category.category_id || category.id} value={category.category_id || category.id}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Campus</label>
            <select
              value={filters.campus}
              onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Campuses</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {getCampusLabel(campus)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>College</label>
            <select
              value={filters.college}
              onChange={(e) => setFilters({ ...filters, college: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Colleges</option>
              {colleges.map((college) => (
                <option key={college.id} value={college.id}>
                  {getCollegeLabel(college)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Department</label>
            <select
              value={filters.department}
              onChange={(e) => setFilters({ ...filters, department: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {getDepartmentLabel(department)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ category: 'all', campus: 'all', college: 'all', department: 'all', status: 'all', search: '' })}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campus</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">College</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Officer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Escalation Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredResolvers.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                  {filters.search || filters.category !== 'all' || filters.campus !== 'all' || filters.college !== 'all' || filters.department !== 'all' || filters.status !== 'all'
                    ? 'No assignments match the current filters.'
                    : 'No category resolver assignments found.'}
                </td>
              </tr>
            ) : (
              filteredResolvers.map((resolver) => (
                <tr key={getResolverId(resolver)}>
                  <td className="px-6 py-4 text-sm text-neutral">{resolver.category_name || getCategoryLabel(categories.find((category) => String(category.category_id || category.id) === String(resolver.category)))}</td>
                  <td className="px-6 py-4 text-sm text-neutral">{resolver.campus_name || getCampusLabel(campuses.find((campus) => String(campus.id) === String(resolver.campus))) || 'General'}</td>
                  <td className="px-6 py-4 text-sm text-neutral">{resolver.college_name || getCollegeLabel(colleges.find((college) => String(college.id) === String(resolver.college))) || 'General'}</td>
                  <td className="px-6 py-4 text-sm text-neutral">{resolver.department_name || getDepartmentLabel(departments.find((department) => String(department.id) === String(resolver.department))) || 'General'}</td>
                  <td className="px-6 py-4 text-sm text-neutral">{resolver.officer_name || getUserLabel(users.find((user) => String(user.id) === String(resolver.officer)))}</td>
                  <td className="px-6 py-4 text-sm text-neutral">{resolver.escalation_time || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${resolver.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {resolver.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => handleEdit(resolver)}
                      className="text-primary hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(getResolverId(resolver))}
                      className="text-error hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="bg-white px-6 py-3 border-t border-gray-200 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
              {pagination.totalItems} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                disabled={pagination.currentPage === 1}
                className={`px-3 py-1 rounded text-sm ${pagination.currentPage === 1
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
              >
                Previous
              </button>

              {[...Array(pagination.totalPages)].map((_, index) => {
                const page = index + 1;
                if (
                  page === 1 ||
                  page === pagination.totalPages ||
                  (page >= pagination.currentPage - 1 && page <= pagination.currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setPagination((prev) => ({ ...prev, currentPage: page }))}
                      className={`px-3 py-1 rounded text-sm ${page === pagination.currentPage
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                      {page}
                    </button>
                  );
                }

                if (page === pagination.currentPage - 2 || page === pagination.currentPage + 2) {
                  return <span key={page} className="px-2">...</span>;
                }

                return null;
              })}

              <button
                onClick={() => setPagination((prev) => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                disabled={pagination.currentPage === pagination.totalPages}
                className={`px-3 py-1 rounded text-sm ${pagination.currentPage === pagination.totalPages
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFormPage = () => (
    <div className="space-y-4">
      <BackButton isDark={isDark} onClick={openHomePage} />
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{editingResolver ? 'Edit Assignment' : 'Add Assignment'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Category</label>
            <select
              value={formData.category}
              onChange={(e) => handleFormChange('category', e.target.value)}
              className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              required
            >
              <option value="">Select Category</option>
              {categories.map((category) => (
                <option key={category.category_id || category.id} value={category.category_id || category.id}>
                  {getCategoryLabel(category)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Campus</label>
              <select
                value={formData.campus}
                onChange={(e) => handleFormChange('campus', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">General / All Campuses</option>
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {getCampusLabel(campus)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>College</label>
              <select
                value={formData.college}
                onChange={(e) => handleFormChange('college', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">General / All Colleges</option>
                {collegeOptions.map((college) => (
                  <option key={college.id} value={college.id}>
                    {getCollegeLabel(college)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Department</label>
              <select
                value={formData.department}
                onChange={(e) => handleFormChange('department', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              >
                <option value="">General / All Departments</option>
                {filteredDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {getDepartmentLabel(department)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Officers
            </label>
            <div className={`mt-2 border rounded-md max-h-56 overflow-y-auto ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-white'}`}>
              {officerOptions.length === 0 ? (
                <p className={`px-3 py-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>No officers available.</p>
              ) : (
                officerOptions.map((user) => {
                  const officerId = String(user.id);
                  const selected = formData.officer_ids.includes(officerId);
                  return (
                    <label
                      key={user.id}
                      className={`flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0 cursor-pointer ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOfficerSelection(user.id)}
                      />
                      <span>{getUserLabel(user)}</span>
                    </label>
                  );
                })
              )}
            </div>
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Selected officers: {formData.officer_ids.length}
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Escalation Time</label>
            <div className="mt-1 grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={formData.escalation_days}
                onChange={(e) => handleFormChange('escalation_days', e.target.value)}
                className={`block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                aria-label="Escalation days"
                placeholder="Days"
                required
              />
              <input
                type="time"
                step="1"
                value={formData.escalation_time}
                onChange={(e) => handleFormChange('escalation_time', e.target.value)}
                className={`mt-1 block w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                required
              />
            </div>

          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => handleFormChange('active', e.target.checked)}
                className="mr-2"
              />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Active</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={openHomePage}
              className={`px-4 py-2 border rounded-md transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-800"
            >
              {editingResolver ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {pageMode === 'home' && (
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Category Resolver Assignments</h3>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={openViewPage} className="px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">View Assignments</button>
            <button onClick={openCreatePage} className={`px-4 py-3 rounded-lg border font-medium ${isDark ? 'border-gray-600 text-gray-100 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Add Assignment</button>
          </div>
        </div>
      )}

      {pageMode === 'view' && renderViewPage()}
      {(pageMode === 'add' || pageMode === 'edit') && renderFormPage()}
    </div>
  );
};

export default CategoryResolverManagement;
