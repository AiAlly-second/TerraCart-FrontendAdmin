import { useEffect } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { setConfirmContext } from '../utils/confirm';

/**
 * Component that initializes the confirm utility with the ConfirmContext
 * Overrides window.confirm() to use custom UI
 */
const ConfirmInitializer = () => {
  const confirmContext = useConfirm();

  useEffect(() => {
    // Set the confirm context so the utility function can use it
    setConfirmContext(confirmContext);

    // Override window.confirm globally to use custom UI
    const originalConfirm = window.confirm;
    window.confirm = async (message) => {
      if (!message) return false;
      
      // Determine if it's a dangerous action
      const lowerMessage = String(message).toLowerCase();
      const isDanger = lowerMessage.includes('delete') || 
                       lowerMessage.includes('remove') || 
                       lowerMessage.includes('permanent') ||
                       lowerMessage.includes('cannot be undone');
      
      const result = await confirmContext.showConfirm({
        title: isDanger ? 'Confirm Action' : 'Confirmation',
        message: String(message),
        danger: isDanger,
        confirmText: 'OK',
        cancelText: 'Cancel'
      });
      
      return result;
    };

    // Cleanup: restore original confirm on unmount
    return () => {
      window.confirm = originalConfirm;
    };
  }, [confirmContext]);

  return null; // This component doesn't render anything
};

export default ConfirmInitializer;

