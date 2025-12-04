import React, { createContext, useState, useContext, useEffect, useRef } from 'react';

const AuthContext = createContext();

// API URL from environment variable
// Ensure URL has protocol (http:// or https://)
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
  // If URL doesn't start with http:// or https://, add http://
  if (envUrl && !envUrl.match(/^https?:\/\//)) {
    const fixedUrl = `http://${envUrl}`;
    console.warn(`[AuthContext] API URL missing protocol, fixed: ${envUrl} → ${fixedUrl}`);
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
const ALLOWED_ROLES = ['admin', 'franchise_admin', 'super_admin', 'cart_admin'];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isLoggingInRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Get storage keys based on role
  const getStorageKeys = (role) => {
    switch(role) {
      case 'super_admin':
        return { token: 'superAdminToken', user: 'superAdminUser' };
      case 'franchise_admin':
        return { token: 'franchiseAdminToken', user: 'franchiseAdminUser' };
      case 'admin':
      case 'cart_admin':
      default:
        return { token: 'adminToken', user: 'adminUser' };
    }
  };

  // Suppress password change alerts on mount
  useEffect(() => {
    // Suppress any password change related browser alerts
    if (typeof window !== 'undefined' && window.alert) {
      const originalAlert = window.alert;
      window.alert = function(message) {
        // Suppress password change related alerts
        if (message && typeof message === 'string' && 
            (message.toLowerCase().includes('change your password') || 
             message.toLowerCase().includes('change password') ||
             message.toLowerCase().includes('password change'))) {
          console.log('[AuthContext] Suppressed password change alert:', message);
          return;
        }
        // Allow other alerts
        return originalAlert.call(window, message);
      };
    }
  }, []);

  // Load user from localStorage on mount - check all possible storage keys
  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    // Check if we just logged in (within last 10 seconds) - skip verification
    const loginTimestamp = sessionStorage.getItem('lastLoginTime');
    const now = Date.now();
    const justLoggedIn = loginTimestamp && (now - parseInt(loginTimestamp)) < 10000;
    
    if (justLoggedIn) {
      console.log('[AuthContext] Just logged in - skipping token verification');
      sessionStorage.removeItem('lastLoginTime');
    }

    // Try to find existing user from any role
    let storedUser = null;
    let token = null;
    let userRole = null;

    // Check in priority order: super_admin > franchise_admin > admin
    const superAdminUser = localStorage.getItem('superAdminUser');
    const superAdminToken = localStorage.getItem('superAdminToken');
    if (superAdminUser && superAdminToken) {
      storedUser = JSON.parse(superAdminUser);
      token = superAdminToken;
      userRole = 'super_admin';
    } else {
      const franchiseAdminUser = localStorage.getItem('franchiseAdminUser');
      const franchiseAdminToken = localStorage.getItem('franchiseAdminToken');
      if (franchiseAdminUser && franchiseAdminToken) {
        storedUser = JSON.parse(franchiseAdminUser);
        token = franchiseAdminToken;
        userRole = 'franchise_admin';
      } else {
        const adminUser = localStorage.getItem('adminUser');
        const adminToken = localStorage.getItem('adminToken');
        if (adminUser && adminToken) {
          storedUser = JSON.parse(adminUser);
          token = adminToken;
          userRole = 'admin';
        }
      }
    }

    if (storedUser && token && ALLOWED_ROLES.includes(storedUser.role)) {
      setUser(storedUser);
      // Only verify token if we didn't just log in AND we're not currently logging in
      if (!justLoggedIn && !isLoggingInRef.current) {
        verifyToken(token, storedUser.role);
      } else {
        console.log('[AuthContext] Skipping token verification - just logged in or logging in');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Login function - handles all admin roles
  const login = async (email, password) => {
    // Set flag to prevent token verification during login
    isLoggingInRef.current = true;
    
    try {
      console.log('[AuthContext] Starting login process');
      const response = await fetch(`${nodeApi}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json();

      // Check if user has an allowed role
      if (!response.ok || !data?.token || !ALLOWED_ROLES.includes(data?.user?.role)) {
        isLoggingInRef.current = false;
        throw new Error(data?.message || 'Login failed or not authorized as admin');
      }

      const userRole = data.user.role;
      const storageKeys = getStorageKeys(userRole);

      // Store user and token with role-specific keys
      localStorage.setItem(storageKeys.token, data.token);
      localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
      
      // Verify token was stored
      const storedToken = localStorage.getItem(storageKeys.token);
      if (!storedToken || storedToken !== data.token) {
        console.error('[AuthContext] Token storage failed!');
        throw new Error('Failed to store authentication token');
      }
      
      console.log('[AuthContext] Login successful, role:', userRole);
      console.log('[AuthContext] Token stored in:', storageKeys.token);
      console.log('[AuthContext] Token length:', data.token.length);
      console.log('[AuthContext] User data:', data.user);
      
      // Mark that we just logged in (use sessionStorage to persist across component remounts)
      // Use a longer window (30 seconds) to prevent any verification attempts
      sessionStorage.setItem('lastLoginTime', Date.now().toString());
      
      // Set user state and loading BEFORE returning
      // This ensures the state is updated synchronously
      setUser(data.user);
      setLoading(false);

      console.log('[AuthContext] User state set, loading set to false');
      console.log('[AuthContext] Token verified in storage:', !!localStorage.getItem(storageKeys.token));

      // Reset the flag after a delay to allow navigation
      setTimeout(() => {
        isLoggingInRef.current = false;
        console.log('[AuthContext] Login process completed, flag reset');
      }, 2000);

      return { success: true };
    } catch (error) {
      isLoggingInRef.current = false;
      console.error('[AuthContext] Login failed:', error);
      return {
        success: false,
        message: error.message || 'Login failed',
      };
    }
  };

  // Verify token
  const verifyToken = async (token, expectedRole) => {
    // NEVER verify token if we're currently logging in
    if (isLoggingInRef.current) {
      console.log('[AuthContext] Skipping verifyToken - currently logging in');
      setLoading(false);
      return;
    }

    // Check if we just logged in - don't verify if we just got a fresh token
    const loginTimestamp = sessionStorage.getItem('lastLoginTime');
    const now = Date.now();
    const justLoggedIn = loginTimestamp && (now - parseInt(loginTimestamp)) < 30000; // 30 second window
    
    if (justLoggedIn) {
      console.log('[AuthContext] Skipping verifyToken - just logged in');
      setLoading(false);
      return;
    }

    try {
      console.log('[AuthContext] Verifying token for role:', expectedRole);
      const response = await fetch(`${nodeApi}/api/admin/verify`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle network errors - don't clear user on network failures
      if (!response.ok && response.status === 0) {
        console.warn('[AuthContext] Network error during token verification - keeping user logged in');
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[AuthContext] Verify response:', { status: response.status, success: data?.success });

    // Check for deactivation or authorization errors
    if (response.status === 403) {
      const errorMessage =
        data?.message ||
        'Your account has been deactivated or is not authorized. Please contact TerraCart Support.';
      console.error('[AuthContext] Account deactivated:', errorMessage);
      alert(errorMessage);
      logout();
      return;
    }

    // Verify returns { success, user: { ... } }
    if (!response.ok || !data?.success || !ALLOWED_ROLES.includes(data?.user?.role)) {
      console.error('[AuthContext] Token verification failed:', {
        ok: response.ok,
        success: data?.success,
        role: data?.user?.role,
        allowed: ALLOWED_ROLES.includes(data?.user?.role)
      });
      // Only logout on actual auth failures (401), not network errors
      if (response.status === 401) {
        console.warn('[AuthContext] Token invalid - logging out');
        logout();
      } else {
        // For other errors (500, network issues), keep user logged in
        console.warn('[AuthContext] Verification error but keeping user logged in');
        setLoading(false);
      }
      return;
    }

    // Update storage with verified user data
    const storageKeys = getStorageKeys(data.user.role);
    setUser(data.user);
    localStorage.setItem(storageKeys.user, JSON.stringify(data.user));
    console.log('[AuthContext] Token verified successfully, user updated');
    setLoading(false);
    } catch (error) {
      // Only logout on actual errors, not network failures
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('[AuthContext] Network error during verification - keeping user logged in:', error.message);
        setLoading(false);
      } else {
        console.error('[AuthContext] Token verification failed:', error);
        // Don't logout on unknown errors - might be temporary
        setLoading(false);
      }
    } finally {
      // Ensure loading is set to false (already set in most branches, but ensure it here too)
      setLoading(false);
    }
  };

  // Logout function - clears all admin tokens
  // force: if true, logout even if just logged in (for explicit user logout)
  const logout = (force = false) => {
    console.log('[AuthContext] Logout called', { force });
    
    // NEVER logout if we're currently logging in
    if (isLoggingInRef.current && !force) {
      console.warn('[AuthContext] Prevented logout - currently logging in');
      return;
    }

    // Check if we just logged in - don't logout if we just logged in (unless forced)
    if (!force) {
      const loginTimestamp = sessionStorage.getItem('lastLoginTime');
      const now = Date.now();
      const justLoggedIn = loginTimestamp && (now - parseInt(loginTimestamp)) < 30000; // 30 second window
      
      if (justLoggedIn) {
        console.warn('[AuthContext] Prevented logout - user just logged in. Use logout(true) to force.');
        return;
      }
    }
    
    // Clear all possible tokens
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminUser');
    localStorage.removeItem('franchiseAdminToken');
    localStorage.removeItem('franchiseAdminUser');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('lastLoginTime');
    setUser(null);
    setLoading(false); // Ensure loading is set to false on logout
    console.log('[AuthContext] Logout completed');
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

