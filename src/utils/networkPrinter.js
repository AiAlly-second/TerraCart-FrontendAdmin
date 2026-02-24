/**
 * Network Printer Utility for Direct IP Printing
 * Sends ESC/POS commands directly to thermal printer via IP address
 */

/**
 * Convert text to ESC/POS commands for thermal printer
 */
const generateESCPOS = (order, kot, kotIndex = 0) => {
  const ESC = '\x1B';
  const GS = '\x1D';
  const explicitKotNumber = Number(kot?.kotNumber);
  const kotNumber =
    Number.isFinite(explicitKotNumber) && explicitKotNumber > 0
      ? explicitKotNumber
      : kotIndex + 1;
  const serviceType = String(order?.serviceType || '')
    .trim()
    .toUpperCase();
  const orderType = String(order?.orderType || '')
    .trim()
    .toUpperCase();
  const isTakeawayLike =
    serviceType === 'TAKEAWAY' ||
    serviceType === 'PICKUP' ||
    serviceType === 'DELIVERY' ||
    orderType === 'PICKUP' ||
    orderType === 'DELIVERY';
  const serviceLabel = isTakeawayLike ? 'TAKEAWAY' : 'DINE-IN';
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const orderRef = String(order?._id || '').slice(-8).toUpperCase();
  const normalizeMultilineNote = (value) =>
    String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const noteCandidates = [
    order?.specialInstructions,
    order?.specialInstruction,
    order?.orderNote,
    order?.note,
    order?.notes,
    kot?.specialInstructions,
    kot?.note,
  ];
  const orderNote =
    noteCandidates
      .map((value) => normalizeMultilineNote(value))
      .find((value) => value.trim().length > 0) || '';

  const cleanLine = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const separator = '----------------------------';
  const items = Array.isArray(kot?.items) ? kot.items : [];
  const activeItems = items.filter((item) => item && item.returned !== true);
  const totalQty = activeItems.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0),
    0,
  );

  let commands = '';
  commands += ESC + '@'; // Initialize
  commands += ESC + 'a' + '\x01'; // Center
  commands += ESC + '!' + '\x10'; // Bold
  commands += 'TERRA CART\n';
  commands += ESC + '!' + '\x00';
  commands += `KOT #${String(kotNumber).padStart(2, '0')} ${serviceLabel}\n`;
  commands += `${dateLabel} ${timeLabel}\n`;
  commands += separator + '\n';

  if (isTakeawayLike && orderType !== 'DELIVERY' && order.takeawayToken) {
    commands += `Token: ${cleanLine(order.takeawayToken)}\n`;
  } else if (!isTakeawayLike && order.tableNumber) {
    commands += `Table: ${cleanLine(order.tableNumber)}\n`;
  }

  if (orderRef) {
    commands += `Ref: ${orderRef}\n`;
  }

  if (isTakeawayLike) {
    if (order?.customerName) {
      commands += `Customer: ${cleanLine(order.customerName)}\n`;
    }
    if (order?.customerMobile) {
      commands += `Mobile: ${cleanLine(order.customerMobile)}\n`;
    }
  }

  if (orderNote) {
    commands += 'Note:\n';
    orderNote.split('\n').forEach((line) => {
      commands += `${line}\n`;
    });
  }

  commands += separator + '\n';
  commands += ESC + 'a' + '\x00'; // Left

  if (!items.length) {
    commands += 'No items\n';
  } else {
    items.forEach((item) => {
      if (!item) return;
      if (item.returned === true) return;
      const qty = Number(item.quantity) || 0;
      const name = cleanLine(item.name || 'Item');
      commands += `${qty} x ${name}\n`;

      const itemNote = cleanLine(item.specialInstructions || item.note || '');
      if (itemNote) {
        commands += `  * ${itemNote}\n`;
      }

      const extras = Array.isArray(item.extras)
        ? item.extras
            .map((extra) => cleanLine(extra?.name || ''))
            .filter(Boolean)
        : [];
      if (extras.length) {
        commands += `  + ${extras.join(', ')}\n`;
      }
    });
  }

  commands += separator + '\n';
  commands += ESC + 'a' + '\x01'; // Center
  commands += ESC + '!' + '\x08'; // Bold
  commands += `Items: ${activeItems.length}  Qty: ${totalQty}\n`;
  commands += ESC + '!' + '\x00';
  commands += '\n\n';
  commands += GS + 'V' + '\x00'; // Cut

  return commands;
};

/**
 * Send print job to network printer via IP
 */
export const printToNetworkPrinter = async (order, kot, kotIndex = 0, printerIP, printerPort = 9100) => {
  try {
    // Generate ESC/POS commands
    const escposData = generateESCPOS(order, kot, kotIndex);
    
    // Send to backend proxy endpoint (we'll create this)
    const response = await fetch('/api/print/network', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printerIP,
        printerPort,
        data: escposData,
        orderId: order._id,
        kotIndex
      })
    });
    
    if (!response.ok) {
      throw new Error(`Print failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ KOT sent to network printer:', result);
    return { success: true, message: 'KOT printed successfully' };
    
  } catch (error) {
    console.error('❌ Network printer error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Auto-print KOT based on user settings
 */
export const autoPrintKOT = async (order, kot, kotIndex = 0) => {
  try {
    // Get user's printer settings from localStorage
    const adminUser = localStorage.getItem('adminUser');
    if (!adminUser) {
      console.warn('No admin user found, skipping auto-print');
      return { success: false, error: 'No user session' };
    }
    
    const userData = JSON.parse(adminUser);
    const printerSettings = userData.printerSettings;
    
    // Check if network printing is enabled
    if (!printerSettings || !printerSettings.enabled) {
      console.log('Network printing disabled, skipping');
      return { success: false, error: 'Printing disabled' };
    }
    
    if (!printerSettings.ip) {
      console.warn('No printer IP configured');
      return { success: false, error: 'No printer IP' };
    }
    
    // Send to network printer
    console.log(`📡 Auto-printing KOT to ${printerSettings.ip}:${printerSettings.port}`);
    return await printToNetworkPrinter(
      order,
      kot,
      kotIndex,
      printerSettings.ip,
      printerSettings.port || 9100
    );
    
  } catch (error) {
    console.error('Auto-print error:', error);
    return { success: false, error: error.message };
  }
};

export default {
  printToNetworkPrinter,
  autoPrintKOT
};
