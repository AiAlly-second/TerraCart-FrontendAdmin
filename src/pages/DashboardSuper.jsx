import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaBuilding,
  FaUsers,
  FaRupeeSign,
  FaChartLine,
  FaSpinner,
  FaArrowUp,
  FaArrowRight,
  FaChartBar,
} from "react-icons/fa";
import api from "../utils/api";
// Removed socket import - using HTTP polling instead

const Dashboard = () => {
  const [stats, setStats] = useState({
    franchises: {
      title: "Total Franchises",
      value: "0",
      icon: FaBuilding,
      color: "bg-blue-500",
      loading: true,
    },
    users: {
      title: "Total Users",
      value: "0",
      icon: FaUsers,
      color: "bg-green-500",
      loading: true,
    },
    revenue: {
      title: "Total Revenue",
      value: "₹0",
      icon: FaRupeeSign,
      color: "bg-yellow-500",
      loading: true,
    },
    orders: {
      title: "Total Orders",
      value: "0",
      icon: FaChartLine,
      color: "bg-purple-500",
      loading: true,
    },
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
  
  const [dailyStats, setDailyStats] = useState({
    todayRevenue: 0,
    avgOrderValue: 0,
    activeCarts: 0
  });

  const updateRevenue = (ordersData) => {
    // Super admin aggregates revenue from ACTIVE franchises only
    // ordersData should already be filtered to active franchises from fetchDashboardData
    if (!Array.isArray(ordersData)) {
      return;
    }
    const paidOrders = (ordersData || []).filter(
      (order) => order && order.status === "Paid"
    );

    // Calculate total revenue from paid orders (already filtered to active franchises)
    const totalRevenue = paidOrders.reduce((sum, order) => {
      if (
        !order ||
        !order.kotLines ||
        !Array.isArray(order.kotLines) ||
        order.kotLines.length === 0
      ) {
        return sum;
      }
      // Sum all KOTs in the order
      const orderTotal = order.kotLines.reduce((kotSum, kot) => {
        return kotSum + Number(kot.totalAmount || 0);
      }, 0);
      return sum + orderTotal;
    }, 0);

    const safeTotalRevenue = Number(totalRevenue || 0);
    setStats((prev) => ({
      ...prev,
      revenue: {
        ...prev.revenue,
        value: `₹${safeTotalRevenue.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`,
        loading: false,
      },
      orders: {
        ...prev.orders,
        value: ordersData.length.toString(), // Already filtered to active franchises
      },
    }));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []); // Only run once on mount

  useEffect(() => {
    // HTTP polling for real-time updates (replaces Socket.IO)
    // Poll orders every 12 seconds to check for new/updated orders and payments
    const pollingInterval = setInterval(async () => {
      try {
        const ordersResponse = await api.get("/orders");
        const fetchedOrders = ordersResponse.data || [];

        // Get current active franchise IDs
        const currentIds = activeFranchiseIds;

        // Filter to only active franchises
        const activeOrders = fetchedOrders.filter((order) => {
          const franchiseId =
            order.franchiseId?.toString() || order.franchiseId;
          return franchiseId && currentIds.has(franchiseId);
        });

        setOrders(activeOrders);
        // Recalculate total revenue from active franchises only
        updateRevenue(activeOrders);

        // Fetch dashboard data to update recent users and stats
        fetchDashboardData();
      } catch (err) {
        // Silently fail polling - don't spam console
        if (import.meta.env.DEV) {
          console.error("Failed to poll orders:", err);
        }
      }
    }, 12000); // 12 seconds polling interval

    return () => {
      clearInterval(pollingInterval);
    };
  }, [activeFranchiseIds]); // Re-run when activeFranchiseIds changes

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch users
      let users = [];
      try {
        const usersResponse = await api.get("/users");
        users = usersResponse.data || [];
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Error fetching users:", err);
        }
        // Continue even if users fetch fails
      }

      // Count ACTIVE franchises only (users with franchise_admin role AND isActive !== false)
      const activeFranchises = users.filter(
        (u) => u.role === "franchise_admin" && u.isActive !== false
      );
      const allFranchises = users.filter((u) => u.role === "franchise_admin");

      // Get active franchise IDs for filtering orders
      const activeFranchiseIdsSet = new Set(
        activeFranchises.filter((f) => f && f._id).map((f) => f._id.toString())
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
          const revenueResponse = await api.get("/revenue/current");
          if (revenueResponse.data?.success && revenueResponse.data?.data) {
            totalRevenue = revenueResponse.data.data.totalRevenue || 0;
            totalOrdersCount = revenueResponse.data.data.totalOrders || 0;
            console.log(
              "Using persistent revenue data:",
              totalRevenue,
              "Orders:",
              totalOrdersCount
            );
          }
        } catch (revenueErr) {
          console.log(
            "Revenue API not available, calculating from orders:",
            revenueErr.message
          );
        }

        // Also fetch orders for real-time updates and as fallback
        const ordersResponse = await api.get("/orders");
        fetchedOrders = ordersResponse.data || [];

        // Filter orders to only include those from ACTIVE franchises
        const activeOrders = (fetchedOrders || []).filter((order) => {
          if (!order) return false;
          const franchiseId =
            order.franchiseId?.toString() || order.franchiseId;
          return franchiseId && activeFranchiseIdsSet.has(franchiseId);
        });

        // If revenue API failed, calculate from active orders only
        if (totalRevenue === 0) {
          const paidOrders = activeOrders.filter(
            (order) => order.status === "Paid"
          );
          totalRevenue = paidOrders.reduce((sum, order) => {
            if (
              !order.kotLines ||
              !Array.isArray(order.kotLines) ||
              order.kotLines.length === 0
            ) {
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
        // Update revenue with active orders (for real-time updates)
        updateRevenue(activeOrders);

        // --- Calculate Daily Stats ---
        const todayStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        
        const todayOrders = activeOrders.filter(order => {
          if (!order.createdAt) return false;
          const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
          return orderDate === todayStr && order.status === 'Paid';
        });

        const todayRev = todayOrders.reduce((sum, order) => {
             if (!order.kotLines || !Array.isArray(order.kotLines)) return sum;
             const orderTotal = order.kotLines.reduce((kSum, k) => kSum + Number(k.totalAmount || 0), 0);
             return sum + orderTotal;
        }, 0);

        const avgVal = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount) : 0;

        setDailyStats(prev => ({
            ...prev,
            todayRevenue: todayRev,
            avgOrderValue: avgVal
        }));
        // -----------------------------
      } catch (err) {
        console.error("Error fetching revenue data:", err);
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
        const cartStatsResponse = await api.get("/users/stats/carts");
        cartStatistics = cartStatsResponse.data || cartStatistics;
        setCartStats(cartStatistics);
        setDailyStats(prev => ({
            ...prev,
            activeCarts: cartStatistics.activeCarts || 0
        }));
      } catch (err) {
        console.error("Error fetching cart statistics:", err);
      }

      setStats({
        franchises: {
          title: "Active Franchises",
          value: activeFranchises.length.toString(),
          icon: FaBuilding,
          color: "bg-blue-500",
          loading: false,
        },
        users: {
          title: "Total Users",
          value: users.length.toString(),
          icon: FaUsers,
          color: "bg-green-500",
          loading: false,
        },
        revenue: {
          title: "Total Revenue",
          value: `₹${totalRevenue.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          icon: FaRupeeSign,
          color: "bg-yellow-500",
          loading: false,
        },
        orders: {
          title: "Total Orders",
          value: totalOrdersCount.toString(),
          icon: FaChartLine,
          color: "bg-purple-500",
          loading: false,
        },
      });

      setRecentUsers(recent);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const statsArray = Object.values(stats);
  const statRoutes = ["/franchises", "/users", "/revenue-history", "/orders"];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome to Super Admin Portal
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statsArray.map((stat, index) => {
          const Icon = stat.icon;
          const route = statRoutes[index] || "/dashboard";
          return (
            <Link
              key={index}
              to={route}
              className="block focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-offset-2 rounded-xl"
            >
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-500 font-medium">
                      {stat.title}
                    </p>
                    {stat.loading ? (
                      <div className="mt-2">
                        <FaSpinner className="animate-spin text-[#ff6b35]" />
                      </div>
                    ) : (
                      <>
                        <p className="text-3xl font-bold text-gray-900 mt-2 truncate">
                          {stat.value}
                        </p>
                        {/* Trend indicator */}
                        <div className="flex items-center mt-2 text-xs">
                          {index === 2 && ( // Revenue card
                            <span className="flex items-center text-green-600">
                              <FaArrowUp className="mr-1" />
                              +12.5% from last month
                            </span>
                          )}
                          {index === 3 && ( // Orders card
                            <span className="flex items-center text-green-600">
                              <FaArrowUp className="mr-1" />
                              +8.3% from last month
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="bg-[#ff6b35] p-3 rounded-lg flex-shrink-0 ml-4 group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Cart Statistics Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Cart Statistics
        </h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <FaSpinner className="animate-spin text-gray-400 text-2xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 font-medium">
                  Total Carts
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {cartStats.totalCarts}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-700 font-medium">
                  Active Carts
                </p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {cartStats.activeCarts}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-orange-700 font-medium">
                  Inactive Carts
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {cartStats.inactiveCarts}
                </p>
              </div>
              <div className="bg-pink-50 p-4 rounded-lg">
                <p className="text-sm text-pink-700 font-medium">
                  Pending Approval
                </p>
                <p className="text-3xl font-bold text-pink-600 mt-2">
                  {cartStats.pendingApproval}
                </p>
              </div>
            </div>

            {/* Franchise-wise Statistics */}
            {cartStats.franchiseStats &&
              cartStats.franchiseStats.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Carts by Franchise
                  </h3>
                  <div className="overflow-x-auto">
                    <div className="inline-block min-w-full align-middle">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Franchise
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Carts
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Active
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Inactive
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Pending
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {cartStats.franchiseStats.map((franchise) => (
                            <tr
                              key={franchise.franchiseId}
                              className="hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => {
                                window.location.href = "/franchises";
                              }}
                            >
                              <td className="px-6 py-4 text-sm font-medium text-[#ff6b35]">
                                {franchise.franchiseName}
                              </td>
                              <td className="px-6 py-4 text-sm text-center text-gray-900">
                                {franchise.totalCarts}
                              </td>
                              <td className="px-6 py-4 text-sm text-center">
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  {franchise.activeCarts}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-center">
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                  {franchise.inactiveCarts}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-center">
                                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
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

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">Today's Revenue</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                ₹{dailyStats.todayRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <FaChartLine className="w-8 h-8 text-blue-600 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 font-medium">Active Carts</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{dailyStats.activeCarts}</p>
            </div>
            <FaBuilding className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-700 font-medium">Avg Order Value</p>
              <p className="text-2xl font-bold text-purple-900 mt-1">
                ₹{dailyStats.avgOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <FaRupeeSign className="w-8 h-8 text-purple-600 opacity-50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Recent Users
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin text-[#d86d2a] text-2xl" />
            </div>
          ) : recentUsers.length > 0 ? (
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <div className="w-10 h-10 bg-[#ff6b35] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {user.role === 'franchise_admin' ? 'Franchise' : user.role === 'admin' ? 'Cart' : 'User'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#6b4423] text-center py-4">No users yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              to="/franchises"
              className="flex items-center justify-between w-full px-4 py-3 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff5722] transition-all shadow-sm hover:shadow-md group"
            >
              <div className="flex items-center space-x-3">
                <FaBuilding className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Manage Franchises</p>
                  <p className="text-xs opacity-90">View and manage all franchises</p>
                </div>
              </div>
              <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/users"
              className="flex items-center justify-between w-full px-4 py-3 bg-[#ff6b35] text-white rounded-lg hover:bg-[#ff5722] transition-all shadow-sm hover:shadow-md group"
            >
              <div className="flex items-center space-x-3">
                <FaUsers className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Manage Users</p>
                  <p className="text-xs opacity-90">Add or edit administrative users</p>
                </div>
              </div>
              <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/revenue-history"
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all shadow-sm hover:shadow-md group"
            >
              <div className="flex items-center space-x-3">
                <FaChartBar className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold text-sm">Revenue History</p>
                  <p className="text-xs opacity-90">View detailed revenue reports</p>
                </div>
              </div>
              <FaArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
