import React from "react";
import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const CostingV2Layout = () => {
  const location = useLocation();
  const { user } = useAuth();

  // For super admin, only show dashboard (no sidebar)
  if (user?.role === "super_admin") {
    if (location.pathname !== "/costing-v2/dashboard") {
      return <Navigate to="/costing-v2/dashboard" replace />;
    }
    return <Outlet />;
  }

  // For franchise admin, only show dashboard (no sidebar)
  if (user?.role === "franchise_admin") {
    if (location.pathname !== "/costing-v2/dashboard") {
      return <Navigate to="/costing-v2/dashboard" replace />;
    }
    return <Outlet />;
  }

  // For cart admin, show full navigation (horizontal)
  const menuItems = [
    { path: "/costing-v2/dashboard", label: "Dashboard", icon: "📊" },
    { path: "/costing-v2/ingredients", label: "Ingredients", icon: "🥘" },
    { path: "/costing-v2/suppliers", label: "Suppliers", icon: "🏢" },
    { path: "/costing-v2/purchases", label: "Purchases", icon: "🛒" },
    { path: "/costing-v2/recipes", label: "Recipes", icon: "📝" },
    { path: "/costing-v2/menu-items", label: "Menu Items", icon: "🍽️" },
    { path: "/costing-v2/inventory", label: "Inventory", icon: "📦" },
    { path: "/costing-v2/waste", label: "Waste", icon: "🗑️" },
    {
      path: "/costing-v2/labour-overhead",
      label: "Labour & Overhead",
      icon: "💰",
    },
    { path: "/costing-v2/expenses", label: "Expenses", icon: "💸" },
    { path: "/costing-v2/reports", label: "Reports", icon: "📈" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav for Costing (horizontal, scrollable on mobile) */}
      <div className="bg-[#6b4423] text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <h2 className="font-bold text-xl sm:text-2xl">Costing</h2>
              <p className="text-xs sm:text-sm text-white/80">Cart Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-[#d86d2a] text-white shadow"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm sm:text-base">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Outlet />
      </div>
    </div>
  );
};

export default CostingV2Layout;
