import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createSocketConnection } from "../utils/socket";
import { useAuth } from "../context/AuthContext";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  ORDER_TRANSITIONS,
  canAccept,
  nextStatusOnAccept,
  getNextStatus,
  getNextStatusTakeaway,
  canAcceptTakeaway,
  canCancel,
  canReturn,
} from "../domain/orderLogic";
import api from "../utils/api";
import { printKOT } from "../utils/kotPrinter";
import { buildExcelFileName, exportRowsToExcel } from "../utils/excelReport";

const AUTO_PRINT_PRINTER_ID = "kitchen-primary";

const normalizeId = (value) =>
  typeof value === "string" ? value : value?.toString?.() || "";
const sanitizeAddonName = (value) => {
  const normalized = String(value || "")
    .replace(/^\(\s*\+\s*\)\s*/u, "")
    .trim();
  return normalized || "Add-on";
};

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
const normalizeLegacyTakeawayStatus = (status) => {
  switch (status) {
    case "Pending":
    case "Confirmed":
    case "Accept":
    case "Accepted":
    case "Being Prepared":
    case "BeingPrepared":
    case "New":
    case "NEW":
      return "Preparing";
    case "Completed":
    case "Finalized":
    case "Exit":
      return "Served";
    default:
      return status;
  }
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getOrderCreatedDate = (order) => getValidDate(order?.createdAt);
const getOrderUpdatedDate = (order) => getValidDate(order?.updatedAt);

const formatOrderDateForFilter = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatOrderDateTime = (date) => {
  if (!date) {
    return { dateLabel: "-", timeLabel: "-" };
  }

  return {
    dateLabel: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    timeLabel: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

const formatOrderDateTimeLong = (date) =>
  date ? date.toLocaleString("en-US") : "-";

const paiseToRupees = (value) => {
  if (value === undefined || value === null) return 0;
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return num / 100;
};

// Aggregate all items from all KOTs and selected add-ons
const aggregateKotItems = (kotLines = [], selectedAddons = []) => {
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

  (selectedAddons || []).forEach((addon) => {
    if (!addon) return;
    const addonName = sanitizeAddonName(addon.name);
    const addonKey = `addon:${normalizeId(
      addon.addonId || addon._id || addon.id || `${addonName}-${addon.price || 0}`,
    )}`;
    const quantity = Number(addon.quantity) || 1;
    const unitPrice = Number(addon.price) || 0; // Add-ons are in rupees
    if (!map.has(addonKey)) {
      map.set(addonKey, {
        name: addonName,
        unitPrice,
        quantity: 0,
        amount: 0,
      });
    }
    const entry = map.get(addonKey);
    entry.quantity += quantity;
    entry.amount += unitPrice * quantity;
  });

  return Array.from(map.values());
};

// Calculate totals from actual items, not from KOT totals (to avoid rounding errors)
const computeKotTotals = (
  kotLines = [],
  aggregatedItems = [],
  order = null,
) => {
  // Calculate subtotal from non-returned items (amount is already in rupees)
  const subtotal = aggregatedItems.reduce((sum, item) => {
    const amount = Number(item.amount) || 0;
    return sum + amount;
  }, 0);

  // Round subtotal to 2 decimal places
  const subtotalRounded = Number(subtotal.toFixed(2));

  // GST removed - set to 0
  const gst = 0;

  // Add delivery charge if applicable
  const deliveryCharge =
    order?.orderType === "DELIVERY" && order?.deliveryInfo?.deliveryCharge
      ? Number(order.deliveryInfo.deliveryCharge) || 0
      : 0;

  // Calculate total amount (subtotal + delivery charge, no GST)
  const totalAmount = Number((subtotalRounded + deliveryCharge).toFixed(2));

  return {
    subtotal: subtotalRounded,
    gst: gst,
    deliveryCharge: deliveryCharge,
    totalAmount: totalAmount,
  };
};

const buildInvoiceMarkup = (order, franchiseData = null, cartData = null) => {
  if (!order) return "";
  const invoiceNumber = buildInvoiceId(order);
  const kotLines = Array.isArray(order.kotLines) ? order.kotLines : [];
  const selectedAddons = Array.isArray(order.selectedAddons)
    ? order.selectedAddons
    : [];
  const aggregatedItems = aggregateKotItems(kotLines, selectedAddons);
  const totals = computeKotTotals(kotLines, aggregatedItems, order);

  // Get cart address (prefer address, fallback to location)
  const cartAddress = cartData?.address || "—";
  // Get franchise FSSAI number (fallback to GST if available)
  const franchiseFSSAI =
    franchiseData?.fssaiNumber || franchiseData?.gstNumber || "—";

  // Payment mode display (fallback to CASH if not available on order)
  const paymentMethod =
    order.paymentMethod ||
    order.paymentMode ||
    (order.payment && order.payment.method) ||
    "CASH";
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeCartAddress = escapeHtml(cartAddress);
  const safeFranchiseFSSAI = escapeHtml(franchiseFSSAI);
  const safeInvoiceDate = escapeHtml(
    new Date(
      order.paidAt || order.updatedAt || order.createdAt || Date.now(),
    ).toLocaleDateString(),
  );
  const safeTakeawayToken = escapeHtml(order.takeawayToken || "");
  const safeCustomerName = escapeHtml(order.customerName || "");
  const safeCustomerMobile = escapeHtml(order.customerMobile || "");
  const safePickupAddress = escapeHtml(order.pickupLocation?.address || "Address not set");
  const safeDeliveryAddress = escapeHtml(order.customerLocation?.address || "Address not set");
  const safeSpecialInstructions = escapeHtml(order.specialInstructions || "");
  const safeTableNumber = escapeHtml(order.tableNumber || "--");
  const safePaymentMethod = escapeHtml(String(paymentMethod).toUpperCase());

  const rows =
    aggregatedItems.length > 0
      ? aggregatedItems
          .map((item) => {
            const quantity = item.quantity || 0;
            const price = item.unitPrice || 0;
            const amount = item.amount || 0;
            return `
              <tr>
                <td class="py-2 border-b">${escapeHtml(item.name || "")}</td>
                <td class="py-2 border-b">${quantity}</td>
                <td class="py-2 border-b">₹${formatMoney(price)}</td>
                <td class="py-2 border-b text-right">₹${formatMoney(
                  amount,
                )}</td>
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
          width: 58mm;
          max-width: 220px;
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
        <div style="font-size: 9px; margin-bottom: 2px;">${safeCartAddress}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">FSSAI No: ${safeFranchiseFSSAI}</div>
        <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0;">Invoice</div>
        <div style="font-size: 9px; margin-bottom: 2px;">Invoice No: ${safeInvoiceNumber}</div>
        <div style="font-size: 9px; margin-bottom: 8px;">Date: ${safeInvoiceDate}</div>
        ${
          order.serviceType === "TAKEAWAY" &&
          order.orderType !== "DELIVERY" &&
          order.takeawayToken
            ? `<div style="font-size: 9px; margin-bottom: 8px; font-weight: bold;">Token: ${safeTakeawayToken}</div>`
            : ""
        }
        </div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 10px; margin-bottom: 4px;">Billed To</div>
        ${
          order.serviceType === "TAKEAWAY" || order.orderType
            ? `
              <div style="font-size: 9px; font-weight: bold; margin-bottom: 4px;">
                ${
                  order.orderType === "PICKUP"
                    ? "📦 Pickup Order"
                    : order.orderType === "DELIVERY"
                      ? "🚚 Delivery Order"
                      : "Takeaway Order"
                }${
                  order.orderType !== "DELIVERY" && order.takeawayToken
                    ? ` - Token: ${safeTakeawayToken}`
                    : ""
                }
              </div>
              ${
                order.customerName
                  ? `<div style="font-size: 9px; margin-top: 2px;">Customer: ${safeCustomerName}${
                      order.customerMobile ? ` (${safeCustomerMobile})` : ""
                    }</div>`
                  : ""
              }
              ${
                order.orderType === "PICKUP" && order.pickupLocation
                  ? `<div style="font-size: 9px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc;">
                      <div style="font-weight: 600;">Pickup Location:</div>
                      <div>${safePickupAddress}</div>
                    </div>`
                  : ""
              }
              ${
                order.orderType === "DELIVERY" && order.customerLocation
                  ? `<div style="font-size: 9px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc;">
                      <div style="font-weight: 600;">Delivery Address:</div>
                      <div>${safeDeliveryAddress}</div>
                      ${
                        order.deliveryInfo
                          ? `<div style="margin-top: 4px;">
                              <div>Distance: ${order.deliveryInfo.distance?.toFixed(2) || "N/A"} km</div>
                              ${
                                order.deliveryInfo.deliveryCharge > 0
                                  ? `<div style="color: #059669; font-weight: 600;">Delivery Charge: ₹${order.deliveryInfo.deliveryCharge.toFixed(2)}</div>`
                                  : ""
                              }
                            </div>`
                          : ""
                      }
                    </div>`
                  : ""
              }
              ${
                order.specialInstructions
                  ? `<div style="font-size: 9px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc;">
                      <div style="font-weight: 600;">Special Instructions:</div>
                      <div style="font-style: italic;">${safeSpecialInstructions}</div>
                    </div>`
                  : ""
              }
            `
            : `
              <div style="font-size: 9px;">
                ${safeTableNumber}
              </div>
            `
        }
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
          ${
            totals.deliveryCharge > 0
              ? `<div class="invoice-line">
                  <span>Delivery Charge</span>
                  <span>₹${formatMoney(totals.deliveryCharge)}</span>
                </div>`
              : ""
          }
          <div class="invoice-line" style="font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 12px;">
            <span>Total</span>
            <span>₹${formatMoney(totals.totalAmount)}</span>
          </div>
          <div class="invoice-line" style="margin-top: 6px;">
            <span>Payment Mode</span>
            <span>${safePaymentMethod}</span>
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
          fssaiNumber: franchiseRes.data.fssaiNumber || null,
          name: franchiseRes.data.name || null,
        };
      }
    }

    // Fetch cart data if cartId exists (prefer Cart document for address)
    if (order.cartId) {
      const cartId = typeof order.cartId === "object" ? order.cartId._id : order.cartId;
      if (cartId) {
        try {
          const cartRes = await api.get(`/carts/by-admin/${cartId}`, { skipErrorLogging: true });
          if (cartRes.data?.data) {
            cartData = {
              address: cartRes.data.data.address || cartRes.data.data.location || null,
              cartName: cartRes.data.data.name || null,
            };
          }
        } catch (e) {
          if (e.response?.status !== 404 && e.response?.status !== 403) {
            console.warn("Cart by-admin fetch failed, falling back to user:", e);
          }
        }
        if (!cartData) {
          const userRes = await api.get(`/users/${cartId}`, { skipErrorLogging: true });
          if (userRes.data) {
            cartData = {
              address: userRes.data.address || userRes.data.location || null,
              cartName: userRes.data.cartName || userRes.data.name || null,
            };
          }
        }
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("Failed to load franchise/cart data:", err);
    }
  }

  const html = buildInvoiceMarkup(order, franchiseData, cartData);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
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
              size: 58mm auto;
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
            width: 58mm;
            max-width: 220px;
            font-size: 11px;
          }
          h1,h2,h3,h4 { margin: 0; }
          table { border-collapse: collapse; width: 100%; font-size: 9px; }
          th, td { padding: 3px 2px; border-bottom: 1px dashed #000; }
          th { text-align: left; font-size: 9px; }
          .invoice {
            width: 58mm;
            max-width: 220px;
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
          fssaiNumber: franchiseRes.data.fssaiNumber || null,
          name: franchiseRes.data.name || null,
        };
      }
    }

    // Fetch cart data if cartId exists (prefer Cart document for address)
    if (order.cartId) {
      const cartId = typeof order.cartId === "object" ? order.cartId._id : order.cartId;
      if (cartId) {
        try {
          const cartRes = await api.get(`/carts/by-admin/${cartId}`, { skipErrorLogging: true });
          if (cartRes.data?.data) {
            cartData = {
              address: cartRes.data.data.address || cartRes.data.data.location || null,
              cartName: cartRes.data.data.name || null,
            };
          }
        } catch (e) {
          if (e.response?.status !== 404 && e.response?.status !== 403) {
            console.warn("Cart by-admin fetch failed, falling back to user:", e);
          }
        }
        if (!cartData) {
          const userRes = await api.get(`/users/${cartId}`, { skipErrorLogging: true });
          if (userRes.data) {
            cartData = {
              address: userRes.data.address || userRes.data.location || null,
              cartName: userRes.data.cartName || userRes.data.name || null,
            };
          }
        }
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("Failed to load franchise/cart data:", err);
    }
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
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
    alert("Failed to render invoice for download.");
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imageData = canvas.toDataURL("image/png");

    // Calculate dimensions
    const pdfWidth = 80;
    const margin = 5;
    const usableWidth = pdfWidth - margin * 2;

    const tempPdf = new jsPDF();
    const imgProps = tempPdf.getImageProperties(imageData);
    const imgRatio = imgProps.height / imgProps.width;
    const imgHeight = usableWidth * imgRatio;
    const pdfHeight = imgHeight + margin * 2;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [pdfWidth, pdfHeight],
    });

    pdf.addImage(imageData, "PNG", margin, margin, usableWidth, imgHeight);
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const filterCafeId = searchParams.get("cafeId");

  // Resolve effective cartId for order creation and socket room join (matches Orders.jsx pattern)
  const getEffectiveCartId = useCallback(() => {
    if (filterCafeId) return filterCafeId.toString();
    if (user?.role === "admin" && user?._id) return user._id.toString();
    if (user?.role === "franchise_admin" && user?.cafeId) return user.cafeId.toString();
    return null;
  }, [filterCafeId, user?._id, user?.role, user?.cafeId]);

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [draftSelections, setDraftSelections] = useState({});
  const [draftAddonSelections, setDraftAddonSelections] = useState({});
  const [addonList, setAddonList] = useState([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftCategory, setDraftCategory] = useState("all");
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchTable, setSearchTable] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [filterDate, setFilterDate] = useState(""); // Date filter (YYYY-MM-DD format)
  const [expanded, setExpanded] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [reasonModal, setReasonModal] = useState({
    open: false,
    orderId: null,
    status: null,
    title: "",
  });
  const [reasonInput, setReasonInput] = useState("");

  // Auto-print preference (default: false - disabled to prevent automatic popups)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    return localStorage.getItem("autoPrintTakeawayKOT") === "true";
  });
  const printedKotRef = React.useRef(new Set());

  // Toggle auto-print
  const toggleAutoPrint = () => {
    setAutoPrintEnabled((prev) => {
      const newValue = !prev;
      localStorage.setItem("autoPrintTakeawayKOT", newValue);
      return newValue;
    });
  };

  const isOrderReadyForKotPrint = useCallback((order) => {
    if (!order) return false;
    const status = (order?.status || "").toString().trim().toUpperCase();
    const printableCreateStatuses = new Set([
      "PENDING",
      "CONFIRMED",
      "PREPARING",
      "BEING PREPARED",
      "BEINGPREPARED",
    ]);
    return printableCreateStatuses.has(status);
  }, []);

  // Auto-print on order creation flow only (not on acceptance), once per order+kotNumber.
  const handleAutoPrint = useCallback(
    async (order) => {
      if (!order || !Array.isArray(order.kotLines) || order.kotLines.length === 0) {
        return;
      }
      if (!isOrderReadyForKotPrint(order)) {
        return;
      }

      const latestKotIndex = order.kotLines.length - 1;
      const latestKot = order.kotLines[latestKotIndex];
      if (!latestKot || !Array.isArray(latestKot.items) || latestKot.items.length === 0) {
        return;
      }

      const explicitKotNumber = Number(latestKot.kotNumber);
      const kotNumber =
        Number.isFinite(explicitKotNumber) && explicitKotNumber > 0
          ? explicitKotNumber
          : latestKotIndex + 1;
      const signature = `${order._id}:${kotNumber}`;

      if (printedKotRef.current.has(signature)) {
        return;
      }

      let printKey = "";
      try {
        const claimResponse = await api.patch(`/orders/${order._id}/print-claim`, {
          docType: "KOT",
          printerId: AUTO_PRINT_PRINTER_ID,
          kotIndex: latestKotIndex,
          kotNumber,
          orderVersion: order?.updatedAt || order?.createdAt || "",
        });
        const claimPayload = claimResponse?.data || claimResponse || {};
        if (claimPayload?.claimed !== true) {
          if (import.meta.env.DEV) {
            console.log(
              `[AutoPrint] Skipping Takeaway KOT #${kotNumber} for Order ${order._id} (already claimed)`,
            );
          }
          return;
        }
        printKey = String(claimPayload?.printKey || "").trim();
      } catch (claimError) {
        if (import.meta.env.DEV) {
          console.error("[AutoPrint] Failed to claim KOT print job:", claimError);
        }
        return;
      }

      printedKotRef.current.add(signature);
      console.log(
        `[AutoPrint] Printing Takeaway KOT #${kotNumber} for Order ${order._id}`,
      );
      const printedOk = await printKOT(order, latestKot, latestKotIndex);
      if (!printedOk) {
        printedKotRef.current.delete(signature);
      }

      if (printKey) {
        try {
          await api.patch(`/orders/${order._id}/print-complete`, {
            docType: "KOT",
            printKey,
            success: printedOk,
            errorMessage: printedOk ? undefined : "Failed to print compact KOT",
          });
        } catch (completeError) {
          if (import.meta.env.DEV) {
            console.error(
              "[AutoPrint] Failed to complete KOT print job:",
              completeError,
            );
          }
        }
      }
    },
    [isOrderReadyForKotPrint],
  );

  const socketRef = React.useRef(null);
  const upsertOrder = React.useCallback(
    (incoming, { prepend = false } = {}) => {
      if (import.meta.env.DEV) {
        console.log("[TakeawayOrders] upsertOrder called with:", incoming);
      }
      if (!incoming) {
        if (import.meta.env.DEV) {
          console.log(
            "[TakeawayOrders] upsertOrder: incoming is null/undefined",
          );
        }
        return;
      }
      if (incoming.serviceType !== "TAKEAWAY") {
        if (import.meta.env.DEV) {
          console.log(
            `[TakeawayOrders] upsertOrder: filtering out order - serviceType is ${incoming.serviceType}, expected TAKEAWAY`,
          );
        }
        return;
      }
      const incomingId = normalizeId(incoming._id);
      if (!incomingId) {
        if (import.meta.env.DEV) {
          console.log("[TakeawayOrders] upsertOrder: no order ID found");
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.log(
          `[TakeawayOrders] upsertOrder: processing takeaway order ${incomingId}`,
        );
      }

      setOrders((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const index = list.findIndex(
          (order) => normalizeId(order._id) === incomingId,
        );

        if (index >= 0) {
          if (import.meta.env.DEV) {
            console.log(
              `[TakeawayOrders] upsertOrder: updating existing order at index ${index}`,
            );
          }
          list[index] = incoming;
          return list;
        }

        if (import.meta.env.DEV) {
          console.log(
            `[TakeawayOrders] upsertOrder: adding new order (prepend: ${prepend})`,
          );
        }
        return prepend ? [incoming, ...list] : [...list, incoming];
      });
    },
    [setOrders],
  );

  // Load menu items for "Modify Order" (add items) flow
  const loadMenu = useCallback(async () => {
    try {
      setMenuLoading(true);
      setMenuError("");
      const res = await api.get("/menu");
      const data = Array.isArray(res.data) ? res.data : [];

      const items = [];
      (data || []).forEach((cat) => {
        if (!cat) return;
        (Array.isArray(cat.items) ? cat.items : []).forEach((item) => {
          if (!item) return;
          items.push({
            ...item,
            category: cat.name || item.category || "Uncategorized",
          });
        });
      });

      setMenuItems(items);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to load menu for takeaway modify flow", err);
      }
      setMenuError("Failed to load menu items. Please try again.");
    } finally {
      setMenuLoading(false);
    }
  }, []);

  // Load add-ons for "Add-ons" option in Edit/Create modal – same request as Global Add-ons page
  const loadAddons = useCallback(async () => {
    try {
      setAddonsLoading(true);
      const response = await api.get("/addons");
      const raw = response.data;
      const addonsList = Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.addons)
            ? raw.addons
            : [];
      const list = addonsList.filter(
        (a) =>
          a &&
          a.isAvailable !== false &&
          (a.name != null || a._id != null || a.id != null),
      );
      setAddonList(list);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("[TakeawayOrders] Add-ons fetch failed:", err?.response?.status, err?.response?.data);
      }
      setAddonList([]);
    } finally {
      setAddonsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const fetchOrders = async () => {
      try {
        // Use authenticated API to get orders filtered by cartId for cart admins
        const res = await api.get("/orders");
        if (import.meta.env.DEV) {
          console.log("[TakeawayOrders] API Response:", res);
          console.log("[TakeawayOrders] Response data:", res.data);
        }

        // Handle both response formats: direct array or { success: true, data: [...] }
        let data = [];
        if (Array.isArray(res.data)) {
          data = res.data;
        } else if (
          res.data &&
          res.data.success &&
          Array.isArray(res.data.data)
        ) {
          data = res.data.data;
        } else if (res.data && Array.isArray(res.data.data)) {
          data = res.data.data;
        }

        if (import.meta.env.DEV) {
          console.log(
            `[TakeawayOrders] Parsed ${data.length} total orders from response`,
          );
        }

        if (!active) return;

        // Filter for takeaway orders only
        const takeawayOrders = (data || []).filter((order) => {
          if (!order) return false;
          const isTakeaway = order.serviceType === "TAKEAWAY";
          if (import.meta.env.DEV && !isTakeaway) {
            console.log(
              `[TakeawayOrders] Order ${order._id} filtered out - serviceType: ${order.serviceType}`,
            );
          }
          return isTakeaway;
        });

        if (import.meta.env.DEV) {
          console.log(
            `[TakeawayOrders] Fetched ${takeawayOrders.length} takeaway orders out of ${data.length} total orders`,
          );
        }
        setOrders(takeawayOrders);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to load takeaway orders:", err);
          console.error("Error details:", err.response?.data || err.message);
        }
        // Show user-friendly error message
        if (import.meta.env.DEV) {
          if (err.response?.status === 401) {
            console.warn(
              "Authentication failed - user may need to login again",
            );
          } else if (err.response?.status === 403) {
            console.warn("Access denied - user may not have permission");
          }
        }
      }
    };

    fetchOrders();
    loadMenu();
    loadAddons();

    const socket = createSocketConnection();
    socketRef.current = socket;

    const handleNewOrder = (order) => {
      if (import.meta.env.DEV) {
        console.log("[TakeawayOrders] Socket: newOrder event received:", order);
      }
      upsertOrder(order, { prepend: true });
      if (autoPrintEnabled) {
        handleAutoPrint(order);
      }
    };

    const handleOrderUpdated = (order) => {
      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Socket: orderUpdated event received:",
          order,
        );
      }
      upsertOrder(order);
    };

    const handleOrderDeleted = ({ id }) => {
      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Socket: orderDeleted event received:",
          id,
        );
      }
      // Remove the order from the list if it exists
      setOrders((prev) =>
        prev.filter((order) => {
          const orderId = normalizeId(order._id);
          const deletedId = normalizeId(id);
          return orderId !== deletedId;
        }),
      );
    };

    // Listen for new Socket.IO events (room-based)
    const handleOrderCreated = (order) => {
      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Socket: order:created event received:",
          order,
        );
      }
      upsertOrder(order, { prepend: true });
      if (autoPrintEnabled) {
        handleAutoPrint(order);
      }
    };

    const handleOrderStatusUpdated = (order) => {
      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Socket: order:status:updated event received:",
          order,
        );
      }
      upsertOrder(order);
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderUpdated", handleOrderUpdated);
    socket.on("orderDeleted", handleOrderDeleted);
    socket.on("order:created", handleOrderCreated);
    socket.on("order:status:updated", handleOrderStatusUpdated);

    // Join cafe and cart rooms for real-time updates (matches Orders.jsx pattern)
    const targetCartId = getEffectiveCartId();
    if (targetCartId) {
      socket.emit("join:cafe", targetCartId);
      socket.emit("join:cart", targetCartId);
      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Socket: Joined cafe and cart rooms:",
          targetCartId,
        );
      }
    }

    return () => {
      active = false;
      socket.off("newOrder", handleNewOrder);
      socket.off("orderUpdated", handleOrderUpdated);
      socket.off("orderDeleted", handleOrderDeleted);
      socket.off("order:created", handleOrderCreated);
      socket.off("order:status:updated", handleOrderStatusUpdated);

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [upsertOrder, autoPrintEnabled, handleAutoPrint, getEffectiveCartId]);

  const getItemKey = (item) => item.id || item._id || item.name;

  const draftItemsArray = useMemo(
    () =>
      Object.values(draftSelections || {})
        .filter((entry) => entry && entry.item)
        .map(({ item, quantity }) => ({
          id: getItemKey(item),
          name: item?.name || "",
          quantity: quantity || 0,
          price: Number(item?.price) || 0,
          item,
        })),
    [draftSelections],
  );

  const draftAddonsArray = useMemo(() => {
    if (!draftAddonSelections || typeof draftAddonSelections !== "object") return [];
    return Object.entries(draftAddonSelections)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, quantity]) => {
        const addon = addonList.find((a) => (a._id || a.id) === id);
        if (!addon) return null;
        const price = Number(addon.price) || 0;
        return {
          id,
          name: sanitizeAddonName(addon.name),
          price,
          quantity: Number(quantity) || 0,
        };
      })
      .filter(Boolean);
  }, [draftAddonSelections, addonList]);

  const draftTotals = useMemo(() => {
    if (!Array.isArray(draftItemsArray)) {
      return { subtotal: 0, gst: 0, total: 0, totalItems: 0, addonsSubtotal: 0 };
    }
    const subtotal = draftItemsArray.reduce((sum, entry) => {
      if (!entry) return sum;
      return sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
    }, 0);
    const addonsSubtotal = draftAddonsArray.reduce((sum, entry) => {
      if (!entry) return sum;
      return sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
    }, 0);
    const gst = 0;
    const total = subtotal + addonsSubtotal;
    const totalItems = draftItemsArray.reduce((sum, entry) => {
      if (!entry) return sum;
      return sum + (Number(entry.quantity) || 0);
    }, 0);
    return {
      subtotal,
      addonsSubtotal,
      gst,
      total,
      totalItems,
    };
  }, [draftItemsArray, draftAddonsArray]);

  const filteredMenuItems = useMemo(() => {
    if (!Array.isArray(menuItems)) {
      return [];
    }
    const normalizedSearch = draftSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (!item) return false;
      const matchesCategory =
        draftCategory === "all" || item.category === draftCategory;
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        (item.description || "").toLowerCase().includes(normalizedSearch);
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

  const adjustAddonQuantity = useCallback((addon, delta) => {
    const id = addon._id || addon.id;
    if (!id) return;
    setDraftAddonSelections((prev) => {
      const next = { ...prev };
      const current = next[id] || 0;
      const updated = current + delta;
      if (updated <= 0) {
        delete next[id];
      } else {
        next[id] = updated;
      }
      return next;
    });
  }, []);

  const changeStatus = async (orderId, newStatus, reason = null) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: newStatus,
        reason,
      });
      upsertOrder(response.data);
      if (reasonModal.open) {
        closeReasonModal();
      }
    } catch (e) {
      if (
        e.name === "AbortError" ||
        e.name === "CanceledError" ||
        e.code === "ERR_CANCELED"
      ) {
        return;
      }
      if (import.meta.env.DEV) {
        console.error("Status change failed:", e);
      }
      const errorMessage =
        e.response?.data?.message || e.message || "Status update failed";
      alert(`Failed to change status: ${errorMessage}`);
    }
  };

  const openReasonModal = (orderId, status) => {
    setReasonModal({
      open: true,
      orderId,
      status,
      title: status === "Cancelled" ? "Cancel Order" : "Return Order",
    });
    setReasonInput("");
  };

  const closeReasonModal = () => {
    setReasonModal({ open: false, orderId: null, status: null, title: "" });
    setReasonInput("");
  };

  const handleReasonSubmit = () => {
    if (!reasonInput.trim()) {
      alert("Please provide a reason.");
      return;
    }
    changeStatus(reasonModal.orderId, reasonModal.status, reasonInput.trim());
  };

  /*
  const acceptOrderTakeaway = async (orderId) => {
    try {
      const response = await api.patch(`/orders/${orderId}/accept`);
      upsertOrder(response.data);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("Accept order failed:", e);
      }
      const errorMessage =
        e.response?.data?.message || e.message || "Failed to accept order";
      alert(errorMessage);
    }
  };
  */

  const handleNewTakeawayOrder = () => {
    setDraftSelections({});
    setDraftAddonSelections({});
    setCurrentOrder({
      serviceType: "TAKEAWAY",
      status: "Confirmed",
      isNew: true,
    });
    setIsModalOpen(true);
    loadAddons();
  };

  const handleEdit = (order) => {
    setDraftSelections({});
    setDraftAddonSelections({});
    setCurrentOrder({ ...order, isNew: false });
    setIsModalOpen(true);
    loadAddons();
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
        const requestType = `takeaway-status-${currentOrder._id}`;
        await withCancellation(requestType, async (signal) => {
          return await api.patch(
            `/orders/${currentOrder._id}/status`,
            { status: newStatus },
            { signal },
          );
        });
      }

      // Only allow adding items for unpaid orders (same rule as dine-in Orders panel)
      const isFinal =
        currentOrder.status === "Paid" ||
        currentOrder.status === "Cancelled" ||
        currentOrder.status === "Returned";

      if (!isFinal && draftItemsArray.length > 0) {
        const itemsToAdd = draftItemsArray.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }));
        await api.post(`/orders/${currentOrder._id}/add-items`, {
          items: itemsToAdd,
        });
      }

      if (!isFinal && draftAddonsArray.length > 0) {
        const existingAddons = Array.isArray(currentOrder.selectedAddons) ? currentOrder.selectedAddons : [];
        const newAddons = draftAddonsArray.map((a) => ({
          addonId: a.id,
          name: a.name,
          price: a.price,
          quantity: a.quantity,
        }));
        const mergedAddons = [...existingAddons, ...newAddons];
        await api.patch(`/orders/${currentOrder._id}/addons`, {
          selectedAddons: mergedAddons,
        });
      }

      // Refresh orders list by fetching again
      const ordersRes = await api.get("/orders");
      const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const takeawayOrders = allOrders.filter(
        (o) => o.serviceType === "TAKEAWAY",
      );

      setOrders(takeawayOrders);

      setIsModalOpen(false);
      setCurrentOrder(null);
      setDraftSelections({});
      setDraftAddonSelections({});
      alert("Order updated successfully!");
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Save failed:", err);
      }
      const errorMessage =
        err.response?.data?.message ||
        "Failed to update order. Please try again.";
      alert(errorMessage);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (draftItemsArray.length === 0) {
      alert("Please select at least one item to create a takeaway order.");
      return;
    }

    try {
      const itemsPayload = draftItemsArray.map((entry) => ({
        name: entry.name,
        quantity: entry.quantity,
        price: entry.price,
      }));

      const selectedAddonsPayload = draftAddonsArray.map((a) => ({
        addonId: a.id,
        name: a.name,
        price: a.price,
        quantity: a.quantity,
      }));
      const effectiveCartId = getEffectiveCartId();
      const payload = {
        serviceType: "TAKEAWAY",
        items: itemsPayload,
        ...(selectedAddonsPayload.length > 0 && { selectedAddons: selectedAddonsPayload }),
        ...(effectiveCartId && { cartId: effectiveCartId }),
      };

      if (import.meta.env.DEV) {
        console.log("[TakeawayOrders] Creating order with payload:", payload);
        console.log("[TakeawayOrders] Items count:", itemsPayload.length);
      }

      const res = await api.post("/orders", payload);
      const created = res.data;

      if (import.meta.env.DEV) {
        console.log("[TakeawayOrders] Order created successfully:", created);
      }

      // Refresh takeaway orders list
      const ordersRes = await api.get("/orders");
      if (import.meta.env.DEV) {
        console.log("[TakeawayOrders] Refreshed orders list:", ordersRes.data);
      }

      // Handle both response formats
      let allOrders = [];
      if (Array.isArray(ordersRes.data)) {
        allOrders = ordersRes.data;
      } else if (ordersRes.data && Array.isArray(ordersRes.data.data)) {
        allOrders = ordersRes.data.data;
      }

      const takeawayOrders = (allOrders || []).filter(
        (o) => o && o.serviceType === "TAKEAWAY",
      );

      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Filtered takeaway orders:",
          takeawayOrders.length,
        );
      }
      setOrders(takeawayOrders);

      setIsModalOpen(false);
      setCurrentOrder(null);
      setDraftSelections({});
      setDraftAddonSelections({});
      alert("Takeaway order created successfully!");
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to create takeaway order", err);
        console.error("Error response:", err.response?.data);
        console.error("Error status:", err.response?.status);
      }
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to create takeaway order. Please try again.";
      alert(`Error: ${errorMessage}\n\nCheck console for details.`);
    }
  };

  // handleDelete removed - cart admins cannot delete orders

  // Cancel/return individual items from an order
  const handleCancelItem = async (orderId, kotIndex, itemIndex) => {
    const order = orders.find((o) => o._id === orderId);
    if (!order) return;

    const kot = order.kotLines?.[kotIndex];
    const item = kot?.items?.[itemIndex];
    if (!item) return;

    // Check if item is already returned
    if (item.returned) {
      alert("This item has already been cancelled/returned.");
      return;
    }

    // Check if order can be modified
    if (["Cancelled", "Returned"].includes(order.status)) {
      alert(
        `Cannot cancel items from an order that is ${order.status.toLowerCase()}.`,
      );
      return;
    }

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to cancel "${item.name}" (${item.quantity}x) from this order?\n\nThis will remove this item from the order total.`,
      {
        title: "Cancel Item",
        warningMessage: "Cancel Item",
        danger: false,
        confirmText: "Cancel Item",
        cancelText: "Keep Item",
      },
    );

    if (!confirmed) return;

    try {
      const response = await api.patch(`/orders/${orderId}/return-items`, {
        itemIds: [{ kotIndex, itemIndex }],
      });

      // Update the order in the list with the response
      const updatedOrder = response.data.order;
      upsertOrder(updatedOrder);

      // If the modal is open for this order, update currentOrder state
      if (currentOrder && currentOrder._id === orderId) {
        setCurrentOrder(updatedOrder);
      }

      alert(`Item "${item.name}" has been cancelled successfully.`);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Cancel item failed:", err);
      }
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to cancel item";
      alert(errorMessage);
    }
  };

  const handleCancelAddonLine = async (orderId, addonIndex) => {
    const normalizedOrderId = normalizeId(orderId);
    const sourceOrder =
      orders.find((o) => normalizeId(o?._id) === normalizedOrderId) ||
      (normalizeId(currentOrder?._id) === normalizedOrderId
        ? currentOrder
        : null);
    if (!sourceOrder) return;

    if (["Paid", "Cancelled", "Returned"].includes(sourceOrder.status)) {
      alert(
        `Cannot cancel add-ons from an order that is ${String(sourceOrder.status || "").toLowerCase()}.`,
      );
      return;
    }

    const existingAddons = Array.isArray(sourceOrder.selectedAddons)
      ? sourceOrder.selectedAddons
      : [];
    const targetAddon = existingAddons[addonIndex];
    if (!targetAddon) return;

    const addonName = sanitizeAddonName(targetAddon.name);
    const addonQty = Number(targetAddon.quantity) || 1;

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to cancel "${addonName}" (${addonQty}x) from this order?`,
      {
        title: "Cancel Add-on",
        warningMessage: "Cancel Add-on",
        danger: false,
        confirmText: "Cancel Add-on",
        cancelText: "Keep Add-on",
      },
    );

    if (!confirmed) return;

    try {
      const updatedAddons = existingAddons.filter(
        (_, index) => index !== addonIndex,
      );
      const payload = updatedAddons.map((addon) => ({
        addonId: addon.addonId || addon._id || addon.id,
        name: addon.name,
        price: addon.price,
        quantity: addon.quantity,
      }));

      const response = await api.patch(`/orders/${sourceOrder._id}/addons`, {
        selectedAddons: payload,
      });

      const updatedOrder = response?.data;
      if (updatedOrder?._id) {
        upsertOrder(updatedOrder);
        if (
          currentOrder &&
          normalizeId(currentOrder._id) === normalizeId(updatedOrder._id)
        ) {
          setCurrentOrder(updatedOrder);
        }
      }

      alert(`Add-on "${addonName}" has been cancelled successfully.`);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Cancel add-on failed:", err);
      }
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to cancel add-on";
      alert(errorMessage);
    }
  };

  const getStatusIcon = (status) => {
    const normalizedStatus = normalizeLegacyTakeawayStatus(status);
    switch (normalizedStatus) {
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
      case "Accepted":
        return "✅";
      case "Being Prepared":
      case "BeingPrepared":
        return "🔥";
      case "Cancelled":
        return "❌";
      case "Returned":
        return "↩️";
      default:
        return "📦";
    }
  };

  const getTakeawayTileTheme = (status) => {
    const normalizedStatus = normalizeLegacyTakeawayStatus(status);
    switch (normalizedStatus) {
      case "Paid":
        return {
          card: "bg-emerald-50/70 border-emerald-200/80",
          icon: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
        };
      case "Confirmed":
      case "Accepted":
        return {
          card: "bg-amber-50/70 border-amber-200/80",
          icon: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
        };
      case "Preparing":
      case "Being Prepared":
      case "BeingPrepared":
        return {
          card: "bg-blue-50/70 border-blue-200/80",
          icon: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
        };
      case "Ready":
      case "Served":
        return {
          card: "bg-indigo-50/70 border-indigo-200/80",
          icon: "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200",
        };
      case "Finalized":
        return {
          card: "bg-cyan-50/70 border-cyan-200/80",
          icon: "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200",
        };
      case "Pending":
        return {
          card: "bg-orange-50/70 border-orange-200/80",
          icon: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
        };
      case "Cancelled":
        return {
          card: "bg-red-50/70 border-red-200/80",
          icon: "bg-red-100 text-red-700 ring-1 ring-red-200",
        };
      case "Returned":
        return {
          card: "bg-rose-50/70 border-rose-200/80",
          icon: "bg-rose-100 text-rose-700 ring-1 ring-rose-200",
        };
      default:
        return {
          card: "bg-slate-50/70 border-slate-200/80",
          icon: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        };
    }
  };

  // Details open by default; toggle only stores explicitly collapsed (false) vs expanded (true)
  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  const statusSummary = useMemo(() => {
    if (!Array.isArray(orders) || orders.length === 0) {
      return { total: 0, byStatus: {} };
    }
    return orders.reduce(
      (acc, order) => {
        if (!order) return acc;
        const status = normalizeLegacyTakeawayStatus(order.status);
        acc.total += 1;
        acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} },
    );
  }, [orders]);

  // Simplified status order for filter tabs
  // Flow: Preparing → Ready → Served → Paid
  const TAKEAWAY_STATUS_ORDER = [
    "Preparing",
    "Ready",
    "Served",
    "Paid",
    "Cancelled",
    "Returned",
  ];

  const statusBadgeClass = (status) => {
    const normalizedStatus = normalizeLegacyTakeawayStatus(status);
    switch (normalizedStatus) {
      case "Paid":
        return "border-green-200 text-green-700 bg-green-50";
      case "Confirmed":
      case "Accepted":
        return "border-yellow-200 text-yellow-700 bg-yellow-50";
      case "Preparing":
      case "Being Prepared":
      case "BeingPrepared":
        return "border-blue-200 text-blue-700 bg-blue-50";
      case "Ready":
      case "Served":
        return "border-purple-200 text-purple-700 bg-purple-50";
      case "Finalized":
        return "border-cyan-200 text-cyan-700 bg-cyan-50";
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
        !normalizedOrder ||
        (order._id || "").toLowerCase().includes(normalizedOrder);
      const tableMatch =
        !normalizedTable ||
        (order.tableNumber !== undefined &&
          order.tableNumber !== null &&
          String(order.tableNumber).toLowerCase().includes(normalizedTable));
      const invoiceId = buildInvoiceId(order).toLowerCase();
      const invoiceMatch =
        !normalizedInvoice || invoiceId.includes(normalizedInvoice);

      // Date filter: compare order date with filter date
      let dateMatch = true;
      if (filterDate) {
        const orderDate =
          getOrderCreatedDate(order) || getOrderUpdatedDate(order);
        dateMatch =
          Boolean(orderDate) && formatOrderDateForFilter(orderDate) === filterDate;
      }

      return orderIdMatch && tableMatch && invoiceMatch && dateMatch;
    });

    if (filterStatus === "all") return matches;
    if (filterStatus === "Being Prepared") {
      return matches.filter(
        (order) =>
          order.status === "Being Prepared" || order.status === "BeingPrepared",
      );
    }
    return matches.filter(
      (order) => normalizeLegacyTakeawayStatus(order.status) === filterStatus,
    );
  }, [
    orders,
    searchOrderId,
    searchTable,
    searchInvoice,
    filterStatus,
    filterDate,
  ]);

  const handleDownloadTakeawayReport = () => {
    const rows = filteredOrders.map((order) => {
      const createdAtDate = getOrderCreatedDate(order);
      const updatedAtDate = getOrderUpdatedDate(order);
      const kotLines = Array.isArray(order?.kotLines) ? order.kotLines : [];
      const selectedAddons = Array.isArray(order?.selectedAddons)
        ? order.selectedAddons
        : [];
      const aggregatedItems = aggregateKotItems(kotLines, selectedAddons);
      const totals = computeKotTotals(kotLines, aggregatedItems, order);
      const totalItems = aggregatedItems.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0,
      );

      return {
        "Order ID": order._id || "",
        "Invoice ID": buildInvoiceId(order),
        "Created At": formatOrderDateTimeLong(createdAtDate),
        "Updated At": formatOrderDateTimeLong(updatedAtDate),
        Status: order.status || "",
        "Service Type": order.serviceType || "TAKEAWAY",
        "Order Type": order.orderType || "",
        "Table / Counter": order.tableNumber || "",
        Token: order.orderType === "DELIVERY" ? "" : order.takeawayToken ?? "",
        Customer: order.customerName || "",
        Mobile: order.customerMobile || "",
        "Items Count": totalItems,
        "Total Amount (Rs)": Number((totals?.totalAmount || 0).toFixed(2)),
      };
    });

    const fileName = buildExcelFileName("takeaway-orders-report", filterDate);
    const exported = exportRowsToExcel({
      rows,
      fileName,
      sheetName: "TakeawayOrders",
    });

    if (!exported) {
      alert("No takeaway orders available for the selected filters.");
    }
  };

  const tryAccept = (order) => {
    /*
    if (
      canAcceptTakeaway(order.status) &&
      (order.serviceType === "TAKEAWAY" ||
        order.serviceType === "PICKUP" ||
        order.serviceType === "DELIVERY")
    ) {
      acceptOrderTakeaway(order._id);
    } else if (canAccept(order.status)) {
      changeStatus(order._id, nextStatusOnAccept);
    }
    */
    if (canAccept(order.status)) {
      changeStatus(order._id, nextStatusOnAccept);
    }
  };

  const transitions = ORDER_TRANSITIONS;

  return (
    <div className="p-2 sm:p-3 md:p-4">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-800 truncate">
            Takeaway Orders
          </h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
          <input
            type="text"
            placeholder="Order ID / token"
            value={searchOrderId}
            onChange={(e) => setSearchOrderId(e.target.value)}
            className="border border-gray-300 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
          />
          <input
            type="text"
            placeholder="Table number"
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            className="border border-gray-300 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
          />
          <input
            type="text"
            placeholder="Invoice ID"
            value={searchInvoice}
            onChange={(e) => setSearchInvoice(e.target.value)}
            className="border border-gray-300 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
            title="Filter by order date"
          />
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={() => {
                setSearchOrderId("");
                setSearchTable("");
                setSearchInvoice("");
                setFilterDate("");
              }}
              className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg text-xs sm:text-sm"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleDownloadTakeawayReport}
              className="px-2 sm:px-3 py-1.5 sm:py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs sm:text-sm whitespace-nowrap"
            >
              Download Excel
            </button>
            <button
              type="button"
              onClick={handleNewTakeawayOrder}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <span className="text-lg">+</span>
              Add Order
            </button>
          </div>
        </div>
      </div>

      {/* Status summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`rounded-2xl border p-3 sm:p-4 md:p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
            filterStatus === "all"
              ? "ring-2 ring-[#e0662f] shadow-md border-[#e8c3ab] bg-orange-50/70"
              : "shadow-sm border-[#ead7ca] bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3f291b] leading-none">
                {statusSummary.total}
              </div>
              <div className="mt-2 text-xs sm:text-[13px] text-[#6f5240] font-semibold uppercase tracking-wide truncate">
                All Takeaway
              </div>
            </div>
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg sm:text-xl bg-orange-100 text-orange-700 ring-1 ring-orange-200 flex-shrink-0">
              🥡
            </div>
          </div>
        </button>

        {TAKEAWAY_STATUS_ORDER.map((status) => {
          const byStatus = statusSummary.byStatus || {};
          const countToShow =
            status === "Being Prepared"
              ? (byStatus["Being Prepared"] || 0) +
                (byStatus["BeingPrepared"] || 0)
              : byStatus[status] || 0;

          // Hide tiles for statuses that have no orders
          if (!countToShow) return null;

          return (
            <button
              type="button"
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-2xl border p-3 sm:p-4 md:p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
                filterStatus === status
                  ? "ring-2 ring-[#e0662f] shadow-md"
                  : "shadow-sm"
              } ${getTakeawayTileTheme(status).card}`}
            >
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#3f291b] leading-none">
                    {String(countToShow).padStart(2, "0")}
                  </div>
                  <div className="mt-2 text-xs sm:text-[13px] text-[#6f5240] font-semibold uppercase tracking-wide truncate">
                    {status}
                  </div>
                </div>
                                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg sm:text-xl flex-shrink-0 ${getTakeawayTileTheme(status).icon}`}
                >
                  {getStatusIcon(status)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-md -mx-2 sm:mx-0">
        <table className="min-w-full text-xs sm:text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                Order Details
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                Date & Time
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                Table / Customer
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                  No takeaway orders match the current filters.
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => {
              // Validate order exists before processing
              if (!order) return null;

              const createdAtDate = getOrderCreatedDate(order);
              const updatedAtDate = getOrderUpdatedDate(order);
              const orderDate = createdAtDate || updatedAtDate;
              const { dateLabel: formattedDate, timeLabel: formattedTime } =
                formatOrderDateTime(orderDate);

              return (
                <React.Fragment key={order._id}>
                  <tr
                    className={`hover:bg-gray-50 ${
                      order.status === "Pending" ? "bg-orange-50" : ""
                    }`}
                  >
                    <td className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs">
                      <div
                        className="font-mono text-[9px] text-gray-400 mb-1 select-all"
                        title="Order ID"
                      >
                        {order._id}
                      </div>
                      <button
                        onClick={() => toggleExpand(order._id)}
                        className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 md:gap-2 w-full sm:w-auto text-left"
                      >
                        <span className="font-mono text-[9px] sm:text-[10px] md:text-xs text-gray-500 truncate">
                          {buildInvoiceId(order)}
                        </span>
                        <span className="text-gray-900 font-medium text-[10px] sm:text-xs md:text-sm">
                          {formattedTime}
                        </span>
                        {/* Mobile-only customer name */}
                        {order.customerName && (
                          <span className="sm:hidden text-[10px] text-blue-600 font-medium truncate block max-w-[100px]">
                            {order.customerName}
                          </span>
                        )}
                      </button>
                      {expanded[order._id] !== false && (
                        <div className="mt-1.5 text-[9px] sm:text-[10px] text-gray-600 space-y-0.5">
                          <div className="truncate">
                            Created:{" "}
                            {formatOrderDateTimeLong(createdAtDate || orderDate)}
                          </div>
                          <div className="truncate">
                            Updated: {formatOrderDateTimeLong(updatedAtDate)}
                          </div>
                          <div className="truncate">
                            Invoice:{" "}
                            <span className="font-mono">
                              {buildInvoiceId(order)}
                            </span>
                          </div>
                          <div>
                            Service Type:{" "}
                            <span className="font-semibold">
                              {order.orderType === "PICKUP"
                                ? "Pickup"
                                : order.orderType === "DELIVERY"
                                  ? "Delivery"
                                  : "Takeaway"}
                            </span>
                          </div>
                          {order.cancellationReason && (
                            <div className="text-red-600 font-medium bg-red-50 p-1.5 rounded mt-1 border border-red-100 mb-1">
                              Reason: {order.cancellationReason}
                            </div>
                          )}
                          {order.orderType && (
                            <div className="mt-1">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[9px] font-semibold ${
                                  order.orderType === "PICKUP"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {order.orderType === "PICKUP"
                                  ? "📦 PICKUP ORDER"
                                  : "🚚 DELIVERY ORDER"}
                              </span>
                            </div>
                          )}
                          {order.orderType !== "DELIVERY" &&
                            order.takeawayToken && (
                            <div className="font-semibold text-blue-600">
                              Token: {order.takeawayToken}
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="font-semibold text-gray-800">
                              Customer Info:
                            </div>
                            {order.customerName ? (
                              <>
                                <div>👤 Name: {order.customerName}</div>
                                {order.customerMobile && (
                                  <div>📱 Mobile: {order.customerMobile}</div>
                                )}
                                {order.customerEmail && (
                                  <div>📧 Email: {order.customerEmail}</div>
                                )}
                              </>
                            ) : (
                              <div className="text-gray-400 italic">
                                Customer information not available
                              </div>
                            )}
                          </div>
                          {/* Delivery/Pickup Location Info - Always show section */}
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            {order.orderType === "PICKUP" ? (
                              <>
                                <div className="font-semibold text-gray-800 mb-1">
                                  📦 Pickup Location:
                                </div>
                                {order.pickupLocation ? (
                                  <div className="text-[9px] text-gray-600 bg-blue-50 p-2 rounded">
                                    📍{" "}
                                    {order.pickupLocation.address ||
                                      "Address not set"}
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-gray-400 italic">
                                    Pickup location not set
                                  </div>
                                )}
                              </>
                            ) : order.orderType === "DELIVERY" ? (
                              <>
                                <div className="font-semibold text-gray-800 mb-1">
                                  🚚 Delivery Details:
                                </div>
                                {order.customerLocation ? (
                                  <div className="text-[9px] text-gray-600 bg-green-50 p-2 rounded space-y-1">
                                    <div>
                                      📍{" "}
                                      {order.customerLocation.address ||
                                        "Address not set"}
                                    </div>
                                    {order.deliveryInfo && (
                                      <div className="mt-1 pt-1 border-t border-green-200">
                                        <div>
                                          📏 Distance:{" "}
                                          {order.deliveryInfo.distance?.toFixed(
                                            2,
                                          ) || "N/A"}{" "}
                                          km
                                        </div>
                                        {order.deliveryInfo.deliveryCharge >
                                          0 && (
                                          <div className="text-green-700 font-semibold">
                                            💰 Delivery Charge: ₹
                                            {order.deliveryInfo.deliveryCharge.toFixed(
                                              2,
                                            )}
                                          </div>
                                        )}
                                        {order.deliveryInfo.estimatedTime && (
                                          <div>
                                            ⏱️ Est. Time:{" "}
                                            {order.deliveryInfo.estimatedTime}{" "}
                                            min
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-[9px] text-gray-400 italic">
                                    Delivery address not set
                                  </div>
                                )}
                              </>
                            ) : null}
                          </div>
                          {/* Special Instructions */}
                          {order.specialInstructions && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="font-semibold text-gray-800">
                                Special Instructions:
                              </div>
                              <div className="text-[9px] text-gray-600 italic">
                                {order.specialInstructions}
                              </div>
                            </div>
                          )}
                          {/* Session code hidden from UI - data still used for backend */}
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs text-gray-600 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-gray-900 text-xs sm:text-sm">
                          {formattedDate}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-500">
                          {formattedTime}
                        </span>
                      </div>
                    </td>
                    <td className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 hidden sm:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg flex-shrink-0">
                            🥡
                          </span>
                          <span className="text-xs sm:text-sm md:text-sm lg:text-base font-semibold text-gray-700 truncate">
                            {order.tableNumber || "TAKEAWAY"}
                          </span>
                        </div>
                        {/* Order Type Badge - Always show for clarity */}
                        <div className="mt-1 mb-1">
                          {order.orderType ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${
                                order.orderType === "PICKUP"
                                  ? "bg-blue-100 text-blue-700 border border-blue-300"
                                  : "bg-green-100 text-green-700 border border-green-300"
                              }`}
                            >
                              {order.orderType === "PICKUP"
                                ? "📦 PICKUP ORDER"
                                : "🚚 DELIVERY ORDER"}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                              🥡 TAKEAWAY
                            </span>
                          )}
                        </div>
                        {/* Always show customer info section for takeaway orders */}
                        {order.customerName || order.customerMobile ? (
                          <div className="text-xs sm:text-sm mt-1 space-y-0.5 sm:space-y-1">
                            {order.customerName && (
                              <div className="font-medium text-gray-800">
                                👤 {order.customerName}
                              </div>
                            )}
                            {order.customerMobile && (
                              <div className="text-gray-600">
                                📱 {order.customerMobile}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[10px] sm:text-xs text-gray-400 italic mt-1">
                            Customer info not available
                          </div>
                        )}
                        {/* Delivery Info */}
                        {order.orderType === "DELIVERY" &&
                          order.deliveryInfo && (
                            <div className="text-[10px] sm:text-xs mt-1 space-y-0.5">
                              {order.deliveryInfo.distance && (
                                <div className="text-gray-600">
                                  📏 {order.deliveryInfo.distance.toFixed(2)} km
                                  away
                                </div>
                              )}
                              {order.deliveryInfo.deliveryCharge > 0 && (
                                <div className="text-green-600 font-semibold">
                                  💰 Delivery: ₹
                                  {order.deliveryInfo.deliveryCharge.toFixed(2)}
                                </div>
                              )}
                            </div>
                          )}
                        {order.orderType !== "DELIVERY" &&
                          order.takeawayToken && (
                          <div className="text-xs mt-1.5 font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            Token: {order.takeawayToken}
                          </div>
                        )}
                        {/* Session token hidden from UI - data still used for backend */}
                      </div>
                    </td>
                    <td className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2">
                      <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
                        <span
                          className={`px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 inline-flex items-center gap-0.5 sm:gap-1 md:gap-2 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium rounded-full border ${statusBadgeClass(
                            order.status,
                          )}`}
                        >
                          <span className="text-[10px] sm:text-xs md:text-sm">
                            {getStatusIcon(order.status)}
                          </span>
                          <span className="truncate">
                            {normalizeLegacyTakeawayStatus(order.status)}
                          </span>
                        </span>
                        {/*
                        {order.acceptedBy?.employeeName && (
                          <div className="text-[9px] sm:text-[10px] text-green-700 mt-0.5 font-medium">
                            Accepted by {order.acceptedBy.employeeName}
                            {order.acceptedBy.disability?.hasDisability &&
                              order.acceptedBy.disability?.type && (
                                <span className="text-gray-500 ml-1">
                                  ({order.acceptedBy.disability.type})
                                </span>
                              )}
                          </div>
                        )}
                        */}
                        <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                          {(() => {
                            const isTakeaway = [
                              "TAKEAWAY",
                              "PICKUP",
                              "DELIVERY",
                            ].includes(order.serviceType);
                            const nextStatus = isTakeaway
                              ? getNextStatusTakeaway(order.status)
                              : getNextStatus(order.status, order.serviceType);
                            const buttons = [];
                            const canShowTakeawayAccept = false;
                            const canShowDirectAccept = false;

                            /*
                            if (canAcceptTakeaway(order.status) && isTakeaway) {
                              buttons.push(
                                <button
                                  key="accept-takeaway"
                                  onClick={() => acceptOrderTakeaway(order._id)}
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-green-200 text-green-700 hover:bg-green-50 bg-green-50 whitespace-nowrap"
                                >
                                  ✅ Accept Order
                                </button>,
                              );
                            } else if (canAccept(order.status)) {
                              buttons.push(
                                <button
                                  key="accept"
                                  onClick={() => tryAccept(order)}
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-green-200 text-green-700 hover:bg-green-50 bg-green-50 whitespace-nowrap"
                                >
                                  ✅{" "}
                                  <span className="hidden sm:inline">
                                    Accept
                                  </span>
                                </button>,
                              );
                            }
                            */

                            // Show next sequential step button (but skip if canAccept/canAcceptTakeaway is true)
                            if (
                              nextStatus &&
                              !canShowDirectAccept &&
                              !canShowTakeawayAccept
                            ) {
                              buttons.push(
                                <button
                                  key="next"
                                  onClick={() =>
                                    changeStatus(order._id, nextStatus)
                                  }
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50 truncate max-w-[90px] sm:max-w-none"
                                >
                                  {nextStatus}
                                </button>,
                              );
                            }

                            if (canReturn(order.status)) {
                              buttons.push(
                                <button
                                  key="return"
                                  onClick={() =>
                                    openReasonModal(order._id, "Returned")
                                  }
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50 whitespace-nowrap"
                                >
                                  ↩️{" "}
                                  <span className="hidden sm:inline">
                                    Return
                                  </span>
                                </button>,
                              );
                            } else if (canCancel(order.status)) {
                              buttons.push(
                                <button
                                  key="cancel"
                                  onClick={() =>
                                    openReasonModal(order._id, "Cancelled")
                                  }
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
                                >
                                  ❌{" "}
                                  <span className="hidden sm:inline">
                                    Cancel
                                  </span>
                                </button>,
                              );
                            }

                            return buttons;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs">
                      <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2">
                        {/* Modify Order button - only show for unpaid orders */}
                        {order.status !== "Paid" &&
                          order.status !== "Cancelled" &&
                          order.status !== "Returned" && (
                            <button
                              onClick={() => handleEdit(order)}
                              className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded-md hover:bg-blue-50 font-medium whitespace-nowrap"
                              title="Add more items to this takeaway order"
                            >
                              ➕{" "}
                              <span className="hidden sm:inline">Modify</span>
                            </button>
                          )}
                        <button
                          onClick={() => handleEdit(order)}
                          className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded-md hover:bg-indigo-50 whitespace-nowrap"
                        >
                          ✏️ <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => printOrderInvoice(order)}
                          className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-md border text-[10px] sm:text-xs md:text-sm text-gray-700 border-gray-200 hover:bg-gray-100 whitespace-nowrap"
                          title="Print invoice"
                        >
                          🖨️ <span className="hidden sm:inline">Print</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expanded[order._id] !== false && (
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3">
                        <div className="space-y-2.5">
                          {/* Whole order panel (KOT items + add-ons) */}
                          {(() => {
                            const kotLines = Array.isArray(order?.kotLines) ? order.kotLines : [];
                            const aggregatedItems = aggregateKotItems(kotLines);
                            const totals = computeKotTotals(kotLines, aggregatedItems, order);
                            const selectedAddons = Array.isArray(order?.selectedAddons) ? order.selectedAddons : [];
                            const addonsTotal = selectedAddons.reduce(
                              (sum, a) => sum + (Number(a.price) || 0) * (Number(a.quantity) || 1),
                              0
                            );
                            const flatItems = kotLines.flatMap((kot, kotIdx) =>
                              (Array.isArray(kot?.items) ? kot.items : []).map((item, itemIdx) =>
                                item ? { item, kotIdx, itemIdx } : null
                              ).filter(Boolean)
                            );
                            const hasAny = flatItems.length > 0 || selectedAddons.length > 0;
                            if (!hasAny) {
                              return (
                                <div className="bg-white p-3 rounded-lg border shadow-sm">
                                  <div className="text-xs text-gray-500">No items in this order yet.</div>
                                </div>
                              );
                            }
                            return (
                              <div className="bg-white p-3 rounded-lg border shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="text-base font-semibold text-gray-800">Order</div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        kotLines.forEach((kot, idx) => printKOT(order, kot, idx));
                                      }}
                                      className="px-1.5 py-0.5 text-[11px] text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-100 bg-white"
                                      title="Print Order"
                                    >
                                      🖨️ Print Order
                                    </button>
                                  </div>
                                  <div className="text-base font-bold text-green-600">
                                    ₹{(totals.totalAmount + addonsTotal).toFixed(2)}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  {flatItems.map(({ item, kotIdx, itemIdx }, keyIdx) => (
                                    <div
                                      key={`k-${keyIdx}`}
                                      className={`flex justify-between items-center py-1.5 border-b ${
                                        item.returned ? "opacity-50 bg-gray-100" : ""
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 flex-1">
                                        <span
                                          className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold ${
                                            item.returned ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                          }`}
                                        >
                                          {item.quantity}x
                                        </span>
                                        <span className={item.returned ? "line-through text-gray-800" : "text-gray-800"}>
                                          {item.name}
                                        </span>
                                        {item.returned && (
                                          <span className="text-xs text-red-600 font-semibold">(Cancelled)</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className={item.returned ? "line-through text-gray-600" : "text-gray-600"}>
                                          ₹{(((item.price || 0) / 100) * (item.quantity || 1)).toFixed(2)}
                                        </span>
                                        {!item.returned &&
                                          order.status !== "Paid" &&
                                          order.status !== "Cancelled" &&
                                          order.status !== "Returned" && (
                                            <button
                                              type="button"
                                              onClick={() => handleCancelItem(order._id, kotIdx, itemIdx)}
                                              className="px-1.5 py-0.5 text-[11px] text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 transition-colors"
                                              title="Cancel this item"
                                            >
                                              ❌ Cancel
                                            </button>
                                          )}
                                      </div>
                                    </div>
                                  ))}
                                  {selectedAddons.map((addon, aIdx) => {
                                    const qty = Number(addon.quantity) || 1;
                                    const price = Number(addon.price) || 0;
                                    const name = sanitizeAddonName(addon.name);
                                    return (
                                      <div
                                        key={`a-${aIdx}`}
                                        className="flex justify-between items-center py-1.5 border-b border-gray-100"
                                      >
                                        <div className="flex items-center gap-2 flex-1">
                                          <span className="px-1.5 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700">
                                            {qty}x
                                          </span>
                                          <span className="text-gray-800">
                                            {name}
                                            <span className="ml-1 text-blue-600 font-semibold text-[10px] whitespace-nowrap">
                                              ADD-ON
                                            </span>
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-gray-600">
                                            ₹{(price * qty).toFixed(2)}
                                          </span>
                                          {order.status !== "Paid" &&
                                            order.status !== "Cancelled" &&
                                            order.status !== "Returned" && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleCancelAddonLine(
                                                    order._id,
                                                    aIdx,
                                                  )
                                                }
                                                className="px-1.5 py-0.5 text-[11px] text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 transition-colors"
                                                title="Cancel this add-on"
                                              >
                                                ❌ Cancel
                                              </button>
                                            )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-auto">
            <div className="flex justify-between items-center p-3 sm:p-4 md:p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 truncate">
                {currentOrder?.isNew
                  ? "Create Takeaway Order"
                  : "Edit Takeaway Order"}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setCurrentOrder(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl leading-none p-1 ml-2 flex-shrink-0"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 sm:p-4 md:p-5">
              <form
                onSubmit={currentOrder?.isNew ? handleCreate : handleSave}
                className="space-y-5 sm:space-y-6"
              >
                {currentOrder?.isNew ? (
                  <>
                    {/* New takeaway order - only menu selection & summary */}
                    <div className="border-t border-gray-200 pt-1 space-y-3 sm:space-y-4">
                      <p className="text-[11px] sm:text-xs text-gray-500">
                        Build a new takeaway order by selecting items from the
                        menu below. This will create a new TAKEAWAY order.
                      </p>
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
                        <div className="xl:col-span-2 space-y-3 sm:space-y-4">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-3">
                            <input
                              type="text"
                              value={draftSearch}
                              onChange={(e) => setDraftSearch(e.target.value)}
                              placeholder="Search menu items..."
                              className="flex-1 shadow-sm border border-gray-300 rounded-lg py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            />
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              <button
                                type="button"
                                onClick={() => setDraftCategory("all")}
                                className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full border transition whitespace-nowrap ${
                                  draftCategory === "all"
                                    ? "bg-blue-600 text-white border-blue-600 shadow"
                                    : "border-gray-300 text-gray-600 hover:border-blue-400"
                                }`}
                              >
                                All
                              </button>
                              {Array.from(
                                new Set(menuItems.map((it) => it.category)),
                              ).map((category) => (
                                <button
                                  type="button"
                                  key={category || "uncategorized"}
                                  onClick={() =>
                                    setDraftCategory(
                                      category || "Uncategorized",
                                    )
                                  }
                                  className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full border transition whitespace-nowrap ${
                                    draftCategory ===
                                    (category || "Uncategorized")
                                      ? "bg-blue-600 text-white border-blue-600 shadow"
                                      : "border-gray-300 text-gray-600 hover:border-blue-400"
                                  }`}
                                >
                                  {category || "Uncategorized"}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="border border-gray-200 rounded-lg max-h-60 sm:max-h-80 overflow-y-auto divide-y">
                            {menuLoading ? (
                              <div className="p-3 sm:p-4 text-xs sm:text-sm text-gray-500">
                                Loading menu…
                              </div>
                            ) : menuError ? (
                              <div className="p-3 sm:p-4 text-xs sm:text-sm text-red-600">
                                {menuError}
                              </div>
                            ) : filteredMenuItems.length === 0 ? (
                              <div className="p-3 sm:p-4 text-xs sm:text-sm text-gray-500">
                                No menu items match your filters.
                              </div>
                            ) : (
                              filteredMenuItems.map((item) => {
                                const quantity =
                                  draftSelections[getItemKey(item)]?.quantity ||
                                  0;
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
                                        ₹{formatMoney(item.price)} ·{" "}
                                        {item.category}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          adjustItemQuantity(item, -1)
                                        }
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
                                        onClick={() =>
                                          adjustItemQuantity(item, 1)
                                        }
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
                          {/* Add-ons: always visible for new takeaway order */}
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">Add-ons</h4>
                            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y bg-gray-50/50">
                              {addonsLoading ? (
                                <div className="p-3 text-xs text-gray-500">Loading add-ons…</div>
                              ) : addonList.length === 0 ? (
                                <div className="p-3 text-xs text-gray-500">No add-ons available.</div>
                              ) : (
                                addonList.map((addon) => {
                                  const id = addon._id || addon.id;
                                  const quantity = draftAddonSelections[id] || 0;
                                  return (
                                    <div
                                      key={id}
                                      className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-gray-50"
                                    >
                                      <div>
                                        <div className="text-sm font-medium text-gray-800">
                                          {sanitizeAddonName(addon.name)}
                                        </div>
                                        <div className="text-xs text-gray-500">₹{formatMoney(addon.price || 0)}</div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => adjustAddonQuantity(addon, -1)}
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
                                          onClick={() => adjustAddonQuantity(addon, 1)}
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
                        </div>
                        <div className="space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-gray-800 mb-3">
                              Order Summary
                            </h3>
                            {draftItemsArray.length === 0 && draftAddonsArray.length === 0 ? (
                              <p className="text-sm text-gray-500">
                                No items selected yet. Use the menu on the left
                                or add-ons to build the order.
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
                                      ₹
                                      {formatMoney(
                                        entry.price * entry.quantity,
                                      )}
                                    </span>
                                  </div>
                                ))}
                                {draftAddonsArray.map((entry) => (
                                  <div
                                    key={entry.id}
                                    className="flex justify-between items-center"
                                  >
                                    <span>{entry.name} × {entry.quantity}</span>
                                    <span>₹{formatMoney(entry.price * entry.quantity)}</span>
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
                              {draftTotals.addonsSubtotal > 0 && (
                                <div className="flex justify-between">
                                  <span>Add-ons</span>
                                  <span>₹{formatMoney(draftTotals.addonsSubtotal)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-200">
                                <span>Total</span>
                                <span>₹{formatMoney(draftTotals.total)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Status section */}
                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2">
                        Order Status{" "}
                        {getStatusIcon(currentOrder?.status || "Pending")}
                      </label>
                      <select
                        name="status"
                        defaultValue={
                          normalizeLegacyTakeawayStatus(currentOrder?.status) ||
                          "Preparing"
                        }
                        className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      >
                        <option value="Preparing">🔥 Preparing</option>
                        <option value="Ready">🍽️ Ready</option>
                        <option value="Served">🍴 Served</option>
                        <option value="Paid">✅ Paid</option>
                        <option value="Cancelled">❌ Cancelled</option>
                        <option value="Returned">↩️ Returned</option>
                      </select>
                    </div>

                    {/* Cancellation/Return Reason Display */}
                    {currentOrder?.cancellationReason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mt-4">
                        <h4 className="text-sm font-bold text-red-800 mb-1">
                          Reason for{" "}
                          {currentOrder.status === "Returned"
                            ? "Return"
                            : "Cancellation"}
                          :
                        </h4>
                        <p className="text-sm text-red-700">
                          {currentOrder.cancellationReason}
                        </p>
                      </div>
                    )}

                    {/* Current Order Items - whole order (no per-KOT) */}
                    <div className="border-t border-gray-200 pt-4 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Current Order Items
                      </h3>
                      {((!currentOrder?.kotLines ||
                        currentOrder.kotLines.length === 0) &&
                        (!currentOrder?.selectedAddons ||
                          currentOrder.selectedAddons.length === 0)) ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                          No items in this order yet.
                        </div>
                      ) : (() => {
                        const kotLines = currentOrder.kotLines;
                        const aggregatedItems = aggregateKotItems(kotLines);
                        const totals = computeKotTotals(kotLines, aggregatedItems, currentOrder);
                        const selectedAddons = Array.isArray(currentOrder?.selectedAddons) ? currentOrder.selectedAddons : [];
                        const addonsTotal = selectedAddons.reduce(
                          (sum, a) => sum + (Number(a.price) || 0) * (Number(a.quantity) || 1),
                          0
                        );
                        const flatItems = kotLines.flatMap((kot, kotIdx) =>
                          (Array.isArray(kot?.items) ? kot.items : []).map((item, itemIdx) =>
                            item ? { item, kotIdx, itemIdx } : null
                          ).filter(Boolean)
                        );
                        return (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-semibold text-gray-700">Order</span>
                              <span className="text-sm font-bold text-green-600">
                                ₹{(totals.totalAmount + addonsTotal).toFixed(2)}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {flatItems.map(({ item, kotIdx, itemIdx }, keyIdx) => (
                                <div
                                  key={`k-${keyIdx}`}
                                  className={`flex justify-between items-center py-2 px-3 rounded border ${
                                    item.returned
                                      ? "bg-red-50 border-red-200 opacity-60"
                                      : "bg-white border-gray-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-bold ${
                                        item.returned ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                      }`}
                                    >
                                      {item.quantity}x
                                    </span>
                                    <span className={`text-sm text-gray-800 ${item.returned ? "line-through" : ""}`}>
                                      {item.name}
                                    </span>
                                    {item.returned && (
                                      <span className="text-xs text-red-600 font-semibold">(Cancelled)</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`text-sm text-gray-600 ${item.returned ? "line-through" : ""}`}>
                                      ₹{(((item.price || 0) / 100) * (item.quantity || 1)).toFixed(2)}
                                    </span>
                                    {!item.returned &&
                                      currentOrder.status !== "Paid" &&
                                      currentOrder.status !== "Cancelled" &&
                                      currentOrder.status !== "Returned" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCancelItem(currentOrder._id, kotIdx, itemIdx)
                                          }
                                          className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 transition-colors"
                                          title="Cancel this item"
                                        >
                                          ❌ Cancel
                                        </button>
                                      )}
                                  </div>
                                </div>
                              ))}
                              {selectedAddons.map((addon, aIdx) => {
                                const qty = Number(addon.quantity) || 1;
                                const price = Number(addon.price) || 0;
                                const name = sanitizeAddonName(addon.name);
                                return (
                                  <div
                                    key={`a-${aIdx}`}
                                    className="flex justify-between items-center py-2 px-3 rounded border bg-white border-gray-200"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700">
                                        {qty}x
                                      </span>
                                      <span className="text-sm text-gray-800">
                                        {name}
                                        <span className="ml-1 text-blue-600 font-semibold text-[10px] whitespace-nowrap">
                                          ADD-ON
                                        </span>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-gray-600">
                                        ₹{(price * qty).toFixed(2)}
                                      </span>
                                      {currentOrder.status !== "Paid" &&
                                        currentOrder.status !== "Cancelled" &&
                                        currentOrder.status !== "Returned" && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleCancelAddonLine(
                                                currentOrder._id,
                                                aIdx,
                                              )
                                            }
                                            className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 transition-colors"
                                            title="Cancel this add-on"
                                          >
                                            ❌ Cancel
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Add items section (Modify Order logic) */}
                    <div className="border-t border-gray-200 pt-4 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Add Items to Takeaway Order
                      </h3>
                      {["Paid", "Cancelled", "Returned"].includes(
                        currentOrder?.status || "",
                      ) ? (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                          You cannot add items to this order because it is{" "}
                          <strong>
                            {normalizeLegacyTakeawayStatus(currentOrder?.status)}
                          </strong>. Items can
                          only be added to unpaid takeaway orders.
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500">
                            Select items from the menu below to add more items
                            to this takeaway order. These will be added to this
                            order.
                          </p>
                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                            <div className="xl:col-span-2 space-y-4">
                              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                                <input
                                  type="text"
                                  value={draftSearch}
                                  onChange={(e) =>
                                    setDraftSearch(e.target.value)
                                  }
                                  placeholder="Search menu items..."
                                  className="flex-1 shadow-sm border border-gray-300 rounded-lg py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                />
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setDraftCategory("all")}
                                    className={`px-3 py-1 text-sm rounded-full border transition ${
                                      draftCategory === "all"
                                        ? "bg-blue-600 text-white border-blue-600 shadow"
                                        : "border-gray-300 text-gray-600 hover:border-blue-400"
                                    }`}
                                  >
                                    All
                                  </button>
                                  {Array.from(
                                    new Set(menuItems.map((it) => it.category)),
                                  ).map((category) => (
                                    <button
                                      type="button"
                                      key={category || "uncategorized"}
                                      onClick={() =>
                                        setDraftCategory(
                                          category || "Uncategorized",
                                        )
                                      }
                                      className={`px-3 py-1 text-sm rounded-full border transition ${
                                        draftCategory ===
                                        (category || "Uncategorized")
                                          ? "bg-blue-600 text-white border-blue-600 shadow"
                                          : "border-gray-300 text-gray-600 hover:border-blue-400"
                                      }`}
                                    >
                                      {category || "Uncategorized"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="border border-gray-200 rounded-lg max-h-60 sm:max-h-80 overflow-y-auto divide-y">
                                {menuLoading ? (
                                  <div className="p-3 sm:p-4 text-xs sm:text-sm text-gray-500">
                                    Loading menu…
                                  </div>
                                ) : menuError ? (
                                  <div className="p-3 sm:p-4 text-xs sm:text-sm text-red-600">
                                    {menuError}
                                  </div>
                                ) : filteredMenuItems.length === 0 ? (
                                  <div className="p-3 sm:p-4 text-xs sm:text-sm text-gray-500">
                                    No menu items match your filters.
                                  </div>
                                ) : (
                                  filteredMenuItems.map((item) => {
                                    const quantity =
                                      draftSelections[getItemKey(item)]
                                        ?.quantity || 0;
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
                                            ₹{formatMoney(item.price)} ·{" "}
                                            {item.category}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              adjustItemQuantity(item, -1)
                                            }
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
                                            onClick={() =>
                                              adjustItemQuantity(item, 1)
                                            }
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
                              {/* Add-ons: always visible so admin can add add-ons to the order */}
                              <div className="mt-4">
                                <h4 className="text-sm font-semibold text-gray-800 mb-2">
                                  Add-ons
                                </h4>
                                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y bg-gray-50/50">
                                  {addonsLoading ? (
                                    <div className="p-3 text-xs text-gray-500">
                                      Loading add-ons…
                                    </div>
                                  ) : addonList.length === 0 ? (
                                    <div className="p-3 text-xs text-gray-500">
                                      No add-ons available.
                                    </div>
                                  ) : (
                                    addonList.map((addon) => {
                                      const id = addon._id || addon.id;
                                      const quantity = draftAddonSelections[id] || 0;
                                      return (
                                        <div
                                          key={id}
                                          className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-gray-50"
                                        >
                                          <div>
                                            <div className="text-sm font-medium text-gray-800">
                                              {sanitizeAddonName(addon.name)}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              ₹{formatMoney(addon.price || 0)}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => adjustAddonQuantity(addon, -1)}
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
                                              onClick={() => adjustAddonQuantity(addon, 1)}
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
                            </div>
                            <div className="space-y-4">
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <h3 className="text-md font-semibold text-gray-800 mb-3">
                                  New Items Summary
                                </h3>
                                {draftItemsArray.length === 0 && draftAddonsArray.length === 0 ? (
                                  <p className="text-sm text-gray-500">
                                    No items selected yet. Use the menu on the
                                    left to add items or add-ons below.
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
                                          ₹
                                          {formatMoney(
                                            entry.price * entry.quantity,
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                    {draftAddonsArray.map((entry) => (
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
                                    <span>
                                      ₹{formatMoney(draftTotals.subtotal)}
                                    </span>
                                  </div>
                                  {draftTotals.addonsSubtotal > 0 && (
                                    <div className="flex justify-between">
                                      <span>Add-ons</span>
                                      <span>₹{formatMoney(draftTotals.addonsSubtotal)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-200">
                                    <span>Total</span>
                                    <span>
                                      ₹{formatMoney(draftTotals.total)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                <div className="pt-3 sm:pt-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setCurrentOrder(null);
                        setDraftSelections({});
                        setDraftAddonSelections({});
                      }}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs sm:text-sm md:text-base w-full sm:w-auto"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm md:text-base w-full sm:w-auto"
                    >
                      {currentOrder?.isNew ? "Create Order" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {reasonModal.open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">
                {reasonModal.title}
              </h3>
              <button
                onClick={closeReasonModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                type="button"
              >
                x
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please provide a reason:
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[100px]"
                placeholder="Type here..."
                autoFocus
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={closeReasonModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                type="button"
              >
                Close
              </button>
              <button
                onClick={handleReasonSubmit}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${
                  reasonModal.status === "Cancelled"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
                type="button"
              >
                Confirm {reasonModal.status === "Cancelled" ? "Cancel" : "Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeawayOrders;

