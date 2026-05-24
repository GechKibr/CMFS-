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

// Animated Campus Images Array
const campusImages = [
  { src: '/uog-campus1.jpg', alt: 'University of Gondar Main Campus', name: 'Main Campus' },
  { src: '/uog-building.jpg', alt: 'University of Gondar Aluminum Building', name: 'Aluminum Building' },
  { src: '/uog-campus2.jpg', alt: 'University of Gondar Alumni Building', name: 'Alumni Building' }
];

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
      className={`transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// EXTREMELY SLOW Animated Image Carousel Component - Smooth Gradual Change
const AnimatedImageCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState('next');

  useEffect(() => {
    const interval = setInterval(() => {
      setDirection('next');
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % campusImages.length);
        setTimeout(() => {
          setIsAnimating(false);
        }, 1200);
      }, 400);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const nextImage = () => {
    if (isAnimating) return;
    setDirection('next');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % campusImages.length);
      setTimeout(() => {
        setIsAnimating(false);
      }, 1200);
    }, 300);
  };

  const prevImage = () => {
    if (isAnimating) return;
    setDirection('prev');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + campusImages.length) % campusImages.length);
      setTimeout(() => {
        setIsAnimating(false);
      }, 1200);
    }, 300);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-2xl">
      <div 
        className={`relative transition-all duration-1200 ease-in-out ${
          isAnimating 
            ? direction === 'next' 
              ? 'opacity-0 translate-x-12' 
              : 'opacity-0 -translate-x-12'
            : 'opacity-100 translate-x-0'
        }`}
      >
        <img 
          src={campusImages[currentIndex].src} 
          alt={campusImages[currentIndex].alt}
          className="w-full h-[600px] object-cover brightness-110 contrast-105"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/uog.png";
          }}
        />
        {/* Lighter overlay for better visibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"></div>
        
        <div className="absolute bottom-6 left-6 text-white opacity-80">
          <p className="text-sm font-light tracking-wide">{campusImages[currentIndex].name}</p>
        </div>
      </div>

      <button
        onClick={prevImage}
        className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-all duration-500 hover:scale-110 backdrop-blur-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={nextImage}
        className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white transition-all duration-500 hover:scale-110 backdrop-blur-sm"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="absolute bottom-6 right-6 flex justify-center gap-1.5">
        {campusImages.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              if (isAnimating) return;
              setDirection(index > currentIndex ? 'next' : 'prev');
              setIsAnimating(true);
              setTimeout(() => {
                setCurrentIndex(index);
                setTimeout(() => {
                  setIsAnimating(false);
                }, 1200);
              }, 300);
            }}
            className={`transition-all duration-500 rounded-full ${
              currentIndex === index 
                ? 'w-6 h-1.5 bg-white' 
                : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/70'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// Floating Image Cards Component
const FloatingImageCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
      {campusImages.map((image, index) => (
        <div
          key={index}
          className="group relative overflow-hidden rounded-2xl shadow-xl transform transition-all duration-700 hover:scale-105 hover:shadow-2xl animate-float-card-slow"
          style={{ animationDelay: `${index * 1.5}s` }}
        >
          <img 
            src={image.src} 
            alt={image.alt}
            className="w-full h-72 object-cover transition-transform duration-1000 group-hover:scale-110 brightness-105"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/uog.png";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h3 className="text-xl font-bold">{image.name}</h3>
              <p className="text-blue-200 text-sm mt-1">University of Gondar</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const renderFeaturePreview = (slug, isDark) => {
  const surface = isDark ? 'bg-slate-800/90 border-slate-700' : 'bg-white/90 border-slate-200';
  const soft = isDark ? 'bg-slate-700/50' : 'bg-slate-100';

  if (slug === 'complaints') {
    return (
      <div className={`rounded-2xl border p-3 ${surface}`}>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-blue-600 dark:text-blue-300">
          <span>Lifecycle</span>
          <span>Live</span>
        </div>
        <div className="mt-3 space-y-2">
          {['Submitted', 'Assigned', 'Resolved'].map((text) => (
            <div key={text} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${isDark ? 'border-slate-600' : 'border-slate-200'}`}>
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
            <div key={day} className="rounded-lg py-2 text-center bg-slate-100/80 dark:bg-slate-700/50">
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

// Clean, Minimal Hero Text Component - UoG Large and Bold with Bright Text
const HeroText = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Main Title - UoG Large and Bold with Bright Text */}
      <div className="overflow-hidden">
        <h1 className="text-7xl sm:text-8xl lg:text-9xl xl:text-[8rem] font-black tracking-tighter">
          <div className={`transform transition-all duration-1000 delay-200 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <span className="bg-gradient-to-r from-blue-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent animate-gradient-text drop-shadow-2xl">
              UoG
            </span>
          </div>
          <div className={`h-1 w-32 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full mt-6 transform transition-all duration-1000 delay-400 ease-out ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}></div>
        </h1>
      </div>

      {/* Subtitle Lines - Brighter and Clearer */}
      <div className="overflow-hidden pt-6">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-wide">
          <div className={`transform transition-all duration-1000 delay-600 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <span className="text-white drop-shadow-2xl font-medium">Complaint</span>
          </div>
          <div className={`transform transition-all duration-1000 delay-800 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <span className="text-white drop-shadow-2xl font-medium">Management</span>
          </div>
          <div className={`transform transition-all duration-1000 delay-1000 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <span className="bg-gradient-to-r from-blue-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent animate-gradient-text drop-shadow-2xl font-bold">
              & Feedback System
            </span>
          </div>
        </h2>
      </div>

      {/* Buttons with Staggered Animation - Brighter */}
      <div className={`flex flex-col sm:flex-row gap-5 pt-10 transform transition-all duration-1000 delay-1200 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <button
          onClick={() => window.location.href = '/login'}
          className="group inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 px-10 py-4 text-lg font-semibold text-white shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
        >
          Get Started
          <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
        <button
          onClick={() => {
            const state = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('oauth_state', state);
            const params = new URLSearchParams({
              client_id: MICROSOFT_CLIENT_ID,
              response_type: 'code',
              redirect_uri: `${window.location.origin}/auth/microsoft/callback`,
              scope: 'openid email profile User.Read',
              response_mode: 'query',
              state: state,
              prompt: 'select_account'
            });
            window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
          }}
          className="inline-flex items-center justify-center rounded-2xl border border-white/50 bg-white/15 backdrop-blur-sm px-10 py-4 text-lg font-semibold text-white hover:bg-white/25 transition-all duration-500 hover:-translate-y-1"
        >
          Create Account
        </button>
      </div>
    </div>
  );
};

const LandingPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();


  // Microsoft login redirect function
  const handleMicrosoftLogin = () => {
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('oauth_state', state);
    
    const params = new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${window.location.origin}/auth/microsoft/callback`,
      scope: MICROSOFT_SCOPE,
      response_mode: 'query',
      state: state,
      prompt: 'select_account'
    });
    
    const loginUrl = `${MICROSOFT_AUTH_URL}?${params.toString()}`;
    window.location.href = loginUrl;
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-100 to-slate-50'} scroll-smooth`}>
      <PublicNavbar />

      <main className="relative overflow-hidden flex-1">
        {/* Animated Background - Brighter */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-400/15 blur-3xl animate-pulse-slow" />
          <div className="absolute right-[-10rem] top-32 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl animate-pulse-slow animation-delay-2000" />
          <div className="absolute left-[-10rem] bottom-32 h-96 w-96 rounded-full bg-indigo-400/15 blur-3xl animate-pulse-slow animation-delay-4000" />
        </div>

        {/* HERO SECTION - Clean, Minimal, Left-Aligned Text with Slow Carousel Background */}
        <section className="relative min-h-screen flex items-center">
          {/* Background Image with EXTREMELY SLOW Carousel */}
          <div className="absolute inset-0 z-0">
            <AnimatedImageCarousel />
            {/* Lighter overlay for better brightness */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/15 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent"></div>
          </div>

          {/* Hero Content - Left Aligned, Clean, No Extra Text */}
          <div className="relative z-10 w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-32">
            <div className="max-w-4xl">
              <HeroText />
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
            <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center bg-black/20 backdrop-blur-sm">
              <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse-slow"></div>
            </div>
          </div>
        </section>

        {/* Floating Campus Images Section - Brighter */}
        <section className="py-20 bg-gradient-to-b from-transparent to-blue-50/20 dark:to-blue-950/10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto mb-12">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                  Explore Our Campus
                </p>
                <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white">
                  University of Gondar
                </h2>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                  Where excellence meets tradition
                </p>
              </div>
            </Reveal>

            <FloatingImageCards />
          </div>
        </section>

        {/* Features Section - Brighter */}
        <section id="features" className="py-24 bg-white dark:bg-slate-800/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                  Features
                </p>
                <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white">
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
                  <div className={`group rounded-2xl border p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl ${isDark ? 'border-slate-600 bg-slate-700/30' : 'border-slate-200 bg-white'}`}>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg transition-all duration-500 group-hover:scale-110`}>
                      {feature.icon}
                    </div>
                    <h3 className="mt-5 text-xl font-bold text-slate-800 dark:text-white">{feature.title}</h3>
                    <p className="mt-2 text-slate-600 dark:text-slate-300 leading-relaxed">{feature.description}</p>
                    <div className="mt-5">{renderFeaturePreview(feature.slug, isDark)}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section - Brighter */}
        <section id="workflow" className="py-24 bg-gradient-to-br from-slate-100 to-blue-50/50 dark:from-slate-800 dark:to-slate-700/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center max-w-3xl mx-auto">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 dark:text-blue-400">
                  Process
                </p>
                <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white">
                  How It Works
                </h2>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
                  Simple workflow from submission to resolution
                </p>
              </div>
            </Reveal>

            <div className="relative mt-16">
              <div className="absolute left-8 right-8 top-10 hidden h-px bg-gradient-to-r from-blue-300 via-indigo-300 to-cyan-300 lg:block dark:from-slate-600 dark:via-slate-500 dark:to-slate-600" />
              <div className="grid gap-6 lg:grid-cols-4">
                {workflowSteps.map((step, index) => (
                  <Reveal key={step.title} delay={index * 100}>
                    <div className={`text-center p-6 rounded-2xl border transition-all duration-500 hover:-translate-y-2 hover:shadow-xl ${isDark ? 'border-slate-600 bg-slate-700/30' : 'border-slate-200 bg-white'}`}>
                      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-${step.color}-500 to-${step.color}-600 text-white shadow-lg transition-all duration-500 hover:scale-110`}>
                        {step.icon}
                      </div>
                      <h3 className="mt-4 font-bold text-lg text-slate-800 dark:text-white">{step.title}</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section - Brighter */}
        <section className="py-24 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center">
                <h2 className="text-4xl sm:text-5xl font-bold text-white">
                  Ready to Get Started?
                </h2>
                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={() => navigate('/login')}
                    className="px-10 py-4 rounded-xl bg-white text-blue-700 font-semibold text-lg shadow-xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={handleMicrosoftLogin}
                    className="px-10 py-4 rounded-xl border-2 border-white/40 text-white font-semibold text-lg transition-all duration-500 hover:bg-white/15 hover:-translate-y-1"
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

      <style jsx>{`
        @keyframes float-card-slow {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.2; }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-25%) translateX(-50%); }
          50% { transform: translateY(0) translateX(-50%); }
        }
        
        @keyframes ping-slow {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes gradient-text {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .animate-float-card-slow {
          animation: float-card-slow 6s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 2.5s infinite;
        }
        
        .animate-ping-slow {
          animation: ping-slow 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }
        
        .animate-gradient-text {
          background-size: 200% 200%;
          animation: gradient-text 6s ease infinite;
        }
        
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .transition-duration-1200 {
          transition-duration: 1200ms;
        }
      `}</style>
    </div>
  );
};

export default LandingPage;