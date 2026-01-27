import { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import apiService from '../../services/api';
import Modal from '../UI/Modal';

const CategoryManagement = () => {
  const { isDark } = useTheme();
  const { language, t } = useLanguage();
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  const [filters, setFilters] = useState({
    status: 'all',
    institution: 'all',
    search: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    name_amharic: '',
    description: '',
    description_amharic: '',
    institution: '',
    parent: '',
    is_active: true
  });

  useEffect(() => {
    fetchData();
  }, [pagination.currentPage, pagination.itemsPerPage]);

  useEffect(() => {
    applyFilters();
  }, [categories, filters]);

  const applyFilters = () => {
    let filtered = [...categories];
    
    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(category => 
        category.name.toLowerCase().includes(searchTerm) ||
        (category.description && category.description.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(category => {
        if (filters.status === 'active') return category.is_active;
        if (filters.status === 'inactive') return !category.is_active;
        return true;
      });
    }
    
    // Apply institution filter
    if (filters.institution !== 'all') {
      filtered = filtered.filter(category => 
        category.institution === parseInt(filters.institution)
      );
    }
    
    setFilteredCategories(filtered);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [categoriesResponse, institutionsData] = await Promise.all([
        apiService.getCategories(pagination.currentPage),
        apiService.getInstitutions()
      ]);
      
      // Handle paginated response
      if (categoriesResponse.results) {
        setCategories(categoriesResponse.results);
        setPagination(prev => ({
          ...prev,
          totalItems: categoriesResponse.count || 0,
          totalPages: Math.ceil((categoriesResponse.count || 0) / prev.itemsPerPage)
        }));
      } else {
        setCategories(categoriesResponse);
      }
      
      setInstitutions(institutionsData.results || institutionsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await apiService.updateCategory(editingCategory.category_id, formData);
      } else {
        await apiService.createCategory(formData);
      }
      
      fetchData();
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', name_amharic: '', description: '', description_amharic: '', institution: '', parent: '', is_active: true });
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      name_amharic: category.name_amharic || '',
      description: category.description || '',
      description_amharic: category.description_amharic || '',
      institution: category.institution || '',
      parent: category.parent || '',
      is_active: category.is_active
    });
    setShowModal(true);
  };

  const handleDelete = async (categoryId) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        await apiService.deleteCategory(categoryId);
        fetchData();
      } catch (error) {
        console.error('Error deleting category:', error);
      }
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', name_amharic: '', description: '', description_amharic: '', institution: '', parent: '', is_active: true });
    setShowModal(true);
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-700">Category Management</h3>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Category
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>Search</label>
            <input
              type="text"
              placeholder="Search categories..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"} mb-1`}>Institution</label>
            <select
              value={filters.institution}
              onChange={(e) => setFilters({...filters, institution: e.target.value})}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
            >
              <option value="all">All Institutions</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({status: 'all', institution: 'all', search: ''})}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Counter */}
      <div className="text-sm text-gray-600">
        Showing {filteredCategories.length} of {pagination.totalItems} categories
        {(filters.search || filters.status !== 'all' || filters.institution !== 'all') && 
          ` (filtered from ${categories.length} on this page)`
        }
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Institution</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  {filters.search || filters.status !== 'all' || filters.institution !== 'all' 
                    ? 'No categories match the current filters.' 
                    : 'No categories found. Click "Add Category" to create one.'}
                </td>
              </tr>
            ) : (
              filteredCategories.map((category) => (
                <tr key={category.category_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div>
                      <div className="font-medium">{category.name}</div>
                      {category.name_amharic && (
                        <div className="text-gray-500 text-xs mt-1">{category.name_amharic}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>
                      <div>{category.description}</div>
                      {category.description_amharic && (
                        <div className="text-gray-400 text-xs mt-1">{category.description_amharic}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {category.parent_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {institutions.find(inst => inst.id === category.institution)?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      category.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(category)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(category.category_id)}
                      className="text-red-600 hover:text-red-800"
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

      {/* Pagination */}
      <div className="bg-white px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to{' '}
            {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of{' '}
            {pagination.totalItems} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className={`px-3 py-1 rounded text-sm ${
                pagination.currentPage === 1
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
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded text-sm ${
                      page === pagination.currentPage
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                );
              } else if (
                page === pagination.currentPage - 2 ||
                page === pagination.currentPage + 2
              ) {
                return <span key={page} className="px-2">...</span>;
              }
              return null;
            })}

            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className={`px-3 py-1 rounded text-sm ${
                pagination.currentPage === pagination.totalPages
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name (English) *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
              placeholder="e.g., Academic Issues"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Name (Amharic)</label>
            <input
              type="text"
              value={formData.name_amharic}
              onChange={(e) => setFormData({...formData, name_amharic: e.target.value})}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
              placeholder="e.g., የትምህርት ጉዳዮች"
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description (English)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
              rows={3}
              placeholder="Brief description of the category"
            />
          </div>
          
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description (Amharic)</label>
            <textarea
              value={formData.description_amharic}
              onChange={(e) => setFormData({...formData, description_amharic: e.target.value})}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
              rows={3}
              placeholder="የዘርፉ አጭር መግለጫ"
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Parent Category</label>
            <select
              value={formData.parent}
              onChange={(e) => setFormData({...formData, parent: e.target.value})}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
            >
              <option value="">No Parent (Top Level Category)</option>
              {categories
                .filter(cat => cat.category_id !== editingCategory?.category_id) // Don't allow self as parent
                .map((category) => (
                <option key={category.category_id} value={category.category_id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Institution</label>
            <select
              value={formData.institution}
              onChange={(e) => setFormData({...formData, institution: e.target.value})}
              className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}`}
            >
              <option value="">Select Institution (Optional)</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
              Active
            </label>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className={`px-4 py-2 border rounded-lg transition-colors ${isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {editingCategory ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CategoryManagement;
