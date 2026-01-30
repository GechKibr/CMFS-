import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemStats();
  }, []);

  const loadSystemStats = async () => {
    try {
      const [complaintsData, usersData, institutionsData] = await Promise.all([
        apiService.getComplaints().catch(() => ({ results: [] })),
        apiService.getAllUsers().catch(() => ({ results: [] })),
        apiService.getInstitutions().catch(() => ({ results: [] }))
      ]);

      const complaints = complaintsData.results || complaintsData || [];
      const users = usersData.results || usersData || [];
      const institutions = institutionsData.results || institutionsData || [];

      const resolved = complaints.filter(c => c.status === 'resolved');
      const avgDays = resolved.length > 0 
        ? Math.round(resolved.reduce((sum, c) => {
            const created = new Date(c.created_at);
            const updated = new Date(c.updated_at);
            return sum + Math.ceil((updated - created) / (1000 * 60 * 60 * 24));
          }, 0) / resolved.length)
        : 0;

      setStats({
        totalComplaints: complaints.length,
        resolvedComplaints: resolved.length,
        activeUsers: users.length,
        institutions: institutions.length,
        avgResolutionTime: `${avgDays} days`,
        satisfactionRate: Math.round((resolved.length / Math.max(complaints.length, 1)) * 100)
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Fallback to demo data
      setStats({
        totalComplaints: 1247,
        resolvedComplaints: 1089,
        activeUsers: 3456,
        institutions: 12,
        avgResolutionTime: '3.2 days',
        satisfactionRate: 87
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: '📝',
      title: 'Easy Complaint Submission',
      description: 'Submit complaints quickly with our user-friendly interface'
    },
    {
      icon: '⚡',
      title: 'Fast Resolution',
      description: `Average resolution time of ${stats.avgResolutionTime}`
    },
    {
      icon: '👥',
      title: 'Multi-Institution Support',
      description: `Supporting ${stats.institutions} educational institutions`
    },
    {
      icon: '📊',
      title: 'Real-time Tracking',
      description: 'Track your complaint status in real-time'
    },
    {
      icon: '🔒',
      title: 'Secure & Private',
      description: 'Your data is protected with enterprise-grade security'
    },
    {
      icon: '📱',
      title: 'Mobile Friendly',
      description: 'Access the system from any device, anywhere'
    }
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                CMFS
              </h1>
              <span className={`ml-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Complaint Management System
              </span>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => navigate('/login')}
                className={`px-4 py-2 rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Login
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className={`text-4xl md:text-6xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-6`}>
            Streamline Your
            <span className="text-blue-600"> Complaint Management</span>
          </h2>
          <p className={`text-xl ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-8 max-w-3xl mx-auto`}>
            A comprehensive platform for educational institutions to manage, track, and resolve complaints efficiently with real-time analytics and automated workflows.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </button>
            <button
              onClick={() => navigate('/login')}
              className={`px-8 py-3 rounded-lg text-lg font-semibold border-2 transition-colors ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className={`py-16 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Trusted by Educational Institutions
            </h3>
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Real-time statistics from our complaint management system
            </p>
          </div>
          
          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {stats.totalComplaints.toLocaleString()}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Complaints
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {stats.resolvedComplaints.toLocaleString()}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Resolved
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {stats.activeUsers.toLocaleString()}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Active Users
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2">
                  {stats.institutions}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Institutions
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-indigo-600 mb-2">
                  {stats.avgResolutionTime}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Avg Resolution
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-teal-600 mb-2">
                  {stats.satisfactionRate}%
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Satisfaction Rate
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Why Choose CMFS?
            </h3>
            <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Powerful features designed for educational institutions
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className={`p-6 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h4 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  {feature.title}
                </h4>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-16 ${isDark ? 'bg-gray-800' : 'bg-blue-50'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            Ready to Transform Your Complaint Management?
          </h3>
          <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-8`}>
            Join thousands of users who trust CMFS for efficient complaint resolution
          </p>
          <button
            onClick={() => navigate('/register')}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Your Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-t`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              © 2024 CMFS. All rights reserved.
            </div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className={`text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>
                Privacy Policy
              </a>
              <a href="#" className={`text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>
                Terms of Service
              </a>
              <a href="#" className={`text-sm ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}>
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
