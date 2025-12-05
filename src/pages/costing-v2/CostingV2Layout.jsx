import React, { useState } from "react";
import { Link, useLocation, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const CostingV2Layout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  // For cart admin, show full sidebar
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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } bg-[#6b4423] text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-4 flex items-center justify-between">
          <h2 className={`font-bold text-xl ${!isSidebarOpen && "hidden"}`}>
            Costing
          </h2>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-[#8b5a3c] rounded"
          >
            {isSidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-[#8b5a3c] transition-colors ${
                  isActive ? "bg-[#d86d2a] font-semibold" : ""
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                {isSidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default CostingV2Layout;
