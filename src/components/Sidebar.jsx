import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  FaQrcode,
} from "react-icons/fa";

export const getSidebarMenuItems = ({ userRole, isCostingEnabled }) => {
  if (userRole === "super_admin") {
    const items = [
      { path: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { path: "/franchises", icon: "franchises", label: "Franchises" },
      { path: "/default-menu", icon: "menu", label: "Default Menu" },
      { path: "/users", icon: "users", label: "Administrative Users" },
      { path: "/employees", icon: "employee", label: "Employee Management" },
      { path: "/revenue-history", icon: "revenue_history", label: "Revenue History" },
      { path: "/reports", icon: "reports", label: "Reports" },
    ];

    if (isCostingEnabled) {
      items.push({
        path: "/costing-v2/dashboard",
        icon: "finances",
        label: "Finances",
      });
    }

    items.push({ path: "/settings", icon: "settings", label: "Settings" });
    return items;
  }

  if (userRole === "franchise_admin") {
    const items = [
      { path: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { path: "/carts", icon: "carts", label: "Cart Management" },
      { path: "/revenue", icon: "revenue", label: "Revenue" },
      { path: "/employees", icon: "users", label: "Employees" },
      { path: "/attendance", icon: "attendance", label: "Attendance" },
      { path: "/default-menu", icon: "menu", label: "Default Menu" },
    ];
    if (isCostingEnabled) {
      items.push({ path: "/costing-v2", icon: "finances", label: "Finances" });
    }
    items.push({ path: "/settings", icon: "settings", label: "Settings" });
    return items;
  }

  if (userRole === "admin") {
    const items = [
      { path: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { path: "/orders", icon: "orders", label: "Orders" },
      { path: "/invoices", icon: "invoices", label: "Invoices" },
      { path: "/menu", icon: "menu", label: "Menu", showStats: true },
      { path: "/payments", icon: "payments", label: "Payments" },
      { path: "/tables", icon: "qr_code", label: "QR Code" },
      { path: "/employees", icon: "users", label: "Employees" },
      { path: "/attendance", icon: "attendance", label: "Attendance" },
      { path: "/customers", icon: "customers", label: "Customers" },
    ];
    if (isCostingEnabled) {
      items.push({ path: "/costing-v2", icon: "finances", label: "Finances" });
    }
    items.push({ path: "/settings", icon: "settings", label: "Settings" });
    return items;
  }

  return [];
};

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
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
    OFFICE: <FaBuilding className="w-4 h-4" />,
    qr_code: <FaQrcode className="w-4 h-4" />,
    dashboard: <FaChartBar className="w-4 h-4" />,
    franchises: <FaBuilding className="w-4 h-4" />,
    menu: <FaUtensils className="w-4 h-4" />,
    users: <FaUsers className="w-4 h-4" />,
    employee: <FaUserTie className="w-4 h-4" />,
    reports: <FaChartLine className="w-4 h-4" />,
    revenue: <FaMoneyBillWave className="w-4 h-4" />,
    revenue_history: <FaChartBar className="w-4 h-4" />,
    finances: <FaCalculator className="w-4 h-4" />,
    settings: <FaCog className="w-4 h-4" />,
    carts: <FaShoppingCart className="w-4 h-4" />,
    orders: <FaBox className="w-4 h-4" />,
    payments: <FaCreditCard className="w-4 h-4" />,
    invoices: <FaReceipt className="w-4 h-4" />,
    tables: <FaTable className="w-4 h-4" />,
    attendance: <FaClock className="w-4 h-4" />,
    table_dashboard: <FaTachometerAlt className="w-4 h-4" />,
    customers: <FaUserFriends className="w-4 h-4" />,
    inventory: <FaBox className="w-4 h-4" />,
    feedback: <FaComments className="w-4 h-4" />,
  };

  const menuItems = getSidebarMenuItems({ userRole, isCostingEnabled });

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
        data-open={isOpen ? "true" : "false"}
        className={`tc-sidebar w-64 fixed top-0 left-0 h-screen bg-[#3d3028] text-white flex flex-col shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* User Profile Section */}
        <div className="tc-sidebar-profile p-4 border-b border-white/10 bg-[#3d3028]">
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
        <nav className="tc-sidebar-nav flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {menuItems.map((item) => {
            if (Array.isArray(item.children) && item.children.length > 0) {
              const isGroupActive = item.children.some(
                (child) =>
                  location.pathname === child.path ||
                  location.pathname.startsWith(`${child.path}/`),
              );

              return (
                <div key={item.key || item.label} className="space-y-1">
                  <div
                    className={`tc-sidebar-item flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
                      isGroupActive
                        ? "bg-[#ff6b35]/20 text-white"
                        : "text-gray-300"
                    }`}
                  >
                    <span className="flex-shrink-0">
                      {iconMap[item.icon] || item.icon}
                    </span>
                    <span className="tc-sidebar-label ml-3 font-medium text-sm truncate">
                      {item.label}
                    </span>
                  </div>

                  <div className="ml-6 pl-3 border-l border-white/10 space-y-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `tc-sidebar-item flex items-center px-3 py-2 rounded-lg transition-all duration-200 ${
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
                        <span className="flex-shrink-0">
                          {iconMap[child.icon] || child.icon}
                        </span>
                        <span className="tc-sidebar-label ml-3 font-medium text-sm truncate">
                          {child.label}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/dashboard"}
                className={({ isActive }) =>
                  {
                    const isQrCodeSection =
                      item.path === "/tables" &&
                      (location.pathname === "/offices" ||
                        location.pathname.startsWith("/offices/") ||
                        location.pathname === "/takeaway-qr" ||
                        location.pathname.startsWith("/takeaway-qr/") ||
                        location.pathname === "/table-dashboard" ||
                        location.pathname.startsWith("/table-dashboard/"));
                    const isMenuItemActive = isActive || isQrCodeSection;
                    return `tc-sidebar-item flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 group ${
                      isMenuItemActive
                        ? "bg-[#ff6b35] text-white shadow-lg"
                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                    }`;
                  }
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
                  <span className="tc-sidebar-label font-medium text-sm truncate">
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
        <div className="tc-sidebar-footer p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="tc-sidebar-item w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200 group"
          >
            <FaSignOutAlt className="w-4 h-4 flex-shrink-0" />
            <span className="tc-sidebar-label font-medium text-sm">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

