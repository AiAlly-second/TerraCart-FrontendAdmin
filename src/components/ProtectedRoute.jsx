import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Allowed roles for unified admin
// Include "cart_admin" for backward compatibility with existing admin accounts
const ALLOWED_ROLES = ["admin", "franchise_admin", "super_admin", "cart_admin"];

const ProtectedRoute = ({ children, allowedRoles = ALLOWED_ROLES }) => {
  const location = useLocation();
  const { user, loading } = useAuth();

  // Check if we just logged in
  const loginTimestamp = sessionStorage.getItem("lastLoginTime");
  const now = Date.now();
  const justLoggedIn = loginTimestamp && now - parseInt(loginTimestamp) < 30000;

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If we just logged in but user is not set yet, wait a bit
  if (justLoggedIn && !user) {
    console.log("[ProtectedRoute] Just logged in, waiting for user state...");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated or not an allowed admin role
  if (!user || !allowedRoles.includes(user.role)) {
    console.log("[ProtectedRoute] Redirecting to login", {
      hasUser: !!user,
      userRole: user?.role,
      allowed: user ? allowedRoles.includes(user.role) : false,
      justLoggedIn,
    });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated and has an allowed role, render the protected content
  console.log("[ProtectedRoute] Access granted", { role: user.role });
  return children;
};

export default ProtectedRoute;
