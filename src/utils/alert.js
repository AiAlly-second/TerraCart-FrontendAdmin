/**
 * Custom alert utility that replaces native browser alert()
 * This function uses the AlertContext to show styled alerts matching the website UI
 */

let alertContext = null;

// Set the alert context (called from components that have access to useAlert)
export const setAlertContext = (context) => {
  alertContext = context;
};

// Main alert function that mimics native alert() but uses custom UI
export const alert = (message, type = 'info') => {
  if (!alertContext) {
    // Fallback to native alert if context is not available
    console.warn('Alert context not available, falling back to native alert');
    window.alert(message);
    return;
  }

  // Determine alert type from message content if not specified
  if (type === 'info') {
    const lowerMessage = String(message).toLowerCase();
    if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('invalid')) {
      type = 'error';
    } else if (lowerMessage.includes('success') || lowerMessage.includes('saved') || lowerMessage.includes('created') || lowerMessage.includes('updated') || lowerMessage.includes('deleted')) {
      type = 'success';
    } else if (lowerMessage.includes('warning') || lowerMessage.includes('cannot') || lowerMessage.includes('please')) {
      type = 'warning';
    }
  }

  // Show the alert using the context
  alertContext.showAlert(message, type, 5000);
};

// Export convenience methods
export const alertSuccess = (message) => {
  if (alertContext) {
    alertContext.showSuccess(message);
  } else {
    window.alert(message);
  }
};

export const alertError = (message) => {
  if (alertContext) {
    alertContext.showError(message);
  } else {
    window.alert(message);
  }
};

export const alertWarning = (message) => {
  if (alertContext) {
    alertContext.showWarning(message);
  } else {
    window.alert(message);
  }
};

export const alertInfo = (message) => {
  if (alertContext) {
    alertContext.showInfo(message);
  } else {
    window.alert(message);
  }
};










