import React, { useState, useEffect } from "react";
import { FaExclamationTriangle, FaTimes } from "react-icons/fa";
import Input from "./Input";

/**
 * Enhanced Confirmation Modal with input confirmation support
 * Matches website UI theme
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "",
  warningMessage = "",
  items = [],
  confirmText = "OK",
  cancelText = "Cancel",
  danger = false,
  requireInput = false,
  inputPlaceholder = "",
  inputMatch = "",
  inputLabel = "Type to confirm",
}) => {
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setInputError("");
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (requireInput) {
      if (!inputValue.trim()) {
        setInputError("Please enter the confirmation text");
        return;
      }
      if (inputMatch && inputValue.trim() !== inputMatch) {
        setInputError(`Please type "${inputMatch}" to confirm`);
        return;
      }
    }
    // CRITICAL: Only call onConfirm, not onClose
    // The onConfirm handler in ConfirmContext will close the modal
    onConfirm();
  };

  const handleClose = () => {
    setInputValue("");
    setInputError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b ${
            danger
              ? "bg-[#fef2f2] border-[#ef4444]"
              : "bg-[#fef4ec] border-[#e2c1ac]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {danger && (
                <FaExclamationTriangle className="text-2xl text-[#ef4444]" />
              )}
              <h3
                className={`text-xl font-bold ${
                  danger ? "text-[#991b1b]" : "text-[#4a2e1f]"
                }`}
              >
                {title}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-[#6b4423] hover:text-[#4a2e1f] transition-colors p-1 rounded hover:bg-white/50"
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        {warningMessage && (
          <div className="px-6 py-3 bg-[#fffbeb] border-b border-[#d86d2a]">
            <div className="flex items-center gap-2">
              <FaExclamationTriangle className="text-[#d86d2a] text-lg flex-shrink-0" />
              <p className="font-bold text-[#92400e] text-sm uppercase">
                {warningMessage}
              </p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Main Message */}
          {message && (
            <p className="text-[#4a2e1f] mb-4 leading-relaxed">{message}</p>
          )}

          {/* Items List */}
          {items.length > 0 && (
            <div className="mb-4">
              <ul className="list-disc list-inside space-y-2 text-[#4a2e1f] text-sm">
                {items.map((item, index) => (
                  <li key={index} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Input Confirmation */}
          {requireInput && (
            <div className="mt-4">
              <Input
                label={inputLabel}
                id="confirmation-input"
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setInputError("");
                }}
                placeholder={inputPlaceholder}
                error={inputError}
                required
              />
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-[#e2c1ac] bg-[#fef4ec] flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 border-2 border-[#6b4423] text-[#4a2e1f] rounded-lg font-semibold hover:bg-[#6b4423] hover:text-white transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-6 py-2 rounded-lg font-semibold text-white transition-colors ${
              danger
                ? "bg-[#ef4444] hover:bg-[#dc2626]"
                : "bg-[#d86d2a] hover:bg-[#c75b1a]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
