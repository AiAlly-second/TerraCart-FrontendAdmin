
/**
 * Client-side KOT (Kitchen Order Ticket) Printer
 * Generates HTML content for KOT and prints via iframe
 */



import { printMobileKOT } from "./mobilePrintAgent";

// Inline formatMoney helper if not available
// const formatMoneyHelper = (value) => {
//   const num = Number(value);
//   if (Number.isNaN(num)) return "0.00";
//   return num.toFixed(2);
// };

// Simple mobile detection
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const printKOT = (order, kot, kotIndex = 0) => {
  if (!order || !kot) return;

  // If on mobile, use the RawBT native handler
  // You can also toggle this via a specific localStorage flag if needed
  if (isMobile) {
    printMobileKOT(order, kot, kotIndex);
    return;
  }


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

  // Generate KOT HTML
  const kotakHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>KOT #${kotIndex + 1} - ${order._id}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto; /* Standard thermal paper width */
              margin: 0;
            }
            body {
              margin: 0;
              padding: 5px;
            }
          }
          body {
            font-family: 'Courier New', monospace;
            width: 80mm;
            max-width: 302px;
            margin: 0 auto;
            background: #fff;
            color: #000;
            font-size: 11px;
            line-height: 1.3;
          }
          .header {
            text-align: center;
            border-bottom: 3px double #000;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .header h1 {
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .header h2 {
            margin: 0;
            font-size: 11px;
            font-weight: bold;
            border: 2px solid #000;
            padding: 4px;
            display: inline-block;
          }
          .kot-number {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin: 8px 0;
            padding: 6px;
            background: #000;
            color: #fff;
          }
          .service-badge {
            text-align: center;
            font-size: 13px;
            font-weight: bold;
            margin: 8px 0;
            padding: 5px;
            border: 2px dashed #000;
          }
          .service-badge.takeaway {
            background: #f0f0f0;
          }
          .info {
            margin-bottom: 8px;
            font-size: 11px;
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .info-label {
            font-weight: bold;
          }
          .highlight-box {
            border: 4px double #000;
            padding: 8px;
            margin: 8px 0;
            text-align: center;
            background: #f5f5f5;
          }
          .highlight-box .label {
            font-size: 11px;
            font-weight: bold;
            display: block;
            margin-bottom: 3px;
          }
          .highlight-box .value {
            font-size: 18px;
            font-weight: bold;
            letter-spacing: 2px;
          }
          .section-title {
            text-align: center;
            font-weight: bold;
            font-size: 12px;
            margin: 10px 0 6px 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 4px;
          }
          .items-table {
            width: 100%

;
            border-collapse: collapse;
            margin: 6px 0;
          }
          .items-table th {
            text-align: left;
            border-bottom: 2px solid #000;
            padding: 4px 2px;
            font-weight: bold;
            font-size: 10px;
          }
          .items-table td {
            text-align: left;
            padding: 6px 2px;
            vertical-align: top;
            border-bottom: 1px dotted #ccc;
          }
          .qty {
            width: 20%;
            font-weight: bold;
            font-size: 13px;
          }
          .item-name {
            width: 80%;
            font-size: 12px;
          }
          .item-note {
            font-size: 10px;
            color: #333;
            font-style: italic;
            padding-left: 10px;
            margin-top: 2px;
          }
          .summary {
            border-top: 2px solid #000;
            margin-top: 8px;
            padding-top: 6px;
            text-align: center;
            font-weight: bold;
          }
          .footer {
            border-top: 3px double #000;
            margin-top: 10px;
            padding-top: 6px;
            text-align: center;
            font-style: italic;
            font-size: 10px;
          }
          .footer .message {
            font-weight: bold;
            margin-bottom: 2px;
          }
          .badge {
            font-weight: bold;
            display: inline-block;
            margin-left: 5px;
            padding: 2px 5px;
            background: #000;
            color: #fff;
            font-size: 9px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>** TERRA CART **</h1>
          <h2>KITCHEN ORDER TICKET</h2>
        </div>

        <div class="kot-number">
          KOT #${String(kotIndex + 1).padStart(3, '0')}
        </div>

        <div class="service-badge ${order.serviceType === 'TAKEAWAY' ? 'takeaway' : ''}">
          ${order.serviceType === 'TAKEAWAY' ? '*** TAKEAWAY ORDER ***' : '~~~ DINE-IN ORDER ~~~'}
        </div>

        <div class="info">
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Time:</span>
            <span>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Order Ref:</span>
            <span>${(order._id || "").toString().slice(-8).toUpperCase()}</span>
          </div>
        </div>

        ${order.serviceType === 'TAKEAWAY' && order.takeawayToken ? `
        <div class="highlight-box">
          <span class="label">TOKEN NUMBER</span>
          <span class="value">${order.takeawayToken.toUpperCase()}</span>
        </div>
        ` : order.tableNumber ? `
        <div class="highlight-box">
          <span class="label">TABLE NUMBER</span>
          <span class="value">${order.tableNumber}</span>
        </div>
        ` : ''}

        ${order.serviceType === 'TAKEAWAY' && (order.customerName || order.customerMobile) ? `
        <div class="info" style="border-top: 1px solid #000; padding-top: 6px;">
          ${order.customerName ? `
          <div class="info-row">
            <span class="info-label">Customer:</span>
            <span>${order.customerName}</span>
          </div>
          ` : ''}
          ${order.customerMobile ? `
          <div class="info-row">
            <span class="info-label">Mobile:</span>
            <span>${order.customerMobile}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}

        <div class="section-title">ITEMS TO PREPARE</div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="qty">Qty</th>
              <th class="item-name">Item</th>
            </tr>
          </thead>
          <tbody>
            ${(kot.items || []).map(item => {
              if (item.returned) {
                return `
                <tr style="text-decoration: line-through; opacity: 0.6;">
                  <td class="qty" colspan="2">✗ CANCELLED: ${item.name}</td>
                </tr>
                `;
              }
              const isTakeaway = item.convertedToTakeaway === true;
              return `
              <tr>
                <td class="qty">[${item.quantity}x]</td>
                <td class="item-name">
                  <strong>${item.name}</strong>
                  ${isTakeaway ? '<span class="badge">TAKEAWAY</span>' : ''}
                  ${item.specialInstructions ? `<div class="item-note">Note: ${item.specialInstructions}</div>` : ''}
                </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="summary">
          ${(() => {
            const activeItems = (kot.items || []).filter(i => !i.returned);
            const totalQty = activeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
            return `Total Items: ${activeItems.length} | Total Qty: ${totalQty}`;
          })()}
        </div>

        <div class="footer">
          <div class="message">Prepare with care!</div>
          <div>Terra Cart Kitchen</div>
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(kotakHtml);
  doc.close();

  iframe.onload = function () {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // Remove iframe after printing logic is initiated (with a small delay to ensure print dialog happens)
      // Note: In some browsers, removing immediately might cancel print.
      // Better to leave it or remove after a long timeout.
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000); 
    }, 100);
  };
};
