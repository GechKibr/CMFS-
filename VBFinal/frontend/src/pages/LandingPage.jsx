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
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className={`text-5xl md:text-7xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'} mb-6 leading-tight`}>
              Streamline Your
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Complaint Management
              </span>
            </h1>
            
            <p className={`text-xl md:text-2xl ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-10 max-w-3xl mx-auto leading-relaxed`}>
              A comprehensive platform for educational institutions to manage, track, and resolve complaints efficiently with real-time analytics and AI-powered workflows.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => navigate('/register')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Get Started Free →
              </button>
              <button
                onClick={() => navigate('/login')}
                className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all border-2 ${
                  isDark 
                    ? 'border-gray-600 text-white hover:bg-gray-800' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 items-center opacity-60">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Secure & Encrypted</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>24/7 Support</span>
              </div>
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Free Trial</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className={`py-16 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {!loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {stats.totalComplaints}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Complaints
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {stats.resolvedComplaints}
                </div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Resolved
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {stats.activeUsers}
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
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className={`text-4xl md:text-5xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
              Why Choose CMFS?
            </h3>
            <p className={`text-xl ${isDark ? 'text-gray-400' : 'text-gray-600'} max-w-2xl mx-auto`}>
              Powerful features designed to streamline complaint management for educational institutions
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`p-8 rounded-xl ${
                  isDark ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:shadow-xl'
                } shadow-lg transition-all duration-300 transform hover:-translate-y-1 border ${
                  isDark ? 'border-gray-700' : 'border-gray-100'
                }`}
              >
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h4 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-3`}>
                  {feature.title}
                </h4>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed`}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            Ready to Transform Your Complaint Management?
          </h3>
          <p className={`text-xl ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-10`}>
            Join {stats.activeUsers}+ users who trust CMFS for efficient complaint resolution
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
              Start Your Free Trial
            </button>
            <button
              onClick={() => navigate('/login')}
              className={`px-8 py-4 rounded-lg text-lg font-semibold transition-all ${
                isDark 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } shadow-md`}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default LandingPage;
