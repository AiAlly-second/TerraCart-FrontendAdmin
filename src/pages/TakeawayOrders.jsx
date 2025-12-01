import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  ORDER_TRANSITIONS,
  canAccept,
  nextStatusOnAccept,
  getNextStatus,
  canCancel,
  canReturn,
} from "../domain/orderLogic";
import api from "../utils/api";

const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
const normalizeId = (value) =>
  typeof value === "string" ? value : value?.toString?.() || "";

const buildInvoiceId = (order) => {
  if (!order) return "";
  const date = new Date(order.createdAt || Date.now())
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const tail = (order._id || "").toString().slice(-6).toUpperCase();
  return `INV-${date}-${tail}`;
};

const formatMoney = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
};

const paiseToRupees = (value) => {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return num / 100;
};

// Aggregate all items from all KOTs
const aggregateKotItems = (kotLines = []) => {
  const map = new Map();
  (kotLines || []).forEach((kot) => {
    (kot?.items || []).forEach((item) => {
      if (!item || item.returned) return; // Skip returned items
      const name = item.name || "Item";
      const quantity = Number(item.quantity) || 0;
      const unitPrice = paiseToRupees(item.price || 0);
      if (!map.has(name)) {
        map.set(name, {
          name,
          unitPrice,
          quantity: 0,
          amount: 0,
        });
      }
      const entry = map.get(name);
      entry.quantity += quantity;
      entry.amount += unitPrice * quantity;
      if (!entry.unitPrice) {
        entry.unitPrice = unitPrice;
      }
    });
  });
  return Array.from(map.values());
};

// Calculate totals from actual items, not from KOT totals (to avoid rounding errors)
const computeKotTotals = (kotLines = [], aggregatedItems = []) => {
  // Calculate subtotal from non-returned items (amount is already in rupees)
  const subtotal = aggregatedItems.reduce((sum, item) => {
    const amount = Number(item.amount) || 0;
    return sum + amount;
  }, 0);
  
  // Round subtotal to 2 decimal places
  const subtotalRounded = Number(subtotal.toFixed(2));
  
  // Calculate GST (5%)
  const gst = Number((subtotalRounded * 0.05).toFixed(2));
  
  // Calculate total amount
  const totalAmount = Number((subtotalRounded + gst).toFixed(2));
  
  return {
    subtotal: subtotalRounded,
    gst: gst,
    totalAmount: totalAmount,
  };
};

const buildInvoiceMarkup = (order, franchiseData = null, cartData = null) => {
  if (!order) return "";
  const invoiceNumber = buildInvoiceId(order);
  const kotLines = Array.isArray(order.kotLines) ? order.kotLines : [];
  const aggregatedItems = aggregateKotItems(kotLines);
  const totals = computeKotTotals(kotLines, aggregatedItems);

  // Get cart address (prefer address, fallback to location)
  const cartAddress = cartData?.address || "—";
  // Get franchise GST number
  const franchiseGST = franchiseData?.gstNumber || "—";

  const rows =
    aggregatedItems.length > 0
      ? aggregatedItems
          .map((item) => {
            const quantity = item.quantity || 0;
            const price = item.unitPrice || 0;
            const amount = item.amount || 0;
            return `
              <tr>
                <td class="py-2 border-b">${item.name || ""}</td>
                <td class="py-2 border-b">${quantity}</td>
                <td class="py-2 border-b">₹${formatMoney(price)}</td>
                <td class="py-2 border-b text-right">₹${formatMoney(amount)}</td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td colspan="4" class="py-4 text-center text-gray-500 border-b">No items recorded.</td>
        </tr>
      `;

  return `
    <div class="invoice-root">
      <style>
        .invoice-root {
          font-family: 'Courier New', monospace;
          color: #000000;
          width: 80mm;
          max-width: 302px;
          margin: 0 auto;
          padding: 8px;
          border: none;
          background: #ffffff;
          font-size: 11px;
        }
        .invoice-header {
          display: block;
          margin-bottom: 12px;
          text-align: center;
        }
        .invoice-header h1 {
          margin: 0;
          font-size: 14px;
          font-weight: bold;
        }
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .invoice-table th {
          text-align: left;
          padding: 4px 2px;
          border-bottom: 1px dashed #000;
          color: #000;
          font-size: 9px;
        }
        .invoice-table td {
          padding: 3px 2px;
          font-size: 9px;
        }
        .invoice-line {
          margin-top: 6px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
        }
        .invoice-totals {
          margin-top: 12px;
          width: 100%;
          display: block;
        }
        .invoice-totals-inner {
          width: 100%;
        }
        .invoice-footer {
          margin-top: 16px;
          font-size: 8px;
          color: #000;
          text-align: center;
        }
      </style>
      <div class="invoice-header">
        <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px;">Terra Cart</div>
        <div style="font-size: 9px; margin-bottom: 2px;">${cartAddress}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">GSTIN: ${franchiseGST}</div>
        <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0;">Invoice</div>
        <div style="font-size: 9px; margin-bottom: 2px;">Invoice No: ${invoiceNumber}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">Date: ${new Date(
            order.paidAt || order.updatedAt || order.createdAt || Date.now()
          ).toLocaleDateString()}</div>
        </div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 10px; margin-bottom: 4px;">Billed To</div>
        <div style="font-size: 9px;">
          ${order.tableNumber || "TAKEAWAY"}
        </div>
      </div>
      <table class="invoice-table" style="margin-top: 16px;">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price (₹)</th>
            <th style="text-align:right;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div class="invoice-totals">
        <div class="invoice-totals-inner">
          <div class="invoice-line">
            <span>Subtotal</span>
            <span>₹${formatMoney(totals.subtotal)}</span>
          </div>
          <div class="invoice-line">
            <span>GST (5%)</span>
            <span>₹${formatMoney(totals.gst)}</span>
          </div>
          <div class="invoice-line" style="font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 12px;">
            <span>Total</span>
            <span>₹${formatMoney(totals.totalAmount)}</span>
          </div>
        </div>
      </div>
      <div class="invoice-footer">
        This is a system generated invoice. Thank you for dining with Terra Cart.
      </div>
    </div>
  `;
};

const printOrderInvoice = async (order) => {
  if (!order) return;

  // Fetch franchise and cart data
  let franchiseData = null;
  let cartData = null;

  try {
    // Fetch franchise data if franchiseId exists
    if (order.franchiseId) {
      const franchiseRes = await api.get(`/users/${order.franchiseId}`);
      if (franchiseRes.data) {
        franchiseData = {
          gstNumber: franchiseRes.data.gstNumber || null,
          name: franchiseRes.data.name || null,
        };
      }
    }

    // Fetch cart data if cartId exists
    if (order.cartId) {
      const cartRes = await api.get(`/users/${order.cartId}`);
      if (cartRes.data) {
        cartData = {
          address: cartRes.data.address || cartRes.data.location || null,
          cartName: cartRes.data.cartName || cartRes.data.name || null,
        };
      }
    }
  } catch (err) {
    console.error("Failed to load franchise/cart data:", err);
  }

  const html = buildInvoiceMarkup(order, franchiseData, cartData);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${buildInvoiceId(order)}</title>
        <style>
          * { box-sizing: border-box; }
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: 'Courier New', monospace;
            margin: 0; padding: 8px;
            background: white; color: #000;
            width: 80mm;
            max-width: 302px;
            font-size: 11px;
          }
          h1,h2,h3,h4 { margin: 0; }
          table { border-collapse: collapse; width: 100%; font-size: 9px; }
          th, td { padding: 3px 2px; border-bottom: 1px dashed #000; }
          th { text-align: left; font-size: 9px; }
          .invoice {
            width: 80mm;
            max-width: 302px;
            margin: 0 auto;
            padding: 8px;
          }
          .flex { display: flex; justify-content: space-between; }
          .totals div { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; }
          .totals div:last-child { font-weight: bold; }
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);
  doc.close();
  iframe.onload = function () {
  setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      document.body.removeChild(iframe);
    }, 50);
  };
};

const downloadOrderInvoice = async (order) => {
  if (!order) return;

  // Fetch franchise and cart data
  let franchiseData = null;
  let cartData = null;

  try {
    // Fetch franchise data if franchiseId exists
    if (order.franchiseId) {
      const franchiseRes = await api.get(`/users/${order.franchiseId}`);
      if (franchiseRes.data) {
        franchiseData = {
          gstNumber: franchiseRes.data.gstNumber || null,
          name: franchiseRes.data.name || null,
        };
      }
    }

    // Fetch cart data if cartId exists
    if (order.cartId) {
      const cartRes = await api.get(`/users/${order.cartId}`);
      if (cartRes.data) {
        cartData = {
          address: cartRes.data.address || cartRes.data.location || null,
          cartName: cartRes.data.cartName || cartRes.data.name || null,
        };
      }
    }
  } catch (err) {
    console.error("Failed to load franchise/cart data:", err);
  }

  const html = buildInvoiceMarkup(order, franchiseData, cartData);
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.top = "-10000px";
  wrapper.style.left = "-10000px";
  wrapper.style.opacity = "0";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  const element = wrapper.querySelector(".invoice-root");
  if (!element) {
    document.body.removeChild(wrapper);
    alert("Failed to render invoice for download.");
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 'auto']
    });
    const pdfWidth = 80;
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 4;
    const usableWidth = pdfWidth - margin * 2;

    const imgProps = pdf.getImageProperties(imageData);
    const imgRatio = imgProps.height / imgProps.width;
    const imgHeight = usableWidth * imgRatio;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imageData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= (pdfHeight - margin * 2);

    while (heightLeft > 0) {
      pdf.addPage();
      position = margin - heightLeft;
      pdf.addImage(imageData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= (pdfHeight - margin * 2);
    }

    pdf.save(`${buildInvoiceId(order)}.pdf`);
  } catch (err) {
    console.error("Failed to download invoice PDF", err);
    alert("Failed to generate PDF. Please try again.");
  } finally {
    if (document.body.contains(wrapper)) {
    document.body.removeChild(wrapper);
    }
  }
};

const TakeawayOrders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchTable, setSearchTable] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [expanded, setExpanded] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);

  const socketRef = React.useRef(null);
  const upsertOrder = React.useCallback(
    (incoming, { prepend = false } = {}) => {
      if (!incoming || incoming.serviceType !== "TAKEAWAY") return;
      const incomingId = normalizeId(incoming._id);
      if (!incomingId) return;

      setOrders((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const index = list.findIndex(
          (order) => normalizeId(order._id) === incomingId
        );

        if (index >= 0) {
          list[index] = incoming;
          return list;
        }

        return prepend ? [incoming, ...list] : [...list, incoming];
      });
    },
    [setOrders]
  );

  useEffect(() => {
    let active = true;

    const fetchOrders = async () => {
      try {
        // Use authenticated API to get orders filtered by cartId for cart admins
        const res = await api.get("/orders");
        const data = res.data || [];
        if (!active) return;
        // Filter for takeaway orders only
        const takeawayOrders = (Array.isArray(data) ? data : []).filter(
          (order) => order.serviceType === "TAKEAWAY"
        );
        console.log(`[TakeawayOrders] Fetched ${takeawayOrders.length} takeaway orders out of ${data.length} total orders`);
        setOrders(takeawayOrders);
      } catch (err) {
        console.error("Failed to load takeaway orders:", err);
        // Show user-friendly error message
        if (err.response?.status === 401) {
          console.warn("Authentication failed - user may need to login again");
        } else if (err.response?.status === 403) {
          console.warn("Access denied - user may not have permission");
        }
      }
    };

    fetchOrders();

    const socket = io(nodeApi);
    socketRef.current = socket;

    const handleNewOrder = (order) => {
      upsertOrder(order, { prepend: true });
    };

    const handleOrderUpdated = (order) => {
      upsertOrder(order);
    };

    const handleOrderDeleted = ({ id }) => {
      setOrders((prev) => prev.filter((order) => order._id !== id));
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderUpdated", handleOrderUpdated);
    socket.on("orderDeleted", handleOrderDeleted);

    return () => {
      active = false;
      socket.off("newOrder", handleNewOrder);
      socket.off("orderUpdated", handleOrderUpdated);
      socket.off("orderDeleted", handleOrderDeleted);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const changeStatus = async (orderId, newStatus) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      upsertOrder(response.data);
    } catch (e) {
      console.error("Status change failed:", e);
      const errorMessage = e.response?.data?.message || e.message || "Status update failed";
      alert(`Failed to change status: ${errorMessage}`);
    }
  };

  const handleEdit = (order) => {
    setCurrentOrder(order);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!currentOrder?._id) {
      return;
    }

    try {
      // Update status if changed
      const newStatus = form.status.value;
      if (newStatus !== currentOrder.status) {
        await api.patch(`/orders/${currentOrder._id}/status`, { status: newStatus });
      }

      // Refresh orders list by fetching again
      const ordersRes = await api.get("/orders");
      const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const takeawayOrders = allOrders.filter((o) => o.serviceType === "TAKEAWAY");
      
      setOrders(takeawayOrders);

      setIsModalOpen(false);
      setCurrentOrder(null);
      alert("Order updated successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      const errorMessage = err.response?.data?.message || "Failed to update order. Please try again.";
      alert(errorMessage);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this takeaway order?")) {
      return;
    }
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch (err) {
      console.error("Delete failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to delete order";
      alert(errorMessage);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Paid":
        return "✅";
      case "Confirmed":
        return "👨‍🍳";
      case "Preparing":
        return "🔥";
      case "Ready":
        return "🍽️";
      case "Served":
        return "🍴";
      case "Finalized":
        return "📋";
      case "Pending":
        return "⏳";
      case "Cancelled":
        return "❌";
      case "Returned":
        return "↩️";
      default:
        return "📦";
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statusSummary = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc.byStatus[order.status] = (acc.byStatus[order.status] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} }
    );
  }, [orders]);

  const statusBadgeClass = (status) => {
    switch (status) {
      case "Paid":
        return "border-green-200 text-green-700 bg-green-50";
      case "Confirmed":
        return "border-yellow-200 text-yellow-700 bg-yellow-50";
      case "Preparing":
        return "border-blue-200 text-blue-700 bg-blue-50";
      case "Ready":
        return "border-purple-200 text-purple-700 bg-purple-50";
      case "Returned":
        return "border-rose-200 text-rose-700 bg-rose-50";
      case "Cancelled":
        return "border-red-200 text-red-700 bg-red-50";
      default:
        return "border-gray-200 text-gray-700 bg-gray-50";
    }
  };

  const filteredOrders = useMemo(() => {
    const normalizedOrder = searchOrderId.trim().toLowerCase();
    const normalizedTable = searchTable.trim().toLowerCase();
    const normalizedInvoice = searchInvoice.trim().toLowerCase();

    const matches = orders.filter((order) => {
      const orderIdMatch =
        !normalizedOrder || (order._id || "").toLowerCase().includes(normalizedOrder);
      const tableMatch =
        !normalizedTable ||
        (order.tableNumber !== undefined &&
          order.tableNumber !== null &&
          String(order.tableNumber).toLowerCase().includes(normalizedTable));
      const invoiceId = buildInvoiceId(order).toLowerCase();
      const invoiceMatch = !normalizedInvoice || invoiceId.includes(normalizedInvoice);
      return orderIdMatch && tableMatch && invoiceMatch;
    });

    if (filterStatus === "all") return matches;
    return matches.filter((order) => order.status === filterStatus);
  }, [orders, searchOrderId, searchTable, searchInvoice, filterStatus]);

  const tryAccept = (order) => {
    if (canAccept(order.status)) {
      changeStatus(order._id, nextStatusOnAccept);
    }
  };

  const transitions = ORDER_TRANSITIONS;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="text-3xl font-bold text-gray-800">Takeaway Orders</h1>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Order ID / token"
            value={searchOrderId}
            onChange={(e) => setSearchOrderId(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-48"
          />
          <input
            type="text"
            placeholder="Table number"
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-40"
          />
          <input
            type="text"
            placeholder="Invoice ID"
            value={searchInvoice}
            onChange={(e) => setSearchInvoice(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-52"
          />
          <button
            onClick={() => {
              setSearchOrderId("");
              setSearchTable("");
              setSearchInvoice("");
            }}
            className="border border-gray-200 text-gray-600 hover:bg-gray-100 py-2 px-3 rounded-lg text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`p-4 rounded-lg border shadow-sm text-left transition outline-none ${
            filterStatus === "all" ? "ring-2 ring-blue-400" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{statusSummary.total}</div>
              <div className="text-sm">All Takeaway</div>
            </div>
            <div className="text-2xl">🥡</div>
          </div>
        </button>

        {Object.entries(statusSummary.byStatus).map(([status, count]) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`p-4 rounded-lg border shadow-sm text-left transition outline-none ${
              filterStatus === status ? "ring-2 ring-blue-400" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm">{status}</div>
              </div>
              <div className="text-2xl">
                {status === "Pending"
                  ? "⏳"
                  : status === "Confirmed"
                  ? "👨‍🍳"
                  : status === "Preparing"
                  ? "🔥"
                  : status === "Ready"
                  ? "🍽️"
                  : status === "Paid"
                  ? "✅"
                  : status === "Returned"
                  ? "↩️"
                  : status === "Cancelled"
                  ? "❌"
                  : "📦"}
              </div>
            </div>
          </button>
        ))}
      </div>

  <div className="overflow-x-auto bg-white rounded-lg shadow-md">
    <table className="min-w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Order Details
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Table
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {filteredOrders.length === 0 && (
          <tr>
            <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
              No takeaway orders match the current filters.
            </td>
          </tr>
        )}
        {filteredOrders.map((order) => (
          <React.Fragment key={order._id}>
            <tr
              className={`hover:bg-gray-50 ${
                order.status === "Pending" ? "bg-orange-50" : ""
              }`}
            >
              <td className="px-6 py-4 text-sm">
                <button
                  onClick={() => toggleExpand(order._id)}
                  className="flex items-center gap-2"
                >
                  <span className="font-mono text-xs text-gray-500">
                    {buildInvoiceId(order)}
                  </span>
                  <span className="text-gray-900 font-medium">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </button>
                {expanded[order._id] && (
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
                    <div>
                      Invoice:{" "}
                      <span className="font-mono">{buildInvoiceId(order)}</span>
                    </div>
                    <div>Service Type: Takeaway</div>
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🥡</span>
                  <span className="text-lg font-semibold text-gray-700">
                    {order.tableNumber || "TAKEAWAY"}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-2">
                  <span
                    className={`px-3 py-1 inline-flex items-center gap-2 text-sm font-medium rounded-full border ${statusBadgeClass(order.status)}`}
                  >
                    {order.status}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(() => {
                      const nextStatus = getNextStatus(order.status);
                      const buttons = [];

                      if (canAccept(order.status)) {
                        buttons.push(
                          <button
                            key="accept"
                            onClick={() => tryAccept(order)}
                            className="px-3 py-1 text-xs font-semibold rounded border border-green-200 text-green-700 hover:bg-green-50 bg-green-50"
                          >
                            ✅ Accept (Preparing)
                          </button>
                        );
                      }

                      // Show next sequential step button (but skip if canAccept is true to avoid duplicate Preparing button)
                      if (nextStatus && !canAccept(order.status)) {
                        buttons.push(
                          <button
                            key="next"
                            onClick={() => changeStatus(order._id, nextStatus)}
                            className="px-3 py-1 text-xs font-semibold rounded border border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50"
                          >
                            {nextStatus}
                          </button>
                        );
                      }

                      if (canReturn(order.status)) {
                        buttons.push(
                          <button
                            key="return"
                            onClick={() => changeStatus(order._id, "Returned")}
                            className="px-3 py-1 text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50"
                          >
                            ↩️ Return Order
                          </button>
                        );
                      } else if (canCancel(order.status)) {
                        buttons.push(
                          <button
                            key="cancel"
                            onClick={() => changeStatus(order._id, "Cancelled")}
                            className="px-3 py-1 text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            ❌ Cancel
                          </button>
                        );
                      }

                      return buttons;
                    })()}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleEdit(order)}
                    className="px-3 py-1 text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded-md hover:bg-indigo-50"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(order._id)}
                    className="px-3 py-1 text-red-600 hover:text-red-900 border border-red-200 rounded-md hover:bg-red-50"
                  >
                    🗑️ Delete
                  </button>
                  <button
                    onClick={() => printOrderInvoice(order)}
                    disabled={!["paid", "confirmed"].includes((order.status || "").toLowerCase())}
                    className={`px-3 py-1 rounded-md border ${
                      ["paid", "confirmed"].includes((order.status || "").toLowerCase())
                        ? "text-gray-700 border-gray-200 hover:bg-gray-100"
                        : "text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                    }`}
                    title={
                      ["paid", "confirmed"].includes((order.status || "").toLowerCase())
                        ? "Print invoice"
                        : "Invoice available after order is confirmed"
                    }
                  >
                    🖨️ Print
                  </button>
                  <button
                    onClick={() => downloadOrderInvoice(order)}
                    disabled={!["paid", "confirmed"].includes((order.status || "").toLowerCase())}
                    className={`px-3 py-1 rounded-md border ${
                      ["paid", "confirmed"].includes((order.status || "").toLowerCase())
                        ? "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        : "text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                    }`}
                    title={
                      ["paid", "confirmed"].includes((order.status || "").toLowerCase())
                        ? "Download invoice PDF"
                        : "Invoice available after order is confirmed"
                    }
                  >
                    ⬇️ PDF
                  </button>
                  <button
                    onClick={() => {
                      // Navigate to feedback page with order ID to filter feedback for this order
                      navigate(`/feedback?orderId=${order._id}`);
                    }}
                    disabled={(order.status || "").toLowerCase() !== "paid"}
                    className={`px-3 py-1 rounded-md border ${
                      (order.status || "").toLowerCase() === "paid"
                        ? "text-green-700 border-green-200 hover:bg-green-50"
                        : "text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                    }`}
                    title={
                      (order.status || "").toLowerCase() === "paid"
                        ? "View feedback for this order"
                        : "Feedback available after payment"
                    }
                  >
                    💬 Feedback
                  </button>
                </div>
              </td>
            </tr>

            {expanded[order._id] && (
              <tr className="bg-gray-50">
                <td colSpan="4" className="px-6 py-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(order.kotLines || []).map((kot, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-4 rounded-lg border shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-lg font-semibold text-gray-800">
                              KOT #{idx + 1}
                            </div>
                            <div className="text-lg font-bold text-green-600">
                              ₹{(kot.totalAmount || kot.total || 0).toString()}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(kot.items || []).map((item, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center py-1 border-b"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold">
                                    {item.quantity}x
                                  </span>
                                  <span className="text-gray-800">{item.name}</span>
                                </div>
                                <span className="text-gray-600">
                                  ₹{(
                                    ((item.price || 0) / 100) *
                                    (item.quantity || 1)
                                  ).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Edit Takeaway Order
              </h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setCurrentOrder(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSave}
              className="space-y-6"
            >
              <div>
                <label className="block text-gray-700 text-sm font-semibold mb-2">
                  Order Status {getStatusIcon(currentOrder?.status || "Pending")}
                </label>
                <select
                  name="status"
                  defaultValue={currentOrder?.status || "Pending"}
                  className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="Pending">⏳ Pending</option>
                  <option value="Confirmed">👨‍🍳 Confirmed</option>
                  <option value="Preparing">🔥 Preparing</option>
                  <option value="Ready">🍽️ Ready</option>
                  <option value="Paid">✅ Paid</option>
                  <option value="Cancelled">❌ Cancelled</option>
                  <option value="Returned">↩️ Returned</option>
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCurrentOrder(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
</div>
  );
};

export default TakeawayOrders;









