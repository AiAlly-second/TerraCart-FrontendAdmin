/**
 * Request Manager Utility
 * Handles request cancellation and debouncing to prevent race conditions
 */
import { STABILITY_FLAGS, STABILITY_THRESHOLDS } from "./stabilityFlags";

// Map to store active AbortControllers for each request type
const activeControllers = new Map();
const inFlightRequests = new Map();
const lastRequestAt = new Map();
const requestRateWindows = new Map();

const trimWindow = (timestamps, windowMs) => {
  const cutoff = Date.now() - windowMs;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
};

const trackRequestRate = (requestKey) => {
  if (!STABILITY_FLAGS.ENABLE_STABILITY_OBSERVABILITY) return;

  if (!requestRateWindows.has(requestKey)) {
    requestRateWindows.set(requestKey, []);
  }

  const timestamps = requestRateWindows.get(requestKey);
  timestamps.push(Date.now());
  trimWindow(timestamps, 60_000);

  if (
    timestamps.length >
    STABILITY_THRESHOLDS.MAX_API_CALLS_PER_MINUTE_PER_KEY
  ) {
    console.warn("[Stability] repeated API storm detected", {
      requestKey,
      requestsPerMinute: timestamps.length,
      threshold: STABILITY_THRESHOLDS.MAX_API_CALLS_PER_MINUTE_PER_KEY,
    });
  }
};

/**
 * Creates a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Cancels any pending requests of a specific type
 * @param {string} requestType - Type identifier for the request (e.g., 'order-status-update', 'table-status-update')
 */
export const cancelPendingRequest = (requestType) => {
  const controller = activeControllers.get(requestType);
  if (controller) {
    controller.abort();
    activeControllers.delete(requestType);
  }
};

/**
 * Creates a new AbortController for a request type
 * Cancels any existing controller for the same type first
 * @param {string} requestType - Type identifier for the request
 * @returns {AbortController} New AbortController
 */
export const createRequestController = (requestType) => {
  // Cancel any existing request of this type
  cancelPendingRequest(requestType);

  // Create new controller
  const controller = new AbortController();
  activeControllers.set(requestType, controller);

  return controller;
};

/**
 * Gets the signal for a request type
 * Creates a new controller if one doesn't exist
 * @param {string} requestType - Type identifier for the request
 * @returns {AbortSignal} Abort signal
 */
export const getRequestSignal = (requestType) => {
  let controller = activeControllers.get(requestType);
  if (!controller) {
    controller = createRequestController(requestType);
  }
  return controller.signal;
};

/**
 * Cleans up a request controller after request completes
 * @param {string} requestType - Type identifier for the request
 */
export const cleanupRequest = (requestType) => {
  activeControllers.delete(requestType);
};

/**
 * Wraps an async function with request cancellation
 * Note: axios automatically supports AbortSignal via config.signal
 * @param {string} requestType - Type identifier for the request
 * @param {Function} asyncFn - Async function to wrap (receives signal as parameter)
 * @returns {Promise} Promise that can be cancelled
 */
export const withCancellation = async (requestType, asyncFn) => {
  const controller = createRequestController(requestType);

  try {
    const result = await asyncFn(controller.signal);
    cleanupRequest(requestType);
    return result;
  } catch (error) {
    // Don't treat AbortError as a real error - it means request was cancelled
    if (error.name === "AbortError" || error.code === "ERR_CANCELED") {
      cleanupRequest(requestType);
      throw error;
    }
    cleanupRequest(requestType);
    throw error;
  }
};

/**
 * Creates a debounced async function with cancellation
 * @param {string} requestType - Type identifier for the request
 * @param {Function} asyncFn - Async function to debounce
 * @param {number} wait - Debounce wait time in milliseconds
 * @returns {Function} Debounced and cancellable function
 */
export const debouncedWithCancellation = (requestType, asyncFn, wait = 300) => {
  let timeout;
  let lastController = null;

  return (...args) => {
    return new Promise((resolve, reject) => {
      // Cancel previous request
      if (lastController) {
        lastController.abort();
      }

      // Clear previous timeout
      clearTimeout(timeout);

      // Create new controller
      const controller = createRequestController(requestType);
      lastController = controller;

      // Set up debounced execution
      timeout = setTimeout(async () => {
        try {
          const result = await asyncFn(...args, controller.signal);
          cleanupRequest(requestType);
          resolve(result);
        } catch (error) {
          if (error.name !== "AbortError") {
            cleanupRequest(requestType);
            reject(error);
          }
        }
      }, wait);
    });
  };
};

/**
 * Reuse in-flight request promise for same logical key.
 * Useful for preventing duplicate fetch bursts from multiple components.
 */
export const runDedupedRequest = async (requestKey, requestFn) => {
  trackRequestRate(requestKey);

  if (!STABILITY_FLAGS.ENABLE_REQUEST_DEDUPE) {
    return requestFn();
  }

  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey);
  }

  const promise = Promise.resolve()
    .then(requestFn)
    .finally(() => {
      inFlightRequests.delete(requestKey);
      lastRequestAt.set(requestKey, Date.now());
    });

  inFlightRequests.set(requestKey, promise);
  return promise;
};

/**
 * Throttle repeated calls for same key.
 */
export const throttleRequest = async (
  requestKey,
  minGapMs = 500,
) => {
  if (!STABILITY_FLAGS.ENABLE_REQUEST_DEDUPE) return;
  const lastTs = lastRequestAt.get(requestKey) || 0;
  const now = Date.now();
  const elapsed = now - lastTs;
  if (elapsed >= minGapMs) return;
  await new Promise((resolve) => setTimeout(resolve, minGapMs - elapsed));
};










































