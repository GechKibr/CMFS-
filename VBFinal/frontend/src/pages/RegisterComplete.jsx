import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

const RegisterComplete = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    college: '',
    phone: '',
    role: 'user'
  });

  const email = searchParams.get('email') || localStorage.getItem('userEmail');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/accounts/me/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        navigate('/dashboard');
      } else {
        alert('Failed to update profile');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`max-w-md w-full ${isDark ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-8`}>
        <h2 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Complete Your Registration
        </h2>
        <p className={`mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Welcome! Please provide additional information to complete your profile.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300'}`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              College/Institute *
            </label>
            <select
              value={formData.college}
              onChange={(e) => setFormData({...formData, college: e.target.value})}
              required
              className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            >
              <option value="">Select your college</option>
              {colleges.map(college => (
                <option key={college.value} value={college.value}>
                  {college.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="+251..."
              className={`w-full px-3 py-2 border rounded-md ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Complete Registration
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterComplete;
