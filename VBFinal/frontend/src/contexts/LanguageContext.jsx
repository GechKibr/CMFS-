/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const LanguageContext = createContext();

const translations = {
  en: {
    admin_panel: 'Admin Panel',
    officer_panel: 'Officer Panel',
    student_portal: 'Student Portal',
    complaint_system: 'Complaint System',
    complaint_management: 'Complaint Management',
    dashboard: 'Dashboard',
    overview: 'Overview',
    submit_complaint: 'Submit Complaint',
    my_complaints: 'My Complaints',
    appointments: 'Appointments',
    assigned_complaints: 'Assigned Complaints',
    notifications: 'Notifications',
    profile: 'Profile',
    settings: 'Settings',
    users: 'Users',
    institutions: 'Institutions',
    categories: 'Categories',
    assignments: 'Assignments',
    system: 'System',
    title: 'Title',
    description: 'Description',
    institution: 'Institution',
    category: 'Category',
    status: 'Status',
    first_name: 'First Name',
    last_name: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    role: 'Role',
    password: 'Password',
    current_password: 'Current Password',
    new_password: 'New Password',
    confirm_password: 'Confirm New Password',
    pending: 'Pending',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    escalated: 'Escalated',
    closed: 'Closed',
    submit: 'Submit',
    update: 'Update',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    loading: 'Loading...',
    no_data: 'No data found',
    required: 'Required',
    submit_new_complaint: 'Submit New Complaint',
    complaint_submitted: 'Complaint submitted successfully! You will receive updates via email.',
    brief_title: 'Brief title of your complaint',
    detailed_description: 'Detailed description of your complaint',
    select_institution: 'Select Institution',
    mark_all_read: 'Mark all as read',
    all: 'All',
    unread: 'Unread',
    read: 'Read',
    loading_notifications: 'Loading notifications...',
    no_notifications_title: 'No notifications',
    all_caught_up: "You're all caught up! No unread notifications.",
    no_read_notifications: 'No read notifications to show.',
    no_notifications_yet: "You don't have any notifications yet.",
    mark_as_read: 'Mark as read',
    delete_notification: 'Delete notification',
    appointment_confirmed: 'Appointment Confirmed',
    appointment_cancelled: 'Appointment Cancelled',
    appointment_scheduled: 'Appointment Scheduled',
    appointment_scheduled_by_officers: 'Appointments scheduled by officers for your complaints',
    no_appointments_yet: 'No appointments from officers yet',
    appointments_will_appear: 'Scheduled appointments from officers will appear here.',
    complaint_assigned: 'Your complaint has been assigned to an officer',
    status_updated: 'Status updated: In Progress',
    new_comment: 'New comment on your complaint',
    feedback: 'Feedback',
    logout: 'Logout',
  },
  // am: {
  //   admin_panel: 'የአስተዳዳሪ ፓነል',
  //   officer_panel: 'የኦፊሰር ፓነል',
  //   student_portal: 'የተማሪ ፖርታል',
  //   complaint_system: 'የቅሬታ ስርዓት',
  //   complaint_management: 'የቅሬታ አስተዳደር',
  //   dashboard: 'ዳሽቦርድ',
  //   overview: 'አጠቃላይ',
  //   submit_complaint: 'ቅሬታ ያስገቡ',
  //   my_complaints: 'የእኔ ቅሬታዎች',
  //   appointments: 'ቀጠሮዎች',
  //   assigned_complaints: 'የተመደቡ ቅሬታዎች',
  //   notifications: 'ማሳወቂያዎች',
  //   profile: 'መገለጫ',
  //   settings: 'ቅንብሮች',
  //   users: 'ተጠቃሚዎች',
  //   institutions: 'ተቋማት',
  //   categories: 'ምድቦች',
  //   assignments: 'ምደባዎች',
  //   system: 'ስርዓት',
  //   title: 'ርዕስ',
  //   description: 'መግለጫ',
  //   institution: 'ተቋም',
  //   category: 'ምድብ',
  //   status: 'ሁኔታ',
  //   first_name: 'የመጀመሪያ ስም',
  //   last_name: 'የአባት ስም',
  //   email: 'ኢሜይል',
  //   phone: 'ስልክ',
  //   role: 'ሚና',
  //   password: 'የይለፍ ቃል',
  //   current_password: 'የአሁኑ የይለፍ ቃል',
  //   new_password: 'አዲስ የይለፍ ቃል',
  //   confirm_password: 'አዲስ የይለፍ ቃል አረጋግጥ',
  //   pending: 'በመጠባበቅ ላይ',
  //   in_progress: 'በሂደት ላይ',
  //   resolved: 'ተፈትቷል',
  //   escalated: 'ተደራሽ ላይ ደርሷል',
  //   closed: 'ተዘግቷል',
  //   submit: 'አስገባ',
  //   update: 'አዘምን',
  //   delete: 'ሰርዝ',
  //   edit: 'አርትዕ',
  //   view: 'እይ',
  //   save: 'አስቀምጥ',
  //   cancel: 'ሰርዝ',
  //   close: 'ዝጋ',
  //   loading: 'በመጫን ላይ...',
  //   no_data: 'መረጃ አልተገኘም',
  //   required: 'አስፈላጊ ነው',
  //   submit_new_complaint: 'አዲስ ቅሬታ ያስገቡ',
  //   complaint_submitted: 'ቅሬታዎ በተሳካ ሁኔታ ተልኳል! ዝርዝሮችን በኢሜይል ያገኛሉ።',
  //   brief_title: 'የቅሬታዎ አጭር ርዕስ',
  //   detailed_description: 'የቅሬታዎ ዝርዝር መግለጫ',
  //   select_institution: 'ተቋም ይምረጡ',
  //   mark_all_read: 'ሁሉንም እንደተነበበ ያሳዩ',
  //   all: 'ሁሉም',
  //   unread: 'ያልተነበበ',
  //   read: 'የተነበበ',
  //   loading_notifications: 'ማሳወቂያዎች በመጫን ላይ...',
  //   no_notifications_title: 'ማሳወቂያ የለም',
  //   all_caught_up: 'ሁሉንም አጠናቀቁ! ያልተነበበ ማሳወቂያ የለም።',
  //   no_read_notifications: 'የተነበቡ ማሳወቂያዎች የሉም።',
  //   no_notifications_yet: 'እስካሁን ማሳወቂያ የለዎትም።',
  //   mark_as_read: 'እንደተነበበ ያሳዩ',
  //   delete_notification: 'ማሳወቂያ ሰርዝ',
  //   appointment_confirmed: 'ቀጠሮ ተረጋግጧል',
  //   appointment_cancelled: 'ቀጠሮ ተሰርዟል',
  //   appointment_scheduled: 'ቀጠሮ ተይዟል',
  //   appointment_scheduled_by_officers: 'በኦፊሰሮች የተያዙ ቀጠሮዎች',
  //   no_appointments_yet: 'እስካሁን ከኦፊሰሮች ቀጠሮ የለም',
  //   appointments_will_appear: 'ከኦፊሰሮች የተያዙ ቀጠሮዎች እዚህ ይታያሉ።',
  //   complaint_assigned: 'ቅሬታዎ ለኦፊሰር ተመድቧል',
  //   status_updated: 'ሁኔታ ተዘምኗል: በሂደት ላይ',
  //   new_comment: 'በቅሬታዎ ላይ አዲስ አስተያየት',
  //   feedback: 'አስተያየት',
  //   logout: 'ውጣ',
  // },
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    const storedLanguage = window.localStorage.getItem('cmfts-language');
    if (storedLanguage === 'am' || storedLanguage === 'en') {
      return storedLanguage;
    }
    return navigator.language?.toLowerCase().startsWith('am') ? 'am' : 'en';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('cmfts-language', language);
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useMemo(() => (key) => translations[language]?.[key] || translations.en[key] || key, [language]);
  const toggleLanguage = () => setLanguage((prev) => (prev === 'en' ? 'am' : 'en'));

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
