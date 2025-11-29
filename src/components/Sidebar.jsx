import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../assets/images/logo_new.jpeg';
import api from '../utils/api';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [menuStats, setMenuStats] = useState({ categories: 0, items: 0 });
  const [menuLoading, setMenuLoading] = useState(true);

  const userRole = user?.role;

  useEffect(() => {
    // Fetch menu stats when component mounts (only for admin role)
    if (userRole === 'admin') {
      const fetchMenuStats = async () => {
        try {
          setMenuLoading(true);
          const response = await api.get('/menu');
          const menu = response.data || [];
          const totalItems = menu.reduce((sum, cat) => sum + (cat.items?.length || 0), 0);
          setMenuStats({
            categories: menu.length,
            items: totalItems,
          });
        } catch (error) {
          console.error('Error fetching menu stats:', error);
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
    console.log('Logging out...');
    logout();
    navigate('/login');
  };

  // Active link styling
  const activeLinkStyle = {
    backgroundColor: '#d86d2a',
    color: 'white',
  };

  // Get franchise name for franchise admin
  const franchiseName = userRole === 'franchise_admin' ? (user?.name || "Sarva Cafe") : null;
  const portalTitle = userRole === 'super_admin' ? 'Super Admin' : 
                      userRole === 'franchise_admin' ? 'Franchise Admin' : 
                      'Terra Cart';

  // Menu items based on role
  const getMenuItems = () => {
    if (userRole === 'super_admin') {
      return [
        { path: '/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/franchises', icon: '🏢', label: 'Franchises' },
        { path: '/default-menu', icon: '🍽️', label: 'Default Menu' },
        { path: '/users', icon: '👥', label: 'Administrative Users' },
        { path: '/employees', icon: '👤', label: 'Employee Management' },
        { path: '/reports', icon: '📈', label: 'Reports' },
        { path: '/revenue-history', icon: '💰', label: 'Revenue History' },
        { path: '/settings', icon: '⚙️', label: 'Settings' },
      ];
    } else if (userRole === 'franchise_admin') {
      return [
        { path: '/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/carts', icon: '🛒', label: 'Cart Management' },
        { path: '/orders', icon: '📦', label: 'Orders' },
        { path: '/reports', icon: '📈', label: 'Reports' },
        { path: '/employees', icon: '👥', label: 'Employees' },
        { path: '/attendance', icon: '⏰', label: 'Attendance' },
        { path: '/default-menu', icon: '🍽️', label: 'Default Menu' },
        { path: '/settings', icon: '⚙️', label: 'Settings' },
      ];
    } else if (userRole === 'admin') {
      return [
        { path: '/dashboard', icon: '📊', label: 'Dashboard' },
        { path: '/orders', icon: '📦', label: 'Orders' },
        { path: '/takeaway-orders', icon: '🥡', label: 'Takeaway Orders' },
        { path: '/invoices', icon: '🧾', label: 'Invoices' },
        { path: '/menu', icon: '📋', label: 'Menu', showStats: true },
        { path: '/payments', icon: '💳', label: 'Payments' },
        { path: '/tables', icon: '🍽️', label: 'Tables' },
        { path: '/employees', icon: '👥', label: 'Employees' },
        { path: '/attendance', icon: '⏰', label: 'Attendance' },
        { path: '/table-dashboard', icon: '📊', label: 'Table Dashboard' },
        { path: '/feedback', icon: '💬', label: 'Feedback' },
        { path: '/customers', icon: '👥', label: 'Customers' },
        { path: '/inventory', icon: '📦', label: 'Inventory' },
        { path: '/settings', icon: '⚙️', label: 'Settings' },
      ];
    }
    return [];
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={`w-64 fixed top-0 left-0 h-screen bg-[#4a2e1f] text-white flex flex-col shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
      {/* Logo Section */}
      <div className={`flex items-center justify-between ${franchiseName ? 'flex-col h-24 p-3' : 'h-20'} border-b border-[#6b4423] bg-[#3d2418] px-4`}>
        <div className="flex items-center flex-1">
          <img src={Logo} alt="Logo" className={`${franchiseName ? 'h-12 w-auto object-contain mb-2' : 'h-12'} bg-white rounded-full p-1`} />
          {franchiseName ? (
            <>
              <h1 className="text-sm font-bold text-[#f5e3d5] text-center ml-2">{franchiseName}</h1>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold ml-2 text-[#f5e3d5]">{portalTitle}</h1>
            </>
          )}
        </div>
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden text-white hover:text-[#d86d2a] transition-colors p-2"
          aria-label="Close menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            style={({ isActive }) => (isActive ? activeLinkStyle : undefined)}
            className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-[#6b4423] transition-colors text-[#f5e3d5]"
          >
            <div className="flex items-center">
              <span>{item.icon}</span>
              <span className="ml-3">{item.label}</span>
            </div>
            {item.showStats && !menuLoading && menuStats.categories > 0 && (
              <span className="ml-2 text-xs bg-[#d86d2a] text-white px-2 py-0.5 rounded-full">
                {menuStats.categories} cat{menuStats.categories !== 1 ? 's' : ''} • {menuStats.items} items
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="px-4 py-4 border-t border-[#6b4423]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-2 rounded-lg text-left hover:bg-[#d86d2a] transition-colors text-[#f5e3d5]"
        >
          <span>🚪</span>
          <span className="ml-3">Logout</span>
        </button>
      </div>
    </div>
    </>
  );
};

export default Sidebar;
