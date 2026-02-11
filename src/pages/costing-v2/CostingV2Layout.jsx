import React, { useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const CostingV2Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect franchise admin to dashboard if they try to access any other route
  useEffect(() => {
    if (
      user?.role === "franchise_admin" &&
      location.pathname !== "/costing-v2/dashboard"
    ) {
      navigate("/costing-v2/dashboard", { replace: true });
    }
  }, [location.pathname, user?.role, navigate]);

  // Navigation for Finances (Costing v2) – varies by role
  let menuItems = [];
  if (user?.role === "super_admin") {
    // Super Admin: define global ingredients and BOM (Bill of Material), plus global reports
    menuItems = [
      { path: "/costing-v2/dashboard", label: "Dashboard", icon: "📊" },
      { path: "/costing-v2/ingredients", label: "Ingredients", icon: "🥘" },
      {
        path: "/costing-v2/recipes",
        label: "BOM (Bill of Material)",
        icon: "📝",
      }, // Global BOM
      { path: "/costing-v2/reports", label: "Reports", icon: "📈" },
    ];
  } else if (user?.role === "franchise_admin") {
    // Franchise Admin: only dashboard view
    menuItems = [
      { path: "/costing-v2/dashboard", label: "Dashboard", icon: "📊" },
    ];
  } else if (user?.role === "admin") {
    // Cart Admin: full finances management for their cart/outlet
    menuItems = [
      { path: "/costing-v2/dashboard", label: "Dashboard", icon: "📊" },
      { path: "/costing-v2/ingredients", label: "Ingredients", icon: "🥘" },
      { path: "/costing-v2/suppliers", label: "Suppliers", icon: "🏢" },
      { path: "/costing-v2/purchases", label: "Purchases", icon: "🛒" },
      {
        path: "/costing-v2/recipes",
        label: "BOM (Bill of Material)",
        icon: "📝",
      }, // BOM
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
  } else {
    // Fallback (should not normally happen because routes are restricted)
    menuItems = [
      { path: "/costing-v2/dashboard", label: "Dashboard", icon: "📊" },
    ];
  }

  const roleLabel =
    user?.role === "super_admin"
      ? "Super Admin"
      : user?.role === "franchise_admin"
        ? "Franchise Admin"
        : user?.role === "admin"
          ? "Cart Admin"
          : "Finances";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav for Finances / Costing (horizontal, scrollable on mobile) */}
      <div className="bg-[#6b4423] text-white">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 py-2 sm:py-3 md:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2 sm:mb-3 md:mb-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-lg sm:text-xl md:text-2xl truncate">
                Finances
              </h2>
              <p className="text-[10px] sm:text-xs md:text-sm text-white/80 truncate">
                {roleLabel} ·{" "}
                {user?.role === "super_admin"
                  ? "Global costing overview"
                  : user?.role === "franchise_admin"
                    ? "View franchise financial overview"
                    : "Costing, BOM & Inventory for your cart"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 hide-scrollbar -mx-2 sm:mx-0 px-2 sm:px-0">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg whitespace-nowrap transition-colors flex-shrink-0 ${
                    isActive
                      ? "bg-[#d86d2a] text-white shadow"
                      : "bg-white/10 hover:bg-white/20 text-white"
                  }`}
                >
                  <span className="text-base sm:text-lg">{item.icon}</span>
                  <span className="text-xs sm:text-sm md:text-base">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 py-3 sm:py-4 md:py-6">
        <Outlet />
      </div>
    </div>
  );
};

export default CostingV2Layout;
