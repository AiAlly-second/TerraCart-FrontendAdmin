import React from 'react';
import { FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';

/**
 * Reusable Textarea component with error and warning states
 * Matches the website UI theme
 */
const Textarea = ({
  label,
  id,
  value,
  onChange,
  placeholder,
  error,
  warning,
  success,
  required = false,
  disabled = false,
  rows = 4,
  className = '',
  ...props
}) => {
  // Determine textarea state
  const getTextareaClasses = () => {
    const baseClasses = "w-full px-4 py-2 text-[#4a2e1f] bg-[#fef4ec] border rounded-lg transition-colors focus:outline-none resize-y";
    
    if (error) {
      return `${baseClasses} border-[#ef4444] focus:ring-2 focus:ring-[#ef4444] focus:border-[#ef4444]`;
    } else if (warning) {
      return `${baseClasses} border-[#d86d2a] focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]`;
    } else if (success) {
      return `${baseClasses} border-[#10b981] focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]`;
    } else {
      return `${baseClasses} border-[#e2c1ac] focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]`;
    }
  };

  const getMessageClasses = () => {
    if (error) {
      return "text-sm text-[#991b1b] mt-1 flex items-center gap-1";
    } else if (warning) {
      return "text-sm text-[#92400e] mt-1 flex items-center gap-1";
    } else if (success) {
      return "text-sm text-[#065f46] mt-1 flex items-center gap-1";
    }
    return "";
  };

  const getIcon = () => {
    if (error) {
      return <FaExclamationCircle className="text-[#ef4444] text-xs" />;
    } else if (warning) {
      return <FaExclamationCircle className="text-[#d86d2a] text-xs" />;
    } else if (success) {
      return <FaCheckCircle className="text-[#10b981] text-xs" />;
    }
    return null;
  };

  const getMessage = () => {
    if (error) return error;
    if (warning) return warning;
    if (success) return success;
    return null;
  };

  return (
    <div className={`${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-semibold text-[#4a2e1f] mb-2"
        >
          {label}
          {required && <span className="text-[#ef4444] ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          className={getTextareaClasses()}
          {...props}
        />
        {(error || warning || success) && (
          <div className="absolute right-3 top-3">
            {getIcon()}
          </div>
        )}
      </div>
      {getMessage() && (
        <div className={getMessageClasses()}>
          {getIcon()}
          <span>{getMessage()}</span>
        </div>
      )}
    </div>
  );
};

export default Textarea;










