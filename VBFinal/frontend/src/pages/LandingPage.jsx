import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import PublicNavbar from '../components/UI/PublicNavbar';
import PublicFooter from '../components/UI/PublicFooter';

// Microsoft OAuth Configuration
const MICROSOFT_CLIENT_ID = '717df1e7-c444-4623-99e6-7dcebc53d49b';
const MICROSOFT_REDIRECT_URI = `${window.location.origin}/auth/microsoft/callback`;
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_SCOPE = 'openid email profile User.Read';

const featureCards = [
  {
    slug: 'complaints',
    title: 'Complaint Management',
    description: 'Submit, track, and resolve complaints with clear ownership and status updates.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h4M9 8h2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12A1.5 1.5 0 0 1 19 19.5H7.8L4.5 21V6A1.5 1.5 0 0 1 6 4.5Z" />
      </svg>
    ),
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    slug: 'appointments',
    title: 'Appointment Scheduling',
    description: 'Request, approve, and manage appointments with structured calendars.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3m8-3v3M4.5 8.5h15" />
        <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h3m0 0h3m-3 0v3" />
      </svg>
    ),
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    slug: 'templates',
    title: 'Service Quality Templates',
    description: 'Standardize service quality with reusable templates and scoring.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v12A1.5 1.5 0 0 1 17 19.5H7A1.5 1.5 0 0 1 5.5 18V6A1.5 1.5 0 0 1 7 4.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 9h7m-7 3h7m-7 3h4" />
      </svg>
    ),
    gradient: 'from-emerald-500 to-emerald-600',
  },
  {
    slug: 'helpdesk',
    title: 'Real-Time Helpdesk',
    description: 'Connect users and support teams through live chat and instant updates.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11A2 2 0 0 1 19.5 6.5v7a2 2 0 0 1-2 2H11l-4.5 3v-3.5h0A2 2 0 0 1 4.5 13.5v-7Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 8.5h8M8 11.5h5" />
      </svg>
    ),
    gradient: 'from-rose-500 to-rose-600',
  },
];

// Workflow steps - 4 steps
const workflowSteps = [
  {
    title: 'Submit Request',
    description: 'Submit complaint or service request',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0 5-5m-5 5-5-5" />
      </svg>
    ),
    color: 'blue',
  },
  {
    title: 'Staff Handles',
    description: 'Reviews and takes action',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 19.5v-2a4.5 4.5 0 0 1 9 0v2" />
        <circle cx="12" cy="9" r="3.5" />
      </svg>
    ),
    color: 'emerald',
  },
  {
    title: 'Real-Time Updates',
    description: 'Stay informed throughout',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11A2 2 0 0 1 19.5 6.5v7a2 2 0 0 1-2 2H11l-4.5 3v-3.5h0A2 2 0 0 1 4.5 13.5v-7Z" />
      </svg>
    ),
    color: 'orange',
  },
  {
    title: 'Resolution',
    description: 'Close with feedback',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19.5h14" />
      </svg>
    ),
    color: 'teal',
  },
];

const Reveal = ({ children, className = '', delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={nodeRef}
      className={`transition-all duration-700 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const renderFeaturePreview = (slug, isDark) => {
  const surface = isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200';
  const soft = isDark ? 'bg-slate-800' : 'bg-slate-100';

  if (slug === 'complaints') {
    return (
      <div className={`rounded-2xl border p-3 ${surface}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-blue-600 dark:text-blue-300">
          <span>Lifecycle</span>
          <span>Live</span>
        </div>
        <div className="mt-3 space-y-2">
          {['Submitted', 'Assigned', 'Resolved'].map((text) => (
            <div key={text} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slug === 'appointments') {
    return (
      <div className={`rounded-2xl border p-3 ${surface}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-purple-600 dark:text-purple-300">
          <span>Schedule</span>
          <span>Week</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] font-semibold text-slate-500">
          {['Mon', 'Tue', 'Wed', 'Thu'].map((day) => (
            <div key={day} className="rounded-lg py-2 text-center bg-slate-100/80 dark:bg-slate-800/80">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className={`h-10 rounded-xl ${index === 2 || index === 5 ? 'bg-gradient-to-r from-purple-500 to-pink-500' : soft}`} />
          ))}
        </div>
      </div>
    );
  }

  if (slug === 'templates') {
    return (
      <div className={`rounded-2xl border p-3 ${surface}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-300">
          <span>Builder</span>
          <span>Draft</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${soft}`}>Satisfaction score</div>
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${soft}`}>Resolution checklist</div>
          <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-xs font-semibold text-white">
            Approval workflow
          </div>
        </div>
      </div>
    );
  }

  // Helpdesk preview with IMAGE
  return (
    <div className={`rounded-2xl border p-3 ${surface}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-300 mb-2">
        <span>Live Support</span>
        <span>24/7</span>
      </div>
      <img 
        src="/helpdesk.jpg" 
        alt="Helpdesk Support" 
        className="w-full h-32 object-cover rounded-xl"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = "https://via.placeholder.com/300x150?text=Helpdesk+Support";
        }}
      />
      <div className="mt-2 text-center">
        <p className="text-xs text-green-600 dark:text-green-400 font-semibold">● Live Agents Available</p>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Microsoft login redirect function
  const handleMicrosoftLogin = () => {
    // Generate random state for security
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('oauth_state', state);
    
    // Build the Microsoft login URL
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: MICROSOFT_REDIRECT_URI,
      scope: MICROSOFT_SCOPE,
      response_mode: 'query',
      state: state,
      prompt: 'select_account'
    });
    
    const loginUrl = `${MICROSOFT_AUTH_URL}?${params.toString()}`;
    
    // Redirect to Microsoft login page
    window.location.href = loginUrl;
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'} scroll-smooth`}>
      <PublicNavbar />

      <main className="relative overflow-hidden flex-1">
        {/* Animated Background */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl animate-pulse" />
          <div className="absolute right-[-10rem] top-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl animate-pulse delay-1000" />
          <div className="absolute left-[-10rem] bottom-32 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl animate-pulse delay-2000" />
        </div>

        {/* HERO SECTION - Main Campus Image */}
        <section className="relative min-h-screen flex items-center">
          {/* Background Image - Main Campus */}
          <div className="absolute inset-0 z-0">
            <img 
              src="/uog-campus1.jpg" 
              alt="University of Gondar Main Campus" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/uog.png";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 via-slate-900/30 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent"></div>
          </div>

          {/* Hero Content */}
          <div className="relative z-10 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32">
            <div className="max-w-3xl">
              <Reveal>
                {/* UOG Logo */}
                <div className="flex mb-8">
                  <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition duration-300"></div>
                    <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl p-3 shadow-2xl">
                      <img 
                        src="/uog.png" 
                        alt="University of Gondar Logo" 
                        className="w-20 h-20 sm:w-24 sm:h-24 object-contain"
                      />
                    </div>
                  </div>
                </div>
                
                {/* University Name */}
                <div className="inline-flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white border border-white/30 mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                  </span>
                  University of Gondar
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white">
                  Complaint <br />
                  Management <br />
                  <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                    & Feedback System
                  </span>
                </h1>
                
                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => navigate('/login')}
                    className="group inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
                  >
                    Get Started
                    <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                  <button
                    onClick={handleMicrosoftLogin}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/30 bg-black/30 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white hover:bg-white/20 transition-all hover:-translate-y-1"
                  >
                    Create Account
                  </button>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center bg-black/20 backdrop-blur-sm">
              <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse"></div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                  Features
                </p>
                <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                  Everything You Need
                </h2>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                  Complete solution for complaints, appointments, templates, and helpdesk support
                </p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((feature, index) => (
                <Reveal key={feature.slug} delay={index * 100}>
                  <div className={`group rounded-2xl border p-6 transition-all hover:-translate-y-2 hover:shadow-xl ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                      {feature.icon}
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">{feature.title}</h3>
                    <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">{feature.description}</p>
                    <div className="mt-5">{renderFeaturePreview(feature.slug, isDark)}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Campus Showcase Section - Images Only */}
        <section className="py-24 bg-gradient-to-br from-slate-100 to-blue-50 dark:from-slate-800 dark:to-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto mb-16">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                  Campus Life
                </p>
                <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                  Our Beautiful Campus
                </h2>
              </div>
            </Reveal>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Aluminum Building Image */}
              <Reveal delay={100}>
                <div className="group relative overflow-hidden rounded-2xl shadow-2xl">
                  <img 
                    src="/uog-building.jpg" 
                    alt="University of Gondar Aluminum Building" 
                    className="w-full h-[450px] object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/uog-campus2.jpg";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                </div>
              </Reveal>

              {/* Alumni Building Image */}
              <Reveal delay={200}>
                <div className="group relative overflow-hidden rounded-2xl shadow-2xl">
                  <img 
                    src="/uog-campus2.jpg" 
                    alt="University of Gondar Alumni Building" 
                    className="w-full h-[450px] object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/uog.png";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="py-24 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                  Process
                </p>
                <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
                  How It Works
                </h2>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                  Simple workflow from submission to resolution
                </p>
              </div>
            </Reveal>

            <div className="relative mt-16">
              <div className="absolute left-8 right-8 top-10 hidden h-px bg-gradient-to-r from-blue-200 via-indigo-300 to-cyan-200 lg:block dark:from-slate-700 dark:via-slate-600 dark:to-slate-700" />
              <div className="grid gap-6 lg:grid-cols-4">
                {workflowSteps.map((step, index) => (
                  <Reveal key={step.title} delay={index * 100}>
                    <div className={`text-center p-6 rounded-2xl border transition-all hover:-translate-y-2 hover:shadow-xl ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
                      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-${step.color}-500 to-${step.color}-600 text-white shadow-lg`}>
                        {step.icon}
                      </div>
                      <h3 className="mt-4 font-bold text-lg text-slate-900 dark:text-white">{step.title}</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="bg-white/10 rounded-full p-3 backdrop-blur-sm">
                    <img src="/uog.png" alt="UOG" className="w-16 h-16 object-contain" />
                  </div>
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold text-white">
                  Ready to Get Started?
                </h2>
                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => navigate('/login')}
                    className="px-10 py-4 rounded-xl bg-white text-blue-900 font-semibold text-lg hover:shadow-xl transition-all hover:-translate-y-1"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={handleMicrosoftLogin}
                    className="px-10 py-4 rounded-xl border-2 border-white/30 text-white font-semibold text-lg hover:bg-white/10 transition-all hover:-translate-y-1"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default LandingPage;