import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Allowed roles for unified admin
const ALLOWED_ROLES = ['admin', 'franchise_admin', 'super_admin'];

const ProtectedRoute = ({ children, allowedRoles = ALLOWED_ROLES }) => {
  const location = useLocation();
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated or not an allowed admin role
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If user is authenticated and has an allowed role, render the protected content
  return children;
};

export default ProtectedRoute;
