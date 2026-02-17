import axios from "axios";
import { alert } from "./alert";

// Primary backend (AWS EC2)
const PRIMARY_API_URL = import.meta.env.VITE_PRIMARY_API_URL || import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";

// Fallback backend (Render.com)
const FALLBACK_API_URL = import.meta.env.VITE_FALLBACK_API_URL || "";

// Ensure URL has protocol (http:// or https://)
const normalizeUrl = (url) => {
  if (!url) return url;
  if (url && !url.match(/^https?:\/\//)) {
    return `http://${url}`;
  }
  return url;
};

const primaryUrl = normalizeUrl(PRIMARY_API_URL);
const fallbackUrl = normalizeUrl(FALLBACK_API_URL);

// Current active backend
let activeBackend = primaryUrl;
let usingFallback = false;

// Health check function
const checkBackendHealth = async (url) => {
  if (!url) return false;
  try {
    const response = await axios.get(`${url}/api/health`, {
      timeout: 3000,
    });
    return response.status === 200;
  } catch (error) {
    console.warn(`Backend health check failed for ${url}:`, error.message);
    return false;
  }
};

// Select best available backend
const selectBackend = async () => {
  // Try primary first
  const primaryHealthy = await checkBackendHealth(primaryUrl);
  
  if (primaryHealthy) {
    if (usingFallback) {
      console.log('🔄 Switching back to PRIMARY backend (AWS):', primaryUrl);
      usingFallback = false;
    }
    activeBackend = primaryUrl;
    return primaryUrl;
  }

  // Try fallback if available
  if (fallbackUrl) {
    console.warn('⚠️ PRIMARY backend unavailable, trying FALLBACK...');
    const fallbackHealthy = await checkBackendHealth(fallbackUrl);
    
    if (fallbackHealthy) {
      console.log('✅ Using FALLBACK backend (Render):', fallbackUrl);
      usingFallback = true;
      activeBackend = fallbackUrl;
      return fallbackUrl;
    }
  }

  // Both failed - use primary anyway
  console.error('❌ Both backends unavailable! Using primary as last resort.');
  activeBackend = primaryUrl;
  return primaryUrl;
};

// Initialize backend selection
selectBackend();

// Periodic health check every 30 seconds
setInterval(async () => {
  const newBackend = await selectBackend();
  if (newBackend !== activeBackend) {
    console.log(`🔄 Backend switched from ${activeBackend} to ${newBackend}`);
    activeBackend = newBackend;
  }
}, 30000);

const nodeApiBase = activeBackend;

// Check if connecting to Render.com (which can be slow to wake up)
const isRenderBackend = nodeApiBase.includes("onrender.com");

// Configure timeout - longer for remote servers, especially Render.com
// Render.com free tier can take 30-60 seconds to wake up from sleep
const timeout = isRenderBackend ? 120000 : 60000; // 120s for Render, 60s for others

const api = axios.create({
  baseURL: `${nodeApiBase.replace(/\/$/, "")}/api`,
  timeout: timeout,
  // Don't set Content-Type here - let axios set it automatically based on the request data
  // For JSON: axios will set "application/json"
  // For FormData: axios will set "multipart/form-data" with boundary
});

// Get the appropriate token based on user role
const getToken = () => {
  let superAdminToken = null;
  let franchiseAdminToken = null;
  let adminToken = null;

  try {
    superAdminToken = localStorage.getItem("superAdminToken");
    franchiseAdminToken = localStorage.getItem("franchiseAdminToken");
    adminToken = localStorage.getItem("adminToken");
  } catch (storageError) {
    if (import.meta.env.DEV) {
      console.warn("[API] Error reading from localStorage:", storageError);
    }
    // Return null if storage is unavailable
    return null;
  }

  // Priority: super_admin > franchise_admin > admin
  const token = superAdminToken || franchiseAdminToken || adminToken;

  // Debug logging in development
  if (import.meta.env.DEV && !token) {
    console.warn("[API] No token found in localStorage", {
      superAdminToken: !!superAdminToken,
      franchiseAdminToken: !!franchiseAdminToken,
      adminToken: !!adminToken,
    });
  }

  return token;
};

// Get the appropriate storage keys based on user role
const getStorageKeys = (role) => {
  switch (role) {
    case "super_admin":
      return { token: "superAdminToken", user: "superAdminUser" };
    case "franchise_admin":
      return { token: "franchiseAdminToken", user: "franchiseAdminUser" };
    case "admin":
    default:
      return { token: "adminToken", user: "adminUser" };
  }
};

api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // If no token, check if we just logged in - might be a timing issue
      const loginTimestamp = sessionStorage.getItem("lastLoginTime");
      const now = Date.now();
      const justLoggedIn =
        loginTimestamp && now - parseInt(loginTimestamp) < 5000;

      if (justLoggedIn) {
        // Try to get token again - it might have been stored by now
        const retryToken = getToken();
        if (retryToken) {
          config.headers.Authorization = `Bearer ${retryToken}`;
          if (import.meta.env.DEV) {
            console.log("[API] Token found on retry after login");
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn(
              "[API] No token found even after login - request will fail"
            );
          }
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn("[API] No token found for request:", config.url);
        }
      }
    }

    // Don't override Content-Type for FormData - axios sets it automatically with boundary
    if (config.data instanceof FormData) {
      // Remove Content-Type if it was set, let axios handle it
      delete config.headers['Content-Type'];
    }

    // Log request for debugging (only in development)
    if (import.meta.env.DEV) {
      console.log(
        `[API Request] ${config.method?.toUpperCase()} ${config.url}`,
        {
          baseURL: config.baseURL,
          hasToken: !!config.headers.Authorization,
          tokenLength: token?.length || 0,
          isFormData: config.data instanceof FormData,
        }
      );
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error("[API Request Error]", error);
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ignore intentionally canceled requests (AbortController / axios cancel).
    const isCanceledRequest =
      error?.code === "ERR_CANCELED" ||
      error?.name === "CanceledError" ||
      error?.name === "AbortError" ||
      error?.message === "canceled";
    if (isCanceledRequest) {
      return Promise.reject(error);
    }

    // Enhanced error logging for debugging
    const errorDetails = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      message: error.response?.data?.message,
      data: error.response?.data,
    };

    // Enhanced error logging (only in development; skip when caller set skipErrorLogging, e.g. 404 for deleted users)
    if (error.response && import.meta.env.DEV && !error.config?.skipErrorLogging) {
      console.error("[API Error]", errorDetails);

      // Log full response for debugging
      try {
        const fullResponse = JSON.stringify(error.response.data, null, 2);
        console.error("[API Error - Full Response]:", fullResponse);
      } catch {
        console.error("[API Error - Response Data]:", error.response.data);
      }
    } else if (!error.response) {
      // Network error - log with context but don't spam console
      const isNetworkError =
        error.code === "ERR_NETWORK" ||
        error.code === "ERR_CONNECTION_CLOSED" ||
        error.message?.includes("Network Error") ||
        error.message?.includes("ERR_CONNECTION_CLOSED");

      if (isNetworkError && isRenderBackend && import.meta.env.DEV) {
        // For Render.com, these errors are expected when server is sleeping
        // Log as warning instead of error to reduce console noise
        console.warn(
          `[API Network Warning] ${error.message}\n` +
            `Backend: ${nodeApiBase}\n` +
            `Render.com servers may be sleeping (free tier). Server will wake up automatically.\n` +
            `Please wait 30-60 seconds and try again.`
        );
      } else if (import.meta.env.DEV) {
        console.error("[API Error - No Response]:", error.message);
      }
    }

    if (error.response?.status === 404) {
      // Resource Not Found - Log specific URL for debugging (User Management)
      if (!error.config?.skipErrorLogging) {
        console.warn(`[API 404] Resource not found: ${error.config?.url}`);
      }
      
      const isUsersEndpoint = error.config?.url?.includes("/users/");
      if (isUsersEndpoint) {
        // Only log detailed debug info if not explicitly skipped
        if (!error.config?.skipErrorLogging) {
          console.error(
            `[User Management Debug] Failed to fetch user data. ID may be invalid or user deleted.\n` +
            `URL: ${error.config?.url}`
          );
        }
        // Do NOT alert for 404s on users/ fetch, as it might be a background check or deleted item
        // Just log it. Use return Promise.reject(error) to let caller handle it.
      } else if (import.meta.env.DEV && !error.config?.skipErrorAlert && !error.config?.skipErrorLogging) {
        // Only alert for non-user 404s in DEV, or let the caller handle it
        // console.warn("404 Error for:", error.config?.url);
      }
    } else if (error.response?.status === 400) {
      // Bad Request - log detailed error
      const responseData = error.response?.data || {};
      let requestData = error.config?.data;

      // Try to parse request data if it's a string
      if (typeof requestData === "string") {
        try {
          requestData = JSON.parse(requestData);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }

      // Detailed error logging (only in development)
      if (import.meta.env.DEV) {
        console.error("═══════════════════════════════════════════");
        console.error("[400 Bad Request - FULL DETAILS]");
        console.error("═══════════════════════════════════════════");
        console.error(
          "Endpoint:",
          `${error.config?.method?.toUpperCase()} ${error.config?.url}`
        );
        console.error("Request Data:", requestData);
        console.error("Response Status:", error.response?.status);
        console.error("Response Data:", responseData);
        console.error(
          "Error Message:",
          responseData.message || responseData.error || "Bad Request"
        );
        console.error("Full Response:", JSON.stringify(responseData, null, 2));
        console.error("═══════════════════════════════════════════");
      }

      // Show user-friendly error message
      const errorMessage =
        responseData.message ||
        responseData.error ||
        "Invalid request. Please check your input and try again.";

      if (!error.config?.skipErrorAlert) {
        alert(
          `Error: ${errorMessage}\n\nCheck console for full details.`,
          "error"
        );
      }
    } else if (error.response?.status === 401) {
      // Unauthorized - token invalid or expired
      const errorData = error.response?.data || {};
      const errorCode = errorData.code;

      if (import.meta.env.DEV) {
        console.warn("[401 Unauthorized]", {
          code: errorCode,
          message: errorData.message,
        });
      }

      // Check if we just logged in - don't logout if we just logged in
      let loginTimestamp = null;
      try {
        loginTimestamp = sessionStorage.getItem("lastLoginTime");
      } catch (e) {
        // Ignore storage errors
      }
      const now = Date.now();
      const justLoggedIn =
        loginTimestamp && now - parseInt(loginTimestamp) < 30000; // 30 second window

      if (justLoggedIn) {
        if (import.meta.env.DEV) {
          console.warn(
            "[401 Unauthorized] Just logged in - not clearing tokens. This might be a timing issue."
          );
        }
        // Retry once after a short delay when NO_TOKEN right after login (token may not be attached yet)
        if (errorCode === "NO_TOKEN" && error.config && !error.config._retryAfterLogin) {
          error.config._retryAfterLogin = true;
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(api.request(error.config));
            }, 150);
          });
        }
        return Promise.reject(error);
      }

      // Only force logout for clear auth token issues
      if (
        errorCode === "TOKEN_EXPIRED" ||
        errorCode === "TOKEN_INVALID" ||
        errorCode === "AUTH_ERROR" ||
        errorCode === "NO_TOKEN" ||
        errorCode === "USER_NOT_FOUND"
      ) {
        if (import.meta.env.DEV) {
          console.warn(
            "[401 Unauthorized] Clearing tokens and redirecting to login"
          );
        }
        // Clear all tokens
        try {
          localStorage.removeItem("superAdminToken");
          localStorage.removeItem("superAdminUser");
          localStorage.removeItem("franchiseAdminToken");
          localStorage.removeItem("franchiseAdminUser");
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUser");
          sessionStorage.removeItem("lastLoginTime");
        } catch (storageError) {
          if (import.meta.env.DEV) {
            console.warn("[API] Error clearing storage:", storageError);
          }
        }
        window.location.href = "/login";
      } else {
        // For other 401s, just show an alert and keep the user on the same page
        const message =
          errorData.message ||
          "You are not authorized to perform this action. Please check your permissions or login again.";
        alert(message, "warning");
      }
    } else if (error.response?.status === 403) {
      // Forbidden - check if it's account deactivation
      const errorData = error.response?.data || {};
      const errorCode = errorData.code;

      if (
        errorCode === "ACCOUNT_DEACTIVATED" ||
        errorCode === "CAFE_DEACTIVATED" ||
        errorCode === "FRANCHISE_DEACTIVATED" ||
        errorCode === "ACCOUNT_PENDING_APPROVAL" ||
        errorData.deactivated
      ) {
        // Clear all tokens
        try {
          localStorage.removeItem("superAdminToken");
          localStorage.removeItem("superAdminUser");
          localStorage.removeItem("franchiseAdminToken");
          localStorage.removeItem("franchiseAdminUser");
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUser");
        } catch (storageError) {
          if (import.meta.env.DEV) {
            console.warn("[API] Error clearing storage:", storageError);
          }
        }

        alert(
          errorData.message ||
            "Your account has been deactivated. Please contact admin.",
          "error"
        );
        window.location.href = "/login";
      }
    } else if (error.response?.status === 500) {
      if (import.meta.env.DEV) {
        console.error("[500 Server Error]", errorDetails);
      }
      alert("Server error. Please try again later.", "error");
    } else if (!error.response) {
      // Network error - no response from server
      const isTimeout =
        error.code === "ECONNABORTED" || error.message?.includes("timeout");
      const isConnectionClosed =
        error.message?.includes("ERR_CONNECTION_CLOSED") ||
        error.code === "ERR_CONNECTION_CLOSED";
      const isNetworkError =
        error.code === "ERR_NETWORK" ||
        error.message?.includes("Network Error");

      if (import.meta.env.DEV) {
        console.error("[Network Error]", {
          message: error.message,
          code: error.code,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          isTimeout,
          isConnectionClosed,
          isNetworkError,
        });
      }

      // Provide helpful error messages based on error type
      let errorMessage = "Network error. ";

      if (isTimeout) {
        errorMessage += isRenderBackend
          ? "The backend server is taking longer than expected to respond. Render.com servers may need 30-60 seconds to wake up from sleep. Please wait and try again."
          : "Request timed out. The server may be slow or unavailable.";
      } else if (isConnectionClosed || isNetworkError) {
        errorMessage += isRenderBackend
          ? "Connection to the backend server was closed. Render.com servers may be sleeping (free tier). The server will wake up automatically when you make a request - please wait 30-60 seconds and try again."
          : "Cannot connect to the backend server. Please check if the server is running and accessible.";
      } else {
        errorMessage +=
          "Please check your network connection and ensure the backend server is running.";
      }

      // Only show alert if not explicitly skipped
      if (!error.config?.skipErrorAlert) {
        alert(errorMessage, "error");
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { getStorageKeys };
