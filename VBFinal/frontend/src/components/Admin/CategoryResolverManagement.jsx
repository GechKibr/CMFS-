import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import Modal from '../UI/Modal';

const CategoryResolverManagement = () => {
  const [categoryResolvers, setCategoryResolvers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [resolverLevels, setResolverLevels] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingResolver, setEditingResolver] = useState(null);
  const [formData, setFormData] = useState({
    category: '',
    level: '',
    officer: '',
    active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resolversData, categoriesData, levelsData, usersData] = await Promise.all([
        apiService.getCategoryResolvers(),
        apiService.getCategories(),
        apiService.getResolverLevels(),
        apiService.getUsers()
      ]);
      setCategoryResolvers(resolversData);
      setCategories(categoriesData);
      setResolverLevels(levelsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingResolver) {
        await apiService.updateCategoryResolver(editingResolver.id, formData);
      } else {
        await apiService.createCategoryResolver(formData);
      }
      setShowModal(false);
      setEditingResolver(null);
      setFormData({ category: '', level: '', officer: '', active: true });
      loadData();
    } catch (error) {
      console.error('Failed to save category resolver:', error);
    }
  };

  const handleEdit = (resolver) => {
    setEditingResolver(resolver);
    setFormData({
      category: resolver.category,
      level: resolver.level,
      officer: resolver.officer,
      active: resolver.active
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      try {
        await apiService.deleteCategoryResolver(id);
        loadData();
      } catch (error) {
        console.error('Failed to delete category resolver:', error);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-neutral">Category Resolver Assignments</h3>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Add Assignment
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Officer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categoryResolvers.map((resolver) => (
              <tr key={resolver.id}>
                <td className="px-6 py-4 text-sm text-neutral">{resolver.category_name}</td>
                <td className="px-6 py-4 text-sm text-neutral">{resolver.level_name}</td>
                <td className="px-6 py-4 text-sm text-neutral">{resolver.officer_name}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    resolver.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
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
                    onClick={() => handleDelete(resolver.id)}
                    className="text-error hover:text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categoryResolvers.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No category resolver assignments found
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingResolver(null);
          setFormData({ category: '', level: '', officer: '', active: true });
        }}
        title={editingResolver ? 'Edit Assignment' : 'Add Assignment'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Resolver Level</label>
            <select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select Level</option>
              {resolverLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.institution_name} - {level.name} (Level {level.level_order})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Officer</label>
            <select
              value={formData.officer}
              onChange={(e) => setFormData({ ...formData, officer: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select Officer</option>
              {users.filter(user => user.role === 'officer' || user.is_staff).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.first_name} {user.last_name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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
      </Modal>
    </div>
  );
};

export default CategoryResolverManagement;
