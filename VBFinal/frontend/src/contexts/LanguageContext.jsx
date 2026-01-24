import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Translation dictionary - will be populated with Amharic translations
const translations = {
  en: {
    // Navigation & General
    'admin_panel': 'Admin Panel',
    'officer_panel': 'Officer Panel',
    'student_portal': 'Student Portal',
    'complaint_system': 'Complaint System',
    'complaint_management': 'Complaint Management',
    'dashboard': 'Dashboard',
    'overview': 'Overview',
    'submit_complaint': 'Submit Complaint',
    'my_complaints': 'My Complaints',
    'assigned_complaints': 'Assigned Complaints',
    'notifications': 'Notifications',
    'history': 'History',
    'profile': 'Profile',
    'settings': 'Settings',
    'users': 'Users',
    'institutions': 'Institutions',
    'categories': 'Categories',
    'resolver_levels': 'Resolver Levels',
    'assignments': 'Assignments',
    'ai_settings': 'AI Settings',
    'system': 'System',
    
    // Form Labels
    'title': 'Title',
    'description': 'Description',
    'institution': 'Institution',
    'category': 'Category',
    'priority': 'Priority',
    'status': 'Status',
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'username': 'Username',
    'email': 'Email',
    'phone': 'Phone',
    'campus_id': 'Campus ID',
    'college': 'College',
    'role': 'Role',
    'password': 'Password',
    'current_password': 'Current Password',
    'new_password': 'New Password',
    'confirm_password': 'Confirm New Password',
    
    // Status Values
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'escalated': 'Escalated',
    'closed': 'Closed',
    
    // Priority Values
    'urgent': 'Urgent',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
    
    // Actions
    'submit': 'Submit',
    'update': 'Update',
    'delete': 'Delete',
    'edit': 'Edit',
    'view': 'View',
    'view_details': 'View Details',
    'escalate': 'Escalate',
    'assign': 'Assign',
    'add': 'Add',
    'save': 'Save',
    'cancel': 'Cancel',
    'close': 'Close',
    'search': 'Search',
    'filter': 'Filter',
    'export': 'Export',
    
    // Messages
    'loading': 'Loading...',
    'no_data': 'No data found',
    'success': 'Success',
    'error': 'Error',
    'warning': 'Warning',
    'required': 'Required',
    'optional': 'Optional',
    'active': 'Active',
    'inactive': 'Inactive',
    'verified': 'Verified',
    'unverified': 'Unverified',
    
    // Complaint Form
    'submit_new_complaint': 'Submit New Complaint',
    'ai_will_detect': 'AI will automatically detect the category and priority of your complaint.',
    'complaint_submitted': 'Complaint submitted successfully! You will receive updates via email.',
    'brief_title': 'Brief title of your complaint',
    'detailed_description': 'Detailed description of your complaint',
    'select_institution': 'Select Institution',
    
    // Profile
    'personal_information': 'Personal Information',
    'account_information': 'Account Information',
    'notification_settings': 'Notification Settings',
    'change_password': 'Change Password',
    'update_profile': 'Update Profile',
    'email_notifications': 'Email Notifications',
    'sms_notifications': 'SMS Notifications',
    'push_notifications': 'Push Notifications',
    'receive_updates_email': 'Receive updates via email',
    'receive_urgent_sms': 'Receive urgent updates via SMS',
    'browser_notifications': 'Browser notifications for real-time updates',
    'authentication_provider': 'Authentication Provider',
    'date_joined': 'Date Joined',
    'last_login': 'Last Login',
    'user_id': 'User ID',
    'account_status': 'Account Status',
    
    // Table Headers
    'complaint_id': 'Complaint ID',
    'submission_date': 'Submission Date',
    'assigned_to': 'Assigned To',
    'actions': 'Actions',
    'date': 'Date',
    'name': 'Name',
    'domain': 'Domain',
    
    // Colleges
    'college_medicine': 'College of Medicine and Health Sciences',
    'college_natural': 'College of Natural and Computational Sciences',
    'college_business': 'College of Business and Economics',
    'college_social': 'College of Social Sciences and Humanities',
    'college_veterinary': 'College of Veterinary Medicine and Animal Sciences',
    'college_agriculture': 'College of Agriculture and Environmental Sciences',
    'college_informatics': 'College of Informatics',
    'college_education': 'College of Education',
    'institute_technology': 'Institute of Technology',
    'institute_biotechnology': 'Institute of Biotechnology',
    'school_law': 'School of Law',
    
    // Notifications
    'mark_all_read': 'Mark all as read',
    'urgent_complaint_assigned': 'Urgent Complaint Assigned',
    'new_urgent_complaint': 'New urgent complaint requires immediate attention',
    'escalation_deadline': 'Escalation Deadline Approaching',
    'deadline_approaching': 'Complaint deadline in 2 hours',
    'complaint_assigned': 'Your complaint has been assigned to an officer',
    'status_updated': 'Status updated: In Progress',
    'new_comment': 'New comment on your complaint',
    
    // Stats & Metrics
    'total_complaints': 'Total Complaints',
    'resolved_complaints': 'Resolved Complaints',
    'avg_resolution_time': 'Avg Resolution Time',
    'escalations': 'Escalations',
    'assigned': 'Assigned',
    
    // Time
    'days': 'days',
    'hours': 'hours',
    'minutes': 'minutes',
    'ago': 'ago',
    'today': 'Today',
    'yesterday': 'Yesterday',
    
    // Common Phrases
    'welcome': 'Welcome',
    'manage_system': 'Manage your complaint management system',
    'submit_track_complaints': 'Submit and track your complaints',
    'manage_assigned': 'Manage your assigned complaints',
    'switch_light_mode': 'Switch to light mode',
    'switch_dark_mode': 'Switch to dark mode',
    'complaint_details': 'Complaint Details',
    'add_comment': 'Add Comment',
    'add_your_comment': 'Add your comment...',
    'no_comments': 'No comments yet',
    'no_complaints': 'No complaints found',
    'no_notifications': 'No notifications found'
  },
  am: {
    // Navigation & General
    'admin_panel': 'የአስተዳዳሪ ክፍል',
    'officer_panel': 'የኦፊሰር ክፍል',
    'student_portal': 'የተማሪዎች ፖርታል',
    'complaint_system': 'የቅሬታ መቀበያ ስርዓት',
    'complaint_management': 'የቅሬታ አስተዳደር',
    'dashboard': 'ዳሽቦርድ',
    'overview': 'አጠቃላይ እይታ',
    'submit_complaint': 'ቅሬታ አቅርብ',
    'my_complaints': 'የእኔ ቅሬታዎች',
    'assigned_complaints': 'የተመደቡ ቅሬታዎች',
    'notifications': 'ማሳወቂያዎች',
    'history': 'ታሪክ',
    'profile': 'መገለጫ',
    'settings': 'ቅንብሮች',
    'users': 'ተጠቃሚዎች',
    'institutions': 'ተቋማት',
    'categories': 'ዘርፎች',
    'resolver_levels': 'የዳኝነት ደረጃዎች',
    'assignments': 'ምደባዎች',
    'ai_settings': 'የAI ቅንብሮች',
    'system': 'ሲስተም',
    
    // Form Labels
    'title': 'ርዕስ',
    'description': 'መግለጫ',
    'institution': 'ተቋም',
    'category': 'ዘርፍ',
    'priority': 'ቅድሚያ የሚሰጠው',
    'status': 'ሁኔታ',
    'first_name': 'ስም',
    'last_name': 'የአባት ስም',
    'username': 'የተጠቃሚ ስም',
    'email': 'ኢሜይል',
    'phone': 'ስልክ',
    'campus_id': 'የግቢ መታወቂያ',
    'college': 'ኮሌጅ',
    'role': 'ሚና',
    'password': 'የይለፍ ቃል',
    'current_password': 'የአሁኑ የይለፍ ቃል',
    'new_password': 'አዲስ የይለፍ ቃል',
    'confirm_password': 'አዲሱን የይለፍ ቃል አረጋግጥ',
    
    // Status Values
    'pending': 'በመጠባበቅ ላይ',
    'in_progress': 'በሂደት ላይ',
    'resolved': 'ተፈትቷል',
    'escalated': 'የተሸጋገረ',
    'closed': 'የተዘጋ',
    
    // Priority Values
    'urgent': 'አስቸኳይ',
    'high': 'ከፍተኛ',
    'medium': 'መካከለኛ',
    'low': 'ዝቅተኛ',
    
    // Actions
    'submit': 'አስገባ',
    'update': 'አዘምን',
    'delete': 'ሰርዝ',
    'edit': 'አሻሽል',
    'view': 'እይ',
    'view_details': 'ዝርዝሩን እይ',
    'escalate': 'አሸጋግር',
    'assign': 'መድብ',
    'add': 'ጨምር',
    'save': 'አስቀምጥ',
    'cancel': 'ሰርዝ',
    'close': 'ዝጋ',
    'search': 'ፈልግ',
    'filter': 'አጣራ',
    'export': 'ላክ',
    
    // Messages
    'loading': 'በመጫን ላይ...',
    'no_data': 'ምንም መረጃ አልተገኘም',
    'success': 'ተሳክቷል',
    'error': 'ስህተት',
    'warning': 'ማስጠንቀቂያ',
    'required': 'ግዴታ',
    'optional': 'አማራጭ',
    'active': 'ንቁ',
    'inactive': 'ንቁ ያልሆነ',
    'verified': 'የተረጋገጠ',
    'unverified': 'ያልተረጋገጠ',
    
    // Complaint Form
    'submit_new_complaint': 'አዲስ ቅሬታ አቅርብ',
    'ai_will_detect': 'AI የቅሬታዎን ዘርፍ እና ቅድሚያ የሚሰጠውን በራሱ ይለያል።',
    'complaint_submitted': 'ቅሬታዎ በተሳካ ሁኔታ ቀርቧል! ዝመናዎችን በኢሜይል ይደርስዎታል።',
    'brief_title': 'የቅሬታዎ አጭር ርዕስ',
    'detailed_description': 'የቅሬታዎ ዝርዝር መግለጫ',
    'select_institution': 'ተቋም ይምረጡ',
    
    // Profile
    'personal_information': 'የግል መረጃ',
    'account_information': 'የመለያ መረጃ',
    'notification_settings': 'የማሳወቂያ ቅንብሮች',
    'change_password': 'የይለፍ ቃል ቀይር',
    'update_profile': 'መገለጫን አዘምን',
    'email_notifications': 'የኢሜይል ማሳወቂያዎች',
    'sms_notifications': 'የSMS ማሳወቂያዎች',
    'push_notifications': 'የግፊት ማሳወቂያዎች',
    'receive_updates_email': 'ዝመናዎችን በኢሜይል ተቀበል',
    'receive_urgent_sms': 'አስቸኳይ ዝመናዎችን በSMS ተቀበል',
    'browser_notifications': 'የቀጥታ ዝመናዎችን በብሮውዘር ማሳወቂያ ተቀበል',
    'authentication_provider': 'የማረጋገጫ ምንጭ',
    'date_joined': 'የተቀላቀሉበት ቀን',
    'last_login': 'ለመጨረሻ ጊዜ የገቡበት',
    'user_id': 'የተጠቃሚ መለያ',
    'account_status': 'የመለያ ሁኔታ',
    
    // Table Headers
    'complaint_id': 'የቅሬታ መለያ',
    'submission_date': 'የቀረበበት ቀን',
    'assigned_to': 'የተመደበለት ሰው',
    'actions': 'ተግባራት',
    'date': 'ቀን',
    'name': 'ስም',
    'domain': 'ዶሜይን',
    
    // Colleges
    'college_medicine': 'የህክምና እና ጤና ሳይንስ ኮሌጅ',
    'college_natural': 'የተፈጥሮ እና ቀመር ሳይንስ ኮሌጅ',
    'college_business': 'ቢዝነስ እና ኢኮኖሚክስ ኮሌጅ',
    'college_social': 'የማህበራዊ ሳይንስ እና ሂውማኒቲስ ኮሌጅ',
    'college_veterinary': 'የእንስሳት ህክምና እና እንስሳት ሳይንስ ኮሌጅ',
    'college_agriculture': 'የግብርና እና አካባቢ ሳይንስ ኮሌጅ',
    'college_informatics': 'የኢንፎርማቲክስ ኮሌጅ',
    'college_education': 'የትምህርት ኮሌጅ',
    'institute_technology': 'የቴክኖሎጂ ኢንስቲትዩት',
    'institute_biotechnology': 'የባዮቴክኖሎጂ ኢንስቲትዩት',
    'school_law': 'የህግ ትምህርት ቤት',
    
    // Notifications
    'mark_all_read': 'ሁሉንም እንደተነበበ አድርግ',
    'urgent_complaint_assigned': 'አስቸኳይ ቅሬታ ተመድቧል',
    'new_urgent_complaint': 'አዲስ አስቸኳይ ቅሬታ አፋጣኝ ትኩረት ይፈልጋል',
    'escalation_deadline': 'የሽግግር ቀነ-ገደብ እየደረሰ ነው',
    'deadline_approaching': 'የቅሬታው ቀነ-ገደብ በ2 ሰዓት ውስጥ ያበቃል',
    'complaint_assigned': 'ቅሬታዎ ለኦፊሰር ተመድቧል',
    'status_updated': 'ሁኔታው ተቀይሯል፡ በሂደት ላይ',
    'new_comment': 'በቅሬታዎ ላይ አዲስ አስተያየት አለ',
    
    // Stats & Metrics
    'total_complaints': 'አጠቃላይ ቅሬታዎች',
    'resolved_complaints': 'የተፈቱ ቅሬታዎች',
    'avg_resolution_time': 'አማካይ የመፍቻ ጊዜ',
    'escalations': 'የተሸጋገሩ ቅሬታዎች',
    'assigned': 'የተመደቡ',
    
    // Time
    'days': 'ቀናት',
    'hours': 'ሰዓታት',
    'minutes': 'ደቂቃዎች',
    'ago': 'ከ... በፊት',
    'today': 'ዛሬ',
    'yesterday': 'ትናንት',
    
    // Common Phrases
    'welcome': 'እንኳን ደህና መጡ',
    'manage_system': 'የቅሬታ ማስተዳደሪያ ስርዓትዎን ያስተዳድሩ',
    'submit_track_complaints': 'ቅሬታዎን ያቅርቡ እና ይከታተሉ',
    'manage_assigned': 'የተመደቡልዎትን ቅሬታዎች ያስተዳድሩ',
    'switch_light_mode': 'ወደ ብርሃን ሞድ ቀይር',
    'switch_dark_mode': 'ወደ ጨለማ ሞድ ቀይር',
    'complaint_details': 'የቅሬታው ዝርዝር',
    'add_comment': 'አስተያየት ጨምር',
    'add_your_comment': 'አስተያየትዎን እዚህ ይጻፉ...',
    'no_comments': 'እስካሁን ምንም አስተያየት የለም',
    'no_complaints': 'ምንም ቅሬታ አልተገኘም',
    'no_notifications': 'ምንም ማሳወቂያ የለም'
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language');
    return saved || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'am' : 'en');
  };

  const t = (key) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
