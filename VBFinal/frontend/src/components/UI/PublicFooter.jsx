import { useTheme } from '../../contexts/ThemeContext';

const PublicFooter = () => {
  const { isDark } = useTheme();
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { label: 'Home', href: '/' },
    { label: 'Features', href: '/#features' },
    { label: 'Workflow', href: '/#workflow' },
  ];

  const socialLinks = [
    { label: 'Facebook', href: 'https://web.facebook.com/TheUniversityofGondar', icon: '📘' },
    { label: 'Twitter', href: 'https://x.com/UoGondar', icon: '🐦' },
    { label: 'LinkedIn', href: 'https://et.linkedin.com/school/university-of-gondar', icon: '🔗' },
    { label: 'YouTube', href: 'https://www.youtube.com/@UniversityGondar', icon: '📺' },
  ];

  const handleNavClick = (e, href) => {
    e.preventDefault();
    if (href === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (href.includes('#')) {
      const hash = href.split('#')[1];
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <footer className={`relative overflow-hidden ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-100 to-slate-50'} border-t ${isDark ? 'border-slate-800' : 'border-slate-200'} w-full mt-auto`}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          
          {/* Left Section - Brand Info */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-blue-200/30 bg-white/80 px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl dark:border-blue-500/20 dark:bg-slate-800/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 transition-transform duration-300 hover:scale-105">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-9A2.5 2.5 0 0 1 5 16.5v-9Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 12h5M8 15h6" />
                </svg>
              </div>
              <div>
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  CMTS - Complaint Management
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  University of Gondar
                </p>
              </div>
            </div>

            <p className={`max-w-md text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              A modern service operations platform for complaint tracking, appointment handling,
              quality templates, and real-time helpdesk communication.
            </p>

            {/* Feature Badges */}
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { title: 'Fast routing', icon: '⚡', desc: 'Automatically assign requests' },
                { title: 'Clear status', icon: '📊', desc: 'Real-time progress tracking' },
                { title: 'Service insights', icon: '📈', desc: 'Advanced analytics' },
              ].map((item) => (
                <div key={item.title} className={`group rounded-xl border p-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isDark ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-700/50' : 'border-slate-200 bg-white/80 hover:bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.icon}</span>
                    <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</p>
                  </div>
                  <p className={`mt-1 text-xs leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
              <h4 className={`text-sm font-semibold uppercase tracking-[0.2em] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Quick Links
              </h4>
            </div>
            <ul className="space-y-2">
              {quickLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`group flex items-center gap-2 text-sm font-medium transition-all duration-300 cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-blue-600'}`}
                  >
                    <svg className="w-3 h-3 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Social Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
              <h4 className={`text-sm font-semibold uppercase tracking-[0.2em] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Connect With Us
              </h4>
            </div>
            
            {/* Contact Info */}
            <div className={`space-y-2 mb-5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <div className="flex items-center gap-2 group cursor-pointer transition-all hover:translate-x-0.5">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>support@cmts.com</span>
              </div>
              <div className="flex items-center gap-2 group cursor-pointer transition-all hover:translate-x-0.5">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>+251 000 000 000</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${isDark ? 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white' : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-white hover:text-blue-600 hover:border-blue-300'}`}
                >
                  <span className="text-base transition-transform group-hover:scale-110">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              ))}
            </div>

            {/* UoG Badge */}
            <div className="mt-5 pt-3">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">UoG</span>
                </div>
                <span className={`text-xs font-medium ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                  University of Gondar
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className={`mt-10 flex flex-col gap-3 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500'}`}>
          <p className="flex items-center gap-1">
            <span>© {currentYear} CMTS - Complaint Management and Feedback Tracking Platform.</span>
            <span className="hidden sm:inline">|</span>
            <span className="block sm:inline">All rights reserved.</span>
          </p>
          <a
            href="/"
            onClick={(e) => handleNavClick(e, '/')}
            className={`group flex items-center gap-1 font-medium transition-all duration-300 cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <svg className="w-3 h-3 transition-transform group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Return to top
          </a>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;