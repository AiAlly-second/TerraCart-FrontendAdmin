/**
 * Mobile Print Agent (Browser Compatible)
 * Sends ESC/POS data to RawBT using intent URL.
 */

const ESC = "\x1B";
const GS = "\x1D";
const LF = "\x0A";

const COMMANDS = {
  INIT: ESC + "@",
  CUT: GS + "V" + "\x42" + "\x00",
  TEXT_FORMAT: {
    NORMAL: ESC + "!" + "\x00",
    BOLD: ESC + "!" + "\x08",
  },
  ALIGN: {
    LEFT: ESC + "a" + "\x00",
    CENTER: ESC + "a" + "\x01",
    RIGHT: ESC + "a" + "\x02",
  },
};

class EscPosBuilder {
  constructor() {
    this.buffer = COMMANDS.INIT;
  }

  align(align) {
    if (align === "ct") this.buffer += COMMANDS.ALIGN.CENTER;
    else if (align === "rt") this.buffer += COMMANDS.ALIGN.RIGHT;
    else this.buffer += COMMANDS.ALIGN.LEFT;
    return this;
  }

  style(style) {
    if (style === "b") this.buffer += COMMANDS.TEXT_FORMAT.BOLD;
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

const sendEscPosToRawBt = (escPosData) => {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(escPosData);

  let binaryString = "";
  for (let i = 0; i < utf8Bytes.length; i += 1) {
    binaryString += String.fromCharCode(utf8Bytes[i]);
  }

  const base64Data = btoa(binaryString);
  window.location.href = `rawbt:base64,${base64Data}`;
};

const cleanLine = (value) => String(value || "").replace(/\s+/g, " ").trim();

const formatKOTFallback = (order, kot, kotIndex = 0) => {
  const printer = new EscPosBuilder();
  const explicitKotNumber = Number(kot?.kotNumber);
  const kotNumber =
    Number.isFinite(explicitKotNumber) && explicitKotNumber > 0
      ? explicitKotNumber
      : kotIndex + 1;

  const serviceType = String(order?.serviceType || "")
    .trim()
    .toUpperCase();
  const orderType = String(order?.orderType || "")
    .trim()
    .toUpperCase();
  const isTakeawayLike =
    serviceType === "TAKEAWAY" ||
    serviceType === "PICKUP" ||
    serviceType === "DELIVERY" ||
    orderType === "PICKUP" ||
    orderType === "DELIVERY";
  const serviceLabel = isTakeawayLike ? "TAKEAWAY" : "DINE-IN";
  const orderRef = String(order?._id || "").slice(-8).toUpperCase();
  const separator = "--------------------------------";

  printer.align("ct").style("b").text("TERRA CART").style("a");
  printer.text(`KOT #${String(kotNumber).padStart(2, "0")} ${serviceLabel}`);
  if (orderRef) printer.text(`Order: ${orderRef}`);
  printer.text(separator);

  const items = Array.isArray(kot?.items) ? kot.items : [];
  items.forEach((item) => {
    if (!item || item.returned) return;
    const qty = Number(item.quantity) || 0;
    const name = cleanLine(item.name || "Item");
    printer.align("lt").style("b").text(`${qty} x ${name}`).style("a");
  });

  printer.align("ct").text("").text("").cut();
  return printer.getBuffer();
};

const mapAlign = (align) => {
  if (align === "center") return "ct";
  if (align === "right") return "rt";
  return "lt";
};

const formatKotFromLines = (lines) => {
  const printer = new EscPosBuilder();
  const safeLines = Array.isArray(lines) ? lines : [];
  const defaultSeparator = "--------------------------------";

  safeLines.forEach((entry) => {
    const line =
      entry && typeof entry === "object" ? entry : { text: String(entry || "") };
    const align = mapAlign(line.align);
    const text = cleanLine(line.text || "");
    const indent = Number.isFinite(line.indent) ? Math.max(0, line.indent) : 0;
    const leftPad = indent > 0 ? " ".repeat(indent * 2) : "";

    printer.align(align);
    printer.style(line.bold ? "b" : "a");
    if (line.separator) {
      printer.text(text || defaultSeparator);
      return;
    }
    printer.text(`${leftPad}${text}`);
  });

  printer.align("ct").style("a").text("").text("").cut();
  return printer.getBuffer();
};

export const printMobileKOT = (order, kot, kotIndex) => {
  try {
    const escPosData = formatKOTFallback(order, kot, kotIndex);
    sendEscPosToRawBt(escPosData);
  } catch (err) {
    console.error("Mobile Print Error:", err);
  }
};

export const printMobileKotLines = (lines) => {
  try {
    const escPosData = formatKotFromLines(lines);
    sendEscPosToRawBt(escPosData);
  } catch (err) {
    console.error("Mobile Print (backend lines) Error:", err);
  }
};
