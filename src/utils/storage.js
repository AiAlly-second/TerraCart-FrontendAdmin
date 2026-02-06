/**
 * Safe localStorage utility with error handling
 * Prevents errors in private browsing mode or when storage is full
 */

const isStorageAvailable = () => {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

export const safeGetItem = (key, defaultValue = null) => {
  if (!isStorageAvailable()) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Storage] localStorage not available, returning default for key: ${key}`
      );
    }
    return defaultValue;
  }

  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[Storage] Error getting item ${key}:`, error);
    }
    return defaultValue;
  }
};

export const safeSetItem = (key, value) => {
  if (!isStorageAvailable()) {
    if (import.meta.env.DEV) {
      console.warn(
        `[Storage] localStorage not available, cannot set key: ${key}`
      );
    }
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[Storage] Error setting item ${key}:`, error);
    }
    // If storage is full, try to clear some space or notify user
    if (error.name === "QuotaExceededError") {
      if (import.meta.env.DEV) {
        console.warn(
          "[Storage] Storage quota exceeded. Consider clearing old data."
        );
      }
    }
    return false;
  }
};

export const safeRemoveItem = (key) => {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[Storage] Error removing item ${key}:`, error);
    }
    return false;
  }
};

export const safeClear = () => {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.clear();
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[Storage] Error clearing storage:", error);
    }
    return false;
  }
};










































