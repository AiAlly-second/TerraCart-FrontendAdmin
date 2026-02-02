import React, { useState } from 'react';
import { FaGlobe, FaCheck } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import { languages } from '../i18n/translations';

const LanguageSwitcher = () => {
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Language Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
        aria-label={t('changeLanguage')}
      >
        <FaGlobe className="text-purple-600 dark:text-purple-400" />
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {languages.find(lang => lang.code === currentLanguage)?.nativeName || 'English'}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('selectLanguage')}
              </div>
              
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language.code)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors ${
                    currentLanguage === language.code
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{language.nativeName}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {language.name}
                    </span>
                  </div>
                  
                  {currentLanguage === language.code && (
                    <FaCheck className="text-purple-600 dark:text-purple-400" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;
