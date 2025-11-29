import React, { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";
import {
  ORDER_TRANSITIONS,
  canAccept,
  nextStatusOnAccept,
  getNextStatus,
  canCancel,
  canReturn,
} from "../domain/orderLogic";
import api from "../utils/api";

const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
const normalizeId = (value) =>
  typeof value === "string" ? value : value?.toString?.() || "";

const TakeawayOrders = () => {
  const [orders, setOrders] = useState([]);
  const [searchOrderId, setSearchOrderId] = useState("");
  const [searchTable, setSearchTable] = useState("");
  const [searchInvoice, setSearchInvoice] = useState("");
  const [expanded, setExpanded] = useState({});
  const [filterStatus, setFilterStatus] = useState("all");

  const socketRef = React.useRef(null);
  const upsertOrder = React.useCallback(
    (incoming, { prepend = false } = {}) => {
      if (!incoming || incoming.serviceType !== "TAKEAWAY") return;
      const incomingId = normalizeId(incoming._id);
      if (!incomingId) return;

      setOrders((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const index = list.findIndex(
          (order) => normalizeId(order._id) === incomingId
        );

        if (index >= 0) {
          list[index] = incoming;
          return list;
        }

        return prepend ? [incoming, ...list] : [...list, incoming];
      });
    },
    [setOrders]
  );

  useEffect(() => {
    let active = true;

    const fetchOrders = async () => {
      try {
        const res = await fetch(`${nodeApi}/api/orders`);
        if (!res.ok) throw new Error("Failed to fetch orders");
        const data = await res.json();
        if (!active) return;
        const takeawayOrders = (Array.isArray(data) ? data : []).filter(
          (order) => order.serviceType === "TAKEAWAY"
        );
        setOrders(takeawayOrders);
      } catch (err) {
        console.error("Failed to load takeaway orders:", err);
      }
    };

    fetchOrders();

    const socket = io(nodeApi);
    socketRef.current = socket;

    const handleNewOrder = (order) => {
      upsertOrder(order, { prepend: true });
    };

    const handleOrderUpdated = (order) => {
      upsertOrder(order);
    };

    const handleOrderDeleted = ({ id }) => {
      setOrders((prev) => prev.filter((order) => order._id !== id));
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderUpdated", handleOrderUpdated);
    socket.on("orderDeleted", handleOrderDeleted);

    return () => {
      active = false;
      socket.off("newOrder", handleNewOrder);
      socket.off("orderUpdated", handleOrderUpdated);
      socket.off("orderDeleted", handleOrderDeleted);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const buildInvoiceId = (order) => {
    if (!order) return "";
    const date = new Date(order.createdAt || Date.now())
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const tail = (order._id || "").toString().slice(-6).toUpperCase();
    return `INV-${date}-${tail}`;
  };

  const changeStatus = async (orderId, newStatus) => {
    try {
      const response = await api.patch(`/orders/${orderId}/status`, { status: newStatus });
      upsertOrder(response.data);
    } catch (e) {
      console.error("Status change failed:", e);
      const errorMessage = e.response?.data?.message || e.message || "Status update failed";
      alert(`Failed to change status: ${errorMessage}`);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this takeaway order?")) {
      return;
    }
    try {
      await api.delete(`/orders/${orderId}`);
      setOrders((prev) => prev.filter((order) => order._id !== orderId));
    } catch (err) {
      console.error("Delete failed:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to delete order";
      alert(errorMessage);
    }
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statusSummary = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc.byStatus[order.status] = (acc.byStatus[order.status] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} }
    );
  }, [orders]);

  const statusBadgeClass = (status) => {
    switch (status) {
      case "Paid":
        return "border-green-200 text-green-700 bg-green-50";
      case "Confirmed":
        return "border-yellow-200 text-yellow-700 bg-yellow-50";
      case "Preparing":
        return "border-blue-200 text-blue-700 bg-blue-50";
      case "Ready":
        return "border-purple-200 text-purple-700 bg-purple-50";
      case "Returned":
        return "border-rose-200 text-rose-700 bg-rose-50";
      case "Cancelled":
        return "border-red-200 text-red-700 bg-red-50";
      default:
        return "border-gray-200 text-gray-700 bg-gray-50";
    }
  };

  const filteredOrders = useMemo(() => {
    const normalizedOrder = searchOrderId.trim().toLowerCase();
    const normalizedTable = searchTable.trim().toLowerCase();
    const normalizedInvoice = searchInvoice.trim().toLowerCase();

    const matches = orders.filter((order) => {
      const orderIdMatch =
        !normalizedOrder || (order._id || "").toLowerCase().includes(normalizedOrder);
      const tableMatch =
        !normalizedTable ||
        (order.tableNumber !== undefined &&
          order.tableNumber !== null &&
          String(order.tableNumber).toLowerCase().includes(normalizedTable));
      const invoiceId = buildInvoiceId(order).toLowerCase();
      const invoiceMatch = !normalizedInvoice || invoiceId.includes(normalizedInvoice);
      return orderIdMatch && tableMatch && invoiceMatch;
    });

    if (filterStatus === "all") return matches;
    return matches.filter((order) => order.status === filterStatus);
  }, [orders, searchOrderId, searchTable, searchInvoice, filterStatus]);

  const tryAccept = (order) => {
    if (canAccept(order.status)) {
      changeStatus(order._id, nextStatusOnAccept);
    }
  };

  const transitions = ORDER_TRANSITIONS;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
        <h1 className="text-3xl font-bold text-gray-800">Takeaway Orders</h1>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Order ID / token"
            value={searchOrderId}
            onChange={(e) => setSearchOrderId(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-48"
          />
          <input
            type="text"
            placeholder="Table number"
            value={searchTable}
            onChange={(e) => setSearchTable(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-40"
          />
          <input
            type="text"
            placeholder="Invoice ID"
            value={searchInvoice}
            onChange={(e) => setSearchInvoice(e.target.value)}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-52"
          />
          <button
            onClick={() => {
              setSearchOrderId("");
              setSearchTable("");
              setSearchInvoice("");
            }}
            className="border border-gray-200 text-gray-600 hover:bg-gray-100 py-2 px-3 rounded-lg text-sm"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setFilterStatus("all")}
          className={`p-4 rounded-lg border shadow-sm text-left transition outline-none ${
            filterStatus === "all" ? "ring-2 ring-blue-400" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">{statusSummary.total}</div>
              <div className="text-sm">All Takeaway</div>
            </div>
            <div className="text-2xl">🥡</div>
          </div>
        </button>

        {Object.entries(statusSummary.byStatus).map(([status, count]) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`p-4 rounded-lg border shadow-sm text-left transition outline-none ${
              filterStatus === status ? "ring-2 ring-blue-400" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm">{status}</div>
              </div>
              <div className="text-2xl">
                {status === "Pending"
                  ? "⏳"
                  : status === "Confirmed"
                  ? "👨‍🍳"
                  : status === "Preparing"
                  ? "🔥"
                  : status === "Ready"
                  ? "🍽️"
                  : status === "Paid"
                  ? "✅"
                  : status === "Returned"
                  ? "↩️"
                  : status === "Cancelled"
                  ? "❌"
                  : "📦"}
              </div>
            </div>
          </button>
        ))}
      </div>

  <div className="overflow-x-auto bg-white rounded-lg shadow-md">
    <table className="min-w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Order Details
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Table
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {filteredOrders.length === 0 && (
          <tr>
            <td colSpan="4" className="px-6 py-4 text-center text-gray-500">
              No takeaway orders match the current filters.
            </td>
          </tr>
        )}
        {filteredOrders.map((order) => (
          <React.Fragment key={order._id}>
            <tr
              className={`hover:bg-gray-50 ${
                order.status === "Pending" ? "bg-orange-50" : ""
              }`}
            >
              <td className="px-6 py-4 text-sm">
                <button
                  onClick={() => toggleExpand(order._id)}
                  className="flex items-center gap-2"
                >
                  <span className="font-mono text-xs text-gray-500">
                    {buildInvoiceId(order)}
                  </span>
                  <span className="text-gray-900 font-medium">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </span>
                </button>
                {expanded[order._id] && (
                  <div className="mt-2 text-xs text-gray-600 space-y-1">
                    <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
                    <div>
                      Invoice:{" "}
                      <span className="font-mono">{buildInvoiceId(order)}</span>
                    </div>
                    <div>Service Type: Takeaway</div>
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🥡</span>
                  <span className="text-lg font-semibold text-gray-700">
                    {order.tableNumber || "TAKEAWAY"}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-2">
                  <span
                    className={`px-3 py-1 inline-flex items-center gap-2 text-sm font-medium rounded-full border ${statusBadgeClass(order.status)}`}
                  >
                    {order.status}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(() => {
                      const nextStatus = getNextStatus(order.status);
                      const buttons = [];

                      if (canAccept(order.status)) {
                        buttons.push(
                          <button
                            key="accept"
                            onClick={() => tryAccept(order)}
                            className="px-3 py-1 text-xs font-semibold rounded border border-green-200 text-green-700 hover:bg-green-50 bg-green-50"
                          >
                            ✅ Accept (Preparing)
                          </button>
                        );
                      }

                      if (nextStatus) {
                        buttons.push(
                          <button
                            key="next"
                            onClick={() => changeStatus(order._id, nextStatus)}
                            className="px-3 py-1 text-xs font-semibold rounded border border-blue-200 text-blue-700 hover:bg-blue-50 bg-blue-50"
                          >
                            {nextStatus}
                          </button>
                        );
                      }

                      if (canReturn(order.status)) {
                        buttons.push(
                          <button
                            key="return"
                            onClick={() => changeStatus(order._id, "Returned")}
                            className="px-3 py-1 text-xs font-semibold rounded border border-rose-200 text-rose-700 hover:bg-rose-50 bg-rose-50"
                          >
                            ↩️ Return Order
                          </button>
                        );
                      } else if (canCancel(order.status)) {
                        buttons.push(
                          <button
                            key="cancel"
                            onClick={() => changeStatus(order._id, "Cancelled")}
                            className="px-3 py-1 text-xs font-semibold rounded border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            ❌ Cancel
                          </button>
                        );
                      }

                      return buttons;
                    })()}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-sm space-x-2">
                <button
                  onClick={() => handleDelete(order._id)}
                  className="px-3 py-1 text-red-600 hover:text-red-900 border border-red-200 rounded-md hover:bg-red-50"
                >
                  🗑️ Delete
                </button>
              </td>
            </tr>

            {expanded[order._id] && (
              <tr className="bg-gray-50">
                <td colSpan="4" className="px-6 py-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(order.kotLines || []).map((kot, idx) => (
                        <div
                          key={idx}
                          className="bg-white p-4 rounded-lg border shadow-sm"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-lg font-semibold text-gray-800">
                              KOT #{idx + 1}
                            </div>
                            <div className="text-lg font-bold text-green-600">
                              ₹{(kot.totalAmount || kot.total || 0).toString()}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(kot.items || []).map((item, i) => (
                              <div
                                key={i}
                                className="flex justify-between items-center py-1 border-b"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold">
                                    {item.quantity}x
                                  </span>
                                  <span className="text-gray-800">{item.name}</span>
                                </div>
                                <span className="text-gray-600">
                                  ₹{(
                                    ((item.price || 0) / 100) *
                                    (item.quantity || 1)
                                  ).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
</div>
  );
};

export default TakeawayOrders;









