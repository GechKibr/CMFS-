import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/UI/Modal';
import AdminSettings from '../components/Admin/AdminSettings';
import UserManagement from '../components/Admin/UserManagement';
import InstitutionManagement from '../components/Admin/InstitutionManagement';
import CategoryManagement from '../components/Admin/CategoryManagement';
import CategoryResolverManagement from '../components/Admin/CategoryResolverManagement';
import apiService from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [newComplaint, setNewComplaint] = useState({
    title: '',
    description: '',
    institution: '',
    category: ''
  });

  // Fetch data from backend
  useEffect(() => {
    fetchComplaints();
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [user]);

  const fetchAllCategories = async () => {
    let allCategories = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await apiService.getCategories(page);
        if (response.results) {
          allCategories = [...allCategories, ...response.results];
          hasMore = !!response.next;
        } else if (Array.isArray(response)) {
          allCategories = [...allCategories, ...response];
          hasMore = false;
        } else {
          hasMore = false;
        }
        page++;
      } catch (error) {
        console.error(`Error fetching categories page ${page}:`, error);
        hasMore = false;
      }
    }
    return allCategories;
  };

  const fetchAdminData = async () => {
    try {
      const [categoriesData, usersData, institutionsData] = await Promise.all([
        fetchAllCategories(),
        apiService.getUsers(),
        apiService.getInstitutions()
      ]);
      
      setCategories(categoriesData);
      setUsers(usersData.results || usersData);
      setInstitutions(institutionsData.results || institutionsData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  const fetchComplaints = async () => {
    try {
      const response = await fetch('/api/complaints/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setComplaints(data.results || data);
    } catch (error) {
      console.error('Error fetching complaints:', error);
      // Fallback to mock data
      setComplaints([
        { id: 1, title: 'Library Access Issue', status: 'open', date: '2026-01-15', category: 'Academic' },
        { id: 2, title: 'Cafeteria Service', status: 'resolved', date: '2026-01-10', category: 'Services' },
        { id: 3, title: 'Parking Problem', status: 'pending', date: '2026-01-12', category: 'Infrastructure' }
      ]);
    }
  };

  const handleSubmitComplaint = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/complaints/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newComplaint)
      });

      if (response.ok) {
        fetchComplaints();
        setNewComplaint({ title: '', description: '', institution: '', category: '' });
      }
    } catch (error) {
      console.error('Error submitting complaint:', error);
      // Fallback to local state update
      const complaint = {
        id: Date.now(),
        ...newComplaint,
        status: 'open',
        date: new Date().toISOString().split('T')[0]
      };
      setComplaints([complaint, ...complaints]);
      setNewComplaint({ title: '', description: '', institution: '', category: '' });
    }
  };

  const getTabs = () => {
    const baseTabs = [
      { id: 'overview', name: 'Overview' },
      { id: 'complaints', name: 'My Complaints' },
      { id: 'submit', name: 'Submit Complaint' }
    ];

    if (user?.role === 'admin') {
      return [
        ...baseTabs,
        { id: 'institutions', name: 'Institutions' },
        { id: 'categories', name: 'Categories' },
        { id: 'category-resolvers', name: 'Category Resolvers' },
        { id: 'users', name: 'Users' },
        { id: 'settings', name: 'AI Settings' }
      ];
    }

    if (user?.role === 'officer') {
      return [
        ...baseTabs,
        { id: 'assigned', name: 'Assigned' },
        { id: 'history', name: 'History' }
      ];
    }

    return baseTabs;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        if (user?.role === 'admin') {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Total Complaints</h3>
                <p className="text-3xl font-bold text-blue-700">{complaints.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Total Categories</h3>
                <p className="text-3xl font-bold text-purple-700">{categories.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Total Users</h3>
                <p className="text-3xl font-bold text-green-700">{users.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Institutions</h3>
                <p className="text-3xl font-bold text-orange-700">{institutions.length}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Open Complaints</h3>
                <p className="text-3xl font-bold text-yellow-500">
                  {complaints.filter(c => c.status === 'open' || c.status === 'pending').length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Resolved</h3>
                <p className="text-3xl font-bold text-green-500">
                  {complaints.filter(c => c.status === 'resolved').length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Active Categories</h3>
                <p className="text-3xl font-bold text-indigo-700">
                  {categories.filter(c => c.is_active).length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Officers</h3>
                <p className="text-3xl font-bold text-red-700">
                  {users.filter(u => u.role === 'officer').length}
                </p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-700">Total Complaints</h3>
              <p className="text-3xl font-bold text-blue-700">{complaints.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-700">Open</h3>
              <p className="text-3xl font-bold text-yellow-500">
                {complaints.filter(c => c.status === 'open' || c.status === 'pending').length}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-700">Resolved</h3>
              <p className="text-3xl font-bold text-green-500">
                {complaints.filter(c => c.status === 'resolved').length}
              </p>
            </div>
          </div>
        );

      case 'complaints':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">My Complaints</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {complaints.map((complaint) => (
                      <tr key={complaint.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {complaint.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {complaint.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={complaint.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {complaint.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'submit':
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Submit New Complaint</h3>
            <form onSubmit={handleSubmitComplaint} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  required
                  value={newComplaint.title}
                  onChange={(e) => setNewComplaint({...newComplaint, title: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-700 focus:border-blue-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  required
                  rows={4}
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({...newComplaint, description: e.target.value})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-700 focus:border-blue-700"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Institution</label>
                  <input
                    type="text"
                    value={newComplaint.institution}
                    onChange={(e) => setNewComplaint({...newComplaint, institution: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-700 focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    value={newComplaint.category}
                    onChange={(e) => setNewComplaint({...newComplaint, category: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-700 focus:border-blue-700"
                  >
                    <option value="">Select Category</option>
                    <option value="Academic">Academic</option>
                    <option value="Services">Services</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Administrative">Administrative</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                Submit Complaint
              </button>
            </form>
          </div>
        );

      default:
        if (activeTab === 'users') {
          return <UserManagement />;
        }
        if (activeTab === 'settings') {
          return <AdminSettings />;
        }
        if (activeTab === 'institutions') {
          return <InstitutionManagement />;
        }
        if (activeTab === 'categories') {
          return <CategoryManagement />;
        }
        if (activeTab === 'category-resolvers') {
          return <CategoryResolverManagement />;
        }
        if (activeTab === 'users') {
          return <UserManagement />;
        }
        return <div className="bg-white rounded-lg shadow p-6">Feature coming soon...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-700">
              {user?.role === 'admin' ? 'Admin Dashboard' : 
               user?.role === 'officer' ? 'Officer Dashboard' : 'User Dashboard'}
          </h1>
          <div className="text-sm text-gray-600">
            Welcome, {user?.first_name} {user?.last_name}
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {getTabs().map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
