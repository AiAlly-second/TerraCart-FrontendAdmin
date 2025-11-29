import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

// Use Vite environment variable if available, fallback to localhost:5001
const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
const socket = io(nodeApi);

// Reusable Stat Card with equal height and small fonts
const StatCard = ({ title, value, icon, onClick, clickable = false }) => (
  <div
    onClick={onClick}
    className={`p-4 bg-white rounded-xl shadow-md border border-[#e2c1ac] flex flex-col justify-between h-full ${
      clickable ? "cursor-pointer hover:shadow-xl hover:border-[#d86d2a] transition-all" : ""
    }`}
  >
    <div className="flex items-center space-x-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-xs font-medium text-[#6b4423]">{title}</p>
        <p className="text-lg font-semibold text-[#4a2e1f]">{value}</p>
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [todayStats, setTodayStats] = useState({
    revenue: 0,
    totalOrders: 0,
    newCustomers: 0,
  });
  const [staffStats, setStaffStats] = useState({
    activeToday: 0,
    totalStaff: 0,
  });
  const [tableStats, setTableStats] = useState({
    activeTables: 0,
    totalTables: 0,
  });
  const [avgTableTurnaround, setAvgTableTurnaround] = useState("Calculating...");
  const [peakHours, setPeakHours] = useState("Calculating...");

  useEffect(() => {
    // Wait for authentication to complete before fetching orders
    if (authLoading) {
      console.log('[Dashboard] Waiting for authentication...');
      return;
    }

    if (!user) {
      console.log('[Dashboard] No user found, skipping API call');
      return;
    }

    console.log('[Dashboard] User authenticated:', user.email, 'Fetching orders...');
    const token = localStorage.getItem('adminToken');
    console.log('[Dashboard] Token in localStorage:', token ? 'Present' : 'Missing');

    // Fetch initial orders using authenticated API
    api.get("/orders")
      .then((res) => {
        console.log('[Dashboard] Orders fetched successfully:', res.data?.length || 0, 'orders');
        setOrders(res.data);
        updateStats(res.data);
      })
      .catch((error) => {
        console.error("[Dashboard] Error fetching orders:", error);
        console.error("[Dashboard] Error response:", error.response?.data);
        console.error("[Dashboard] Error status:", error.response?.status);
        if (error.response?.status === 401) {
          // Token expired or invalid - will be handled by api interceptor
          console.log("[Dashboard] Authentication failed, redirecting to login...");
        }
      });

    // Fetch staff data
    const fetchStaffData = async () => {
      try {
        // Fetch all employees for this cafe
        const employeesRes = await api.get("/employees");
        const totalStaff = employeesRes.data?.length || 0;

        // Fetch today's attendance
        const attendanceRes = await api.get("/attendance/today");
        const todayAttendance = attendanceRes.data || [];
        
        // Count active staff (those who checked in today and haven't checked out, or status is present/late)
        const activeStaff = todayAttendance.filter(att => {
          // Active if they checked in and haven't checked out, or status is present/late
          return att.checkIn?.time && (!att.checkOut?.time || att.status === 'present' || att.status === 'late');
        }).length;

        setStaffStats({
          activeToday: activeStaff,
          totalStaff: totalStaff,
        });
      } catch (error) {
        console.error("[Dashboard] Error fetching staff data:", error);
        // Set default values on error
        setStaffStats({
          activeToday: 0,
          totalStaff: 0,
        });
      }
    };

    // Fetch table data
    const fetchTableData = async () => {
      try {
        // Fetch all tables for this cafe
        const tablesRes = await api.get("/tables");
        const allTables = tablesRes.data || [];
        const totalTables = allTables.length;
        
        // Count active tables (not AVAILABLE - i.e., OCCUPIED, RESERVED, CLEANING, MERGED)
        const activeTables = allTables.filter(table => 
          table.status !== "AVAILABLE"
        ).length;

        setTableStats({
          activeTables: activeTables,
          totalTables: totalTables,
        });
      } catch (error) {
        console.error("[Dashboard] Error fetching table data:", error);
        // Set default values on error
        setTableStats({
          activeTables: 0,
          totalTables: 0,
        });
      }
    };

    fetchStaffData();
    fetchTableData();
    
    // Refresh staff and table data every 5 minutes
    const dataInterval = setInterval(() => {
      fetchStaffData();
      fetchTableData();
    }, 5 * 60 * 1000);

    // Listen for real-time updates
    socket.on("newOrder", (order) => {
      setOrders((prev) => {
        const newOrders = [...prev, order];
        updateStats(newOrders);
        return newOrders;
      });
      // Refresh table data when new order is created (table becomes occupied)
      fetchTableData();
    });

    socket.on("orderUpdated", (updatedOrder) => {
      setOrders((prev) => {
        const updatedOrders = prev.map((order) => 
          order._id === updatedOrder._id ? updatedOrder : order
        );
        updateStats(updatedOrders);
        return updatedOrders;
      });
      // Refresh table data when order status changes (table might become available/occupied)
      fetchTableData();
    });

    return () => {
      socket.off("newOrder");
      socket.off("orderUpdated");
      clearInterval(dataInterval);
    };
  }, [authLoading, user]);

  const updateStats = (ordersData) => {
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = ordersData.filter(
      (order) => {
        const orderDate = order.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        return orderDate === today;
      }
    );

    const stats = {
      revenue: todayOrders.reduce((sum, order) => {
        if (!order.kotLines || !Array.isArray(order.kotLines)) return sum;
        const total = order.kotLines.reduce((kotSum, kot) => {
          return kotSum + (kot.totalAmount || 0);
        }, 0);
        return sum + (order.status === "Paid" ? total : 0);
      }, 0),
      totalOrders: todayOrders.length,
      newCustomers: Math.floor(todayOrders.length * 0.15), // Estimate 15% new customers
    };

    setTodayStats(stats);
    
    // Calculate Average Table Turnaround Time (from order creation to payment)
    calculateAvgTurnaround(ordersData);
    
    // Calculate Peak Order Hours
    calculatePeakHours(ordersData);
  };
  
  // Calculate average table turnaround time
  const calculateAvgTurnaround = (ordersData) => {
    // Filter paid dine-in orders with both createdAt and paidAt timestamps
    const completedDineInOrders = ordersData.filter(order => 
      order.status === "Paid" && 
      order.serviceType !== "TAKEAWAY" &&
      order.createdAt && 
      order.paidAt
    );
    
    if (completedDineInOrders.length === 0) {
      setAvgTableTurnaround("No data");
      return;
    }
    
    // Calculate average time in minutes
    const totalMinutes = completedDineInOrders.reduce((sum, order) => {
      const createdAt = new Date(order.createdAt);
      const paidAt = new Date(order.paidAt);
      const diffMs = paidAt - createdAt;
      const diffMins = diffMs / (1000 * 60);
      // Only count reasonable turnaround times (5 mins to 4 hours)
      if (diffMins >= 5 && diffMins <= 240) {
        return sum + diffMins;
      }
      return sum;
    }, 0);
    
    const validOrders = completedDineInOrders.filter(order => {
      const createdAt = new Date(order.createdAt);
      const paidAt = new Date(order.paidAt);
      const diffMins = (paidAt - createdAt) / (1000 * 60);
      return diffMins >= 5 && diffMins <= 240;
    });
    
    if (validOrders.length === 0) {
      setAvgTableTurnaround("No data");
      return;
    }
    
    const avgMins = Math.round(totalMinutes / validOrders.length);
    
    if (avgMins >= 60) {
      const hours = Math.floor(avgMins / 60);
      const mins = avgMins % 60;
      setAvgTableTurnaround(`${hours}h ${mins}m`);
    } else {
      setAvgTableTurnaround(`${avgMins} mins`);
    }
  };
  
  // Calculate peak order hours
  const calculatePeakHours = (ordersData) => {
    // Get orders from last 7 days for more accurate peak hours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentOrders = ordersData.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= sevenDaysAgo;
    });
    
    if (recentOrders.length < 5) {
      setPeakHours("Insufficient data");
      return;
    }
    
    // Separate dine-in and takeaway orders
    const dineInOrders = recentOrders.filter(o => o.serviceType !== "TAKEAWAY");
    const takeawayOrders = recentOrders.filter(o => o.serviceType === "TAKEAWAY");
    
    // Count orders by hour
    const countByHour = (orders) => {
      const hourCounts = {};
      orders.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });
      return hourCounts;
    };
    
    // Find peak hour(s) from counts
    const findPeakHours = (hourCounts) => {
      if (Object.keys(hourCounts).length === 0) return null;
      
      const maxCount = Math.max(...Object.values(hourCounts));
      const peakHoursList = Object.entries(hourCounts)
        .filter(([_, count]) => count >= maxCount * 0.8) // Include hours with 80%+ of max orders
        .map(([hour]) => parseInt(hour))
        .sort((a, b) => a - b);
      
      if (peakHoursList.length === 0) return null;
      
      // Find consecutive hour ranges
      const ranges = [];
      let start = peakHoursList[0];
      let end = start;
      
      for (let i = 1; i < peakHoursList.length; i++) {
        if (peakHoursList[i] === end + 1) {
          end = peakHoursList[i];
        } else {
          ranges.push([start, end]);
          start = peakHoursList[i];
          end = start;
        }
      }
      ranges.push([start, end]);
      
      // Format ranges
      const formatHour = (h) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12} ${period}`;
      };
      
      return ranges.slice(0, 2).map(([s, e]) => {
        if (s === e) return formatHour(s);
        return `${formatHour(s)}-${formatHour(e + 1)}`;
      }).join(', ');
    };
    
    const dineInPeak = findPeakHours(countByHour(dineInOrders));
    const takeawayPeak = findPeakHours(countByHour(takeawayOrders));
    
    const parts = [];
    if (dineInPeak) parts.push(`${dineInPeak} (Dine-in)`);
    if (takeawayPeak) parts.push(`${takeawayPeak} (Takeaway)`);
    
    if (parts.length === 0) {
      setPeakHours("No peak data");
    } else {
      setPeakHours(parts.join(', '));
    }
  };

  // Generate alerts from recent order updates
  const getAlerts = () => {
    const recentOrders = [...orders]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);

    return recentOrders
      .filter(order => order.status !== "Cancelled")
      .map(order => {
        let type = "order";
        if (order.status === "Finalized") type = "bill";
        if (order.status === "Ready") type = "manager";

        return {
          type,
          table: `Table ${order.tableNumber}`,
          time: new Date(order.updatedAt).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          status: order.status
        };
      });
  };

  const recentActivities = useMemo(() => {
    if (!orders?.length) return [];
    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt || Date.now()) -
          new Date(a.updatedAt || a.createdAt || Date.now())
      )
      .slice(0, 6)
      .map((order) => {
        const updatedAt = order.updatedAt || order.createdAt;
        const createdAt = order.createdAt || updatedAt;
        const isRecentCreate =
          Math.abs(new Date(updatedAt) - new Date(createdAt)) < 2 * 60 * 1000;
        const latestKot =
          order.kotLines && order.kotLines.length
            ? order.kotLines[order.kotLines.length - 1]
            : null;
        const totalAmount =
          latestKot?.totalAmount ??
          latestKot?.subtotal ??
          (order.totalAmount || 0);

        let message;
        if (order.status === "Paid") {
          message = `Payment received for Order ${order._id} (${order.tableNumber || "Table ?"}).`;
        } else if (order.status === "Cancelled") {
          message = `Order ${order._id} (${order.tableNumber || "Table ?" }) was cancelled.`;
        } else if (isRecentCreate) {
          message = `New order ${order._id} placed at ${
            order.tableNumber ? `Table ${order.tableNumber}` : "takeaway counter"
          }.`;
        } else {
          message = `Order ${order._id} at ${
            order.tableNumber ? `Table ${order.tableNumber}` : "Takeaway"
          } updated to ${order.status}.`;
        }

        return {
          id: order._id,
          message,
          amount:
            order.status === "Paid" && totalAmount
              ? `₹${Number(totalAmount || 0).toFixed(2)}`
              : null,
          time: new Date(updatedAt).toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
          }),
        };
      });
  }, [orders]);

  // helper to style alert type
  const getAlertBadge = (type, status) => {
    switch (type) {
      case "bill":
        return (
          <span className="bg-[#f5e3d5] text-[#4a2e1f] border border-[#e2c1ac] text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Bill Requested
          </span>
        );
      case "manager":
        return (
          <span className="bg-red-100 text-red-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Ready to Serve
          </span>
        );
      default:
        return (
          <span className="bg-green-100 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  // Get cart code and name
  const cartCode = user?.cartCode;
  const cartName = user?.cartName || user?.cafeName || user?.name || "Cart";
  const [copiedCartId, setCopiedCartId] = useState(false);

  const copyCartIdToClipboard = () => {
    if (cartCode) {
      navigator.clipboard.writeText(cartCode);
      setCopiedCartId(true);
      setTimeout(() => setCopiedCartId(false), 2000);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
        <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-[#4a2e1f]">{cartName} Dashboard</h1>
        
        {/* Cart ID Quick Access */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] rounded-lg px-3 py-2 shadow-md flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] text-white/70 font-medium leading-none">Cart ID</p>
            {cartCode ? (
              <span className="text-sm md:text-base font-mono font-bold text-white tracking-wider block truncate">
                {cartCode}
              </span>
            ) : (
              <span className="text-xs font-mono text-white/80">
                N/A
              </span>
            )}
          </div>
          {cartCode && (
            <button
              onClick={copyCartIdToClipboard}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white rounded transition-colors text-[10px] font-semibold whitespace-nowrap border border-white/30 flex-shrink-0"
              title="Copy Cart ID"
            >
              {copiedCartId ? "✓" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        <StatCard 
          title="Today's Revenue" 
          value={`₹${Math.max(0, todayStats.revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          icon="₹" 
        />
        <StatCard
          title="Total Orders"
          value={todayStats.totalOrders.toString()}
          icon="📦"
          clickable
          onClick={() => navigate("/orders")}
        />
        <StatCard
          title="Active Tables"
          value={`${tableStats.activeTables} / ${tableStats.totalTables}`}
          icon="🍽️"
          clickable
          onClick={() => navigate("/tables")}
        />
        <StatCard title="New Customers" value={todayStats.newCustomers.toString()} icon="🧑" />
        <StatCard 
          title="Active Staff Today" 
          value={`${staffStats.activeToday} / ${staffStats.totalStaff}`} 
          icon="👨‍🍳" 
        />
        <StatCard title="Avg. Table Turnaround" value={avgTableTurnaround} icon="⏱️" />
        <StatCard title="Peak Order Hours" value={peakHours} icon="📊" />
      </div>

      {/* Alerts Section - unified */}
      <div className="mt-6 md:mt-8">
        <h2 className="text-base md:text-lg lg:text-xl font-bold text-[#4a2e1f] mb-3">🔔 Live Alerts</h2>
        <div className="bg-white border border-[#e2c1ac] p-3 md:p-4 rounded-xl shadow-md space-y-2">
          {getAlerts().length > 0 ? (
            getAlerts().map((a, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[#4a2e1f] text-xs md:text-sm pb-2 gap-2"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{a.table}</span>{" "}
                  <span>
                    {a.type === "bill"
                      ? "requested bill"
                      : a.type === "manager"
                      ? "is ready to serve"
                      : `status updated to ${a.status}`}
                  </span>{" "}
                  at <span className="text-[#4a2e1f] font-medium">{a.time}</span>
                </div>
                <div className="flex-shrink-0">{getAlertBadge(a.type, a.status)}</div>
              </div>
            ))
          ) : (
            <p className="text-[#6b4423] text-sm">No alerts currently.</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 md:mt-8">
        <h2 className="text-base md:text-lg lg:text-xl font-bold text-[#4a2e1f] mb-3">
          Recent Activity
        </h2>
        <div className="p-3 md:p-4 bg-white border border-[#e2c1ac] rounded-xl shadow-md space-y-2">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity) => (
              <div
                key={activity.id + activity.time}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b last:border-b-0 border-gray-100 pb-2 last:pb-0"
              >
                <div className="text-[#4a2e1f] text-sm">{activity.message}</div>
                <div className="flex items-center gap-3 text-xs text-[#6b4423]">
                  {activity.amount && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {activity.amount}
                    </span>
                  )}
                  <span>{activity.time}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-[#6b4423] text-sm">No recent activity yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
