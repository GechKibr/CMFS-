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
    { label: 'Facebook', href: 'https://web.facebook.com/TheUniversityofGondar' },
    { label: 'Twitter', href: 'https://x.com/UoGondar' },
    { label: 'LinkedIn', href: 'https://et.linkedin.com/school/university-of-gondar' },
    { label: 'YouTube', href: 'https://www.youtube.com/@UniversityGondar' },
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
    <footer className={`${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'} border-t w-full mt-auto`}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-blue-200/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-blue-500/20 dark:bg-slate-900/70">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9A2.5 2.5 0 0 1 16.5 19h-9A2.5 2.5 0 0 1 5 16.5v-9Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8M8 12h5M8 15h6" />
                </svg>
              </div>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Complaint Management and Feedback Tracking Platform</h3>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Unified complaints, scheduling, and service handling.</p>
              </div>
            </div>

            <p className={`max-w-2xl text-sm leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              A modern service operations platform for complaint tracking, appointment handling,
              quality templates, and real-time helpdesk communication.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['Fast routing', 'Automatically assign requests to the right team.'],
                ['Clear status', 'Keep users informed from submission to resolution.'],
                ['Service insights', 'Review trends with simple operational analytics.'],
              ].map(([title, description]) => (
                <div key={title} className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
                  <p className={`mt-2 text-xs leading-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className={`text-sm font-semibold uppercase tracking-[0.2em] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Quick Links
            </h4>
            <ul className="mt-4 space-y-3">
              {quickLinks.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    className={`text-sm font-medium transition-colors cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-blue-700'}`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={`text-sm font-semibold uppercase tracking-[0.2em] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              Contact & Social
            </h4>
            <div className={`mt-4 space-y-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <p>Email: support@cmts.com</p>
              <p>Phone: +251 000 000 000</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${isDark ? 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white' : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-700'}`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className={`mt-10 flex flex-col gap-3 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
          <p>© {currentYear} Complaint Management and Feedback Tracking Platform.</p>
          <a
            href="/"
            onClick={(e) => handleNavClick(e, '/')}
            className={`font-medium transition-colors cursor-pointer ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-700 hover:text-slate-900'}`}
          >
            Return to top
          </a>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;