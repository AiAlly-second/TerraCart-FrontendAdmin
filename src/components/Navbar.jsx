import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaPowerOff, FaUserCircle } from "react-icons/fa";

const Navbar = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // State to hold the current date and time
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // useEffect to update the date and time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Format time as HH:MM:SS AM/PM
  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  };

  // Format date as "Tuesday, January 13, 2026"
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  const getUserInitial = () => {
    return user?.name?.charAt(0).toUpperCase() || "A";
  };

  return (
    <header className="tc-navbar h-16 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      {/* Left Section: Mobile Menu + Time */}
      <div className="flex items-center space-x-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuToggle}
          className="tc-menu-toggle md:hidden text-gray-600 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Toggle menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Date and Time Display */}
        <div className="text-gray-800">
          <p className="tc-navbar-time font-bold text-xl md:text-2xl">
            {formatTime(currentDateTime)}
          </p>
          <p className="tc-navbar-date text-xs text-gray-500 hidden sm:block">
            {formatDate(currentDateTime)}
          </p>
        </div>
      </div>

      {/* Right Section: User Info + Logout */}
      <div className="flex items-center space-x-3">
        {/* User Name (hidden on mobile) */}
        <span className="tc-user-name text-gray-700 font-medium text-sm hidden md:block">
          {user?.name || "Admin"}
        </span>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <FaPowerOff className="w-3 h-3" />
          <span>Logout</span>
        </button>

        {/* User Avatar */}
        <div className="tc-user-avatar w-10 h-10 bg-[#ff6b35] rounded-full flex items-center justify-center text-white font-bold text-base shadow-md">
          {getUserInitial()}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
