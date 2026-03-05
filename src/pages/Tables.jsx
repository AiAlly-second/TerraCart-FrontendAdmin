import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { NavLink } from "react-router-dom";
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

const trimTrailingSlash = (value = "") => String(value || "").replace(/\/+$/, "");

// Get customer base URL used in QR links.
// Priority:
// 1) VITE_CUSTOMER_BASE_URL (explicit)
// 2) current origin (safe fallback when frontend and admin share a domain)
// 3) localhost (dev fallback)
const configuredCustomerBaseUrl = trimTrailingSlash(
  import.meta.env.VITE_CUSTOMER_BASE_URL || "",
);
const customerBaseUrl = configuredCustomerBaseUrl
  ? configuredCustomerBaseUrl
  : typeof window !== "undefined" && window.location?.origin
    ? trimTrailingSlash(window.location.origin)
    : "http://localhost:5173";
const hasConfiguredCustomerBaseUrl = configuredCustomerBaseUrl.length > 0;
const isLocalhostCustomerBase =
  customerBaseUrl.includes("localhost") ||
  customerBaseUrl.includes("127.0.0.1");

// Warn in production when QR base URL is likely incorrect.
if (import.meta.env.PROD) {
  if (isLocalhostCustomerBase) {
    console.warn(
      "[Tables] Customer QR base URL resolves to localhost in production.",
      "Set VITE_CUSTOMER_BASE_URL to the deployed customer frontend URL.",
    );
  } else if (!hasConfiguredCustomerBaseUrl) {
    console.warn(
      "[Tables] VITE_CUSTOMER_BASE_URL is not set. Using current origin fallback:",
      customerBaseUrl,
    );
  }
}

const nodeApi = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
const PANEL_TABLE = "TABLE";
const PANEL_OFFICE = "OFFICE";
const PANEL_TAKEAWAY = "TAKEAWAY";

const createDefaultFormState = (panelType = PANEL_TABLE) => ({
  number: "",
  capacity: "",
  name: "",
  qrContextType: panelType === PANEL_OFFICE ? PANEL_OFFICE : PANEL_TABLE,
  officeName: "",
  officeAddress: "",
  officePhone: "",
  officeDeliveryCharge: "",
  officePaymentMode: "ONLINE",
});

const createEditFormState = (table) => ({
  number: table?.number != null ? String(table.number) : "",
  capacity: table?.capacity != null ? String(table.capacity) : "",
  name: table?.name || "",
  officeName: table?.officeName || "",
  officeAddress: table?.officeAddress || "",
  officePhone: table?.officePhone || "",
  officeDeliveryCharge:
    table?.officeDeliveryCharge != null
      ? String(table.officeDeliveryCharge)
      : "",
  officePaymentMode:
    String(table?.officePaymentMode || "ONLINE").toUpperCase() === "COD"
      ? "COD"
      : String(table?.officePaymentMode || "ONLINE").toUpperCase() === "BOTH"
        ? "BOTH"
        : "ONLINE",
});

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
  onEdit,
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
          {isOfficeQr && (
            <p className="text-xs text-indigo-600 mt-1 font-semibold">
              Payment:{" "}
              {String(table.officePaymentMode || "ONLINE").toUpperCase() === "COD"
                ? "COD Only"
                : String(table.officePaymentMode || "ONLINE").toUpperCase() ===
                    "BOTH"
                  ? "Online + COD"
                  : "Online Only"}
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
        {!isOfficeQr && (
          <span
            className={`shrink-0 px-3 py-1 text-xs font-semibold rounded-full border ${statusMeta.classes}`}
          >
            {statusMeta.label}
          </span>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg px-4 py-3">
        {!isOfficeQr ? (
          <>
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
          </>
        ) : (
          <>
            <label className="text-xs uppercase tracking-wide text-slate-500 block mb-1">
              Status
            </label>
            <p className="text-xs text-slate-500">
              Not applicable for Office QR.
            </p>
          </>
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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(table);
            }}
            className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={busy}
          >
            Edit
          </button>
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
      </div>
      {!isOfficeQr && (
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
      )}
    </div>
  );
};

const Tables = ({ panelType = PANEL_TABLE }) => {
  const isOfficePanel = panelType === PANEL_OFFICE;
  const isTablePanel = panelType === PANEL_TABLE;
  const isTakeawayPanel = panelType === PANEL_TAKEAWAY;
  const isFixedPanelType = isOfficePanel || isTablePanel || isTakeawayPanel;

  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(() => createDefaultFormState(panelType));
  const [busyId, setBusyId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editModal, setEditModal] = useState({
    open: false,
    table: null,
    form: createDefaultFormState(panelType),
    saving: false,
  });
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

  useEffect(() => {
    setForm(createDefaultFormState(panelType));
    setEditModal({
      open: false,
      table: null,
      form: createDefaultFormState(panelType),
      saving: false,
    });
  }, [panelType]);

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
    const selectedQrContextType = isOfficePanel
      ? PANEL_OFFICE
      : isTablePanel
        ? PANEL_TABLE
        : form.qrContextType || PANEL_TABLE;
    const isOfficeQr = selectedQrContextType === PANEL_OFFICE;
    if (!isOfficeQr && (!form.number || !form.capacity)) {
      alert("Table number and capacity are required");
      return;
    }
    if (isOfficeQr && !form.officeName.trim()) {
      alert("Office name is required for Office QR");
      return;
    }
    if (isOfficeQr && !form.officeAddress.trim()) {
      alert("Office address is required for Office QR");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: isOfficeQr ? undefined : form.name || undefined,
        qrContextType: selectedQrContextType,
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
        officePaymentMode: isOfficeQr
          ? String(form.officePaymentMode || "ONLINE").toUpperCase() === "COD"
            ? "COD"
            : String(form.officePaymentMode || "ONLINE").toUpperCase() ===
                "BOTH"
              ? "BOTH"
              : "ONLINE"
          : undefined,
      };

      if (!isOfficeQr) {
        payload.number = Number(form.number);
        payload.capacity = Number(form.capacity);
      }

      await api.post("/tables", {
        ...payload,
      });
      setForm(createDefaultFormState(panelType));
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

  const openEditModal = (table) => {
    if (!table?._id) return;
    setEditModal({
      open: true,
      table,
      form: createEditFormState(table),
      saving: false,
    });
  };

  const closeEditModal = () => {
    setEditModal((prev) => ({
      ...prev,
      open: false,
      table: null,
      form: createDefaultFormState(panelType),
      saving: false,
    }));
  };

  const handleEditFieldChange = (field, value) => {
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        [field]: value,
      },
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const currentTable = editModal.table;
    if (!currentTable?._id) return;

    const isOfficeQr = currentTable.qrContextType === PANEL_OFFICE;
    if (!isOfficeQr && (!editModal.form.number || !editModal.form.capacity)) {
      alert("Table number and capacity are required");
      return;
    }
    if (isOfficeQr && !String(editModal.form.officeName || "").trim()) {
      alert("Office name is required for Office QR");
      return;
    }
    if (isOfficeQr && !String(editModal.form.officeAddress || "").trim()) {
      alert("Office address is required for Office QR");
      return;
    }

    setEditModal((prev) => ({ ...prev, saving: true }));
    try {
      const payload = {
        name: editModal.form.name || undefined,
      };

      if (isOfficeQr) {
        payload.qrContextType = PANEL_OFFICE;
        payload.officeName = String(editModal.form.officeName || "").trim();
        payload.officeAddress = String(editModal.form.officeAddress || "").trim();
        payload.officePhone = String(editModal.form.officePhone || "").trim() || undefined;
        payload.officeDeliveryCharge =
          editModal.form.officeDeliveryCharge !== "" &&
          Number(editModal.form.officeDeliveryCharge) >= 0
            ? Number(editModal.form.officeDeliveryCharge)
            : 0;
        payload.officePaymentMode =
          String(editModal.form.officePaymentMode || "ONLINE").toUpperCase() ===
          "COD"
            ? "COD"
            : String(editModal.form.officePaymentMode || "ONLINE").toUpperCase() ===
                "BOTH"
              ? "BOTH"
              : "ONLINE";
      } else {
        payload.qrContextType = PANEL_TABLE;
        payload.number = Number(editModal.form.number);
        payload.capacity = Number(editModal.form.capacity);
      }

      const { data } = await api.patch(`/tables/${currentTable._id}`, payload);
      if (data?._id) {
        setTables((prev) =>
          prev.map((table) => (table._id === currentTable._id ? data : table))
        );
      } else {
        await fetchTables();
      }
      closeEditModal();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update details");
      setEditModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleDelete = async (e, table) => {
    e.preventDefault();
    e.stopPropagation();
    const tableLabel =
      table?.qrContextType === PANEL_OFFICE
        ? table.officeName || `Office QR ${table.number}`
        : `Table ${table.number}`;

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to delete "${tableLabel}"?`,
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
    let filtered = sortedTables.filter((table) => {
      const isOfficeQr = table.qrContextType === PANEL_OFFICE;
      if (isOfficePanel) return isOfficeQr;
      if (isTablePanel) return !isOfficeQr;
      return true;
    });

    // Filter by status for table panel only.
    if (!isOfficePanel && statusFilter !== "ALL") {
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
  }, [sortedTables, statusFilter, isOfficePanel, isTablePanel]);

  const qrContextCounts = useMemo(() => {
    const officeCount = sortedTables.filter(
      (table) => table.qrContextType === PANEL_OFFICE,
    ).length;
    const tableCount = sortedTables.length - officeCount;
    return { officeCount, tableCount };
  }, [sortedTables]);

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

  const selectedFormQrType = isOfficePanel
    ? PANEL_OFFICE
    : isTablePanel
      ? PANEL_TABLE
      : form.qrContextType;
  const editingOfficeQr = editModal.table?.qrContextType === PANEL_OFFICE;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-800">
          {isTakeawayPanel
            ? "Takeaway QR Management"
            : isOfficePanel
              ? "Office QR Management"
              : "Table Management"}
        </h1>
        <button
          onClick={fetchTables}
          className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>
      <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <NavLink
              to="/tables"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-[#ff6b35] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`
              }
            >
              Tables
            </NavLink>
            <NavLink
              to="/offices"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-[#ff6b35] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`
              }
            >
              Offices
            </NavLink>
            <NavLink
              to="/takeaway-qr"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-[#ff6b35] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`
              }
            >
              Takeaway
            </NavLink>
            <NavLink
              to="/table-dashboard"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-[#ff6b35] text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`
              }
            >
              Table Dashboard
            </NavLink>
          </div>
          <p className="text-xs text-slate-500">
            Manage all QR and table panels from here.
          </p>
        </div>
      </div>

      {/* Takeaway QR - single QR per cart for takeaway-only orders */}
      {cartId && isTakeawayPanel && (
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
            {import.meta.env.PROD && isLocalhostCustomerBase && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-semibold text-red-700 mb-1">
                  Configuration Error
                </p>
                <p className="text-xs text-red-600">
                  Customer QR links currently point to localhost, which will not
                  work for users. Set{" "}
                  <span className="font-mono">VITE_CUSTOMER_BASE_URL</span> to
                  your deployed customer frontend URL.
                </p>
              </div>
            )}
            {import.meta.env.PROD &&
              !hasConfiguredCustomerBaseUrl &&
              !isLocalhostCustomerBase && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800 mb-1">
                    Configuration Notice
                  </p>
                  <p className="text-xs text-amber-700">
                    <span className="font-mono">VITE_CUSTOMER_BASE_URL</span>{" "}
                    is not set, so QR links are using current origin fallback
                    ({customerBaseUrl}). Set the env var explicitly if customer
                    app is hosted on a different domain.
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

      {!isTakeawayPanel && (
        <>
      <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-700 mb-4">
          {isOfficePanel ? "Add Office QR" : "Add a Table"}
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-6 gap-4"
        >
          {selectedFormQrType !== PANEL_OFFICE && (
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
                <p className="mt-1 text-xs text-slate-400">
                  Number must be unique in this outlet (Tables and Offices).
                </p>
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
          {!isFixedPanelType && (
            <div>
              <label className="block text-sm text-slate-500 mb-1">
                QR Type
              </label>
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
          )}
          {selectedFormQrType !== PANEL_OFFICE && (
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
          )}
          {selectedFormQrType === PANEL_OFFICE && (
            <>
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Office Name
                </label>
                <input
                  required={selectedFormQrType === PANEL_OFFICE}
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
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Payment Mode
                </label>
                <select
                  value={form.officePaymentMode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      officePaymentMode: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                >
                  <option value="ONLINE">Online Only</option>
                  <option value="COD">COD Only</option>
                  <option value="BOTH">Online + COD</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-slate-500 mb-1">
                  Office Address
                </label>
                <input
                  required={selectedFormQrType === PANEL_OFFICE}
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

      {!isOfficePanel && (
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
      )}

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading tables...</div>
      ) : visibleTables.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">
          {isOfficePanel ? (
            "No office QR configured yet."
          ) : statusFilter === "ALL" ? (
            isTablePanel && qrContextCounts.tableCount === 0 && qrContextCounts.officeCount > 0 ? (
              <>
                No dine-in tables configured yet.
                <br />
                {qrContextCounts.officeCount} Office QR
                {qrContextCounts.officeCount > 1 ? "s are" : " is"} available in
                the Offices tab.
              </>
            ) : (
              "No tables configured yet."
            )
          ) : (
            `No tables are currently ${STATUS_MAP[
              statusFilter
            ]?.label?.toLowerCase()}.`
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {visibleTables.map((table) => (
            <TableCard
              key={table._id}
              table={table}
              onUpdateStatus={handleUpdateStatus}
              onEdit={openEditModal}
              onDelete={handleDelete}
              onRegenerateQr={handleRegenerateQr}
              onCopyLink={handleCopyLink}
              onViewWaitlist={handleViewWaitlist}
              busy={busyId === table._id}
            />
          ))}
        </div>
      )}
        </>
      )}
      {editModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-xl shadow-xl overflow-hidden my-auto">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-800">
                  {editingOfficeQr ? "Edit Office QR" : "Edit Table"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {editingOfficeQr
                    ? "Update office details, address and payment mode."
                    : "Update table details."}
                </p>
              </div>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 ml-2"
                aria-label="Close"
                disabled={editModal.saving}
              >
                x
              </button>
            </div>
            <form
              onSubmit={handleSaveEdit}
              className="px-4 sm:px-6 py-4 sm:py-5 space-y-4"
            >
              {!editingOfficeQr && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">
                      Number
                    </label>
                    <input
                      type="number"
                      value={editModal.form.number}
                      onChange={(e) =>
                        handleEditFieldChange("number", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-500 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      value={editModal.form.capacity}
                      onChange={(e) =>
                        handleEditFieldChange("capacity", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Label (optional)
                </label>
                <input
                  value={editModal.form.name}
                  onChange={(e) => handleEditFieldChange("name", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Window, Patio..."
                />
              </div>

              {editingOfficeQr && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">
                        Office Name
                      </label>
                      <input
                        value={editModal.form.officeName}
                        onChange={(e) =>
                          handleEditFieldChange("officeName", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">
                        Office Phone
                      </label>
                      <input
                        value={editModal.form.officePhone}
                        onChange={(e) =>
                          handleEditFieldChange("officePhone", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">
                        Delivery Charge (Rs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editModal.form.officeDeliveryCharge}
                        onChange={(e) =>
                          handleEditFieldChange(
                            "officeDeliveryCharge",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-500 mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={editModal.form.officePaymentMode}
                        onChange={(e) =>
                          handleEditFieldChange("officePaymentMode", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      >
                        <option value="ONLINE">Online Only</option>
                        <option value="COD">COD Only</option>
                        <option value="BOTH">Online + COD</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-500 mb-1">
                      Office Address
                    </label>
                    <input
                      value={editModal.form.officeAddress}
                      onChange={(e) =>
                        handleEditFieldChange("officeAddress", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editModal.saving}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editModal.saving}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {editModal.saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
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

