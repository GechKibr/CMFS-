import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';
import Modal from '../UI/Modal';

const emptyForm = {
  name: '',
  code: '',
  level: 1,
  description: '',
  is_active: true,
};

const SuperAdminRoleManagement = () => {
  const { isDark } = useTheme();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [roleAssignments, setRoleAssignments] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [rolesData, usersData] = await Promise.all([
        apiService.getRoles(),
        apiService.getAllUsers(),
      ]);

      const roleList = rolesData.results || rolesData || [];
      const userList = usersData.results || usersData || [];

      setRoles(roleList);
      setUsers(userList);

      const assignmentMap = {};
      userList.forEach((user) => {
        assignmentMap[user.id] = user.role;
      });
      setRoleAssignments(assignmentMap);
    } catch (err) {
      setError('Failed to load roles and users.');
    } finally {
      setLoading(false);
    }
  };

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => (a.level || 0) - (b.level || 0));
  }, [roles]);

  const openCreateModal = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setShowRoleModal(true);
  };

  const openEditModal = (role) => {
    setEditingRole(role);
    setForm({
      name: role.name || '',
      code: role.code || '',
      level: role.level || 1,
      description: role.description || '',
      is_active: role.is_active !== false,
    });
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      code: (form.code || '').trim().toLowerCase(),
      level: Number(form.level || 1),
    };

    try {
      if (editingRole) {
        await apiService.updateRole(editingRole.id, payload);
      } else {
        await apiService.createRole(payload);
      }
      setShowRoleModal(false);
      await loadData();
    } catch (err) {
      setError('Unable to save role. Check uniqueness for name/code and try again.');
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) {
      return;
    }

    try {
      await apiService.deleteRole(role.id);
      await loadData();
    } catch (err) {
      setError('Unable to delete role. System roles cannot be deleted.');
    }
  };

  const handleAssign = async (userId) => {
    const selectedCode = roleAssignments[userId];
    const selectedRole = roles.find((role) => role.code === selectedCode);

    if (!selectedRole) {
      setError('Please select a valid role.');
      return;
    }

    try {
      setError('');
      await apiService.assignRoleToUser(selectedRole.id, userId);
      await loadData();
    } catch (err) {
      setError('Role assignment failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
          <div className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading role center...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>Super Admin Role Center</h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Manage role definitions and assign role levels to users.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Role
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-4`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Role Catalog</h3>
          <div className="space-y-3">
            {sortedRoles.map((role) => (
              <div key={role.id} className={`border rounded-lg p-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {role.name} ({role.code})
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Level {role.level} | {role.user_count || 0} users
                    </p>
                    {role.description && (
                      <p className={`text-sm mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{role.description}</p>
                    )}
                    {role.is_system && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs rounded bg-amber-100 text-amber-800">System Role</span>
                    )}
                  </div>
                  <div className="space-x-2">
                    <button onClick={() => openEditModal(role)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      Edit
                    </button>
                    {!role.is_system && (
                      <button onClick={() => handleDeleteRole(role)} className="text-red-600 hover:text-red-800 text-sm font-medium">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-4`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-800'}`}>Assign Roles to Users</h3>
          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {users.map((user) => (
              <div key={user.id} className={`border rounded-lg p-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.first_name} {user.last_name}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={roleAssignments[user.id] || ''}
                      onChange={(e) => setRoleAssignments((prev) => ({ ...prev, [user.id]: e.target.value }))}
                      className={`border rounded px-2 py-1 text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                    >
                      {sortedRoles.map((role) => (
                        <option key={role.id} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssign(user.id)}
                      className="px-3 py-1 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={editingRole ? 'Edit Role' : 'Create Role'}
      >
        <form onSubmit={handleSaveRole} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Role Name *</label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
            <div>
              <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Role Code *</label>
              <input
                required
                type="text"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Level *</label>
              <input
                type="number"
                min={1}
                required
                value={form.level}
                onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
            <div className="flex items-center pt-6">
              <label className={`flex items-center text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="mr-2"
                />
                Active Role
              </label>
            </div>
          </div>

          <div>
            <label className={`block text-sm mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className={`px-4 py-2 border rounded-md ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              {editingRole ? 'Save Role' : 'Create Role'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SuperAdminRoleManagement;
