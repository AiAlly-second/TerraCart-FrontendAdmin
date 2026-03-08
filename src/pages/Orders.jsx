import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getSocket } from "../utils/socket";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  ORDER_TRANSITIONS,
  canAccept,
  canAcceptTakeaway,
  nextStatusOnAccept,
  getNextStatus,
  getNextStatusTakeaway,
  canCancel,
  canReturn,
} from "../domain/orderLogic";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { withCancellation } from "../utils/requestManager";
import tableIcon from "../assets/images/Attached_image-removebg-preview.png";
import { buildExcelFileName, exportRowsToExcel } from "../utils/excelReport";

// Helper: get API base URL with protocol ensured
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
  // If URL doesn't start with http:// or https://, add http://
  if (envUrl && !envUrl.match(/^https?:\/\//)) {
    return `http://${envUrl}`;
  }
  return envUrl;
};

const nodeApi = getApiBaseUrl().replace(/\/$/, "");
const ORDER_SUMMARY_TILE_STATUSES = [
  "all",
  "active",
  "Preparing",
  "Ready",
  "Paid",
  "Served",
  "Cancelled",
  "Returned",
];
const ORDER_SUMMARY_TILE_LABELS = {
  all: "All",
  active: "Active",
};

// Use centralized socket connection with proper CORS configuration
const socket = getSocket();

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
const normalizeStatusToken = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

const PREPARING_LIKE_STATUSES = new Set([
  "new",
  "new order",
  "pending",
  "confirmed",
  "accept",
  "accepted",
  "being prepared",
  "beingprepared",
  "preparing",
  "queued",
  "queue",
  "in progress",
  "inprogress",
  "processing",
]);
const READY_LIKE_STATUSES = new Set(["ready"]);
const SERVED_LIKE_STATUSES = new Set([
  "served",
  "completed",
  "finalized",
  "exit",
  "closed",
]);
const PAID_LIKE_STATUSES = new Set(["paid"]);
const CANCELLED_LIKE_STATUSES = new Set([
  "cancelled",
  "canceled",
  "rejected",
]);
const RETURNED_LIKE_STATUSES = new Set(["returned", "refunded"]);

const normalizeLegacyOrderStatus = (status, order = null) => {
  const primaryToken = normalizeStatusToken(status);
  if (!order && (primaryToken === "all" || primaryToken === "active")) {
    return primaryToken;
  }
  const lifecycleToken = normalizeStatusToken(order?.lifecycleStatus);
  const effectiveToken = primaryToken || lifecycleToken;
  const paymentPaid =
    normalizeStatusToken(order?.paymentStatus) === "paid" ||
    order?.isPaid === true;
  const serviceTypeToken = String(order?.serviceType || "")
    .trim()
    .toUpperCase();
  const isPaidNonDineInOrder =
    paymentPaid &&
    (serviceTypeToken === "TAKEAWAY" ||
      serviceTypeToken === "PICKUP" ||
      serviceTypeToken === "DELIVERY");
  const hasCancellationReason = String(order?.cancellationReason || "").trim() !== "";
  const hasReturnedMarker = Boolean(order?.returnedAt);

  if (hasReturnedMarker) return "Returned";
  if (CANCELLED_LIKE_STATUSES.has(effectiveToken)) return "Cancelled";
  if (RETURNED_LIKE_STATUSES.has(effectiveToken)) return "Returned";
  if (PAID_LIKE_STATUSES.has(effectiveToken)) return "Paid";
  if (isPaidNonDineInOrder) return "Paid";
  if (hasCancellationReason && !paymentPaid) return "Cancelled";
  if (
    SERVED_LIKE_STATUSES.has(effectiveToken) ||
    SERVED_LIKE_STATUSES.has(lifecycleToken)
  ) {
    return paymentPaid ? "Paid" : "Served";
  }
  if (
    READY_LIKE_STATUSES.has(effectiveToken) ||
    READY_LIKE_STATUSES.has(lifecycleToken)
  ) {
    return "Ready";
  }
  if (
    PREPARING_LIKE_STATUSES.has(effectiveToken) ||
    PREPARING_LIKE_STATUSES.has(lifecycleToken)
  ) {
    return "Preparing";
  }

  return "Preparing";
};

const resolveOrderPaymentType = (order) => {
  const explicitMethod = String(
    order?.paymentMethod || order?.paymentMode || order?.payment?.method || "",
  )
    .trim()
    .toUpperCase();

  if (explicitMethod === "ONLINE" || explicitMethod === "CARD") return "Online";
  if (explicitMethod === "CASH" || explicitMethod === "COD") return "COD";

  const officeMode = String(order?.officePaymentMode || "").trim().toUpperCase();
  if (officeMode === "ONLINE") return "Online";
  if (officeMode === "COD") return "COD";
  if (officeMode === "BOTH") return "COD";

  if (Boolean(order?.paymentRequiredBeforeProceeding)) return "COD";

  return "COD";
};

const toUpperToken = (value) => String(value || "").trim().toUpperCase();

const isPickupOrDeliveryServiceOrder = (order) => {
  const orderType = toUpperToken(order?.orderType);
  const serviceType = toUpperToken(order?.serviceType);
  return (
    orderType === "PICKUP" ||
    orderType === "DELIVERY" ||
    serviceType === "PICKUP" ||
    serviceType === "DELIVERY"
  );
};

const requiresPaymentBeforeStatusProgress = (order) => {
  const sourceType = toUpperToken(order?.sourceQrType);
  if (sourceType === "OFFICE") return true;

  const serviceType = toUpperToken(order?.serviceType);
  if (serviceType === "DINE_IN") return false;

  if (Boolean(order?.paymentRequiredBeforeProceeding)) return true;
  return isPickupOrDeliveryServiceOrder(order);
};

const isPaymentClearedForStatusProgress = (order) => {
  const paymentMode = toUpperToken(order?.paymentMode);
  if (paymentMode === "CASH") return true; // Backend treats CASH as COD flow.

  const paymentStatus = toUpperToken(order?.paymentStatus);
  if (paymentStatus === "PAID") return true;

  if (order?.isPaid === true) return true;
  if (normalizeLegacyOrderStatus(order?.status, order) === "Paid") return true;
  return false;
};

const isStatusProgressBlockedByPayment = (order) =>
  requiresPaymentBeforeStatusProgress(order) &&
  !isPaymentClearedForStatusProgress(order);

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

const normalizeId = (value) =>
  typeof value === "string" ? value : value?.toString?.() || "";

const normalizeAddonId = (value) =>
  typeof value === "string" ? value : value?.toString?.() || "";

const TAKEAWAY_SERVICE_TYPES = new Set(["TAKEAWAY", "PICKUP", "DELIVERY"]);
const isTakeawayServiceType = (serviceType) =>
  TAKEAWAY_SERVICE_TYPES.has(serviceType);
const isPresentValue = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "";
const hasMeaningfulDeliveryInfo = (order) => {
  if (!order?.deliveryInfo) return false;

  const hasDistance =
    isPresentValue(order.deliveryInfo.distance) &&
    !Number.isNaN(Number(order.deliveryInfo.distance));
  const hasEstimatedTime =
    isPresentValue(order.deliveryInfo.estimatedTime) &&
    !Number.isNaN(Number(order.deliveryInfo.estimatedTime));
  const hasCharge = Number(order.deliveryInfo.deliveryCharge || 0) > 0;

  return hasDistance || hasEstimatedTime || hasCharge;
};
const getOrderCustomerName = (order) =>
  order?.customerName || order?.customer?.name || "";
const getOrderCustomerMobile = (order) =>
  order?.customerMobile ||
  order?.customerPhone ||
  order?.customer?.phone ||
  "";
const toComparableId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const nestedId = value._id || value.id;
    return nestedId ? String(nestedId) : "";
  }
  return String(value);
};
const resolveOfficeNameFromTables = (order, officeTables = []) => {
  const fallbackTables = Array.isArray(officeTables) ? officeTables : [];
  if (!fallbackTables.length) return "";

  const officeNumber = String(order?.tableNumber || "").trim();
  if (!officeNumber || officeNumber.toUpperCase() === "TAKEAWAY") return "";

  const normalizedOfficeNumber = officeNumber.toUpperCase();
  const orderCafeId = toComparableId(
    order?.cartId || order?.cafeId || order?.table?.cafeId,
  );

  const matchedOffice = fallbackTables.find((table) => {
    if (String(table?.qrContextType || "").toUpperCase() !== "OFFICE") {
      return false;
    }

    const tableNumber = String(table?.number || table?.tableNumber || "")
      .trim()
      .toUpperCase();
    if (!tableNumber || tableNumber !== normalizedOfficeNumber) return false;

    if (!orderCafeId) return true;

    const tableCafeId = toComparableId(table?.cartId || table?.cafeId);
    return !tableCafeId || tableCafeId === orderCafeId;
  });

  return String(matchedOffice?.officeName || matchedOffice?.name || "").trim();
};
const getOfficeOrderName = (order, officeTables = []) => {
  const explicitOfficeName = String(
    order?.officeName || order?.table?.officeName || "",
  ).trim();
  if (explicitOfficeName) return explicitOfficeName;

  const officeNameFromTables = resolveOfficeNameFromTables(order, officeTables);
  if (officeNameFromTables) return officeNameFromTables;

  const customerName = String(order?.customerName || "").trim();
  if (customerName) return customerName;

  const officeNumber = String(order?.tableNumber || "").trim();
  if (officeNumber && officeNumber.toUpperCase() !== "TAKEAWAY") {
    return `Office ${officeNumber}`;
  }

  return "Office";
};
const isOfficeQrOrder = (order) => {
  const sourceType = String(order?.sourceQrType || "").toUpperCase();
  if (sourceType === "OFFICE") return true;

  const officeMode = String(order?.officePaymentMode || "").toUpperCase();
  if (officeMode === "ONLINE" || officeMode === "COD" || officeMode === "BOTH")
    return true;

  if (Number(order?.officeDeliveryCharge || 0) > 0) return true;

  return String(order?.table?.qrContextType || "").toUpperCase() === "OFFICE";
};
const getEffectiveDeliveryCharge = (order) => {
  const primaryCharge = Number(order?.deliveryInfo?.deliveryCharge || 0);
  if (primaryCharge > 0) return primaryCharge;
  const officeCharge = Number(order?.officeDeliveryCharge || 0);
  return officeCharge > 0 ? officeCharge : 0;
};
const resolveTakeawayOrderType = (order) => {
  if (!order) return null;
  if (isOfficeQrOrder(order)) return "DELIVERY";

  const explicitOrderType = String(order.orderType || "").toUpperCase();
  if (explicitOrderType === "PICKUP" || explicitOrderType === "DELIVERY") {
    return explicitOrderType;
  }

  const serviceType = String(order.serviceType || "").toUpperCase();
  if (serviceType === "PICKUP" || serviceType === "DELIVERY") {
    return serviceType;
  }

  // Legacy records can be persisted as TAKEAWAY without explicit orderType.
  if (serviceType === "TAKEAWAY") {
    // Keep plain TAKEAWAY label as "Takeaway" unless we have strong DELIVERY signal.
    // Do not infer DELIVERY only from customer address, because staff takeaway
    // orders can include address text and still be pickup/counter flow.
    if (
      hasMeaningfulDeliveryInfo(order) &&
      !isPresentValue(order?.pickupLocation?.address)
    ) {
      return "DELIVERY";
    }
    return null;
  }

  return null;
};

const normalizeOrderForDisplay = (order, previousOrder = null) => {
  if (!order || typeof order !== "object") return order;

  // Merge with previous value so partial socket payloads do not blank fields.
  const mergedOrder = previousOrder ? { ...previousOrder, ...order } : { ...order };
  const rawStatus =
    order?.rawStatus ??
    order?.status ??
    previousOrder?.rawStatus ??
    previousOrder?.status ??
    null;
  const statusContext = {
    ...mergedOrder,
    status: rawStatus,
  };

  return {
    ...mergedOrder,
    rawStatus,
    status: normalizeLegacyOrderStatus(
      rawStatus || mergedOrder.lifecycleStatus,
      statusContext,
    ),
  };
};

const normalizeOrdersPayload = (payload) => {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.orders)
        ? payload.orders
      : [];

  return source.map((order) => normalizeOrderForDisplay(order));
};

const getOrderCafeId = (order) => {
  let orderCafeId = order?.cafeId || order?.cartId;
  if (orderCafeId && typeof orderCafeId === "object") {
    orderCafeId = orderCafeId._id || orderCafeId;
  }

  if (!orderCafeId && order?.table?.cafeId) {
    orderCafeId = order.table.cafeId;
    if (typeof orderCafeId === "object") {
      orderCafeId = orderCafeId._id || orderCafeId;
    }
  }

  return orderCafeId;
};

const isOfficeQrTable = (table) =>
  String(table?.qrContextType || "").toUpperCase() === "OFFICE";

const resolveTableCartId = (table) => {
  const raw = table?.cartId || table?.cafeId;
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    const id = raw._id || raw.id;
    return id ? String(id) : null;
  }
  return String(raw);
};

const filterOrdersByCafeId = (orders, cafeId) => {
  const list = Array.isArray(orders) ? orders : [];
  if (!cafeId) return list;
  return list.filter((order) => {
    const orderCafeId = getOrderCafeId(order);
    return orderCafeId && orderCafeId.toString() === cafeId;
  });
};
const sanitizeAddonName = (value) => {
  const normalized = String(value || "")
    .replace(/^\(\s*\+\s*\)\s*/u, "")
    .trim();
  return normalized || "Add-on";
};

const toOrderAddonPayload = (addons = []) =>
  (Array.isArray(addons) ? addons : [])
    .map((addon) => {
      if (!addon) return null;
      const addonId = normalizeAddonId(addon.addonId || addon._id || addon.id);
      const name = sanitizeAddonName(addon.name);
      const priceValue = Number(addon.price);
      const quantityValue = Number(addon.quantity);
      const price = Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : 0;
      const quantity =
        Number.isFinite(quantityValue) && quantityValue > 0
          ? Math.floor(quantityValue)
          : 1;

      return {
        ...(addonId ? { addonId } : {}),
        name,
        price,
        quantity,
      };
    })
    .filter(Boolean);

const mergeOrderAddons = (existing = [], incoming = []) => {
  const map = new Map();

  [...toOrderAddonPayload(existing), ...toOrderAddonPayload(incoming)].forEach(
    (addon) => {
      const key =
        addon.addonId ||
        `${sanitizeAddonName(addon.name).toLowerCase()}-${addon.price}`;
      const previous = map.get(key);
      if (previous) {
        map.set(key, {
          ...previous,
          quantity: (previous.quantity || 0) + (addon.quantity || 0),
        });
      } else {
        map.set(key, addon);
      }
    },
  );

  return Array.from(map.values()).filter((addon) => addon.quantity > 0);
};

// Aggregate all items from all KOTs and selected addons, separating takeaway items
const aggregateKotItems = (order) => {
  const kotLines = order?.kotLines || [];
  const selectedAddons = order?.selectedAddons || [];
  const dineInItems = [];
  const takeawayItems = [];

  (kotLines || []).forEach((kot) => {
    (kot?.items || []).forEach((item) => {
      if (!item || item.returned) return; // Skip returned items
      const name = item.name || "Item";
      const quantity = Number(item.quantity) || 0;
      const unitPrice = paiseToRupees(item.price || 0);
      const amount = unitPrice * quantity;
      const isTakeaway = item.convertedToTakeaway === true;

      const itemData = {
        name,
        unitPrice,
        quantity,
        amount,
        isTakeaway,
      };

      if (isTakeaway) {
        takeawayItems.push(itemData);
      } else {
        dineInItems.push(itemData);
      }
    });
  });

  // Process Addons - always treated as dine-in unless strictly takeaway order
  selectedAddons.forEach((addon) => {
    if (!addon) return;
    const name = sanitizeAddonName(addon.name);
    const quantity = Number(addon.quantity) || 1;
    // Addons price is in Rupees, no need to convert from paise
    const unitPrice = Number(addon.price || 0);
    const amount = unitPrice * quantity;

    // Addons follow the main order service type roughly,
    // but in this view we typically group them with dine-in items
    // unless the whole order is takeaway (which this view handles by filtering).
    // For visual consistency, we'll put them in dineInItems for now as they are part of the main "plate"
    // or logically associated with the main items.
    dineInItems.push({
      name,
      unitPrice,
      quantity,
      amount,
      isTakeaway: false,
      isAddon: true,
    });
  });

  return { dineInItems, takeawayItems };
};

const buildOrderLineItems = (order, { includeReturned = true } = {}) => {
  const lines = [];
  const kotLines = Array.isArray(order?.kotLines) ? order.kotLines : [];

  kotLines.forEach((kot, kotIndex) => {
    const items = Array.isArray(kot?.items) ? kot.items : [];
    items.forEach((item, itemIndex) => {
      if (!item) return;
      const returned = Boolean(item.returned);
      if (returned && !includeReturned) return;

      const quantity = Number(item.quantity) || 0;
      const unitPrice = paiseToRupees(item.price || 0);
      lines.push({
        key: `item-${kotIndex}-${itemIndex}`,
        type: "item",
        kotIndex,
        itemIndex,
        name: item.name || "Item",
        quantity,
        unitPrice,
        total: unitPrice * quantity,
        returned,
        isTakeaway: item.convertedToTakeaway === true,
      });
    });
  });

  const selectedAddons = Array.isArray(order?.selectedAddons)
    ? order.selectedAddons
    : [];
  selectedAddons.forEach((addon, addonIndex) => {
    if (!addon) return;
    const quantity = Number(addon.quantity) || 1;
    const unitPrice = Number(addon.price) || 0;
    lines.push({
      key: `addon-${addonIndex}`,
      type: "addon",
      addonIndex,
      name: sanitizeAddonName(addon.name),
      quantity,
      unitPrice,
      total: unitPrice * quantity,
      returned: false,
      isTakeaway: false,
    });
  });

  return lines;
};

// Calculate totals from actual items, not from KOT totals (to avoid rounding errors)
// eslint-disable-next-line no-unused-vars
const computeKotTotals = (_kotLines = [], aggregatedItems = []) => {
  // Handle both old format (array) and new format (object with dineInItems/takeawayItems)
  let itemsArray = [];
  if (Array.isArray(aggregatedItems)) {
    itemsArray = aggregatedItems;
  } else if (aggregatedItems && typeof aggregatedItems === "object") {
    itemsArray = [
      ...(aggregatedItems.dineInItems || []),
      ...(aggregatedItems.takeawayItems || []),
    ];
  }

  // Calculate subtotal from non-returned items (amount is already in rupees)
  const subtotal = itemsArray.reduce((sum, item) => {
    const amount = Number(item.amount) || 0;
    return sum + amount;
  }, 0);

  // Round subtotal to 2 decimal places
  const subtotalRounded = Number(subtotal.toFixed(2));

  // GST removed - set to 0
  const gst = 0;

  // Total amount equals subtotal (no GST)
  const totalAmount = subtotalRounded;

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
  const { dineInItems, takeawayItems } = aggregateKotItems(order);
  const allItems = [...dineInItems, ...takeawayItems];
  const totals = computeKotTotals(kotLines, allItems);

  // Get cart address (prefer address, fallback to location)
  const cartAddress = cartData?.address || "—";
  // Get franchise FSSAI number (fallback to GST if available)
  const franchiseFSSAI =
    franchiseData?.fssaiNumber || franchiseData?.gstNumber || "—";

  // Payment mode display (fallback to CASH if not available)
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
  const safeTableNumber = escapeHtml(order.tableNumber || "--");
  const safePaymentMethod = escapeHtml(String(paymentMethod).toUpperCase());

  // Build rows for dine-in items
  const dineInRows =
    dineInItems.length > 0
      ? dineInItems
          .map((item) => {
            const quantity = item.quantity || 0;
            const price = item.unitPrice || 0;
            const amount = item.amount || 0;
            return `
            <tr>
              <td class="py-2 border-b">${escapeHtml(item.name || "")}</td>
              <td class="py-2 border-b">${quantity}</td>
              <td class="py-2 border-b">₹${formatMoney(price)}</td>
              <td class="py-2 border-b text-right">₹${formatMoney(amount)}</td>
            </tr>
          `;
          })
          .join("")
      : "";

  // Build rows for takeaway items
  const takeawayRows =
    takeawayItems.length > 0
      ? takeawayItems
          .map((item) => {
            const quantity = item.quantity || 0;
            const price = item.unitPrice || 0;
            const amount = item.amount || 0;
            return `
            <tr>
              <td class="py-2 border-b">${
                escapeHtml(item.name || "")
              } <span style="color: #059669; font-weight: bold;">📦 TAKEAWAY</span></td>
              <td class="py-2 border-b">${quantity}</td>
              <td class="py-2 border-b">₹${formatMoney(price)}</td>
              <td class="py-2 border-b text-right">₹${formatMoney(amount)}</td>
            </tr>
          `;
          })
          .join("")
      : "";

  const rows = dineInRows + takeawayRows;

  const tableSection = rows
    ? `
      ${
        dineInRows
          ? `<tr><td colspan="4" style="padding-top: 8px; font-weight: bold; font-size: 10px; color: #1f2937;">DINE-IN ITEMS</td></tr>${dineInRows}`
          : ""
      }
      ${
        takeawayRows
          ? `<tr><td colspan="4" style="padding-top: 8px; font-weight: bold; font-size: 10px; color: #059669;">TAKEAWAY ITEMS</td></tr>${takeawayRows}`
          : ""
      }
    `
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
        </div>
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 10px; margin-bottom: 4px;">Billed To</div>
        <div style="font-size: 9px;">
          Table ${safeTableNumber}
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
          ${tableSection}
        </tbody>
      </table>
      <div class="invoice-totals">
        <div class="invoice-totals-inner">
          <div class="invoice-line">
            <span>Subtotal</span>
            <span>₹${formatMoney(totals.subtotal)}</span>
          </div>
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
      const franchiseRes = await api.get(`/users/${order.franchiseId}`, {
        skipErrorLogging: true,
      });
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
    if (import.meta.env.DEV && err.response?.status !== 404) {
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

// eslint-disable-next-line no-unused-vars
const downloadOrderInvoice = async (order) => {
  if (!order) return;

  // Fetch franchise and cart data
  let franchiseData = null;
  let cartData = null;

  try {
    // Fetch franchise data if franchiseId exists
    if (order.franchiseId) {
      const franchiseRes = await api.get(`/users/${order.franchiseId}`, {
        skipErrorLogging: true,
      });
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
    if (import.meta.env.DEV && err.response?.status !== 404) {
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

const Orders = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const filterCafeId = searchParams.get("cafeId");
  const [orders, setOrders] = useState([]);
  const [cafeInfo, setCafeInfo] = useState(null);
  const [carts, setCarts] = useState([]); // For franchise admin: list of carts
  const [expandedCarts, setExpandedCarts] = useState({}); // Track expanded cart sections
  const [unknownCarts, setUnknownCarts] = useState({}); // Cache for fetched unknown cart info
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchTable, setSearchTable] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [filterDate, setFilterDate] = useState(""); // Date filter (YYYY-MM-DD format)
  const [expanded, setExpanded] = useState({}); // track expanded rows
  const [filterStatus, setFilterStatus] = useState("all");
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [addonList, setAddonList] = useState([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [addonsError, setAddonsError] = useState("");
  const [currentMenuCartId, setCurrentMenuCartId] = useState(null); // Track cartId for menu loading (for retry)
  const [tables, setTables] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [draftSelections, setDraftSelections] = useState({});
  const [draftAddonSelections, setDraftAddonSelections] = useState({});
  const [draftSearch, setDraftSearch] = useState("");
  const [draftCategory, setDraftCategory] = useState("all");
  const [selectedTableId, setSelectedTableId] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [draftServiceType, setDraftServiceType] = useState("DINE_IN");
  const [draftTakeawayMode, setDraftTakeawayMode] = useState("COUNTER");
  const [draftPaymentType, setDraftPaymentType] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");

  // Reason Modal State
  const [reasonModal, setReasonModal] = useState({
    open: false,
    orderId: null,
    status: null,
    title: "",
  });
  const [reasonInput, setReasonInput] = useState("");

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
    changeStatus(reasonModal.orderId, reasonModal.status, reasonInput);
  };

  const upsertOrder = useCallback((incoming, { prepend = false } = {}) => {
    if (!incoming) return;
    const incomingCafeId = getOrderCafeId(incoming)?.toString();
    if (
      filterCafeId &&
      incomingCafeId &&
      incomingCafeId !== filterCafeId.toString()
    ) {
      return;
    }
    const incomingId = normalizeId(incoming._id);
    if (!incomingId) return;

    setOrders((prev) => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const index = list.findIndex(
        (order) => normalizeId(order._id) === incomingId,
      );

      if (index >= 0) {
        list[index] = normalizeOrderForDisplay(incoming, list[index]);
        return list;
      }

      const normalizedIncoming = normalizeOrderForDisplay(incoming);
      return prepend
        ? [normalizedIncoming, ...list]
        : [...list, normalizedIncoming];
    });
  }, [filterCafeId]);

  const getStatusClass = (status, order = null) => {
    const normalizedStatus = normalizeLegacyOrderStatus(status, order);
    switch (normalizedStatus) {
      case "all":
        return "bg-slate-100 text-slate-800 border-slate-200";
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
      case "active":
        return "bg-teal-100 text-teal-800 border-teal-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status, order = null) => {
    const normalizedStatus = normalizeLegacyOrderStatus(status, order);
    switch (normalizedStatus) {
      case "all":
        return "\uD83D\uDCCB";
      case "Paid":
        return "\u2705";
      case "Confirmed":
        return "\uD83D\uDC68\u200D\uD83C\uDF73";
      case "Preparing":
        return "\uD83D\uDD25";
      case "Ready":
        return "\uD83C\uDF7D\uFE0F";
      case "Served":
        return "\uD83E\uDD1D";
      case "Finalized":
        return "\u2728";
      case "Pending":
        return "\u23F3";
      case "Cancelled":
        return "\u274C";
      case "Returned":
        return "\u21A9\uFE0F";
      case "active":
        return "\uD83D\uDCCB";
      default:
        return "\u26AA";
    }
  };

  const getSummaryTileTheme = (status) => {
    const normalizedStatus = normalizeLegacyOrderStatus(status);
    switch (normalizedStatus) {
      case "all":
        return {
          card: "bg-slate-50/70 border-slate-200/80",
          icon: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        };
      case "Paid":
        return {
          card: "bg-emerald-50/70 border-emerald-200/80",
          icon: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
        };
      case "Confirmed":
        return {
          card: "bg-amber-50/70 border-amber-200/80",
          icon: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
        };
      case "Preparing":
        return {
          card: "bg-blue-50/70 border-blue-200/80",
          icon: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
        };
      case "Ready":
        return {
          card: "bg-purple-50/70 border-purple-200/80",
          icon: "bg-purple-100 text-purple-700 ring-1 ring-purple-200",
        };
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
      case "active":
        return {
          card: "bg-teal-50/70 border-teal-200/80",
          icon: "bg-teal-100 text-teal-700 ring-1 ring-teal-200",
        };
      default:
        return {
          card: "bg-slate-50/70 border-slate-200/80",
          icon: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
        };
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const changeStatus = async (orderId, newStatus, reason = null) => {
    const requestType = `order-status-${orderId}`;
    const targetOrder = orders.find(
      (order) => normalizeId(order?._id) === normalizeId(orderId),
    );
    const requestedUiStatus = normalizeLegacyOrderStatus(newStatus);
    const isCancelOrReturnAction =
      requestedUiStatus === "Cancelled" || requestedUiStatus === "Returned";
    const isProgressingStatus = ["Preparing", "Ready", "Served", "Paid"].includes(
      requestedUiStatus,
    );
    if (
      targetOrder &&
      isProgressingStatus &&
      isStatusProgressBlockedByPayment(targetOrder)
    ) {
      alert("Payment must be completed or marked COD before updating order status.");
      return;
    }

    try {
      const endpoint = isCancelOrReturnAction
        ? `/orders/${orderId}/customer-status`
        : `/orders/${orderId}/status`;
      const payload = {
        status: requestedUiStatus,
        reason,
      };
      if (isCancelOrReturnAction && targetOrder?.sessionToken) {
        payload.sessionToken = targetOrder.sessionToken;
      }
      if (isCancelOrReturnAction && targetOrder?.anonymousSessionId) {
        payload.anonymousSessionId = targetOrder.anonymousSessionId;
      }

      const response = await withCancellation(requestType, async (signal) => {
        return await api.patch(endpoint, payload, { signal });
      });
      upsertOrder(response.data);
      if (reasonModal.open) closeReasonModal();
    } catch (e) {
      // Ignore AbortError (request was cancelled)
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

  const tryAccept = (order) => {
    if (canAccept(order.status)) {
      changeStatus(order._id, nextStatusOnAccept);
    }
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
      if (e?.response?.status === 409) {
        // Another staff member accepted first; refresh list to sync assignee/status.
        await refreshOrders();
      }
      const errorMessage =
        e.response?.data?.message || e.message || "Failed to accept order";
      alert(errorMessage);
    }
  };
  */

  const isOrderAccepted = (order) =>
    Boolean(
      order?.acceptedBy?.employeeId ||
      order?.acceptedBy?._id ||
      order?.acceptedBy?.employeeName,
    );

  // Render order row (reusable for both grouped and flat views)
  const renderOrderRow = (order) => {
    const createdAtDate = getOrderCreatedDate(order);
    const updatedAtDate = getOrderUpdatedDate(order);
    const orderDate = createdAtDate || updatedAtDate;
    const normalizedServiceType = String(order?.serviceType || "").toUpperCase();
    const resolvedTakeawayOrderType = resolveTakeawayOrderType(order);
    const customerName = getOrderCustomerName(order);
    const customerMobile = getOrderCustomerMobile(order);
    const isOfficeOrder = isOfficeQrOrder(order);
    const officeOrderName = isOfficeOrder
      ? getOfficeOrderName(order, tables)
      : "";
    const isTakeawayOrder =
      isTakeawayServiceType(order.serviceType) ||
      Boolean(resolvedTakeawayOrderType);
    const serviceTypeLabel = isOfficeOrder
      ? "Office Delivery"
      : normalizedServiceType === "DINE_IN"
        ? "Dine-In"
        : normalizedServiceType === "TAKEAWAY"
          ? resolvedTakeawayOrderType === "DELIVERY"
            ? "Delivery"
            : resolvedTakeawayOrderType === "PICKUP"
              ? "Pickup"
              : "Takeaway"
          : normalizedServiceType === "PICKUP"
            ? "Pickup"
            : normalizedServiceType === "DELIVERY"
              ? "Delivery"
              : isTakeawayOrder
                ? resolvedTakeawayOrderType === "DELIVERY"
                  ? "Delivery"
                  : resolvedTakeawayOrderType === "PICKUP"
                    ? "Pickup"
                    : "Takeaway"
                : "Dine-In";
    const takeawayOrderTypeLabel =
      resolvedTakeawayOrderType === "DELIVERY"
        ? "Delivery"
        : resolvedTakeawayOrderType === "PICKUP"
          ? "Pickup"
          : "Takeaway";
    const shouldShowOrderTypeMeta =
      Boolean(resolvedTakeawayOrderType) &&
      resolvedTakeawayOrderType !== normalizedServiceType;
    const pickupAddress =
      order.pickupLocation?.address || order.pickupLocation?.fullAddress || null;
    const deliveryAddress =
      order.customerLocation?.address || order.customerLocation?.fullAddress || null;
    const fallbackTakeawayAddress =
      deliveryAddress || order?.deliveryAddress || order?.customerAddress || null;
    const deliveryCharge = getEffectiveDeliveryCharge(order);
    const hasTakeawayToken =
      resolvedTakeawayOrderType !== "DELIVERY" &&
      order.takeawayToken !== undefined &&
      order.takeawayToken !== null;
    const hasTakeawayCustomerInfo = Boolean(customerName || customerMobile);
    const hasTakeawayMeta = isTakeawayOrder &&
      (hasTakeawayCustomerInfo ||
        hasTakeawayToken ||
        resolvedTakeawayOrderType ||
        (resolvedTakeawayOrderType === "PICKUP" && pickupAddress) ||
        (resolvedTakeawayOrderType === "DELIVERY" && fallbackTakeawayAddress) ||
        (!resolvedTakeawayOrderType && fallbackTakeawayAddress));
    const isExpanded = Boolean(expanded[order._id]);
    const { dateLabel: formattedDate, timeLabel: formattedTime } =
      formatOrderDateTime(orderDate);
    const displayStatus = normalizeLegacyOrderStatus(order.status, order);
    const paymentType = resolveOrderPaymentType(order);
    const paymentTypeBadgeClass =
      paymentType === "Online"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

    return (
      <React.Fragment key={order._id}>
        <tr
          className={`hover:bg-gray-50 ${
            order.status === "Pending" ? "bg-orange-50" : ""
          }`}
        >
          <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm">
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
            </button>
            {hasTakeawayMeta && !isExpanded && (
              <div className="mt-1 space-y-0.5">
                {isOfficeOrder ? (
                  <>
                    <div className="text-[10px] sm:text-xs font-semibold text-emerald-700 truncate">
                      Office: {officeOrderName}
                    </div>
                    <div className="text-[10px] sm:text-xs font-semibold text-emerald-700">
                      Type: {takeawayOrderTypeLabel}
                    </div>
                  </>
                ) : (
                  resolvedTakeawayOrderType && (
                    <div className="text-[10px] sm:text-xs font-semibold text-emerald-700">
                      {takeawayOrderTypeLabel}
                    </div>
                  )
                )}
                {customerName && (
                  <div className="text-[10px] sm:text-xs text-gray-700 truncate">
                    Customer: {customerName}
                  </div>
                )}
                {customerMobile && (
                  <div className="text-[10px] sm:text-xs text-gray-600 truncate">
                    Mobile: {customerMobile}
                  </div>
                )}
                {resolvedTakeawayOrderType === "PICKUP" && pickupAddress && (
                  <div className="text-[10px] sm:text-xs text-gray-600 truncate">
                    Pickup: {pickupAddress}
                  </div>
                )}
                {resolvedTakeawayOrderType === "DELIVERY" && (
                  <div className="text-[10px] sm:text-xs text-gray-600 truncate">
                    Address: {fallbackTakeawayAddress || "Address not set"}
                  </div>
                )}
                {!resolvedTakeawayOrderType && fallbackTakeawayAddress && (
                  <div className="text-[10px] sm:text-xs text-gray-600 truncate">
                    Address: {fallbackTakeawayAddress}
                  </div>
                )}
                {hasTakeawayToken && (
                  <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Token: {order.takeawayToken}
                  </div>
                )}
              </div>
            )}
            {isExpanded && (
              <div className="mt-2 text-[9px] sm:text-[10px] md:text-xs text-gray-600 space-y-0.5 sm:space-y-1">
                <div className="truncate">
                  Created: {formatOrderDateTimeLong(createdAtDate || orderDate)}
                </div>
                <div className="truncate">
                  Updated: {formatOrderDateTimeLong(updatedAtDate)}
                </div>
                <div className="truncate">
                  Invoice:{" "}
                  <span className="font-mono">{buildInvoiceId(order)}</span>
                </div>
                <div className="truncate">
                  Service Type:{" "}
                  <span className="font-semibold text-gray-700">
                    {serviceTypeLabel}
                  </span>
                </div>
                {isOfficeOrder ? (
                  <>
                    <div className="truncate">
                      Office:{" "}
                      <span className="font-semibold text-emerald-700">
                        {officeOrderName}
                      </span>
                    </div>
                    <div className="truncate">
                      Order Type:{" "}
                      <span className="font-semibold text-emerald-700">
                        {takeawayOrderTypeLabel}
                      </span>
                    </div>
                  </>
                ) : (
                  shouldShowOrderTypeMeta && (
                    <div className="truncate">
                      Order Type:{" "}
                      <span className="font-semibold text-emerald-700">
                        {takeawayOrderTypeLabel}
                      </span>
                    </div>
                  )
                )}
                {resolvedTakeawayOrderType === "PICKUP" && (
                  <div className="truncate">
                    Pickup Address: {pickupAddress || "Address not set"}
                  </div>
                )}
                {resolvedTakeawayOrderType === "DELIVERY" && (
                  <>
                    <div className="truncate">
                      Delivery Address: {fallbackTakeawayAddress || "Address not set"}
                    </div>
                    {order.deliveryInfo?.distance != null && (
                      <div className="truncate">
                        Distance: {Number(order.deliveryInfo.distance).toFixed(2)} km
                      </div>
                    )}
                    {deliveryCharge > 0 && (
                      <div className="truncate text-green-700">
                        Delivery Charge: {"\u20B9"}
                        {Number(deliveryCharge).toFixed(2)}
                      </div>
                    )}
                    {isPresentValue(order.deliveryInfo?.estimatedTime) &&
                      !Number.isNaN(Number(order.deliveryInfo.estimatedTime)) &&
                      Number(order.deliveryInfo.estimatedTime) > 0 && (
                      <div className="truncate">
                        Est. Time: {order.deliveryInfo.estimatedTime} min
                      </div>
                    )}
                  </>
                )}
                {!resolvedTakeawayOrderType && fallbackTakeawayAddress && (
                  <div className="truncate">
                    Address: {fallbackTakeawayAddress}
                  </div>
                )}
                {hasTakeawayToken && (
                  <div className="truncate">
                    Token:{" "}
                    <span className="font-semibold text-blue-700">
                      {order.takeawayToken}
                    </span>
                  </div>
                )}
                {hasTakeawayCustomerInfo && (
                  <div className="space-y-0.5">
                    {customerName && (
                      <div className="truncate">Customer: {customerName}</div>
                    )}
                    {customerMobile && (
                      <div className="truncate">Mobile: {customerMobile}</div>
                    )}
                  </div>
                )}
                {order.cancellationReason &&
                  (displayStatus === "Cancelled" ||
                    displayStatus === "Returned") && (
                    <div className="text-red-600 font-medium bg-red-50 p-1.5 rounded mt-1 border border-red-100">
                      Reason: {order.cancellationReason}
                    </div>
                  )}
              </div>
            )}
          </td>
          <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 align-top">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold border whitespace-nowrap ${paymentTypeBadgeClass}`}
            >
              {paymentType}
            </span>
          </td>
          <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm text-gray-600 hidden md:table-cell align-top">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-gray-900 text-xs sm:text-sm whitespace-nowrap">
                {formattedDate}
              </span>
              <span className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">
                {formattedTime}
              </span>
            </div>
          </td>
          <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 align-top">
            <div className="flex items-center gap-1 sm:gap-2">
              {!isTakeawayOrder && (
                <img
                  src={tableIcon}
                  alt="Table"
                  title="Table"
                  className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain flex-shrink-0"
                />
              )}
              <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-gray-700 truncate">
                {isOfficeOrder
                  ? officeOrderName
                  : isTakeawayOrder
                  ? resolvedTakeawayOrderType
                    ? takeawayOrderTypeLabel
                    : order.tableNumber || "Takeaway"
                  : order.tableNumber || "N/A"}
              </span>
            </div>
            {order.specialInstructions && (
              <div className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                  <span className="mr-1">📝</span> {order.specialInstructions}
                </span>
              </div>
            )}
          </td>
          <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 align-top">
            <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
              {["Paid", "Cancelled", "Returned"].includes(displayStatus) && (
                <span
                  className={`inline-flex w-fit items-center gap-1 px-1.5 sm:px-2 md:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border whitespace-nowrap ${getStatusClass(
                    displayStatus,
                    order,
                  )}`}
                >
                  <span>{getStatusIcon(displayStatus, order)}</span>
                  <span>{displayStatus}</span>
                </span>
              )}
              {/* Sequential flow - show only next step + cancel option */}
              <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                {(() => {
                  const isTakeaway =
                    isTakeawayServiceType(order.serviceType) ||
                    Boolean(resolveTakeawayOrderType(order));
                  const isOrderPaidForFlow =
                    normalizeStatusToken(order?.paymentStatus) === "paid" ||
                    order?.isPaid === true ||
                    displayStatus === "Paid";
                  const isPaymentBlockedForFlow =
                    isStatusProgressBlockedByPayment(order) &&
                    !isOrderPaidForFlow;
                  const transitionStatus =
                    isOrderPaidForFlow
                      ? "Paid"
                      : order.rawStatus || order.lifecycleStatus || order.status;
                  // const alreadyAccepted = isOrderAccepted(order);
                  const nextStatus = isTakeaway
                    ? getNextStatusTakeaway(transitionStatus)
                    : getNextStatus(transitionStatus, order.serviceType);
                  const buttons = [];
                  /*
                  const canShowTakeawayAccept =
                    !alreadyAccepted && isTakeaway && canAcceptTakeaway(order.status);
                  const canShowDirectAccept =
                    !alreadyAccepted && !isTakeaway && canAccept(order.status);
                  */
                  const canShowTakeawayAccept = false;
                  const canShowDirectAccept = false;

                  /*
                  if (canShowTakeawayAccept) {
                    buttons.push(
                      <button
                        key="accept-takeaway"
                        type="button"
                        onClick={() => acceptOrderTakeaway(order._id)}
                        title="Accept Order"
                        className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-green-200 text-green-700 hover:bg-green-50 bg-green-50 whitespace-nowrap"
                      >
                        ✅ <span className="hidden 2xl:inline">Accept</span>
                      </button>,
                    );
                  } else if (canShowDirectAccept) {
                    buttons.push(
                      <button
                        key="accept"
                        type="button"
                        onClick={() => tryAccept(order)}
                        title="Accept Order"
                        className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-green-200 text-green-700 hover:bg-green-50 bg-green-50 whitespace-nowrap"
                      >
                        ✅ <span className="hidden 2xl:inline">Accept</span>
                      </button>,
                    );
                  }
                  */

                  // Show next sequential step button (but skip if accept action is available)
                  if (
                    nextStatus &&
                    !isOrderPaidForFlow &&
                    !isPaymentBlockedForFlow &&
                    !canShowDirectAccept &&
                    !canShowTakeawayAccept
                  ) {
                    buttons.push(
                      <button
                        key="next"
                        type="button"
                        onClick={() => changeStatus(order._id, nextStatus)}
                        title={`Move to ${nextStatus}`}
                        className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50 truncate max-w-[80px] sm:max-w-none"
                      >
                        {nextStatus}
                      </button>,
                    );
                  }

                  if (canReturn(displayStatus)) {
                    buttons.push(
                      <button
                        key="return"
                        type="button"
                        onClick={() => openReasonModal(order._id, "Returned")}
                        title="Return Order"
                        className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50 whitespace-nowrap"
                      >
                        ↩️ <span className="hidden 2xl:inline">Return</span>
                      </button>,
                    );
                  } else if (canCancel(displayStatus)) {
                    buttons.push(
                      <button
                        key="cancel"
                        type="button"
                        onClick={() => openReasonModal(order._id, "Cancelled")}
                        title="Cancel Order"
                        className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
                      >
                        ❌ <span className="hidden 2xl:inline">Cancel</span>
                      </button>,
                    );
                  }

                  return buttons;
                })()}
              </div>
            </div>
          </td>
          <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm align-top">
            <div className="flex flex-wrap gap-1 sm:gap-1.5 md:gap-2">
              {/* Modify Order button - only show for unpaid orders and NOT for franchise_admin */}
              {user?.role !== "franchise_admin" &&
                displayStatus !== "Paid" &&
                displayStatus !== "Cancelled" &&
                displayStatus !== "Returned" && (
                  <button
                    onClick={() => handleEdit(order)}
                    className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded-md hover:bg-blue-50 font-medium whitespace-nowrap"
                    title="Add more items to this order"
                  >
                    ➕ <span className="hidden 2xl:inline">Modify</span>
                  </button>
                )}
              {/* Edit Order button - only show for cart admin (NOT for franchise_admin) */}
              {user?.role !== "franchise_admin" && (
                <button
                  onClick={() => handleEdit(order)}
                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded-md hover:bg-indigo-50 whitespace-nowrap"
                  title="Edit order"
                >
                  ✏️ <span className="hidden 2xl:inline">Edit</span>
                </button>
              )}
              {user?.role !== "admin" && user?.role !== "franchise_admin" && (
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, order._id)}
                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm text-red-600 hover:text-red-900 border border-red-200 rounded-md hover:bg-red-50 whitespace-nowrap"
                  title="Delete order"
                >
                  🗑️ <span className="hidden 2xl:inline">Delete</span>
                </button>
              )}
              <button
                onClick={() => printOrderInvoice(order)}
                className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm rounded-md border text-gray-700 border-gray-200 hover:bg-gray-100 whitespace-nowrap"
                title="Print invoice"
              >
                🖨️ <span className="hidden 2xl:inline">Print</span>
              </button>
            </div>
          </td>
        </tr>

        {expanded[order._id] && (
          <tr className="bg-gray-50">
            <td colSpan="5" className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
              <div className="space-y-3 sm:space-y-4">
                {(() => {
                  const lineItems = buildOrderLineItems(order, {
                    includeReturned: true,
                  });

                  if (!lineItems.length) {
                    return (
                      <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm text-sm text-gray-500">
                        No items in this order yet.
                      </div>
                    );
                  }

                  const orderTotal = lineItems.reduce(
                    (sum, line) => sum + (line.returned ? 0 : line.total || 0),
                    0,
                  );

                  return (
                    <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-sm sm:text-base md:text-lg font-semibold text-gray-800">
                          Order Items
                        </div>
                        <div className="text-sm sm:text-base md:text-lg font-bold text-green-600">
                          {"\u20B9"}
                          {formatMoney(orderTotal)}
                        </div>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        {lineItems.map((line) => (
                          <div
                            key={line.key}
                            className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 py-1 border-b ${
                              line.returned ? "opacity-60 bg-gray-100" : ""
                            }`}
                          >
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                              <span
                                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap flex-shrink-0 ${
                                  line.type === "addon"
                                    ? "bg-blue-100 text-blue-700"
                                    : line.isTakeaway
                                      ? "bg-green-100 text-green-800"
                                      : "bg-orange-100 text-orange-800"
                                }`}
                              >
                                {line.quantity}x
                              </span>
                              <span className="text-xs sm:text-sm text-gray-800 truncate min-w-0 flex-1">
                                <span
                                  className={line.returned ? "line-through" : ""}
                                >
                                  {line.name}
                                </span>
                                {line.type === "addon" && (
                                  <span className="ml-1 sm:ml-2 text-blue-600 font-semibold text-[10px] sm:text-xs whitespace-nowrap">
                                    ADD-ON
                                  </span>
                                )}
                                {line.isTakeaway && line.type !== "addon" && (
                                  <span className="ml-1 sm:ml-2 text-green-600 font-semibold text-[10px] sm:text-xs whitespace-nowrap">
                                    TAKEAWAY
                                  </span>
                                )}
                                {line.returned && (
                                  <span className="ml-1 sm:ml-2 text-red-600 font-semibold text-[10px] sm:text-xs whitespace-nowrap">
                                    (Cancelled)
                                  </span>
                                )}
                              </span>
                            </div>
                            <span
                              className={`text-xs sm:text-sm whitespace-nowrap flex-shrink-0 sm:ml-2 ${
                                line.returned ? "text-gray-500 line-through" : "text-gray-600"
                              }`}
                            >
                              {"\u20B9"}
                              {formatMoney(line.total)}
                            </span>
                          </div>
                        ))}
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
  };

  const renderOrderCard = (order) => {
    const createdAtDate = getOrderCreatedDate(order);
    const updatedAtDate = getOrderUpdatedDate(order);
    const orderDate = createdAtDate || updatedAtDate;
    const normalizedServiceType = String(order?.serviceType || "").toUpperCase();
    const resolvedTakeawayOrderType = resolveTakeawayOrderType(order);
    const customerName = getOrderCustomerName(order);
    const customerMobile = getOrderCustomerMobile(order);
    const isOfficeOrder = isOfficeQrOrder(order);
    const officeOrderName = isOfficeOrder
      ? getOfficeOrderName(order, tables)
      : "";
    const isTakeawayOrder =
      isTakeawayServiceType(order.serviceType) ||
      Boolean(resolvedTakeawayOrderType);
    const serviceTypeLabel = isOfficeOrder
      ? "Office Delivery"
      : normalizedServiceType === "DINE_IN"
        ? "Dine-In"
        : normalizedServiceType === "TAKEAWAY"
          ? resolvedTakeawayOrderType === "DELIVERY"
            ? "Delivery"
            : resolvedTakeawayOrderType === "PICKUP"
              ? "Pickup"
              : "Takeaway"
          : normalizedServiceType === "PICKUP"
            ? "Pickup"
            : normalizedServiceType === "DELIVERY"
              ? "Delivery"
              : isTakeawayOrder
                ? resolvedTakeawayOrderType === "DELIVERY"
                  ? "Delivery"
                  : resolvedTakeawayOrderType === "PICKUP"
                    ? "Pickup"
                    : "Takeaway"
                : "Dine-In";
    const takeawayOrderTypeLabel =
      resolvedTakeawayOrderType === "DELIVERY"
        ? "Delivery"
        : resolvedTakeawayOrderType === "PICKUP"
          ? "Pickup"
          : "Takeaway";
    const shouldShowOrderTypeMeta =
      Boolean(resolvedTakeawayOrderType) &&
      resolvedTakeawayOrderType !== normalizedServiceType;
    const pickupAddress =
      order.pickupLocation?.address || order.pickupLocation?.fullAddress || null;
    const deliveryAddress =
      order.customerLocation?.address || order.customerLocation?.fullAddress || null;
    const fallbackTakeawayAddress =
      deliveryAddress || order?.deliveryAddress || order?.customerAddress || null;
    const deliveryCharge = getEffectiveDeliveryCharge(order);
    const hasTakeawayToken =
      resolvedTakeawayOrderType !== "DELIVERY" &&
      order.takeawayToken !== undefined &&
      order.takeawayToken !== null;
    const hasTakeawayCustomerInfo = Boolean(customerName || customerMobile);
    const hasTakeawayMeta =
      isTakeawayOrder &&
      (hasTakeawayCustomerInfo ||
        hasTakeawayToken ||
        resolvedTakeawayOrderType ||
        (resolvedTakeawayOrderType === "PICKUP" && pickupAddress) ||
        (resolvedTakeawayOrderType === "DELIVERY" && fallbackTakeawayAddress) ||
        (!resolvedTakeawayOrderType && fallbackTakeawayAddress));
    const isExpanded = Boolean(expanded[order._id]);
    const { dateLabel: formattedDate, timeLabel: formattedTime } =
      formatOrderDateTime(orderDate);
    const displayStatus = normalizeLegacyOrderStatus(order.status, order);

    const statusActionButtons = (() => {
      const isTakeaway =
        isTakeawayServiceType(order.serviceType) ||
        Boolean(resolveTakeawayOrderType(order));
      const isOrderPaidForFlow =
        normalizeStatusToken(order?.paymentStatus) === "paid" ||
        order?.isPaid === true ||
        displayStatus === "Paid";
      const isPaymentBlockedForFlow =
        isStatusProgressBlockedByPayment(order) &&
        !isOrderPaidForFlow;
      const transitionStatus =
        isOrderPaidForFlow
          ? "Paid"
          : order.rawStatus || order.lifecycleStatus || order.status;
      // const alreadyAccepted = isOrderAccepted(order);
      const nextStatus = isTakeaway
        ? getNextStatusTakeaway(transitionStatus)
        : getNextStatus(transitionStatus, order.serviceType);
      const buttons = [];
      /*
      const canShowTakeawayAccept =
        !alreadyAccepted && isTakeaway && canAcceptTakeaway(order.status);
      const canShowDirectAccept =
        !alreadyAccepted && !isTakeaway && canAccept(order.status);
      */
      const canShowTakeawayAccept = false;
      const canShowDirectAccept = false;

      /*
      if (canShowTakeawayAccept) {
        buttons.push(
          <button
            key="accept-takeaway"
            type="button"
            onClick={() => acceptOrderTakeaway(order._id)}
            title="Accept Order"
            className="px-2 py-1 text-xs font-semibold rounded-md border border-green-200 text-green-700 hover:bg-green-50 bg-green-50 whitespace-nowrap"
          >
            Accept
          </button>,
        );
      } else if (canShowDirectAccept) {
        buttons.push(
          <button
            key="accept"
            type="button"
            onClick={() => tryAccept(order)}
            title="Accept Order"
            className="px-2 py-1 text-xs font-semibold rounded-md border border-green-200 text-green-700 hover:bg-green-50 bg-green-50 whitespace-nowrap"
          >
            Accept
          </button>,
        );
      }
      */

      if (
        nextStatus &&
        !isOrderPaidForFlow &&
        !isPaymentBlockedForFlow &&
        !canShowDirectAccept &&
        !canShowTakeawayAccept
      ) {
        buttons.push(
          <button
            key="next"
            type="button"
            onClick={() => changeStatus(order._id, nextStatus)}
            title={`Move to ${nextStatus}`}
            className="px-2 py-1 text-xs font-semibold rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50 whitespace-nowrap"
          >
            {nextStatus}
          </button>,
        );
      }

      if (canReturn(displayStatus)) {
        buttons.push(
          <button
            key="return"
            type="button"
            onClick={() => openReasonModal(order._id, "Returned")}
            title="Return Order"
            className="px-2 py-1 text-xs font-semibold rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50 whitespace-nowrap"
          >
            Return
          </button>,
        );
      } else if (canCancel(displayStatus)) {
        buttons.push(
          <button
            key="cancel"
            type="button"
            onClick={() => openReasonModal(order._id, "Cancelled")}
            title="Cancel Order"
            className="px-2 py-1 text-xs font-semibold rounded-md border border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
          >
            Cancel
          </button>,
        );
      }

      return buttons;
    })();

    return (
      <article
        key={order._id}
        className={`rounded-xl border shadow-sm p-3 space-y-3 ${
          order.status === "Pending"
            ? "bg-orange-50 border-orange-200"
            : "bg-white border-slate-200"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div
              className="font-mono text-[10px] text-gray-400 mb-1 truncate select-all"
              title="Order ID"
            >
              {order._id}
            </div>
            <button
              onClick={() => toggleExpand(order._id)}
              className="flex items-center gap-1.5 text-left min-w-0"
            >
              <span className="font-mono text-[11px] text-gray-600 truncate">
                {buildInvoiceId(order)}
              </span>
              <span className="text-[11px] text-gray-400">|</span>
              <span className="text-xs font-medium text-gray-900">
                {formattedTime}
              </span>
            </button>
            <div className="text-[11px] text-gray-500 mt-1">{formattedDate}</div>
          </div>
          <span
            className={`px-2 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full border whitespace-nowrap ${getStatusClass(
              displayStatus,
              order,
            )}`}
          >
            <span>{getStatusIcon(displayStatus, order)}</span>
            <span>{displayStatus}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Service
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              {serviceTypeLabel}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              Table / Takeaway
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-0.5 truncate">
              {isOfficeOrder
                ? officeOrderName
                : isTakeawayOrder
                ? resolvedTakeawayOrderType
                  ? takeawayOrderTypeLabel
                  : order.tableNumber || "Takeaway"
                : order.tableNumber || "N/A"}
            </div>
          </div>
        </div>

        {order.specialInstructions && (
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
              <span className="mr-1">Note:</span> {order.specialInstructions}
            </span>
          </div>
        )}

        {hasTakeawayMeta && (
          <div className="space-y-1 text-xs text-slate-600">
            {isOfficeOrder ? (
              <>
                <div className="font-semibold text-emerald-700 truncate">
                  Office: {officeOrderName}
                </div>
                <div className="font-semibold text-emerald-700">
                  Type: {takeawayOrderTypeLabel}
                </div>
              </>
            ) : (
              resolvedTakeawayOrderType && (
                <div className="font-semibold text-emerald-700">
                  Type: {takeawayOrderTypeLabel}
                </div>
              )
            )}
            {customerName && <div>Customer: {customerName}</div>}
            {customerMobile && <div>Mobile: {customerMobile}</div>}
            {resolvedTakeawayOrderType === "PICKUP" && (
              <div>Pickup: {pickupAddress || "Address not set"}</div>
            )}
            {resolvedTakeawayOrderType === "DELIVERY" && (
              <div>Address: {fallbackTakeawayAddress || "Address not set"}</div>
            )}
            {!resolvedTakeawayOrderType && fallbackTakeawayAddress && (
              <div>Address: {fallbackTakeawayAddress}</div>
            )}
            {hasTakeawayToken && (
              <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Token: {order.takeawayToken}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Status Flow
          </div>
          <div className="flex flex-wrap gap-1.5">{statusActionButtons}</div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Actions
          </div>
          <div className="flex flex-wrap gap-1.5">
            {user?.role !== "franchise_admin" &&
              displayStatus !== "Paid" &&
              displayStatus !== "Cancelled" &&
              displayStatus !== "Returned" && (
                <button
                  onClick={() => handleEdit(order)}
                  className="px-2 py-1 text-xs text-blue-600 hover:text-blue-900 border border-blue-200 rounded-md hover:bg-blue-50 font-medium whitespace-nowrap"
                  title="Add more items to this order"
                >
                  Modify
                </button>
              )}
            {user?.role !== "franchise_admin" && (
              <button
                onClick={() => handleEdit(order)}
                className="px-2 py-1 text-xs text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded-md hover:bg-indigo-50 whitespace-nowrap"
                title="Edit order"
              >
                Edit
              </button>
            )}
            {user?.role !== "admin" && user?.role !== "franchise_admin" && (
              <button
                type="button"
                onClick={(e) => handleDelete(e, order._id)}
                className="px-2 py-1 text-xs text-red-600 hover:text-red-900 border border-red-200 rounded-md hover:bg-red-50 whitespace-nowrap"
                title="Delete order"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => printOrderInvoice(order)}
              className="px-2 py-1 text-xs rounded-md border text-gray-700 border-gray-200 hover:bg-gray-100 whitespace-nowrap"
              title="Print invoice"
            >
              Print
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleExpand(order._id)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          {isExpanded ? "Hide order items" : "View order items"}
        </button>

        {isExpanded && (
          <div className="pt-1 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600 space-y-1">
              <div>Created: {formatOrderDateTimeLong(createdAtDate || orderDate)}</div>
              <div>Updated: {formatOrderDateTimeLong(updatedAtDate)}</div>
              <div>
                Invoice: <span className="font-mono">{buildInvoiceId(order)}</span>
              </div>
              <div>
                Service Type:{" "}
                <span className="font-semibold text-gray-700">{serviceTypeLabel}</span>
              </div>
              {isOfficeOrder ? (
                <>
                  <div>
                    Office:{" "}
                    <span className="font-semibold text-emerald-700">
                      {officeOrderName}
                    </span>
                  </div>
                  <div>
                    Order Type:{" "}
                    <span className="font-semibold text-emerald-700">
                      {takeawayOrderTypeLabel}
                    </span>
                  </div>
                </>
              ) : (
                shouldShowOrderTypeMeta && (
                  <div>
                    Order Type:{" "}
                    <span className="font-semibold text-emerald-700">
                      {takeawayOrderTypeLabel}
                    </span>
                  </div>
                )
              )}
              {resolvedTakeawayOrderType === "PICKUP" && (
                <div>Pickup Address: {pickupAddress || "Address not set"}</div>
              )}
              {resolvedTakeawayOrderType === "DELIVERY" && (
                <>
                  <div>
                    Delivery Address: {fallbackTakeawayAddress || "Address not set"}
                  </div>
                  {order.deliveryInfo?.distance != null && (
                    <div>
                      Distance: {Number(order.deliveryInfo.distance).toFixed(2)} km
                    </div>
                  )}
                  {deliveryCharge > 0 && (
                    <div className="text-green-700">
                      Delivery Charge: {"\u20B9"}
                      {Number(deliveryCharge).toFixed(2)}
                    </div>
                  )}
                  {isPresentValue(order.deliveryInfo?.estimatedTime) &&
                    !Number.isNaN(Number(order.deliveryInfo.estimatedTime)) &&
                    Number(order.deliveryInfo.estimatedTime) > 0 && (
                      <div>Est. Time: {order.deliveryInfo.estimatedTime} min</div>
                    )}
                </>
              )}
              {!resolvedTakeawayOrderType && fallbackTakeawayAddress && (
                <div>Address: {fallbackTakeawayAddress}</div>
              )}
              {hasTakeawayToken && (
                <div>
                  Token:{" "}
                  <span className="font-semibold text-blue-700">
                    {order.takeawayToken}
                  </span>
                </div>
              )}
              {order.cancellationReason &&
                (displayStatus === "Cancelled" || displayStatus === "Returned") && (
                  <div className="text-red-600 font-medium bg-red-50 p-1.5 rounded border border-red-100">
                    Reason: {order.cancellationReason}
                  </div>
                )}
            </div>

            {(() => {
              const lineItems = buildOrderLineItems(order, {
                includeReturned: true,
              });

              if (!lineItems.length) {
                return (
                  <div className="bg-white p-3 rounded-lg border shadow-sm text-sm text-gray-500">
                    No items in this order yet.
                  </div>
                );
              }

              const orderTotal = lineItems.reduce(
                (sum, line) => sum + (line.returned ? 0 : line.total || 0),
                0,
              );

              return (
                <div className="bg-white p-3 rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-semibold text-gray-800">
                      Order Items
                    </div>
                    <div className="text-sm font-bold text-green-600">
                      {"\u20B9"}
                      {formatMoney(orderTotal)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {lineItems.map((line) => (
                      <div
                        key={line.key}
                        className={`flex items-center justify-between gap-2 py-1 border-b ${
                          line.returned ? "opacity-60 bg-gray-100" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${
                                line.type === "addon"
                                  ? "bg-blue-100 text-blue-700"
                                  : line.isTakeaway
                                    ? "bg-green-100 text-green-800"
                                    : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {line.quantity}x
                            </span>
                            <span className="text-xs text-gray-800 truncate">
                              <span className={line.returned ? "line-through" : ""}>
                                {line.name}
                              </span>
                              {line.type === "addon" && (
                                <span className="ml-2 text-blue-600 font-semibold text-[10px] whitespace-nowrap">
                                  ADD-ON
                                </span>
                              )}
                              {line.isTakeaway && line.type !== "addon" && (
                                <span className="ml-2 text-green-600 font-semibold text-[10px] whitespace-nowrap">
                                  TAKEAWAY
                                </span>
                              )}
                              {line.returned && (
                                <span className="ml-2 text-red-600 font-semibold text-[10px] whitespace-nowrap">
                                  (Cancelled)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-xs whitespace-nowrap ${
                            line.returned
                              ? "text-gray-500 line-through"
                              : "text-gray-600"
                          }`}
                        >
                          {"\u20B9"}
                          {formatMoney(line.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </article>
    );
  };

  const refreshOrders = useCallback(async () => {
    const ordersRes = await api.get("/orders", {
      params: { includeHistory: "true" },
    });
    const allOrders = normalizeOrdersPayload(ordersRes.data);
    const scopedOrders = filterOrdersByCafeId(allOrders, filterCafeId);
    setOrders(scopedOrders);
    return scopedOrders;
  }, [filterCafeId]);

  useEffect(() => {
    const fetchData = async () => {
      if (filterCafeId) {
        // Fetch cart info for the filter
        try {
          const cafeRes = await api.get(`/users/${filterCafeId}`, {
            skipErrorLogging: true,
          });
          setCafeInfo(cafeRes.data);
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error("Failed to fetch cart info:", err);
          }
        }
      }

      // For franchise admin without filter: fetch all carts
      if (user?.role === "franchise_admin" && !filterCafeId) {
        try {
          const usersRes = await api.get("/users");
          const allUsers = usersRes.data || [];
          // Filter admin users (carts) that belong to this franchise
          const franchiseCarts = allUsers.filter((u) => {
            if (u.role !== "admin") return false;

            // Check franchiseId match (handle both object and string formats)
            const userFranchiseId = user._id?.toString() || user._id;
            const cartFranchiseId = u.franchiseId
              ? u.franchiseId._id?.toString() ||
                u.franchiseId.toString() ||
                u.franchiseId
              : null;

            return (
              cartFranchiseId &&
              cartFranchiseId.toString() === userFranchiseId.toString()
            );
          });
          setCarts(franchiseCarts);
          if (import.meta.env.DEV) {
            console.log(
              `[Orders] Found ${franchiseCarts.length} carts for franchise admin (user ID: ${user._id})`,
            );
            if (franchiseCarts.length === 0) {
              console.warn(
                `[Orders] No carts found for franchise admin. This might indicate a data issue.`,
              );
            }
          }
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error("Failed to fetch carts:", err);
          }
        }
      }

      // Fetch initial orders
      try {
        const scopedOrders = await refreshOrders();
        if (import.meta.env.DEV) {
          console.log(
            filterCafeId
              ? `Fetched orders for cart ${filterCafeId}: ${scopedOrders.length}`
              : `Fetched all orders: ${scopedOrders.length}`,
          );
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Failed to fetch orders:", err);
        }
      }
    };

    fetchData();

    const getTargetCafeId = () => {
      if (filterCafeId) return filterCafeId.toString();
      if (user?.role === "admin" && user?._id) return user._id.toString();
      return null;
    };

    const joinOrderRooms = () => {
      const targetCafeId = getTargetCafeId();
      if (!targetCafeId) return;
      socket.emit("join:cafe", targetCafeId);
      socket.emit("join:cart", targetCafeId);
      if (import.meta.env.DEV) {
        console.log(`[Orders] Joined socket rooms: cafe:${targetCafeId}, cart:${targetCafeId}`);
      }
    };

    const matchesActiveFilter = (orderPayload) => {
      if (!filterCafeId) return true;
      const payloadCafeId = getOrderCafeId(orderPayload);
      if (!payloadCafeId) return true;
      return payloadCafeId?.toString() === filterCafeId.toString();
    };

    const handleOrderCreated = (orderPayload) => {
      if (!matchesActiveFilter(orderPayload)) return;
      upsertOrder(orderPayload, { prepend: true });
    };

    const handleOrderUpdated = (updatedOrder) => {
      if (!updatedOrder) return;
      if (matchesActiveFilter(updatedOrder)) {
        upsertOrder(updatedOrder);
        return;
      }

      const updatedOrderId = normalizeId(updatedOrder._id);
      if (!updatedOrderId) return;
      setOrders((prev) =>
        prev.filter((order) => normalizeId(order?._id) !== updatedOrderId),
      );
    };

    const handleOrderDeleted = (payload = {}) => {
      const deletedOrderId = normalizeId(payload.id || payload._id);
      if (!deletedOrderId) return;
      setOrders((prev) =>
        prev.filter((order) => normalizeId(order?._id) !== deletedOrderId),
      );
    };

    joinOrderRooms();
    socket.on("connect", joinOrderRooms);
    socket.on("newOrder", handleOrderCreated);
    socket.on("order:created", handleOrderCreated);
    socket.on("orderUpdated", handleOrderUpdated);
    socket.on("order:status:updated", handleOrderUpdated);
    socket.on("orderDeleted", handleOrderDeleted);
    socket.on("order:deleted", handleOrderDeleted);

    return () => {
      socket.off("connect", joinOrderRooms);
      socket.off("newOrder", handleOrderCreated);
      socket.off("order:created", handleOrderCreated);
      socket.off("orderUpdated", handleOrderUpdated);
      socket.off("order:status:updated", handleOrderUpdated);
      socket.off("orderDeleted", handleOrderDeleted);
      socket.off("order:deleted", handleOrderDeleted);
    };
  }, [upsertOrder, filterCafeId, user?._id, user?.role, refreshOrders]);

  const handleAdd = () => {
    setCurrentOrder({ isNew: true });
    resetDraft();
    setDraftAddonSelections({});
    // Ensure menu is loaded when opening Add Order modal
    if (menuItems.length === 0 && !menuLoading) {
      loadMenu();
    }
    loadAddons(currentMenuCartId || filterCafeId || undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (order) => {
    setCurrentOrder(normalizeOrderForDisplay(order));
    setDraftSelections({});
    setDraftAddonSelections({});
    setDraftSearch("");
    setDraftCategory("all");
    // Load menu for this order's outlet so franchise admin sees correct items (not mixed from all outlets)
    const orderCartId = order?.cartId
      ? typeof order.cartId === "object"
        ? order.cartId._id
        : order.cartId
      : null;
    if (import.meta.env.DEV) {
      console.log(
        "[Orders] handleEdit - Loading menu for cartId:",
        orderCartId,
        "Order:",
        order._id,
      );
    }
    loadMenu(orderCartId || undefined);
    loadAddons(orderCartId || undefined);
    setIsModalOpen(true);
  };

  const handleDelete = async (e, orderId) => {
    e.preventDefault();
    e.stopPropagation();

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      "Are you sure you want to PERMANENTLY DELETE this order?\n\nThis action cannot be undone.",
      {
        title: "Delete Order",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      },
    );

    if (!confirmed) return;

    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Delete failed:", err);
      }
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to delete order";
      alert(errorMessage);
    }
  };

  const handleCancelAddonLine = async (orderId, addonIndex) => {
    const normalizedOrderId = normalizeId(orderId);
    const sourceOrder =
      orders.find((order) => normalizeId(order?._id) === normalizedOrderId) ||
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
      const response = await api.patch(`/orders/${sourceOrder._id}/addons`, {
        selectedAddons: toOrderAddonPayload(updatedAddons),
      });

      const updatedOrder = response?.data;
      if (updatedOrder?._id) {
        upsertOrder(updatedOrder);
        if (
          currentOrder &&
          normalizeId(currentOrder._id) === normalizeId(updatedOrder._id)
        ) {
          setCurrentOrder(normalizeOrderForDisplay(updatedOrder, currentOrder));
        }
      } else {
        await refreshOrders();
      }

      alert(`Add-on "${addonName}" cancelled successfully.`);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to cancel add-on:", err);
      }
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to cancel add-on. Please try again.";
      alert(errorMessage);
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
      const normalizedNewStatus = normalizeLegacyOrderStatus(newStatus, currentOrder);
      const isCancelOrReturnAction =
        normalizedNewStatus === "Cancelled" || normalizedNewStatus === "Returned";
      const isProgressingStatus = ["Preparing", "Ready", "Served", "Paid"].includes(
        normalizedNewStatus,
      );

      if (
        isProgressingStatus &&
        isStatusProgressBlockedByPayment(currentOrder)
      ) {
        throw new Error(
          "Payment must be completed or marked COD before updating order status.",
        );
      }

      if (normalizedNewStatus !== currentOrder.status) {
        const requestType = `order-status-${currentOrder._id}`;
        const endpoint = isCancelOrReturnAction
          ? `/orders/${currentOrder._id}/customer-status`
          : `/orders/${currentOrder._id}/status`;
        const payload = { status: normalizedNewStatus };
        if (isCancelOrReturnAction && currentOrder?.sessionToken) {
          payload.sessionToken = currentOrder.sessionToken;
        }
        if (isCancelOrReturnAction && currentOrder?.anonymousSessionId) {
          payload.anonymousSessionId = currentOrder.anonymousSessionId;
        }
        await withCancellation(requestType, async (signal) => {
          return await api.patch(endpoint, payload, { signal });
        });
      }

      // Add new items if any are selected
      if (draftItemsArray.length > 0) {
        const itemsToAdd = draftItemsArray.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        }));

        await api.post(`/orders/${currentOrder._id}/add-items`, {
          items: itemsToAdd,
        });
      }

      const isFinal =
        currentOrder.status === "Paid" ||
        currentOrder.status === "Cancelled" ||
        currentOrder.status === "Returned";

      if (!isFinal && draftAddonsArray.length > 0) {
        const mergedAddons = mergeOrderAddons(
          currentOrder.selectedAddons || [],
          draftAddonsArray,
        );
        await api.patch(`/orders/${currentOrder._id}/addons`, {
          selectedAddons: mergedAddons,
        });
      }

      // Refresh orders list by fetching again
      await refreshOrders();

      setIsModalOpen(false);
      setCurrentOrder(null);
      resetDraft();
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

  const handleSubmitNewOrder = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (draftItemsArray.length === 0) {
      setCreateError("Please add at least one menu item to the order.");
      return;
    }

    const normalizedPaymentType = String(draftPaymentType || "")
      .trim()
      .toUpperCase();
    if (normalizedPaymentType !== "COD" && normalizedPaymentType !== "ONLINE") {
      setCreateError("Please select a payment type before creating the order.");
      return;
    }
    const isOnlinePaymentType = normalizedPaymentType === "ONLINE";

    const isOfficeTakeawayOrder =
      draftServiceType === "TAKEAWAY" && draftTakeawayMode === "OFFICE";

    // For DINE_IN orders, table selection is required.
    // For TAKEAWAY counter orders, no table selection is needed.
    // For TAKEAWAY office orders, office selection is required.
    if (draftServiceType === "DINE_IN") {
      if (!selectedTableId) {
        setCreateError("Please select a table for this order.");
        return;
      }

      const tableSource = tables.find((t) => t._id === selectedTableId);
      const table = tableSource;
      if (!table) {
        setCreateError(
          "Selected table could not be found. Refresh the page and try again.",
        );
        return;
      }

      // Check table availability for DINE_IN orders
      if (table.status !== "AVAILABLE" && !table.sessionToken) {
        setCreateError(
          `Table ${
            table.number || table.name || ""
          } is not currently available.`,
        );
        return;
      }
    } else if (isOfficeTakeawayOrder) {
      if (!selectedOfficeId) {
        setCreateError("Please select an office QR for this order.");
        return;
      }

      const officeSource = tables.find((t) => t._id === selectedOfficeId);
      if (!officeSource || !isOfficeQrTable(officeSource)) {
        setCreateError(
          "Selected office QR could not be found. Refresh tables and try again.",
        );
        return;
      }

      if (!String(officeSource.officeName || "").trim()) {
        setCreateError(
          "Selected office is missing office name. Update office QR details first.",
        );
        return;
      }

      if (!String(officeSource.officeAddress || "").trim()) {
        setCreateError(
          "Selected office is missing office address. Update office QR details first.",
        );
        return;
      }
    }

    setCreateSubmitting(true);

    try {
      let sessionToken = null;
      let table = null;
      let tableNumber = null;
      let officeTable = null;

      // For DINE_IN orders, we need a table and session token.
      if (draftServiceType === "DINE_IN") {
        table = tables.find((t) => t._id === selectedTableId);
        if (!table) {
          throw new Error("Selected table could not be found.");
        }

        tableNumber = table.number || table.tableNumber;
        sessionToken = table.sessionToken;
        if (!sessionToken) {
          if (table.qrSlug) {
            const lookupRes = await fetch(
              `${nodeApi}/api/tables/lookup/${table.qrSlug}`,
            );
            const lookupPayload = await lookupRes.json().catch(() => ({}));
            if (lookupRes.status === 423) {
              throw new Error(
                lookupPayload?.message ||
                  "Table is currently assigned to another guest.",
              );
            }
            if (lookupRes.ok) {
              sessionToken =
                lookupPayload.sessionToken ||
                lookupPayload.table?.sessionToken ||
                null;
            }
          }
        }

        if (!sessionToken) {
          sessionToken = `STAFF_${table._id || selectedTableId}_${Date.now()}`;
        }
      } else if (isOfficeTakeawayOrder) {
        officeTable = tables.find((t) => t._id === selectedOfficeId) || null;
        if (!officeTable || !isOfficeQrTable(officeTable)) {
          throw new Error("Selected office QR could not be found.");
        }
        tableNumber = officeTable.number || officeTable.tableNumber || "TAKEAWAY";
      }

      const itemsPayload = draftItemsArray.map((entry) => ({
        name: entry.name,
        quantity: entry.quantity,
        price: entry.price,
      }));

      const selectedAddonsPayload = toOrderAddonPayload(draftAddonsArray);
      const officePaymentMode = isOfficeTakeawayOrder
        ? String(officeTable?.officePaymentMode || "ONLINE").toUpperCase() === "COD"
          ? "COD"
          : String(officeTable?.officePaymentMode || "ONLINE").toUpperCase() ===
              "BOTH"
            ? "BOTH"
          : "ONLINE"
        : undefined;
      const officeDeliveryCharge = Number(officeTable?.officeDeliveryCharge || 0);
      const officeName = String(officeTable?.officeName || "").trim();
      const officePhone = String(officeTable?.officePhone || "").trim();
      const officeAddress = String(officeTable?.officeAddress || "").trim();
      const officeCartId = resolveTableCartId(officeTable);
      const dineInOrCounterCartId =
        currentMenuCartId ||
        filterCafeId ||
        (user.role === "admin" ? user._id : undefined);
      const finalCartId = isOfficeTakeawayOrder
        ? officeCartId || dineInOrCounterCartId
        : dineInOrCounterCartId;

      const payload = {
        serviceType: draftServiceType,
        paymentRequiredBeforeProceeding: isOnlinePaymentType,
        paymentMode: isOnlinePaymentType ? "ONLINE" : "CASH",
        tableId: isOfficeTakeawayOrder
          ? officeTable?._id || null
          : draftServiceType === "TAKEAWAY"
            ? null
            : table?._id || null,
        tableNumber:
          draftServiceType === "TAKEAWAY"
            ? isOfficeTakeawayOrder
              ? String(tableNumber || "TAKEAWAY")
              : "TAKEAWAY"
            : tableNumber || null,
        sessionToken:
          draftServiceType === "TAKEAWAY" ? undefined : sessionToken,
        cartId: finalCartId,
        items: itemsPayload,
        ...(isOfficeTakeawayOrder && {
          sourceQrType: "OFFICE",
          ...(officeName && { officeName }),
          officePaymentMode,
          ...(officeDeliveryCharge > 0 && {
            officeDeliveryCharge: Number(officeDeliveryCharge.toFixed(2)),
          }),
          ...(officeName && { customerName: officeName }),
          ...(officePhone && { customerMobile: officePhone }),
          ...(officeAddress && {
            customerLocation: {
              latitude: null,
              longitude: null,
              address: officeAddress,
            },
          }),
        }),
        ...(selectedAddonsPayload.length > 0 && {
          selectedAddons: selectedAddonsPayload,
        }),
      };

      const { data: created } = await api.post("/orders", payload);
      upsertOrder(created, { prepend: true });
      setIsModalOpen(false);
      setCurrentOrder(null);
      resetDraft();
      loadTables();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to create order", err);
      }
      setCreateError(
        err.message || "Failed to create order. Please try again.",
      );
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Group orders by cart for franchise admin
  const ordersByCart = useMemo(() => {
    if (user?.role !== "franchise_admin" || filterCafeId) {
      return null; // Don't group if not franchise admin or if filtering by specific cart
    }

    const grouped = {};
    const orderIdsSeen = new Set(); // Track orders we've already added to prevent duplicates

    // Create a map of cart IDs for quick lookup
    const cartMap = new Map();
    carts.forEach((cart) => {
      const cartId = cart._id?.toString() || cart._id;
      if (cartId) {
        cartMap.set(cartId, cart);
        grouped[cartId] = {
          cart,
          orders: [],
        };
      }
    });

    // Also add any previously fetched unknown carts
    Object.entries(unknownCarts).forEach(([cartId, cartInfo]) => {
      if (!cartMap.has(cartId)) {
        cartMap.set(cartId, cartInfo);
        grouped[cartId] = {
          cart: cartInfo,
          orders: [],
        };
      }
    });

    orders.forEach((order) => {
      // Skip if we've already processed this order
      const orderId = order._id?.toString() || order._id;
      if (!orderId || orderIdsSeen.has(orderId)) {
        return;
      }

      let orderCartId = order.cafeId || order.cartId;
      if (orderCartId && typeof orderCartId === "object") {
        orderCartId = orderCartId._id || orderCartId;
      }
      if (!orderCartId && order.table && order.table.cafeId) {
        orderCartId = order.table.cafeId;
        if (typeof orderCartId === "object") {
          orderCartId = orderCartId._id || orderCartId;
        }
      }

      const cartIdStr = orderCartId?.toString();
      if (cartIdStr && cartMap.has(cartIdStr)) {
        // Cart is in our list
        grouped[cartIdStr].orders.push(order);
        orderIdsSeen.add(orderId);
      } else if (cartIdStr) {
        // Cart not in our list - check if we have it in unknownCarts cache
        if (unknownCarts[cartIdStr]) {
          if (!grouped[cartIdStr]) {
            grouped[cartIdStr] = {
              cart: unknownCarts[cartIdStr],
              orders: [],
            };
          }
          grouped[cartIdStr].orders.push(order);
          orderIdsSeen.add(orderId);
        } else {
          // New unknown cart - create entry and mark for fetching
          const cartInfo = order.cart || order.cafe || null;
          grouped[cartIdStr] = {
            cart: cartInfo || {
              _id: cartIdStr,
              name: "Loading...",
              cartName: "Loading...",
              cartCode: "",
            },
            orders: [order],
          };
          orderIdsSeen.add(orderId);
        }
      }
    });

    return grouped;
  }, [orders, carts, unknownCarts, user, filterCafeId]);

  // Fetch cart information for unknown carts
  useEffect(() => {
    if (user?.role !== "franchise_admin" || filterCafeId || !ordersByCart) {
      return;
    }

    const fetchUnknownCarts = async () => {
      const cartIdsToFetch = [];

      Object.entries(ordersByCart).forEach(([cartId, { cart }]) => {
        // Check if cart name is "Loading..." or "Unknown Cart" and we haven't fetched it yet
        if (
          (cart.cartName === "Loading..." ||
            cart.cartName === "Unknown Cart") &&
          !unknownCarts[cartId]
        ) {
          cartIdsToFetch.push(cartId);
        }
      });

      if (cartIdsToFetch.length === 0) {
        return;
      }

      if (import.meta.env.DEV) {
        console.log(
          `[Orders] Fetching info for ${cartIdsToFetch.length} unknown cart(s)...`,
        );
      }

      // Fetch all unknown carts in parallel
      const fetchPromises = (
        Array.isArray(cartIdsToFetch) ? cartIdsToFetch : []
      ).map(async (cartId) => {
        if (!cartId) return null;
        try {
          const cartRes = await api.get(`/users/${cartId}`, {
            skipErrorAlert: true,
            skipErrorLogging: true,
          });
          if (cartRes.data) {
            const cartInfo = {
              _id: cartId,
              name:
                cartRes.data.cartName || cartRes.data.name || "Unknown Cart",
              cartName:
                cartRes.data.cartName || cartRes.data.name || "Unknown Cart",
              cartCode: cartRes.data.cartCode || "",
            };
            setUnknownCarts((prev) => ({
              ...prev,
              [cartId]: cartInfo,
            }));
            if (import.meta.env.DEV) {
              console.log(
                `[Orders] Fetched cart info for ${cartId}: ${cartInfo.cartName}`,
              );
            }
            return { cartId, cartInfo };
          }
        } catch (err) {
          // Only log non-404 errors (404 means cart was deleted, which is normal)
          if (import.meta.env.DEV && err.response?.status !== 404) {
            console.warn(
              `[Orders] Failed to fetch cart info for ${cartId}:`,
              err.message,
            );
          }
          // Mark as truly unknown
          setUnknownCarts((prev) => ({
            ...prev,
            [cartId]: {
              _id: cartId,
              name: "Unknown Cart",
              cartName: "Unknown Cart",
              cartCode: "",
            },
          }));
        }
      });

      await Promise.all(fetchPromises);
    };

    fetchUnknownCarts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersByCart, user, filterCafeId]);

  const filteredOrders = (() => {
    const normalizedOrder = searchOrderId.trim().toLowerCase();
    const normalizedTable = searchTable.trim().toLowerCase();
    const normalizedInvoice = searchInvoice.trim().toLowerCase();

    // Deduplicate orders by _id to prevent duplicate keys
    const uniqueOrders = new Map();
    orders.forEach((order) => {
      const orderId = order._id?.toString() || order._id;
      if (orderId && !uniqueOrders.has(orderId)) {
        uniqueOrders.set(orderId, order);
      }
    });

    const matches = Array.from(uniqueOrders.values()).filter((order) => {
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
    if (filterStatus === "active")
      return matches.filter(
        (o) =>
          !["Cancelled", "Returned"].includes(
            normalizeLegacyOrderStatus(o.status, o),
          )
      );
    return matches.filter(
      (o) => normalizeLegacyOrderStatus(o.status, o) === filterStatus,
    );
  })();

  const handleDownloadOrdersReport = () => {
    const rows = filteredOrders.map((order) => {
      const createdAtDate = getOrderCreatedDate(order);
      const updatedAtDate = getOrderUpdatedDate(order);
      const resolvedTakeawayOrderType = resolveTakeawayOrderType(order);
      const customerName = getOrderCustomerName(order);
      const customerMobile = getOrderCustomerMobile(order);
      const lineItems = buildOrderLineItems(order, { includeReturned: false });
      const totalAmount = lineItems.reduce(
        (sum, line) => sum + (Number(line.total) || 0),
        0,
      );

      return {
        "Order ID": order._id || "",
        "Invoice ID": buildInvoiceId(order),
        "Created At": formatOrderDateTimeLong(createdAtDate),
        "Updated At": formatOrderDateTimeLong(updatedAtDate),
        Status: order.status || "",
        "Service Type":
          resolvedTakeawayOrderType ||
          (String(order.serviceType || "").toUpperCase() === "DINE_IN"
            ? "Dine-In"
            : String(order.serviceType || "")),
        "Order Type": resolvedTakeawayOrderType || "",
        "Table / Counter": order.tableNumber || "",
        Token: order.takeawayToken ?? "",
        Customer: customerName || "",
        Mobile: customerMobile || "",
        "Items Count": lineItems.length,
        "Total Amount (Rs)": Number(totalAmount.toFixed(2)),
      };
    });

    const fileName = buildExcelFileName("orders-report", filterDate);
    const exported = exportRowsToExcel({
      rows,
      fileName,
      sheetName: "Orders",
    });

    if (!exported) {
      alert("No orders available for the selected filters.");
    }
  };

  // Filter orders by cart for grouped view
  const getFilteredOrdersForCart = (cartOrders) => {
    const normalizedOrder = searchOrderId.trim().toLowerCase();
    const normalizedTable = searchTable.trim().toLowerCase();
    const normalizedInvoice = searchInvoice.trim().toLowerCase();

    // Deduplicate orders by _id to prevent duplicate keys
    const uniqueOrders = new Map();
    cartOrders.forEach((order) => {
      const orderId = order._id?.toString() || order._id;
      if (orderId && !uniqueOrders.has(orderId)) {
        uniqueOrders.set(orderId, order);
      }
    });

    const matches = Array.from(uniqueOrders.values()).filter((order) => {
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
    if (filterStatus === "active")
      return matches.filter(
        (o) =>
          !["Cancelled", "Returned"].includes(
            normalizeLegacyOrderStatus(o.status, o),
          )
      );
    return matches.filter(
      (o) => normalizeLegacyOrderStatus(o.status, o) === filterStatus,
    );
  };

  const toggleCartExpand = (cartId) => {
    setExpandedCarts((prev) => ({ ...prev, [cartId]: !prev[cartId] }));
  };

  const loadMenu = useCallback(async (outletCartId = null) => {
    try {
      setMenuLoading(true);
      setMenuError("");
      setCurrentMenuCartId(outletCartId); // Store for retry
      // For franchise/super admin, pass outletCartId to load that outlet's menu (e.g. when editing that outlet's order)
      const params = outletCartId ? { cartId: outletCartId } : {};
      if (import.meta.env.DEV) {
        console.log("[Orders] loadMenu - Fetching menu with params:", params);
      }
      const res = await api.get("/menu", { params });
      const payload = res.data || [];

      if (!Array.isArray(payload) || payload.length === 0) {
        const errorMsg = `No menu items found${outletCartId ? ` for outlet ${outletCartId}` : ""}. Please add menu items first.`;
        setMenuError(errorMsg);
        setMenuCategories([{ id: "all", label: "All" }]);
        setMenuItems([]);
        if (import.meta.env.DEV) {
          console.warn("[Orders] loadMenu -", errorMsg);
        }
        return;
      }

      const safeCategories = payload.map((category) => ({
        name: category.name || "Menu",
        items: (category.items || []).map((item) => ({
          id:
            item._id ||
            `${category.name || "Menu"}-${item.name || Math.random()}`,
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
        })),
      );
      if (import.meta.env.DEV) {
        console.log("[Orders] Menu loaded:", {
          categories: categories.length,
          items: flatItems.length,
          categoriesList: categories.map((c) => c.label),
          itemsList: flatItems.map((i) => i.name).slice(0, 5),
        });
      }
      setMenuItems(flatItems);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to load menu", err);
      }
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to load menu";
      setMenuError(errorMessage);
      // Set empty state on error
      setMenuCategories([{ id: "all", label: "All" }]);
      setMenuItems([]);
    } finally {
      setMenuLoading(false);
    }
  }, []);

  const loadAddons = useCallback(async (outletCartId = null) => {
    try {
      setAddonsLoading(true);
      setAddonsError("");
      const params = outletCartId ? { cartId: outletCartId } : {};
      const response = await api.get("/addons", { params });
      const raw = response.data;
      const addonsList = Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.addons)
            ? raw.addons
            : [];
      const list = addonsList.filter(
        (addon) =>
          addon &&
          addon.isAvailable !== false &&
          (addon.name != null || addon._id != null || addon.id != null),
      );
      setAddonList(list);
    } catch (err) {
      setAddonList([]);
      setAddonsError(
        err.response?.data?.message || "Failed to load add-ons",
      );
    } finally {
      setAddonsLoading(false);
    }
  }, []);

  const loadTables = useCallback(async () => {
    try {
      setTableLoading(true);
      const response = await api.get("/tables");
      // Backend returns { success: true, data: [...] } or just the array
      let tablesData = response.data;
      if (tablesData && tablesData.success && Array.isArray(tablesData.data)) {
        tablesData = tablesData.data;
      } else if (!Array.isArray(tablesData)) {
        tablesData = [];
      }

      const filteredTables = tablesData
        .filter((table) => table && typeof table === "object")
        // New QR system guard: ignore legacy records without slug.
        .filter((table) => String(table.qrSlug || "").trim().length > 0)
        // When Orders is scoped to one cafe, tables must be scoped too.
        .filter((table) => {
          if (!filterCafeId) return true;
          return (
            String(resolveTableCartId(table) || "") ===
            String(filterCafeId || "")
          );
        });

      // Deduplicate cart+tableNo and prefer latest record.
      const dedupedByKey = new Map();
      filteredTables.forEach((table) => {
        const cartId = String(resolveTableCartId(table) || "unknown");
        const key = `${cartId}-${table.number ?? table.tableNumber ?? "0"}`;
        const existing = dedupedByKey.get(key);
        if (!existing) {
          dedupedByKey.set(key, table);
          return;
        }
        const currentTs = new Date(
          table.updatedAt || table.createdAt || 0,
        ).getTime();
        const existingTs = new Date(
          existing.updatedAt || existing.createdAt || 0,
        ).getTime();
        if (currentTs >= existingTs) {
          dedupedByKey.set(key, table);
        }
      });

      const sortedTables = Array.from(dedupedByKey.values()).sort((a, b) => {
        const numA = Number(a.number);
        const numB = Number(b.number);
        if (Number.isFinite(numA) && Number.isFinite(numB)) {
          return numA - numB;
        }
        return String(a.name || "").localeCompare(String(b.name || ""));
      });

      setTables(sortedTables);
      if (import.meta.env.DEV) {
        console.log(`[Orders] Loaded ${sortedTables.length} tables`);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to load tables", err);
        const errorMessage =
          err.response?.data?.message || err.message || "Failed to load tables";
        console.error("Error details:", errorMessage);
      }
      setTables([]);
    } finally {
      setTableLoading(false);
    }
  }, [filterCafeId]);

  useEffect(() => {
    loadMenu();
    loadTables();
    loadAddons();
  }, [loadMenu, loadTables, loadAddons]);

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
    [draftSelections],
  );

  const draftAddonsArray = useMemo(() => {
    if (!draftAddonSelections || typeof draftAddonSelections !== "object") {
      return [];
    }

    return Object.entries(draftAddonSelections)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([id, quantity]) => {
        const addon = addonList.find((entry) => (entry._id || entry.id) === id);
        if (!addon) return null;
        return {
          id,
          name: sanitizeAddonName(addon.name),
          price: Number(addon.price) || 0,
          quantity: Number(quantity) || 0,
        };
      })
      .filter(Boolean);
  }, [draftAddonSelections, addonList]);

  const draftTotals = useMemo(() => {
    const subtotal = draftItemsArray.reduce(
      (sum, entry) => sum + entry.price * entry.quantity,
      0,
    );
    const addonsSubtotal = draftAddonsArray.reduce(
      (sum, entry) => sum + entry.price * entry.quantity,
      0,
    );
    const totalItems = draftItemsArray.reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    );
    return {
      subtotal,
      addonsSubtotal,
      total: subtotal + addonsSubtotal,
      totalItems,
    };
  }, [draftItemsArray, draftAddonsArray]);

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

  const { tablesForService, officeTablesForService } = useMemo(() => {
    const officeTables = tables.filter((table) => isOfficeQrTable(table));
    const dineInTables = tables.filter((table) => !isOfficeQrTable(table));

    if (draftServiceType !== "DINE_IN") {
      return {
        tablesForService: [],
        officeTablesForService: officeTables,
      };
    }

    // For DINE_IN: only show non-office tables that are available (or claimed by a valid session).
    const availableTables = dineInTables.filter((table) => {
      const status = table.status || "UNKNOWN";
      return status === "AVAILABLE" || Boolean(table.sessionToken);
    });

    return {
      tablesForService: availableTables,
      officeTablesForService: officeTables,
    };
  }, [tables, draftServiceType]);

  const selectedOffice = useMemo(
    () => officeTablesForService.find((office) => office._id === selectedOfficeId) || null,
    [officeTablesForService, selectedOfficeId],
  );
  const summaryStatusCounts = useMemo(
    () => {
      const base = {
        all: Array.isArray(orders) ? orders.length : 0,
        active: 0,
      };
      return (Array.isArray(orders) ? orders : []).reduce((acc, order) => {
        const status = normalizeLegacyOrderStatus(order?.status, order);
        if (status) {
          acc[status] = (acc[status] || 0) + 1;
        }
        if (status !== "Cancelled" && status !== "Returned") {
          acc.active = (acc.active || 0) + 1;
        }
        return acc;
      }, base);
    },
    [orders],
  );

  const resetDraft = useCallback(() => {
    setDraftSelections({});
    setDraftAddonSelections({});
    setDraftSearch("");
    setDraftCategory("all");
    setSelectedTableId("");
    setSelectedOfficeId("");
    setDraftServiceType("DINE_IN");
    setDraftTakeawayMode("COUNTER");
    setDraftPaymentType("");
    setCreateError("");
  }, []);

  return (
    <div className="p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {filterCafeId && cafeInfo
                ? `Orders - ${cafeInfo.cafeName || cafeInfo.name}`
                : "Orders"}
            </h1>
            {filterCafeId && (
              <p className="text-sm text-gray-500 mt-1">
                Filtered by specific cart
              </p>
            )}
          </div>
          {filterCafeId && (
            <button
              onClick={() => (window.location.href = "/orders")}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm whitespace-nowrap"
            >
              View All Carts
            </button>
          )}
        </div>

        {/* Search Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Order ID / Token"
            value={searchOrderId}
            onChange={(e) => setSearchOrderId(e.target.value)}
            className="border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Table number"
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            className="border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="text"
            placeholder="Invoice ID"
            value={searchInvoice}
            onChange={(e) => setSearchInvoice(e.target.value)}
            className="border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-lg py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            title="Filter by order date"
          />
          <button
            onClick={handleDownloadOrdersReport}
            className="border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold py-2.5 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
          >
            Download Excel
          </button>
          {user?.role !== "franchise_admin" && (
            <button
              onClick={handleAdd}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span className="text-lg">+</span>
              Add Order
            </button>
          )}
        </div>
      </div>


{/* Status Summary Cards */}
<div className="mb-6">
  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5">
    {ORDER_SUMMARY_TILE_STATUSES.map((status) => {
      const count = summaryStatusCounts[status] || 0;
      const theme = getSummaryTileTheme(status);
      const tileLabel = ORDER_SUMMARY_TILE_LABELS[status] || status;
      return (
        <button
          type="button"
          key={status}
          onClick={() => setFilterStatus(status)}
          className={`rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3 text-left transition-all duration-200 min-h-[82px] sm:min-h-[92px] ${
            filterStatus === status
              ? "ring-1 ring-[#e0662f]/45 border-[#e8c3ab] shadow-sm"
              : "shadow-[0_1px_0_rgba(15,23,42,0.03)] hover:shadow-sm"
          } ${theme.card}`}
        >
          <div className="flex items-start justify-between">
            <div className="text-2xl sm:text-[28px] leading-none font-bold tracking-tight text-[#3f291b]">
              {count}
            </div>
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm ${theme.icon}`}
            >
              {getStatusIcon(status)}
            </div>
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] text-[#6f5240] font-semibold uppercase tracking-[0.09em] leading-tight">
            {tileLabel}
          </div>
        </button>
      );
    })}
  </div>
</div>

      <div className="overflow-x-auto bg-white rounded-lg shadow-md -mx-2 sm:mx-0">
        {user?.role === "franchise_admin" && !filterCafeId && ordersByCart ? (
          // Grouped view by cart for franchise admin
          <div className="divide-y divide-gray-200">
            {Object.entries(ordersByCart)
              .filter(([, { orders: cartOrders }]) => {
                const filtered = getFilteredOrdersForCart(cartOrders);
                return filtered.length > 0;
              })
              .map(([cartId, { cart, orders: cartOrders }]) => {
                const filteredCartOrders = getFilteredOrdersForCart(cartOrders);
                const cartName =
                  cart.cartName || cart.name || cart.cafeName || "Unknown Cart";
                const cartCode = cart.cartCode || "";
                const isExpanded = expandedCarts[cartId] !== false; // Default to expanded

                return (
                  <div key={cartId} className="border-b border-gray-300">
                    {/* Cart Header */}
                    <div
                      className="bg-gray-100 hover:bg-gray-200 cursor-pointer px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3"
                      onClick={() => toggleCartExpand(cartId)}
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <span className="text-base sm:text-lg flex-shrink-0">
                          {isExpanded ? "▼" : "▶"}
                        </span>
                        {cartCode && (
                          <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded whitespace-nowrap flex-shrink-0">
                            {cartCode}
                          </span>
                        )}
                        <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-800 truncate min-w-0 flex-1">
                          {cartName}
                        </h3>
                        <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap flex-shrink-0">
                          ({filteredCartOrders.length} orders)
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/orders?cafeId=${cartId}`);
                        }}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-blue-500 text-white rounded hover:bg-blue-600 whitespace-nowrap flex-shrink-0"
                      >
                        View All
                      </button>
                    </div>

                    {/* Orders for this cart */}
                    {isExpanded && (
                      <div>
                        <div className="lg:hidden px-2 sm:px-3 py-3 space-y-3">
                          {filteredCartOrders.map((order) => renderOrderCard(order))}
                        </div>
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full table-fixed text-xs sm:text-sm">
                            <colgroup>
                              <col className="w-[30%]" />
                              <col className="w-[10%]" />
                              <col className="w-[15%]" />
                              <col className="w-[20%]" />
                              <col className="w-[15%]" />
                              <col className="w-[10%]" />
                            </colgroup>
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                  Order Details
                                </th>
                                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                  Payment Type
                                </th>
                                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                                  Date & Time
                                </th>
                                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                  Table / Takeaway
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
                              {filteredCartOrders.map((order) =>
                                renderOrderRow(order),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
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
          <div>
            <div className="lg:hidden px-2 sm:px-3 py-3 space-y-3">
              {filteredOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No orders found.
                </div>
              ) : (
                filteredOrders.map((order) => renderOrderCard(order))
              )}
            </div>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full table-fixed text-xs sm:text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[10%]" />
                  <col className="w-[15%]" />
                  <col className="w-[20%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                      Order Details
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                      Payment Type
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                      Date & Time
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                      Table / Takeaway
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
                      <td
                        colSpan="6"
                        className="px-3 sm:px-4 md:px-6 py-4 text-center text-gray-500 text-xs sm:text-sm"
                      >
                        No orders found.
                      </td>
                    </tr>
                  )}
                  {filteredOrders.map((order) => renderOrderRow(order))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center z-[9999] p-2 sm:p-3 md:p-4 lg:p-6">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col my-auto">
            <div className="flex justify-between items-center p-3 sm:p-4 md:p-6 border-b border-gray-200 sticky top-0 bg-white z-10 flex-shrink-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 truncate">
                {currentOrder?.isNew ? "Add Order" : "Edit Order"}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setCurrentOrder(null);
                  resetDraft();
                }}
                className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl leading-none p-1 ml-2 flex-shrink-0"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-3 sm:p-4 md:p-6">
              <form
                id="order-form"
                onSubmit={
                  currentOrder?.isNew ? handleSubmitNewOrder : handleSave
                }
                className="space-y-6"
              >
                {currentOrder?.isNew ? (
                  <div className="space-y-6">
                    {createError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {createError}
                      </div>
                    )}
                    <div className="space-y-4">
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
                                if (type === "DINE_IN") {
                                  setDraftTakeawayMode("COUNTER");
                                  setSelectedOfficeId("");
                                }

                                // Emit "dine" event immediately when user selects DINE_IN
                                if (type === "DINE_IN") {
                                  try {
                                    socket.emit("dine", {
                                      timestamp: new Date().toISOString(),
                                      serviceType: "DINE_IN",
                                    });
                                    if (import.meta.env.DEV) {
                                      console.log(
                                        "[Orders] Emitted 'dine' event for DINE_IN selection",
                                      );
                                    }
                                  } catch (error) {
                                    if (import.meta.env.DEV) {
                                      console.error(
                                        "[Orders] Error emitting 'dine' event:",
                                        error,
                                      );
                                    }
                                  }
                                }
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
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center gap-2">
                              {[
                                { value: "COUNTER", label: "Counter" },
                                { value: "OFFICE", label: "Office" },
                              ].map((mode) => (
                                <button
                                  key={mode.value}
                                  type="button"
                                  onClick={() => {
                                    setDraftTakeawayMode(mode.value);
                                    if (mode.value !== "OFFICE") {
                                      setSelectedOfficeId("");
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                                    draftTakeawayMode === mode.value
                                      ? "bg-blue-600 text-white border-blue-600 shadow"
                                      : "border-gray-300 text-gray-600 hover:border-blue-400"
                                  }`}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>
                            {draftTakeawayMode === "COUNTER" ? (
                              <p className="text-xs text-gray-500">
                                Counter takeaway order - no table selection needed.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <label className="block text-gray-700 text-sm font-semibold mb-2 flex items-center gap-2">
                                  <img
                                    src={tableIcon}
                                    alt="Office"
                                    className="w-5 h-5 object-contain"
                                  />
                                  Choose Office QR
                                </label>
                                <div className="flex flex-col md:flex-row md:items-center gap-3">
                                  <select
                                    value={selectedOfficeId}
                                    onChange={(e) => {
                                      const officeId = e.target.value;
                                      setSelectedOfficeId(officeId);
                                      const office = officeTablesForService.find(
                                        (entry) => entry._id === officeId,
                                      );
                                      const officeCartId = resolveTableCartId(office);
                                      if (officeCartId) {
                                        loadMenu(officeCartId);
                                        loadAddons(officeCartId);
                                      }
                                    }}
                                    className="shadow-sm border border-gray-300 rounded-lg w-full md:w-72 py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                                  >
                                    <option value="">Select an office QR</option>
                                    {officeTablesForService.length === 0 ? (
                                      <option value="" disabled>
                                        No office QR found
                                      </option>
                                    ) : (
                                      officeTablesForService.map((office) => {
                                        const officeName = String(
                                          office.officeName || "",
                                        ).trim();
                                        const label = officeName
                                          ? officeName
                                          : office.number
                                            ? `Office QR ${office.number}`
                                            : office.name || "Office QR";
                                        return (
                                          <option key={office._id} value={office._id}>
                                            {label}
                                          </option>
                                        );
                                      })
                                    )}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={loadTables}
                                    className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                                  >
                                    🔄 Refresh offices
                                  </button>
                                </div>
                                {selectedOffice && (
                                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-gray-700 space-y-1">
                                    <div>
                                      <span className="font-semibold">Office:</span>{" "}
                                      {selectedOffice.officeName ||
                                        selectedOffice.name ||
                                        "Office QR"}
                                    </div>
                                    {selectedOffice.officePhone && (
                                      <div>
                                        <span className="font-semibold">Phone:</span>{" "}
                                        {selectedOffice.officePhone}
                                      </div>
                                    )}
                                    <div>
                                      <span className="font-semibold">Address:</span>{" "}
                                      {selectedOffice.officeAddress ||
                                        "Address not set"}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Payment:</span>{" "}
                                      {String(
                                        selectedOffice.officePaymentMode || "ONLINE",
                                      ).toUpperCase() === "COD"
                                        ? "COD Only"
                                        : String(
                                              selectedOffice.officePaymentMode ||
                                                "ONLINE",
                                            ).toUpperCase() === "BOTH"
                                          ? "Online + COD"
                                        : "Online Only"}
                                    </div>
                                    {Number(selectedOffice.officeDeliveryCharge || 0) >
                                      0 && (
                                      <div>
                                        <span className="font-semibold">
                                          Delivery Charge:
                                        </span>{" "}
                                        ₹
                                        {formatMoney(
                                          Number(selectedOffice.officeDeliveryCharge || 0),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {draftServiceType === "DINE_IN" && (
                        <div>
                          <label className="block text-gray-700 text-sm font-semibold mb-2 flex items-center gap-2">
                            <img
                              src={tableIcon}
                              alt="Table"
                              className="w-5 h-5 object-contain"
                            />
                            Choose Table
                          </label>
                          <div className="flex flex-col md:flex-row md:items-center gap-3">
                            <select
                              value={selectedTableId}
                              onChange={(e) =>
                                setSelectedTableId(e.target.value)
                              }
                              className="shadow-sm border border-gray-300 rounded-lg w-full md:w-72 py-2 px-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            >
                              <option value="">Select a table</option>
                              {tablesForService.length === 0 ? (
                                <option value="" disabled>
                                  No available tables found
                                </option>
                              ) : (
                                tablesForService.map((table) => {
                                  const label = table.number
                                    ? `Table ${table.number}`
                                    : table.name || "Unnamed";
                                  const status = table.status || "UNKNOWN";
                                  // For DINE_IN: tables are already filtered to only available ones
                                  const isAvailable =
                                    status === "AVAILABLE" ||
                                    Boolean(table.sessionToken);
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
                                })
                              )}
                            </select>
                            <button
                              type="button"
                              onClick={loadTables}
                              className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                            >
                              🔄 Refresh tables
                            </button>
                          </div>
                          {tableLoading && (
                            <p className="text-xs text-gray-500 mt-1">
                              Loading tables…
                            </p>
                          )}
                          {!tableLoading &&
                            tablesForService.length === 0 &&
                            tables.length > 0 && (
                              <p className="text-xs text-yellow-600 mt-1">
                                ⚠️ No available tables found. All tables may be
                                occupied.
                              </p>
                            )}
                          {!tableLoading && tables.length === 0 && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ No tables found. Please add tables first or
                              refresh.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-gray-700 text-sm font-semibold mb-2">
                        Payment Type
                      </label>
                      <div className="flex items-center gap-2">
                        {[
                          { value: "COD", label: "COD" },
                          { value: "ONLINE", label: "Online" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setDraftPaymentType(option.value)}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium ${
                              draftPaymentType === option.value
                                ? "bg-blue-600 text-white border-blue-600 shadow"
                                : "border-gray-300 text-gray-600 hover:border-blue-400"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Select payment type before creating the order.
                      </p>
                    </div>

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
                            {menuCategories.map((category) => (
                              <button
                                type="button"
                                key={category.id}
                                onClick={() => setDraftCategory(category.id)}
                                className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full border transition whitespace-nowrap ${
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
                        <div className="border border-gray-200 rounded-lg max-h-60 sm:max-h-80 overflow-y-auto divide-y">
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
                                draftSelections[getItemKey(item)]?.quantity ||
                                0;
                              return (
                                <div
                                  key={getItemKey(item)}
                                  className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4 px-2 sm:px-3 md:px-4 py-2 sm:py-3 hover:bg-gray-50"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                                      {item.name}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                                      ₹{formatMoney(item.price)} ·{" "}
                                      {item.category}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        adjustItemQuantity(item, -1)
                                      }
                                      disabled={quantity === 0}
                                      className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                                    >
                                      -
                                    </button>
                                    <span className="w-6 sm:w-7 md:w-8 text-center text-xs sm:text-sm font-semibold text-gray-700">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        adjustItemQuantity(item, 1)
                                      }
                                      className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-4">
                          <h4 className="text-sm font-semibold text-gray-800 mb-2">
                            Add-ons
                          </h4>
                          <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y bg-gray-50/50">
                            {addonsLoading ? (
                              <div className="p-3 text-xs text-gray-500">
                                Loading add-ons…
                              </div>
                            ) : addonsError ? (
                              <div className="p-3 text-xs text-red-600">
                                {addonsError}
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
                      <div className="space-y-3 sm:space-y-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">
                            Order Summary
                          </h3>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                            <span>Service Type</span>
                            <span className="font-semibold text-gray-700">
                              {draftServiceType === "TAKEAWAY"
                                ? draftTakeawayMode === "OFFICE"
                                  ? "Office"
                                  : "Takeaway"
                                : "Dine-In"}
                            </span>
                          </div>
                          {draftItemsArray.length === 0 &&
                          draftAddonsArray.length === 0 ? (
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
                ) : (
                  <div className="space-y-6">
                    {/* Order Info Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label
                          htmlFor="tableNumber"
                          className="block text-gray-700 text-xs sm:text-sm font-bold mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2"
                        >
                          <img
                            src={tableIcon}
                            alt="Table"
                            className="w-4 h-4 sm:w-5 sm:h-5 object-contain"
                          />
                          Table Number
                        </label>
                        <input
                          type="text"
                          id="tableNumber"
                          name="tableNumber"
                          defaultValue={currentOrder?.tableNumber || ""}
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                          readOnly
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="status"
                          className="block text-gray-700 text-xs sm:text-sm font-bold mb-1 sm:mb-2"
                        >
                          Order Status{" "}
                          {getStatusIcon(currentOrder?.status || "Pending", currentOrder)}
                        </label>
                        <select
                          id="status"
                          name="status"
                          defaultValue={
                            normalizeLegacyOrderStatus(currentOrder?.status, currentOrder) ||
                            "Preparing"
                          }
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        >
                          <option value="Preparing">🔥 Preparing</option>
                          <option value="Ready">🍽️ Ready</option>
                          <option value="Served">🤝 Served</option>
                          <option value="Paid">✅ Paid</option>
                          <option value="Cancelled">❌ Cancelled</option>
                          <option value="Returned">↩️ Returned</option>
                        </select>
                      </div>
                    </div>

                    {/* Cancellation/Return Reason Display - Only for Cancelled or Returned orders */}
                    {currentOrder?.cancellationReason &&
                      (currentOrder?.status === "Cancelled" ||
                        currentOrder?.status === "Returned") && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4">
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

                    {/* Current Order Items Section */}
                    {currentOrder && !currentOrder.isNew && (
                      <div className="border-t pt-4 sm:pt-6">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">
                          Current Order Items
                        </h3>
                        {(() => {
                          // Get all items from kotLines with their indices
                          const allItems = [];
                          const kotLines = Array.isArray(currentOrder.kotLines)
                            ? currentOrder.kotLines
                            : [];
                          kotLines.forEach((kot, kotIndex) => {
                            const items = Array.isArray(kot.items)
                              ? kot.items
                              : [];
                            items.forEach((item, itemIndex) => {
                              if (!item.returned) {
                                allItems.push({
                                  kotIndex,
                                  itemIndex,
                                  name: item.name || "Item",
                                  quantity: item.quantity || 1,
                                  price: paiseToRupees(item.price || 0),
                                  isTakeaway: item.convertedToTakeaway === true,
                                  item,
                                });
                              }
                            });
                          });

                          const addonItems = (
                            Array.isArray(currentOrder.selectedAddons)
                              ? currentOrder.selectedAddons
                              : []
                          ).map((addon, addonIndex) => {
                            const quantity = Number(addon?.quantity) || 1;
                            const price = Number(addon?.price) || 0;
                            return {
                              addonIndex,
                              name: sanitizeAddonName(addon?.name),
                              quantity,
                              price,
                            };
                          });

                          if (allItems.length === 0 && addonItems.length === 0) {
                            return (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-500">
                                No active items or add-ons in this order.
                              </div>
                            );
                          }

                          const isPaid = currentOrder.status === "Paid";
                          const canModify = !["Cancelled", "Returned"].includes(
                            currentOrder.status || "",
                          );
                          const isCurrentOrderTakeaway =
                            isTakeawayServiceType(currentOrder?.serviceType) ||
                            Boolean(resolveTakeawayOrderType(currentOrder));

                          return (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <div className="overflow-x-auto -mx-3 sm:mx-0">
                                <div className="inline-block min-w-full align-middle">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                          Item
                                        </th>
                                        <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                          Qty
                                        </th>
                                        <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                          Price
                                        </th>
                                        <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                          Total
                                        </th>
                                        <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                                          Action
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {allItems.map((itemData, idx) => (
                                        <tr
                                          key={`${itemData.kotIndex}-${itemData.itemIndex}-${idx}`}
                                          className={`hover:bg-gray-50 ${
                                            itemData.isTakeaway
                                              ? "bg-green-50"
                                              : ""
                                          }`}
                                        >
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 min-w-[120px]">
                                            <span className="truncate block">
                                              {itemData.name}
                                            </span>
                                            {itemData.isTakeaway && (
                                              <span className="ml-1 sm:ml-2 text-green-600 font-semibold text-[10px] sm:text-xs whitespace-nowrap">
                                                📦 TAKEAWAY
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                            {itemData.quantity}
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                            ₹{formatMoney(itemData.price)}
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-800 whitespace-nowrap">
                                            ₹
                                            {formatMoney(
                                              itemData.price *
                                                itemData.quantity,
                                            )}
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                                            {canModify && (
                                              <div className="flex flex-wrap gap-1 sm:gap-2">
                                                {!isPaid ? (
                                                  <>
                                                    <button
                                                      type="button"
                                                      onClick={async () => {
                                                        // CRITICAL: window.confirm is now async, must await it
                                                        const confirmed =
                                                          await window.confirm(
                                                            `Cancel ${itemData.quantity}x ${itemData.name}?`,
                                                          );
                                                        if (confirmed) {
                                                          try {
                                                            await api.patch(
                                                              `/orders/${currentOrder._id}/return-items`,
                                                              {
                                                                itemIds: [
                                                                  {
                                                                    kotIndex:
                                                                      itemData.kotIndex,
                                                                    itemIndex:
                                                                      itemData.itemIndex,
                                                                  },
                                                                ],
                                                              },
                                                            );
                                                            alert(
                                                              "Item cancelled successfully!",
                                                            );
                                                            // Refresh order data
                                                            const res =
                                                              await api.get(
                                                                `/orders/${currentOrder._id}`,
                                                              );
                                                            setCurrentOrder(
                                                              normalizeOrderForDisplay(
                                                                res.data,
                                                                currentOrder,
                                                              ),
                                                            );
                                                            // Refresh orders list
                                                            await refreshOrders();
                                                          } catch (err) {
                                                            if (
                                                              import.meta.env
                                                                .DEV
                                                            ) {
                                                              console.error(
                                                                "Failed to cancel item:",
                                                                err,
                                                              );
                                                            }
                                                            const errorMessage =
                                                              err.response?.data
                                                                ?.message ||
                                                              "Failed to cancel item. Please try again.";
                                                            alert(errorMessage);
                                                          }
                                                        }
                                                      }}
                                                      className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-red-100 text-red-700 border border-red-300 rounded hover:bg-red-200 font-medium whitespace-nowrap"
                                                    >
                                                      ❌{" "}
                                                      <span className="hidden sm:inline">
                                                        Cancel
                                                      </span>
                                                    </button>
                                                    {!isCurrentOrderTakeaway &&
                                                      !itemData.isTakeaway && (
                                                        <button
                                                          type="button"
                                                          onClick={async () => {
                                                            // CRITICAL: window.confirm is now async, must await it
                                                            const confirmed =
                                                              await window.confirm(
                                                                `Convert ${itemData.quantity}x ${itemData.name} to takeaway?`,
                                                              );
                                                            if (confirmed) {
                                                              try {
                                                                await api.patch(
                                                                  `/orders/${currentOrder._id}/convert-to-takeaway`,
                                                                  {
                                                                    itemIds: [
                                                                      {
                                                                        kotIndex:
                                                                          itemData.kotIndex,
                                                                        itemIndex:
                                                                          itemData.itemIndex,
                                                                      },
                                                                    ],
                                                                  },
                                                                );
                                                                alert(
                                                                  "Item marked as takeaway in bill. Order remains as dine-in.",
                                                                );
                                                                // Refresh order data
                                                                const res =
                                                                  await api.get(
                                                                    `/orders/${currentOrder._id}`,
                                                                  );
                                                                setCurrentOrder(
                                                                  normalizeOrderForDisplay(
                                                                    res.data,
                                                                    currentOrder,
                                                                  ),
                                                                );
                                                                // Refresh orders list
                                                                await refreshOrders();
                                                              } catch (err) {
                                                                if (
                                                                  import.meta
                                                                    .env.DEV
                                                                ) {
                                                                  console.error(
                                                                    "Failed to convert item to takeaway:",
                                                                    err,
                                                                  );
                                                                }
                                                                const errorMessage =
                                                                  err.response
                                                                    ?.data
                                                                    ?.message ||
                                                                  "Failed to convert item to takeaway. Please try again.";
                                                                alert(
                                                                  errorMessage,
                                                                );
                                                              }
                                                            }
                                                          }}
                                                          className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200 font-medium whitespace-nowrap"
                                                        >
                                                          📦{" "}
                                                          <span className="hidden sm:inline">
                                                            Takeaway
                                                          </span>
                                                        </button>
                                                      )}
                                                  </>
                                                ) : (
                                                  !isCurrentOrderTakeaway &&
                                                  !itemData.isTakeaway && (
                                                    <button
                                                      type="button"
                                                      onClick={async () => {
                                                        // CRITICAL: window.confirm is now async, must await it
                                                        const confirmed =
                                                          await window.confirm(
                                                            `Convert ${itemData.quantity}x ${itemData.name} to takeaway?`,
                                                          );
                                                        if (confirmed) {
                                                          try {
                                                            await api.patch(
                                                              `/orders/${currentOrder._id}/convert-to-takeaway`,
                                                              {
                                                                itemIds: [
                                                                  {
                                                                    kotIndex:
                                                                      itemData.kotIndex,
                                                                    itemIndex:
                                                                      itemData.itemIndex,
                                                                  },
                                                                ],
                                                              },
                                                            );
                                                            alert(
                                                              "Item converted to takeaway successfully!",
                                                            );
                                                            // Refresh order data
                                                            const res =
                                                              await api.get(
                                                                `/orders/${currentOrder._id}`,
                                                              );
                                                            setCurrentOrder(
                                                              normalizeOrderForDisplay(
                                                                res.data,
                                                                currentOrder,
                                                              ),
                                                            );
                                                            // Refresh orders list
                                                            await refreshOrders();
                                                          } catch (err) {
                                                            console.error(
                                                              "Failed to convert item to takeaway:",
                                                              err,
                                                            );
                                                            const errorMessage =
                                                              err.response?.data
                                                                ?.message ||
                                                              "Failed to convert item to takeaway. Please try again.";
                                                            alert(errorMessage);
                                                          }
                                                        }
                                                      }}
                                                      className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200 font-medium whitespace-nowrap"
                                                    >
                                                      📦{" "}
                                                      <span className="hidden sm:inline">
                                                        Takeaway
                                                      </span>
                                                    </button>
                                                  )
                                                )}
                                              </div>
                                            )}
                                            {!canModify && (
                                              <span className="text-xs text-gray-400 italic">
                                                {currentOrder.status ===
                                                "Cancelled"
                                                  ? "Cancelled"
                                                  : currentOrder.status ===
                                                      "Returned"
                                                    ? "Returned"
                                                    : "N/A"}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                      {addonItems.map((addonData) => (
                                        <tr
                                          key={`addon-${addonData.addonIndex}`}
                                          className="hover:bg-blue-50"
                                        >
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 min-w-[120px]">
                                            <span className="truncate block">
                                              {addonData.name}
                                            </span>
                                            <span className="ml-1 sm:ml-2 text-blue-600 font-semibold text-[10px] sm:text-xs whitespace-nowrap">
                                              ADD-ON
                                            </span>
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                            {addonData.quantity}
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                                            {"\u20B9"}
                                            {formatMoney(addonData.price)}
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-800 whitespace-nowrap">
                                            {"\u20B9"}
                                            {formatMoney(
                                              addonData.price *
                                                addonData.quantity,
                                            )}
                                          </td>
                                          <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                                            {canModify && !isPaid ? (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleCancelAddonLine(
                                                    currentOrder._id,
                                                    addonData.addonIndex,
                                                  )
                                                }
                                                className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-red-100 text-red-700 border border-red-300 rounded hover:bg-red-200 font-medium whitespace-nowrap"
                                              >
                                                ❌{" "}
                                                <span className="hidden sm:inline">
                                                  Cancel
                                                </span>
                                              </button>
                                            ) : (
                                              <span className="text-xs text-gray-400 italic">
                                                {canModify ? "N/A" : "Locked"}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              <div className="bg-gray-50 px-3 sm:px-4 py-2 sm:py-3 border-t border-gray-200">
                                <p className="text-xs text-gray-600">
                                  {!isPaid ? (
                                    <>
                                      💡 <strong>Before Payment:</strong>{" "}
                                      {isCurrentOrderTakeaway
                                        ? "You can cancel individual items and add-ons from this takeaway order."
                                        : "You can cancel individual items and add-ons, or convert items to takeaway from this order."}
                                    </>
                                  ) : (
                                    <>
                                      💡 <strong>After Payment:</strong>{" "}
                                      {isCurrentOrderTakeaway
                                        ? "This is already a takeaway order."
                                        : "You can convert remaining items to takeaway for customers to carry home."}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Add Items Section */}
                    <div className="border-t pt-4 sm:pt-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">
                        Add Items to Order
                      </h3>
                      {currentOrder?.status === "Paid" ? (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800">
                            ⚠️ This order has been paid. Items cannot be added
                            to paid orders. Please create a new order instead.
                          </p>
                        </div>
                      ) : currentOrder?.status === "Cancelled" ||
                        currentOrder?.status === "Returned" ? (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800">
                            ⚠️ This order is {currentOrder.status.toLowerCase()}
                            . Items cannot be added.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 mb-4">
                          You can add more items to this order until payment is
                          completed. Selected items will be added to this order.
                        </p>
                      )}
                      {menuItems.length === 0 && !menuLoading && !menuError && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            Menu not loaded.{" "}
                            <button
                              type="button"
                              onClick={() => loadMenu(currentMenuCartId)}
                              className="text-blue-600 hover:text-blue-800 underline"
                            >
                              Click here to load menu
                            </button>
                          </p>
                        </div>
                      )}
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
                              {menuCategories.length > 0 ? (
                                menuCategories.map((category) => (
                                  <button
                                    type="button"
                                    key={category.id}
                                    onClick={() =>
                                      setDraftCategory(category.id)
                                    }
                                    className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm rounded-full border transition whitespace-nowrap ${
                                      draftCategory === category.id
                                        ? "bg-blue-600 text-white border-blue-600 shadow"
                                        : "border-gray-300 text-gray-600 hover:border-blue-400"
                                    }`}
                                  >
                                    {category.label}
                                  </button>
                                ))
                              ) : (
                                <span className="text-[10px] sm:text-xs text-gray-500 px-2">
                                  No categories available
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="border border-gray-200 rounded-lg max-h-60 sm:max-h-80 overflow-y-auto divide-y">
                            {menuLoading ? (
                              <div className="p-4 text-sm text-gray-500">
                                Loading menu…
                              </div>
                            ) : menuError ? (
                              <div className="p-4 text-sm text-red-600">
                                {menuError}
                                <button
                                  type="button"
                                  onClick={() => loadMenu(currentMenuCartId)}
                                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                                >
                                  Retry
                                </button>
                              </div>
                            ) : menuItems.length === 0 ? (
                              <div className="p-4 text-sm text-gray-500">
                                No menu items available. Please add items to the
                                menu first.
                              </div>
                            ) : filteredMenuItems.length === 0 ? (
                              <div className="p-4 text-sm text-gray-500">
                                No menu items match your filters. Try changing
                                the search or category.
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
                                  draftSelections[getItemKey(item)]?.quantity ||
                                  0;
                                return (
                                  <div
                                    key={getItemKey(item)}
                                    className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4 px-2 sm:px-3 md:px-4 py-2 sm:py-3 hover:bg-gray-50"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                                        {item.name}
                                      </div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                                        ₹{formatMoney(item.price)} ·{" "}
                                        {item.category}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          adjustItemQuantity(item, -1)
                                        }
                                        disabled={
                                          quantity === 0 ||
                                          currentOrder?.status === "Paid" ||
                                          currentOrder?.status ===
                                            "Cancelled" ||
                                          currentOrder?.status === "Returned"
                                        }
                                        className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                                      >
                                        -
                                      </button>
                                      <span className="w-6 sm:w-7 md:w-8 text-center text-xs sm:text-sm font-semibold text-gray-700">
                                        {quantity}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          adjustItemQuantity(item, 1)
                                        }
                                        disabled={
                                          currentOrder?.status === "Paid" ||
                                          currentOrder?.status ===
                                            "Cancelled" ||
                                          currentOrder?.status === "Returned"
                                        }
                                        className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <div className="mt-4">
                            <h4 className="text-sm font-semibold text-gray-800 mb-2">
                              Add-ons
                            </h4>
                            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y bg-gray-50/50">
                              {addonsLoading ? (
                                <div className="p-3 text-xs text-gray-500">
                                  Loading add-ons…
                                </div>
                              ) : addonsError ? (
                                <div className="p-3 text-xs text-red-600">
                                  {addonsError}
                                </div>
                              ) : addonList.length === 0 ? (
                                <div className="p-3 text-xs text-gray-500">
                                  No add-ons available.
                                </div>
                              ) : (
                                addonList.map((addon) => {
                                  const id = addon._id || addon.id;
                                  const quantity = draftAddonSelections[id] || 0;
                                  const isOrderFinal =
                                    currentOrder?.status === "Paid" ||
                                    currentOrder?.status === "Cancelled" ||
                                    currentOrder?.status === "Returned";

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
                                          disabled={quantity === 0 || isOrderFinal}
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
                                          disabled={isOrderFinal}
                                          className="w-8 h-8 flex items-center justify-center rounded-full border border-blue-500 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
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
                        <div className="space-y-3 sm:space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 sm:mb-3">
                              New Items Summary
                            </h3>
                            {currentOrder?.status === "Paid" ||
                            currentOrder?.status === "Cancelled" ||
                            currentOrder?.status === "Returned" ? (
                              <p className="text-xs sm:text-sm text-red-600 font-medium">
                                ⚠️ Cannot add items to{" "}
                                {currentOrder?.status.toLowerCase()} orders.
                                Items can only be added to unpaid orders.
                              </p>
                            ) : draftItemsArray.length === 0 &&
                              draftAddonsArray.length === 0 ? (
                              <p className="text-xs sm:text-sm text-gray-500">
                                No new items selected. Select items from the
                                menu to add them to this order.
                              </p>
                            ) : (
                              <>
                                <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700 mb-3 sm:mb-4">
                                  {draftItemsArray.map((entry) => (
                                    <div
                                      key={entry.id}
                                      className="flex justify-between items-center gap-2"
                                    >
                                      <span className="truncate min-w-0 flex-1">
                                        {entry.name} × {entry.quantity}
                                      </span>
                                      <span className="whitespace-nowrap flex-shrink-0">
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
                                      className="flex justify-between items-center gap-2"
                                    >
                                      <span className="truncate min-w-0 flex-1">
                                        {entry.name} × {entry.quantity}
                                      </span>
                                      <span className="whitespace-nowrap flex-shrink-0">
                                        ₹{formatMoney(entry.price * entry.quantity)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 sm:mt-4 space-y-1 text-xs sm:text-sm text-gray-600 border-t border-gray-300 pt-2 sm:pt-3">
                                  <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span>
                                      ₹{formatMoney(draftTotals.subtotal)}
                                    </span>
                                  </div>
                                  {draftTotals.addonsSubtotal > 0 && (
                                    <div className="flex justify-between">
                                      <span>Add-ons</span>
                                      <span>
                                        ₹{formatMoney(draftTotals.addonsSubtotal)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-semibold text-gray-800 pt-1.5 sm:pt-2 border-t border-gray-200">
                                    <span>Total</span>
                                    <span>
                                      ₹{formatMoney(draftTotals.total)}
                                    </span>
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
              </form>
            </div>
            <div className="p-3 sm:p-4 md:p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCurrentOrder(null);
                    resetDraft();
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg border border-gray-300 text-xs sm:text-sm md:text-base w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="order-form"
                  disabled={currentOrder?.isNew ? createSubmitting : false}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-xs sm:text-sm md:text-base w-full sm:w-auto"
                >
                  {currentOrder?.isNew
                    ? createSubmitting
                      ? "Creating..."
                      : "Create Order"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Reason Modal */}
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
              >
                ✕
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
                Confirm{" "}
                {reasonModal.status === "Cancelled" ? "Cancel" : "Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;

