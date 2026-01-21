import { useTheme } from '../../contexts/ThemeContext';

const UserProfile = ({ user }) => {
  const { isDark } = useTheme();
  
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Profile Settings
          </h3>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            Manage your account information and preferences
          </p>
        </div>
        
        <div className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </div>
            <div className="ml-6">
              <h4 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {user?.first_name} {user?.last_name}
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
                value={user?.first_name || ''}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Last Name
              </label>
              <input
                type="text"
                value={user?.last_name || ''}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
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
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                College
              </label>
              <input
                type="text"
                value={colleges.find(c => c.value === user?.college)?.label || user?.college || 'Not specified'}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
              />
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Phone Number
              </label>
              <input
                type="text"
                value={user?.phone || 'Not provided'}
                readOnly
                className={`w-full px-3 py-2 border rounded-lg ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'} cursor-not-allowed`}
              />
            </div>
          </div>

          <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-blue-50'} border ${isDark ? 'border-gray-600' : 'border-blue-200'}`}>
            <h4 className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-blue-900'} mb-2`}>
              📝 Profile Information
            </h4>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-blue-800'}`}>
              Your profile information is managed by the system administrator. If you need to update any details, please contact the admin or submit a complaint through the system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
