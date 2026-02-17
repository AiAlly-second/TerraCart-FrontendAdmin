import React, { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import api from "../utils/api";
import { buildExcelFileName, exportRowsToExcel } from "../utils/excelReport";

const nodeApi = (
  import.meta.env.VITE_NODE_API_URL || "http://localhost:5001"
).replace(/\/$/, "");

const resolveAssetUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${nodeApi}${url}`;
  return `${nodeApi}/${url}`;
};

const extractUpiIdFromPayload = (payload) => {
  if (!payload || typeof payload !== "string") return "";
  const match = payload.match(/[?&]pa=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
};

const parseAmountCandidates = (text) => {
  if (!text) return [];
  const matches = text.match(/\d+(?:[.,]\d{1,2})?/g) || [];
  const values = matches
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0 && value < 1000000);
  return [...new Set(values)];
};

const extractReferenceId = (text) => {
  if (!text) return "";
  const patterns = [
    /utr[\s:.-]*([a-z0-9]{8,})/i,
    /upi[\s]*(?:ref(?:erence)?|id)?[\s:.-]*([a-z0-9]{8,})/i,
    /txn[\s]*(?:id|no|number)?[\s:.-]*([a-z0-9]{8,})/i,
    /ref(?:erence)?[\s]*(?:id|no|number)?[\s:.-]*([a-z0-9]{8,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  const longDigit = text.match(/\b\d{10,18}\b/);
  return longDigit ? longDigit[0] : "";
};

const validateReceiptText = ({ rawText, amount, upiId, orderId }) => {
  const normalizedText = String(rawText || "").toLowerCase();
  const expectedAmount = Number(amount || 0);
  const amountCandidates = parseAmountCandidates(normalizedText);
  const amountMatch = amountCandidates.find(
    (candidate) => Math.abs(candidate - expectedAmount) <= 1
  );

  const successKeywords = [
    "success",
    "successful",
    "paid",
    "completed",
    "debited",
    "credited",
    "transaction",
    "upi",
  ];
  const failureKeywords = ["failed", "failure", "reversed", "declined", "pending"];

  const successCount = successKeywords.reduce(
    (count, keyword) => count + (normalizedText.includes(keyword) ? 1 : 0),
    0
  );
  const hasFailureKeyword = failureKeywords.some((keyword) =>
    normalizedText.includes(keyword)
  );

  const expectedUpiId = String(upiId || "").trim().toLowerCase();
  const upiMatched =
    expectedUpiId.length > 0 && normalizedText.includes(expectedUpiId);

  const referenceId = extractReferenceId(normalizedText);
  const orderTail = String(orderId || "").slice(-5).toLowerCase();
  const orderHintMatched =
    orderTail.length >= 4 ? normalizedText.includes(orderTail) : false;

  let score = 0;
  if (amountMatch) score += 2;
  if (referenceId) score += 1;
  if (upiMatched) score += 1;
  if (successCount > 0) score += 1;
  if (orderHintMatched) score += 1;
  if (hasFailureKeyword) score -= 2;

  return {
    amountMatched: Boolean(amountMatch),
    detectedAmount: amountMatch || null,
    referenceId,
    upiMatched,
    successCount,
    hasFailureKeyword,
    orderHintMatched,
    isValid: Boolean(amountMatch) && score >= 3 && !hasFailureKeyword,
  };
};

const STATUS_BADGE = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
  PROCESSING: "bg-blue-100 text-blue-700 border-blue-200",
  CASH_PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  PAID: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-slate-200 text-slate-600 border-slate-300",
  FAILED: "bg-red-100 text-red-600 border-red-200",
};

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDate, setFilterDate] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [activeQR, setActiveQR] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(null);
  const [qrUploading, setQrUploading] = useState(false);
  const [qrDeleting, setQrDeleting] = useState(false);
  const [qrFile, setQrFile] = useState(null);
  const [qrForm, setQrForm] = useState({
    upiId: "",
    gatewayName: "",
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrResult, setOcrResult] = useState(null);

  const loadPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/payments");
      setPayments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const loadActiveQR = async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await api.get("/payment-qr");
      const data = res?.data || null;
      setActiveQR(data);
      if (data) {
        setQrForm({
          upiId: data.upiId || "",
          gatewayName: data.gatewayName || "",
        });
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setActiveQR(null);
        return;
      }
      setActiveQR(null);
      setQrError(err.response?.data?.message || "Failed to load payment QR");
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    loadActiveQR();
  }, []);

  useEffect(() => {
    return () => {
      if (receiptPreview) {
        URL.revokeObjectURL(receiptPreview);
      }
    };
  }, [receiptPreview]);

  useEffect(() => {
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
    }
    setReceiptFile(null);
    setReceiptPreview("");
    setOcrError("");
    setOcrResult(null);
  }, [selectedPayment?.id]);

  const filteredPayments = useMemo(() => {
    let filtered = payments;

    switch (filterStatus) {
      case "ACTIVE":
        filtered = filtered.filter((p) =>
          ["PENDING", "PROCESSING", "CASH_PENDING"].includes(p.status)
        );
        break;
      case "PAID":
        filtered = filtered.filter((p) => p.status === "PAID");
        break;
      case "CANCELLED":
        filtered = filtered.filter((p) => ["CANCELLED", "FAILED"].includes(p.status));
        break;
      default:
        break;
    }

    if (filterDate) {
      filtered = filtered.filter((p) => {
        const paymentDate = new Date(p.createdAt);
        const filterDateObj = new Date(filterDate);
        return paymentDate.toDateString() === filterDateObj.toDateString();
      });
    }

    return filtered;
  }, [payments, filterStatus, filterDate]);

  const handleDownloadPaymentsReport = () => {
    const rows = filteredPayments.map((payment) => ({
      "Payment ID": payment.id || "",
      "Order ID": payment.orderId || "",
      "Created At": payment.createdAt
        ? new Date(payment.createdAt).toLocaleString()
        : "",
      "Updated At": payment.updatedAt
        ? new Date(payment.updatedAt).toLocaleString()
        : "",
      "Amount (Rs)": Number(payment.amount || 0),
      Method: payment.method || "",
      Status: payment.status || "",
      "Paid At": payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "",
      "Cancelled At": payment.cancelledAt
        ? new Date(payment.cancelledAt).toLocaleString()
        : "",
      "Cancellation Reason": payment.cancellationReason || "",
      "Provider Ref": payment.providerReference || "",
    }));

    const fileName = buildExcelFileName("payments-report", filterDate);
    const exported = exportRowsToExcel({
      rows,
      fileName,
      sheetName: "Payments",
    });

    if (!exported) {
      alert("No payments available for the selected filters.");
    }
  };

  const handleMarkPaid = async (payment) => {
    const confirmed = await window.confirm(`Mark payment ${payment.id} as paid?`);
    if (!confirmed) return;
    setBusyId(payment.id);
    try {
      await api.post(`/payments/${payment.id}/mark-paid`);
      await loadPayments();
      if (selectedPayment?.id === payment.id) {
        const refreshed = await api.get(`/payments/${payment.id}`);
        setSelectedPayment(refreshed.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to mark payment as paid");
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (payment) => {
    const reason =
      window.prompt("Enter cancellation reason (optional)", "Cancelled by admin") || "";
    setBusyId(payment.id);
    try {
      await api.post(`/payments/${payment.id}/cancel`, { reason });
      await loadPayments();
      if (selectedPayment?.id === payment.id) {
        const refreshed = await api.get(`/payments/${payment.id}`);
        setSelectedPayment(refreshed.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel payment");
    } finally {
      setBusyId(null);
    }
  };

  const handleUploadQR = async () => {
    if (!qrFile) {
      alert("Please choose a QR image to upload.");
      return;
    }

    setQrUploading(true);
    setQrError(null);
    try {
      const formData = new FormData();
      formData.append("qrImage", qrFile);
      if (qrForm.upiId?.trim()) formData.append("upiId", qrForm.upiId.trim());
      if (qrForm.gatewayName?.trim()) {
        formData.append("gatewayName", qrForm.gatewayName.trim());
      }

      await api.post("/payment-qr/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setQrFile(null);
      await loadActiveQR();
    } catch (err) {
      setQrError(err.response?.data?.message || "Failed to upload payment QR");
    } finally {
      setQrUploading(false);
    }
  };

  const handleDeleteQR = async () => {
    if (!activeQR?.id) return;
    const confirmed = await window.confirm("Remove the active payment QR code?");
    if (!confirmed) return;

    setQrDeleting(true);
    setQrError(null);
    try {
      await api.delete(`/payment-qr/${activeQR.id}`);
      setActiveQR(null);
      setQrFile(null);
      await loadActiveQR();
    } catch (err) {
      setQrError(err.response?.data?.message || "Failed to delete payment QR");
    } finally {
      setQrDeleting(false);
    }
  };

  const handleReceiptFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (receiptPreview) {
      URL.revokeObjectURL(receiptPreview);
    }
    setReceiptFile(file);
    setOcrResult(null);
    setOcrError("");
    if (!file) {
      setReceiptPreview("");
      return;
    }
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleScanReceipt = async () => {
    if (!selectedPayment) {
      setOcrError("Select a payment first.");
      return;
    }
    if (!receiptFile) {
      setOcrError("Please upload a receipt image first.");
      return;
    }

    const expectedUpiId =
      activeQR?.upiId || extractUpiIdFromPayload(selectedPayment?.upiPayload);

    setOcrLoading(true);
    setOcrError("");
    try {
      const Tesseract = await import("tesseract.js");
      const result = await Tesseract.recognize(receiptFile, "eng", {
        logger: () => {},
      });
      const rawText = String(result?.data?.text || "").trim();
      if (!rawText) {
        throw new Error("No readable text found in receipt image.");
      }

      const validation = validateReceiptText({
        rawText,
        amount: selectedPayment.amount,
        upiId: expectedUpiId,
        orderId: selectedPayment.orderId,
      });
      setOcrResult({
        ...validation,
        rawText,
      });
    } catch (err) {
      setOcrResult(null);
      setOcrError(
        err?.message ||
          "Could not scan receipt. Please upload a clear screenshot."
      );
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Payments</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track online and cash payments. You can mark payments as paid or cancel them from here.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active payments</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled/Failed</option>
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-initial"
            placeholder="Filter by date"
          />
          <button
            onClick={loadPayments}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-100 whitespace-nowrap"
          >
            Refresh
          </button>
          <button
            onClick={handleDownloadPaymentsReport}
            className="px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm hover:bg-emerald-100 whitespace-nowrap"
          >
            Download Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            {loading ? (
              <div className="p-6 sm:p-8 text-center text-slate-500 text-sm sm:text-base">Loading payments...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-slate-500 text-sm sm:text-base">
                No payments match the selected filter.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-xs sm:text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 text-left font-semibold text-slate-600 text-[10px] sm:text-xs">
                      Order
                    </th>
                    <th className="px-2 sm:px-4 py-2 text-left font-semibold text-slate-600 text-[10px] sm:text-xs hidden sm:table-cell">
                      Date & Time
                    </th>
                    <th className="px-2 sm:px-4 py-2 text-left font-semibold text-slate-600 text-[10px] sm:text-xs">
                      Amount
                    </th>
                    <th className="px-2 sm:px-4 py-2 text-left font-semibold text-slate-600 text-[10px] sm:text-xs hidden md:table-cell">
                      Method
                    </th>
                    <th className="px-2 sm:px-4 py-2 text-left font-semibold text-slate-600 text-[10px] sm:text-xs">
                      Status
                    </th>
                    <th className="px-2 sm:px-4 py-2 text-right font-semibold text-slate-600 text-[10px] sm:text-xs">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className={`hover:bg-slate-50 cursor-pointer ${
                        selectedPayment?.id === payment.id ? "bg-blue-50/40" : ""
                      }`}
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <p className="font-semibold text-slate-800 text-xs sm:text-sm truncate max-w-[80px] sm:max-w-none">{payment.orderId}</p>
                        <p className="text-[10px] sm:text-xs text-slate-500 sm:hidden">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                        <p className="text-xs sm:text-sm text-slate-700">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-500">
                          {new Date(payment.createdAt).toLocaleTimeString()}
                        </p>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-700 text-xs sm:text-sm font-medium">Rs {payment.amount.toFixed(2)}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 capitalize text-slate-600 text-xs sm:text-sm hidden md:table-cell">{payment.method.toLowerCase()}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <span
                          className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full border ${
                            STATUS_BADGE[payment.status] || "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {payment.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex justify-end items-center gap-1 sm:gap-2">
                          {payment.status !== "PAID" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkPaid(payment);
                              }}
                              disabled={busyId === payment.id}
                              className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 whitespace-nowrap"
                            >
                              Mark paid
                            </button>
                          )}
                          {["PENDING", "PROCESSING", "CASH_PENDING"].includes(payment.status) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel(payment);
                              }}
                              disabled={busyId === payment.id}
                              className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 whitespace-nowrap"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4">
            <h2 className="text-base sm:text-lg font-semibold text-slate-800">Payment details</h2>

            {!selectedPayment ? (
              <p className="text-sm text-slate-500">
                Select a payment from the list to view details, scan the QR code, or copy the UPI payload.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-slate-500">Order</p>
                  <p className="font-semibold text-slate-800">{selectedPayment.orderId}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="font-semibold text-slate-800">
                      Rs {selectedPayment.amount?.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Method</p>
                    <p className="font-semibold text-slate-800">
                      {selectedPayment.method}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="font-semibold text-slate-800">
                      {selectedPayment.status.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Created</p>
                    <p className="font-semibold text-slate-800">
                      {new Date(selectedPayment.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedPayment.paidAt && (
                    <div>
                      <p className="text-xs text-slate-500">Paid at</p>
                      <p className="font-semibold text-slate-800">
                        {new Date(selectedPayment.paidAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {selectedPayment.cancelledAt && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-500">Cancelled</p>
                      <p className="font-semibold text-slate-800">
                        {new Date(selectedPayment.cancelledAt).toLocaleString()}
                      </p>
                      {selectedPayment.cancellationReason && (
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedPayment.cancellationReason}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {selectedPayment.upiPayload && (
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-lg p-3 flex flex-col items-center gap-2">
                      <QRCode value={selectedPayment.upiPayload} size={128} />
                      <p className="text-xs text-slate-500 text-center">
                        Scan to pay via UPI. Share this with the customer if needed.
                      </p>
                    </div>
                    <textarea
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600"
                      readOnly
                      value={selectedPayment.upiPayload}
                      rows={3}
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedPayment.upiPayload)}
                      className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100"
                    >
                      Copy UPI payload
                    </button>
                  </div>
                )}

                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Receipt OCR check
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload customer receipt screenshot to check if payment looks
                    real.
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptFileChange}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                  />

                  {receiptPreview && (
                    <img
                      src={receiptPreview}
                      alt="Receipt preview"
                      className="w-full max-h-56 object-contain rounded-lg border border-slate-200 bg-slate-50 p-2"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleScanReceipt}
                    disabled={!receiptFile || ocrLoading}
                    className="text-xs px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {ocrLoading ? "Scanning..." : "Scan receipt"}
                  </button>

                  {ocrError && (
                    <p className="text-xs text-red-600">{ocrError}</p>
                  )}

                  {ocrResult && (
                    <div
                      className={`rounded-lg border px-3 py-2 text-xs space-y-1 ${
                        ocrResult.isValid
                          ? "border-green-200 bg-green-50 text-green-800"
                          : "border-amber-200 bg-amber-50 text-amber-800"
                      }`}
                    >
                      <p className="font-semibold">
                        {ocrResult.isValid
                          ? "Receipt looks valid"
                          : "Needs manual review"}
                      </p>
                      <p>
                        Amount match:{" "}
                        <strong>
                          {ocrResult.amountMatched
                            ? `Yes (Rs ${Number(
                                ocrResult.detectedAmount || 0
                              ).toFixed(2)})`
                            : "No"}
                        </strong>
                      </p>
                      <p>
                        Reference:{" "}
                        <strong>{ocrResult.referenceId || "Not found"}</strong>
                      </p>
                      <p>
                        UPI ID match:{" "}
                        <strong>{ocrResult.upiMatched ? "Yes" : "No"}</strong>
                      </p>
                      <details className="mt-1">
                        <summary className="cursor-pointer font-semibold">
                          Extracted text
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-white p-2 text-[11px] text-slate-700">
                          {ocrResult.rawText}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 sm:p-4 md:p-5 space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-800">Payment QR setup</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Upload the UPI QR shown to customers on the payment page.
              </p>
            </div>

            {qrError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {qrError}
              </div>
            )}

            {qrLoading ? (
              <p className="text-sm text-slate-500">Loading active QR...</p>
            ) : activeQR ? (
              <div className="space-y-2">
                <img
                  src={resolveAssetUrl(activeQR.qrImageUrl)}
                  alt="Active Payment QR"
                  className="w-40 h-40 object-contain border border-slate-200 rounded-lg p-2 bg-white"
                />
                <div className="text-xs text-slate-600 space-y-1">
                  {activeQR.upiId && <p>UPI ID: {activeQR.upiId}</p>}
                  {activeQR.gatewayName && <p>Gateway: {activeQR.gatewayName}</p>}
                  {activeQR.createdAt && (
                    <p>Updated: {new Date(activeQR.createdAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No active payment QR uploaded.</p>
            )}

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">QR image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">UPI ID (optional)</label>
                <input
                  type="text"
                  value={qrForm.upiId}
                  onChange={(e) =>
                    setQrForm((prev) => ({ ...prev, upiId: e.target.value }))
                  }
                  placeholder="example@upi"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Gateway name (optional)</label>
                <input
                  type="text"
                  value={qrForm.gatewayName}
                  onChange={(e) =>
                    setQrForm((prev) => ({ ...prev, gatewayName: e.target.value }))
                  }
                  placeholder="Google Pay / PhonePe / Paytm"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleUploadQR}
                  disabled={!qrFile || qrUploading}
                  className="text-xs px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {qrUploading ? "Uploading..." : "Upload QR"}
                </button>
                {activeQR?.id && (
                  <button
                    type="button"
                    onClick={handleDeleteQR}
                    disabled={qrDeleting}
                    className="text-xs px-3 py-2 rounded-md bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                  >
                    {qrDeleting ? "Removing..." : "Remove active QR"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payments;
