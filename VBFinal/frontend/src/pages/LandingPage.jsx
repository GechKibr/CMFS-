import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import PublicNavbar from '../components/UI/PublicNavbar';
import PublicFooter from '../components/UI/PublicFooter';

const LandingPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalComplaints: 0,
    resolvedComplaints: 0,
    activeUsers: 0,
    institutions: 0,
    avgResolutionTime: '0 days',
    satisfactionRate: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Use demo data for public landing page
    setStats({
      totalComplaints: 1247,
      resolvedComplaints: 1089,
      activeUsers: 3456,
      institutions: 12,
      avgResolutionTime: '3.2 days',
      satisfactionRate: 87
    });
  }, []);

  const features = [


  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className={`text-5xl md:text-7xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'} mb-6 leading-tight`}>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Complaint Management and feedback tracking platform  for UOG
              </span>
            </h1>

            <p className={`text-xl md:text-2xl ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-10 max-w-3xl mx-auto leading-relaxed`}>
              A comprehensive platform for educational institutions to manage, track, and resolve complaints efficiently with real-time analytics.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Get Started →
              </button>
              <button
                onClick={() => navigate('/login')}
                className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all border-2 ${isDark
                  ? 'border-gray-600 text-white hover:bg-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                Sign In
              </button>
            </div>


          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default LandingPage;
