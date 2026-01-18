import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import Modal from '../UI/Modal';

const ResolverLevelManagement = () => {
  const [resolverLevels, setResolverLevels] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [formData, setFormData] = useState({
    institution: '',
    name: '',
    level_order: '',
    escalation_time: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [levelsData, institutionsData] = await Promise.all([
        apiService.getResolverLevels(),
        apiService.getInstitutions()
      ]);
      setResolverLevels(levelsData);
      setInstitutions(institutionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLevel) {
        await apiService.updateResolverLevel(editingLevel.id, formData);
      } else {
        await apiService.createResolverLevel(formData);
      }
      setShowModal(false);
      setEditingLevel(null);
      setFormData({ institution: '', name: '', level_order: '', escalation_time: '' });
      loadData();
    } catch (error) {
      console.error('Failed to save resolver level:', error);
    }
  };

  const handleEdit = (level) => {
    setEditingLevel(level);
    setFormData({
      institution: level.institution,
      name: level.name,
      level_order: level.level_order,
      escalation_time: level.escalation_time
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this resolver level?')) {
      try {
        await apiService.deleteResolverLevel(id);
        loadData();
      } catch (error) {
        console.error('Failed to delete resolver level:', error);
      }
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-neutral">Resolver Levels</h3>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Add Resolver Level
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Escalation Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {resolverLevels.map((level) => (
              <tr key={level.id}>
                <td className="px-6 py-4 text-sm text-neutral">{level.institution_name}</td>
                <td className="px-6 py-4 text-sm text-neutral">{level.name}</td>
                <td className="px-6 py-4 text-sm text-neutral">Level {level.level_order}</td>
                <td className="px-6 py-4 text-sm text-neutral">{level.escalation_time}</td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => handleEdit(level)}
                    className="text-primary hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(level.id)}
                    className="text-error hover:text-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {resolverLevels.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No resolver levels found
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingLevel(null);
          setFormData({ institution: '', name: '', level_order: '', escalation_time: '' });
        }}
        title={editingLevel ? 'Edit Resolver Level' : 'Add Resolver Level'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Institution</label>
            <select
              value={formData.institution}
              onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              required
            >
              <option value="">Select Institution</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., Department Head, Dean, President"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Level Order</label>
            <input
              type="number"
              value={formData.level_order}
              onChange={(e) => setFormData({ ...formData, level_order: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="1, 2, 3..."
              min="1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Escalation Time</label>
            <input
              type="text"
              value={formData.escalation_time}
              onChange={(e) => setFormData({ ...formData, escalation_time: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="e.g., 2 days, 48:00:00"
              required
            />
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
              {editingLevel ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ResolverLevelManagement;
