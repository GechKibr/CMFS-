import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

const UserProfile = ({ user: propUser }) => {
  const { isDark } = useTheme();
  const { user: authUser, setAuth, logout } = useAuth();
  const user = propUser || authUser;
  const studentProfile = user?.student_profile || {};
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Campus, College, Department data
  const [campuses, setCampuses] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [studentTypes, setStudentTypes] = useState([]);
  const [, setFetchingData] = useState(true);
  const [assignedResolvers, setAssignedResolvers] = useState([]);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    username: user?.username || '',
    gmail_account: user?.gmail_account || '',
    campus_id: user?.campus_id || studentProfile.campus_id || '',
    user_campus: user?.user_campus || studentProfile.campus_id || null,
    college: user?.college || studentProfile.department_detail?.department_college || null,
    department: user?.department || studentProfile.department || null,
    student_type: user?.student_type || studentProfile.student_type || '',
    year_of_study: user?.year_of_study || studentProfile.year_of_study || '',
    phone: user?.phone || ''
  });

  useEffect(() => {
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      username: user?.username || '',
      gmail_account: user?.gmail_account || '',
      campus_id: user?.campus_id || studentProfile.campus_id || '',
      user_campus: user?.user_campus || studentProfile.campus_id || null,
      college: user?.college || studentProfile.department_detail?.department_college || null,
      department: user?.department || studentProfile.department || null,
      student_type: user?.student_type || studentProfile.student_type || '',
      year_of_study: user?.year_of_study || studentProfile.year_of_study || '',
      phone: user?.phone || ''
    });
  }, [user?.id, user?.first_name, user?.last_name, user?.username, user?.gmail_account, user?.campus_id, user?.user_campus, user?.college, user?.department, user?.student_type, user?.year_of_study, user?.phone, studentProfile.campus_id, studentProfile.student_type, studentProfile.year_of_study, studentProfile.department, studentProfile.department_detail?.department_college]);

  // Fetch campuses on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setFetchingData(true);
        const [campusesData, studentTypesData] = await Promise.all([
          apiService.getCampuses(),
          apiService.getStudentTypes()
        ]);

        const campusList = Array.isArray(campusesData) ? campusesData : campusesData.results || [];
        const studentTypeList = Array.isArray(studentTypesData) ? studentTypesData : studentTypesData.results || [];
        setCampuses(campusList);
        setStudentTypes(studentTypeList.filter(item => item && item.is_active !== false).sort((a, b) => (a.type_name || '').localeCompare(b.type_name || '')));

        const campusCode = user?.user_campus || studentProfile.campus_id;
        if (campusCode) {
          const collegesData = await apiService.getColleges(campusCode);
          const collegesList = Array.isArray(collegesData) ? collegesData : collegesData.results || [];
          setColleges(collegesList);
        }

        const collegeCode = user?.college || studentProfile.department_detail?.department_college;
        if (collegeCode) {
          const departmentsData = await apiService.getDepartments(collegeCode);
          const departmentsList = Array.isArray(departmentsData) ? departmentsData : departmentsData.results || [];
          setDepartments(departmentsList);
        }
      } catch (error) {
        console.error('Failed to fetch campus/college/department/student type data:', error);
      } finally {
        setFetchingData(false);
      }
    };

    fetchData();
  }, [user?.user_campus, user?.college, studentProfile.campus_id, studentProfile.department_detail?.department_college]);

  useEffect(() => {
    let cancelled = false;
    const fetchAssignedResolvers = async () => {
      if (!user || user.role !== 'officer') return;
      try {
        const data = await apiService.getAllCategoryResolvers();
        const resolvers = data?.results || data || [];
        const my = resolvers.filter(r => String(r.officer) === String(user.id));
        if (!cancelled) setAssignedResolvers(my);
      } catch (err) {
        console.error('Failed to fetch assigned resolvers:', err);
      }
    };

    fetchAssignedResolvers();
    return () => { cancelled = true; };
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCampusChange = async (e) => {
    const campusId = e.target.value || null;
    setFormData(prev => ({
      ...prev,
      user_campus: campusId,
      college: null,
      department: null
    }));

    // Fetch colleges for selected campus
    if (campusId) {
      try {
        const collegesData = await apiService.getColleges(campusId);
        const collegesList = Array.isArray(collegesData) ? collegesData : collegesData.results || [];
        setColleges(collegesList);
      } catch (error) {
        console.error('Failed to fetch colleges:', error);
        setColleges([]);
      }
    } else {
      setColleges([]);
    }
    setDepartments([]);
  };

  const handleCollegeChange = async (e) => {
    const collegeId = e.target.value || null;
    setFormData(prev => ({
      ...prev,
      college: collegeId,
      department: null
    }));

    // Fetch departments for selected college
    if (collegeId) {
      try {
        const departmentsData = await apiService.getDepartments(collegeId);
        const departmentsList = Array.isArray(departmentsData) ? departmentsData : departmentsData.results || [];
        setDepartments(departmentsList);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
        setDepartments([]);
      }
    } else {
      setDepartments([]);
    }
  };

  const handleDepartmentChange = (e) => {
    const departmentId = e.target.value ? parseInt(e.target.value) : null;
    setFormData(prev => ({
      ...prev,
      department: departmentId
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const updateData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        gmail_account: formData.gmail_account?.trim() ? formData.gmail_account.trim().toLowerCase() : null,
        campus_id: formData.campus_id,
        user_campus: formData.user_campus,
        college: formData.college,
        department: formData.department,
        student_type: formData.student_type || null,
        year_of_study: formData.year_of_study ? parseInt(formData.year_of_study, 10) : null,
        phone: formData.phone
      };

      await apiService.updateUser(user.id, updateData);

      const updatedUser = { ...user, ...updateData };
      setAuth(updatedUser);

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
      username: user?.username || '',
      gmail_account: user?.gmail_account || '',
      campus_id: user?.campus_id || '',
      user_campus: user?.user_campus || null,
      college: user?.college || null,
      department: user?.department || null,
      student_type: user?.student_type || '',
      year_of_study: user?.year_of_study || '',
      phone: user?.phone || ''
    });
    setIsEditing(false);
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'This will permanently delete your account, profile data, and related access. This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      await apiService.deleteCurrentUser();
      logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const submitPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.password !== passwordData.confirm_password) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (passwordData.password.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      await apiService.updateUser(user.id, {
        password: passwordData.password,
        confirm_password: passwordData.confirm_password
      });
      setPasswordSuccess('Password updated successfully');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordData({ password: '', confirm_password: '' });
        setPasswordSuccess('');
      }, 2000);
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const getCampusName = (campusId) => {
    if (!campusId) return 'Not specified';
    const campus = campuses.find(c => String(c.id) === String(campusId));
    return campus?.campus_name || 'Unknown Campus';
  };

  const getCollegeName = (collegeId) => {
    if (!collegeId) return 'Not specified';
    const college = colleges.find(c => String(c.id) === String(collegeId));
    return college?.college_name || 'Unknown College';
  };

  const getDepartmentName = (deptId) => {
    if (!deptId) return 'Not specified';
    const dept = departments.find(d => d.id === deptId);
    return dept?.department_name || 'Unknown Department';
  }

  const resolvedCampus = formData.user_campus || user?.user_campus || studentProfile.campus_id || '';
  const resolvedCollege = formData.college || user?.college || studentProfile.department_detail?.department_college || '';
  const resolvedDepartment = formData.department || user?.department || studentProfile.department || '';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPasswordModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className={`inline-block align-bottom rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className={`text-lg leading-6 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`} id="modal-title">
                      Change Password
                    </h3>
                    <div className="mt-4">
                      {passwordError && (
                        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                          <span className="block sm:inline">{passwordError}</span>
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
                          <span className="block sm:inline">{passwordSuccess}</span>
                        </div>
                      )}
                      <form onSubmit={submitPasswordChange} className="space-y-4">
                        <div>
                          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            New Password
                          </label>
                          <input
                            type="password"
                            name="password"
                            value={passwordData.password}
                            onChange={handlePasswordChange}
                            className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Confirm Password
                          </label>
                          <input
                            type="password"
                            name="confirm_password"
                            value={passwordData.confirm_password}
                            onChange={handlePasswordChange}
                            className={`mt-1 block w-full border ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                          />
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className={`bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse ${isDark ? 'bg-gray-700' : ''}`}>
                <button
                  type="button"
                  onClick={submitPasswordChange}
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className={`mt-3 w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm ${isDark ? 'bg-gray-600 text-gray-200 hover:bg-gray-500 border-gray-500' : 'border-gray-300'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Change Password
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Profile
                </button>
              </>
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
              <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${user?.role === 'admin' ? 'bg-purple-100 text-purple-800' :
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
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Campus ID
              </label>
              <input
                type="text"
                name="campus_id"
                value={formData.campus_id}
                onChange={handleInputChange}
                readOnly={!isEditing}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>

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
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
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
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
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

            <div className="md:col-span-2">
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Gmail Account (Reset + Notifications)
              </label>
              <input
                type="email"
                name="gmail_account"
                value={formData.gmail_account || ''}
                onChange={handleInputChange}
                readOnly={!isEditing}
                placeholder={isEditing ? 'example@gmail.com' : 'Not provided'}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Must be a valid Google account address.
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Campus
              </label>
              {isEditing ? (
                <select
                  value={formData.user_campus || ''}
                  onChange={handleCampusChange}
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                >
                  <option value="">Select Campus</option>
                  {campuses.map(campus => (
                    <option key={campus.id} value={campus.id}>
                      {campus.campus_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={getCampusName(resolvedCampus)}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                College
              </label>
              {isEditing ? (
                <select
                  value={formData.college || ''}
                  onChange={handleCollegeChange}
                  disabled={!formData.user_campus}
                  className={`w-full px-3 py-2 border rounded-lg ${!formData.user_campus
                    ? isDark ? 'bg-gray-600 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'
                    : isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                >
                  <option value="">Select College</option>
                  {colleges.map(college => (
                    <option key={college.id} value={college.id}>
                      {college.college_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={getCollegeName(resolvedCollege)}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Department
              </label>
              {isEditing ? (
                <select
                  value={formData.department || ''}
                  onChange={handleDepartmentChange}
                  disabled={!formData.college}
                  className={`w-full px-3 py-2 border rounded-lg ${!formData.college
                    ? isDark ? 'bg-gray-600 border-gray-600 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'
                    : isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={getDepartmentName(resolvedDepartment)}
                  readOnly
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Student Type
              </label>
              {isEditing ? (
                studentTypes && studentTypes.length > 0 ? (
                  <select
                    name="student_type"
                    value={formData.student_type || ''}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                  >
                    <option value="">Select student type</option>
                    {studentTypes.map(st => (
                      <option key={st.id || st.type_name} value={st.type_name}>{st.type_name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="student_type"
                    value={formData.student_type}
                    onChange={handleInputChange}
                    placeholder="Enter student type"
                    className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                  />
                )
              ) : (
                <input
                  type="text"
                  name="student_type"
                  value={formData.student_type}
                  readOnly
                  placeholder="Not provided"
                  className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
                />
              )}
            </div>

            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Year of Study
              </label>
              <input
                type="text"
                name="year_of_study"
                value={formData.year_of_study}
                onChange={handleInputChange}
                readOnly={!isEditing}
                placeholder={isEditing ? "Enter year of study" : "Not provided"}
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
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
                className={`w-full px-3 py-2 border rounded-lg ${isEditing
                  ? isDark ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500' : 'bg-white border-gray-300 focus:border-blue-500'
                  : isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'
                  } ${!isEditing ? 'cursor-not-allowed' : ''} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
              />
            </div>
          </div>

          {user?.role === 'officer' && (
            <div className="mt-6 px-6">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Assigned Resolvers</h4>
              {assignedResolvers.length === 0 ? (
                <p className={`text-sm mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No resolver assignments.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {assignedResolvers.map(r => (
                    <li key={r.id} className={`px-3 py-2 border rounded ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{r.category_name || r.category}</div>
                          <div className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>{r.scope_label || `${r.campus_name || ''} ${r.college_name || ''} ${r.department_name || ''}`}</div>
                        </div>
                        <div className="text-sm">
                          {r.active ? (
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">Active</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs">Inactive</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {user?.role !== 'officer' && (
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-red-900 dark:text-red-200">Danger Zone</h4>
                  <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                    Permanently delete your account and remove your access from the system.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="inline-flex items-center justify-center rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingAccount ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default UserProfile;
