import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { FaDownload } from "react-icons/fa";
import api from "../utils/api";
import { createSocketConnection } from "../utils/socket";
import { withCancellation } from "../utils/requestManager";

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

// Get customer base URL - CRITICAL for takeaway QR codes
const customerBaseUrl = (
  import.meta.env.VITE_CUSTOMER_BASE_URL || "http://localhost:5173"
).replace(/\/$/, "");

// Warn in production if VITE_CUSTOMER_BASE_URL is not set or points to localhost
if (import.meta.env.PROD) {
  if (!import.meta.env.VITE_CUSTOMER_BASE_URL || customerBaseUrl.includes("localhost")) {
    if (import.meta.env.DEV) {
      console.error(
        "[Tables] VITE_CUSTOMER_BASE_URL is not set or points to localhost!",
        "Takeaway QR codes will not work in production.",
        "Please set VITE_CUSTOMER_BASE_URL to your deployed frontend URL (e.g., https://your-frontend.vercel.app)"
      );
    }
  }
}

const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";

const downloadQrAsPng = async (svgElement, fileName) => {
  if (!svgElement) {
    throw new Error("QR code SVG not found");
  }

  const serializer = new XMLSerializer();
  const rawSvg = serializer.serializeToString(svgElement);
  const svgMarkup = rawSvg.includes("xmlns=")
    ? rawSvg
    : rawSvg.replace(
        "<svg",
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );

  const svgBlob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    const imageLoaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = objectUrl;
    await imageLoaded;

    const exportSize = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = exportSize;
    canvas.height = exportSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context is unavailable");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, exportSize, exportSize);
    context.drawImage(image, 0, 0, exportSize, exportSize);

    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = `${fileName}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const TableCard = ({
  table,
  onUpdateStatus,
  onDelete,
  onRegenerateQr,
  onCopyLink,
  onViewWaitlist,
  busy,
}) => {
  const qrContainerRef = useRef(null);
  // Determine if table is merged (secondary table merged into another)
  const isMerged = table.status === "MERGED" || table.mergedWith;
  // Use MERGED status for display if table is merged, otherwise use actual status
  const displayStatus = isMerged ? "MERGED" : table.status;
  const statusMeta = STATUS_MAP[displayStatus] || STATUS_MAP.AVAILABLE;
  const isOfficeQr = table.qrContextType === "OFFICE";
  const qrUrl = `${customerBaseUrl}/?table=${table.qrSlug}`;
  const qrFileName = `table-${table.number}-qr`;

  const handleDownloadQr = async () => {
    try {
      const svgElement = qrContainerRef.current?.querySelector("svg");
      await downloadQrAsPng(svgElement, qrFileName);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to download table QR code:", err);
      }
      alert("Could not download QR code");
    }
  };

  return (
    <div className="min-w-0 p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-semibold text-slate-800">
            {isOfficeQr
              ? table.officeName || "Office QR"
              : `Table ${table.number}`}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            QR Type: {isOfficeQr ? "Office / Fixed Delivery" : "Table Dine-In"}
          </p>
          {table.name && <p className="text-sm text-slate-500">{table.name}</p>}
          {isOfficeQr && table.officeAddress && (
            <p className="text-xs text-slate-600 mt-1">{table.officeAddress}</p>
          )}
          {isOfficeQr && table.officePhone && (
            <p className="text-xs text-slate-600 mt-1">
              Contact: {table.officePhone}
            </p>
          )}
          {isOfficeQr && Number(table.officeDeliveryCharge || 0) > 0 && (
            <p className="text-xs text-amber-600 mt-1 font-semibold">
              Delivery Charge: Rs. {Number(table.officeDeliveryCharge).toFixed(2)}
            </p>
          )}
          {!isOfficeQr && (
            <>
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
                  Merged with: Tables{" "}
                  {table.mergedTables
                    .map((t) => (typeof t === "object" ? t.number : t))
                    .join(", ")}
                </p>
              )}
              {table.mergedWith && (
                <p className="text-xs text-purple-600 mt-1 font-semibold">
                  Merged into another table
                </p>
              )}
            </>
          )}
          {table.currentOrder && (
            <p className="text-xs text-orange-600 mt-1 break-all">
              Active order:{" "}
              {typeof table.currentOrder === "object"
                ? table.currentOrder._id || table.currentOrder.id || "Active"
                : table.currentOrder}
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
              <span className="font-mono break-all">{table.sessionToken}</span>
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-3 py-1 text-xs font-semibold rounded-full border ${statusMeta.classes}`}
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
              ? "Warning: This table has merged tables - status cannot be changed"
              : "Warning: This table is merged - status cannot be changed"}
          </p>
        )}
      </div>

      <div
        ref={qrContainerRef}
        className="flex flex-col items-center gap-2 bg-slate-50 rounded-lg py-4"
      >
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
          <button
            onClick={handleDownloadQr}
            className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            disabled={busy}
            title="Download QR"
            aria-label={`Download QR for table ${table.number}`}
          >
            <FaDownload className="text-xs" />
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
          className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={busy}
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
  const [form, setForm] = useState({
    number: "",
    capacity: "",
    name: "",
    qrContextType: "TABLE",
    officeName: "",
    officeAddress: "",
    officePhone: "",
    officeDeliveryCharge: "",
  });
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
  const takeawayQrRef = useRef(null);
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
      if (import.meta.env.DEV) {
        console.error(err);
      }
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
      if (!payload?.id || !payload?.status) {
        if (import.meta.env.DEV) {
          console.warn("[Tables] Received invalid table status update:", payload);
        }
        return;
      }
      console.log("[Tables] Received table:status:updated:", {
        id: payload.id,
        number: payload.number,
        status: payload.status,
      });
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
          console.log("[Tables] Joining socket room with userId:", userId);
          socket.emit("join:cafe", userId);
          // Also join cart room for compatibility
          socket.emit("join:cart", userId);
          // Remember this cart admin ID so we can generate takeaway QR specific to this cart
          setCartId(userId);
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[Tables] Could not decode token for socket room:", e);
        }
      }
    } else {
      console.warn("[Tables] No token found - socket room not joined");
    }

    const handleTableMerged = (payload) => {
      if (!payload?.primaryTable) return;
      // Refresh tables to get updated merge status
      fetchTables();
    };

    const handleTableUnmerged = (payload) => {
      if (!payload) return;
      // Refresh tables to get updated unmerge status
      fetchTables();
    };

    socket.on("table:status:updated", handleTableStatusUpdated);
    socket.on("table:merged", handleTableMerged);
    socket.on("table:unmerged", handleTableUnmerged);

    return () => {
      socket.off("table:status:updated", handleTableStatusUpdated);
      socket.off("table:merged", handleTableMerged);
      socket.off("table:unmerged", handleTableUnmerged);
      socket.disconnect();
    };
  }, []);

  // Separate effect for waitlist updates to avoid dependency issues
  useEffect(() => {
    if (!socketRef.current) return;

    const handleWaitlistUpdated = (payload) => {
      // Refresh waitlist if modal is open for the affected table
      if (
        waitlistModal.open &&
        waitlistModal.table?._id &&
        payload?.tableId &&
        (waitlistModal.table._id.toString() === payload.tableId.toString() ||
          waitlistModal.table.id?.toString() === payload.tableId.toString())
      ) {
        // Reload waitlist to get updated positions
        loadWaitlistForTable(waitlistModal.table);
      }
      // Also update waitlist count for the table
      if (payload?.tableId) {
        // Trigger a refresh of tables to update waitlist counts
        fetchTables();
      }
    };

    const socket = socketRef.current;
    socket.on("waitlistUpdated", handleWaitlistUpdated);

    return () => {
      socket.off("waitlistUpdated", handleWaitlistUpdated);
    };
  }, [waitlistModal.open, waitlistModal.table?._id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isOfficeQr = form.qrContextType === "OFFICE";
    if (!isOfficeQr && (!form.number || !form.capacity)) {
      alert("Table number and capacity are required");
      return;
    }
    if (isOfficeQr && !form.officeName.trim()) {
      alert("Office name is required for Office QR");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name || undefined,
        qrContextType: form.qrContextType || "TABLE",
        officeName:
          isOfficeQr && form.officeName.trim() ? form.officeName.trim() : undefined,
        officeAddress:
          isOfficeQr && form.officeAddress.trim()
            ? form.officeAddress.trim()
            : undefined,
        officePhone:
          isOfficeQr && form.officePhone.trim() ? form.officePhone.trim() : undefined,
        officeDeliveryCharge:
          isOfficeQr &&
          form.officeDeliveryCharge !== "" &&
          Number(form.officeDeliveryCharge) >= 0
            ? Number(form.officeDeliveryCharge)
            : undefined,
      };

      if (!isOfficeQr) {
        payload.number = Number(form.number);
        payload.capacity = Number(form.capacity);
      }

      await api.post("/tables", {
        ...payload,
      });
      setForm({
        number: "",
        capacity: "",
        name: "",
        qrContextType: "TABLE",
        officeName: "",
        officeAddress: "",
        officePhone: "",
        officeDeliveryCharge: "",
      });
      fetchTables();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add table");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    setBusyId(id);
    const requestType = `table-status-${id}`;

    try {
      const { data } = await withCancellation(requestType, async (signal) => {
        return await api.patch(`/tables/${id}`, { status }, { signal });
      });
      setTables((prev) =>
        prev.map((t) => (t._id === id ? { ...t, ...data } : t))
      );
    } catch (err) {
      // Ignore AbortError (request was cancelled)
      if (err.name === "AbortError" || err.code === "ERR_CANCELED") {
        return;
      }
      alert(err.response?.data?.message || "Failed to update table");
      fetchTables();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (e, table) => {
    e.preventDefault();
    e.stopPropagation();

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to delete table "${table.number}"?`,
      {
        title: "Delete Table",
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

  const handleDownloadTakeawayQr = async () => {
    if (!cartId) return;
    try {
      const svgElement = takeawayQrRef.current?.querySelector("svg");
      await downloadQrAsPng(svgElement, `takeaway-qr-${cartId}`);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Failed to download takeaway QR code:", err);
      }
      alert("Could not download takeaway QR code");
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
      // Sort entries by position to ensure correct order
      const sortedEntries = entries.sort((a, b) => {
        const posA = a.position || 999;
        const posB = b.position || 999;
        return posA - posB;
      });
      setWaitlistModal((prev) => ({
        ...prev,
        entries: sortedEntries,
        loading: false,
      }));
      updateTableWaitlistCount(table._id, sortedEntries.length);
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
            {/* Warning if VITE_CUSTOMER_BASE_URL is not set or points to localhost in production */}
            {import.meta.env.PROD &&
              (!import.meta.env.VITE_CUSTOMER_BASE_URL ||
                customerBaseUrl.includes("localhost")) && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">
                    Configuration Error
                  </p>
                  <p className="text-xs text-red-600">
                    VITE_CUSTOMER_BASE_URL is not set or points to localhost.
                    Takeaway QR codes will not work. Please set{" "}
                    <span className="font-mono">VITE_CUSTOMER_BASE_URL</span>{" "}
                    to your deployed frontend URL (e.g.,{" "}
                    <span className="font-mono">
                      https://your-frontend.vercel.app
                    </span>
                    ) in your deployment environment variables.
                  </p>
                </div>
              )}
          </div>
          <div
            ref={takeawayQrRef}
            className="flex flex-col items-center gap-2 bg-slate-50 rounded-lg px-4 py-4"
          >
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyLink(takeawayUrl)}
                      className="text-xs px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
                    >
                      Copy link
                    </button>
                    <button
                      onClick={handleDownloadTakeawayQr}
                      className="inline-flex items-center justify-center px-2.5 py-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      title="Download takeaway QR"
                      aria-label="Download takeaway QR code"
                    >
                      <FaDownload className="text-xs" />
                    </button>
                  </div>
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
          className="grid grid-cols-1 md:grid-cols-6 gap-4"
        >
          {form.qrContextType !== "OFFICE" && (
            <>
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Number
                </label>
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
            </>
          )}
          <div>
            <label className="block text-sm text-slate-500 mb-1">QR Type</label>
            <select
              value={form.qrContextType}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, qrContextType: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
            >
              <option value="TABLE">Table (Dine-in)</option>
              <option value="OFFICE">Office / Fixed Customer</option>
            </select>
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
          {form.qrContextType === "OFFICE" && (
            <>
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Office Name
                </label>
                <input
                  value={form.officeName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, officeName: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="e.g. ABC Tech Park"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Office Phone
                </label>
                <input
                  value={form.officePhone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, officePhone: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Delivery Charge (Rs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.officeDeliveryCharge}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      officeDeliveryCharge: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="e.g. 40"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-500 mb-1">
                  Office Address
                </label>
                <input
                  value={form.officeAddress}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      officeAddress: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Full office delivery address"
                />
              </div>
            </>
          )}
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                  Waitlist - Table {waitlistModal.table?.number}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Capacity {waitlistModal.table?.capacity}
                </p>
              </div>
              <button
                onClick={closeWaitlistModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 ml-2 flex-shrink-0"
                aria-label="Close"
              >
                x
              </button>
            </div>
            <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700">
                    Total waiting: {waitlistModal.entries.length}
                  </p>
                  {waitlistModal.message && (
                    <p className="text-xs text-emerald-600 mt-1 break-words">
                      {waitlistModal.message}
                    </p>
                  )}
                  {waitlistModal.error && !waitlistModal.loading && (
                    <p className="text-xs text-red-600 mt-1 break-words">
                      {waitlistModal.error}
                    </p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => loadWaitlistForTable(waitlistModal.table)}
                    disabled={waitlistModal.busy || waitlistModal.loading}
                    className="w-full sm:w-auto text-xs sm:text-sm px-3 py-2 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
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
                    className="w-full sm:w-auto text-xs sm:text-sm px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
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
                              Position #{entry.position || index + 1} - Token{" "}
                              {entry.token}
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
