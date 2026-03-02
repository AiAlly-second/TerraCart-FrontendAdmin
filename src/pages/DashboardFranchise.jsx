import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import {
  FaBolt,
  FaBoxOpen,
  FaBuilding,
  FaCheck,
  FaCheckCircle,
  FaClipboardList,
  FaClock,
  FaCopy,
  FaMoneyBillWave,
  FaStore,
  FaSyncAlt,
  FaTimesCircle,
  FaWallet,
} from "react-icons/fa";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
// Removed socket import - using HTTP polling instead

const REVENUE_FILTER_OPTIONS = [
  { key: "DAILY", label: "Daily" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "YEARLY", label: "Yearly" },
];

const StatCard = ({
  title,
  value,
  icon,
  onClick,
  clickable = false,
  subtitle,
  color = "default",
}) => {
  const colorClasses = {
    default: {
      card: "border-[#e2c1ac] bg-gradient-to-br from-white to-[#fff8f2]",
      icon: "bg-[#fef4ec] text-[#a85b2e]",
    },
    green: {
      card: "border-emerald-200 bg-gradient-to-br from-white to-emerald-50",
      icon: "bg-emerald-100 text-emerald-700",
    },
    red: {
      card: "border-rose-200 bg-gradient-to-br from-white to-rose-50",
      icon: "bg-rose-100 text-rose-700",
    },
    yellow: {
      card: "border-amber-200 bg-gradient-to-br from-white to-amber-50",
      icon: "bg-amber-100 text-amber-700",
    },
    blue: {
      card: "border-sky-200 bg-gradient-to-br from-white to-sky-50",
      icon: "bg-sky-100 text-sky-700",
    },
  };
  const theme = colorClasses[color] || colorClasses.default;

  return (
    <div
      onClick={onClick}
      className={`p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl shadow-sm border ${
        theme.card
      } flex flex-col justify-between h-full ${
        clickable
          ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
          : ""
      }`}
    >
      <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${theme.icon}`}
        >
          <span className="text-base sm:text-lg md:text-xl">{icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs md:text-sm font-medium text-[#6b4423] truncate">
            {title}
          </p>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-[#4a2e1f] truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-[9px] sm:text-[10px] md:text-xs text-[#6b4423] mt-0.5 sm:mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalCarts: 0,
    activeCarts: 0,
    inactiveCarts: 0,
    pendingApproval: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    todayOrders: 0,
    totalOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentCarts, setRecentCarts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cartOrderStats, setCartOrderStats] = useState([]);
  const [revenueFilter, setRevenueFilter] = useState("DAILY");

  const franchiseName = user?.name || "Franchise Dashboard";

  const calculateRevenue = (ordersData) => {
    if (!Array.isArray(ordersData)) {
      return {
        totalRevenue: 0,
        todayRevenue: 0,
        todayOrders: 0,
        totalOrders: 0,
      };
    }

    if (import.meta.env.DEV) {
      console.log(
        "[Dashboard] Calculating revenue from",
        ordersData.length,
        "orders"
      );
    }

    const paidOrders = (ordersData || []).filter(
      (order) => order && order.status === "Paid"
    );
    if (import.meta.env.DEV) {
      console.log("[Dashboard] Paid orders:", paidOrders.length);
    }

    const totalRevenue = paidOrders.reduce((sum, order) => {
      if (
        !order ||
        !order.kotLines ||
        !Array.isArray(order.kotLines) ||
        order.kotLines.length === 0
      ) {
        return sum;
      }
      const orderTotal = order.kotLines.reduce((kotSum, kot) => {
        if (!kot) return kotSum;
        return kotSum + Number(kot.totalAmount || 0);
      }, 0);
      return sum + orderTotal;
    }, 0);

    // Calculate today's orders (all statuses, not just paid)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAllOrders = (ordersData || []).filter((order) => {
      if (!order || !order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    if (import.meta.env.DEV) {
      console.log("[Dashboard] Today's orders (all):", todayAllOrders.length);
    }

    // Today's revenue (only from paid orders today)
    const todayPaidOrders = todayAllOrders.filter((o) => o.status === "Paid");
    const todayRevenue = todayPaidOrders.reduce((sum, order) => {
      if (!order.kotLines || !Array.isArray(order.kotLines)) return sum;
      return (
        sum +
        order.kotLines.reduce(
          (kotSum, kot) => kotSum + Number(kot.totalAmount || 0),
          0
        )
      );
    }, 0);

    return {
      totalRevenue,
      todayRevenue,
      todayOrders: todayAllOrders.length,
      totalPaidOrders: paidOrders.length,
    };
  };

  useEffect(() => {
    if (!user || !user._id) return;

    fetchDashboardData();

    // HTTP polling for real-time updates (replaces Socket.IO)
    // Poll dashboard data every 60 seconds to check for new/updated orders and payments
    const pollingInterval = setInterval(() => {
      fetchDashboardData();
    }, 60000); // 60 seconds polling interval

    return () => {
      clearInterval(pollingInterval);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Don't set loading to true for background polling to avoid UI flickering
      // Only set for initial load or manual refresh if desired, but here we just update data
      // setLoading(true); 

      // Fetch cart statistics
      let cartStats = {
        totalCarts: 0,
        activeCarts: 0,
        inactiveCarts: 0,
        pendingApproval: 0,
      };

      try {
        const cartStatsResponse = await api.get("/users/stats/carts");
        cartStats = cartStatsResponse.data || cartStats;
      } catch (err) {
        console.error("Error fetching cart statistics:", err);
      }

      // Fetch carts for recent list
      let allCarts = [];
      try {
        const usersResponse = await api.get("/users");
        allCarts = (usersResponse.data || []).filter((u) => u.role === "admin");
      } catch (err) {
        console.error("Error fetching users:", err);
      }

      // Fetch orders
      let fetchedOrders = [];
      let revenueData = { totalRevenue: 0, todayRevenue: 0, todayOrders: 0 };
      try {
        const ordersResponse = await api.get("/orders");
        fetchedOrders = ordersResponse.data || [];
        setOrders(fetchedOrders);
        revenueData = calculateRevenue(fetchedOrders);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
      }

      // Build recent carts list with proper status
      const recent = allCarts
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map((cart) => {
          let status = "Active";
          let statusColor = "green";

          if (!cart.isApproved) {
            status = "Pending";
            statusColor = "yellow";
          } else if (cart.isActive === false) {
            status = "Inactive";
            statusColor = "red";
          }

          return {
            id: cart._id,
            name: cart.cartName || cart.cafeName || cart.name || "Unnamed Cart",
            managerName: cart.name,
            email: cart.email,
            location: cart.location || "Not specified",
            createdAt: cart.createdAt,
            status,
            statusColor,
            cartCode: cart.cartCode,
          };
        });

      const newStats = {
        totalCarts: cartStats.totalCarts || allCarts.length,
        activeCarts: cartStats.activeCarts || 0,
        inactiveCarts: cartStats.inactiveCarts || 0,
        pendingApproval: cartStats.pendingApproval || 0,
        totalRevenue: revenueData.totalRevenue,
        todayRevenue: revenueData.todayRevenue,
        todayOrders: revenueData.todayOrders,
        totalOrders: fetchedOrders.length,
      };
      setStats(newStats);
      setRecentCarts(recent);

      // Calculate orders per cart
      const cartOrderMap = {};
      allCarts.forEach((cart) => {
        cartOrderMap[cart._id] = {
          cartId: cart._id,
          cartName: cart.cartName || cart.cafeName || cart.name,
          cartCode: cart.cartCode,
          orders: 0,
          revenue: 0,
          todayOrders: 0,
        };
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      fetchedOrders.forEach((order) => {
        const cartId = order.cartId?.toString() || order.cartId;
        if (cartId && cartOrderMap[cartId]) {
          cartOrderMap[cartId].orders++;

          // Check if today's order
          const orderDate = new Date(order.createdAt);
          orderDate.setHours(0, 0, 0, 0);
          if (orderDate.getTime() === today.getTime()) {
            cartOrderMap[cartId].todayOrders++;
          }

          // Add revenue if paid
          if (order.status === "Paid" && order.kotLines) {
            const orderTotal = order.kotLines.reduce(
              (sum, kot) => sum + Number(kot.totalAmount || 0),
              0
            );
            cartOrderMap[cartId].revenue += orderTotal;
          }
        }
      });

      const cartStats2 = Object.values(cartOrderMap).sort(
        (a, b) => b.orders - a.orders
      );
      setCartOrderStats(cartStats2);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      // Only set loading false if it was true (initial load)
      setLoading(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Franchise identification - prefer franchiseCode, fallback to shortened ID
  const franchiseCode = user?.franchiseCode || null;
  const franchiseShortcut = user?.franchiseShortcut || null;
  const franchiseId = user?._id || "";

  // Generate display ID: Use franchiseCode if available, otherwise create a readable format
  const getDisplayId = () => {
    if (franchiseCode) {
      return franchiseCode; // e.g., "MAH001"
    }
    if (franchiseId) {
      // Create a more readable format from MongoDB ObjectId
      // Use last 6 chars in uppercase
      return `ID-${franchiseId.slice(-6).toUpperCase()}`;
    }
    return "Loading...";
  };

  const copyToClipboard = () => {
    const textToCopy = franchiseCode || franchiseId;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate franchise code if not exists
  const generateFranchiseCode = async () => {
    if (franchiseCode || !franchiseId) return;

    try {
      setGeneratingCode(true);
      const response = await api.post("/users/generate-franchise-code");
      if (response.data?.franchiseCode) {
        // Update local storage with new code
        const updatedUser = {
          ...user,
          franchiseCode: response.data.franchiseCode,
          franchiseShortcut: response.data.franchiseShortcut,
        };
        localStorage.setItem("franchiseAdminUser", JSON.stringify(updatedUser));
        // Reload page to reflect changes
        window.location.reload();
      }
    } catch (error) {
      console.error("Error generating franchise code:", error);
      alert("Failed to generate franchise code. Please contact support.");
    } finally {
      setGeneratingCode(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getOrderTotal = (order) => {
    if (!order?.kotLines || !Array.isArray(order.kotLines)) return 0;
    return order.kotLines.reduce(
      (sum, kot) => sum + Number(kot?.totalAmount || 0),
      0
    );
  };

  const formatCompactCurrency = (value) => {
    const amount = Number(value || 0);
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount.toFixed(0)}`;
  };

  const revenueTrend = useMemo(() => {
    const localDateKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    const monthKey = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const paidOrders = (orders || []).filter(
      (order) => order?.status === "Paid" && order?.createdAt
    );
    const now = new Date();
    let buckets = [];
    const indexByKey = new Map();

    if (revenueFilter === "DAILY") {
      for (let i = 23; i >= 0; i--) {
        const slotDate = new Date(now.getTime() - i * 60 * 60 * 1000);
        slotDate.setMinutes(0, 0, 0);
        const key = slotDate.getTime();
        buckets.push({
          key,
          label: slotDate.toLocaleTimeString("en-IN", {
            hour: "numeric",
          }),
          revenue: 0,
          orders: 0,
        });
        indexByKey.set(key, buckets.length - 1);
      }
      paidOrders.forEach((order) => {
        const orderDate = new Date(order.createdAt);
        orderDate.setMinutes(0, 0, 0);
        const bucketIndex = indexByKey.get(orderDate.getTime());
        if (bucketIndex !== undefined) {
          buckets[bucketIndex].revenue += getOrderTotal(order);
          buckets[bucketIndex].orders += 1;
        }
      });
    } else if (revenueFilter === "MONTHLY") {
      for (let i = 29; i >= 0; i--) {
        const slotDate = new Date(now);
        slotDate.setHours(0, 0, 0, 0);
        slotDate.setDate(now.getDate() - i);
        const key = localDateKey(slotDate);
        buckets.push({
          key,
          label: slotDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          }),
          revenue: 0,
          orders: 0,
        });
        indexByKey.set(key, buckets.length - 1);
      }
      paidOrders.forEach((order) => {
        const orderDate = new Date(order.createdAt);
        const bucketIndex = indexByKey.get(localDateKey(orderDate));
        if (bucketIndex !== undefined) {
          buckets[bucketIndex].revenue += getOrderTotal(order);
          buckets[bucketIndex].orders += 1;
        }
      });
    } else {
      for (let i = 11; i >= 0; i--) {
        const slotDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = monthKey(slotDate);
        buckets.push({
          key,
          label: slotDate.toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
          }),
          revenue: 0,
          orders: 0,
        });
        indexByKey.set(key, buckets.length - 1);
      }
      paidOrders.forEach((order) => {
        const orderDate = new Date(order.createdAt);
        const bucketIndex = indexByKey.get(monthKey(orderDate));
        if (bucketIndex !== undefined) {
          buckets[bucketIndex].revenue += getOrderTotal(order);
          buckets[bucketIndex].orders += 1;
        }
      });
    }

    const totalRevenue = buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
    const paidOrdersCount = buckets.reduce((sum, bucket) => sum + bucket.orders, 0);

    return {
      points: buckets.map((bucket) => ({
        label: bucket.label,
        revenue: Number(bucket.revenue.toFixed(2)),
        orders: bucket.orders,
      })),
      totalRevenue,
      paidOrdersCount,
      averageOrderValue:
        paidOrdersCount > 0 ? totalRevenue / paidOrdersCount : 0,
    };
  }, [orders, revenueFilter]);

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#4a2e1f] truncate">
          {franchiseName} Dashboard
        </h1>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              fetchDashboardData();
            }}
            className="p-2 sm:px-4 sm:py-2 bg-white border border-[#e2c1ac] text-[#8b5e3c] rounded-lg hover:bg-[#fef4ec] transition-colors flex items-center gap-2 shadow-sm"
            title="Refresh Data"
          >
            <FaSyncAlt className={`text-sm sm:text-base ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-sm font-medium">Refresh</span>
          </button>

          {/* Franchise ID Quick Access */}
          <div className="flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-[#4a2e1f] to-[#6b4423] rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 shadow-lg">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FaBuilding className="text-sm sm:text-base md:text-lg text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] sm:text-[10px] md:text-xs text-white/70 font-medium">
                  {franchiseCode ? "Franchise Code" : "Franchise ID"}
                </p>
                <span
                  className={`font-mono font-bold text-white tracking-wider block truncate ${
                    franchiseCode
                      ? "text-xs sm:text-sm md:text-xl"
                      : "text-[10px] sm:text-xs md:text-base"
                  }`}
                >
                  {getDisplayId()}
                </span>
                {!franchiseCode && franchiseId && (
                  <p className="text-[10px] text-yellow-300/80 mt-0.5">
                    Legacy ID format
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              {!franchiseCode && franchiseId && (
                <button
                  onClick={generateFranchiseCode}
                  disabled={generatingCode}
                  className="px-2 md:px-3 py-1 md:py-2 bg-yellow-500/80 hover:bg-yellow-500 text-white rounded-lg transition-colors text-[10px] md:text-xs font-semibold whitespace-nowrap"
                  title="Generate a proper franchise code"
                >
                  {generatingCode ? (
                    "..."
                  ) : (
                    <>
                      <span className="hidden sm:inline-flex items-center gap-1">
                        <FaBolt className="text-[10px]" />
                        Generate Code
                      </span>
                      <span className="sm:hidden">
                        <FaBolt className="text-[10px]" />
                      </span>
                    </>
                  )}
                </button>
              )}
              <button
                onClick={copyToClipboard}
                className="px-2 md:px-3 py-1 md:py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-[10px] md:text-xs font-semibold whitespace-nowrap border border-white/30"
                disabled={!franchiseCode && !franchiseId}
                title="Copy Franchise ID"
              >
                {copied ? <FaCheck /> : <FaCopy />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <StatCard
          title="Total Carts"
          value={loading ? "..." : stats.totalCarts.toString()}
          icon={<FaStore />}
          clickable
          onClick={() => navigate("/carts")}
          color="blue"
        />
        <StatCard
          title="Active Carts"
          value={loading ? "..." : stats.activeCarts.toString()}
          icon={<FaCheckCircle />}
          clickable
          onClick={() => navigate("/carts?filter=active")}
          color="green"
        />
        <StatCard
          title="Inactive Carts"
          value={loading ? "..." : stats.inactiveCarts.toString()}
          icon={<FaTimesCircle />}
          clickable
          onClick={() => navigate("/carts?filter=inactive")}
          color="red"
        />
        <StatCard
          title="Pending Approval"
          value={loading ? "..." : stats.pendingApproval.toString()}
          icon={<FaClock />}
          clickable
          onClick={() => navigate("/carts?filter=pending")}
          color="yellow"
        />
      </div>

      {/* Revenue & Orders Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <StatCard
          title="Today's Revenue"
          value={loading ? "..." : formatCurrency(stats.todayRevenue)}
          icon={<FaMoneyBillWave />}
          subtitle="From paid orders today"
        />
        <StatCard
          title="Total Revenue"
          value={loading ? "..." : formatCurrency(stats.totalRevenue)}
          icon={<FaWallet />}
          subtitle="All time"
        />
        <StatCard
          title="Today's Orders"
          value={loading ? "..." : stats.todayOrders.toString()}
          icon={<FaBoxOpen />}
          clickable
          onClick={() => navigate("/orders")}
        />
        <StatCard
          title="Total Orders"
          value={loading ? "..." : stats.totalOrders.toString()}
          icon={<FaClipboardList />}
          clickable
          onClick={() => navigate("/orders")}
        />
      </div>

      {/* Revenue Trend */}
      <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-6 mb-4 md:mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg lg:text-xl font-bold text-[#4a2e1f]">
              Revenue Trend
            </h2>
            <p className="text-xs md:text-sm text-[#6b4423]">
              Paid revenue view by {revenueFilter.toLowerCase()} period
            </p>
          </div>
          <div className="inline-flex items-center rounded-lg border border-[#e2c1ac] bg-[#fef4ec] p-1 self-start md:self-auto">
            {REVENUE_FILTER_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setRevenueFilter(option.key)}
                className={`px-3 py-1.5 text-xs md:text-sm font-semibold rounded-md transition-colors ${
                  revenueFilter === option.key
                    ? "bg-[#d86d2a] text-white shadow-sm"
                    : "text-[#8b5e3c] hover:bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 h-72">
          {revenueTrend.points.some((point) => point.revenue > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueTrend.points}
                margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="franchiseRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d86d2a" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#d86d2a" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f2ddcf" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#8b5e3c" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8b5e3c" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCompactCurrency}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value || 0)), "Revenue"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2c1ac",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#d86d2a"
                  fill="url(#franchiseRevenueFill)"
                  strokeWidth={2.5}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-[#e2c1ac] text-[#8b5e3c] text-sm">
              No paid revenue data available for this period.
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[#e2c1ac] bg-[#fff8f3] p-3">
            <p className="text-[11px] uppercase tracking-wide text-[#8b5e3c]">
              Period Revenue
            </p>
            <p className="text-lg font-bold text-[#4a2e1f] mt-1">
              {formatCurrency(revenueTrend.totalRevenue)}
            </p>
          </div>
          <div className="rounded-lg border border-[#e2c1ac] bg-[#fff8f3] p-3">
            <p className="text-[11px] uppercase tracking-wide text-[#8b5e3c]">
              Paid Orders
            </p>
            <p className="text-lg font-bold text-[#4a2e1f] mt-1">
              {revenueTrend.paidOrdersCount.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-lg border border-[#e2c1ac] bg-[#fff8f3] p-3">
            <p className="text-[11px] uppercase tracking-wide text-[#8b5e3c]">
              Avg. Order Value
            </p>
            <p className="text-lg font-bold text-[#4a2e1f] mt-1">
              {formatCurrency(revenueTrend.averageOrderValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Cart-wise Orders Breakdown */}
      {cartOrderStats.length > 0 && (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-md border border-[#e2c1ac] p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
          <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-[#4a2e1f] mb-2 sm:mb-3 md:mb-4">
            Orders by Cart
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            {cartOrderStats.map((cart) => (
              <div
                key={cart.cartId}
                className="bg-[#fef4ec] rounded-lg p-3 sm:p-4 border border-[#e2c1ac] hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                    {cart.cartCode && (
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded flex-shrink-0">
                        {cart.cartCode}
                      </span>
                    )}
                    <span className="font-medium text-xs sm:text-sm text-[#4a2e1f] truncate">
                      {cart.cartName}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center mt-2 sm:mt-3">
                  <div className="bg-white rounded p-1.5 sm:p-2">
                    <p className="text-[9px] sm:text-xs text-[#6b4423]">Today</p>
                    <p className="text-sm sm:text-base md:text-lg font-bold text-[#4a2e1f]">
                      {cart.todayOrders}
                    </p>
                  </div>
                  <div className="bg-white rounded p-1.5 sm:p-2">
                    <p className="text-[9px] sm:text-xs text-[#6b4423]">Total</p>
                    <p className="text-sm sm:text-base md:text-lg font-bold text-[#4a2e1f]">
                      {cart.orders}
                    </p>
                  </div>
                  <div className="bg-white rounded p-1.5 sm:p-2">
                    <p className="text-[9px] sm:text-xs text-[#6b4423]">Revenue</p>
                    <p className="text-[10px] sm:text-xs md:text-sm font-bold text-green-600 truncate">
                      ₹{Number(cart.revenue || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {cartOrderStats.length === 0 && (
            <p className="text-center text-[#6b4423] py-4 text-xs sm:text-sm">
              No carts with orders yet
            </p>
          )}
        </div>
      )}

      {/* Recent Carts */}
      <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="text-base md:text-lg lg:text-xl font-bold text-[#4a2e1f]">
            Recent Carts
          </h2>
          <button
            onClick={() => navigate("/carts")}
            className="text-[#d86d2a] hover:text-[#c75b1a] text-xs md:text-sm font-medium transition-colors"
          >
            <span className="hidden sm:inline">View All</span>
            <span className="sm:hidden">All</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[#6b4423]">Loading...</div>
        ) : recentCarts.length === 0 ? (
          <div className="text-center py-8 text-[#6b4423]">
            <p className="mb-4">
              No carts found. Add your first cart to get started.
            </p>
            <button
              onClick={() => navigate("/carts/new")}
              className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a] transition-colors"
            >
              + Add New Cart
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle px-4 md:px-0">
              <table className="min-w-full">
                <thead className="bg-[#f5e3d5]">
                  <tr>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                      Cart ID
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                      Cart Name
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase hidden sm:table-cell">
                      Manager
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase hidden md:table-cell">
                      Location
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                      Status
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase hidden lg:table-cell">
                      Created
                    </th>
                    <th className="px-2 md:px-4 py-2 md:py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2c1ac]">
                  {recentCarts.map((cart) => (
                    <tr
                      key={cart.id}
                      className="hover:bg-[#fef4ec] transition-colors"
                    >
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        {cart.cartCode ? (
                          <span className="px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded">
                            {cart.cartCode}
                          </span>
                        ) : (
                          <span className="text-[10px] md:text-xs text-gray-400">
                            N/A
                          </span>
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium text-[#4a2e1f]">
                        {cart.name}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-[#6b4423] hidden sm:table-cell">
                        {cart.managerName}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-[#6b4423] hidden md:table-cell">
                        {cart.location}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        <span
                          className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold rounded-full ${
                            cart.statusColor === "green"
                              ? "bg-green-100 text-green-800"
                              : cart.statusColor === "yellow"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {cart.status}
                        </span>
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm text-[#6b4423] hidden lg:table-cell">
                        {new Date(cart.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-2 md:px-4 py-2 md:py-3">
                        <button
                          onClick={() => navigate(`/carts/${cart.id}`)}
                          className="text-[#d86d2a] hover:text-[#c75b1a] text-xs md:text-sm font-medium transition-colors"
                        >
                          <span className="hidden sm:inline">View Details</span>
                          <span className="sm:hidden">View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
