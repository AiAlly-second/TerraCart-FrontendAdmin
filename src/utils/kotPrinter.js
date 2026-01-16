
/**
 * Client-side KOT (Kitchen Order Ticket) Printer
 * Generates HTML content for KOT and prints via iframe
 */



// Inline formatMoney helper if not available
const formatMoneyHelper = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "0.00";
  return num.toFixed(2);
};

export const printKOT = (order, kot, kotIndex = 0) => {
  if (!order || !kot) return;

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
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 2px dashed #000;
            padding-bottom: 5px;
            margin-bottom: 10px;
          }
          .header h2 {
            margin: 0;
            font-size: 16px;
            font-weight: bold;
          }
          .header p {
            margin: 2px 0;
            font-size: 12px;
          }
          .info {
            margin-bottom: 10px;
            font-size: 12px;
          }
          .info div {
            display: flex;
            justify-content: space-between;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
          }
          .items-table th {
            text-align: left;
            border-bottom: 1px solid #000;
            padding: 2px 0;
          }
          .items-table td {
            text-align: left;
            padding: 4px 0;
            vertical-align: top;
          }
          .qty {
            width: 15%;
            font-weight: bold;
          }
          .item-name {
            width: 85%;
          }
          .footer {
            border-top: 2px dashed #000;
            margin-top: 10px;
            padding-top: 5px;
            text-align: center;
            font-style: italic;
          }
          .badge {
             font-weight: bold;
             display: inline-block;
             margin-left: 5px;
          }
          .takeaway {
            color: #000; /* Black for thermal printers */
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>KITCHEN ORDER TICKET</h2>
          <p>KOT #: ${kotIndex + 1}</p>
        </div>

        <div class="info">
          <div>
            <span>Order ID:</span>
            <span>${(order._id || "").toString().slice(-6).toUpperCase()}</span>
          </div>
          <div>
            <span>Table:</span>
            <span>${order.tableNumber || "N/A"}</span>
          </div>
           <div>
            <span>Service:</span>
            <span>${order.serviceType || "DINE_IN"}</span>
          </div>
          <div>
            <span>Time:</span>
            <span>${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          ${order.serviceType === 'TAKEAWAY' && order.takeawayToken ? `
          <div style="margin-top:4px; font-weight:bold; font-size:14px;">
            <span>Token:</span>
            <span>${order.takeawayToken}</span>
          </div>
          ` : ''}
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="qty">Qty</th>
              <th class="item-name">Item</th>
            </tr>
          </thead>
          <tbody>
            ${(kot.items || []).map(item => {
              if (item.returned) return '';
              const isTakeaway = item.convertedToTakeaway === true;
              return `
              <tr>
                <td class="qty">${item.quantity}</td>
                <td class="item-name">
                  ${item.name}
                  ${isTakeaway ? '<span class="badge takeaway">(TAKEAWAY)</span>' : ''}
                </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          Terra Cart KOT
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
