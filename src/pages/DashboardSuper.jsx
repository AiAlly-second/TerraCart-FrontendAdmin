import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaBuilding, FaUsers, FaRupeeSign, FaChartLine, FaSpinner } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';

const nodeApi = import.meta.env.VITE_NODE_API_URL || 'http://localhost:5001';
const socket = io(nodeApi);

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    franchises: { title: 'Total Franchises', value: '0', icon: FaBuilding, color: 'bg-blue-500', loading: true },
    users: { title: 'Total Users', value: '0', icon: FaUsers, color: 'bg-green-500', loading: true },
    revenue: { title: 'Total Revenue', value: '₹0', icon: FaRupeeSign, color: 'bg-yellow-500', loading: true },
    orders: { title: 'Total Orders', value: '0', icon: FaChartLine, color: 'bg-purple-500', loading: true },
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [activeFranchiseIds, setActiveFranchiseIds] = useState(new Set());
  const [cartStats, setCartStats] = useState({
    totalCarts: 0,
    activeCarts: 0,
    inactiveCarts: 0,
    pendingApproval: 0,
    franchiseStats: [],
  });

  const updateRevenue = (ordersData) => {
    // Super admin aggregates revenue from ACTIVE franchises only
    // ordersData should already be filtered to active franchises from fetchDashboardData
    const paidOrders = ordersData.filter((order) => order.status === "Paid");
    
    // Calculate total revenue from paid orders (already filtered to active franchises)
    const totalRevenue = paidOrders.reduce((sum, order) => {
      if (!order.kotLines || !Array.isArray(order.kotLines) || order.kotLines.length === 0) {
        return sum;
      }
      // Sum all KOTs in the order
      const orderTotal = order.kotLines.reduce((kotSum, kot) => {
        return kotSum + Number(kot.totalAmount || 0);
      }, 0);
      return sum + orderTotal;
    }, 0);
    
    setStats((prev) => ({
      ...prev,
      revenue: { 
        ...prev.revenue, 
        value: `₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        loading: false
      },
      orders: {
        ...prev.orders,
        value: ordersData.length.toString() // Already filtered to active franchises
      }
    }));
  };

  useEffect(() => {
    // Wait for authentication to complete and ensure token is available
    if (!authLoading && user) {
      // Check if token exists before making API calls
      const token = localStorage.getItem('superAdminToken') || 
                   localStorage.getItem('franchiseAdminToken') || 
                   localStorage.getItem('adminToken');
      
      if (token) {
        console.log('[DashboardSuper] User authenticated, token available, fetching data');
        fetchDashboardData();
      } else {
        console.warn('[DashboardSuper] User authenticated but no token found, waiting...');
        // Wait a bit for token to be set
        const timer = setTimeout(() => {
          const retryToken = localStorage.getItem('superAdminToken') || 
                           localStorage.getItem('franchiseAdminToken') || 
                           localStorage.getItem('adminToken');
          if (retryToken) {
            fetchDashboardData();
          } else {
            console.error('[DashboardSuper] Token still not available after wait');
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [authLoading, user]); // Run when auth state changes

  useEffect(() => {
    // Set up socket listeners - they will use activeFranchiseIds from state
    // This effect runs when activeFranchiseIds changes
    
    // Listen for real-time order updates to update revenue dynamically
    const handleNewOrder = (order) => {
      // Filter by active franchises using current state value
      const orderFranchiseId = order.franchiseId?.toString() || order.franchiseId;
      if (!orderFranchiseId || !activeFranchiseIds.has(orderFranchiseId)) {
        return; // Skip orders from inactive franchises
      }
      
      setOrders((prev) => {
        // Check if order already exists (avoid duplicates)
        const exists = prev.some(o => o._id === order._id);
        if (exists) {
          // If exists, update it instead of adding duplicate
          const updatedOrders = prev.map((o) => 
            o._id === order._id ? order : o
          );
          // Recalculate revenue with active orders only
          updateRevenue(updatedOrders);
          return updatedOrders;
        }
        
        // Add new order and recalculate revenue
        const newOrders = [...prev, order];
        updateRevenue(newOrders);
        return newOrders;
      });
    };

    const handleOrderUpdated = (updatedOrder) => {
      // Filter by active franchises using current state value
      const orderFranchiseId = updatedOrder.franchiseId?.toString() || updatedOrder.franchiseId;
      if (!orderFranchiseId || !activeFranchiseIds.has(orderFranchiseId)) {
        // If order is from inactive franchise, remove it if it exists
        setOrders((prev) => {
          const filtered = prev.filter(o => o._id !== updatedOrder._id);
          updateRevenue(filtered);
          return filtered;
        });
        return;
      }
      
      setOrders((prev) => {
        const orderExists = prev.some(o => o._id === updatedOrder._id);
        let updatedOrders;
        
        if (orderExists) {
          // Update existing order (status might have changed to "Paid")
          updatedOrders = prev.map((order) => 
            order._id === updatedOrder._id ? updatedOrder : order
          );
        } else {
          // Add new order if it doesn't exist (might have been created before page load)
          updatedOrders = [...prev, updatedOrder];
        }
        
        // Recalculate total revenue from active franchises only
        updateRevenue(updatedOrders);
        return updatedOrders;
      });
    };

    // Listen for payment updates to refresh revenue (only from active franchises)
    const handlePaymentUpdated = async () => {
      // Refetch all orders and filter by active franchises
      try {
        const ordersResponse = await api.get('/orders');
        // Ensure fetchedOrders is always an array
        let fetchedOrders = [];
        if (Array.isArray(ordersResponse.data)) {
          fetchedOrders = ordersResponse.data;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
          fetchedOrders = ordersResponse.data.orders;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.data)) {
          fetchedOrders = ordersResponse.data.data;
        }
        
        // Get current active franchise IDs
        const currentIds = activeFranchiseIds;
        
        // Filter to only active franchises
        const activeOrders = Array.isArray(fetchedOrders) ? fetchedOrders.filter(order => {
          const franchiseId = order.franchiseId?.toString() || order.franchiseId;
          return franchiseId && currentIds.has(franchiseId);
        }) : [];
        
        setOrders(activeOrders);
        // Recalculate total revenue from active franchises only
        updateRevenue(activeOrders);
      } catch (err) {
        console.error("Failed to refresh orders after payment update:", err);
      }
    };

    // Also listen for paymentCreated to catch new payments
    const handlePaymentCreated = async () => {
      // Refetch all orders and filter by active franchises
      try {
        const ordersResponse = await api.get('/orders');
        // Ensure fetchedOrders is always an array
        let fetchedOrders = [];
        if (Array.isArray(ordersResponse.data)) {
          fetchedOrders = ordersResponse.data;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
          fetchedOrders = ordersResponse.data.orders;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.data)) {
          fetchedOrders = ordersResponse.data.data;
        }
        
        // Get current active franchise IDs
        const currentIds = activeFranchiseIds;
        
        // Filter to only active franchises
        const activeOrders = Array.isArray(fetchedOrders) ? fetchedOrders.filter(order => {
          const franchiseId = order.franchiseId?.toString() || order.franchiseId;
          return franchiseId && currentIds.has(franchiseId);
        }) : [];
        
        setOrders(activeOrders);
        // Recalculate total revenue from active franchises only
        updateRevenue(activeOrders);
      } catch (err) {
        console.error("Failed to refresh orders after payment creation:", err);
      }
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderUpdated", handleOrderUpdated);
    socket.on("paymentUpdated", handlePaymentUpdated);
    socket.on("paymentCreated", handlePaymentCreated);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderUpdated", handleOrderUpdated);
      socket.off("paymentUpdated", handlePaymentUpdated);
      socket.off("paymentCreated", handlePaymentCreated);
    };
  }, [activeFranchiseIds]); // Re-run when activeFranchiseIds changes

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      let users = [];
      try {
        const usersResponse = await api.get('/users');
        // Ensure users is always an array
        if (Array.isArray(usersResponse.data)) {
          users = usersResponse.data;
        } else if (usersResponse.data && Array.isArray(usersResponse.data.users)) {
          users = usersResponse.data.users;
        } else if (usersResponse.data && Array.isArray(usersResponse.data.data)) {
          users = usersResponse.data.data;
        } else {
          users = [];
          console.warn('[DashboardSuper] Users response is not an array:', usersResponse.data);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        // Continue even if users fetch fails
        users = [];
      }
      
      // Count ACTIVE franchises only (users with franchise_admin role AND isActive !== false)
      const activeFranchises = users.filter(u => 
        u.role === 'franchise_admin' && u.isActive !== false
      );
      const allFranchises = users.filter(u => u.role === 'franchise_admin');
      
      // Get active franchise IDs for filtering orders
      const activeFranchiseIdsSet = new Set(
        activeFranchises.map(f => f._id.toString())
      );
      setActiveFranchiseIds(activeFranchiseIdsSet);
      
      // Fetch current revenue from persistent API (calculates from database, not session)
      let fetchedOrders = [];
      let totalRevenue = 0;
      let totalOrdersCount = 0;
      try {
        // First try to get current revenue from revenue API (persistent, calculated from DB)
        // This API already filters by active franchises
        try {
          const revenueResponse = await api.get('/revenue/current');
          if (revenueResponse.data?.success && revenueResponse.data?.data) {
            totalRevenue = revenueResponse.data.data.totalRevenue || 0;
            totalOrdersCount = revenueResponse.data.data.totalOrders || 0;
            console.log('Using persistent revenue data:', totalRevenue, 'Orders:', totalOrdersCount);
          }
        } catch (revenueErr) {
          console.log('Revenue API not available, calculating from orders:', revenueErr.message);
        }
        
        // Also fetch orders for real-time updates and as fallback
        const ordersResponse = await api.get('/orders');
        // Ensure fetchedOrders is always an array
        if (Array.isArray(ordersResponse.data)) {
          fetchedOrders = ordersResponse.data;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
          fetchedOrders = ordersResponse.data.orders;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.data)) {
          fetchedOrders = ordersResponse.data.data;
        } else {
          fetchedOrders = [];
          console.warn('[DashboardSuper] Orders response is not an array:', ordersResponse.data);
        }
        
        // Filter orders to only include those from ACTIVE franchises
        const activeOrders = Array.isArray(fetchedOrders) ? fetchedOrders.filter(order => {
          const franchiseId = order.franchiseId?.toString() || order.franchiseId;
          return franchiseId && activeFranchiseIdsSet.has(franchiseId);
        }) : [];
        
        // If revenue API failed, calculate from active orders only
        if (totalRevenue === 0) {
          const paidOrders = activeOrders.filter((order) => order.status === "Paid");
          totalRevenue = paidOrders.reduce((sum, order) => {
            if (!order.kotLines || !Array.isArray(order.kotLines) || order.kotLines.length === 0) {
              return sum;
            }
            const orderTotal = order.kotLines.reduce((kotSum, kot) => {
              return kotSum + Number(kot.totalAmount || 0);
            }, 0);
            return sum + orderTotal;
          }, 0);
        }
        
        // Set total orders count from active orders if not set from API
        if (totalOrdersCount === 0) {
          totalOrdersCount = activeOrders.length;
        }
        
        // Store active orders for real-time updates
        setOrders(activeOrders);
        // Update revenue with active orders (for real-time updates)
        updateRevenue(activeOrders);
      } catch (err) {
        console.error('Error fetching revenue data:', err);
        // Set revenue to 0 if there's an error
        totalRevenue = 0;
        totalOrdersCount = 0;
      }

      // Get recent users (last 5)
      const recent = users
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      // Fetch cart statistics
      let cartStatistics = {
        totalCarts: 0,
        activeCarts: 0,
        inactiveCarts: 0,
        pendingApproval: 0,
        franchiseStats: [],
      };
      try {
        const cartStatsResponse = await api.get('/users/stats/carts');
        cartStatistics = cartStatsResponse.data || cartStatistics;
        setCartStats(cartStatistics);
      } catch (err) {
        console.error('Error fetching cart statistics:', err);
      }

      setStats({
        franchises: { title: 'Active Franchises', value: activeFranchises.length.toString(), icon: FaBuilding, color: 'bg-blue-500', loading: false },
        users: { title: 'Total Users', value: users.length.toString(), icon: FaUsers, color: 'bg-green-500', loading: false },
        revenue: { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: FaRupeeSign, color: 'bg-yellow-500', loading: false },
        orders: { title: 'Total Orders', value: totalOrdersCount.toString(), icon: FaChartLine, color: 'bg-purple-500', loading: false },
      });
      
      setRecentUsers(recent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsArray = Object.values(stats);

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#4a2e1f]">Dashboard</h1>
        <p className="text-sm md:text-base text-[#6b4423] mt-1 md:mt-2">Welcome to Super Admin Portal</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statsArray.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#6b4423]">{stat.title}</p>
                  {stat.loading ? (
                    <div className="mt-2">
                      <FaSpinner className="animate-spin text-[#d86d2a]" />
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-[#4a2e1f] mt-2">{stat.value}</p>
                  )}
                </div>
                <div className="bg-[#d86d2a] p-3 rounded-lg">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Statistics Section */}
      <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold text-[#4a2e1f] mb-3 md:mb-4">Cart Statistics</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <FaSpinner className="animate-spin text-gray-400 text-2xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-[#f5e3d5] border border-[#e2c1ac] p-3 md:p-4 rounded-lg">
                <p className="text-xs md:text-sm text-[#6b4423]">Total Carts</p>
                <p className="text-xl md:text-2xl font-bold text-[#4a2e1f]">{cartStats.totalCarts}</p>
              </div>
              <div className="bg-green-50 border border-green-200 p-3 md:p-4 rounded-lg">
                <p className="text-xs md:text-sm text-green-700">Active Carts</p>
                <p className="text-xl md:text-2xl font-bold text-green-600">{cartStats.activeCarts}</p>
              </div>
              <div className="bg-red-50 border border-red-200 p-3 md:p-4 rounded-lg">
                <p className="text-xs md:text-sm text-red-700">Inactive Carts</p>
                <p className="text-xl md:text-2xl font-bold text-red-600">{cartStats.inactiveCarts}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 p-3 md:p-4 rounded-lg">
                <p className="text-xs md:text-sm text-yellow-700">Pending Approval</p>
                <p className="text-xl md:text-2xl font-bold text-yellow-600">{cartStats.pendingApproval}</p>
              </div>
            </div>

            {/* Franchise-wise Statistics */}
            {cartStats.franchiseStats && cartStats.franchiseStats.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-[#4a2e1f] mb-3">Carts by Franchise</h3>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 md:px-0">
                    <table className="min-w-full divide-y divide-[#e2c1ac]">
                      <thead className="bg-[#f5e3d5]">
                        <tr>
                          <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Franchise</th>
                          <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">Total Carts</th>
                          <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">Active</th>
                          <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">Inactive</th>
                          <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">Pending</th>
                        </tr>
                      </thead>
                    <tbody className="bg-white divide-y divide-[#e2c1ac]">
                      {cartStats.franchiseStats.map((franchise) => (
                        <tr key={franchise.franchiseId} className="hover:bg-[#fef4ec] transition-colors">
                          <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-[#4a2e1f]">{franchise.franchiseName}</td>
                          <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center text-[#6b4423]">{franchise.totalCarts}</td>
                          <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {franchise.activeCarts}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              {franchise.inactiveCarts}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              {franchise.pendingApproval}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-[#4a2e1f] mb-3 md:mb-4">Recent Users</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin text-[#d86d2a] text-2xl" />
            </div>
          ) : recentUsers.length > 0 ? (
            <div className="space-y-4">
              {recentUsers.map((user) => (
                <div key={user._id} className="border-l-4 border-[#d86d2a] pl-4">
                  <p className="text-sm font-medium text-[#4a2e1f]">{user.name}</p>
                  <p className="text-xs text-[#6b4423] mt-1">{user.email} • {user.role}</p>
                  <p className="text-xs text-[#8b6f47] mt-1">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#6b4423] text-center py-4">No users yet</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-semibold text-[#4a2e1f] mb-3 md:mb-4">Quick Actions</h2>
          <div className="space-y-2 md:space-y-3">
            <Link
              to="/franchises"
              className="block w-full px-3 md:px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a] transition-colors text-center shadow-md text-sm md:text-base"
            >
              Manage Franchises
            </Link>
            <Link
              to="/users"
              className="block w-full px-3 md:px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a] transition-colors text-center shadow-md text-sm md:text-base"
            >
              Manage Users
            </Link>
            <Link
              to="/reports"
              className="block w-full px-3 md:px-4 py-2 bg-[#6b4423] text-white rounded-lg hover:bg-[#5a3520] transition-colors text-center shadow-md text-sm md:text-base"
            >
              View Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

