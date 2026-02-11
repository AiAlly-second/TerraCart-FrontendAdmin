import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

// API URL from environment variable
// Ensure URL has protocol (http:// or https://)
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
  // If URL doesn't start with http:// or https://, add http://
  if (envUrl && !envUrl.match(/^https?:\/\//)) {
    const fixedUrl = `http://${envUrl}`;
    console.warn(
      `[AuthContext] API URL missing protocol, fixed: ${envUrl} → ${fixedUrl}`,
    );
    return fixedUrl;
  }
  if (import.meta.env.DEV) {
    console.log(`[AuthContext] Using API URL: ${envUrl}`);
  }
  return envUrl;
};

const nodeApi = getApiUrl();

// Allowed roles for unified admin
// Include "cart_admin" for backward compatibility with existing admin accounts
const ALLOWED_ROLES = ["admin", "franchise_admin", "super_admin", "cart_admin"];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Get storage keys based on role
  const getStorageKeys = (role) => {
    switch (role) {
      case "super_admin":
        return { token: "superAdminToken", user: "superAdminUser" };
      case "franchise_admin":
        return { token: "franchiseAdminToken", user: "franchiseAdminUser" };
      case "admin":
      case "cart_admin":
      default:
        return { token: "adminToken", user: "adminUser" };
    }
  };

  // Suppress password change alerts on mount
  useEffect(() => {
    // Suppress any password change related browser alerts
    if (typeof window !== "undefined" && window.alert) {
      const originalAlert = window.alert;
      window.alert = function (message) {
        // Suppress password change related alerts
        if (
          message &&
          typeof message === "string" &&
          (message.toLowerCase().includes("change your password") ||
            message.toLowerCase().includes("change password") ||
            message.toLowerCase().includes("password change"))
        ) {
          console.log(
            "[AuthContext] Suppressed password change alert:",
            message,
          );
          return;
        }
        // Allow other alerts
        return originalAlert.call(window, message);
      };
    }
  }, []);

  // Load user from localStorage on mount - check all possible storage keys
  useEffect(() => {
    // Try to find existing user from any role
    let storedUser = null;
    let token = null;
    let userRole = null;

    try {
      // Check in priority order: super_admin > franchise_admin > admin
      const superAdminUser = localStorage.getItem("superAdminUser");
      const superAdminToken = localStorage.getItem("superAdminToken");
      if (superAdminUser && superAdminToken) {
        storedUser = JSON.parse(superAdminUser);
        token = superAdminToken;
        userRole = "super_admin";
      } else {
        const franchiseAdminUser = localStorage.getItem("franchiseAdminUser");
        const franchiseAdminToken = localStorage.getItem("franchiseAdminToken");
        if (franchiseAdminUser && franchiseAdminToken) {
          storedUser = JSON.parse(franchiseAdminUser);
          token = franchiseAdminToken;
          userRole = "franchise_admin";
        } else {
          const adminUser = localStorage.getItem("adminUser");
          const adminToken = localStorage.getItem("adminToken");
          if (adminUser && adminToken) {
            storedUser = JSON.parse(adminUser);
            token = adminToken;
            userRole = "admin";
          }
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[AuthContext] Error reading from localStorage:", error);
      }
      // Continue with null values if localStorage fails
    }

    if (storedUser && token && ALLOWED_ROLES.includes(storedUser.role)) {
      setUser(storedUser);
      verifyToken(token, storedUser.role);
    } else {
      setLoading(false);
    }
  }, []);

  // Login function - handles all admin roles
  const login = async (email, password) => {
    try {
      const response = await fetch(`${nodeApi}/api/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json();

      // Log response for debugging
      if (import.meta.env.DEV) {
        console.log("[AuthContext] Login response:", {
          status: response.status,
          ok: response.ok,
          hasToken: !!data?.token,
          hasUser: !!data?.user,
          userRole: data?.user?.role,
          message: data?.message,
          code: data?.code,
        });
      }

      // Check if user has an allowed role
      if (!response.ok) {
        // Return the actual error message from backend
        const errorMessage =
          data?.message ||
          (response.status === 401
            ? "Invalid email or password"
            : response.status === 403
              ? data?.message || "Account access denied"
              : "Login failed. Please try again.");

        if (import.meta.env.DEV) {
          console.error("[AuthContext] Login failed:", {
            status: response.status,
            message: errorMessage,
            code: data?.code,
          });
        }

        throw new Error(errorMessage);
      }

      if (!data?.token || !data?.user) {
        throw new Error("Invalid response from server");
      }

      if (!ALLOWED_ROLES.includes(data?.user?.role)) {
        throw new Error("User role not authorized for admin access");
      }

      const userRole = data.user.role;
      const storageKeys = getStorageKeys(userRole);

      // Store user and token with role-specific keys
      localStorage.setItem(storageKeys.token, data.token);
      localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
      setUser(data.user);

      // Store login timestamp for token retry logic
      sessionStorage.setItem("lastLoginTime", Date.now().toString());

      if (import.meta.env.DEV) {
        console.log("[AuthContext] Login successful, role:", userRole);
        console.log("[AuthContext] Token stored in:", storageKeys.token);
      }

      return { success: true };
    } catch (error) {
      console.error("[AuthContext] Login error:", error);
      return {
        success: false,
        message: error.message || "Login failed",
      };
    }
  };

  // Verify token
  const verifyToken = async (token, expectedRole) => {
    try {
      const response = await fetch(`${nodeApi}/api/admin/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      // Check for deactivation or authorization errors
      if (response.status === 403) {
        const errorMessage =
          data?.message ||
          "Your account has been deactivated or is not authorized. Please contact TerraCart Support.";
        alert(errorMessage);
        logout();
        return;
      }

      // Verify returns { success, user: { ... } }
      if (
        !response.ok ||
        !data?.success ||
        !ALLOWED_ROLES.includes(data?.user?.role)
      ) {
        throw new Error("Token invalid or not authorized");
      }

      // Update storage with verified user data
      const storageKeys = getStorageKeys(data.user.role);
      setUser(data.user);
      try {
        localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
      } catch (storageError) {
        if (import.meta.env.DEV) {
          console.error(
            "[AuthContext] Error writing to localStorage:",
            storageError,
          );
        }
        // Continue even if storage fails
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Token verification failed:", error);
      }
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Logout function - clears all admin tokens
  const logout = () => {
    // Clear all possible tokens
    localStorage.removeItem("superAdminToken");
    localStorage.removeItem("superAdminUser");
    localStorage.removeItem("franchiseAdminToken");
    localStorage.removeItem("franchiseAdminUser");
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
