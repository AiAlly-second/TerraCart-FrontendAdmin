import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { useAuth } from "../context/AuthContext";

// Use Vite environment variable if available, fallback to localhost:5001
const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
const socket = io(nodeApi); // Connect socket to configured backend

const buildInvoiceId = (order) => {
  if (!order) return "";
  const date = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10).replace(/-/g, "");
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

const normalizeId = (value) =>
  typeof value === "string" ? value : value?.toString?.() || "";

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
          Table ${order.tableNumber || "—"}
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

const Orders = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const filterCafeId = searchParams.get("cafeId");
  const [orders, setOrders] = useState([]);
  const [cafeInfo, setCafeInfo] = useState(null);
  const [carts, setCarts] = useState([]); // For franchise admin: list of carts
  const [expandedCarts, setExpandedCarts] = useState({}); // Track expanded cart sections
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchTable, setSearchTable] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [expanded, setExpanded] = useState({}); // track expanded rows
  const [filterStatus, setFilterStatus] = useState("all");
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [draftSelections, setDraftSelections] = useState({});
  const [draftSearch, setDraftSearch] = useState("");
  const [draftCategory, setDraftCategory] = useState("all");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [draftServiceType, setDraftServiceType] = useState("DINE_IN");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const upsertOrder = useCallback(
    (incoming, { prepend = false } = {}) => {
      // STRICT: Only process DINE_IN orders, completely ignore TAKEAWAY orders
      if (!incoming || incoming.serviceType !== "DINE_IN") {
        console.log('[Orders] Ignoring non-DINE_IN order:', incoming?.serviceType, incoming?._id);
        return;
      }
      const incomingId = normalizeId(incoming._id);
      if (!incomingId) return;

      setOrders((prev) => {
        // Also filter out any TAKEAWAY orders that might have slipped in
        const filteredPrev = Array.isArray(prev) ? prev.filter(o => o.serviceType === "DINE_IN") : [];
        const list = [...filteredPrev];
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
    []
  );

  const getStatusClass = (status) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800 border-green-200";
      case "Confirmed":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Preparing":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Ready":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Served":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Finalized":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Pending":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Cancelled":
        return "bg-red-100 text-red-800 border-red-200";
    case "Returned":
      return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
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
        return "🤝";
      case "Finalized":
        return "✨";
      case "Pending":
        return "⏳";
      case "Cancelled":
        return "❌";
    case "Returned":
      return "↩️";
      default:
        return "⚪";
    }
  };

  // Use shared transitions for edit modal
  const transitions = ORDER_TRANSITIONS;

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

  const tryAccept = (order) => {
    if (canAccept(order.status)) {
      changeStatus(order._id, nextStatusOnAccept);
    }
  };

  // Render order row (reusable for both grouped and flat views)
  const renderOrderRow = (order) => (
    <React.Fragment key={order._id}>
      <tr className={`hover:bg-gray-50 ${order.status === 'Pending' ? 'bg-orange-50' : ''}`}>
        <td className="px-6 py-4 text-sm">
          <button onClick={() => toggleExpand(order._id)} className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-500">{buildInvoiceId(order)}</span>
            <span className="text-gray-900 font-medium">{new Date(order.createdAt).toLocaleTimeString()}</span>
          </button>
          {expanded[order._id] && (
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
              <div>
                Invoice:{" "}
                <span className="font-mono">{buildInvoiceId(order)}</span>
              </div>
              <div>
                Service Type:{" "}
                <span className="font-semibold text-gray-700">
                  {order.serviceType === "TAKEAWAY" ? "Takeaway" : "Dine-In"}
                </span>
              </div>
            </div>
          )}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪑</span>
            <span className="text-lg font-semibold text-gray-700">{order.tableNumber || 'N/A'}</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col gap-2">
            <span className={`px-3 py-1 inline-flex items-center gap-2 text-sm font-medium rounded-full border ${getStatusClass(order.status)}`}>
              {getStatusIcon(order.status)} {order.status}
            </span>
            {/* Sequential flow - show only next step + cancel option */}
            <div className="flex flex-wrap gap-1 mt-1">
              {(() => {
                const nextStatus = getNextStatus(order.status);
                const buttons = [];
                
                // Show Accept button for Confirmed orders
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
                      onClick={() => changeStatus(order._id, 'Returned')}
                      className="px-3 py-1 text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50"
                    >
                      ↩️ Return Order
                    </button>
                  );
                } else if (canCancel(order.status)) {
                  buttons.push(
                    <button
                      key="cancel"
                      onClick={() => changeStatus(order._id, 'Cancelled')}
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
                {Array.isArray(order.kotLines) && order.kotLines.map((kot, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-lg font-semibold text-gray-800">KOT #{idx + 1}</div>
                      <div className="text-lg font-bold text-green-600">₹{(kot.totalAmount || kot.total || 0).toString()}</div>
                    </div>
                    <div className="space-y-2">
                      {(kot.items || []).map((item, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b">
                          <div className="flex items-center gap-2">
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-lg text-xs font-bold">
                              {item.quantity}x
                            </span>
                            <span className="text-gray-800">{item.name}</span>
                          </div>
                          <span className="text-gray-600">₹{((item.price||0)/100 * (item.quantity||1)).toFixed(2)}</span>
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
  );

  useEffect(() => {
    const fetchData = async () => {
      if (filterCafeId) {
        // Fetch cart info for the filter
        try {
          const cafeRes = await api.get(`/users/${filterCafeId}`);
          setCafeInfo(cafeRes.data);
        } catch (err) {
          console.error("Failed to fetch cart info:", err);
        }
      }
      
      // For franchise admin without filter: fetch all carts
      if (user?.role === 'franchise_admin' && !filterCafeId) {
        try {
          const usersRes = await api.get("/users");
          const allUsers = usersRes.data || [];
          // Filter admin users (carts) that belong to this franchise
          const franchiseCarts = allUsers.filter((u) => {
            return u.role === "admin" && 
                   u.franchiseId && 
                   (u.franchiseId._id?.toString() === user._id?.toString() || 
                    u.franchiseId.toString() === user._id?.toString());
          });
          setCarts(franchiseCarts);
          console.log(`[Orders] Found ${franchiseCarts.length} carts for franchise admin`);
        } catch (err) {
          console.error("Failed to fetch carts:", err);
        }
      }
      
      // Fetch initial orders
      try {
        const res = await api.get("/orders");
        const data = res.data || [];
        
        // STRICT: Only show DINE_IN orders, completely filter out TAKEAWAY orders
        let dineInOrders = Array.isArray(data) ? data.filter(
          (order) => order.serviceType === "DINE_IN"
        ) : [];
        
        // If cartId filter is provided, filter by specific cart
        if (filterCafeId) {
          dineInOrders = dineInOrders.filter((order) => {
            let orderCafeId = order.cafeId || order.cartId;
            if (orderCafeId && typeof orderCafeId === 'object') {
              orderCafeId = orderCafeId._id || orderCafeId;
            }
            // Also check table.cafeId as fallback
            if (!orderCafeId && order.table && order.table.cafeId) {
              orderCafeId = order.table.cafeId;
              if (typeof orderCafeId === 'object') {
                orderCafeId = orderCafeId._id || orderCafeId;
              }
            }
            return orderCafeId && orderCafeId.toString() === filterCafeId;
          });
          console.log(`Filtered orders for cart ${filterCafeId}:`, dineInOrders.length);
        }
        
        console.log("Fetched dine-in orders:", dineInOrders.length, "out of", data.length || 0, "total orders");
        setOrders(dineInOrders);
      } catch (err) {
        console.error("Failed to fetch orders:", err);
      }
    };

    fetchData();

    socket.on("newOrder", (order) => {
      // Only add if it matches the filter (if any)
      if (!filterCafeId) {
        upsertOrder(order, { prepend: true });
      } else {
        let orderCafeId = order.cafeId;
        if (orderCafeId && typeof orderCafeId === 'object') {
          orderCafeId = orderCafeId._id || orderCafeId;
        }
        if (orderCafeId && orderCafeId.toString() === filterCafeId) {
          upsertOrder(order, { prepend: true });
        }
      }
    });

    socket.on("orderUpdated", (updatedOrder) => {
      // Only update if it matches the filter (if any)
      if (!filterCafeId) {
        upsertOrder(updatedOrder);
      } else {
        let orderCafeId = updatedOrder.cafeId;
        if (orderCafeId && typeof orderCafeId === 'object') {
          orderCafeId = orderCafeId._id || orderCafeId;
        }
        if (orderCafeId && orderCafeId.toString() === filterCafeId) {
          upsertOrder(updatedOrder);
        } else {
          // Remove if it no longer matches filter
          setOrders((prev) => prev.filter((order) => order._id !== updatedOrder._id));
        }
      }
    });

    socket.on("orderDeleted", ({ id }) => {
      setOrders((prev) => prev.filter((order) => order._id !== id));
    });

    return () => {
      socket.off("newOrder");
      socket.off("orderUpdated");
      socket.off("orderDeleted");
    };
  }, [upsertOrder, filterCafeId, user]);

  const handleAdd = () => {
    setCurrentOrder({ isNew: true });
    resetDraft();
    // Ensure menu is loaded when opening Add Order modal
    if (menuItems.length === 0 && !menuLoading) {
      loadMenu();
    }
    setIsModalOpen(true);
  };

  const handleEdit = (order) => {
    setCurrentOrder(order);
    // Reset draft selections when opening edit modal
    setDraftSelections({});
    setDraftSearch("");
    setDraftCategory("all");
    // Ensure menu is loaded
    if (menuItems.length === 0) {
      loadMenu();
    }
    setIsModalOpen(true);
  };

  const handleDelete = (orderId) => {
    if (window.confirm("Are you sure you want to delete this order?")) {
  api.delete(`/orders/${orderId}`)
        .then(() => {
          setOrders((prev) => prev.filter((order) => order._id !== orderId));
        })
        .catch((err) => {
          console.error("Delete failed:", err);
          const errorMessage = err.response?.data?.message || err.message || "Failed to delete order";
          alert(errorMessage);
        });
    }
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

      // Add new items if any are selected
      if (draftItemsArray.length > 0) {
        const itemsToAdd = draftItemsArray.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        }));

        await api.post(`/orders/${currentOrder._id}/add-items`, { items: itemsToAdd });
      }

      // Refresh orders list by fetching again
      const ordersRes = await api.get("/orders");
      const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      let dineInOrders = allOrders.filter((o) => o.serviceType === "DINE_IN");
      
      // Re-apply cart filter if active
      if (filterCafeId) {
        dineInOrders = dineInOrders.filter((order) => {
          let orderCafeId = order.cafeId;
          if (orderCafeId && typeof orderCafeId === 'object') {
            orderCafeId = orderCafeId._id || orderCafeId;
          }
          if (!orderCafeId && order.table && order.table.cafeId) {
            orderCafeId = order.table.cafeId;
            if (typeof orderCafeId === 'object') {
              orderCafeId = orderCafeId._id || orderCafeId;
            }
          }
          return orderCafeId && orderCafeId.toString() === filterCafeId;
        });
      }
      
      setOrders(dineInOrders);

      setIsModalOpen(false);
      setCurrentOrder(null);
      resetDraft();
      alert("Order updated successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      const errorMessage = err.response?.data?.message || "Failed to update order. Please try again.";
      alert(errorMessage);
    }
  };

  const handleSubmitNewOrder = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (draftItemsArray.length === 0) {
      setCreateError("Please add at least one menu item to the order.");
      return;
    }

    // For DINE_IN orders, table selection is required
    // For TAKEAWAY orders, no table selection needed (counter orders)
    if (draftServiceType === "DINE_IN") {
      if (!selectedTableId) {
        setCreateError("Please select a table for this order.");
        return;
      }

      const tableSource = tables.find((t) => t._id === selectedTableId);
      const table = tableSource;
      if (!table) {
        setCreateError("Selected table could not be found. Refresh the page and try again.");
        return;
      }

      // Check table availability for DINE_IN orders
      if (table.status !== "AVAILABLE" && !table.sessionToken) {
        setCreateError(`Table ${table.number || table.name || ""} is not currently available.`);
        return;
      }
    }

    setCreateSubmitting(true);

    try {
      let sessionToken = null;
      let table = null;
      let tableNumber = null;
      
      // For DINE_IN orders, we need a table and session token
      // For TAKEAWAY orders, no table needed (counter orders)
      if (draftServiceType === "DINE_IN") {
        table = tables.find((t) => t._id === selectedTableId);
        if (!table) {
          throw new Error("Selected table could not be found.");
        }
        
        tableNumber = table.number || table.tableNumber;
        sessionToken = table.sessionToken;
        if (!sessionToken) {
          if (!table.qrSlug) {
            throw new Error("Unable to claim table: missing QR slug.");
          }
          const lookupRes = await fetch(`${nodeApi}/api/tables/lookup/${table.qrSlug}`);
          const lookupPayload = await lookupRes.json().catch(() => ({}));
          if (lookupRes.status === 423) {
            throw new Error(lookupPayload?.message || "Table is currently assigned to another guest.");
          }
          if (!lookupRes.ok) {
            throw new Error(lookupPayload?.message || "Failed to allocate table. Please try again.");
          }
          sessionToken =
            lookupPayload.sessionToken ||
            lookupPayload.table?.sessionToken ||
            null;
        }

        if (!sessionToken) {
          throw new Error("Unable to obtain a session token for this table. Ask staff to release the table.");
        }
      }
      // For TAKEAWAY orders, no table or sessionToken needed (counter orders)

      const itemsPayload = draftItemsArray.map((entry) => ({
        name: entry.name,
        quantity: entry.quantity,
        price: entry.price,
      }));

      const payload = {
        serviceType: draftServiceType,
        tableId: draftServiceType === "TAKEAWAY" ? null : (table?._id || null), // TAKEAWAY orders don't need tableId
        tableNumber: draftServiceType === "TAKEAWAY" ? "TAKEAWAY" : (tableNumber || null), // TAKEAWAY orders use "TAKEAWAY" as table number
        sessionToken: draftServiceType === "TAKEAWAY" ? undefined : sessionToken, // TAKEAWAY orders don't need sessionToken
        items: itemsPayload,
      };

      const { data: created } = await api.post("/orders", payload);
      // Only add to orders list if it's a DINE_IN order
      if (created?.serviceType === "DINE_IN") {
        setOrders((prev) => {
          // Ensure we don't have any TAKEAWAY orders in the list
          const filteredPrev = Array.isArray(prev) ? prev.filter(o => o.serviceType === "DINE_IN") : [];
          return [created, ...filteredPrev];
        });
      } else {
        console.log('[Orders] Created order is TAKEAWAY, not adding to DINE_IN orders list');
      }
      setIsModalOpen(false);
      setCurrentOrder(null);
      resetDraft();
      loadTables();
    } catch (err) {
      console.error("Failed to create order", err);
      setCreateError(err.message || "Failed to create order. Please try again.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const updateNewItem = (idx, field, value) => {
    setNewItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const addNewItemRow = () => setNewItems((prev) => [...prev, { name: "", quantity: 1, price: 0 }]);
  const removeNewItemRow = (idx) => setNewItems((prev) => prev.filter((_, i) => i !== idx));

  // Group orders by cart for franchise admin
  const ordersByCart = useMemo(() => {
    if (user?.role !== 'franchise_admin' || filterCafeId) {
      return null; // Don't group if not franchise admin or if filtering by specific cart
    }
    
    const grouped = {};
    carts.forEach(cart => {
      const cartId = cart._id?.toString() || cart._id;
      grouped[cartId] = {
        cart,
        orders: []
      };
    });
    
    orders.forEach(order => {
      let orderCartId = order.cafeId || order.cartId;
      if (orderCartId && typeof orderCartId === 'object') {
        orderCartId = orderCartId._id || orderCartId;
      }
      if (!orderCartId && order.table && order.table.cafeId) {
        orderCartId = order.table.cafeId;
        if (typeof orderCartId === 'object') {
          orderCartId = orderCartId._id || orderCartId;
        }
      }
      
      const cartIdStr = orderCartId?.toString();
      if (cartIdStr && grouped[cartIdStr]) {
        grouped[cartIdStr].orders.push(order);
      } else if (cartIdStr) {
        // Cart not in our list, create entry
        grouped[cartIdStr] = {
          cart: { _id: cartIdStr, name: 'Unknown Cart', cartName: 'Unknown Cart' },
          orders: [order]
        };
      }
    });
    
    return grouped;
  }, [orders, carts, user, filterCafeId]);

  const filteredOrders = (() => {
    const normalizedOrder = searchOrderId.trim().toLowerCase();
    const normalizedTable = searchTable.trim().toLowerCase();
    const normalizedInvoice = searchInvoice.trim().toLowerCase();

    // STRICT: Only show DINE_IN orders, filter out any TAKEAWAY orders that might have slipped in
    const dineInOrders = orders.filter((order) => order.serviceType === "DINE_IN");

    const matches = dineInOrders.filter((order) => {
      const orderIdMatch = !normalizedOrder || (order._id || "").toLowerCase().includes(normalizedOrder);
      const tableMatch =
        !normalizedTable ||
        (order.tableNumber !== undefined &&
          order.tableNumber !== null &&
          String(order.tableNumber).toLowerCase().includes(normalizedTable));
      const invoiceId = buildInvoiceId(order).toLowerCase();
      const invoiceMatch = !normalizedInvoice || invoiceId.includes(normalizedInvoice);
      return orderIdMatch && tableMatch && invoiceMatch;
    });

    if (filterStatus === 'all') return matches;
    return matches.filter((o) => o.status === filterStatus);
  })();

  // Filter orders by cart for grouped view
  const getFilteredOrdersForCart = (cartOrders) => {
    const normalizedOrder = searchOrderId.trim().toLowerCase();
    const normalizedTable = searchTable.trim().toLowerCase();
    const normalizedInvoice = searchInvoice.trim().toLowerCase();

    const matches = cartOrders.filter((order) => {
      const orderIdMatch = !normalizedOrder || (order._id || "").toLowerCase().includes(normalizedOrder);
      const tableMatch =
        !normalizedTable ||
        (order.tableNumber !== undefined &&
          order.tableNumber !== null &&
          String(order.tableNumber).toLowerCase().includes(normalizedTable));
      const invoiceId = buildInvoiceId(order).toLowerCase();
      const invoiceMatch = !normalizedInvoice || invoiceId.includes(normalizedInvoice);
      return orderIdMatch && tableMatch && invoiceMatch;
    });

    if (filterStatus === 'all') return matches;
    return matches.filter((o) => o.status === filterStatus);
  };

  const toggleCartExpand = (cartId) => {
    setExpandedCarts((prev) => ({ ...prev, [cartId]: !prev[cartId] }));
  };

  const loadMenu = useCallback(async () => {
    try {
      setMenuLoading(true);
      setMenuError("");
      // Use authenticated API endpoint which automatically filters by cartId for cart admins
      const res = await api.get("/menu");
      const payload = res.data || [];
      
      if (!Array.isArray(payload) || payload.length === 0) {
        setMenuError("No menu items found. Please add menu items first.");
        setMenuCategories([{ id: "all", label: "All" }]);
        setMenuItems([]);
        return;
      }
      
      const safeCategories = payload.map((category) => ({
        name: category.name || "Menu",
        items: (category.items || []).map((item) => ({
          id: item._id || `${category.name || "Menu"}-${item.name || Math.random()}`,
          name: item.name || "Unnamed Item",
          price: Number(item.price) || 0,
          description: item.description || "",
          category: category.name || "Menu",
          image: item.image || "",
        })),
      }));
      const categories = [
        { id: "all", label: "All" },
        ...safeCategories.map((category) => ({
          id: category.name,
          label: category.name,
        })),
      ];
      setMenuCategories(categories);
      const flatItems = safeCategories.flatMap((category) =>
        category.items.map((item) => ({
          ...item,
          category: category.name,
        }))
      );
      console.log('[Orders] Menu loaded:', {
        categories: categories.length,
        items: flatItems.length,
        categoriesList: categories.map(c => c.label),
        itemsList: flatItems.map(i => i.name).slice(0, 5)
      });
      setMenuItems(flatItems);
    } catch (err) {
      console.error("Failed to load menu", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to load menu";
      setMenuError(errorMessage);
      // Set empty state on error
      setMenuCategories([{ id: "all", label: "All" }]);
      setMenuItems([]);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const loadTables = useCallback(async () => {
    try {
      setTableLoading(true);
      const { data } = await api.get("/tables");
      setTables((Array.isArray(data) ? data : []).sort((a, b) => {
        const numA = Number(a.number);
        const numB = Number(b.number);
        if (Number.isFinite(numA) && Number.isFinite(numB)) {
          return numA - numB;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      }));
    } catch (err) {
      console.error("Failed to load tables", err);
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenu();
    loadTables();
  }, [loadMenu, loadTables]);

  const getItemKey = (item) => item.id || item._id || item.name;

  const draftItemsArray = useMemo(
    () =>
      Object.values(draftSelections).map(({ item, quantity }) => ({
        id: getItemKey(item),
        name: item.name,
        quantity,
        price: Number(item.price) || 0,
        item,
      })),
    [draftSelections]
  );

  const draftTotals = useMemo(() => {
    const subtotal = draftItemsArray.reduce(
      (sum, entry) => sum + entry.price * entry.quantity,
      0
    );
    const gst = subtotal * 0.05;
    const total = subtotal + gst;
    const totalItems = draftItemsArray.reduce(
      (sum, entry) => sum + entry.quantity,
      0
    );
    return {
      subtotal,
      gst,
      total,
      totalItems,
    };
  }, [draftItemsArray]);

  const filteredMenuItems = useMemo(() => {
    const normalizedSearch = draftSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory =
        draftCategory === "all" || item.category === draftCategory;
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, draftCategory, draftSearch]);

  const adjustItemQuantity = useCallback((menuItem, delta) => {
    setDraftSelections((prev) => {
      const key = getItemKey(menuItem);
      const next = { ...prev };
      const existing = next[key] || { item: menuItem, quantity: 0 };
      const updatedQuantity = existing.quantity + delta;
      if (updatedQuantity <= 0) {
        delete next[key];
      } else {
        next[key] = { item: menuItem, quantity: updatedQuantity };
      }
      return next;
    });
  }, []);

  const { tablesForService, usingFallbackTables } = useMemo(() => {
    if (draftServiceType === "DINE_IN") {
      // For DINE_IN: Only show AVAILABLE tables (or tables with sessionToken)
      // Occupied tables should not be available for dine-in orders
      const availableTables = tables.filter((table) => {
        const status = table.status || "UNKNOWN";
        const isAvailable = status === "AVAILABLE" || Boolean(table.sessionToken);
        return isAvailable;
      });
      return { tablesForService: availableTables, usingFallbackTables: false };
    }
    // For TAKEAWAY: Show all tables regardless of status (counter takeaway, not table takeaway)
    const takeawayCandidates = tables.filter((table) => {
      const label = `${table.name || ""} ${table.number || ""}`.toLowerCase();
      return label.includes("takeaway") || label.includes("counter");
    });
    if (takeawayCandidates.length > 0) {
      return { tablesForService: takeawayCandidates, usingFallbackTables: false };
    }
    // Fallback: Show all tables for takeaway (they're counter orders, not table-specific)
    return { tablesForService: tables, usingFallbackTables: true };
  }, [tables, draftServiceType]);

  const resetDraft = useCallback(() => {
    setDraftSelections({});
    setDraftSearch("");
    setDraftCategory("all");
    setSelectedTableId("");
    setDraftServiceType("DINE_IN");
    setCreateError("");
  }, []);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {filterCafeId && cafeInfo ? `Orders - ${cafeInfo.cafeName || cafeInfo.name}` : "Orders"}
          </h1>
          {filterCafeId && (
            <p className="text-sm text-gray-600 mt-1">
              Filtered by specific cart
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {filterCafeId && (
            <button
              onClick={() => window.location.href = "/orders"}
              className="px-3 py-1.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
            >
              View All Carts
            </button>
          )}
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
          <button
            onClick={handleAdd}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow"
          >
            + Add Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Clickable Status Summary Tiles to filter orders */}
        {/* All tile */}
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`p-4 rounded-lg border shadow-sm text-left transition outline-none ${
            filterStatus === 'all' ? 'ring-2 ring-blue-400' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{orders.filter((o) => o.serviceType === "DINE_IN").length}</div>
              <div className="text-sm">All Dine-In</div>
            </div>
            <div className="text-2xl">📦</div>
          </div>
        </button>

        {Object.entries(orders
          .filter((order) => order.serviceType === "DINE_IN") // Only count DINE_IN orders in status summary
          .reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
          }, {})).map(([status, count]) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`p-4 rounded-lg border ${getStatusClass(status)} shadow-sm text-left transition outline-none ${
              filterStatus === status ? 'ring-2 ring-blue-400' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm">{status}</div>
              </div>
              <div className="text-2xl">{getStatusIcon(status)}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        {user?.role === 'franchise_admin' && !filterCafeId && ordersByCart ? (
          // Grouped view by cart for franchise admin
          <div className="divide-y divide-gray-200">
            {Object.entries(ordersByCart)
              .filter(([cartId, { orders: cartOrders }]) => {
                const filtered = getFilteredOrdersForCart(cartOrders);
                return filtered.length > 0;
              })
              .map(([cartId, { cart, orders: cartOrders }]) => {
                const filteredCartOrders = getFilteredOrdersForCart(cartOrders);
                const cartName = cart.cartName || cart.name || cart.cafeName || 'Unknown Cart';
                const cartCode = cart.cartCode || '';
                const isExpanded = expandedCarts[cartId] !== false; // Default to expanded
                
                return (
                  <div key={cartId} className="border-b border-gray-300">
                    {/* Cart Header */}
                    <div 
                      className="bg-gray-100 hover:bg-gray-200 cursor-pointer px-6 py-4 flex items-center justify-between"
                      onClick={() => toggleCartExpand(cartId)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                        {cartCode && (
                          <span className="px-2 py-1 text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded">
                            {cartCode}
                          </span>
                        )}
                        <h3 className="text-lg font-bold text-gray-800">{cartName}</h3>
                        <span className="text-sm text-gray-600">({filteredCartOrders.length} orders)</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/orders?cafeId=${cartId}`);
                        }}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        View All
                      </button>
                    </div>
                    
                    {/* Orders for this cart */}
                    {isExpanded && (
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Details</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredCartOrders.map((order) => (
                            <React.Fragment key={order._id}>
                              {renderOrderRow(order)}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            {Object.keys(ordersByCart).length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                No orders found for any cart.
              </div>
            )}
          </div>
        ) : (
          // Regular flat view
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
              {filteredOrders.map((order) => renderOrderRow(order))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-5xl m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {currentOrder?.isNew ? "Add Order" : "Edit Order"}
              </h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setCurrentOrder(null);
                  resetDraft();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={currentOrder?.isNew ? handleSubmitNewOrder : handleSave}
              className="space-y-6"
            >
              {currentOrder?.isNew ? (
                <div className="space-y-6">
                  {createError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {createError}
                    </div>
                  )}
                  <div className={`grid gap-4 ${draftServiceType === "DINE_IN" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2">
                        Service Type
                      </label>
                      <div className="flex items-center gap-2">
                        {["DINE_IN", "TAKEAWAY"].map((type) => (
                          <button
                            type="button"
                            key={type}
                            onClick={() => {
                              setDraftServiceType(type);
                              setSelectedTableId("");
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                              draftServiceType === type
                                ? "bg-blue-600 text-white border-blue-600 shadow"
                                : "border-gray-300 text-gray-600 hover:border-blue-400"
                            }`}
                          >
                            {type === "DINE_IN" ? "Dine-In" : "Takeaway"}
                          </button>
                        ))}
                      </div>
                      {draftServiceType === "TAKEAWAY" && (
                        <p className="text-xs text-gray-500 mt-2">
                          Counter takeaway order - no table selection needed.
                        </p>
                      )}
                    </div>
                    {draftServiceType === "DINE_IN" && (
                      <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2">
                          Choose Table 🪑
                        </label>
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <select
                            value={selectedTableId}
                            onChange={(e) => setSelectedTableId(e.target.value)}
                            className="shadow-sm border border-gray-300 rounded-lg w-full md:w-72 py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                          >
                            <option value="">Select a table</option>
                            {tablesForService.map((table) => {
                              const label = table.number
                                ? `Table ${table.number}`
                                : table.name || "Unnamed";
                              const status = table.status || "UNKNOWN";
                              // For DINE_IN: tables are already filtered to only available ones
                              const isAvailable = status === "AVAILABLE" || Boolean(table.sessionToken);
                              return (
                                <option
                                  key={table._id}
                                  value={table._id}
                                  disabled={!isAvailable}
                                >
                                  {label} · {status.toLowerCase()}
                                  {!isAvailable ? " (locked)" : ""}
                                </option>
                              );
                            })}
                          </select>
                          <button
                            type="button"
                            onClick={loadTables}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Refresh tables
                          </button>
                        </div>
                        {tableLoading && (
                          <p className="text-xs text-gray-500 mt-1">
                            Loading tables…
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    <div className="xl:col-span-2 space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <input
                          type="text"
                          value={draftSearch}
                          onChange={(e) => setDraftSearch(e.target.value)}
                          placeholder="Search menu items..."
                          className="flex-1 shadow-sm border border-gray-300 rounded-lg py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                        <div className="flex flex-wrap gap-2">
                          {menuCategories.map((category) => (
                            <button
                              type="button"
                              key={category.id}
                              onClick={() => setDraftCategory(category.id)}
                              className={`px-3 py-1 text-sm rounded-full border transition ${
                                draftCategory === category.id
                                  ? "bg-blue-600 text-white border-blue-600 shadow"
                                  : "border-gray-300 text-gray-600 hover:border-blue-400"
                              }`}
                            >
                              {category.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto divide-y">
                        {menuLoading ? (
                          <div className="p-4 text-sm text-gray-500">
                            Loading menu…
                          </div>
                        ) : menuError ? (
                          <div className="p-4 text-sm text-red-600">
                            {menuError}
                          </div>
                        ) : filteredMenuItems.length === 0 ? (
                          <div className="p-4 text-sm text-gray-500">
                            No menu items match your filters.
                          </div>
                        ) : (
                          filteredMenuItems.map((item) => {
                            const quantity =
                              draftSelections[getItemKey(item)]?.quantity || 0;
                            return (
                              <div
                                key={getItemKey(item)}
                                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                              >
                                <div>
                                  <div className="text-sm font-semibold text-gray-800">
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    ₹{formatMoney(item.price)} · {item.category}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => adjustItemQuantity(item, -1)}
                                    disabled={quantity === 0}
                                    className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center text-sm font-semibold text-gray-700">
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => adjustItemQuantity(item, 1)}
                                    className="w-8 h-8 flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                          Order Summary
                        </h3>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                          <span>Service Type</span>
                          <span className="font-semibold text-gray-700">
                            {draftServiceType === "TAKEAWAY" ? "Takeaway" : "Dine-In"}
                          </span>
                        </div>
                        {draftItemsArray.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            No items selected yet. Use the menu on the left to
                            build the order.
                          </p>
                        ) : (
                          <div className="space-y-2 text-sm text-gray-700">
                            {draftItemsArray.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex justify-between items-center"
                              >
                                <span>
                                  {entry.name} × {entry.quantity}
                                </span>
                                <span>
                                  ₹{formatMoney(entry.price * entry.quantity)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-4 space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Items</span>
                            <span>{draftTotals.totalItems}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>₹{formatMoney(draftTotals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>GST (5%)</span>
                            <span>₹{formatMoney(draftTotals.gst)}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-200">
                            <span>Total</span>
                            <span>₹{formatMoney(draftTotals.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Order Info Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="tableNumber"
                        className="block text-gray-700 text-sm font-bold mb-2"
                      >
                        Table Number 🪑
                      </label>
                      <input
                        type="text"
                        id="tableNumber"
                        name="tableNumber"
                        defaultValue={currentOrder?.tableNumber || ""}
                        className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        readOnly
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="status"
                        className="block text-gray-700 text-sm font-bold mb-2"
                      >
                        Order Status {getStatusIcon(currentOrder?.status || "Pending")}
                      </label>
                      <select
                        id="status"
                        name="status"
                        defaultValue={currentOrder?.status || "Pending"}
                        className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      >
                        <option value="Pending">⏳ Pending</option>
                        <option value="Confirmed">👨‍🍳 Confirmed</option>
                        <option value="Preparing">🔥 Preparing</option>
                        <option value="Ready">🍽️ Ready</option>
                        <option value="Served">🤝 Served</option>
                        <option value="Paid">✅ Paid</option>
                        <option value="Cancelled">❌ Cancelled</option>
                        <option value="Returned">↩️ Returned</option>
                      </select>
                    </div>
                  </div>

                  {/* Add Items Section */}
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      Add Items to Order
                    </h3>
                    {menuItems.length === 0 && !menuLoading && !menuError && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          Menu not loaded. <button 
                            type="button"
                            onClick={loadMenu}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Click here to load menu
                          </button>
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                      <div className="xl:col-span-2 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                          <input
                            type="text"
                            value={draftSearch}
                            onChange={(e) => setDraftSearch(e.target.value)}
                            placeholder="Search menu items..."
                            className="flex-1 shadow-sm border border-gray-300 rounded-lg py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                          />
                          <div className="flex flex-wrap gap-2">
                            {menuCategories.length > 0 ? (
                              menuCategories.map((category) => (
                                <button
                                  type="button"
                                  key={category.id}
                                  onClick={() => setDraftCategory(category.id)}
                                  className={`px-3 py-1 text-sm rounded-full border transition ${
                                    draftCategory === category.id
                                      ? "bg-blue-600 text-white border-blue-600 shadow"
                                      : "border-gray-300 text-gray-600 hover:border-blue-400"
                                  }`}
                                >
                                  {category.label}
                                </button>
                              ))
                            ) : (
                              <span className="text-xs text-gray-500 px-2">No categories available</span>
                            )}
                          </div>
                        </div>
                        <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto divide-y">
                          {menuLoading ? (
                            <div className="p-4 text-sm text-gray-500">
                              Loading menu…
                            </div>
                          ) : menuError ? (
                            <div className="p-4 text-sm text-red-600">
                              {menuError}
                              <button
                                type="button"
                                onClick={loadMenu}
                                className="ml-2 text-blue-600 hover:text-blue-800 underline"
                              >
                                Retry
                              </button>
                            </div>
                          ) : menuItems.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500">
                              No menu items available. Please add items to the menu first.
                            </div>
                          ) : filteredMenuItems.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500">
                              No menu items match your filters. Try changing the search or category.
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftSearch("");
                                  setDraftCategory("all");
                                }}
                                className="ml-2 text-blue-600 hover:text-blue-800 underline"
                              >
                                Clear filters
                              </button>
                            </div>
                          ) : (
                            filteredMenuItems.map((item) => {
                              const quantity =
                                draftSelections[getItemKey(item)]?.quantity || 0;
                              return (
                                <div
                                  key={getItemKey(item)}
                                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
                                >
                                  <div>
                                    <div className="text-sm font-semibold text-gray-800">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      ₹{formatMoney(item.price)} · {item.category}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => adjustItemQuantity(item, -1)}
                                      disabled={quantity === 0}
                                      className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      -
                                    </button>
                                    <span className="w-8 text-center text-sm font-semibold text-gray-700">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => adjustItemQuantity(item, 1)}
                                      className="w-8 h-8 flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            New Items Summary
                          </h3>
                          {draftItemsArray.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              No new items selected. Select items from the menu to add them to this order.
                            </p>
                          ) : (
                            <>
                              <div className="space-y-2 text-sm text-gray-700 mb-4">
                                {draftItemsArray.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="flex justify-between items-center"
                                  >
                                    <span>
                                      {entry.name} × {entry.quantity}
                                    </span>
                                    <span>
                                      ₹{formatMoney(entry.price * entry.quantity)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-4 space-y-1 text-sm text-gray-600 border-t border-gray-300 pt-3">
                                <div className="flex justify-between">
                                  <span>Subtotal</span>
                                  <span>₹{formatMoney(draftTotals.subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>GST (5%)</span>
                                  <span>₹{formatMoney(draftTotals.gst)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-200">
                                  <span>Total</span>
                                  <span>₹{formatMoney(draftTotals.total)}</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCurrentOrder(null);
                    resetDraft();
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={currentOrder?.isNew ? createSubmitting : false}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg"
                >
                  {currentOrder?.isNew
                    ? createSubmitting
                      ? "Creating..."
                      : "Create Order"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
