import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

// Revenue Timeline Graph Component
const RevenueTimeline = ({ orders }) => {
    const data = useMemo(() => {
        // Create array for 24 hours
        const hours = Array.from({ length: 24 }, (_, i) => ({
            name: i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i-12} PM` : `${i} AM`,
            hour: i,
            revenue: 0
        }));

        orders.forEach(o => {
            if (!o.createdAt) return;
            // Only count PAID orders for revenue
            if (o.status !== 'Paid') return;

            const hour = new Date(o.createdAt).getHours();
            if (hours[hour]) {
                const orderTotal = o.kotLines?.reduce((sum, kot) => sum + (Number(kot.totalAmount) || 0), 0) || 0;
                hours[hour].revenue += orderTotal;
            }
        });

        // Show typical operating hours (e.g. 8 AM to 11 PM) + any outlier hours if they have data
        const startHour = 8;
        const endHour = 23;
        
        return hours.filter(h => (h.hour >= startHour && h.hour <= endHour) || h.revenue > 0);
    }, [orders]);

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-full flex flex-col">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Timeline (Today)</h3>
            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0e6dd" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#8b5e3c'}} 
                            interval="preserveStartEnd"
                            minTickGap={20}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#8b5e3c'}} 
                            allowDecimals={false}
                            tickFormatter={(value) => `₹${value}`}
                        />
                        <Tooltip 
                            formatter={(value) => [`₹${value.toLocaleString()}`, "Revenue"]}
                            contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2c1ac'}}
                            itemStyle={{color: '#15803d'}}
                            labelStyle={{color: '#4a2e1f', fontWeight: 'bold'}}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="#16a34a" 
                            fillOpacity={1} 
                            fill="url(#colorRevenue)" 
                            strokeWidth={2}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

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

  const isFetchingRef = useRef(false);

  const updateRevenue = (ordersData) => {
    // Super admin aggregates revenue from ACTIVE franchises only
    if (!Array.isArray(ordersData)) {
      return { revenue: "₹0.00", ordersCount: "0" };
    }
    const paidOrders = ordersData.filter(
      (order) => order && order.status === "Paid"
    );

    const totalRevenue = paidOrders.reduce((sum, order) => {
      if (!order?.kotLines || !Array.isArray(order.kotLines)) return sum;
      return sum + order.kotLines.reduce((kotSum, kot) => kotSum + Number(kot.totalAmount || 0), 0);
    }, 0);

    const safeTotalRevenue = Number(totalRevenue || 0);
    return {
      revenue: `₹${safeTotalRevenue.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      ordersCount: ordersData.length.toString()
    };
  };

  useEffect(() => {
    fetchDashboardData(true); // Initial load with spinner
  }, []); // Only run once on mount

  // Stringify activeFranchiseIds for use in useEffect dependency to avoid ref-equality issues with Set
  const activeFranchiseIdsStr = Array.from(activeFranchiseIds).sort().join(',');

  useEffect(() => {
    // HTTP polling for real-time updates (replaces Socket.IO)
    // Poll orders every 12 seconds to check for new/updated orders and payments
    const pollingInterval = setInterval(async () => {
      try {
        // Fetch dashboard data in the background (no spinner)
        fetchDashboardData(false);
      } catch (err) {
        // Silently fail polling - don't spam console
        if (import.meta.env.DEV) {
          console.error("Failed to poll orders:", err);
        }
      }
    }, 60000); // 60 seconds polling interval

    return () => {
      clearInterval(pollingInterval);
    };
  }, [activeFranchiseIdsStr]); // Re-run only if the actual IDs change

  const fetchDashboardData = async (showLoading = false) => {
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      if (showLoading) setLoading(true);

      // Fetch basic data in parallel
      const [usersRes, cartStatsRes] = await Promise.all([
        api.get("/users").catch(() => ({ data: [] })),
        api.get("/users/stats/carts").catch(() => null)
      ]);

      const users = usersRes.data || [];
      const activeFranchises = users.filter((u) => u.role === "franchise_admin" && u.isActive !== false);

      // Get active franchise IDs for filtering orders
      const activeFranchiseIdsSet = new Set(
        activeFranchises.filter((f) => f && f._id).map((f) => f._id.toString())
      );
      
      const newIdsArray = Array.from(activeFranchiseIdsSet).sort();
      const newIdsStr = newIdsArray.join(",");
      const currentIdsStr = Array.from(activeFranchiseIds).sort().join(",");

      if (newIdsStr !== currentIdsStr) {
        setActiveFranchiseIds(activeFranchiseIdsSet);
      }

      // Fetch revenue and orders
      let totalRevenue = 0;
      let totalOrdersCount = 0;
      let fetchedOrders = [];

      try {
        const revenueResponse = await api.get("/revenue/current");
        if (revenueResponse.data?.success && revenueResponse.data?.data) {
          totalRevenue = revenueResponse.data.data.totalRevenue || 0;
          totalOrdersCount = revenueResponse.data.data.totalOrders || 0;
        }
      } catch (e) { /* ignore */ }

      try {
        const ordersResponse = await api.get("/orders");
        fetchedOrders = ordersResponse.data || [];
      } catch (e) { /* ignore */ }

      // Filter orders to only include those from ACTIVE franchises
      const activeOrders = fetchedOrders.filter((order) => {
        if (!order) return false;
        const franchiseId = order.franchiseId?.toString() || order.franchiseId;
        return franchiseId && activeFranchiseIdsSet.has(franchiseId);
      });

      // Recalculate if needed
      const revenueInfo = updateRevenue(activeOrders);
      if (totalRevenue === 0) {
        totalRevenue = activeOrders.filter(o => o.status === 'Paid').reduce((sum, order) => {
           if (!order.kotLines) return sum;
           return sum + order.kotLines.reduce((kSum, k) => kSum + Number(k.totalAmount || 0), 0);
        }, 0);
        totalOrdersCount = activeOrders.length;
      }

      // Daily Stats
      const todayStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      const todayOrders = activeOrders.filter(order => {
        if (!order.createdAt) return false;
        const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
        return orderDate === todayStr && order.status === 'Paid'; // Filter for PAID orders
      });

      const todayRev = todayOrders.reduce((sum, order) => {
        if (!order.kotLines) return sum;
        return sum + order.kotLines.reduce((kSum, k) => kSum + Number(k.totalAmount || 0), 0);
      }, 0);

      const avgVal = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount) : 0;

      // Cart Stats
      const cartStatistics = cartStatsRes?.data || {
        totalCarts: 0,
        activeCarts: 0,
        inactiveCarts: 0,
        pendingApproval: 0,
        franchiseStats: [],
      };

      // State Updates (mostly batched)
      setOrders(activeOrders);
      
      setDailyStats({
        todayRevenue: todayRev,
        avgOrderValue: avgVal,
        activeCarts: cartStatistics.activeCarts || 0
      });

      setCartStats(prev => {
        // Simple stability check for cartStats to prevent re-render if data is identical
        const prevStr = JSON.stringify(prev);
        const nextStr = JSON.stringify(cartStatistics);
        return prevStr === nextStr ? prev : cartStatistics;
      });

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

      setRecentUsers(users
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      isFetchingRef.current = false;
      if (showLoading) setLoading(false);
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

      {/* Revenue Timeline Graph - Replaces Orders Timeline */}
      <div className="h-[400px]">
        <RevenueTimeline orders={orders} />
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
