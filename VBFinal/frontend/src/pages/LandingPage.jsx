import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/api';
import PublicNavbar from '../components/UI/PublicNavbar';
import PublicFooter from '../components/UI/PublicFooter';

const heroImages = [
  '/assets/devoted.png',
  '/assets/fasil.webp',
  '/assets/gate.jfif',
  '/assets/hospital.jfif',
  '/assets/library.jfif',
  '/assets/tedi.webp',
];

const LandingPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState(null); // 'success' | 'error' | null
  const [contactLoading, setContactLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementComments, setAnnouncementComments] = useState({});
  const [expandedAnnouncements, setExpandedAnnouncements] = useState({});
  const [newComments, setNewComments] = useState({});

  const storedUser = localStorage.getItem('user');
  let currentUser = null;
  try {
    currentUser = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    currentUser = null;
  }
  const isAuthenticated = !!localStorage.getItem('token') && !!currentUser;

  const loadAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const data = await apiService.getPublicAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : data.results || []);
    } catch {
      setAnnouncements([]);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  useEffect(() => {
    let intervalId;
    const tick = () => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    };
    const start = () => {
      if (intervalId) clearInterval(intervalId);
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      intervalId = setInterval(tick, 3000);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (intervalId) clearInterval(intervalId);
        intervalId = undefined;
      } else {
        start();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const handleToggleLike = async (announcementId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    try {
      await apiService.toggleAnnouncementLike(announcementId);
      await loadAnnouncements();
    } catch {
      // noop
    }
  };

  const toggleComments = async (announcementId) => {
    const expanded = !!expandedAnnouncements[announcementId];
    setExpandedAnnouncements((prev) => ({ ...prev, [announcementId]: !expanded }));

    if (!expanded && !announcementComments[announcementId]) {
      try {
        const data = await apiService.getAnnouncementComments(announcementId);
        setAnnouncementComments((prev) => ({
          ...prev,
          [announcementId]: Array.isArray(data) ? data : data.results || [],
        }));
      } catch {
        setAnnouncementComments((prev) => ({ ...prev, [announcementId]: [] }));
      }
    }
  };

  const handleAddComment = async (announcementId) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const message = (newComments[announcementId] || '').trim();
    if (!message) return;

    try {
      await apiService.addAnnouncementComment(announcementId, message);
      const data = await apiService.getAnnouncementComments(announcementId);
      setAnnouncementComments((prev) => ({
        ...prev,
        [announcementId]: Array.isArray(data) ? data : data.results || [],
      }));
      setNewComments((prev) => ({ ...prev, [announcementId]: '' }));
      await loadAnnouncements();
    } catch {
      // noop
    }
  };

  const handleContact = async (e) => {
    e.preventDefault();
    setContactLoading(true);
    setContactStatus(null);
    try {
      await apiService.sendContact(contactForm);
      setContactStatus('success');
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      setContactStatus('error');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative py-12 sm:py-16 lg:py-20 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
            <div className="text-center lg:text-left min-w-0">
              <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold mb-4 sm:mb-6 text-center max-w-full ${isDark ? 'bg-blue-900/40 text-blue-200 border border-blue-700' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                Trusted Campus Feedback Platform
              </span>
              <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold ${isDark ? 'text-white' : 'text-gray-900'} mb-4 sm:mb-6 leading-tight text-balance break-words`}>
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Complaint Management and Feedback Tracking for UOG
                </span>
              </h1>

              <p className={`text-base sm:text-lg md:text-xl ${isDark ? 'text-gray-300' : 'text-gray-600'} mb-6 sm:mb-8 leading-relaxed text-pretty max-w-prose mx-auto lg:mx-0`}>
                A modern platform for educational institutions to submit, track, and resolve concerns quickly with visibility and accountability.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-4">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="min-h-[44px] px-8 py-3.5 sm:py-4 rounded-lg text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:opacity-90 transition-all shadow-lg shadow-blue-500/25 touch-manipulation"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('announcements')?.scrollIntoView({ behavior: 'smooth' })}
                  className={`min-h-[44px] px-8 py-3.5 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all border-2 active:opacity-90 touch-manipulation ${isDark
                    ? 'border-gray-600 text-white hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  View Announcements
                </button>
              </div>
            </div>

            <div className="relative w-full min-w-0">
              <div className="relative h-[220px] min-h-[200px] sm:h-[300px] md:h-[360px] lg:h-[420px] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-black/10">
                {heroImages.map((image, index) => (
                  <img
                    key={image}
                    src={image}
                    alt={`Campus view ${index + 1}`}
                    width={1200}
                    height={900}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={index === 0 ? 'high' : 'low'}
                    className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${currentSlide === index ? 'opacity-100 z-[1]' : 'opacity-0 z-0'}`}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:bottom-4 sm:left-4 sm:right-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-white text-sm sm:text-base font-medium drop-shadow-sm pr-2 sm:max-w-[65%]">
                    Enhancing student voice and service quality
                  </p>
                  <div className="flex flex-wrap gap-1 justify-center sm:justify-end sm:shrink-0" role="tablist" aria-label="Hero image carousel">
                    {heroImages.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        role="tab"
                        aria-selected={currentSlide === index}
                        aria-label={`Go to slide ${index + 1}`}
                        onClick={() => setCurrentSlide(index)}
                        className="p-2 -m-1 rounded-full touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                      >
                        <span
                          className={`block h-2.5 rounded-full transition-all ${currentSlide === index ? 'w-7 bg-white' : 'w-2.5 bg-white/60'}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Fast Routing</p>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Smart complaint assignment</p>
            </div>
            <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Transparent Workflow</p>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Real-time status tracking</p>
            </div>
            <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-900/40 border-gray-700' : 'bg-white/80 border-gray-200'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Analytics Ready</p>
              <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Better service decisions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Public Announcement Board */}
      <section id="announcements" className={`py-10 sm:py-14 ${isDark ? 'bg-gray-800/60' : 'bg-blue-50/70'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className={`text-xl sm:text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Announcement Board
            </h2>
            <span className={`text-xs sm:text-sm px-3 py-1.5 rounded-full shrink-0 self-start sm:self-auto ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-700'}`}>
              Posted by officers
            </span>
          </div>

          {announcementsLoading ? (
            <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>Loading announcements...</p>
          ) : announcements.length === 0 ? (
            <div className={`rounded-xl p-6 border ${isDark ? 'bg-gray-900/40 border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600'}`}>
              No public announcements available right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {announcements.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-xl p-4 sm:p-5 border shadow-sm min-w-0 ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <h3 className={`text-base sm:text-lg font-semibold break-words ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.is_pinned ? '📌 ' : ''}
                      {item.title}
                    </h3>
                    {item.is_pinned && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 shrink-0 self-start">Pinned</span>
                    )}
                  </div>
                  <p className={`mt-2 text-sm sm:text-base break-words ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.message}</p>
                  <p className={`mt-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    By {item.created_by_name} | {new Date(item.created_at).toLocaleString()}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(item.id)}
                      className={`min-h-[44px] px-4 py-2 text-sm rounded-lg border transition-colors touch-manipulation active:opacity-90 ${item.liked_by_user
                        ? 'bg-red-50 text-red-600 border-red-200'
                        : isDark
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      ❤ {item.likes_count || 0}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleComments(item.id)}
                      className={`min-h-[44px] px-4 py-2 text-sm rounded-lg border transition-colors touch-manipulation active:opacity-90 ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                      💬 {item.comments_count || 0}
                    </button>
                  </div>

                  {expandedAnnouncements[item.id] && (
                    <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-gray-700 bg-gray-900/40' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {(announcementComments[item.id] || []).length === 0 ? (
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            No comments yet.
                          </p>
                        ) : (
                          (announcementComments[item.id] || []).map((comment) => (
                            <div key={comment.id} className={`rounded p-2 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                              <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{comment.message}</p>
                              <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {comment.user_name} | {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                        <input
                          type="text"
                          enterKeyHint="send"
                          value={newComments[item.id] || ''}
                          onChange={(e) => setNewComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder={isAuthenticated ? 'Write a comment...' : 'Sign in to comment'}
                          disabled={!isAuthenticated}
                          className={`flex-1 min-h-[44px] px-3 py-2.5 text-base sm:text-sm border rounded-lg ${isDark ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleAddComment(item.id)}
                          disabled={!isAuthenticated || !(newComments[item.id] || '').trim()}
                          className="min-h-[44px] px-4 py-2.5 text-base sm:text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation shrink-0 sm:w-auto w-full"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className={`py-12 sm:py-16 lg:py-20 ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 [padding-left:max(1rem,env(safe-area-inset-left))] [padding-right:max(1rem,env(safe-area-inset-right))]">
          {/* Contact Form */}
          <div className="max-w-2xl mx-auto w-full min-w-0">
            <h3 className={`text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>Send Us a Message</h3>
            <form onSubmit={handleContact} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact-name" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Name *</label>
                  <input
                    id="contact-name"
                    required
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={contactForm.name}
                    onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                    className={`w-full min-h-[44px] px-3 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email *</label>
                  <input
                    id="contact-email"
                    required
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    className={`w-full min-h-[44px] px-3 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="contact-subject" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Subject *</label>
                <input
                  id="contact-subject"
                  required
                  type="text"
                  name="subject"
                  autoComplete="off"
                  value={contactForm.subject}
                  onChange={e => setContactForm(p => ({ ...p, subject: e.target.value }))}
                  className={`w-full min-h-[44px] px-3 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
              <div>
                <label htmlFor="contact-message" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Message *</label>
                <textarea
                  id="contact-message"
                  required
                  rows={5}
                  name="message"
                  autoComplete="off"
                  value={contactForm.message}
                  onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                  className={`w-full px-3 py-2.5 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[120px] ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
              </div>
              {contactStatus === 'success' && (
                <p className="text-green-600 dark:text-green-400 text-sm font-medium" role="status">Message sent successfully. We&apos;ll get back to you soon.</p>
              )}
              {contactStatus === 'error' && (
                <p className="text-red-600 dark:text-red-400 text-sm font-medium" role="alert">Failed to send message. Please try again.</p>
              )}
              <button
                type="submit"
                disabled={contactLoading}
                className="w-full min-h-[48px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg text-base font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-60 touch-manipulation active:opacity-90"
              >
                {contactLoading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default LandingPage;
