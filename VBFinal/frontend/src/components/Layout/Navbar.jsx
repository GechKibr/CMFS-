import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleLinks = () => {
    if (!user) return [];
    
    const baseLinks = [
      { name: 'Dashboard', path: '/dashboard' },
    ];

    if (user.role === 'admin') {
      return [
        ...baseLinks,
        { name: 'Institutions', path: '/institutions' },
        { name: 'Categories', path: '/categories' },
        { name: 'Users', path: '/users' },
        { name: 'Settings', path: '/settings' },
      ];
    }

    if (user.role === 'officer') {
      return [
        ...baseLinks,
        { name: 'Assigned', path: '/assigned' },
        { name: 'History', path: '/history' },
      ];
    }

    return baseLinks;
  };

  return (
    <nav className="bg-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold">
              Complaint System
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            {getRoleLinks().map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="hover:bg-blue-600 px-3 py-2 rounded"
              >
                {link.name}
              </Link>
            ))}
            <div className="flex items-center space-x-2">
              <span className="text-sm">{user?.first_name}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-white hover:text-gray-200"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {getRoleLinks().map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="block hover:bg-blue-600 px-3 py-2 rounded"
                  onClick={() => setIsOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="block w-full text-left bg-red-500 hover:bg-red-600 px-3 py-2 rounded"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
