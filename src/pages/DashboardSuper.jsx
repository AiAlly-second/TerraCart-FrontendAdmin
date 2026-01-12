import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FaBuilding,
  FaUsers,
  FaRupeeSign,
  FaChartLine,
  FaSpinner,
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
        updateRevenue(activeOrders);
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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#4a2e1f]">
          Dashboard
        </h1>
        <p className="text-sm md:text-base text-[#6b4423] mt-1 md:mt-2">
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
              <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 sm:p-6 hover:shadow-lg hover:border-[#d86d2a] transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm text-[#6b4423]">
                      {stat.title}
                    </p>
                    {stat.loading ? (
                      <div className="mt-2">
                        <FaSpinner className="animate-spin text-[#d86d2a]" />
                      </div>
                    ) : (
                      <p className="text-xl sm:text-2xl font-bold text-[#4a2e1f] mt-2 truncate">
                        {stat.value}
                      </p>
                    )}
                  </div>
                  <div className="bg-[#d86d2a] p-2 sm:p-3 rounded-lg flex-shrink-0 ml-2">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Cart Statistics Section */}
      <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-semibold text-[#4a2e1f] mb-3 md:mb-4">
          Cart Statistics
        </h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <FaSpinner className="animate-spin text-gray-400 text-2xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              <Link
                to="/carts"
                className="block focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-offset-2 rounded-lg"
              >
                <div className="bg-[#f5e3d5] border border-[#e2c1ac] p-3 md:p-4 rounded-lg hover:border-[#d86d2a] hover:shadow-md cursor-pointer">
                  <p className="text-xs md:text-sm text-[#6b4423]">
                    Total Carts
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-[#4a2e1f]">
                    {cartStats.totalCarts}
                  </p>
                </div>
              </Link>
              <Link
                to="/carts"
                className="block focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-offset-2 rounded-lg"
              >
                <div className="bg-green-50 border border-green-200 p-3 md:p-4 rounded-lg hover:border-green-500 hover:shadow-md cursor-pointer">
                  <p className="text-xs md:text-sm text-green-700">
                    Active Carts
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-green-600">
                    {cartStats.activeCarts}
                  </p>
                </div>
              </Link>
              <Link
                to="/carts"
                className="block focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-offset-2 rounded-lg"
              >
                <div className="bg-red-50 border border-red-200 p-3 md:p-4 rounded-lg hover:border-red-500 hover:shadow-md cursor-pointer">
                  <p className="text-xs md:text-sm text-red-700">
                    Inactive Carts
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-red-600">
                    {cartStats.inactiveCarts}
                  </p>
                </div>
              </Link>
              <Link
                to="/carts"
                className="block focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-offset-2 rounded-lg"
              >
                <div className="bg-yellow-50 border border-yellow-200 p-3 md:p-4 rounded-lg hover:border-yellow-500 hover:shadow-md cursor-pointer">
                  <p className="text-xs md:text-sm text-yellow-700">
                    Pending Approval
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-yellow-600">
                    {cartStats.pendingApproval}
                  </p>
                </div>
              </Link>
            </div>

            {/* Franchise-wise Statistics */}
            {cartStats.franchiseStats &&
              cartStats.franchiseStats.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-[#4a2e1f] mb-3">
                    Carts by Franchise
                  </h3>
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 md:px-0">
                      <table className="min-w-full divide-y divide-[#e2c1ac]">
                        <thead className="bg-[#f5e3d5]">
                          <tr>
                            <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                              Franchise
                            </th>
                            <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">
                              Total Carts
                            </th>
                            <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">
                              Active
                            </th>
                            <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">
                              Inactive
                            </th>
                            <th className="px-3 md:px-4 py-2 md:py-3 text-center text-xs font-medium text-[#4a2e1f] uppercase">
                              Pending
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-[#e2c1ac]">
                          {cartStats.franchiseStats.map((franchise) => (
                            <tr
                              key={franchise.franchiseId}
                              className="hover:bg-[#fef4ec] transition-colors cursor-pointer"
                              onClick={() => {
                                window.location.href = "/franchises";
                              }}
                            >
                              <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-[#4a2e1f] underline">
                                {franchise.franchiseName}
                              </td>
                              <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-center text-[#6b4423]">
                                {franchise.totalCarts}
                              </td>
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
          <h2 className="text-lg md:text-xl font-semibold text-[#4a2e1f] mb-3 md:mb-4">
            Recent Users
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <FaSpinner className="animate-spin text-[#d86d2a] text-2xl" />
            </div>
          ) : recentUsers.length > 0 ? (
            <div className="space-y-4">
              {recentUsers.map((user) => (
                <div
                  key={user._id}
                  className="border-l-4 border-[#d86d2a] pl-4"
                >
                  <p className="text-sm font-medium text-[#4a2e1f]">
                    {user.name}
                  </p>
                  <p className="text-xs text-[#6b4423] mt-1">
                    {user.email} • {user.role}
                  </p>
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
          <h2 className="text-lg md:text-xl font-semibold text-[#4a2e1f] mb-3 md:mb-4">
            Quick Actions
          </h2>
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
