import { useTheme } from '../../contexts/ThemeContext';

const PublicFooter = () => {
  const { isDark } = useTheme();
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'} border-t`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                University of Gondar
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Complaint Management and Feedback Tracking System
              </p>
              <p className={`text-sm mt-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                The University of Gondar  is one of Ethiopia's historic higher education institutions,
                originally established in 1954 as a Public Health College and Training Centre. Over the decades
                it has evolved into a leading comprehensive university offering diverse undergraduate and
                postgraduate programs, promoting education, research, and community engagement.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  Vision
                </h4>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  To be one of the top ten research universities in Africa by 2030.
                </p>
              </div>
              <div>
                <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                  Mission
                </h4>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  To provide quality education, research and community engagement that is responsive to
                  national and global needs through entrepreneurial culture.
                </p>
              </div>
            </div>

            <div>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                Values
              </h4>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Quality, sustainability, professionalism, collaboration, social responsibility, diversity and
                inclusiveness.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                Contact Information
              </h4>
              <div className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <p>Email: info@uog.edu.et</p>
                <p>Phone: +251 588 940 290</p>
                <p>Address: Maraki Street, Gondar, Ethiopia</p>
              </div>
            </div>

            <div>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                Useful Official Links
              </h4>
              <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <li>Students and Registrar Services</li>
                <li>Library and ICT Services</li>
                <li>University Hospital Services</li>
                <li>Research and Community Engagement Portals</li>
              </ul>
            </div>

            <div>
              <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-2`}>
                Connect With Us
              </h4>
              <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Follow for updates, events and academic news:
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                <a
                  href="https://www.facebook.com/"
                  className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} text-sm transition-colors`}
                >
                  Facebook
                </a>
                <span className={`${isDark ? 'text-gray-600' : 'text-gray-400'}`}>|</span>
                <a
                  href="https://x.com/"
                  className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} text-sm transition-colors`}
                >
                  Twitter
                </a>
                <span className={`${isDark ? 'text-gray-600' : 'text-gray-400'}`}>|</span>
                <a
                  href="https://www.linkedin.com/"
                  className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} text-sm transition-colors`}
                >
                  LinkedIn
                </a>
                <span className={`${isDark ? 'text-gray-600' : 'text-gray-400'}`}>|</span>
                <a
                  href="https://www.youtube.com/"
                  className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'} text-sm transition-colors`}
                >
                  YouTube
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className={`pt-8 mt-8 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            © {currentYear} University of Gondar - All Rights Reserved
          </div>
          <a
            href="https://uog.edu.et/"
            className={`text-sm mt-2 inline-block ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
          >
            Official University Website: https://uog.edu.et/
          </a>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
