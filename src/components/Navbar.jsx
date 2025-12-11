import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = ({ onMenuToggle }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  // State to hold the current date and time
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // useEffect to update the date and time every second
  useEffect(() => {
    // Set up an interval to update the time
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(timer);
    };
  }, []); // Empty dependency array means this effect runs once on mount

  // Options for formatting the date and time for India
  const dateOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  };
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  };

  // Format the date and time using Indian English locale
  const formattedDate = currentDateTime.toLocaleDateString('en-IN', dateOptions);
  const formattedTime = currentDateTime.toLocaleTimeString('en-IN', timeOptions);


  return (
    <header className="h-16 sm:h-20 bg-[#f5e3d5]/95 backdrop-blur-md shadow-sm border-b border-[#e2c1ac] flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-40">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-[#4a2e1f] hover:text-[#d86d2a] transition-colors p-1.5 sm:p-2 mr-1 sm:mr-2"
        aria-label="Toggle menu"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Date and Time Display on the left */}
      <div className="text-[#4a2e1f] flex-1 min-w-0 ml-2 sm:ml-4">
        <p className="font-bold text-base sm:text-lg md:text-2xl lg:text-3xl truncate drop-shadow-sm">{formattedTime}</p>
        <p className="text-[10px] sm:text-xs md:text-sm truncate text-[#6b4423]">{formattedDate}</p>
      </div>
      
      {/* User Info on the right */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-4 flex-shrink-0">
        <span className="text-[#4a2e1f] font-medium text-xs sm:text-sm md:text-base hidden sm:block truncate max-w-[100px] md:max-w-none">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs md:text-sm font-medium text-white bg-[#d86d2a] rounded-lg hover:bg-[#c75b1a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d86d2a] transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md"
        >
          <span className="hidden sm:inline">Logout</span>
          <span className="sm:hidden">Out</span>
        </button>
       
        <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-[#d86d2a] rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm md:text-base flex-shrink-0 shadow-sm ring-2 ring-white/20">
          {user?.name?.charAt(0).toUpperCase() || 'A'}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
