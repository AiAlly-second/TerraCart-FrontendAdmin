import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../assets/images/logo_new.jpeg";
import api from "../utils/api";

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [menuStats, setMenuStats] = useState({ categories: 0, items: 0 });
  const [menuLoading, setMenuLoading] = useState(true);

  const userRole = user?.role;

  useEffect(() => {
    // Fetch menu stats when component mounts (only for admin role)
    if (userRole === "admin") {
      const fetchMenuStats = async () => {
        try {
          setMenuLoading(true);
          const response = await api.get("/menu");
          const menu = response.data || [];
          const totalItems = menu.reduce(
            (sum, cat) => sum + (cat.items?.length || 0),
            0
          );
          setMenuStats({
            categories: menu.length,
            items: totalItems,
          });
        } catch (error) {
          console.error("Error fetching menu stats:", error);
        } finally {
          setMenuLoading(false);
        }
      };

      fetchMenuStats();
      const interval = setInterval(fetchMenuStats, 30000);
      return () => clearInterval(interval);
    } else {
      setMenuLoading(false);
    }
  }, [userRole]);

  const handleLogout = () => {
    console.log("Logging out...");
    logout();
    navigate("/login");
  };

  // Active link styling
  const activeLinkStyle = {
    backgroundColor: "#d86d2a",
    color: "white",
  };

  // Get franchise name for franchise admin
  const franchiseName =
    userRole === "franchise_admin" ? user?.name || "Sarva Cart" : null;
  const portalTitle =
    userRole === "super_admin"
      ? "Super Admin"
      : userRole === "franchise_admin"
      ? "Franchise Admin"
      : "Terra Cart";

  // Check if costing feature is enabled
  const isCostingEnabled =
    import.meta.env.VITE_FEATURE_COSTING_ENABLED === "true";

  // Menu items based on role
  const getMenuItems = () => {
    if (userRole === "super_admin") {
      const items = [
        { path: "/dashboard", icon: "📊", label: "Dashboard" },
        { path: "/franchises", icon: "🏢", label: "Franchises" },
        { path: "/default-menu", icon: "🍽️", label: "Default Menu" },
        { path: "/users", icon: "👥", label: "Administrative Users" },
        { path: "/employees", icon: "👤", label: "Employee Management" },
        { path: "/revenue-history", icon: "📊", label: "Revenue History" },
        { path: "/reports", icon: "📈", label: "Reports" },
      ];

      // Add Costing dashboard only (no submenu) for super admin
      if (isCostingEnabled) {
        items.push({
          path: "/costing-v2/dashboard",
          icon: "💰",
          label: "Costing",
        });
      }

      items.push({ path: "/settings", icon: "⚙️", label: "Settings" });
      return items;
    } else if (userRole === "franchise_admin") {
      const items = [
        { path: "/dashboard", icon: "📊", label: "Dashboard" },
        { path: "/carts", icon: "🛒", label: "Cart Management" },
        { path: "/orders", icon: "📦", label: "Orders" },
        { path: "/revenue", icon: "💰", label: "Revenue" },
        { path: "/employees", icon: "👥", label: "Employees" },
        { path: "/attendance", icon: "⏰", label: "Attendance" },
        { path: "/default-menu", icon: "🍽️", label: "Default Menu" },
      ];
      if (isCostingEnabled) {
        items.push({ path: "/costing-v2", icon: "💰", label: "Costing" });
      }
      items.push({ path: "/settings", icon: "⚙️", label: "Settings" });
      return items;
    } else if (userRole === "admin") {
      const items = [
        { path: "/dashboard", icon: "📊", label: "Dashboard" },
        { path: "/orders", icon: "📦", label: "Orders" },
        { path: "/takeaway-orders", icon: "🥡", label: "Takeaway Orders" },
        { path: "/invoices", icon: "🧾", label: "Invoices" },
        { path: "/menu", icon: "📋", label: "Menu", showStats: true },
        { path: "/payments", icon: "💳", label: "Payments" },
        { path: "/tables", icon: "🍽️", label: "Tables" },
        { path: "/employees", icon: "👥", label: "Employees" },
        { path: "/attendance", icon: "⏰", label: "Attendance" },
        { path: "/table-dashboard", icon: "📊", label: "Table Dashboard" },
        { path: "/feedback", icon: "💬", label: "Feedback" },
        { path: "/customers", icon: "👥", label: "Customers" },
      ];
      if (isCostingEnabled) {
        items.push({ path: "/costing-v2", icon: "💰", label: "Costing" });
      }
      items.push({ path: "/settings", icon: "⚙️", label: "Settings" });
      return items;
    }
    return [];
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`w-64 lg:w-64 xl:w-72 fixed top-0 left-0 h-screen bg-[#4a2e1f] text-white flex flex-col shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo Section */}
        <div
          className={`flex items-center justify-between ${
            franchiseName ? "flex-col h-20 sm:h-24 p-2 sm:p-3" : "h-16 sm:h-20"
          } border-b border-[#6b4423] bg-[#3d2418] px-3 sm:px-4 flex-shrink-0`}
        >
          <div className="flex items-center flex-1 min-w-0">
            <img
              src={Logo}
              alt="Logo"
              className={`${
                franchiseName ? "h-8 sm:h-10 md:h-12 w-auto object-contain mb-1 sm:mb-2" : "h-8 sm:h-10 md:h-12"
              } bg-white rounded-full p-0.5 sm:p-1 flex-shrink-0`}
            />
            {franchiseName ? (
              <>
                <h1 className="text-[10px] sm:text-xs md:text-sm font-bold text-[#f5e3d5] text-center ml-1.5 sm:ml-2 truncate">
                  {franchiseName}
                </h1>
              </>
            ) : (
              <>
                <h1 className="text-sm sm:text-base md:text-lg font-bold ml-1.5 sm:ml-2 text-[#f5e3d5] truncate">
                  {portalTitle}
                </h1>
              </>
            )}
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="lg:hidden text-white hover:text-[#d86d2a] transition-all duration-200 p-1.5 sm:p-2 flex-shrink-0 hover:bg-[#6b4423]/50 rounded"
            aria-label="Close menu"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-2 sm:px-3 md:px-4 py-3 sm:py-4 md:py-6 space-y-1 sm:space-y-1.5 md:space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[#6b4423] scrollbar-track-[#3d2418]">
          {menuItems.map((item) => {
            // Regular menu items
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard"}
                style={({ isActive }) =>
                  isActive ? activeLinkStyle : undefined
                }
                className="flex items-center justify-between px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 rounded-lg hover:bg-[#6b4423] transition-all duration-200 text-[#f5e3d5] text-xs sm:text-sm md:text-base group"
                onClick={() => {
                  // Close sidebar on mobile when clicking a link
                  if (window.innerWidth < 1024) {
                    onClose();
                  }
                }}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <span className="text-sm sm:text-base md:text-lg flex-shrink-0 group-hover:scale-110 transition-transform">{item.icon}</span>
                  <span className="ml-1.5 sm:ml-2 md:ml-3 truncate font-medium">{item.label}</span>
                </div>
                {item.showStats && !menuLoading && menuStats.categories > 0 && (
                  <span className="ml-1.5 sm:ml-2 text-[9px] sm:text-[10px] md:text-xs bg-[#d86d2a] text-white px-1.5 sm:px-2 md:px-2.5 py-0.5 sm:py-1 rounded-full flex-shrink-0 whitespace-nowrap font-semibold shadow-sm">
                    {menuStats.categories} cat
                    {menuStats.categories !== 1 ? "s" : ""} • {menuStats.items}{" "}
                    items
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="px-2.5 sm:px-3 md:px-4 py-2.5 sm:py-3 md:py-4 border-t border-[#6b4423] flex-shrink-0 bg-[#3d2418]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg text-left hover:bg-[#d86d2a] transition-all duration-200 text-[#f5e3d5] text-xs sm:text-sm md:text-base font-medium group"
          >
            <span className="text-sm sm:text-base md:text-lg flex-shrink-0 group-hover:scale-110 transition-transform">🚪</span>
            <span className="ml-1.5 sm:ml-2 md:ml-3">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
