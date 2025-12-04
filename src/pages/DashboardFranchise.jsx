import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import io from "socket.io-client";

const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
const socket = io(nodeApi);

const StatCard = ({ title, value, icon, onClick, clickable = false, subtitle, color = "default" }) => {
  const colorClasses = {
    default: "border-[#e2c1ac]",
    green: "border-green-300 bg-green-50",
    red: "border-red-300 bg-red-50",
    yellow: "border-yellow-300 bg-yellow-50",
    blue: "border-blue-300 bg-blue-50",
  };
  
  return (
    <div
      onClick={onClick}
      className={`p-5 bg-white rounded-xl shadow-md border ${colorClasses[color]} flex flex-col justify-between h-full ${
        clickable ? "cursor-pointer hover:shadow-xl hover:border-[#d86d2a] transition-all" : ""
      }`}
    >
      <div className="flex items-center space-x-4">
        <div className="text-3xl">{icon}</div>
        <div>
          <p className="text-sm font-medium text-[#6b4423]">{title}</p>
          <p className="text-2xl font-bold text-[#4a2e1f]">{value}</p>
          {subtitle && <p className="text-xs text-[#6b4423] mt-1">{subtitle}</p>}
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
  
  const franchiseName = user?.name || "Franchise Dashboard";

  const calculateRevenue = (ordersData) => {
    // Ensure ordersData is an array
    if (!Array.isArray(ordersData)) {
      console.warn("[Dashboard] ordersData is not an array:", ordersData);
      return { totalRevenue: 0, todayRevenue: 0, todayOrders: 0, totalPaidOrders: 0 };
    }
    
    console.log("[Dashboard] Calculating revenue from", ordersData.length, "orders");
    
    const paidOrders = ordersData.filter((order) => order.status === "Paid");
    console.log("[Dashboard] Paid orders:", paidOrders.length);
    
    const totalRevenue = paidOrders.reduce((sum, order) => {
      if (!order.kotLines || !Array.isArray(order.kotLines) || order.kotLines.length === 0) {
        return sum;
      }
      const orderTotal = order.kotLines.reduce((kotSum, kot) => {
        return kotSum + Number(kot.totalAmount || 0);
      }, 0);
      return sum + orderTotal;
    }, 0);
    
    // Calculate today's orders (all statuses, not just paid)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAllOrders = ordersData.filter(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
    console.log("[Dashboard] Today's orders (all):", todayAllOrders.length);
    
    // Today's revenue (only from paid orders today)
    const todayPaidOrders = todayAllOrders.filter(o => o.status === "Paid");
    const todayRevenue = todayPaidOrders.reduce((sum, order) => {
      if (!order.kotLines || !Array.isArray(order.kotLines)) return sum;
      return sum + order.kotLines.reduce((kotSum, kot) => kotSum + Number(kot.totalAmount || 0), 0);
    }, 0);
    
    return { 
      totalRevenue, 
      todayRevenue, 
      todayOrders: todayAllOrders.length,
      totalPaidOrders: paidOrders.length 
    };
  };

  useEffect(() => {
    if (!user || !user._id) return;
    
    fetchDashboardData();

    // Socket listeners for real-time updates
    socket.on("newOrder", (order) => {
      let orderFranchiseId = order.franchiseId;
      if (orderFranchiseId && typeof orderFranchiseId === 'object') {
        orderFranchiseId = orderFranchiseId._id || orderFranchiseId;
      }
      if (orderFranchiseId && orderFranchiseId.toString() === user._id.toString()) {
        setOrders((prev) => [...prev, order]);
        fetchDashboardData(); // Refresh stats
      }
    });

    socket.on("orderUpdated", (updatedOrder) => {
      let orderFranchiseId = updatedOrder.franchiseId;
      if (orderFranchiseId && typeof orderFranchiseId === 'object') {
        orderFranchiseId = orderFranchiseId._id || orderFranchiseId;
      }
      if (orderFranchiseId && orderFranchiseId.toString() === user._id.toString()) {
        setOrders((prev) => prev.map((order) => 
          order._id === updatedOrder._id ? updatedOrder : order
        ));
        fetchDashboardData(); // Refresh stats
      }
    });

    socket.on("paymentUpdated", () => {
      fetchDashboardData();
    });

    return () => {
      socket.off("newOrder");
      socket.off("orderUpdated");
      socket.off("paymentUpdated");
    };
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
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
        console.log("[Dashboard] Cart stats:", cartStats);
      } catch (err) {
        console.error("Error fetching cart statistics:", err);
      }
      
      // Fetch carts for recent list
      let allCarts = [];
      try {
        const usersResponse = await api.get("/users");
        // Ensure response is an array
        let usersData = [];
        if (Array.isArray(usersResponse.data)) {
          usersData = usersResponse.data;
        } else if (usersResponse.data && Array.isArray(usersResponse.data.users)) {
          usersData = usersResponse.data.users;
        } else if (usersResponse.data && Array.isArray(usersResponse.data.data)) {
          usersData = usersResponse.data.data;
        }
        allCarts = usersData.filter(u => u.role === "admin");
        console.log("[Dashboard] Carts fetched:", allCarts.length);
      } catch (err) {
        console.error("Error fetching users:", err);
        allCarts = [];
      }

      // Fetch orders
      let fetchedOrders = [];
      let revenueData = { totalRevenue: 0, todayRevenue: 0, todayOrders: 0 };
      try {
        const ordersResponse = await api.get("/orders");
        // Ensure fetchedOrders is always an array
        if (Array.isArray(ordersResponse.data)) {
          fetchedOrders = ordersResponse.data;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.orders)) {
          fetchedOrders = ordersResponse.data.orders;
        } else if (ordersResponse.data && Array.isArray(ordersResponse.data.data)) {
          fetchedOrders = ordersResponse.data.data;
        } else {
          fetchedOrders = [];
          console.warn("[Dashboard] Orders response is not an array:", ordersResponse.data);
        }
        setOrders(fetchedOrders);
        revenueData = calculateRevenue(fetchedOrders);
        console.log("[Dashboard] Orders:", fetchedOrders.length, "Revenue:", revenueData);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
        fetchedOrders = [];
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
        totalCarts: cartStats.totalCarts || allCarts.length || 0,
        activeCarts: cartStats.activeCarts || 0,
        inactiveCarts: cartStats.inactiveCarts || 0,
        pendingApproval: cartStats.pendingApproval || 0,
        totalRevenue: revenueData.totalRevenue || 0,
        todayRevenue: revenueData.todayRevenue || 0,
        todayOrders: revenueData.todayOrders || 0,
        totalOrders: Array.isArray(fetchedOrders) ? fetchedOrders.length : 0,
      };
      console.log("[Dashboard] Setting stats:", newStats);
      setStats(newStats);
      setRecentCarts(recent);
      
      // Calculate orders per cart
      const cartOrderMap = {};
      allCarts.forEach(cart => {
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
      
      // Ensure fetchedOrders is an array before forEach
      if (Array.isArray(fetchedOrders)) {
        fetchedOrders.forEach(order => {
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
            const orderTotal = order.kotLines.reduce((sum, kot) => sum + Number(kot.totalAmount || 0), 0);
            cartOrderMap[cartId].revenue += orderTotal;
          }
        }
      });
      }
      
      const cartStats2 = Object.values(cartOrderMap).sort((a, b) => b.orders - a.orders);
      setCartOrderStats(cartStats2);
      console.log("[Dashboard] Cart order stats:", cartStats2);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
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
      const response = await api.post('/users/generate-franchise-code');
      if (response.data?.franchiseCode) {
        // Update local storage with new code
        const updatedUser = { ...user, franchiseCode: response.data.franchiseCode, franchiseShortcut: response.data.franchiseShortcut };
        localStorage.setItem('franchiseAdminUser', JSON.stringify(updatedUser));
        // Reload page to reflect changes
        window.location.reload();
      }
    } catch (error) {
      console.error('Error generating franchise code:', error);
      alert('Failed to generate franchise code. Please contact support.');
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

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-6 gap-3 md:gap-4">
        <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-[#4a2e1f]">
          {franchiseName} Dashboard
        </h1>
        
        {/* Franchise ID Quick Access */}
        <div className="flex items-center gap-2 md:gap-3 bg-gradient-to-r from-[#4a2e1f] to-[#6b4423] rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-3 shadow-lg">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-base md:text-xl">🏢</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-white/70 font-medium">
                {franchiseCode ? 'Franchise Code' : 'Franchise ID'}
              </p>
              <span className={`font-mono font-bold text-white tracking-wider block truncate ${franchiseCode ? 'text-sm md:text-xl' : 'text-xs md:text-base'}`}>
                {getDisplayId()}
              </span>
              {!franchiseCode && franchiseId && (
                <p className="text-[10px] text-yellow-300/80 mt-0.5">Legacy ID format</p>
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
                {generatingCode ? "..." : <><span className="hidden sm:inline">⚡ Generate Code</span><span className="sm:hidden">⚡</span></>}
              </button>
            )}
            <button
              onClick={copyToClipboard}
              className="px-2 md:px-3 py-1 md:py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors text-[10px] md:text-xs font-semibold whitespace-nowrap border border-white/30"
              disabled={!franchiseCode && !franchiseId}
              title="Copy Franchise ID"
            >
              {copied ? "✓" : "📋"}
            </button>
          </div>
        </div>
      </div>

      {/* Cart Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <StatCard
          title="Total Carts"
          value={loading ? "..." : stats.totalCarts.toString()}
          icon="🏪"
          clickable
          onClick={() => navigate("/carts")}
          color="blue"
        />
        <StatCard
          title="Active Carts"
          value={loading ? "..." : stats.activeCarts.toString()}
          icon="✅"
          clickable
          onClick={() => navigate("/carts?filter=active")}
          color="green"
        />
        <StatCard
          title="Inactive Carts"
          value={loading ? "..." : stats.inactiveCarts.toString()}
          icon="❌"
          clickable
          onClick={() => navigate("/carts?filter=inactive")}
          color="red"
        />
        <StatCard
          title="Pending Approval"
          value={loading ? "..." : stats.pendingApproval.toString()}
          icon="⏳"
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
          icon="💵"
          subtitle="From paid orders today"
        />
        <StatCard
          title="Total Revenue"
          value={loading ? "..." : formatCurrency(stats.totalRevenue)}
          icon="💰"
          subtitle="All time"
        />
        <StatCard
          title="Today's Orders"
          value={loading ? "..." : stats.todayOrders.toString()}
          icon="📦"
          clickable
          onClick={() => navigate("/orders")}
        />
        <StatCard
          title="Total Orders"
          value={loading ? "..." : (stats.totalOrders || 0).toString()}
          icon="📋"
          clickable
          onClick={() => navigate("/orders")}
        />
      </div>

      {/* Cart-wise Orders Breakdown */}
      {cartOrderStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-6 mb-4 md:mb-6">
          <h2 className="text-base md:text-lg lg:text-xl font-bold text-[#4a2e1f] mb-3 md:mb-4">
            Orders by Cart
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {cartOrderStats.map((cart) => (
              <div 
                key={cart.cartId} 
                className="bg-[#fef4ec] rounded-lg p-4 border border-[#e2c1ac] hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {cart.cartCode && (
                      <span className="px-2 py-1 text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded">
                        {cart.cartCode}
                      </span>
                    )}
                    <span className="font-medium text-[#4a2e1f]">{cart.cartName}</span>
                  </div>
                </div>
        <div className="grid grid-cols-3 gap-2 text-center mt-3">
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-[#6b4423]">Today</p>
                    <p className="text-lg font-bold text-[#4a2e1f]">{cart.todayOrders}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-[#6b4423]">Total</p>
                    <p className="text-lg font-bold text-[#4a2e1f]">{cart.orders}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-[#6b4423]">Revenue</p>
                    <p className="text-sm font-bold text-green-600">
                      ₹{Number(cart.revenue || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {cartOrderStats.length === 0 && (
            <p className="text-center text-[#6b4423] py-4">No carts with orders yet</p>
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
            <span className="hidden sm:inline">View All →</span>
            <span className="sm:hidden">All →</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[#6b4423]">Loading...</div>
        ) : recentCarts.length === 0 ? (
          <div className="text-center py-8 text-[#6b4423]">
            <p className="mb-4">No carts found. Add your first cart to get started.</p>
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
                  <tr key={cart.id} className="hover:bg-[#fef4ec] transition-colors">
                    <td className="px-2 md:px-4 py-2 md:py-3">
                      {cart.cartCode ? (
                        <span className="px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded">
                          {cart.cartCode}
                        </span>
                      ) : (
                        <span className="text-[10px] md:text-xs text-gray-400">N/A</span>
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
                      <span className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold rounded-full ${
                        cart.statusColor === 'green' 
                          ? 'bg-green-100 text-green-800'
                          : cart.statusColor === 'yellow'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
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
