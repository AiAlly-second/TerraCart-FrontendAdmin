/**
 * Custom confirm utility that replaces native browser confirm()
 * This function uses the ConfirmContext to show styled confirmation modals
 */

let confirmContext = null;

// Set the confirm context (called from components that have access to useConfirm)
export const setConfirmContext = (context) => {
  confirmContext = context;
};

// Main confirm function that mimics native confirm() but uses custom UI
export const confirm = async (message, options = {}) => {
  if (!confirmContext) {
    // Fallback to native confirm if context is not available
    // Note: window.confirm is now async, so we need to await it
    console.warn('Confirm context not available, falling back to native confirm');
    return await window.confirm(message);
  }

  // Determine if it's a dangerous action
  const lowerMessage = String(message).toLowerCase();
  const isDanger = options.danger !== undefined 
    ? options.danger 
    : (lowerMessage.includes('delete') || 
       lowerMessage.includes('remove') || 
       lowerMessage.includes('permanent') ||
       lowerMessage.includes('cannot be undone'));

  // Show the confirmation modal
  return await confirmContext.showConfirm({
    title: options.title || (isDanger ? 'Confirm Action' : 'Confirmation'),
    message: String(message),
    warningMessage: options.warningMessage || '',
    items: options.items || [],
    confirmText: options.confirmText || 'OK',
    cancelText: options.cancelText || 'Cancel',
    danger: isDanger,
    requireInput: options.requireInput || false,
    inputPlaceholder: options.inputPlaceholder || '',
    inputMatch: options.inputMatch || '',
    inputLabel: options.inputLabel || 'Type to confirm'
  });
};

// Helper function for delete confirmations with input
export const confirmDelete = async (itemName, items = [], requireInput = true) => {
  return await confirm(
    `You are about to PERMANENTLY DELETE "${itemName}".`,
    {
      title: 'Delete Confirmation',
      warningMessage: 'WARNING: PERMANENTLY DELETE',
      items: items,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
      requireInput: requireInput,
      inputPlaceholder: 'Type DELETE to confirm',
      inputMatch: 'DELETE',
      inputLabel: 'Type DELETE to confirm'
    }
  );
};

// Helper function for franchise delete (specific to your use case)
export const confirmFranchiseDelete = async (franchiseName) => {
  const items = [
    'The franchise account and login',
    'ALL carts under this franchise',
    'ALL cart login credentials',
    'ALL employees (franchise and cart level)',
    'ALL menu items and categories',
    'ALL tables and waitlist entries',
    'ALL non-paid orders and payments',
    'Paid orders will be PRESERVED for revenue tracking'
  ];

  return await confirmDelete(franchiseName, items, true);
};

