/* eslint-disable no-control-regex */
/**
 * Mobile Print Agent (Browser Compatible)
 * Converts the Node.js "Local Print Agent" logic to work in the browser
 * specifically for Android devices using the RawBT Print Service app.
 * 
 * Usage:
 * calling printMobileKOT(order, kotLines) sends the print intent to RawBT.
 */

// ESC/POS Command Constants
const ESC = "\x1B";
const GS = "\x1D";
const LF = "\x0A";

const COMMANDS = {
  INIT: ESC + "@",
  CUT: GS + "V" + "\x42" + "\x00", // Cut full
  TEXT_FORMAT: {
    NORMAL: ESC + "!" + "\x00",
    BOLD: ESC + "!" + "\x08",
    DOUBLE_HEIGHT: ESC + "!" + "\x10",
    DOUBLE_WIDTH: ESC + "!" + "\x20",
    DOUBLE_BOTH: ESC + "!" + "\x30",
  },
  ALIGN: {
    LEFT: ESC + "a" + "\x00",
    CENTER: ESC + "a" + "\x01",
    RIGHT: ESC + "a" + "\x02",
  }
};

/**
 * Helper to build ESC/POS buffer string
 */
class EscPosBuilder {
  constructor() {
    this.buffer = COMMANDS.INIT;
  }

  align(align) {
    if (align === 'ct') this.buffer += COMMANDS.ALIGN.CENTER;
    else if (align === 'lt') this.buffer += COMMANDS.ALIGN.LEFT;
    else if (align === 'rt') this.buffer += COMMANDS.ALIGN.RIGHT;
    return this;
  }

  font(type) {
    this.buffer += COMMANDS.TEXT_FORMAT.NORMAL;
    return this;
  }

  style(style) {
    if (style === 'b') this.buffer += COMMANDS.TEXT_FORMAT.BOLD;
    else this.buffer += COMMANDS.TEXT_FORMAT.NORMAL;
    return this;
  }

  size(width, height) {
      if (width > 1 || height > 1) this.buffer += COMMANDS.TEXT_FORMAT.DOUBLE_BOTH;
      else this.buffer += COMMANDS.TEXT_FORMAT.NORMAL;
      return this;
  }

  text(content) {
    this.buffer += content + LF;
    return this;
  }

  cut() {
    this.buffer += COMMANDS.CUT;
    return this;
  }

  getBuffer() {
    return this.buffer;
  }
}

// Formatting logic ported from local-print-agent/agent.js
function formatKOT(order, kot, kotIndex = 0) {
  const printer = new EscPosBuilder();
  
  // Use Indian Timezone to match PC Agent
  const time = new Date();
  const timeStr = time.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const dateStr = time.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Printer setup
  printer.align('ct').font('a');

  // Restaurant Header
  printer.text("=".repeat(32));
  printer.style('b').text("       ** TERRA CART **").style('a'); 
  printer.text("=".repeat(32));

  // KOT Title
  printer.text("   -----------------------");
  printer.text("   | KITCHEN ORDER TICKET |");
  printer.text("   -----------------------");

  // KOT Number
  printer.size(1, 1).style('b');
  printer.text(`   KOT NUMBER: #${String(kotIndex + 1).padStart(3, "0")}`);
  printer.style('a').size(0, 0);

  // Service Type Badge
  const serviceTypeLine = order.serviceType === "TAKEAWAY" 
    ? "   *** TAKEAWAY ORDER ***" 
    : "   ~~~ DINE-IN ORDER ~~~";
  printer.text(serviceTypeLine);

  // Date & Time
  printer.align('lt');
  printer.text(`  Date: ${dateStr}`);
  printer.text(`  Time: ${timeStr}`);

  // Table/Token
  printer.align('ct').style('b');
  if (order.serviceType === "TAKEAWAY" && order.takeawayToken) {
    printer.text("        TOKEN NUMBER");
    printer.size(2, 2).text(`        ${order.takeawayToken.toUpperCase()}`);
  } else if (order.tableNumber) {
    printer.text("        TABLE NUMBER");
    printer.size(2, 2).text(`        ${order.tableNumber}`);
  }
  printer.size(0, 0).style('a');

  // Items Header
  printer.align('lt');
  printer.text("   ITEMS TO PREPARE:");

  // Items List
  if (kot.items && Array.isArray(kot.items)) {
      kot.items.forEach((item) => {
      if (item.returned) {
        printer.text(`  X [CANCELLED] ${item.name}`);
      } else {
        const qtyDisplay = `[${item.quantity}x]`;
        printer.style('b').text(`  ${qtyDisplay} ${item.name}`).style('a');
        
        // Special instructions
        if (item.specialInstructions) {
          printer.text(`      Note: ${item.specialInstructions}`);
        }
      }
    });
  }

  // Footer stats
  const activeItems = (kot.items || []).filter(i => !i.returned);
  const totalQty = activeItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  
  printer.text("");
  printer.text(`  Total Items: ${activeItems.length}`);
  printer.text(`  Total Quantity: ${totalQty}`);

  // Footer
  printer.align('ct');
  printer.text("=".repeat(32));
  printer.text("   Terra Cart Kitchen");
  printer.text("=".repeat(32));
  printer.text("");
  printer.text("");
  
  printer.cut();

  return printer.getBuffer();
}

/**
 * Triggers the mobile print action using RawBT scheme
 * @param {Object} order - The full order object
 * @param {Object} kot - The specific KOT object from kotLines
 * @param {number} kotIndex - Index of the KOT
 */
export const printMobileKOT = (order, kot, kotIndex) => {
  try {
    const escPosData = formatKOT(order, kot, kotIndex);
    
    // Proper UTF-8 to Base64 conversion
    // 1. Encode string to UTF-8 bytes (Uint8Array) - Handles Hindi/Marathi/ControlCodes
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(escPosData);
    
    // 2. Convert Uint8Array to Binary String
    let binaryString = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
        binaryString += String.fromCharCode(utf8Bytes[i]);
    }
    
    // 3. Base64 Encode
    const base64Data = btoa(binaryString);

    // Construct RawBT Intent URL
    const intentUrl = `rawbt:base64,${base64Data}`;
    
    console.log("🖨️ Auto-printing KOT via RawBT...");
    // Trigger the print intent
    window.location.href = intentUrl;

  } catch (err) {
    console.error("Mobile Print Error:", err);
  }
};
/* eslint-enable no-control-regex */
