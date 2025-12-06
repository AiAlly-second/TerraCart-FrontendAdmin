import React, { useEffect } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimesCircle, FaTimes } from 'react-icons/fa';

const Alert = ({ message, type = 'info', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getAlertStyles = () => {
    const baseStyles = "min-w-[300px] max-w-[500px] p-4 rounded-xl shadow-lg border-2 flex items-start gap-3 animate-slide-in";
    
    const typeStyles = {
      success: "bg-[#f0f9f4] border-[#10b981] text-[#065f46]",
      error: "bg-[#fef2f2] border-[#ef4444] text-[#991b1b]",
      warning: "bg-[#fffbeb] border-[#d86d2a] text-[#92400e]",
      info: "bg-[#fef4ec] border-[#d86d2a] text-[#4a2e1f]"
    };

    return `${baseStyles} ${typeStyles[type] || typeStyles.info}`;
  };

  const getIcon = () => {
    const iconClass = "text-xl flex-shrink-0 mt-0.5";
    switch (type) {
      case 'success':
        return <FaCheckCircle className={`${iconClass} text-[#10b981]`} />;
      case 'error':
        return <FaTimesCircle className={`${iconClass} text-[#ef4444]`} />;
      case 'warning':
        return <FaExclamationCircle className={`${iconClass} text-[#d86d2a]`} />;
      default:
        return <FaInfoCircle className={`${iconClass} text-[#d86d2a]`} />;
    }
  };

  return (
    <div className={getAlertStyles()}>
      {getIcon()}
      <div className="flex-1">
        <p className="text-sm font-medium leading-relaxed break-words">{message}</p>
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 text-[#6b4423] hover:text-[#4a2e1f] transition-colors p-1 rounded hover:bg-white/50"
        aria-label="Close alert"
      >
        <FaTimes className="text-sm" />
      </button>
    </div>
  );
};

export default Alert;

