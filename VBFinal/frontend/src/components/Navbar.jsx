import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();

  const getNavLinks = () => {
    if (!user) return [];
    
    switch (user.role) {
      case 'admin':
        return [
          { name: 'Dashboard', href: '/admin' },
          { name: 'Institutions', href: '/admin/institutions' },
          { name: 'Categories', href: '/admin/categories' },
          { name: 'Users', href: '/admin/users' },
          { name: 'Settings', href: '/admin/settings' }
        ];
      case 'officer':
        return [
          { name: 'Dashboard', href: '/officer' },
          { name: 'Assigned', href: '/officer/assigned' },
          { name: 'History', href: '/officer/history' }
        ];
      case 'user':
        return [
          { name: 'Dashboard', href: '/user' },
          { name: 'Submit', href: '/user/submit' },
          { name: 'My Complaints', href: '/user/complaints' }
        ];
      default:
        return [];
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-neutral">Complaint Management</h1>
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex space-x-4">
                {getNavLinks().map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-neutral hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                  >
                    {link.name}
                  </a>
                ))}
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-neutral">{user.name}</span>
                <button
                  onClick={logout}
                  className="bg-error text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
