import React, { createContext, useContext, useState, useCallback } from 'react';
import Alert from '../components/Alert';

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  const showAlert = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const newAlert = { id, message, type, duration };
    
    setAlerts(prev => [...prev, newAlert]);
    
    return id;
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  // Helper methods for different alert types
  const showSuccess = useCallback((message, duration = 5000) => {
    return showAlert(message, 'success', duration);
  }, [showAlert]);

  const showError = useCallback((message, duration = 5000) => {
    return showAlert(message, 'error', duration);
  }, [showAlert]);

  const showWarning = useCallback((message, duration = 5000) => {
    return showAlert(message, 'warning', duration);
  }, [showAlert]);

  const showInfo = useCallback((message, duration = 5000) => {
    return showAlert(message, 'info', duration);
  }, [showAlert]);

  const value = {
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeAlert
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9998] flex flex-col gap-2 pointer-events-none">
        {alerts.map((alert) => (
          <div key={alert.id} className="pointer-events-auto">
            <Alert
              message={alert.message}
              type={alert.type}
              duration={alert.duration}
              onClose={() => removeAlert(alert.id)}
            />
          </div>
        ))}
      </div>
    </AlertContext.Provider>
  );
};

