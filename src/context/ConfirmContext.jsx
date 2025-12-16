import React, { createContext, useContext, useState, useCallback } from "react";
import ConfirmationModal from "../components/ConfirmationModal";

const ConfirmContext = createContext();

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "Confirm Action",
    message: "",
    warningMessage: "",
    items: [],
    confirmText: "OK",
    cancelText: "Cancel",
    danger: false,
    requireInput: false,
    inputPlaceholder: "",
    inputMatch: "",
    inputLabel: "Type to confirm",
    onConfirm: null,
    onCancel: null,
  });

  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: options.title || "Confirm Action",
        message: options.message || "",
        warningMessage: options.warningMessage || "",
        items: options.items || [],
        confirmText: options.confirmText || "OK",
        cancelText: options.cancelText || "Cancel",
        danger: options.danger !== undefined ? options.danger : false,
        requireInput: options.requireInput || false,
        inputPlaceholder: options.inputPlaceholder || "",
        inputMatch: options.inputMatch || "",
        inputLabel: options.inputLabel || "Type to confirm",
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    if (confirmState.onCancel) {
      confirmState.onCancel();
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  const handleConfirm = useCallback(() => {
    if (confirmState.onConfirm) {
      confirmState.onConfirm();
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, [confirmState]);

  const value = {
    showConfirm,
  };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmationModal
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        warningMessage={confirmState.warningMessage}
        items={confirmState.items}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        danger={confirmState.danger}
        requireInput={confirmState.requireInput}
        inputPlaceholder={confirmState.inputPlaceholder}
        inputMatch={confirmState.inputMatch}
        inputLabel={confirmState.inputLabel}
      />
    </ConfirmContext.Provider>
  );
};
