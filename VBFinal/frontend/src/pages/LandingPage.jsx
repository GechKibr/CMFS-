import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import PublicNavbar from '../components/UI/PublicNavbar';
import PublicFooter from '../components/UI/PublicFooter';
import apiService from '../services/api';

const featureCards = [
  {
    slug: 'complaints',
    title: 'Complaint Management',
    description: 'Submit, track, and resolve complaints with clear ownership, status updates, and audit-ready history.',
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
    description: 'Easily request, approve, and manage appointments with structured calendars and reminders.',
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
    description: 'Define, standardize, and evaluate service quality with reusable templates and scoring workflows.',
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
    description: 'Keep users and support teams connected through live chat, updates, and instant follow-up.',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11A2 2 0 0 1 19.5 6.5v7a2 2 0 0 1-2 2H11l-4.5 3v-3.5h0A2 2 0 0 1 4.5 13.5v-7Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 8.5h8M8 11.5h5" />
      </svg>
    ),
    gradient: 'from-rose-500 to-rose-600',
  },
];

const workflowSteps = [
  {
    title: 'Submit Request',
    description: 'Users raise a complaint, appointment request, or service ticket from one entry point.',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0 5-5m-5 5-5-5" />
      </svg>
    ),
    color: 'blue',
  },
  {
    title: 'System Logs & Assigns',
    description: 'The platform records the request, routes it, and assigns it to the right team.',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15M4.5 12h15M4.5 16.5h10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 15.5l2 2 3-3" />
      </svg>
    ),
    color: 'purple',
  },
  {
    title: 'Staff Handles Request',
    description: 'Staff update progress, attach notes, and work from a single service queue.',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 19.5v-2a4.5 4.5 0 0 1 9 0v2" />
        <circle cx="12" cy="9" r="3.5" />
      </svg>
    ),
    color: 'emerald',
  },
  {
    title: 'Real-Time Communication',
    description: 'Users and support teams exchange messages, updates, and clarifications in real time.',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11A2 2 0 0 1 19.5 6.5v7a2 2 0 0 1-2 2H11l-4.5 3v-3.5h0A2 2 0 0 1 4.5 13.5v-7Z" />
      </svg>
    ),
    color: 'orange',
  },
  {
    title: 'Resolution & Feedback',
    description: 'Cases close with service notes, ratings, and reporting data for continuous improvement.',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 19.5h14" />
      </svg>
    ),
    color: 'teal',
  },
];

const baseQuickStats = [
  { label: 'Live dashboards', value: '01' },
  { label: 'Service channels', value: '04' },
  { label: 'Workflow stages', value: '05' },
];

const Reveal = ({ children, className = '', delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

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
      className={`transition-all duration-700 ease-out will-change-transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const SectionHeading = ({ eyebrow, title, description, centered = false }) => (
  <div className={centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
      {eyebrow}
    </p>
    <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
      {title}
    </h2>
    <p className="mt-4 text-base sm:text-lg leading-8 text-slate-600 dark:text-slate-300 text-pretty">
      {description}
    </p>
  </div>
);

const renderFeaturePreview = (slug, isDark) => {
  const surface = isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200';
  const label = isDark ? 'text-slate-300' : 'text-slate-700';
  const soft = isDark ? 'bg-slate-800' : 'bg-slate-100';

  if (slug === 'complaints') {
    return (
      <div className={`rounded-2xl border p-3 ${surface}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
          <span>Complaint lifecycle</span>
          <span>Live</span>
        </div>
        <div className="mt-3 space-y-2">
          {[
            ['Submitted', 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200'],
            ['Assigned', 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200'],
            ['Resolved', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'],
          ].map(([text, classes]) => (
            <div key={text} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${classes}`}>
              <span className="h-2 w-2 rounded-full bg-current" />
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
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
          <span>Schedule view</span>
          <span>Week</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          {['Mon', 'Tue', 'Wed', 'Thu'].map((day) => (
            <div key={day} className="rounded-lg bg-slate-100/80 py-2 text-center dark:bg-slate-800/80">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className={`h-10 rounded-xl ${index === 2 || index === 5 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : soft}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (slug === 'templates') {
    return (
      <div className={`rounded-2xl border p-3 ${surface}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
          <span>Template builder</span>
          <span>Draft</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${soft} ${label}`}>Satisfaction score</div>
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${soft} ${label}`}>Resolution checklist</div>
          <div className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-2 text-xs font-semibold text-white">
            Approval workflow
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-3 ${surface}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
        <span>Helpdesk chat</span>
        <span>Typing</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm">
          Thank you, we are checking the request now.
        </div>
        <div className={`max-w-[82%] rounded-2xl rounded-tl-sm px-3 py-2 text-xs font-medium ${isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-700'}`}>
          we can communicate with helpdesk.
        </div>
        <div className={`flex items-center gap-1 rounded-2xl rounded-tl-sm px-3 py-2 text-xs ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          Support is typing...
        </div>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardStats = async () => {
      try {
        setStatsLoading(true);
        const data = await apiService.getPublicDashboardStats();
        if (!cancelled) {
          setDashboardStats(data);
        }
      } catch (error) {
        if (!cancelled) {
          setDashboardStats(null);
        }
        console.error('Failed to load landing dashboard stats:', error);
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    fetchDashboardStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = dashboardStats?.summary || {};
  const today = dashboardStats?.today || {};
  const dailyTrend = Array.isArray(dashboardStats?.daily_trend) ? dashboardStats.daily_trend : [];
  const activityFeed = Array.isArray(dashboardStats?.recent_activity) ? dashboardStats.recent_activity : [];

  const quickStats = statsLoading
    ? baseQuickStats
    : [
      { label: 'Open complaints', value: String(summary.open_complaints ?? 0).padStart(2, '0') },
      { label: 'Today\'s complaints', value: String(today.complaints_created ?? 0).padStart(2, '0') },
      { label: 'Active resolvers', value: String(summary.active_category_resolvers ?? 0).padStart(2, '0') },
    ];

  const scrollToSection = (id) => {
    if (typeof document === 'undefined') return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} scroll-smooth`}>
      <PublicNavbar />

      <main className="relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute right-[-6rem] top-32 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute left-[-4rem] top-[42rem] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        {/* Hero Section */}
        <section id="hero" className="relative scroll-mt-28 pb-16 pt-14 sm:pb-20 sm:pt-18 lg:pb-24 lg:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <Reveal>
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 shadow-sm backdrop-blur dark:border-blue-500/20 dark:bg-slate-900/70 dark:text-blue-300">
                    All-in-one service operations platform
                  </div>
                  <h1 className="mt-6 text-4xl font-black tracking-tight text-balance sm:text-5xl lg:text-6xl">
                    <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                      Manage Complaints, Appointments, and Support — All in One Platform
                    </span>
                  </h1>
                  <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300 sm:text-xl">
                    Streamline service delivery with real-time communication, structured workflows, and performance tracking.
                  </p>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25"
                    >
                      Get Started
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('contact')}
                      className={`inline-flex min-h-12 items-center justify-center rounded-2xl border px-6 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${isDark ? 'border-slate-700 bg-slate-900/60 text-slate-100 hover:border-slate-500 hover:bg-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700'}`}
                    >
                      Request Demo
                    </button>
                  </div>

                  <div className="mt-8 grid gap-3 sm:grid-cols-3">
                    {quickStats.map((stat) => (
                      <div
                        key={stat.label}
                        className={`rounded-2xl border p-4 shadow-sm ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white/90'}`}
                      >
                        <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{stat.value}</div>
                        <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={120} className="relative">
                <div className="absolute -left-6 -top-8 h-24 w-24 rounded-full bg-blue-500/15 blur-2xl" />
                <div className="absolute -bottom-4 right-2 h-20 w-20 rounded-full bg-cyan-400/15 blur-2xl" />
                <div className={`relative overflow-hidden rounded-[2rem] border p-4 shadow-[0_35px_90px_rgba(15,23,42,0.18)] backdrop-blur ${isDark ? 'border-slate-800 bg-slate-900/80' : 'border-white/80 bg-white/90'}`}>
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-slate-700/70">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-red-400" />
                      <span className="h-3 w-3 rounded-full bg-amber-400" />
                      <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <div className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300">
                      Live operations dashboard
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className="space-y-4">
                      <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50'}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Today&apos;s snapshot</p>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Open complaints</p>
                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                              {statsLoading ? '—' : String(summary.open_complaints ?? 0)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Appointments</p>
                            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                              {statsLoading ? '—' : String(summary.total_appointments ?? 0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Response trend</p>
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                            {statsLoading ? 'Loading' : 'Live data'}
                          </span>
                        </div>
                        <div className="mt-4 flex h-28 items-end gap-2">
                          {(dailyTrend.length > 0 ? dailyTrend : [
                            { label: 'Mon', complaints: 3 },
                            { label: 'Tue', complaints: 5 },
                            { label: 'Wed', complaints: 4 },
                            { label: 'Thu', complaints: 6 },
                            { label: 'Fri', complaints: 5 },
                            { label: 'Sat', complaints: 7 },
                            { label: 'Sun', complaints: 6 },
                          ]).map((item) => {
                            const barHeight = Math.max(18, Math.min(100, (item.complaints ?? item.count ?? 0) * 12));
                            return (
                              <div key={item.label} className="flex-1 rounded-t-2xl bg-slate-200/70 dark:bg-slate-800/80">
                                <div
                                  className="rounded-t-2xl bg-gradient-to-t from-blue-600 to-cyan-400"
                                  style={{ height: `${barHeight}%` }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">System overview</p>
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">Realtime sync</span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          {[
                            ['Submitted', summary.total_complaints ?? 0],
                            ['In review', summary.open_complaints ?? 0],
                            ['Resolved', summary.resolved_complaints ?? 0],
                          ].map(([label, value], index) => (
                            <div key={label} className={`rounded-2xl p-3 ${index === 2 ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white' : isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'} shadow-sm`}>
                              <p className={`text-xs ${index === 2 ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
                              <p className="mt-1 text-2xl font-black">{statsLoading ? '—' : value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={`rounded-2xl p-4 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent activity</p>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Live feed</span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {(activityFeed.length > 0 ? activityFeed : [
                            { kind: 'complaint', title: 'Complaint routed to Facilities', detail: 'Facilities', timestamp: '2 min ago' },
                            { kind: 'appointment', title: 'Appointment approved for tomorrow', detail: 'Support follow-up', timestamp: '12 min ago' },
                            { kind: 'complaint', title: 'Support reply sent to user', detail: 'Live helpdesk', timestamp: '24 min ago' },
                          ]).map((item, index) => (
                            <div key={`${item.kind || 'item'}-${item.title}-${index}`} className="flex items-start gap-3">
                              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-cyan-500' : 'bg-emerald-500'}`} />
                              <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.detail} • {statsLoading ? item.timestamp : new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 rounded-full border border-white/60 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg shadow-blue-500/10 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-200 animate-float-slow">
                    Dashboard UI mockup
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="scroll-mt-28 border-t border-slate-200/70 py-16 sm:py-20 dark:border-slate-800">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading
                eyebrow="Features"
                title="Everything teams need to manage requests in one place"
                description="A clean SaaS-style experience for complaints, appointments, service templates, and live helpdesk support."
              />
            </Reveal>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {featureCards.map((feature, index) => (
                <Reveal key={feature.slug} delay={index * 90} className="h-full">
                  <article className={`group h-full rounded-[1.75rem] border p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg transition-transform duration-300 group-hover:scale-105`}>
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{feature.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
                      </div>
                    </div>
                    <div className="mt-5">{renderFeaturePreview(feature.slug, isDark)}</div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="scroll-mt-28 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <SectionHeading
                eyebrow="How It Works"
                title="A simple workflow that moves requests from submission to resolution"
                description="Use one clear flow for complaints, appointments, and service requests with visible handoffs at every step."
              />
            </Reveal>

            <div className="relative mt-10">
              <div className="absolute left-8 right-8 top-10 hidden h-px bg-gradient-to-r from-blue-200 via-indigo-300 to-cyan-200 lg:block dark:from-slate-800 dark:via-slate-700 dark:to-slate-800" />
              <div className="grid gap-4 lg:grid-cols-5">
                {workflowSteps.map((step, index) => (
                  <Reveal key={step.title} delay={index * 90} className="relative">
                    <article className={`h-full rounded-[1.5rem] border p-5 text-center shadow-sm ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white'}`}>
                      <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-${step.color}-600 to-${step.color}-500 text-white shadow-lg`}>
                        {step.icon}
                      </div>
                      <div className={`mx-auto mt-4 inline-flex rounded-full border border-${step.color}-200/80 bg-${step.color}-50 px-3 py-1 text-xs font-semibold text-${step.color}-700 dark:border-${step.color}-500/20 dark:bg-${step.color}-500/10 dark:text-${step.color}-300`}>
                        Step {index + 1}
                      </div>
                      <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">{step.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-6 py-10 shadow-[0_30px_80px_rgba(37,99,235,0.3)] sm:px-10 sm:py-12 lg:px-12">
                <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Ready to launch</p>
                    <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl text-balance">
                      Transform Your Service Delivery Today
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-8 text-white/85 sm:text-lg">
                      Bring complaints, appointments, templates, and support together in one platform built for clarity, transparency, and fast action.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:text-blue-800"
                    >
                      Get Started
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('contact')}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/15"
                    >
                      Contact Us
                    </button>
                  </div>
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