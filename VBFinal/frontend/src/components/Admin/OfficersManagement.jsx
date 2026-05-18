import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import apiService from '../../services/api';

const OfficersManagement = () => {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [resolvers, setResolvers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFor, setOpenFor] = useState(null); // officer id for inline create
  const [formData, setFormData] = useState({ category: '', campus: '', college: '', department: '', escalation_time: '2 00:00:00', active: true });

  const load = async () => {
    setLoading(true);
    try {
      const [usersResp, resolversResp, categoriesResp, campusesResp, collegesResp, departmentsResp] = await Promise.all([
        apiService.getAllUsers(),
        apiService.getAllCategoryResolvers(),
        apiService.getAllCategories({ forceRefresh: true }),
        apiService.getCampuses(),
        apiService.getColleges(),
        apiService.getDepartments(),
      ]);
      setUsers(usersResp.results || usersResp || []);
      setResolvers(resolversResp.results || resolversResp || []);
      setCategories(categoriesResp.results || categoriesResp || []);
      setCampuses(campusesResp.results || campusesResp || []);
      setColleges(collegesResp.results || collegesResp || []);
      setDepartments(departmentsResp.results || departmentsResp || []);
    } catch (err) {
      console.error('Failed to load officers management data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const officerResolversCount = (officer) => {
    const idStr = String(officer.id || officer.user_id || officer.account_id || '');
    return resolvers.filter(r => String(r.officer) === idStr || (Array.isArray(r.officer_ids) && r.officer_ids.map(String).includes(idStr))).length;
  };

  const openCreateFor = (officer) => {
    setOpenFor(officer.id);
    setFormData({ category: '', campus: '', college: '', department: '', escalation_time: '2 00:00:00', active: true });
  };

  const cancelCreate = () => { setOpenFor(null); setFormData({}); };

  const handleCreateAssignment = async (e, officerId) => {
    e.preventDefault();
    try {
      const payload = {
        category: formData.category,
        campus: formData.campus || null,
        college: formData.college || null,
        department: formData.department || null,
        escalation_time: formData.escalation_time || '2 00:00:00',
        active: formData.active ?? true,
        officer_ids: [String(officerId)],
      };
      await apiService.createCategoryResolverBulk(payload);
      await load();
      setOpenFor(null);
    } catch (err) {
      console.error('Failed to create assignment', err);
    }
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-6`}> 
        <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Officers</h3>
        <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>List of officer accounts and quick assignment creation.</p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolvers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.filter(u => u.role === 'officer' || u.is_staff).map((user) => (
              <React.Fragment key={user.id}>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.role}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{officerResolversCount(user)}</td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button onClick={() => openCreateFor(user)} className="text-blue-600 hover:text-blue-800">Add Assignment</button>
                  </td>
                </tr>
                {openFor === user.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-6 py-4">
                      <form onSubmit={(e) => handleCreateAssignment(e, user.id)} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <select required value={formData.category} onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))} className="border rounded px-3 py-2">
                            <option value="">Select Category</option>
                            {categories.map(c => (
                              <option key={c.category_id || c.id} value={c.category_id || c.id}>{c.office_name || c.name}</option>
                            ))}
                          </select>
                          <select value={formData.campus} onChange={(e) => setFormData(p => ({ ...p, campus: e.target.value }))} className="border rounded px-3 py-2">
                            <option value="">General / All Campuses</option>
                            {campuses.map(c => <option key={c.id} value={c.id}>{c.campus_name || c.name}</option>)}
                          </select>
                          <select value={formData.college} onChange={(e) => setFormData(p => ({ ...p, college: e.target.value }))} className="border rounded px-3 py-2">
                            <option value="">General / All Colleges</option>
                            {colleges.map(c => <option key={c.id} value={c.id}>{c.college_name || c.name}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <select value={formData.department} onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))} className="border rounded px-3 py-2">
                            <option value="">General / All Departments</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.department_name || d.name}</option>)}
                          </select>
                          <input type="text" value={formData.escalation_time} onChange={(e) => setFormData(p => ({ ...p, escalation_time: e.target.value }))} className="border rounded px-3 py-2" placeholder="2 00:00:00" />
                          <label className="flex items-center gap-2"><input type="checkbox" checked={!!formData.active} onChange={(e) => setFormData(p => ({ ...p, active: e.target.checked }))} /> Active</label>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button type="button" onClick={cancelCreate} className="px-3 py-1 border rounded">Cancel</button>
                          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">Create</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OfficersManagement;
