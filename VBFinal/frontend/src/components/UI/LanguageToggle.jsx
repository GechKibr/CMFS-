import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const LanguageToggle = ({ className = "" }) => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${className}`}
      title={language === 'en' ? 'Switch to Amharic' : 'Switch to English'}
    >
      <span className="text-sm font-medium">
        {language === 'en' ? 'EN' : 'አማ'}
      </span>
      <div className="w-8 h-4 bg-gray-300 rounded-full relative">
        <div className={`w-3 h-3 bg-blue-600 rounded-full absolute top-0.5 transition-transform ${
          language === 'am' ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </div>
    </button>
  );
};

export default LanguageToggle;
