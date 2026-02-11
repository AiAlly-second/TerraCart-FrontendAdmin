import React from "react";
import { useAuth } from "../context/AuthContext";
import DashboardAdmin from "./DashboardAdmin";
import DashboardFranchise from "./DashboardFranchise";
import DashboardSuper from "./DashboardSuper";

// Unified Dashboard component that renders role-specific dashboard
const Dashboard = () => {
  const { user } = useAuth();
  const userRole = user?.role;

  // Render role-specific dashboard
  if (userRole === "super_admin") {
    return <DashboardSuper />;
  } else if (userRole === "franchise_admin") {
    return <DashboardFranchise />;
  } else if (userRole === "admin") {
    return <DashboardAdmin />;
  }

  // Default fallback
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-xl text-[#4a2e1f]">Loading dashboard...</p>
      </div>
    </div>
  );
};

export default Dashboard;
