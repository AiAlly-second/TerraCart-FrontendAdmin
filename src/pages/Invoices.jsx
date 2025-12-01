import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import api from "../utils/api";

const aggregateKotItems = (kotLines = []) => {
  const map = new Map();
  (kotLines || []).forEach((kot) => {
    (kot?.items || []).forEach((item) => {
      if (!item) return;
      const name = item.name || "Item";
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.price || 0) / 100;
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
    totalItems: aggregatedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
  };
};

const formatMoney = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
};

const buildInvoiceMarkup = (order, invoiceItems, totals, franchiseData, cartData) => {
  if (!order) return "";
  const invoiceNumber = (() => {
    const date = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10).replace(/-/g, "");
    const tail = (order._id || "").toString().slice(-6).toUpperCase();
    return `INV-${date}-${tail}`;
  })();

  // Get cart address (prefer address, fallback to location)
  const cartAddress = cartData?.address || "—";
  // Get franchise GST number
  const franchiseGST = franchiseData?.gstNumber || "—";

  const rows =
    invoiceItems.length > 0
      ? invoiceItems
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

const Invoices = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [franchiseData, setFranchiseData] = useState(null);
  const [cartData, setCartData] = useState(null);
  const [paymentsByOrder, setPaymentsByOrder] = useState({});
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const printRef = useRef(null);

  const selectedInvoiceItems = useMemo(
    () => aggregateKotItems(selected?.kotLines || []),
    [selected]
  );

  const selectedTotals = useMemo(
    () => computeKotTotals(selected?.kotLines || [], selectedInvoiceItems),
    [selected, selectedInvoiceItems]
  );

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const loadFranchiseAndCartData = async (order) => {
    if (!order) {
      setFranchiseData(null);
      setCartData(null);
      return;
    }

    try {
      // Fetch franchise data if franchiseId exists
      if (order.franchiseId) {
        const franchiseRes = await api.get(`/users/${order.franchiseId}`);
        if (franchiseRes.data) {
          setFranchiseData({
            gstNumber: franchiseRes.data.gstNumber || null,
            name: franchiseRes.data.name || null,
          });
        }
      } else {
        setFranchiseData(null);
      }

      // Fetch cart data if cartId exists
      if (order.cartId) {
        const cartRes = await api.get(`/users/${order.cartId}`);
        if (cartRes.data) {
          setCartData({
            address: cartRes.data.address || cartRes.data.location || null,
            cartName: cartRes.data.cartName || cartRes.data.name || null,
          });
        }
      } else {
        setCartData(null);
      }
    } catch (err) {
      console.error("Failed to load franchise/cart data:", err);
      setFranchiseData(null);
      setCartData(null);
    }
  };

  const loadPayments = async () => {
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
  };

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
  }, [selected]);

  const paidOrders = useMemo(() => orders.filter(o => (o.status || '').toString().toLowerCase() === 'paid'), [orders]);
  const selectedPayments = useMemo(
    () => (selected ? paymentsByOrder[selected._id] || [] : []),
    [selected, paymentsByOrder]
  );

  const getInvoiceNumber = (order) => {
    const date = new Date(order.createdAt || Date.now()).toISOString().slice(0,10).replace(/-/g,'');
    const tail = (order._id || '').toString().slice(-6).toUpperCase();
    return `INV-${date}-${tail}`;
  };

  const handlePrint = () => {
    if (!printRef.current) return;
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
          <title>${selected ? getInvoiceNumber(selected) : 'Invoice'}</title>
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
    const element = printRef.current;
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

    pdf.save(`${getInvoiceNumber(selected)}.pdf`);
  };

  return (
    <div className="p-4">
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Invoices</h1>
          <p className="text-gray-500 mt-1">
            Generate printable invoices for Paid orders and keep payment records in sync.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadPayments}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-100"
            disabled={paymentsLoading}
          >
            {paymentsLoading ? "Refreshing payments…" : "Refresh payments"}
          </button>
          <button
            onClick={handleSyncPayments}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={syncingPayments}
          >
            {syncingPayments ? "Syncing…" : "Sync paid orders"}
          </button>
        </div>
      </div>

      {loading && <div className="text-gray-500">Loading paid orders…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-3">
            {paidOrders.length === 0 && (
              <div className="text-gray-500">No paid orders yet.</div>
            )}
            {paidOrders.map(order => (
              <button
                key={order._id}
                onClick={() => setSelected(order)}
                className={`w-full text-left p-4 rounded-lg border shadow-sm hover:shadow transition ${selected?._id === order._id ? 'ring-2 ring-blue-400' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-800">Order #{order._id}</div>
                    <div className="text-sm text-gray-500">Table {order.tableNumber || '—'}</div>
                  </div>
                  <div className="text-sm font-mono text-gray-700">{new Date(order.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-xs text-gray-500 mt-1">Click to preview invoice</div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {!selected && (
              <div className="text-gray-500">Select a paid order to preview the invoice.</div>
            )}
            {selected && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-2">
                    <h2 className="text-xl font-bold text-gray-800">Invoice Preview</h2>
                    <p className="text-sm text-gray-500">Invoice #{getInvoiceNumber(selected)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handlePrint}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Print
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Download PDF
                    </button>
                  </div>
                </div>

                <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-800">Payment records</h3>
                    <button
                      onClick={loadPayments}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Refresh
                    </button>
                  </div>
                  {paymentsLoading ? (
                    <p className="text-xs text-slate-500">Loading payment data…</p>
                  ) : selectedPayments.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No payment records found for this order. Use “Sync paid orders” to create payment entries.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs text-slate-700">
                      {selectedPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-slate-200 rounded-md px-3 py-2 bg-white"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-slate-600">{payment.id}</span>
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
                              ₹{payment.amount?.toFixed(2)}
                            </span>
                            <span className="text-slate-500">
                              {new Date(payment.updatedAt || payment.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div 
                  ref={printRef} 
                  className="bg-white rounded-lg shadow border"
                  dangerouslySetInnerHTML={{
                    __html: buildInvoiceMarkup(selected, selectedInvoiceItems, selectedTotals, franchiseData, cartData)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;









