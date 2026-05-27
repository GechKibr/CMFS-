import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const initialForm = {
  resolver: '',
  officer: '',
  active: true,
};

const getUserLabel = (user) => {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return fullName || user?.full_name || user?.email || `User ${user?.id ?? ''}`;
};

const getResolverLabel = (resolver) => {
  if (!resolver) return '';
  const category = resolver.category_name || resolver.category?.name || resolver.category || 'Category';
  const scope = resolver.scope_label || resolver.department_name || resolver.college_name || resolver.campus_name || 'University';
  const level = resolver.escalation_level ? `L${resolver.escalation_level}` : '';
  return [category, scope, level].filter(Boolean).join(' • ');
};

const OfficersManagement = () => {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [resolvers, setResolvers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersResp, resolversResp, membershipsResp] = await Promise.all([
        apiService.getAllUsers(),
        apiService.getAllCategoryResolvers(),
        apiService.getAllResolverOfficers(),
      ]);
      setUsers(usersResp.results || usersResp || []);
      setResolvers(resolversResp.results || resolversResp || []);
      setMemberships(membershipsResp.results || membershipsResp || []);
    } catch (err) {
      setError(err?.message || 'Failed to load officer memberships.');
      console.error('Failed to load officers management data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const officerUsers = useMemo(
    () => users.filter((user) => user.role === 'officer' || user.is_staff),
    [users],
  );

  const countsByOfficer = useMemo(() => {
    const counts = new Map();
    memberships.forEach((membership) => {
      const key = String(membership.officer ?? '');
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [memberships]);

  const filteredMemberships = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return memberships;

    return memberships.filter((membership) => {
      const officerName = (membership.officer_name || getUserLabel(officerUsers.find((user) => String(user.id) === String(membership.officer))) || '').toLowerCase();
      const resolverLabel = (membership.resolver_name || getResolverLabel(resolvers.find((resolver) => String(resolver.resolver_id || resolver.id) === String(membership.resolver))) || '').toLowerCase();
      const email = (membership.officer_email || '').toLowerCase();
      return [officerName, resolverLabel, email].some((value) => value.includes(term));
    });
  }, [memberships, search, officerUsers, resolvers]);

  const resetForm = () => {
    setEditingId(null);
    setFormData(initialForm);
  };

  const openCreate = () => {
    resetForm();
    setError('');
  };

  const openEdit = (membership) => {
    setEditingId(membership.id);
    setError('');
    setFormData({
      resolver: String(membership.resolver ?? ''),
      officer: String(membership.officer ?? ''),
      active: Boolean(membership.active),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.resolver || !formData.officer) {
      setError('Please select both a resolver assignment and an officer.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        resolver: formData.resolver,
        officer: formData.officer,
        can_claim: true,
        can_close: true,
        can_escalate: true,
        receives_notifications: true,
        active: formData.active,
      };

      if (editingId) {
        await apiService.updateResolverOfficer(editingId, payload);
      } else {
        await apiService.createResolverOfficer(payload);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to save resolver officer membership.');
      console.error('Failed to save resolver officer membership', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (membership) => {
    if (!window.confirm('Delete this officer membership?')) return;

    setError('');
    try {
      await apiService.deleteResolverOfficer(membership.id);
      if (editingId === membership.id) {
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err?.message || 'Failed to delete resolver officer membership.');
      console.error('Failed to delete resolver officer membership', err);
    }
  };

  if (loading) {
    return <div className="text-center py-6 text-gray-500">Loading officer memberships...</div>;
  }

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Officer Memberships</h3>
            {/* <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Manage which officers belong to each resolver, plus their permissions.
            </p> */}
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Membership
          </button>
        </div>
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search officer or resolver..."
              className={`mt-1 w-full rounded-lg border px-3 py-2 ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'}`}
            />
          </div>
          <div className={`rounded-lg border px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
            <div className="text-xs uppercase tracking-wide text-gray-500">Total memberships</div>
            <div className={`mt-1 text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{memberships.length}</div>
          </div>
          <div className={`rounded-lg border px-4 py-3 ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
            <div className="text-xs uppercase tracking-wide text-gray-500">Active officers</div>
            <div className={`mt-1 text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{countsByOfficer.size}</div>
          </div>
        </div>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}>
        <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {editingId ? 'Edit Membership' : 'Add Membership'}
        </h4>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Resolver</label>
              <select
                required
                value={formData.resolver}
                onChange={(e) => setFormData((prev) => ({ ...prev, resolver: e.target.value }))}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'}`}
              >
                <option value="">Select resolver</option>
                {resolvers.map((resolver) => {
                  const id = resolver.resolver_id || resolver.id;
                  return (
                    <option key={id} value={id}>
                      {getResolverLabel(resolver)}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Officer</label>
              <select
                required
                value={formData.officer}
                onChange={(e) => setFormData((prev) => ({ ...prev, officer: e.target.value }))}
                className={`mt-1 w-full rounded-lg border px-3 py-2 ${isDark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white'}`}
              >
                <option value="">Select officer</option>
                {officerUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserLabel(user)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${isDark ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
            <input
              type="checkbox"
              checked={formData.active}
              onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
            />
            <span>Active</span>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className={`rounded-lg border px-4 py-2 text-sm ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                Cancel edit
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving...' : editingId ? 'Update Membership' : 'Create Membership'}
            </button>
          </div>
        </form>
      </div>

      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full divide-y divide-gray-200">
            <thead className={isDark ? 'bg-gray-700' : 'bg-gray-50'}>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Officer</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Resolver</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {filteredMemberships.length === 0 ? (
                <tr>
                  <td colSpan={4} className={`px-6 py-8 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    No officer memberships found.
                  </td>
                </tr>
              ) : (
                filteredMemberships.map((membership) => {
                  const officer = officerUsers.find((user) => String(user.id) === String(membership.officer));
                  const resolver = resolvers.find((item) => String(item.resolver_id || item.id) === String(membership.resolver));
                  return (
                    <tr key={membership.id} className={isDark ? 'bg-gray-800' : 'hover:bg-gray-50'}>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        <div className="font-medium">{membership.officer_name || getUserLabel(officer)}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{membership.officer_email || officer?.email}</div>
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        <div className="font-medium">{membership.resolver_name || getResolverLabel(resolver)}</div>
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{membership.scope_label || resolver?.scope_label || 'University'}</div>
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs ${membership.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {membership.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                        <div className="flex gap-3">
                          <button type="button" onClick={() => openEdit(membership)} className="font-medium text-blue-600 hover:text-blue-800">
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDelete(membership)} className="font-medium text-red-600 hover:text-red-800">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OfficersManagement;
