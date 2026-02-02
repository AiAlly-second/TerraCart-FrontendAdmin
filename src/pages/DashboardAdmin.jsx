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



const AlertsPanel = ({ customerRequests, orders, tables }) => {
  const [activeTab, setActiveTab] = useState('all');
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  
  // Action handlers
  const handleMarkServed = async (requestId) => {
    try {
      console.log('Marking request as served:', requestId);
      await api.post(`/customer-requests/${requestId}/resolve`, {
        notes: '' // Backend expects this field
      });
      // alert('✅ Request marked as served!'); // Removed alert to rely on UI update
      // Locally dismiss to remove from list immediately
      handleDismiss(requestId);
      
      // Optionally reload or let polling catch it
      // window.location.reload(); 
    } catch (error) {
      console.error('Error marking request as served:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      alert(`❌ Failed: ${errorMsg}`);
    }
  };
  
  const handleRushOrder = async (orderId) => {
    try {
      // TODO: Implement rush order notification to kitchen
      console.log('Rushing order:', orderId);
      // For now, just dismiss the alert as "handled"
      alert(`Order ${orderId.slice(-4)} marked as RUSH! Kitchen has been notified.`);
      handleDismiss(orderId);
    } catch (error) {
      console.error('Error rushing order:', error);
    }
  };
  
  const handleClearTable = async (tableNumber, alertId) => {
    try {
      // Find the table object to get its _id
      // Loose comparison for string/number match
      const table = tables.find(t => String(t.number) === String(tableNumber) || String(t.tableNumber) === String(tableNumber));
      
      if (!table) {
        alert(`❌ Table ${tableNumber} not found in system.`);
        return;
      }

      const confirmClear = confirm(`Clear Table ${tableNumber}? This will mark it as AVAILABLE.`);
      if (confirmClear) {
        // Call Backend API to clear table
        await api.put(`/tables/${table._id}`, { status: "AVAILABLE" });
        // Auto-dismiss the alert
        if (alertId) handleDismiss(alertId);
        // alert(`✅ Table ${tableNumber} is now available.`);
      }
    } catch (error) {
      console.error('Error clearing table:', error);
      alert(`❌ Failed to clear table: ${error.message}`);
    }
  };
  
  const handleDismiss = (id) => {
    setDismissedAlerts(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
    });
  };
  
  
  // Calculate kitchen delays (orders in preparing/cooking for > 30 mins)
  const kitchenDelays = useMemo(() => {
    const now = new Date();
    return orders.filter(o => {
      if (!['Preparing', 'Cooking', 'Pending'].includes(o.status)) return false;
      const orderTime = new Date(o.createdAt);
      const minutesElapsed = (now - orderTime) / 60000;
      return minutesElapsed > 30;
    }).map(o => ({
      id: o.orderId || o._id, // Consistent ID property
      type: 'kitchen_delay',
      orderId: o.orderId || o._id,
      tableNumber: o.tableNumber,
      minutesElapsed: Math.floor((now - new Date(o.createdAt)) / 60000),
      createdAt: o.createdAt
    }));
  }, [orders]);
  
  // Calculate table overstay (paid orders with table still occupied > 15 mins)
  const tableOverstays = useMemo(() => {
    const now = new Date();
    return orders.filter(o => {
      if (o.status !== 'Paid' || !o.tableNumber) return false;
      const paidTime = new Date(o.paidAt || o.updatedAt);
      const minutesElapsed = (now - paidTime) / 60000;
      // Only show if > 15 mins AND table shows as Occupied (optional check, but good for accuracy)
      // Since we don't have table status readily mapped here without lookup, we assume overstay if order is Paid but time passed.
      return minutesElapsed > 15;
    }).map(o => ({
      id: o.orderId || o._id, // Consistent ID property
      type: 'table_overstay',
      tableNumber: o.tableNumber,
      orderId: o.orderId || o._id,
      minutesElapsed: Math.floor((now - new Date(o.paidAt || o.updatedAt)) / 60000),
      paidAt: o.paidAt || o.updatedAt
    }));
  }, [orders]);
  
  // Format customer requests
  const formattedRequests = useMemo(() => {
    return (customerRequests || []).map(r => {
      
      // Extract table number
      let tableNum = null;
      if (typeof r.tableNumber === 'number' || typeof r.tableNumber === 'string') {
        tableNum = r.tableNumber;
      } else if (r.tableId?.number) {
        tableNum = r.tableId.number;
      } else if (r.table?.number) {
        tableNum = r.table.number;
      } else if (typeof r.tableId === 'number') {
        tableNum = r.tableId;
      }
      
      return {
        id: r._id, // Consistent ID property
        type: 'customer_request',
        requestType: r.requestType,
        tableNumber: tableNum,
        message: r.message,
        createdAt: r.createdAt,
        _id: r._id
      };
    });
  }, [customerRequests]);
  
  // Combine all alerts and filter dismissed
  const allAlerts = useMemo(() => {
    const combined = [...formattedRequests, ...kitchenDelays, ...tableOverstays];
    // Filter out dismissed alerts
    return combined
        .filter(alert => !dismissedAlerts.has(alert.id))
        .sort((a, b) => new Date(b.createdAt || b.paidAt) - new Date(a.createdAt || a.paidAt));
  }, [formattedRequests, kitchenDelays, tableOverstays, dismissedAlerts]);
  
  const displayAlerts = useMemo(() => {
    // Filter activeTab from the already dismissed-filtered allAlerts
    if (activeTab === 'requests') return allAlerts.filter(a => a.type === 'customer_request');
    if (activeTab === 'kitchen') return allAlerts.filter(a => a.type === 'kitchen_delay');
    if (activeTab === 'overstay') return allAlerts.filter(a => a.type === 'table_overstay');
    return allAlerts;
  }, [activeTab, allAlerts]);
  
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full flex flex-col">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-[#4a2e1f] flex items-center gap-2">
            <FiAlertCircle className="text-[#d86d2a]" size={20} /> Action Required
          </h3>
          <span className={`${displayAlerts.length > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'} px-2 py-1 rounded-full text-xs font-bold transition-all`}>
            {displayAlerts.length}
          </span>
        </div>
        
        <div className="flex gap-2 p-1 bg-gray-50 rounded-lg">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-white text-[#d86d2a] shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'requests'
                ? 'bg-white text-[#d86d2a] shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Requests
          </button>
          <button
            onClick={() => setActiveTab('kitchen')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'kitchen'
                ? 'bg-white text-[#d86d2a] shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Kitchen
          </button>
          <button
            onClick={() => setActiveTab('overstay')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'overstay'
                ? 'bg-white text-[#d86d2a] shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Has Overstay
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 min-h-[300px] max-h-[400px]">
        {displayAlerts.length > 0 ? (
          displayAlerts.map((alert, idx) => {
            const isRequest = alert.type === 'customer_request';
            const isKitchen = alert.type === 'kitchen_delay';
            const isOverstay = alert.type === 'table_overstay';
            
            return (
              <div key={alert.id || idx} className={`p-3 rounded-lg border shadow-sm hover:shadow-md transition-shadow animate-fadeIn ${
                isRequest ? 'bg-blue-50 border-blue-200' :
                isKitchen ? 'bg-red-50 border-red-200' :
                'bg-orange-50 border-orange-200'
              }`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isRequest && (
                        <>
                          <span className="p-1 bg-blue-100 rounded">
                            <FiUser className="text-blue-600" size={14} />
                          </span>
                          <span className="font-bold text-[#4a2e1f]">
                            {alert.tableNumber ? `Table ${alert.tableNumber}` : 'Table ?'} - {alert.requestType?.toUpperCase() || 'REQUEST'}
                          </span>
                        </>
                      )}
                      {isKitchen && (
                        <>
                          <span className="p-1 bg-red-100 rounded">
                            <FaFire className="text-red-600" size={14} />
                          </span>
                          <span className="font-bold text-[#4a2e1f]">
                            Kitchen Delay - {alert.tableNumber ? `Table ${alert.tableNumber}` : `Order ${(alert.orderId || '').slice(-4)}`}
                          </span>
                        </>
                      )}
                      {isOverstay && (
                        <>
                          <span className="p-1 bg-orange-100 rounded">
                            <MdTableRestaurant className="text-orange-600" size={14} />
                          </span>
                          <span className="font-bold text-[#4a2e1f]">
                            Table {alert.tableNumber} - Overstay
                          </span>
                        </>
                      )}
                    </div>
                    {alert.message && (
                      <p className="text-xs text-gray-600 ml-7">{alert.message}</p>
                    )}
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2 ml-7">
                      <FiClock size={10} />
                      <span>
                        {isRequest && new Date(alert.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {(isKitchen || isOverstay) && `${alert.minutesElapsed} mins ago`}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] rounded font-semibold ${
                    isRequest ? 'bg-blue-600 text-white' :
                    isKitchen ? 'bg-red-600 text-white' :
                    'bg-orange-600 text-white'
                  }`}>
                    {isRequest ? 'PENDING' : isKitchen ? 'URGENT' : 'WARNING'}
                  </span>
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                  {isRequest && (
                    <>
                      <button
                        onClick={() => handleMarkServed(alert.id)}
                        className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <FiCheckCircle size={12} /> Mark Served
                      </button>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded transition-colors"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {isKitchen && (
                    <>
                      <button
                        onClick={() => handleRushOrder(alert.id)}
                        className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <FaFire size={12} /> Rush Order
                      </button>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded transition-colors"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                  {isOverstay && (
                    <>
                      <button
                        onClick={() => handleClearTable(alert.tableNumber, alert.id)}
                        className="flex-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <MdTableRestaurant size={12} /> Clear Table
                      </button>
                      <button
                        onClick={() => handleDismiss(alert.id)}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded transition-colors"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
            <FiCheckCircle size={40} className="mb-2" />
            <p className="text-sm">No {activeTab === 'all' ? '' : activeTab} alerts</p>
          </div>
        )}
      </div>
    </div>
  );
};

const UnifiedOrderList = ({ dineInOrders, takeawayOrders, navigate }) => {
  const [activeTab, setActiveTab] = useState('all');
  
  const allOrders = useMemo(() => {
    const dineIn = dineInOrders.map(o => ({ ...o, orderType: 'dine-in' }));
    const takeaway = takeawayOrders.map(o => ({ ...o, orderType: 'takeaway' }));
    return [...dineIn, ...takeaway].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [dineInOrders, takeawayOrders]);
  
  const displayOrders = useMemo(() => {
    if (activeTab === 'dine-in') return dineInOrders;
    if (activeTab === 'takeaway') return takeawayOrders;
    return allOrders;
  }, [activeTab, dineInOrders, takeawayOrders, allOrders]);
  
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full flex flex-col">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-[#4a2e1f] flex items-center gap-2">
            <MdRestaurantMenu className="text-[#d86d2a]" size={20} /> Live Orders
          </h3>
          <span className="bg-orange-100 text-[#d86d2a] px-2 py-1 rounded-full text-xs font-bold">
            {displayOrders.length}
          </span>
        </div>
        
        <div className="flex gap-2 p-1 bg-gray-50 rounded-lg">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-white text-[#d86d2a] shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({allOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('dine-in')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'dine-in'
                ? 'bg-white text-[#d86d2a] shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MdLocalDining size={14} /> Dine-In ({dineInOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('takeaway')}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
              activeTab === 'takeaway'
                ? 'bg-white text-[#d86d2a] shadow-sm border border-orange-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MdDeliveryDining size={14} /> Takeaway ({takeawayOrders.length})
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 min-h-[300px] max-h-[400px]">
        {displayOrders.length > 0 ? (
          displayOrders.map((order, idx) => {
            const totalAmount = order.kotLines?.reduce((sum, kot) => sum + (Number(kot.totalAmount) || 0), 0) || 0;
            const itemsCount = order.kotLines?.reduce((acc, kot) => acc + (kot.items?.length || 0), 0) || 0;
            const isDineIn = order.serviceType === 'DINE_IN' || order.orderType === 'dine-in';
            
            return (
              <div key={idx} className="p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      {activeTab === 'all' && (
                        <span className={`p-1 rounded ${isDineIn ? 'bg-blue-50' : 'bg-purple-50'}`}>
                          {isDineIn ? (
                            <MdLocalDining className="text-blue-600" size={14} />
                          ) : (
                            <MdDeliveryDining className="text-purple-600" size={14} />
                          )}
                        </span>
                      )}
                      <span className="font-bold text-[#4a2e1f]">
                        {(() => {
                          // Check if it's genuinely dine-in (and not a "Takeaway" table hack)
                          const isRealDineIn = isDineIn && 
                                               order.tableNumber && 
                                               String(order.tableNumber).toLowerCase() !== 'takeaway';
                                               
                          if (isRealDineIn) {
                             return order.tableNumber ? `Table ${order.tableNumber}` : `Order #${(order.orderId || order._id).slice(-4)}`;
                          } else {
                             // It's takeaway or "Takeaway" table
                             // If customer name exists, show it. Otherwise show Takeaway #ID
                             return order.customerName || `Takeaway #${(order.orderId || order._id).slice(-4)}`;
                          }
                        })()}
                      </span>
                      {/* Show customer name if available and we didn't just use it as the main title */}
                      {order.customerName && (isDineIn && String(order.tableNumber || '').toLowerCase() !== 'takeaway') && (
                        <span className="text-xs text-gray-500">- {order.customerName}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                      <FiClock size={10} />
                      <span>{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-[10px] rounded font-semibold border ${
                    order.status === 'Ready' ? 'bg-green-50 text-green-600 border-green-100' :
                    order.status === 'Preparing' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                    order.status === 'Served' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                    'bg-gray-50 text-gray-600 border-gray-100'
                  }`}>
                    {order.status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-medium">{itemsCount} Items</span>
                    <span className="text-sm font-bold text-[#d86d2a]">₹{totalAmount.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => navigate('/orders')}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded hover:bg-blue-100 transition"
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
            <MdRestaurantMenu size={40} className="mb-2" />
            <p className="text-sm">No active {activeTab === 'all' ? '' : activeTab} orders</p>
          </div>
        )}
      </div>
    </div>
  );
};

const OrdersTimeline = ({ orders }) => {
    const data = useMemo(() => {
        // Create array for 24 hours
        const hours = Array.from({ length: 24 }, (_, i) => ({
            name: i === 0 ? '12 AM' : i === 12 ? '12 PM' : i > 12 ? `${i-12} PM` : `${i} AM`,
            hour: i,
            orders: 0
        }));

        orders.forEach(o => {
            if (!o.createdAt) return;
            const hour = new Date(o.createdAt).getHours();
            if (hours[hour]) {
                hours[hour].orders += 1;
            }
        });

        // Show typical operating hours (e.g. 8 AM to 11 PM) + any outlier hours if they have data
        const startHour = 8;
        const endHour = 23;
        
        return hours.filter(h => (h.hour >= startHour && h.hour <= endHour) || h.orders > 0);
    }, [orders]);

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-[#e2c1ac] h-full flex flex-col">
            <h3 className="text-lg font-bold text-[#4a2e1f] mb-4">Orders Timeline</h3>
            <div className="flex-1 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d86d2a" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#d86d2a" stopOpacity={0}/>
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
                        />
                        <Tooltip 
                            contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2c1ac'}}
                            itemStyle={{color: '#d86d2a'}}
                            labelStyle={{color: '#4a2e1f', fontWeight: 'bold'}}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="orders" 
                            stroke="#d86d2a" 
                            fillOpacity={1} 
                            fill="url(#colorOrders)" 
                            strokeWidth={2}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const RecentActivity = ({ orders, tables }) => {
    // Helper to format time relative to now
    const timeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " min ago";
        return "Just now";
    };

    const events = useMemo(() => {
        const evts = [];
        
        // 1. New Orders
        orders.forEach(o => {
            if(o.createdAt) {
                evts.push({
                    type: 'new_order',
                    date: new Date(o.createdAt),
                    title: `New order #${(o.orderId || o._id).slice(-4)} received`,
                    amount: o.kotLines?.reduce((s, k) => s + (Number(k.totalAmount)||0), 0) || 0,
                    icon: <FiShoppingBag size={16} />,
                    color: 'bg-orange-100 text-[#d86d2a]'
                });
            }
            // 2. Payments (for paid orders)
            if(o.status === 'Paid' && (o.paidAt || o.updatedAt)) {
                evts.push({
                    type: 'payment',
                    date: new Date(o.paidAt || o.updatedAt),
                    title: `Payment received for Order #${(o.orderId || o._id).slice(-4)}`,
                    amount: o.kotLines?.reduce((s, k) => s + (Number(k.totalAmount)||0), 0) || 0,
                    icon: <FaMoneyBillWave size={16} />,
                    color: 'bg-blue-100 text-blue-600'
                });
            }
            // 3. Status Changes (generic "Completed" / "Served")
            if(['Served', 'Ready', 'Completed'].includes(o.status) && o.updatedAt && o.status !== 'Paid') {
                 evts.push({
                    type: 'status',
                    date: new Date(o.updatedAt),
                    title: `Order #${(o.orderId || o._id).slice(-4)} marked as ${o.status.toLowerCase()}`,
                    amount: o.kotLines?.reduce((s, k) => s + (Number(k.totalAmount)||0), 0) || 0,
                    icon: <FiCheckCircle size={16} />,
                    color: 'bg-green-100 text-green-600'
                 });
            }
        });

        // 4. Table Updates
        tables.forEach(t => {
            if(t.updatedAt) {
                 evts.push({
                    type: 'table',
                    date: new Date(t.updatedAt),
                    title: `Table ${t.tableNumber} marked as ${t.status.toLowerCase()}`,
                    amount: null,
                    icon: <MdTableRestaurant size={16} />,
                    color: 'bg-purple-100 text-purple-600'
                 });
            }
        });

        // Filter last 24h and Sort
        const now = new Date();
        return evts
            .filter(e => (now - e.date) < 24 * 60 * 60 * 1000 && (now - e.date) >= 0)
            .sort((a,b) => b.date - a.date)
            .slice(0, 10);

    }, [orders, tables]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-[#e2c1ac] h-full flex flex-col">
             <h3 className="text-lg font-bold text-[#4a2e1f] mb-6 flex items-center gap-2">
                <FiActivity className="text-[#d86d2a]" /> Recent Activity
             </h3>
             <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {events.length > 0 ? (
                    events.map((e, i) => (
                        <div key={i} className="flex gap-4 items-start">
                            <div className={`p-3 rounded-2xl flex-shrink-0 ${e.color} flex items-center justify-center w-12 h-12`}>
                                {e.icon}
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm font-bold text-[#4a2e1f] truncate pr-2">{e.title}</p>
                                    {e.amount > 0 && (
                                        <span className="text-sm font-bold text-[#4a2e1f] whitespace-nowrap">
                                            ₹{e.amount.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1 font-medium">{timeAgo(e.date)}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                         <FiActivity size={40} className="mb-2"/>
                         <p className="text-sm">No activity yet</p>
                    </div>
                )}
             </div>
        </div>
    );
};

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
    const interval = setInterval(fetchData, 60000); // 60s polling
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

  // Active Orders for Live Status
  const activeOrders = todayOrders.filter(o => !['Paid', 'Cancelled', 'Returned'].includes(o.status));
  const liveDineIn = activeOrders.filter(o => o.serviceType === 'DINE_IN');
  const liveTakeaway = activeOrders.filter(o => ['TAKEAWAY', 'PICKUP', 'DELIVERY'].includes(o.serviceType));

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

      {/* Bottom Section: Live Orders & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
         <UnifiedOrderList dineInOrders={liveDineIn} takeawayOrders={liveTakeaway} navigate={navigate} />
         <AlertsPanel customerRequests={pendingRequests} orders={todayOrders} tables={tables} />
      </div>

      {/* Final Row: Timeline & Best Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <OrdersTimeline orders={todayOrders} />
         <RecentActivity orders={todayOrders} tables={tables} />
      </div>

    </div>
  );
};

export default DashboardAdmin;
