import React, { createContext, useState, useContext, useEffect } from "react";
import { getAdminApiOrigin } from "../utils/adminApiOrigin.js";
import { clearMenuCacheOnLogout } from "../utils/menuCache";

const AuthContext = createContext();

// Allowed roles for unified admin
// Include "cart_admin" for backward compatibility with existing admin accounts
const ALLOWED_ROLES = ["admin", "franchise_admin", "super_admin", "cart_admin"];
const VERIFY_CACHE_KEY = "terraAdminVerifyCache";
const VERIFY_COOLDOWN_KEY = "terraAdminVerifyCooldownUntil";
const VERIFY_CACHE_TTL_MS = 60 * 1000;
const VERIFY_TRANSIENT_COOLDOWN_MS = 5 * 1000;
let verifyInFlight = null;

const getTokenFingerprint = (token) =>
  token ? `${token.length}:${token.slice(-16)}` : "";

const readSessionJson = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const markTokenVerified = (token, user) => {
  try {
    sessionStorage.setItem(
      VERIFY_CACHE_KEY,
      JSON.stringify({
        fingerprint: getTokenFingerprint(token),
        verifiedAt: Date.now(),
        user,
      }),
    );
    sessionStorage.removeItem(VERIFY_COOLDOWN_KEY);
  } catch {
    // Ignore storage failures; verification still succeeded.
  }
};

const getCachedVerifiedUser = (token) => {
  const cached = readSessionJson(VERIFY_CACHE_KEY);
  if (
    cached?.fingerprint === getTokenFingerprint(token) &&
    cached?.user &&
    Date.now() - Number(cached.verifiedAt || 0) < VERIFY_CACHE_TTL_MS
  ) {
    return cached.user;
  }
  return null;
};

const getVerifyCooldownUntil = () => {
  try {
    return Number(sessionStorage.getItem(VERIFY_COOLDOWN_KEY) || 0);
  } catch {
    return 0;
  }
};

const setVerifyCooldown = (delayMs = VERIFY_TRANSIENT_COOLDOWN_MS) => {
  try {
    sessionStorage.setItem(
      VERIFY_COOLDOWN_KEY,
      String(Date.now() + Math.max(delayMs, VERIFY_TRANSIENT_COOLDOWN_MS)),
    );
  } catch {
    // Ignore storage failures.
  }
};

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

  const clearStoredAuth = () => {
    try {
      clearMenuCacheOnLogout();
      localStorage.removeItem("superAdminToken");
      localStorage.removeItem("superAdminUser");
      localStorage.removeItem("franchiseAdminToken");
      localStorage.removeItem("franchiseAdminUser");
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminUser");
      sessionStorage.removeItem("lastLoginTime");
      sessionStorage.removeItem(VERIFY_CACHE_KEY);
      sessionStorage.removeItem(VERIFY_COOLDOWN_KEY);
    } catch (storageError) {
      if (import.meta.env.DEV) {
        console.warn("[AuthContext] Error clearing auth storage:", storageError);
      }
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
      const cachedVerifiedUser = getCachedVerifiedUser(token);
      if (cachedVerifiedUser) {
        setUser(cachedVerifiedUser);
        setLoading(false);
        return;
      }

      setUser(storedUser);
      const cooldownUntil = getVerifyCooldownUntil();
      if (cooldownUntil && Date.now() < cooldownUntil) {
        setLoading(false);
        return;
      }

      verifyToken(token, storedUser.role, storedUser);
    } else {
      setLoading(false);
    }
  }, []);

  // Login function - handles all admin roles
  const login = async (email, password) => {
    try {
      const response = await fetch(`${getAdminApiOrigin()}/api/admin/login`, {
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
      markTokenVerified(data.token, data.user);

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
  const verifyToken = async (token, expectedRole, fallbackUser = null) => {
    try {
      const cachedVerifiedUser = getCachedVerifiedUser(token);
      if (cachedVerifiedUser) {
        setUser(cachedVerifiedUser);
        return;
      }

      const fingerprint = getTokenFingerprint(token);
      const runVerifyRequest = async () => {
        const response = await fetch(`${getAdminApiOrigin()}/api/admin/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Request-Source": "terra-admin-auth",
          },
          cache: "no-store",
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        return { response, data };
      };

      if (!verifyInFlight || verifyInFlight.fingerprint !== fingerprint) {
        verifyInFlight = {
          fingerprint,
          promise: runVerifyRequest().finally(() => {
            verifyInFlight = null;
          }),
        };
      }

      const { response, data } = await verifyInFlight.promise;

      if (response.status === 429 || response.status >= 500) {
        const retryAfterSeconds = Number.parseInt(
          response.headers.get("Retry-After") || "",
          10,
        );
        setVerifyCooldown(
          Number.isFinite(retryAfterSeconds)
            ? retryAfterSeconds * 1000
            : VERIFY_TRANSIENT_COOLDOWN_MS,
        );
        if (fallbackUser) {
          setUser(fallbackUser);
        }
        if (import.meta.env.DEV) {
          console.warn("[AuthContext] Verify delayed by transient response", {
            status: response.status,
            expectedRole,
          });
        }
        return;
      }

      // Check for deactivation or authorization errors
      if (response.status === 403) {
        const errorMessage =
          data?.message ||
          "Your account has been deactivated or is not authorized. Please contact TerraCart Support.";
        alert(errorMessage);
        clearStoredAuth();
        setUser(null);
        return;
      }

      // Verify returns { success, user: { ... } }
      if (
        !response.ok ||
        !data?.success ||
        !ALLOWED_ROLES.includes(data?.user?.role)
      ) {
        const invalidTokenError = new Error("Token invalid or not authorized");
        invalidTokenError.status = response.status;
        throw invalidTokenError;
      }

      // Update storage with verified user data
      const storageKeys = getStorageKeys(data.user.role);
      setUser(data.user);
      markTokenVerified(token, data.user);
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
      const status = error?.status || error?.response?.status;
      if ((!status || status === 429 || status >= 500) && fallbackUser) {
        setVerifyCooldown();
        setUser(fallbackUser);
        return;
      }
      clearStoredAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Logout function - clears all admin tokens
  const logout = () => {
    clearStoredAuth();
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
