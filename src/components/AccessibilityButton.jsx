import React, { useState } from 'react';
import { FaUniversalAccess, FaTimes } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';

const AccessibilityButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <>
      {/* Floating Accessibility Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
        aria-label={t('accessibility')}
      >
        {isOpen ? (
          <FaTimes className="text-2xl" />
        ) : (
          <FaUniversalAccess className="text-2xl group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* Accessibility Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div 
            className="fixed bottom-24 right-6 z-50 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <FaUniversalAccess className="text-2xl text-white" />
                <h3 className="text-lg font-bold text-white">
                  {t('accessibility')}
                </h3>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Info Text */}
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Language selection removed ✓
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  (Updated: Feb 2, 2026)
                </p>
              </div>
            </div>
          </div>

          {/* Global Styles for Animation */}
          <style>{`
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </>
      )}
    </>
  );
};

export default AccessibilityButton;
