import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import {
  FiClock,
  FiUser,
  FiLogOut,
  FiTrendingUp,
  FiTrendingDown,
  FiShoppingBag,
  FiUsers,
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiCopy,
} from "react-icons/fi";
import {
  MdTableRestaurant,
  MdPendingActions,
  MdLocalDining,
  MdDeliveryDining,
  MdRestaurantMenu,
  MdAssignmentInd,
  MdReceiptLong,
} from "react-icons/md";
import { BiDish, BiReceipt } from "react-icons/bi";
import { FaMoneyBillWave, FaFire, FaUserCircle } from "react-icons/fa";

// --- Components ---

const RevenueCard = ({ revenueDineIn, revenueTakeaway }) => {
  const total = revenueDineIn + revenueTakeaway;
  return (
    <div className="bg-[#fff7ed] p-5 rounded-xl shadow-sm border border-orange-100 flex flex-col justify-between h-full relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <FaMoneyBillWave size={60} color="#d86d2a" />
      </div>
      <div>
        <h3 className="text-[#8b5e3c] font-semibold text-sm mb-1">
          Today's Revenue
        </h3>
        <div className="flex gap-4 mt-2">
          <div>
            <span className="text-xs text-[#8b5e3c] block">Dine-in</span>
            <span className="text-lg font-bold text-[#4a2e1f] flex items-center gap-1">
              <FiCheckCircle className="text-green-500 text-xs" />₹
              {revenueDineIn.toLocaleString()}
            </span>
          </div>
          <div className="w-px bg-orange-200 h-8 self-center"></div>
          <div>
            <span className="text-xs text-[#8b5e3c] block">Takeaway</span>
            <span className="text-lg font-bold text-[#4a2e1f] flex items-center gap-1">
              <FiCheckCircle className="text-green-500 text-xs" />₹
              {revenueTakeaway.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PendingActionsCard = ({ pendingOrders, billRequests }) => (
  <div className="bg-[#fff7ed] p-5 rounded-xl shadow-sm border border-orange-100 flex flex-col justify-between h-full relative overflow-hidden">
    <div className="absolute top-0 right-0 p-3 opacity-10">
      <FiAlertCircle size={60} color="#d86d2a" />
    </div>
    <div>
      <h3 className="text-[#8b5e3c] font-semibold text-sm mb-1 flex items-center gap-2">
        <FiAlertCircle className="text-[#d86d2a]" /> Pending Actions
      </h3>
      <div className="flex gap-6 mt-2">
        <div>
          <span className="text-3xl font-bold text-[#4a2e1f] block">
            {pendingOrders}
          </span>
          <span className="text-xs text-[#8b5e3c]">Orders</span>
        </div>
        <div className="w-px bg-orange-200 h-8 self-center"></div>
        <div>
          <span className="text-3xl font-bold text-[#4a2e1f] block">
            {billRequests}
          </span>
          <span className="text-xs text-[#8b5e3c]">Bill Requests</span>
        </div>
      </div>
    </div>
  </div>
);

const TotalOrdersCard = ({ preparing, served, paid, cartId }) => {
  const [copied, setCopied] = useState(false);

  const copyCartId = () => {
    if (cartId) {
      navigator.clipboard.writeText(cartId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] flex flex-col justify-between h-full relative">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[#4a2e1f] font-semibold text-sm">Total Orders</h3>
        {cartId && (
          <div className="flex items-center gap-1 bg-[#d86d2a] text-white px-2 py-1 rounded text-[10px] font-mono shadow-sm">
            <span>Cart ID: {cartId}</span>
            <button
              onClick={copyCartId}
              className="hover:text-gray-200 transition-colors"
              title="Copy Cart ID"
            >
              {copied ? <FiCheckCircle /> : <FiCopy />}
            </button>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center mt-2 px-1">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-[#4a2e1f]">{preparing}</span>
          <div className="flex items-center gap-1">
             <div className="w-2 h-2 rounded-full bg-orange-500"></div>
             <span className="text-xs text-[#8b5e3c]">Preparing</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-[#4a2e1f]">{served}</span>
          <div className="flex items-center gap-1">
             <div className="w-2 h-2 rounded-full bg-green-500"></div>
             <span className="text-xs text-[#8b5e3c]">Served</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-[#4a2e1f]">{paid}</span>
          <div className="flex items-center gap-1">
             <div className="w-2 h-2 rounded-full bg-blue-500"></div>
             <span className="text-xs text-[#8b5e3c]">Paid</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SimpleStatCard = ({ title, value, subtext, icon: Icon }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] flex items-center gap-4">
    <div className="p-3 rounded-full bg-orange-50 text-[#d86d2a]">
      <Icon size={24} />
    </div>
    <div>
      <p className="text-xs text-[#8b5e3c] font-medium">{title}</p>
      <h4 className="text-xl font-bold text-[#4a2e1f]">{value}</h4>
      <p className="text-[10px] text-gray-500">{subtext}</p>
    </div>
  </div>
);

const LiveTableStatus = ({ tables }) => (
  <div className="mb-6">
    <h3 className="text-lg font-bold text-[#4a2e1f] mb-3 flex items-center gap-2">
      <MdTableRestaurant /> Live Table Status
    </h3>
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
      {tables.map((table) => {
        // Determine status style
        let statusColor = "bg-white border-gray-200 text-gray-500"; // Default Free
        let statusIcon = <div className="w-3 h-3 rounded-full border border-gray-400"></div>;
        let statusText = "Free";

        if (table.status === "OCCUPIED") {
          statusColor = "bg-green-100 border-green-200 text-green-700";
          statusIcon = <FiCheckCircle className="text-green-600" />;
          statusText = "Occupied"; // Changed from Served to Occupied
        } else if (table.status === "RESERVED") {
            statusColor = "bg-orange-100 border-orange-200 text-orange-700";
            statusIcon = <FiClock className="text-orange-600" />;
            statusText = "Reserved";
        }
        
        return (
          <div
            key={table._id}
            className={`min-w-[120px] p-3 rounded-lg border flex flex-col gap-2 shadow-sm ${statusColor}`}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm">Table {table.tableNumber}</span>
              {table.status !== 'AVAILABLE' && <FiActivity />}
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {statusIcon}
              <span>{statusText}</span>
            </div>
          </div>
        );
      })}
      {tables.length === 0 && <p className="text-sm text-gray-500">No tables found.</p>}
    </div>
  </div>
);

const KitchenLoad = ({ loadPercentage }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full">
    <div className="flex justify-between items-center mb-2">
      <h3 className="font-bold text-[#4a2e1f]">Kitchen Load</h3>
      <span className={`text-sm font-bold ${loadPercentage > 80 ? 'text-red-500' : loadPercentage > 50 ? 'text-orange-500' : 'text-green-500'}`}>
        &lt; {Math.ceil(loadPercentage)}%
      </span>
    </div>
    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
           loadPercentage > 80 ? 'bg-gradient-to-r from-red-400 to-red-600' :
           loadPercentage > 50 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
           'bg-gradient-to-r from-[#d86d2a] to-[#ffaa70]' // Using theme orange
        }`}
        style={{ width: `${Math.min(loadPercentage, 100)}%` }}
      ></div>
    </div>
    <p className="text-xs text-gray-400 mt-2 text-center">Based on active order queue</p>
  </div>
);

const LiveAlerts = ({ alerts, navigate }) => (
  <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full">
    <h3 className="text-lg font-bold text-[#4a2e1f] mb-4 flex items-center gap-2">
      <FiAlertCircle className="text-[#d86d2a]" /> Live Alerts
    </h3>
    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
      {alerts.length > 0 ? (
        alerts.map((alert, idx) => (
          <div key={idx} className="p-3 bg-orange-50/50 rounded-lg border border-orange-100">
            <div className="flex justify-between items-start mb-1">
              <p className="text-sm font-semibold text-[#4a2e1f]">
                {alert.table} status updated to {alert.status}
              </p>
              <span className="text-[10px] text-gray-500">{alert.time}</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => navigate('/orders')}
                className="px-2 py-1 bg-white border border-[#e2c1ac] text-[#d86d2a] text-xs rounded hover:bg-[#fff7ed] transition flex items-center gap-1"
              >
                 View Order
              </button>
              {alert.type === 'bill' && (
                  <button
                    onClick={() => navigate('/invoices')}
                    className="px-2 py-1 bg-[#d86d2a] text-white text-xs rounded hover:bg-[#c75b1a] transition"
                  >
                    Generate Invoice
                  </button>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500 text-center py-4">No active alerts.</p>
      )}
    </div>
  </div>
);

const StaffStatus = ({ staff, activeOrders }) => {
    // Determine active staff based on active orders waiterName
    const waiterCounts = {};
    activeOrders.forEach(o => {
        if(o.waiterName) {
            waiterCounts[o.waiterName] = (waiterCounts[o.waiterName] || 0) + 1;
        }
    });

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-[#4a2e1f]">Staff Status</h3>
               <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Confirmed</span>
            </div>
            <div className="space-y-3">
                {Object.entries(waiterCounts).length > 0 ? (
                    Object.entries(waiterCounts).map(([name, count], i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-orange-100 rounded-full text-[#d86d2a]"><FiUser size={12}/></div>
                                <span className="font-medium text-[#4a2e1f]">{name}</span>
                            </div>
                            <span className="text-xs text-gray-500">{count} Active Orders</span>
                        </div>
                    ))
                ) : (
                    <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                            <FiUser className="text-gray-400" />
                            <span className="text-gray-500">No active assignments</span>
                        </div>
                        <span className="text-xs text-gray-400">Idle</span>
                    </div>
                )}
                
                {/* Active Tables List fallback if no staff names */}
                <h4 className="text-xs font-bold text-[#8b5e3c] mt-4 mb-2 uppercase tracking-wide">Active Items</h4>
                <div className="space-y-2">
                     {activeOrders.slice(0, 3).map((o, i) => (
                         <div key={i} className="flex justify-between items-center text-xs">
                             <div className="flex items-center gap-2 truncate">
                                 <div className={`w-2 h-2 rounded-full ${o.status === 'Paid' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                 <span className="truncate max-w-[100px]">{o.tableNumber ? `Table ${o.tableNumber}` : o.orderId}</span>
                             </div>
                             <div className="flex gap-2">
                                <span className="font-mono">
                                    {o.kotLines?.reduce((acc, kot) => acc + (kot.items?.length || 0), 0) || 0} items
                                </span>
                                <span className="px-1 bg-gray-100 rounded border">{o.status}</span>
                             </div>
                         </div>
                     ))}
                </div>
            </div>
        </div>
    );
}



const OrdersTimeline = ({ orders }) => {
    // Group orders by hour (0 to 23)
    const hours = Array.from({ length: 24 }, (_, i) => i); 
    const data = hours.map(h => {
        const count = orders.filter(o => {
            if(!o.createdAt) return false;
            const date = new Date(o.createdAt);
            return date.getHours() === h;
        }).length;
        
        // Format hour label
        const hourLabel = h === 0 ? '12 AM' : (h > 12 ? `${h - 12} PM` : `${h} ${h === 12 ? 'PM' : 'AM'}`);
        return { hour: h, count, label: hourLabel };
    });

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full">
            <h3 className="text-lg font-bold text-[#4a2e1f] mb-4">Orders Timeline</h3>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d86d2a" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#d86d2a" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                            dataKey="label" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#8b5e3c' }} 
                            interval={3} // Show every 3rd hour to avoid clutter
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#8b5e3c' }} 
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2c1ac', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: '#4a2e1f', fontWeight: 'bold' }}
                            labelStyle={{ color: '#8b5e3c', fontSize: '12px', marginBottom: '4px' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#d86d2a" 
                            fillOpacity={1} 
                            fill="url(#colorCount)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

const BestSellingItems = ({ orders }) => {
    const itemCounts = {};
    orders.forEach(o => {
        if(o.kotLines) {
            o.kotLines.forEach(kot => {
                if(kot.items) {
                    kot.items.forEach(item => {
                        const name = item.name;
                        itemCounts[name] = (itemCounts[name] || 0) + item.quantity;
                    });
                }
            });
        }
    });

    const sortedItems = Object.entries(itemCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full">
            <h3 className="text-lg font-bold text-[#4a2e1f] mb-4">Best Selling Items</h3>
            <div className="space-y-3">
                {sortedItems.length > 0 ? (
                    sortedItems.map(([name, count], index) => (
                        <div key={name} className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-gray-400 w-4">{index + 1}.</span>
                                <span className="text-[#4a2e1f] font-medium">{name}</span>
                            </div>
                            <span className="text-sm font-bold text-[#d86d2a]">{count}</span>
                        </div>
                    ))
                ) : (
                   <p className="text-sm text-gray-500">No data yet.</p>
                )}
            </div>
            <button className="w-full mt-4 bg-[#d86d2a] text-white py-2 rounded-lg font-bold hover:bg-[#bf5e22] transition flex items-center justify-center gap-2">
                <BiDish /> New Order
            </button>
        </div>
    );
}

// --- Main Dashboard Component ---

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Data State
  const [todayOrders, setTodayOrders] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  
  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Orders
        const ordersRes = await api.get("/orders");
        let ordersData = Array.isArray(ordersRes.data) ? ordersRes.data : 
                         (ordersRes.data?.orders || ordersRes.data?.data || []);
        setOrders(ordersData);

        // Filter Today's Orders (Local Time)
        const now = new Date();
        const today = ordersData.filter(o => {
            if (!o.createdAt || !o.updatedAt) return false;
            // Use createdAt if available, otherwise fallback to now (which is wrong but safe)
            const orderDate = new Date(o.createdAt);
            return orderDate.getDate() === now.getDate() &&
                   orderDate.getMonth() === now.getMonth() &&
                   orderDate.getFullYear() === now.getFullYear();
        });
        setTodayOrders(today);

        // Fetch Tables
        const tablesRes = await api.get("/tables");
        let tablesData = Array.isArray(tablesRes.data) ? tablesRes.data :
                         (tablesRes.data?.tables || tablesRes.data?.data || []);
        setTables(tablesData);

        // Fetch Employees (for total count, though we rely on order waiterName for active status)
        const employeesRes = await api.get("/employees");
        let empData = Array.isArray(employeesRes.data) ? employeesRes.data :
                      (employeesRes.data?.employees || employeesRes.data?.data || []);
        setEmployees(empData);

        // Fetch Pending Customer Requests (Bill, Water, etc.)
        try {
            const reqRes = await api.get("/customer-requests/pending");
            const reqData = Array.isArray(reqRes.data) ? reqRes.data : 
                           (reqRes.data?.requests || reqRes.data?.data || []);
            setPendingRequests(reqData);
        } catch (reqErr) {
            console.warn("Failed to fetch customer requests:", reqErr);
        }

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 12000); // 12s polling
    return () => clearInterval(interval);
  }, []);

  // Helper to calculate total amount from KOT lines
  const calculateOrderTotal = (order) => {
      if (!order || !order.kotLines || !Array.isArray(order.kotLines)) return 0;
      return order.kotLines.reduce((sum, kot) => sum + (Number(kot.totalAmount) || 0), 0);
  };

  // metrics
  const revenueDineIn = useMemo(() => 
    todayOrders.filter(o => o.serviceType === 'DINE_IN').reduce((sum, o) => sum + (o.status === 'Paid' ? calculateOrderTotal(o) : 0), 0)
  , [todayOrders]);

  const revenueTakeaway = useMemo(() => 
    todayOrders.filter(o => ['TAKEAWAY', 'PICKUP', 'DELIVERY'].includes(o.serviceType)).reduce((sum, o) => sum + (o.status === 'Paid' ? calculateOrderTotal(o) : 0), 0)
  , [todayOrders]);

  const pendingCount = todayOrders.filter(o => ['Pending', 'Preparing', 'Cooking'].includes(o.status)).length;
  // Calculate bill requests from active customer requests
  const billReqCount = pendingRequests.filter(r => r.requestType === 'bill' && r.status === 'pending').length; 

  const prepCount = todayOrders.filter(o => ['Pending', 'Preparing', 'Cooking'].includes(o.status)).length;
  const servedCount = todayOrders.filter(o => ['Ready', 'Served'].includes(o.status)).length;
  const paidCount = todayOrders.filter(o => o.status === 'Paid').length;

  // New Customers (Count unique mobiles if available, else 20% estimate)
  const uniqueMobiles = new Set(todayOrders.map(o => o.customerMobile).filter(Boolean)).size;
  const newCust = uniqueMobiles > 0 ? uniqueMobiles : Math.ceil(todayOrders.length * 0.20);

  // Turnaround (simplified with fallback for missing paidAt)
  const calculateTurnaround = (list) => {
      const completed = list.filter(o => o.status === 'Paid');
      if(!completed.length) return "0 mins";
      
      const totalMins = completed.reduce((sum, o) => {
          const endTime = o.paidAt ? new Date(o.paidAt) : new Date(o.updatedAt);
          const startTime = new Date(o.createdAt);
          const diff = (endTime - startTime) / 60000;
          return sum + (diff > 0 ? diff : 0); // Avoid negative times
      }, 0);
      
      return Math.round(totalMins / completed.length) + " mins";
  }
  const avgTurnaround = calculateTurnaround(todayOrders);

  // Kitchen Load (Active items / 50 capacity)
  const activeItemsCount = todayOrders
    .filter(o => ['Pending', 'Preparing', 'Cooking'].includes(o.status))
    .reduce((sum, o) => {
        if (!o.kotLines || !Array.isArray(o.kotLines)) return sum;
        const orderItemsCount = o.kotLines.reduce((acc, kot) => {
            return acc + (kot.items ? kot.items.length : 0);
        }, 0);
        return sum + orderItemsCount;
    }, 0);
  const kitchenLoadImg = (activeItemsCount / 30) * 100; // Assume 30 items max capacity for visual

  // Alerts
  const alerts = useMemo(() => {
      // Sort orders by updated at
      const recent = [...orders].sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 5);
      return recent.map(o => ({
          table: o.tableNumber ? `Table ${o.tableNumber}` : `Order #${o.orderId?.slice(-4)}`,
          status: o.status,
          time: new Date(o.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
          type: o.status === 'Finalized' ? 'bill' : 'order'
      }));
  }, [orders]);

  // Active Orders for Staff Status
  const activeOrders = todayOrders.filter(o => !['Paid', 'Cancelled'].includes(o.status));

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 md:p-6 lg:p-8 font-sans text-[#4a2e1f]">
      
      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <RevenueCard revenueDineIn={revenueDineIn} revenueTakeaway={revenueTakeaway} />
        <PendingActionsCard pendingOrders={pendingCount} billRequests={billReqCount} />
        <TotalOrdersCard preparing={prepCount} served={servedCount} paid={paidCount} cartId={user?.cartCode} />
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SimpleStatCard title="Avg. Turnaround" value={avgTurnaround} subtext="Today" icon={FiClock} />
        <SimpleStatCard title="Avg. Prep Time" value={(activeItemsCount * 2) + " mins"} subtext="Estimated" icon={FiActivity} />
        <SimpleStatCard title="New Customers" value={newCust} subtext="Today" icon={FiUsers} />
        <SimpleStatCard title="Total Staff" value={employees.length} subtext={`${employees.length} Registered`} icon={MdAssignmentInd} />
      </div>

      {/* Middle Section: Tables & Kitchen */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
            <LiveTableStatus tables={tables} />
        </div>
        <div className="h-full">
            <KitchenLoad loadPercentage={kitchenLoadImg} />
        </div>
      </div>

      {/* Bottom Section: Alerts & Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
         <LiveAlerts alerts={alerts} navigate={navigate} />
         <StaffStatus staff={employees} activeOrders={activeOrders} />
      </div>

      {/* Final Row: Timeline & Best Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <OrdersTimeline orders={todayOrders} />
         <BestSellingItems orders={orders /* Use all orders for best selling stats or todayOrders? All orders better */} />
      </div>

    </div>
  );
};

export default DashboardAdmin;
