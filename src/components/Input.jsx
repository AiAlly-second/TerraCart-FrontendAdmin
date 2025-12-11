import React from 'react';
import { FaExclamationCircle, FaCheckCircle } from 'react-icons/fa';

/**
 * Reusable Input component with error and warning states
 * Matches the website UI theme
 */
const Input = ({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  warning,
  success,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => {
  // Determine input state
  const getInputClasses = () => {
    const baseClasses = "w-full px-4 py-2 text-[#4a2e1f] bg-[#fef4ec] border rounded-lg transition-colors focus:outline-none";
    
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
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={getInputClasses()}
          {...props}
        />
        {(error || warning || success) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
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

export default Input;










