import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createSocketConnection } from "../utils/socket";
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
const computeKotTotals = (kotLines = [], aggregatedItems = [], order = null) => {
  // Calculate subtotal from non-returned items (amount is already in rupees)
  const subtotal = aggregatedItems.reduce((sum, item) => {
    const amount = Number(item.amount) || 0;
    return sum + amount;
  }, 0);

  // Round subtotal to 2 decimal places
  const subtotalRounded = Number(subtotal.toFixed(2));

  // Calculate GST (5%)
  const gst = Number((subtotalRounded * 0.05).toFixed(2));

  // Add delivery charge if applicable
  const deliveryCharge = order?.orderType === "DELIVERY" && order?.deliveryInfo?.deliveryCharge
    ? Number(order.deliveryInfo.deliveryCharge) || 0
    : 0;

  // Calculate total amount (subtotal + GST + delivery charge)
  const totalAmount = Number((subtotalRounded + gst + deliveryCharge).toFixed(2));

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
  const aggregatedItems = aggregateKotItems(kotLines);
  const totals = computeKotTotals(kotLines, aggregatedItems, order);

  // Get cart address (prefer address, fallback to location)
  const cartAddress = cartData?.address || "—";
  // Get franchise GST number
  const franchiseGST = franchiseData?.gstNumber || "—";

  // Payment mode display (fallback to CASH if not available on order)
  const paymentMethod =
    order.paymentMethod ||
    order.paymentMode ||
    (order.payment && order.payment.method) ||
    "CASH";

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
                <td class="py-2 border-b text-right">₹${formatMoney(
                  amount
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
        ${
          order.serviceType === "TAKEAWAY" && order.takeawayToken
            ? `<div style="font-size: 9px; margin-bottom: 8px; font-weight: bold;">Token: ${order.takeawayToken}</div>`
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
                  order.takeawayToken ? ` - Token: ${order.takeawayToken}` : ""
                }
              </div>
              ${
                order.customerName
                  ? `<div style="font-size: 9px; margin-top: 2px;">Customer: ${
                      order.customerName
                    }${
                      order.customerMobile ? ` (${order.customerMobile})` : ""
                    }</div>`
                  : ""
              }
              ${
                order.orderType === "PICKUP" && order.pickupLocation
                  ? `<div style="font-size: 9px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc;">
                      <div style="font-weight: 600;">Pickup Location:</div>
                      <div>${order.pickupLocation.address || "Address not set"}</div>
                    </div>`
                  : ""
              }
              ${
                order.orderType === "DELIVERY" && order.customerLocation
                  ? `<div style="font-size: 9px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #ccc;">
                      <div style="font-weight: 600;">Delivery Address:</div>
                      <div>${order.customerLocation.address || "Address not set"}</div>
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
                      <div style="font-style: italic;">${order.specialInstructions}</div>
                    </div>`
                  : ""
              }
            `
            : `
              <div style="font-size: 9px;">
                ${order.tableNumber || ""}
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
          <div class="invoice-line">
            <span>GST (5%)</span>
            <span>₹${formatMoney(totals.gst)}</span>
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
            <span>${String(paymentMethod).toUpperCase()}</span>
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

  // For takeaway orders in cart admin panel, avoid extra user lookups that can 403
  // due to access-control on /users/:id. Use the order data only.
  const html = buildInvoiceMarkup(order, null, null);
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
    document.body.removeChild(wrapper);
    alert("Failed to render invoice for download.");
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, "auto"],
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

    pdf.addImage(imageData, "PNG", margin, position, usableWidth, imgHeight);
    heightLeft -= pdfHeight - margin * 2;

    while (heightLeft > 0) {
      pdf.addPage();
      position = margin - heightLeft;
      pdf.addImage(imageData, "PNG", margin, position, usableWidth, imgHeight);
      heightLeft -= pdfHeight - margin * 2;
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
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [draftSelections, setDraftSelections] = useState({});
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

  const socketRef = React.useRef(null);
  const upsertOrder = React.useCallback(
    (incoming, { prepend = false } = {}) => {
      if (import.meta.env.DEV) {
        console.log("[TakeawayOrders] upsertOrder called with:", incoming);
      }
      if (!incoming) {
        if (import.meta.env.DEV) {
          console.log(
            "[TakeawayOrders] upsertOrder: incoming is null/undefined"
          );
        }
        return;
      }
      if (incoming.serviceType !== "TAKEAWAY") {
        if (import.meta.env.DEV) {
          console.log(
            `[TakeawayOrders] upsertOrder: filtering out order - serviceType is ${incoming.serviceType}, expected TAKEAWAY`
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
          `[TakeawayOrders] upsertOrder: processing takeaway order ${incomingId}`
        );
      }

      setOrders((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const index = list.findIndex(
          (order) => normalizeId(order._id) === incomingId
        );

        if (index >= 0) {
          if (import.meta.env.DEV) {
            console.log(
              `[TakeawayOrders] upsertOrder: updating existing order at index ${index}`
            );
          }
          list[index] = incoming;
          return list;
        }

        if (import.meta.env.DEV) {
          console.log(
            `[TakeawayOrders] upsertOrder: adding new order (prepend: ${prepend})`
          );
        }
        return prepend ? [incoming, ...list] : [...list, incoming];
      });
    },
    [setOrders]
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
            `[TakeawayOrders] Parsed ${data.length} total orders from response`
          );
        }

        if (!active) return;

        // Filter for takeaway orders only
        const takeawayOrders = (data || []).filter((order) => {
          if (!order) return false;
          const isTakeaway = order.serviceType === "TAKEAWAY";
          if (import.meta.env.DEV && !isTakeaway) {
            console.log(
              `[TakeawayOrders] Order ${order._id} filtered out - serviceType: ${order.serviceType}`
            );
          }
          return isTakeaway;
        });

        if (import.meta.env.DEV) {
          console.log(
            `[TakeawayOrders] Fetched ${takeawayOrders.length} takeaway orders out of ${data.length} total orders`
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
              "Authentication failed - user may need to login again"
            );
          } else if (err.response?.status === 403) {
            console.warn("Access denied - user may not have permission");
          }
        }
      }
    };

    fetchOrders();
    loadMenu();

    const socket = createSocketConnection();
    socketRef.current = socket;

    const handleNewOrder = (order) => {
      if (import.meta.env.DEV) {
        console.log("[TakeawayOrders] Socket: newOrder event received:", order);
      }
      upsertOrder(order, { prepend: true });
    };

    const handleOrderUpdated = (order) => {
      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Socket: orderUpdated event received:",
          order
        );
      }
      upsertOrder(order);
    };

    const handleOrderDeleted = ({ id }) => {
      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Socket: orderDeleted event received:",
          id
        );
      }
      // Remove the order from the list if it exists
      setOrders((prev) =>
        prev.filter((order) => {
          const orderId = normalizeId(order._id);
          const deletedId = normalizeId(id);
          return orderId !== deletedId;
        })
      );
    };

    // Listen for new Socket.IO events (room-based)
    const handleOrderCreated = (order) => {
      console.log(
        "[TakeawayOrders] Socket: order:created event received:",
        order
      );
      upsertOrder(order, { prepend: true });
    };

    const handleOrderStatusUpdated = (order) => {
      console.log(
        "[TakeawayOrders] Socket: order:status:updated event received:",
        order
      );
      upsertOrder(order);
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderUpdated", handleOrderUpdated);
    socket.on("orderDeleted", handleOrderDeleted);
    socket.on("order:created", handleOrderCreated);
    socket.on("order:status:updated", handleOrderStatusUpdated);

    // Join cafe room for real-time updates (if user is logged in)
    let token = null;
    try {
      token =
        localStorage.getItem("adminToken") ||
        localStorage.getItem("franchiseAdminToken") ||
        localStorage.getItem("superAdminToken");
    } catch (storageError) {
      if (import.meta.env.DEV) {
        console.warn(
          "[TakeawayOrders] Error reading from localStorage:",
          storageError
        );
      }
    }

    if (token) {
      try {
        // Decode token to get user info (basic decode, not verification)
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.id;
        if (userId) {
          socket.emit("join:cafe", userId);
          if (import.meta.env.DEV) {
            console.log("[TakeawayOrders] Socket: Joined cafe room:", userId);
          }
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn(
            "[TakeawayOrders] Could not decode token for socket room:",
            e
          );
        }
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
  }, [loadMenu]); // Load once on mount

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
    [draftSelections]
  );

  const draftTotals = useMemo(() => {
    if (!Array.isArray(draftItemsArray)) {
      return { subtotal: 0, gst: 0, total: 0, totalItems: 0 };
    }
    const subtotal = draftItemsArray.reduce((sum, entry) => {
      if (!entry) return sum;
      return sum + (Number(entry.price) || 0) * (Number(entry.quantity) || 0);
    }, 0);
    const gst = subtotal * 0.05;
    const total = subtotal + gst;
    const totalItems = draftItemsArray.reduce((sum, entry) => {
      if (!entry) return sum;
      return sum + (Number(entry.quantity) || 0);
    }, 0);
    return {
      subtotal,
      gst,
      total,
      totalItems,
    };
  }, [draftItemsArray]);

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

  const changeStatus = async (orderId, newStatus) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: newStatus,
      });
      upsertOrder(response.data);
    } catch (e) {
      console.error("Status change failed:", e);
      const errorMessage =
        e.response?.data?.message || e.message || "Status update failed";
      alert(`Failed to change status: ${errorMessage}`);
    }
  };

  const handleNewTakeawayOrder = () => {
    setDraftSelections({});
    setCurrentOrder({
      serviceType: "TAKEAWAY",
      status: "Confirmed",
      isNew: true,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (order) => {
    // Reset draft selections each time we open the modal
    setDraftSelections({});
    setCurrentOrder({ ...order, isNew: false });
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
        const requestType = `takeaway-status-${currentOrder._id}`;
        await withCancellation(requestType, async (signal) => {
          return await api.patch(
            `/orders/${currentOrder._id}/status`,
            { status: newStatus },
            { signal }
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

      // Refresh orders list by fetching again
      const ordersRes = await api.get("/orders");
      const allOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      const takeawayOrders = allOrders.filter(
        (o) => o.serviceType === "TAKEAWAY"
      );

      setOrders(takeawayOrders);

      setIsModalOpen(false);
      setCurrentOrder(null);
      setDraftSelections({});
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

      const payload = {
        serviceType: "TAKEAWAY",
        items: itemsPayload,
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
        (o) => o && o.serviceType === "TAKEAWAY"
      );

      if (import.meta.env.DEV) {
        console.log(
          "[TakeawayOrders] Filtered takeaway orders:",
          takeawayOrders.length
        );
      }
      setOrders(takeawayOrders);

      setIsModalOpen(false);
      setCurrentOrder(null);
      setDraftSelections({});
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
        `Cannot cancel items from an order that is ${order.status.toLowerCase()}.`
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
      }
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
    if (!Array.isArray(orders) || orders.length === 0) {
      return { total: 0, byStatus: {} };
    }
    return orders.reduce(
      (acc, order) => {
        if (!order) return acc;
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
        const orderDate = new Date(order.createdAt);
        const filterDateObj = new Date(filterDate);
        // Compare dates (ignore time)
        const orderDateStr = orderDate.toISOString().split("T")[0];
        const filterDateStr = filterDateObj.toISOString().split("T")[0];
        dateMatch = orderDateStr === filterDateStr;
      }

      return orderIdMatch && tableMatch && invoiceMatch && dateMatch;
    });

    if (filterStatus === "all") return matches;
    return matches.filter((order) => order.status === filterStatus);
  }, [
    orders,
    searchOrderId,
    searchTable,
    searchInvoice,
    filterStatus,
    filterDate,
  ]);

  const tryAccept = (order) => {
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
              onClick={handleNewTakeawayOrder}
              className="flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm md:text-base hover:bg-blue-700 whitespace-nowrap"
            >
              ➕ <span className="hidden xs:inline">New Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`p-2 sm:p-3 md:p-4 rounded-lg border shadow-sm text-left transition outline-none hover:shadow-md ${
            filterStatus === "all" ? "ring-2 ring-blue-400" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold truncate">
                {statusSummary.total}
              </div>
              <div className="text-[10px] sm:text-xs md:text-sm truncate">
                All Takeaway
              </div>
            </div>
            <div className="text-base sm:text-lg md:text-xl lg:text-2xl flex-shrink-0">
              🥡
            </div>
          </div>
        </button>

        {Object.entries(statusSummary.byStatus || {}).map(([status, count]) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`p-2 sm:p-3 md:p-4 rounded-lg border shadow-sm text-left transition outline-none hover:shadow-md ${
              filterStatus === status ? "ring-2 ring-blue-400" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-1 sm:gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold truncate">
                  {count}
                </div>
                <div className="text-[10px] sm:text-xs md:text-sm truncate">
                  {status}
                </div>
              </div>
              <div className="text-base sm:text-lg md:text-xl lg:text-2xl flex-shrink-0">
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
              <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
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

              const orderDate = new Date(order.createdAt);
              const formattedDate = orderDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });
              const formattedTime = orderDate.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <React.Fragment key={order._id}>
                  <tr
                    className={`hover:bg-gray-50 ${
                      order.status === "Pending" ? "bg-orange-50" : ""
                    }`}
                  >
                    <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm">
                      <button
                        onClick={() => toggleExpand(order._id)}
                        className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 md:gap-2 w-full sm:w-auto"
                      >
                        <span className="font-mono text-[9px] sm:text-[10px] md:text-xs text-gray-500 truncate">
                          {buildInvoiceId(order)}
                        </span>
                        <span className="text-gray-900 font-medium text-[10px] sm:text-xs md:text-sm">
                          {formattedTime}
                        </span>
                      </button>
                      {expanded[order._id] && (
                        <div className="mt-2 text-[9px] sm:text-[10px] md:text-xs text-gray-600 space-y-0.5 sm:space-y-1">
                          <div className="truncate">
                            Created:{" "}
                            {new Date(order.createdAt).toLocaleString()}
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
                          {order.takeawayToken && (
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
                                    📍 {order.pickupLocation.address || "Address not set"}
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
                                    <div>📍 {order.customerLocation.address || "Address not set"}</div>
                                    {order.deliveryInfo && (
                                      <div className="mt-1 pt-1 border-t border-green-200">
                                        <div>📏 Distance: {order.deliveryInfo.distance?.toFixed(2) || "N/A"} km</div>
                                        {order.deliveryInfo.deliveryCharge > 0 && (
                                          <div className="text-green-700 font-semibold">
                                            💰 Delivery Charge: ₹{order.deliveryInfo.deliveryCharge.toFixed(2)}
                                          </div>
                                        )}
                                        {order.deliveryInfo.estimatedTime && (
                                          <div>⏱️ Est. Time: {order.deliveryInfo.estimatedTime} min</div>
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
                          {order.sessionToken && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="font-semibold text-gray-800">
                                Session Code:
                              </div>
                              <div className="font-mono text-xs break-all">
                                {order.sessionToken}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-600 hidden md:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-gray-900 text-xs sm:text-sm">
                          {formattedDate}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-500">
                          {formattedTime}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg sm:text-xl md:text-2xl flex-shrink-0">
                            🥡
                          </span>
                          <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold text-gray-700 truncate">
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
                                  📏 {order.deliveryInfo.distance.toFixed(2)}{" "}
                                  km away
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
                        {order.takeawayToken && (
                          <div className="text-sm mt-2 font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                            Token: {order.takeawayToken}
                          </div>
                        )}
                        {order.sessionToken && (
                          <div className="text-[10px] sm:text-xs text-gray-500 mt-1 font-mono bg-gray-50 px-2 py-1 rounded truncate">
                            Session: {order.sessionToken.substring(0, 20)}...
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3">
                      <div className="flex flex-col gap-1 sm:gap-1.5 md:gap-2">
                        <span
                          className={`px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 inline-flex items-center gap-0.5 sm:gap-1 md:gap-2 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium rounded-full border ${statusBadgeClass(
                            order.status
                          )}`}
                        >
                          <span className="text-[10px] sm:text-xs md:text-sm">
                            {getStatusIcon(order.status)}
                          </span>
                          <span className="truncate">{order.status}</span>
                        </span>
                        <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                          {(() => {
                            const nextStatus = getNextStatus(
                              order.status,
                              order.serviceType
                            );
                            const buttons = [];

                            if (canAccept(order.status)) {
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
                                </button>
                              );
                            }

                            // Show next sequential step button (but skip if canAccept is true to avoid duplicate Preparing button)
                            if (nextStatus && !canAccept(order.status)) {
                              buttons.push(
                                <button
                                  key="next"
                                  onClick={() =>
                                    changeStatus(order._id, nextStatus)
                                  }
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50 truncate max-w-[90px] sm:max-w-none"
                                >
                                  {nextStatus}
                                </button>
                              );
                            }

                            if (canReturn(order.status)) {
                              buttons.push(
                                <button
                                  key="return"
                                  onClick={() =>
                                    changeStatus(order._id, "Returned")
                                  }
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50 whitespace-nowrap"
                                >
                                  ↩️{" "}
                                  <span className="hidden sm:inline">
                                    Return
                                  </span>
                                </button>
                              );
                            } else if (canCancel(order.status)) {
                              buttons.push(
                                <button
                                  key="cancel"
                                  onClick={() =>
                                    changeStatus(order._id, "Cancelled")
                                  }
                                  className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] md:text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
                                >
                                  ❌{" "}
                                  <span className="hidden sm:inline">
                                    Cancel
                                  </span>
                                </button>
                              );
                            }

                            return buttons;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-xs sm:text-sm">
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

                  {expanded[order._id] && (
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="px-6 py-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Array.isArray(order?.kotLines)
                              ? order.kotLines
                              : []
                            ).map((kot, idx) => {
                              if (!kot) return null;
                              return (
                                <div
                                  key={idx}
                                  className="bg-white p-4 rounded-lg border shadow-sm"
                                >
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="text-lg font-semibold text-gray-800">
                                      KOT #{idx + 1}
                                    </div>
                                    <div className="text-lg font-bold text-green-600">
                                      ₹
                                      {(
                                        kot.totalAmount ||
                                        kot.total ||
                                        0
                                      ).toString()}
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    {(Array.isArray(kot?.items)
                                      ? kot.items
                                      : []
                                    ).map((item, i) => {
                                      if (!item) return null;
                                      return (
                                        <div
                                          key={i}
                                          className={`flex justify-between items-center py-2 border-b ${
                                            item.returned
                                              ? "opacity-50 bg-gray-100"
                                              : ""
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 flex-1">
                                            <span
                                              className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                item.returned
                                                  ? "bg-red-100 text-red-700"
                                                  : "bg-amber-100 text-amber-700"
                                              }`}
                                            >
                                              {item.quantity}x
                                            </span>
                                            <span
                                              className={`text-gray-800 ${
                                                item.returned
                                                  ? "line-through"
                                                  : ""
                                              }`}
                                            >
                                              {item.name}
                                            </span>
                                            {item.returned && (
                                              <span className="text-xs text-red-600 font-semibold">
                                                (Cancelled)
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`text-gray-600 ${
                                                item.returned
                                                  ? "line-through"
                                                  : ""
                                              }`}
                                            >
                                              ₹
                                              {(
                                                ((item.price || 0) / 100) *
                                                (item.quantity || 1)
                                              ).toFixed(2)}
                                            </span>
                                            {!item.returned &&
                                              order.status !== "Paid" &&
                                              order.status !== "Cancelled" &&
                                              order.status !== "Returned" && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleCancelItem(
                                                      order._id,
                                                      idx,
                                                      i
                                                    )
                                                  }
                                                  className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 transition-colors"
                                                  title="Cancel this item"
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
                            })}
                          </div>
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
                                new Set(menuItems.map((it) => it.category))
                              ).map((category) => (
                                <button
                                  type="button"
                                  key={category || "uncategorized"}
                                  onClick={() =>
                                    setDraftCategory(
                                      category || "Uncategorized"
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
                        </div>
                        <div className="space-y-4">
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h3 className="text-md font-semibold text-gray-800 mb-3">
                              Order Summary
                            </h3>
                            {draftItemsArray.length === 0 ? (
                              <p className="text-sm text-gray-500">
                                No items selected yet. Use the menu on the left
                                to build the order.
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
                                        entry.price * entry.quantity
                                      )}
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

                    {/* Current Order Items section - with cancel option */}
                    <div className="border-t border-gray-200 pt-4 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Current Order Items
                      </h3>
                      {!currentOrder?.kotLines ||
                      currentOrder.kotLines.length === 0 ? (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                          No items in this order yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(Array.isArray(currentOrder?.kotLines)
                            ? currentOrder.kotLines
                            : []
                          ).map((kot, kotIdx) => {
                            if (!kot) return null;
                            return (
                              <div
                                key={kotIdx}
                                className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                              >
                                <div className="flex justify-between items-center mb-3">
                                  <div className="text-sm font-semibold text-gray-700">
                                    KOT #{kotIdx + 1}
                                  </div>
                                  <div className="text-sm font-bold text-green-600">
                                    ₹
                                    {(
                                      kot.totalAmount ||
                                      kot.total ||
                                      0
                                    ).toString()}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {(Array.isArray(kot?.items)
                                    ? kot.items
                                    : []
                                  ).map((item, itemIdx) => {
                                    if (!item) return null;
                                    return (
                                      <div
                                        key={itemIdx}
                                        className={`flex justify-between items-center py-2 px-3 rounded border ${
                                          item.returned
                                            ? "bg-red-50 border-red-200 opacity-60"
                                            : "bg-white border-gray-200"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 flex-1">
                                          <span
                                            className={`px-2 py-1 rounded text-xs font-bold ${
                                              item.returned
                                                ? "bg-red-100 text-red-700"
                                                : "bg-amber-100 text-amber-700"
                                            }`}
                                          >
                                            {item.quantity}x
                                          </span>
                                          <span
                                            className={`text-sm text-gray-800 ${
                                              item.returned
                                                ? "line-through"
                                                : ""
                                            }`}
                                          >
                                            {item.name}
                                          </span>
                                          {item.returned && (
                                            <span className="text-xs text-red-600 font-semibold">
                                              (Cancelled)
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span
                                            className={`text-sm text-gray-600 ${
                                              item.returned
                                                ? "line-through"
                                                : ""
                                            }`}
                                          >
                                            ₹
                                            {(
                                              ((item.price || 0) / 100) *
                                              (item.quantity || 1)
                                            ).toFixed(2)}
                                          </span>
                                          {!item.returned &&
                                            currentOrder.status !== "Paid" &&
                                            currentOrder.status !==
                                              "Cancelled" &&
                                            currentOrder.status !==
                                              "Returned" && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleCancelItem(
                                                    currentOrder._id,
                                                    kotIdx,
                                                    itemIdx
                                                  )
                                                }
                                                className="px-2 py-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 transition-colors"
                                                title="Cancel this item"
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
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add items section (Modify Order logic) */}
                    <div className="border-t border-gray-200 pt-4 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Add Items to Takeaway Order
                      </h3>
                      {["Paid", "Cancelled", "Returned"].includes(
                        currentOrder?.status || ""
                      ) ? (
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                          You cannot add items to this order because it is{" "}
                          <strong>{currentOrder?.status}</strong>. Items can
                          only be added to unpaid takeaway orders.
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-gray-500">
                            Select items from the menu below to add more items
                            to this takeaway order. These will be added as a new
                            KOT.
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
                                    new Set(menuItems.map((it) => it.category))
                                  ).map((category) => (
                                    <button
                                      type="button"
                                      key={category || "uncategorized"}
                                      onClick={() =>
                                        setDraftCategory(
                                          category || "Uncategorized"
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
                            </div>
                            <div className="space-y-4">
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                <h3 className="text-md font-semibold text-gray-800 mb-3">
                                  New Items Summary
                                </h3>
                                {draftItemsArray.length === 0 ? (
                                  <p className="text-sm text-gray-500">
                                    No items selected yet. Use the menu on the
                                    left to add items.
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
                                            entry.price * entry.quantity
                                          )}
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
                                  <div className="flex justify-between">
                                    <span>GST (5%)</span>
                                    <span>₹{formatMoney(draftTotals.gst)}</span>
                                  </div>
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
    </div>
  );
};

export default TakeawayOrders;
