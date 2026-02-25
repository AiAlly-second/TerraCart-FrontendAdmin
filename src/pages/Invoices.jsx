import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../utils/api";
import { buildExcelFileName, exportRowsToExcel } from "../utils/excelReport";
const sanitizeAddonName = (value) => {
  const normalized = String(value || "")
    .replace(/^\(\s*\+\s*\)\s*/u, "")
    .trim();
  return normalized || "Add-on";
};

const aggregateKotItems = (order) => {
  if (!order) return [];
  const map = new Map();
  const kotLines = order.kotLines || [];
  
  // Process KOT Items
  kotLines.forEach((kot) => {
    (kot?.items || []).forEach((item) => {
      if (!item) return;
      const name = item.name || "Item";
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.price || 0) / 100; // Items are in Paise
      const returned = Boolean(item.returned);
      if (!map.has(name)) {
        map.set(name, {
          name,
          unitPrice,
          quantity: 0,
          returnedQuantity: 0,
          returned: false,
          amount: 0,
        });
      }
      const entry = map.get(name);
      if (returned) {
        entry.returnedQuantity += quantity;
        entry.returned = true;
      } else {
        entry.quantity += quantity;
        entry.amount += unitPrice * quantity;
      }
      if (!entry.unitPrice) {
        entry.unitPrice = unitPrice;
      }
    });
  });

  // Process Selected Add-ons
  const addons = order.selectedAddons || [];
  addons.forEach(addon => {
     const addonName = sanitizeAddonName(addon.name);
     const addonKey = `addon:${addon.addonId || addon._id || addon.id || `${addonName}-${addon.price || 0}`}`;
     const quantity = Number(addon.quantity) || 1;
     const unitPrice = Number(addon.price) || 0; // Addons are in Rupees
     
     if (!map.has(addonKey)) {
       map.set(addonKey, {
         name: addonName,
         unitPrice,
         quantity: 0,
         returnedQuantity: 0,
         returned: false,
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
// Calculate totals from actual items (to avoid rounding errors)
const computeKotTotals = (aggregatedItems = []) => {
  // Calculate subtotal from non-returned items (amount is already in rupees)
  const subtotal = aggregatedItems.reduce((sum, item) => {
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
    totalItems: aggregatedItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    ),
  };
};

const formatMoney = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveDisplayAddress = (...candidates) => {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const buildInvoiceMarkup = (
  order,
  invoiceItems,
  totals,
  franchiseData,
  cartData,
  paymentMethod
) => {
  if (!order) return "";
  const invoiceNumber = (() => {
    const date = new Date(order.createdAt || Date.now())
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const tail = (order._id || "").toString().slice(-6).toUpperCase();
    return `INV-${date}-${tail}`;
  })();

  // Get cart address (prefer address, fallback to location)
  const cartAddress =
    resolveDisplayAddress(
      cartData?.address,
      cartData?.location,
      order?.cafe?.address,
      order?.cafe?.location
    ) || "—";
  // Get franchise FSSAI number (fallback to GST for backward comp)
  const franchiseFSSAI = franchiseData?.fssaiNumber || franchiseData?.gstNumber || "—";

  // Payment mode display (fallback to CASH if not provided)
  const resolvedPaymentMethod = paymentMethod || "CASH";
  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeCartAddress = escapeHtml(cartAddress);
  const safeFranchiseFSSAI = escapeHtml(franchiseFSSAI);
  const safeInvoiceDate = escapeHtml(
    new Date(
      order.paidAt || order.updatedAt || order.createdAt || Date.now()
    ).toLocaleDateString(),
  );
  const safeTableNumber = escapeHtml(order.tableNumber || "--");
  const safePaymentMethod = escapeHtml(
    String(resolvedPaymentMethod).toUpperCase(),
  );

  const rows =
    invoiceItems.length > 0
      ? invoiceItems
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
          ${rows}
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

const Invoices = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [filterDate, setFilterDate] = useState(""); // Date filter (YYYY-MM-DD format)
  const [franchiseData, setFranchiseData] = useState(null);
  const [cartData, setCartData] = useState(null);
  const [paymentsByOrder, setPaymentsByOrder] = useState({});
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // Search query for Order ID
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const printRef = useRef(null);

  const selectedInvoiceItems = useMemo(
    () => aggregateKotItems(selected),
    [selected]
  );

  const selectedTotals = useMemo(
    () => computeKotTotals(selectedInvoiceItems),
    [selectedInvoiceItems]
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Failed to load orders"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFranchiseAndCartData = useCallback(async (order) => {
    if (!order) {
      setFranchiseData(null);
      setCartData(null);
      return;
    }
    
    // Reset first
    setFranchiseData(null);
    setCartData(null);

    try {
      // 1. Fetch Franchise Data
      if (order.franchiseId) {
        // Handle if franchiseId is an object or string
        const franchiseId = typeof order.franchiseId === 'object' ? order.franchiseId._id : order.franchiseId;
        if (franchiseId) {
             const fRes = await api.get(`/users/${franchiseId}`, { skipErrorLogging: true });
             setFranchiseData(fRes.data);
        }
      }

      // 2. Fetch Cart Data (prefer Cart document for address from registration/settings)
      if (order.cartId) {
        const cartId = typeof order.cartId === 'object' ? order.cartId._id : order.cartId;
        if (cartId) {
          try {
            const cRes = await api.get(`/carts/by-admin/${cartId}`, { skipErrorLogging: true });
            if (cRes.data?.data) {
              // Cart document: address is resolved string, fallback to location
              setCartData({
                address: cRes.data.data.address || null,
                location: cRes.data.data.location || null,
              });
              return;
            }
          } catch (e) {
            if (e.response?.status !== 404 && e.response?.status !== 403) {
              console.warn("Cart by-admin fetch failed, falling back to user:", e);
            }
          }
          // Fallback: User (cart admin) for address/location
          const uRes = await api.get(`/users/${cartId}`, { skipErrorLogging: true });
          setCartData(uRes.data);
        }
      }
    } catch (err) {
      // Ignore 404s (deleted users), warn for other errors
      if (err.response?.status !== 404) {
        console.warn("Failed to fetch franchise/cart data for invoice:", err);
      }
      // We do not set error state here to avoid blocking the UI
      // The invoice will just render with placeholders ("—")
    }
  }, []);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const { data } = await api.get("/payments");
      const grouped = {};
      (Array.isArray(data) ? data : []).forEach((payment) => {
        const orderId = payment.orderId;
        if (!orderId) return;
        if (!grouped[orderId]) grouped[orderId] = [];
        grouped[orderId].push(payment);
      });
      setPaymentsByOrder(grouped);
    } catch (err) {
      console.error("Failed to load payments", err);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const handleSyncPayments = async () => {
    setSyncingPayments(true);
    try {
      await api.post("/payments/sync-paid");
      await Promise.all([loadOrders(), loadPayments()]);
      alert("Synced payment records for paid orders.");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to sync payments.");
    } finally {
      setSyncingPayments(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadPayments();
  }, []);

  useEffect(() => {
    if (selected) {
      loadFranchiseAndCartData(selected);
    } else {
      setFranchiseData(null);
      setCartData(null);
    }
  }, [selected, loadFranchiseAndCartData]);

  const getInvoiceNumber = (order) => {
    const date = new Date(order.createdAt || Date.now())
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const tail = (order._id || "").toString().slice(-6).toUpperCase();
    return `INV-${date}-${tail}`;
  };

  const getInvoiceNumberMemoized = useCallback(getInvoiceNumber, []);

  const paidOrders = useMemo(() => {
    let filtered = orders.filter(
      (o) => (o.status || "").toString().toLowerCase() === "paid"
    );

    // Filter by date if provided
    if (filterDate) {
      filtered = filtered.filter((o) => {
        const orderDate = new Date(o.createdAt || o.paidAt || o.updatedAt);
        const filterDateObj = new Date(filterDate);
        return orderDate.toDateString() === filterDateObj.toDateString();
      });
    }

    // Filter by Search Query (Order ID or Invoice Number)
    if (searchQuery) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((o) => {
        const idMatch = (o._id || "").toString().toLowerCase().includes(query);
        const invoiceNum = getInvoiceNumber(o).toLowerCase();
        const invoiceMatch = invoiceNum.includes(query);
        return idMatch || invoiceMatch;
      });
    }

    return filtered;
  }, [orders, filterDate, searchQuery]);

  const selectedPayments = useMemo(
    () => (selected ? paymentsByOrder[selected._id] || [] : []),
    [selected, paymentsByOrder]
  );

  // Primary payment method for selected order (for invoice header/footer)
  const selectedPaymentMethod = useMemo(() => {
    if (!selectedPayments || selectedPayments.length === 0) return null;
    // Prefer a PAID payment record; otherwise fall back to the first record
    const paid = selectedPayments.find((p) => p.status === "PAID");
    return (paid || selectedPayments[0]).method || null;
  }, [selectedPayments]);

  const handleDownloadInvoicesReport = () => {
    const rows = paidOrders.map((order) => {
      const invoiceItems = aggregateKotItems(order);
      const totals = computeKotTotals(invoiceItems);
      const orderPayments = paymentsByOrder?.[order._id] || [];
      const paidPayment =
        orderPayments.find((payment) => payment.status === "PAID") ||
        orderPayments[0] ||
        null;

      return {
        "Order ID": order._id || "",
        "Invoice ID": getInvoiceNumber(order),
        "Created At": order.createdAt
          ? new Date(order.createdAt).toLocaleString()
          : "",
        "Paid At": (order.paidAt || paidPayment?.paidAt)
          ? new Date(order.paidAt || paidPayment?.paidAt).toLocaleString()
          : "",
        Status: order.status || "",
        "Service Type": order.serviceType || "",
        "Table / Counter": order.tableNumber || "",
        "Payment Method":
          paidPayment?.method || order.paymentMode || order.paymentMethod || "",
        "Payment Status": paidPayment?.status || "",
        "Items Count": invoiceItems.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0,
        ),
        "Subtotal (Rs)": Number((totals?.subtotal || 0).toFixed(2)),
        "Total Amount (Rs)": Number((totals?.totalAmount || 0).toFixed(2)),
      };
    });

    const fileName = buildExcelFileName("invoices-report", filterDate);
    const exported = exportRowsToExcel({
      rows,
      fileName,
      sheetName: "Invoices",
    });

    if (!exported) {
      alert("No invoice data available for the selected filters.");
    }
  };

  const handleOpenInvoiceModal = useCallback((order) => {
    setSelected(order);
    setIsInvoiceModalOpen(true);
  }, []);

  const handleCloseInvoiceModal = useCallback(() => {
    setIsInvoiceModalOpen(false);
  }, []);

  const handlePrint = () => {
    if (!printRef.current) return;
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
          <title>${selected ? getInvoiceNumber(selected) : "Invoice"}</title>
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
          ${printRef.current.innerHTML}
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

  const handleDownloadPdf = async () => {
    if (!printRef.current || !selected) return;
    
    // Target the inner invoice-root to capture only the receipt content, 
    // avoiding the outer container's borders, shadows, and padding.
    const element = printRef.current.querySelector('.invoice-root') || printRef.current;
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imageData = canvas.toDataURL("image/png");
      
      // Calculate dimensions based on the canvas
      // PDF Width = 80mm (Standard thermal receipt width)
      const pdfWidth = 80;
      const margin = 2; // Small margin
      const usableWidth = pdfWidth - (margin * 2);
      
      // Calculate height maintaining aspect ratio
      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const ratio = imgHeightPx / imgWidthPx;
      const imgHeightMm = usableWidth * ratio;
      
      // Total PDF height (image height + margins)
      const pdfHeight = imgHeightMm + (margin * 2);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(imageData, "PNG", margin, margin, usableWidth, imgHeightMm);
      pdf.save(`${getInvoiceNumber(selected)}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate PDF. Please try again or use the Print option.");
    }
  };

  useEffect(() => {
    if (!isInvoiceModalOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsInvoiceModalOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isInvoiceModalOpen]);

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
            Invoices
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Generate printable invoices for Paid orders and keep payment records
            in sync.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial"
            placeholder="Search Order ID"
          />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial"
            placeholder="Filter by date"
          />
          <button
            onClick={loadPayments}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg border border-gray-300 hover:bg-gray-100 whitespace-nowrap"
            disabled={paymentsLoading}
          >
            {paymentsLoading ? "Refreshing payments…" : "Refresh payments"}
          </button>
          <button
            onClick={handleSyncPayments}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
            disabled={syncingPayments}
          >
            {syncingPayments ? "Syncing…" : "Sync paid orders"}
          </button>
          <button
            onClick={handleDownloadInvoicesReport}
            className="px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
          >
            Download Excel
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-500">Loading paid orders…</div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="max-w-4xl space-y-2 sm:space-y-3">
          <div className="space-y-2 sm:space-y-3">
            {paidOrders.length === 0 && (
              <div className="text-sm text-gray-500">No paid orders match your criteria.</div>
            )}
            {paidOrders.map((order) => (
              <button
                key={order._id}
                onClick={() => handleOpenInvoiceModal(order)}
                className={`w-full text-left p-3 sm:p-4 rounded-lg border shadow-sm hover:shadow transition ${
                  selected?._id === order._id ? "ring-2 ring-blue-400" : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm sm:text-base text-gray-800 truncate">
                      Order #{order._id}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500">
                      Table {order.tableNumber || "—"}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-400 mt-1">
                      {new Date(order.createdAt).toLocaleDateString()}{" "}
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-xs sm:text-sm font-mono text-gray-700 flex-shrink-0">
                    {new Date(
                      order.paidAt || order.updatedAt || order.createdAt
                    ).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  Click to open invoice popup
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {isInvoiceModalOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <button
            type="button"
            aria-label="Close invoice preview"
            className="absolute inset-0 bg-black/40"
            onClick={handleCloseInvoiceModal}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[94vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:px-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">
                    Invoice Preview
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    Invoice #{getInvoiceNumber(selected)}
                  </p>
                </div>
                <button
                  onClick={handleCloseInvoiceModal}
                  className="px-3 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm"
                >
                  Print
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="px-3 sm:px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs sm:text-sm"
                >
                  Download PDF
                </button>
              </div>
            </div>

            <div className="max-h-[calc(94vh-110px)] overflow-y-auto p-3 sm:p-4">
              <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Payment records
                  </h3>
                  <button
                    onClick={loadPayments}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Refresh
                  </button>
                </div>
                {paymentsLoading ? (
                  <p className="text-xs text-slate-500">Loading payment data...</p>
                ) : selectedPayments.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No payment records found for this order. Use "Sync paid orders" to create payment entries.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs text-slate-700">
                    {selectedPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-slate-200 rounded-md px-3 py-2 bg-white"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-slate-600">
                            {payment.id}
                          </span>
                          <span className="px-2 py-0.5 rounded-full border border-slate-300 text-slate-600">
                            {payment.method.toLowerCase()}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border ${
                              payment.status === "PAID"
                                ? "border-green-300 text-green-700 bg-green-50"
                                : "border-yellow-300 text-yellow-700 bg-yellow-50"
                            }`}
                          >
                            {payment.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-slate-800">
                            Rs {payment.amount?.toFixed(2)}
                          </span>
                          <span className="text-slate-500">
                            {new Date(
                              payment.updatedAt || payment.createdAt
                            ).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 sm:p-4">
                <div
                  ref={printRef}
                  className="mx-auto w-fit bg-white rounded-lg shadow border"
                  dangerouslySetInnerHTML={{
                    __html: buildInvoiceMarkup(
                      selected,
                      selectedInvoiceItems,
                      selectedTotals,
                      franchiseData,
                      cartData,
                      selectedPaymentMethod
                    ),
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;

