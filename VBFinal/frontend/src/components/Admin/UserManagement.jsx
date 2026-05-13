import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const UserManagement = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [deletedAccounts, setDeletedAccounts] = useState([]);
  const [filteredDeletedAccounts, setFilteredDeletedAccounts] = useState([]);
  const [viewMode, setViewMode] = useState('active');
  const [loading, setLoading] = useState(true);
  const [deletedLoading, setDeletedLoading] = useState(true);
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    search: '',
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  });

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiService.getAllUsers();
      const usersList = data.results || data || [];
      setUsers(usersList);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeletedAccounts = useCallback(async () => {
    try {
      const data = await apiService.getAllDeletedAccounts();
      const deletedList = data.results || data || [];
      setDeletedAccounts(deletedList);
    } catch (error) {
      console.error('Failed to load deleted accounts:', error);
    } finally {
      setDeletedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadDeletedAccounts();
  }, [loadUsers, loadDeletedAccounts]);

  const applyFilters = useCallback(() => {
    const searchTerm = filters.search.trim().toLowerCase();

    const matchesSearch = (account) => {
      if (!searchTerm) return true;
      const fullName = account.full_name || `${account.first_name || ''} ${account.last_name || ''}`;
      return (
        fullName.toLowerCase().includes(searchTerm) ||
        account.email?.toLowerCase().includes(searchTerm) ||
        account.username?.toLowerCase().includes(searchTerm)
      );
    };

    const matchesRole = (account) => filters.role === 'all' || account.role === filters.role;

    const activeFiltered = users.filter((user) => {
      const statusMatches = filters.status === 'all' ? true : (
        filters.status === 'active' ? user.is_active : !user.is_active
      );
      return matchesRole(user) && statusMatches && matchesSearch(user);
    });

    const deletedFiltered = deletedAccounts.filter((account) => matchesRole(account) && matchesSearch(account));

    setFilteredUsers(activeFiltered);
    setFilteredDeletedAccounts(deletedFiltered);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, [users, deletedAccounts, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, [viewMode]);

  const updatePagination = useCallback(() => {
    const visibleAccounts = viewMode === 'deleted' ? filteredDeletedAccounts : filteredUsers;
    const totalItems = visibleAccounts.length;
    const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
    setPagination((prev) => ({ ...prev, totalItems, totalPages }));
  }, [filteredUsers, filteredDeletedAccounts, pagination.itemsPerPage, viewMode]);

  useEffect(() => {
    updatePagination();
  }, [updatePagination]);

  const getPaginatedUsers = () => {
    const visibleAccounts = viewMode === 'deleted' ? filteredDeletedAccounts : filteredUsers;
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    return visibleAccounts.slice(startIndex, endIndex);
  };

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  const availableRoleCodes = useMemo(() => ['user', 'officer', 'admin'], []);

  const getRoleLabel = (code) => {
    if (!code) return 'Unknown';
    return code.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const isAnyLoading = loading || deletedLoading;

  if (isAnyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading accounts...</div>
        </div>
      </div>
    );
  }

  const paginatedUsers = getPaginatedUsers();
  const isDeletedView = viewMode === 'deleted';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>User Management</h2>
        <button
          onClick={() => navigate('/admin/users/create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add User
        </button>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-2 rounded-lg shadow inline-flex gap-2`}>
        <button
          type="button"
          onClick={() => setViewMode('active')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'active'
            ? 'bg-blue-600 text-white'
            : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Active Accounts
        </button>
        <button
          type="button"
          onClick={() => setViewMode('deleted')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'deleted'
            ? 'bg-red-600 text-white'
            : isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Deleted Accounts
        </button>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by name, email..."
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Role
            </label>
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Roles</option>
              {availableRoleCodes.map((roleCode) => (
                <option key={roleCode} value={roleCode}>{getRoleLabel(roleCode)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              disabled={viewMode === 'deleted'}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
              Items per page
            </label>
            <select
              value={pagination.itemsPerPage}
              onChange={(e) => setPagination((prev) => ({ ...prev, itemsPerPage: parseInt(e.target.value, 10), currentPage: 1 }))}
              className={`w-full border rounded px-3 py-2 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  {isDeletedView ? 'Deleted Account' : 'User'}
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                  Role
                </th>
                {isDeletedView ? (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Deleted On
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Deleted By
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Source
                    </th>
                  </>
                ) : (
                  <>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Status
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Joined
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-500'} uppercase tracking-wider`}>
                      Actions
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200`}>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isDeletedView ? 5 : 5}
                    className={`px-6 py-10 text-center text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    {isDeletedView ? 'No deleted accounts found.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((account) => (
                  <tr key={account.id} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {isDeletedView ? (account.full_name || 'Deleted Account') : `${account.first_name} ${account.last_name}`}
                        </div>
                        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {account.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${account.role === 'admin' ? 'bg-purple-100 text-purple-800' : account.role === 'officer' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                        {account.role?.charAt(0).toUpperCase() + account.role?.slice(1) || 'User'}
                      </span>
                    </td>
                    {isDeletedView ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {account.deleted_at ? new Date(account.deleted_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {account.deleted_by || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {account.deletion_source || 'self_delete'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${account.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {account.date_joined ? new Date(account.date_joined).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => navigate(`/admin/users/${account.id}/options`)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Options
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={`px-6 py-3 border-t ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
              Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
              {pagination.totalItems} results
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className={`px-3 py-1 rounded text-sm ${pagination.currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              >
                Previous
              </button>

              {[...Array(pagination.totalPages)].map((_, index) => {
                const page = index + 1;
                if (page === 1 || page === pagination.totalPages || (page >= pagination.currentPage - 1 && page <= pagination.currentPage + 1)) {
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 rounded text-sm ${page === pagination.currentPage ? 'bg-blue-500 text-white' : isDark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
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
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className={`px-3 py-1 rounded text-sm ${pagination.currentPage === pagination.totalPages ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
