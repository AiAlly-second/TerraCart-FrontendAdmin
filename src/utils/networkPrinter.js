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
  
  let commands = '';
  
  // Initialize printer
  commands += ESC + '@'; // Initialize
  commands += ESC + 'a' + '\x01'; // Center align
  
  // Header
  commands += ESC + '!' + '\x30'; // Double height + width
  commands += '** TERRA CART **\n';
  commands += ESC + '!' + '\x00'; // Normal
  commands += ESC + '!' + '\x10'; // Bold
  commands += 'KITCHEN ORDER TICKET\n';
  commands += ESC + '!' + '\x00'; // Normal
  commands += '================================\n';
  
  // KOT Number
  commands += ESC + '!' + '\x30'; // Double height + width
  commands += `KOT #${String(kotIndex + 1).padStart(3, '0')}\n`;
  commands += ESC + '!' + '\x00'; // Normal
  
  // Service Type
  commands += '\n';
  const serviceType = order.serviceType === 'TAKEAWAY' ? '*** TAKEAWAY ORDER ***' : '~~~ DINE-IN ORDER ~~~';
  commands += serviceType + '\n';
  commands += '================================\n';
  
  // Order Info
  commands += ESC + 'a' + '\x00'; // Left align
  const now = new Date();
  commands += `Date: ${now.toLocaleDateString('en-IN')}\n`;
  commands += `Time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}\n`;
  commands += `Order: ${(order._id || '').toString().slice(-8).toUpperCase()}\n`;
  
  // Table/Token Number
  if (order.serviceType === 'TAKEAWAY' && order.takeawayToken) {
    commands += '\n';
    commands += ESC + 'a' + '\x01'; // Center
    commands += ESC + '!' + '\x20'; // Double height
    commands += `TOKEN: ${order.takeawayToken.toUpperCase()}\n`;
    commands += ESC + '!' + '\x00'; // Normal
  } else if (order.tableNumber) {
    commands += '\n';
    commands += ESC + 'a' + '\x01'; // Center
    commands += ESC + '!' + '\x20'; // Double height
    commands += `TABLE: ${order.tableNumber}\n`;
    commands += ESC + '!' + '\x00'; // Normal
  }
  
  // Customer Info for Takeaway
  if (order.serviceType === 'TAKEAWAY' && (order.customerName || order.customerMobile)) {
    commands += ESC + 'a' + '\x00'; // Left align
    commands += '--------------------------------\n';
    if (order.customerName) {
      commands += `Customer: ${order.customerName}\n`;
    }
    if (order.customerMobile) {
      commands += `Mobile: ${order.customerMobile}\n`;
    }
  }
  
  // Items Section
  commands += '================================\n';
  commands += ESC + 'a' + '\x01'; // Center
  commands += ESC + '!' + '\x10'; // Bold
  commands += 'ITEMS TO PREPARE\n';
  commands += ESC + '!' + '\x00'; // Normal
  commands += ESC + 'a' + '\x00'; // Left align
  commands += '================================\n';
  
  // Items List
  (kot.items || []).forEach(item => {
    if (item.returned) {
      commands += `X CANCELLED: ${item.name}\n`;
      return;
    }
    
    commands += ESC + '!' + '\x10'; // Bold
    commands += `[${item.quantity}x] ${item.name}\n`;
    commands += ESC + '!' + '\x00'; // Normal
    
    if (item.convertedToTakeaway) {
      commands += '  >> TAKEAWAY <<\n';
    }
    
    if (item.specialInstructions) {
      commands += `  Note: ${item.specialInstructions}\n`;
    }
    
    commands += '--------------------------------\n';
  });
  
  // Summary
  const activeItems = (kot.items || []).filter(i => !i.returned);
  const totalQty = activeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  commands += '================================\n';
  commands += ESC + 'a' + '\x01'; // Center
  commands += ESC + '!' + '\x10'; // Bold
  commands += `Total Items: ${activeItems.length} | Qty: ${totalQty}\n`;
  commands += ESC + '!' + '\x00'; // Normal
  commands += '================================\n';
  
  // Footer
  commands += '\n';
  commands += 'Prepare with care!\n';
  commands += 'Terra Cart Kitchen\n';
  commands += '\n\n\n';
  
  // Cut paper
  commands += GS + 'V' + '\x00'; // Full cut
  
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
