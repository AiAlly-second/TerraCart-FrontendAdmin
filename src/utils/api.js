import axios from "axios";
import { alert } from "./alert";

// Ensure URL has protocol (http:// or https://)
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
  // If URL doesn't start with http:// or https://, add http://
  if (envUrl && !envUrl.match(/^https?:\/\//)) {
    return `http://${envUrl}`;
  }
  return envUrl;
};

const nodeApiBase = getApiUrl();

const api = axios.create({
  baseURL: `${nodeApiBase.replace(/\/$/, "")}/api`,
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
          console.log("[API] Token found on retry after login");
        } else {
          console.warn(
            "[API] No token found even after login - request will fail"
          );
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn("[API] No token found for request:", config.url);
        }
      }
    }

    // Log request for debugging (only in development)
    if (import.meta.env.DEV) {
      console.log(
        `[API Request] ${config.method?.toUpperCase()} ${config.url}`,
        {
          baseURL: config.baseURL,
          hasToken: !!config.headers.Authorization,
          tokenLength: token?.length || 0,
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
    // Enhanced error logging for debugging
    const errorDetails = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      message: error.response?.data?.message,
      data: error.response?.data,
    };

    // Enhanced error logging
    if (error.response) {
      console.error("[API Error]", errorDetails);

      // Log full response for debugging
      try {
        const fullResponse = JSON.stringify(error.response.data, null, 2);
        console.error("[API Error - Full Response]:", fullResponse);
      } catch (e) {
        console.error("[API Error - Response Data]:", error.response.data);
      }
    } else {
      console.error("[API Error - No Response]:", error.message);
    }

    if (error.response?.status === 400) {
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

      console.warn("[401 Unauthorized]", {
        code: errorCode,
        message: errorData.message,
      });

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
        // Don't logout, just return the error
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
      // Network error
      if (import.meta.env.DEV) {
        console.error("[Network Error]", {
          message: error.message,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        });
      }
      alert(
        "Network error. Please check if the backend server is running.",
        "error"
      );
    }

    return Promise.reject(error);
  }
);

export default api;
export { getStorageKeys };
