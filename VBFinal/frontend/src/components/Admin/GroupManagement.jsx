import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import Modal from '../UI/Modal';

const emptyForm = {
  name: '',
  permission_ids: [],
  user_ids: [],
};

const GroupManagement = () => {
  const { isDark } = useTheme();
  const [groups, setGroups] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [permissionSearch, setPermissionSearch] = useState('');
  const [endpointSearch, setEndpointSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [groupsData, permsData, usersData, endpointsData] = await Promise.all([
        apiService.getGroups(),
        apiService.getPermissions(),
        apiService.getAllUsers(),
        apiService.getSystemEndpoints(),
      ]);

      setGroups(groupsData.results || groupsData || []);
      setPermissions(permsData.results || permsData || []);
      setUsers(usersData.results || usersData || []);
      setEndpoints(endpointsData.results || endpointsData || []);
    } catch (err) {
      setError('Failed to load groups and permissions.');
    } finally {
      setLoading(false);
    }
  };

  const filteredPermissions = useMemo(() => {
    const term = permissionSearch.trim().toLowerCase();
    if (!term) return permissions;
    return permissions.filter((p) =>
      `${p.app_label} ${p.name} ${p.codename}`.toLowerCase().includes(term)
    );
  }, [permissions, permissionSearch]);

  const groupedPermissions = useMemo(() => {
    return filteredPermissions.reduce((acc, permission) => {
      const key = permission.app_label || 'other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(permission);
      return acc;
    }, {});
  }, [filteredPermissions]);

  const filteredEndpoints = useMemo(() => {
    const term = endpointSearch.trim().toLowerCase();
    if (!term) return endpoints;

    return endpoints.filter((endpoint) => {
      const methodText = (endpoint.methods || []).join(' ').toLowerCase();
      return `${endpoint.path || ''} ${endpoint.name || ''} ${methodText}`
        .toLowerCase()
        .includes(term);
    });
  }, [endpoints, endpointSearch]);

  const openCreate = () => {
    setEditingGroup(null);
    setForm(emptyForm);
    setPermissionSearch('');
    setShowModal(true);
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setForm({
      name: group.name || '',
      permission_ids: (group.permissions_detail || []).map((p) => p.id),
      user_ids: (group.users_detail || []).map((u) => u.id),
    });
    setPermissionSearch('');
    setShowModal(true);
  };

  const toggleSelection = (key, id) => {
    setForm((prev) => {
      const current = prev[key] || [];
      const exists = current.includes(id);
      return {
        ...prev,
        [key]: exists ? current.filter((value) => value !== id) : [...current, id],
      };
    });
  };

  const saveGroup = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      name: form.name.trim(),
      permission_ids: form.permission_ids,
      user_ids: form.user_ids,
    };

    try {
      if (editingGroup) {
        await apiService.updateGroup(editingGroup.id, payload);
      } else {
        await apiService.createGroup(payload);
      }
      setShowModal(false);
      await loadData();
    } catch (err) {
      setError('Unable to save group. Ensure group name is unique.');
    }
  };

  const removeGroup = async (groupId) => {
    if (!window.confirm('Delete this group?')) return;
    try {
      await apiService.deleteGroup(groupId);
      await loadData();
    } catch (err) {
      setError('Unable to delete group.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading groups...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Group Management</h2>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Group
        </button>
      </div>

      {error && <div className="p-3 rounded-md bg-red-100 text-red-700 text-sm">{error}</div>}

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Group</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Permissions</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Users</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200`}>
              {groups.map((group) => (
                <tr key={group.id} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <td className={`px-6 py-4 text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{group.name}</td>
                  <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.permissions_detail?.length || 0}</td>
                  <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{group.users_detail?.length || 0}</td>
                  <td className="px-6 py-4 text-sm space-x-3">
                    <button onClick={() => openEdit(group)} className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                    <button onClick={() => removeGroup(group.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-4 space-y-3`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>System Endpoints</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>All registered API endpoints available in the system.</p>
          </div>
          <div className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Total: {endpoints.length}</div>
        </div>

        <input
          type="text"
          value={endpointSearch}
          onChange={(e) => setEndpointSearch(e.target.value)}
          placeholder="Search endpoint by path, name, or method"
          className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
        />

        <div className={`border rounded-md overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className={`max-h-96 overflow-y-auto ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className={`${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Path</th>
                  <th className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Methods</th>
                </tr>
              </thead>
              <tbody className={`${isDark ? 'bg-gray-800' : 'bg-white'} divide-y divide-gray-200`}>
                {filteredEndpoints.map((endpoint, idx) => (
                  <tr key={`${endpoint.path}-${idx}`} className={`${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                    <td className={`px-4 py-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{endpoint.path}</td>
                    <td className="px-4 py-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {(endpoint.methods || []).map((method) => (
                          <span key={`${endpoint.path}-${method}`} className={`px-2 py-1 rounded text-xs font-semibold ${method === 'GET' ? 'bg-green-100 text-green-800' : method === 'POST' ? 'bg-blue-100 text-blue-800' : method === 'PATCH' ? 'bg-yellow-100 text-yellow-800' : method === 'DELETE' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                            {method}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingGroup ? 'Edit Group' : 'Create Group'}
      >
        <form onSubmit={saveGroup} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Group Name *</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Find Permissions</label>
            <input
              type="text"
              value={permissionSearch}
              onChange={(e) => setPermissionSearch(e.target.value)}
              placeholder="Search by app, codename, or name"
              className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Permissions</label>
            <div className={`max-h-56 overflow-y-auto border rounded-md p-2 space-y-3 ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
              {Object.keys(groupedPermissions).length === 0 && (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No permissions found.</p>
              )}
              {Object.entries(groupedPermissions).map(([app, perms]) => (
                <div key={app}>
                  <p className={`text-xs uppercase font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{app}</p>
                  <div className="space-y-1">
                    {perms.map((permission) => (
                      <label key={permission.id} className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        <input
                          type="checkbox"
                          checked={form.permission_ids.includes(permission.id)}
                          onChange={() => toggleSelection('permission_ids', permission.id)}
                        />
                        <span>{permission.name} ({permission.codename})</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Assign Users</label>
            <div className={`max-h-44 overflow-y-auto border rounded-md p-2 space-y-1 ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
              {users.map((user) => (
                <label key={user.id} className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  <input
                    type="checkbox"
                    checked={form.user_ids.includes(user.id)}
                    onChange={() => toggleSelection('user_ids', user.id)}
                  />
                  <span>{user.first_name} {user.last_name} ({user.email})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className={`px-4 py-2 border rounded-md ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {editingGroup ? 'Save Group' : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default GroupManagement;
