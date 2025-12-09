import React, { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import api from "../utils/api";

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
  const [filterDate, setFilterDate] = useState(""); // Date filter (YYYY-MM-DD format)
  const [busyId, setBusyId] = useState(null);

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

  useEffect(() => {
    loadPayments();
  }, []);

  const filteredPayments = useMemo(() => {
    let filtered = payments;
    
    // Filter by status
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
        // ALL - no status filter
        break;
    }
    
    // Filter by date if provided
    if (filterDate) {
      filtered = filtered.filter((p) => {
        const paymentDate = new Date(p.createdAt);
        const filterDateObj = new Date(filterDate);
        return paymentDate.toDateString() === filterDateObj.toDateString();
      });
    }
    
    return filtered;
  }, [payments, filterStatus, filterDate]);

  const handleMarkPaid = async (payment) => {
    if (!window.confirm(`Mark payment ${payment.id} as paid?`)) return;
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Payments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track online and cash payments. You can mark payments as paid or cancel them from here.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Filter by date"
          />
          <button
            onClick={loadPayments}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading payments...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                No payments match the selected filter.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">
                      Order
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">
                      Date & Time
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">
                      Method
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className={`hover:bg-slate-50 ${
                        selectedPayment?.id === payment.id ? "bg-blue-50/40" : ""
                      }`}
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{payment.orderId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-700">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(payment.createdAt).toLocaleTimeString()}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">₹{payment.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{payment.method.toLowerCase()}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${
                            STATUS_BADGE[payment.status] || "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {payment.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-2">
                          {payment.status !== "PAID" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkPaid(payment);
                              }}
                              disabled={busyId === payment.id}
                              className="text-xs px-3 py-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
                            >
                              Mark paid
                            </button>
                          )}
                          {["PENDING", "PROCESSING", "CASH_PENDING"].includes(payment.status) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancel(payment);
                              }}
                              disabled={busyId === payment.id}
                              className="text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
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

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Payment details</h2>

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
                    ₹{selectedPayment.amount?.toFixed(2)}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Payments;









