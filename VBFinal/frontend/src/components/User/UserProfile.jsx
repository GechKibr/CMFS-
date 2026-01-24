import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const UserProfile = ({ user }) => {
  const { isDark } = useTheme();
  const { user: authUser, login } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    college: user?.college || ''
  });
  
  const colleges = [
    { value: 'CMHS', label: 'College of Medicine and Health Sciences' },
    { value: 'CNCS', label: 'College of Natural and Computational Sciences' },
    { value: 'CBE', label: 'College of Business and Economics' },
    { value: 'CSSH', label: 'College of Social Sciences and Humanities' },
    { value: 'CVMAS', label: 'College of Veterinary Medicine and Animal Sciences' },
    { value: 'CAES', label: 'College of Agriculture and Environmental Sciences' },
    { value: 'COI', label: 'College of Informatics' },
    { value: 'COE', label: 'College of Education' },
    { value: 'IOT', label: 'Institute of Technology' },
    { value: 'IOB', label: 'Institute of Biotechnology' },
    { value: 'SOL', label: 'School of Law' },
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await apiService.updateUser(user.id, formData);
      
      // Update local storage user data
      const updatedUser = { ...user, ...formData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setIsEditing(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      college: user?.college || ''
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'} flex justify-between items-center`}>
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Profile Settings
            </h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
              Manage your account information and preferences
            </p>
          </div>
          <div className="flex space-x-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {(formData.first_name?.charAt(0) || user?.first_name?.charAt(0) || '').toUpperCase()}
              {(formData.last_name?.charAt(0) || user?.last_name?.charAt(0) || '').toUpperCase()}
            </div>
            <div className="ml-6">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {formData.first_name || user?.first_name} {formData.last_name || user?.last_name}
              </h4>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {user?.email}
              </p>
              <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                user?.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                user?.role === 'officer' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              }`}>
                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                    : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                    : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>
            
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Email cannot be changed. Contact admin if needed.
              </p>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                College
              </label>
              {isEditing ? (
                <select
                  name="college"
                  value={formData.college}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                >
                  <option value="">Select College</option>
                  {colleges.map(college => (
                    <option key={college.value} value={college.value}>
                      {college.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={colleges.find(c => c.value === user?.college)?.label || user?.college || 'Not specified'}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                readOnly={!isEditing}
                placeholder={isEditing ? "Enter phone number" : "Not provided"}
                className={`w-full px-3 py-2 border rounded-lg ${
                  isEditing 
                    ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                    : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>
          </div>

          <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'} border ${isDark ? 'border-gray-600' : 'border-blue-200'}`}>
            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-blue-900'} mb-2`}>
              📝 Profile Information
            </h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-blue-800'}`}>
              {isEditing 
                ? 'You can edit your personal information. Email address cannot be changed for security reasons.'
                : 'Click "Edit Profile" to update your personal information. Some fields may require admin approval.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
