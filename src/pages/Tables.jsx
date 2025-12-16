<<<<<<< HEAD
import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import api from "../utils/api";
import io from "socket.io-client";
=======
import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import api from '../utils/api';
import { createSocketConnection } from '../utils/socket';
>>>>>>> 20f90b1beb1f7316c5062fa770e309cc93bc2f81

const STATUS_MAP = {
  AVAILABLE: {
    label: "Available",
    classes: "bg-green-100 text-green-700 border-green-300",
  },
  OCCUPIED: {
    label: "Occupied",
    classes: "bg-red-100 text-red-700 border-red-300",
  },
  CLEANING: {
    label: "Cleaning",
    classes: "bg-slate-100 text-slate-600 border-slate-300",
  },
  MERGED: {
    label: "Merged",
    classes: "bg-purple-100 text-purple-700 border-purple-300",
  },
  RESERVED: {
    label: "Reserved",
    classes: "bg-yellow-100 text-yellow-700 border-yellow-300",
  },
};

const STATUS_OPTIONS = Object.keys(STATUS_MAP);
const STATUS_SELECTABLE = ["AVAILABLE", "OCCUPIED"];

const customerBaseUrl = (
  import.meta.env.VITE_CUSTOMER_BASE_URL || "http://localhost:5173"
).replace(/\/$/, "");
const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";

const TableCard = ({
  table,
  onUpdateStatus,
  onDelete,
  onRegenerateQr,
  onCopyLink,
  onViewWaitlist,
  busy,
}) => {
  // Determine if table is merged (secondary table merged into another)
  const isMerged = table.status === "MERGED" || table.mergedWith;
  // Use MERGED status for display if table is merged, otherwise use actual status
  const displayStatus = isMerged ? "MERGED" : table.status;
  const statusMeta = STATUS_MAP[displayStatus] || STATUS_MAP.AVAILABLE;
  const qrUrl = `${customerBaseUrl}/?table=${table.qrSlug}`;

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">
            Table {table.number}
          </h3>
          {table.name && <p className="text-sm text-slate-500">{table.name}</p>}
          <p className="text-sm text-slate-500 mt-1">
            Capacity: {table.capacity}
            {table.totalCapacity && table.totalCapacity > table.capacity && (
              <span className="text-purple-600 ml-1">
                (Total: {table.totalCapacity} with merged tables)
              </span>
            )}
          </p>
          {table.mergedTables && table.mergedTables.length > 0 && (
            <p className="text-xs text-purple-600 mt-1 font-semibold">
              🔗 Merged with: Tables{" "}
              {table.mergedTables
                .map((t) => (typeof t === "object" ? t.number : t))
                .join(", ")}
            </p>
          )}
          {table.mergedWith && (
            <p className="text-xs text-purple-600 mt-1 font-semibold">
              🔗 Merged into another table
            </p>
          )}
          {table.currentOrder && (
            <p className="text-xs text-orange-600 mt-1">
              Active order: {table.currentOrder}
            </p>
          )}
          {typeof table.waitlistLength === "number" && (
            <p className="text-xs text-blue-600 mt-1">
              Waitlist: {table.waitlistLength}{" "}
              {table.waitlistLength === 1 ? "party" : "parties"}
            </p>
          )}
          {table.sessionToken && table.status !== "AVAILABLE" && (
            <p className="text-xs text-emerald-600 mt-1">
              Session code:{" "}
              <span className="font-mono">{table.sessionToken}</span>
            </p>
          )}
        </div>
        <span
          className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusMeta.classes}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="bg-slate-50 rounded-lg px-4 py-3">
        <label className="text-xs uppercase tracking-wide text-slate-500 block mb-2">
          Status
        </label>
        <select
          value={displayStatus}
          onChange={(e) => onUpdateStatus(table._id, e.target.value)}
          disabled={busy || table.mergedTables?.length > 0 || table.mergedWith}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {STATUS_OPTIONS.map((status) => {
            const isSelectable = STATUS_SELECTABLE.includes(status);
            if (!isSelectable && status !== displayStatus) {
              return null;
            }
            return (
              <option key={status} value={status} disabled={!isSelectable}>
                {STATUS_MAP[status]?.label || status}
                {!isSelectable ? " (auto)" : ""}
              </option>
            );
          })}
        </select>
        {(table.mergedTables?.length > 0 || table.mergedWith) && (
          <p className="text-xs text-purple-600 mt-1">
            {table.mergedTables?.length > 0
              ? "⚠️ This table has merged tables - status cannot be changed"
              : "⚠️ This table is merged - status cannot be changed"}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 bg-slate-50 rounded-lg py-4">
        <QRCode value={qrUrl} size={128} bgColor="#ffffff" fgColor="#1f2937" />
        <div className="text-xs text-slate-500 break-all text-center px-2">
          {qrUrl}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onCopyLink(qrUrl)}
            className="text-xs px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
            disabled={busy}
          >
            Copy link
          </button>
          <button
            onClick={() => onRegenerateQr(table._id)}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300"
            disabled={busy}
          >
            New QR
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400">
          Last updated {new Date(table.updatedAt).toLocaleString()}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(e, table);
          }}
          className="text-xs text-red-600 hover:text-red-700"
          disabled={busy || Boolean(table.currentOrder)}
        >
          Delete
        </button>
      </div>
      <button
        onClick={() => onViewWaitlist(table)}
        className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 text-left"
        disabled={busy}
      >
        Manage waitlist
        {typeof table.waitlistLength === "number"
          ? ` (${table.waitlistLength})`
          : ""}
      </button>
    </div>
  );
};

const Tables = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ number: "", capacity: "", name: "" });
  const [busyId, setBusyId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [waitlistModal, setWaitlistModal] = useState({
    open: false,
    table: null,
    entries: [],
    loading: false,
    error: null,
    busy: false,
    message: null,
  });
  const socketRef = useRef(null);
  const [cartId, setCartId] = useState(null);

  const sortedTables = useMemo(() => {
    if (!Array.isArray(tables)) return [];
    return [...tables].sort((a, b) => a.number - b.number);
  }, [tables]);

  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/tables");
      // Ensure tables is always an array
      let tablesData = [];
      if (Array.isArray(res.data)) {
        tablesData = res.data;
      } else if (res.data && Array.isArray(res.data.tables)) {
        tablesData = res.data.tables;
      } else if (res.data && Array.isArray(res.data.data)) {
        tablesData = res.data.data;
      }
      setTables(tablesData);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load tables");
      setTables([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // --- Socket setup for live table status updates ---
  useEffect(() => {
    const socket = createSocketConnection();
    socketRef.current = socket;

    const handleTableStatusUpdated = (payload) => {
      if (!payload?.id || !payload?.status) return;
      setTables((prev) =>
        prev.map((t) =>
          t._id === payload.id || t.id === payload.id
            ? {
                ...t,
                status: payload.status,
                currentOrder: payload.currentOrder || null,
                sessionToken: payload.sessionToken || t.sessionToken,
              }
            : t
        )
      );
    };

    const token =
      localStorage.getItem("adminToken") ||
      localStorage.getItem("franchiseAdminToken") ||
      localStorage.getItem("superAdminToken");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const userId = payload.id;
        if (userId) {
          socket.emit("join:cafe", userId);
          // Remember this cart admin ID so we can generate takeaway QR specific to this cart
          setCartId(userId);
        }
      } catch (e) {
        console.warn("[Tables] Could not decode token for socket room:", e);
      }
    }

    socket.on("table:status:updated", handleTableStatusUpdated);

    return () => {
      socket.off("table:status:updated", handleTableStatusUpdated);
      socket.disconnect();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.number || !form.capacity) {
      alert("Table number and capacity are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/tables", {
        number: Number(form.number),
        capacity: Number(form.capacity),
        name: form.name || undefined,
      });
      setForm({ number: "", capacity: "", name: "" });
      fetchTables();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add table");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setBusyId(id);
    try {
      const { data } = await api.patch(`/tables/${id}`, { status });
      setTables((prev) =>
        prev.map((t) => (t._id === id ? { ...t, ...data } : t))
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update table");
      fetchTables();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (e, table) => {
    e.preventDefault();
    e.stopPropagation();

    if (table.currentOrder) {
      alert("Cannot delete table with an active order.");
      return;
    }

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE table "${table.number}"?\n\nThis action cannot be undone.`,
      {
        title: "Delete Table",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    setBusyId(table._id);
    try {
      await api.delete(`/tables/${table._id}`);
      setTables((prev) => prev.filter((t) => t._id !== table._id));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete table");
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenerateQr = async (id) => {
    setBusyId(id);
    try {
      const { data } = await api.post(`/tables/${id}/reset-qr`);
      setTables((prev) =>
        prev.map((t) => (t._id === id ? { ...t, qrSlug: data.qrSlug } : t))
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to regenerate QR");
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard");
    } catch {
      alert("Could not copy link");
    }
  };

  const visibleTables = useMemo(() => {
    let filtered = sortedTables;

    // Filter by status if not "ALL"
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((table) => {
        // For merged tables, check both the actual status and if they have mergedWith
        const isMerged = table.status === "MERGED" || table.mergedWith;
        if (statusFilter === "MERGED" && isMerged) {
          return true; // Show merged tables when filtering by MERGED
        }
        if (statusFilter !== "MERGED" && isMerged) {
          return false; // Hide merged tables when filtering by other statuses
        }
        return table.status === statusFilter;
      });
    }

    // Show all tables including merged ones - don't filter them out
    // They will be displayed with MERGED status

    return filtered;
  }, [sortedTables, statusFilter]);

  const updateTableWaitlistCount = (tableId, count) => {
    setTables((prev) =>
      prev.map((t) => (t._id === tableId ? { ...t, waitlistLength: count } : t))
    );
    setWaitlistModal((prev) =>
      prev.table?._id === tableId
        ? {
            ...prev,
            table: { ...prev.table, waitlistLength: count },
          }
        : prev
    );
  };

  const loadWaitlistForTable = async (table) => {
    if (!table?._id) return;
    setWaitlistModal((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const { data } = await api.get(`/waitlist/table/${table._id}`);
      const entries = Array.isArray(data) ? data : [];
      setWaitlistModal((prev) => ({
        ...prev,
        entries,
        loading: false,
      }));
      updateTableWaitlistCount(table._id, entries.length);
    } catch (err) {
      setWaitlistModal((prev) => ({
        ...prev,
        loading: false,
        error: err.response?.data?.message || "Failed to load waitlist",
      }));
    }
  };

  const handleViewWaitlist = async (table) => {
    setWaitlistModal({
      open: true,
      table,
      entries: [],
      loading: true,
      error: null,
      busy: false,
      message: null,
    });
    loadWaitlistForTable(table);
  };

  const closeWaitlistModal = () => {
    setWaitlistModal({
      open: false,
      table: null,
      entries: [],
      loading: false,
      error: null,
      busy: false,
      message: null,
    });
  };

  const ensureTableInModal = () =>
    waitlistModal.table?._id ? waitlistModal.table : null;

  const handleNotifyNext = async () => {
    const table = ensureTableInModal();
    if (!table) return;
    setWaitlistModal((prev) => ({
      ...prev,
      busy: true,
      error: null,
      message: null,
    }));
    try {
      const { data } = await api.post(
        `/waitlist/table/${table._id}/notify-next`
      );
      await loadWaitlistForTable(table);
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        message: data
          ? `Notified ${data.token}`
          : "No guests were waiting in the queue.",
      }));
    } catch (err) {
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        error: err.response?.data?.message || "Failed to notify the next guest",
      }));
    }
  };

  const handleNotifyEntry = async (token) => {
    const table = ensureTableInModal();
    if (!table) return;
    setWaitlistModal((prev) => ({
      ...prev,
      busy: true,
      error: null,
      message: null,
    }));
    try {
      await api.patch(`/waitlist/${token}/notify`);
      await loadWaitlistForTable(table);
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        message: `Guest ${token} has been notified.`,
      }));
    } catch (err) {
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        error: err.response?.data?.message || "Failed to notify guest",
      }));
    }
  };

  const handleSeatEntry = async (token) => {
    const table = ensureTableInModal();
    if (!table) return;
    setWaitlistModal((prev) => ({
      ...prev,
      busy: true,
      error: null,
      message: null,
    }));
    try {
      const { data } = await api.patch(`/waitlist/${token}/seat`);
      await loadWaitlistForTable(table);
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        message: data?.sessionToken
          ? `Guest ${token} seated. Share session code ${data.sessionToken} with them.`
          : `Guest ${token} marked as seated.`,
      }));
    } catch (err) {
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        error: err.response?.data?.message || "Failed to update guest status",
      }));
    }
  };

  const handleCancelEntry = async (token) => {
    const table = ensureTableInModal();
    if (!table) return;
    // CRITICAL: window.confirm is now async, must await it
    const confirmed = await window.confirm(
      "Remove this guest from the waitlist?"
    );
    if (!confirmed) return;
    setWaitlistModal((prev) => ({
      ...prev,
      busy: true,
      error: null,
      message: null,
    }));
    try {
      await api.delete(`/waitlist/${token}`);
      await loadWaitlistForTable(table);
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        message: `Guest ${token} removed from the waitlist.`,
      }));
    } catch (err) {
      setWaitlistModal((prev) => ({
        ...prev,
        busy: false,
        error: err.response?.data?.message || "Failed to remove guest",
      }));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">Table Management</h1>
        <button
          onClick={fetchTables}
          className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {/* Takeaway QR - single QR per cart for takeaway-only orders */}
      {cartId && (
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-700 mb-1">
              Takeaway QR Code
            </h2>
            <p className="text-sm text-slate-500 max-w-md">
              Scan this QR to place{" "}
              <span className="font-semibold">takeaway orders only</span> for
              this cart. The customer app will hide the Dine-In option after
              scanning.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Cart ID: <span className="font-mono">{cartId}</span>
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 bg-slate-50 rounded-lg px-4 py-4">
            {(() => {
              const takeawayUrl = `${customerBaseUrl}/?takeaway=1&cart=${encodeURIComponent(
                cartId
              )}`;
              return (
                <>
                  <QRCode
                    value={takeawayUrl}
                    size={128}
                    bgColor="#ffffff"
                    fgColor="#1f2937"
                  />
                  <div className="text-xs text-slate-500 break-all text-center px-2">
                    {takeawayUrl}
                  </div>
                  <button
                    onClick={() => handleCopyLink(takeawayUrl)}
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    Copy link
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-700 mb-4">
          Add a Table
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div>
            <label className="block text-sm text-slate-500 mb-1">Number</label>
            <input
              type="number"
              value={form.number}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, number: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="e.g. 12"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">
              Capacity
            </label>
            <input
              type="number"
              value={form.capacity}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, capacity: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="e.g. 4"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">
              Label (optional)
            </label>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Window, Patio..."
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Add Table"}
            </button>
          </div>
        </form>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600">
          Filter by status:
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="ALL">All tables</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_MAP[status].label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading tables...</div>
      ) : visibleTables.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">
          {statusFilter === "ALL"
            ? "No tables configured yet."
            : `No tables are currently ${STATUS_MAP[
                statusFilter
              ]?.label?.toLowerCase()}.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleTables.map((table) => (
            <TableCard
              key={table._id}
              table={table}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDelete}
              onRegenerateQr={handleRegenerateQr}
              onCopyLink={handleCopyLink}
              onViewWaitlist={handleViewWaitlist}
              busy={busyId === table._id}
            />
          ))}
        </div>
      )}
      {waitlistModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Waitlist · Table {waitlistModal.table?.number}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Capacity {waitlistModal.table?.capacity}
                </p>
              </div>
              <button
                onClick={closeWaitlistModal}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Total waiting: {waitlistModal.entries.length}
                  </p>
                  {waitlistModal.message && (
                    <p className="text-xs text-emerald-600 mt-1">
                      {waitlistModal.message}
                    </p>
                  )}
                  {waitlistModal.error && !waitlistModal.loading && (
                    <p className="text-xs text-red-600 mt-1">
                      {waitlistModal.error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadWaitlistForTable(waitlistModal.table)}
                    disabled={waitlistModal.busy || waitlistModal.loading}
                    className="text-xs px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={handleNotifyNext}
                    disabled={
                      waitlistModal.busy ||
                      waitlistModal.loading ||
                      waitlistModal.entries.length === 0
                    }
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Notify next guest
                  </button>
                </div>
              </div>

              {waitlistModal.loading ? (
                <div className="text-sm text-slate-500">
                  Loading waitlist...
                </div>
              ) : waitlistModal.entries.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No parties waiting. Guests will appear here as soon as they
                  join the queue.
                </div>
              ) : (
                <ol className="space-y-3">
                  {waitlistModal.entries.map((entry, index) => {
                    const createdTime = entry.createdAt
                      ? new Date(entry.createdAt).toLocaleTimeString()
                      : null;
                    const notifiedTime = entry.notifiedAt
                      ? new Date(entry.notifiedAt).toLocaleTimeString()
                      : null;
                    const isWaiting = entry.status === "WAITING";
                    const isNotified = entry.status === "NOTIFIED";

                    return (
                      <li
                        key={entry._id || entry.token}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              #{index + 1} · Token {entry.token}
                            </p>
                            {entry.name && (
                              <p className="text-xs text-slate-500 mt-1">
                                Name: {entry.name}
                              </p>
                            )}
                            <p className="text-xs text-slate-500 mt-1">
                              Party size: {entry.partySize || 1}
                            </p>
                            {createdTime && (
                              <p className="text-xs text-slate-400 mt-1">
                                Added at {createdTime}
                              </p>
                            )}
                            {notifiedTime && (
                              <p className="text-xs text-emerald-500 mt-1">
                                Notified at {notifiedTime}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs font-semibold ${
                              isNotified ? "text-emerald-600" : "text-slate-500"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {isWaiting && (
                            <button
                              onClick={() => handleNotifyEntry(entry.token)}
                              disabled={waitlistModal.busy}
                              className="text-xs px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            >
                              Notify now
                            </button>
                          )}
                          {isNotified && (
                            <button
                              onClick={() => handleSeatEntry(entry.token)}
                              disabled={waitlistModal.busy}
                              className="text-xs px-3 py-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                            >
                              Mark as seated
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelEntry(entry.token)}
                            disabled={waitlistModal.busy}
                            className="text-xs px-3 py-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tables;
