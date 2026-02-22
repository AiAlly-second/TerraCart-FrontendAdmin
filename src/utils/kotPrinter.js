import api from "./api";
import { printMobileKotLines } from "./mobilePrintAgent";

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const printHtmlInIframe = (html) => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1200);
    }, 120);
  };
};

const resolvePayload = (response) => {
  const root = response?.data;
  if (root && typeof root === "object" && root.data && typeof root.data === "object") {
    return root.data;
  }
  if (root && typeof root === "object") {
    return root;
  }
  return {};
};

export const printKOT = async (order, _kot, kotIndex = 0) => {
  const orderId = order?._id || order?.id;
  if (!orderId) return false;

  try {
    const query = new URLSearchParams({
      kotIndex: String(Number.isFinite(Number(kotIndex)) ? kotIndex : 0),
      paperWidth: "58mm",
      printerId: "kitchen-primary",
    });

    const response = await api.get(`/orders/${orderId}/kot-print?${query.toString()}`);
    const payload = resolvePayload(response);
    const lines = Array.isArray(payload?.lines) ? payload.lines : [];

    if (isMobile) {
      if (!lines.length) return false;
      printMobileKotLines(lines);
      return true;
    }

    const html = typeof payload?.html === "string" ? payload.html.trim() : "";
    if (!html) return false;
    printHtmlInIframe(html);
    return true;
  } catch (error) {
    console.error("[KOT] Backend compact template print failed:", error);
    return false;
  }
};
