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
      console.log("[TakeawayOrders] upsertOrder called with:", incoming);
      if (!incoming) {
        console.log("[TakeawayOrders] upsertOrder: incoming is null/undefined");
        return;
      }
      if (incoming.serviceType !== "TAKEAWAY") {
        console.log(
          `[TakeawayOrders] upsertOrder: filtering out order - serviceType is ${incoming.serviceType}, expected TAKEAWAY`
        );
        return;
      }
      const incomingId = normalizeId(incoming._id);
      if (!incomingId) {
        console.log("[TakeawayOrders] upsertOrder: no order ID found");
        return;
      }

      console.log(
        `[TakeawayOrders] upsertOrder: processing takeaway order ${incomingId}`
      );

      setOrders((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const index = list.findIndex(
          (order) => normalizeId(order._id) === incomingId
        );

        if (index >= 0) {
          console.log(
            `[TakeawayOrders] upsertOrder: updating existing order at index ${index}`
          );
          list[index] = incoming;
          return list;
        }

        console.log(
          `[TakeawayOrders] upsertOrder: adding new order (prepend: ${prepend})`
        );
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
      data.forEach((cat) => {
        (cat.items || []).forEach((item) => {
          items.push({
            ...item,
            category: cat.name || item.category || "Uncategorized",
          });
        });
      });

      setMenuItems(items);
    } catch (err) {
      console.error("Failed to load menu for takeaway modify flow", err);
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
        console.log("[TakeawayOrders] API Response:", res);
        console.log("[TakeawayOrders] Response data:", res.data);

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

        console.log(
          `[TakeawayOrders] Parsed ${data.length} total orders from response`
        );

        if (!active) return;

        // Filter for takeaway orders only
        const takeawayOrders = data.filter((order) => {
          const isTakeaway = order.serviceType === "TAKEAWAY";
          if (!isTakeaway) {
            console.log(
              `[TakeawayOrders] Order ${order._id} filtered out - serviceType: ${order.serviceType}`
            );
          }
          return isTakeaway;
        });

        console.log(
          `[TakeawayOrders] Fetched ${takeawayOrders.length} takeaway orders out of ${data.length} total orders`
        );
        console.log(`[TakeawayOrders] Takeaway orders:`, takeawayOrders);
        setOrders(takeawayOrders);
      } catch (err) {
        console.error("Failed to load takeaway orders:", err);
        console.error("Error details:", err.response?.data || err.message);
        // Show user-friendly error message
        if (err.response?.status === 401) {
          console.warn("Authentication failed - user may need to login again");
        } else if (err.response?.status === 403) {
          console.warn("Access denied - user may not have permission");
        }
      }
    };

    fetchOrders();
    loadMenu();

    const socket = createSocketConnection();
    socketRef.current = socket;

    const handleNewOrder = (order) => {
      console.log("[TakeawayOrders] Socket: newOrder event received:", order);
      upsertOrder(order, { prepend: true });
    };

    const handleOrderUpdated = (order) => {
      console.log(
        "[TakeawayOrders] Socket: orderUpdated event received:",
        order
      );
      upsertOrder(order);
    };

    const handleOrderDeleted = ({ id }) => {
      console.log("[TakeawayOrders] Socket: orderDeleted event received:", id);
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
    const token =
      localStorage.getItem("adminToken") ||
      localStorage.getItem("franchiseAdminToken") ||
      localStorage.getItem("superAdminToken");
    if (token) {
      try {
        // Decode token to get user info (basic decode, not verification)
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.id;
        if (userId) {
          socket.emit("join:cafe", userId);
          console.log("[TakeawayOrders] Socket: Joined cafe room:", userId);
        }
      } catch (e) {
        console.warn(
          "[TakeawayOrders] Could not decode token for socket room:",
          e
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
  }, [loadMenu]); // Load once on mount

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
        await api.patch(`/orders/${currentOrder._id}/status`, {
          status: newStatus,
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
      console.error("Save failed:", err);
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

      console.log("[TakeawayOrders] Creating order with payload:", payload);
      console.log("[TakeawayOrders] Items count:", itemsPayload.length);

      const res = await api.post("/orders", payload);
      const created = res.data;

      console.log("[TakeawayOrders] Order created successfully:", created);

      // Refresh takeaway orders list
      const ordersRes = await api.get("/orders");
      console.log("[TakeawayOrders] Refreshed orders list:", ordersRes.data);

      // Handle both response formats
      let allOrders = [];
      if (Array.isArray(ordersRes.data)) {
        allOrders = ordersRes.data;
      } else if (ordersRes.data && Array.isArray(ordersRes.data.data)) {
        allOrders = ordersRes.data.data;
      }

      const takeawayOrders = allOrders.filter(
        (o) => o.serviceType === "TAKEAWAY"
      );

      console.log(
        "[TakeawayOrders] Filtered takeaway orders:",
        takeawayOrders.length
      );
      setOrders(takeawayOrders);

      setIsModalOpen(false);
      setCurrentOrder(null);
      setDraftSelections({});
      alert("Takeaway order created successfully!");
    } catch (err) {
      console.error("Failed to create takeaway order", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to create takeaway order. Please try again.";
      alert(`Error: ${errorMessage}\n\nCheck console for details.`);
    }
  };

  const handleDelete = async (e, orderId) => {
    e.preventDefault();
    e.stopPropagation();

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      "Are you sure you want to PERMANENTLY DELETE this takeaway order?\n\nThis action cannot be undone.",
      {
        title: "Delete Takeaway Order",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch (err) {
      console.error("Delete failed:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Failed to delete order";
      alert(errorMessage);
    }
  };

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
      console.error("Cancel item failed:", err);
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
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-40"
            title="Filter by order date"
          />
          <button
            onClick={() => {
              setSearchOrderId("");
              setSearchTable("");
              setSearchInvoice("");
              setFilterDate("");
            }}
            className="border border-gray-200 text-gray-600 hover:bg-gray-100 py-2 px-3 rounded-lg text-sm"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleNewTakeawayOrder}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-blue-700"
          >
            ➕ New Takeaway Order
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
                Date & Time
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
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                  No takeaway orders match the current filters.
                </td>
              </tr>
            )}
            {filteredOrders.map((order) => {
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
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => toggleExpand(order._id)}
                        className="flex items-center gap-2"
                      >
                        <span className="font-mono text-xs text-gray-500">
                          {buildInvoiceId(order)}
                        </span>
                        <span className="text-gray-900 font-medium">
                          {formattedTime}
                        </span>
                      </button>
                      {expanded[order._id] && (
                        <div className="mt-2 text-xs text-gray-600 space-y-1">
                          <div>
                            Created:{" "}
                            {new Date(order.createdAt).toLocaleString()}
                          </div>
                          <div>
                            Invoice:{" "}
                            <span className="font-mono">
                              {buildInvoiceId(order)}
                            </span>
                          </div>
                          <div>Service Type: Takeaway</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">
                          {formattedDate}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formattedTime}
                        </span>
                      </div>
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
                          className={`px-3 py-1 inline-flex items-center gap-2 text-sm font-medium rounded-full border ${statusBadgeClass(
                            order.status
                          )}`}
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
                                  onClick={() =>
                                    changeStatus(order._id, nextStatus)
                                  }
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
                                  onClick={() =>
                                    changeStatus(order._id, "Returned")
                                  }
                                  className="px-3 py-1 text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50"
                                >
                                  ↩️ Return Order
                                </button>
                              );
                            } else if (canCancel(order.status)) {
                              buttons.push(
                                <button
                                  key="cancel"
                                  onClick={() =>
                                    changeStatus(order._id, "Cancelled")
                                  }
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
                        {/* Modify Order button - only show for unpaid orders */}
                        {order.status !== "Paid" &&
                          order.status !== "Cancelled" &&
                          order.status !== "Returned" && (
                            <button
                              onClick={() => handleEdit(order)}
                              className="px-3 py-1 text-blue-600 hover:text-blue-900 border border-blue-200 rounded-md hover:bg-blue-50 font-medium"
                              title="Add more items to this takeaway order"
                            >
                              ➕ Modify Order
                            </button>
                          )}
                        <button
                          onClick={() => handleEdit(order)}
                          className="px-3 py-1 text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded-md hover:bg-indigo-50"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, order._id)}
                          className="px-3 py-1 text-red-600 hover:text-red-900 border border-red-200 rounded-md hover:bg-red-50"
                        >
                          🗑️ Delete
                        </button>
                        <button
                          onClick={() => printOrderInvoice(order)}
                          className="px-3 py-1 rounded-md border text-gray-700 border-gray-200 hover:bg-gray-100"
                          title="Print invoice"
                        >
                          🖨️ Print
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expanded[order._id] && (
                    <tr className="bg-gray-50">
                      <td colSpan="5" className="px-6 py-4">
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
                                    ₹
                                    {(
                                      kot.totalAmount ||
                                      kot.total ||
                                      0
                                    ).toString()}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {(kot.items || []).map((item, i) => (
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
                                            item.returned ? "line-through" : ""
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
                                            item.returned ? "line-through" : ""
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
            })}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl m-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {currentOrder?.isNew
                  ? "Create Takeaway Order"
                  : "Edit Takeaway Order"}
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
              onSubmit={currentOrder?.isNew ? handleCreate : handleSave}
              className="space-y-6"
            >
              {currentOrder?.isNew ? (
                <>
                  {/* New takeaway order - only menu selection & summary */}
                  <div className="border-t border-gray-200 pt-1 space-y-4">
                    <p className="text-xs text-gray-500">
                      Build a new takeaway order by selecting items from the
                      menu below. This will create a new TAKEAWAY order.
                    </p>
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
                                  setDraftCategory(category || "Uncategorized")
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
                        {(currentOrder.kotLines || []).map((kot, kotIdx) => (
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
                                {(kot.totalAmount || kot.total || 0).toString()}
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(kot.items || []).map((item, itemIdx) => (
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
                                        item.returned ? "line-through" : ""
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
                                        item.returned ? "line-through" : ""
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
                                      currentOrder.status !== "Cancelled" &&
                                      currentOrder.status !== "Returned" && (
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
                              ))}
                            </div>
                          </div>
                        ))}
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
                        <strong>{currentOrder?.status}</strong>. Items can only
                        be added to unpaid takeaway orders.
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500">
                          Select items from the menu below to add more items to
                          this takeaway order. These will be added as a new KOT.
                        </p>
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
                                  <span>₹{formatMoney(draftTotals.total)}</span>
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

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setCurrentOrder(null);
                    setDraftSelections({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {currentOrder?.isNew ? "Create Order" : "Save Changes"}
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
