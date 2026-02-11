import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import {
  FaChartBar,
  FaBuilding,
  FaUtensils,
  FaUsers,
  FaUserTie,
  FaChartLine,
  FaFileAlt,
  FaCalculator,
  FaCog,
  FaShoppingCart,
  FaBox,
  FaMoneyBillWave,
  FaReceipt,
  FaCreditCard,
  FaTable,
  FaClock,
  FaTachometerAlt,
  FaComments,
  FaUserFriends,
  FaSignOutAlt,
} from "react-icons/fa";

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
            0,
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
      const interval = setInterval(fetchMenuStats, 60000);
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

  // Get user display info
  const getUserDisplayName = () => {
    if (userRole === "super_admin") return "Super Admin";
    if (userRole === "franchise_admin") return user?.name || "Franchise Admin";
    return user?.name || "Admin";
  };

  const getUserInitial = () => {
    const name = getUserDisplayName();
    return name.charAt(0).toUpperCase();
  };

  // Check if costing feature is enabled
  const isCostingEnabled =
    import.meta.env.VITE_FEATURE_COSTING_ENABLED === "true";

  // Icon mapping
  const iconMap = {
    "📊": <FaChartBar className="w-4 h-4" />,
    "🏢": <FaBuilding className="w-4 h-4" />,
    "🍽️": <FaUtensils className="w-4 h-4" />,
    "👥": <FaUsers className="w-4 h-4" />,
    "👤": <FaUserTie className="w-4 h-4" />,
    "📈": <FaChartLine className="w-4 h-4" />,
    "💰": <FaMoneyBillWave className="w-4 h-4" />,
    "🧮": <FaCalculator className="w-4 h-4" />,
    "⚙️": <FaCog className="w-4 h-4" />,
    "🛒": <FaShoppingCart className="w-4 h-4" />,
    "📦": <FaBox className="w-4 h-4" />,
    "💳": <FaCreditCard className="w-4 h-4" />,
    "🧾": <FaReceipt className="w-4 h-4" />,
    "📋": <FaFileAlt className="w-4 h-4" />,
    "⏰": <FaClock className="w-4 h-4" />,
    "🥡": <FaBox className="w-4 h-4" />,
    "💬": <FaComments className="w-4 h-4" />,
  };

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

      if (isCostingEnabled) {
        items.push({
          path: "/costing-v2/dashboard",
          icon: "🧮",
          label: "Finances",
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
        { path: "/addons", icon: "➕", label: "Global Add-ons" },
      ];
      if (isCostingEnabled) {
        items.push({ path: "/costing-v2", icon: "🧮", label: "Finances" });
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
        items.push({ path: "/costing-v2", icon: "🧮", label: "Finances" });
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`w-64 fixed top-0 left-0 h-screen bg-[#3d3028] text-white flex flex-col shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* User Profile Section */}
        <div className="p-4 border-b border-white/10 bg-[#3d3028]">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-[#ff6b35] rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-lg">
              {getUserInitial()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-semibold text-base truncate">
                {getUserDisplayName()}
              </h2>
              <p className="text-gray-400 text-xs truncate">
                {user?.email || "admin@terracart.com"}
              </p>
            </div>
            {/* Close button for mobile */}
            <button
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Close menu"
            >
              <svg
                className="w-5 h-5"
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
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {menuItems.map((item) => {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard"}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? "bg-[#ff6b35] text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`
                }
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    onClose();
                  }
                }}
              >
                <div className="flex items-center min-w-0 flex-1 space-x-3">
                  <span className="flex-shrink-0">
                    {iconMap[item.icon] || item.icon}
                  </span>
                  <span className="font-medium text-sm truncate">
                    {item.label}
                  </span>
                </div>
                {item.showStats && !menuLoading && menuStats.categories > 0 && (
                  <span className="ml-2 text-xs bg-[#ff6b35] text-white px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap font-semibold">
                    {menuStats.categories}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200 group"
          >
            <FaSignOutAlt className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
