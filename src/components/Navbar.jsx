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
    <header className="h-20 bg-[#f5e3d5]/80 backdrop-blur-md shadow-md border-b border-[#e2c1ac] flex items-center justify-between px-4 md:px-6">
      {/* Mobile Menu Button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-[#4a2e1f] hover:text-[#d86d2a] transition-colors p-2 mr-2"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Date and Time Display on the left */}
      <div className="text-[#4a2e1f] flex-1">
        <p className="font-bold text-lg md:text-2xl lg:text-3xl">{formattedTime}</p>
        <p className="text-xs md:text-sm">{formattedDate}</p>
      </div>
      
      {/* User Info on the right */}
      <div className="flex items-center space-x-2 md:space-x-4">
        <span className="text-[#4a2e1f] font-medium text-sm md:text-base hidden sm:block">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="px-3 py-2 text-xs md:text-sm font-medium text-white bg-[#d86d2a] rounded-lg hover:bg-[#c75b1a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d86d2a] transition-colors"
        >
          <span className="hidden sm:inline">Logout</span>
          <span className="sm:hidden">Out</span>
        </button>
       
        <div className="w-8 h-8 md:w-10 md:h-10 bg-[#d86d2a] rounded-full flex items-center justify-center text-white font-bold text-sm md:text-base">
          {user?.name?.charAt(0).toUpperCase() || 'A'}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
