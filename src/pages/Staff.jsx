import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";

const STATUS_STYLES = {
  AVAILABLE: "bg-green-100 text-green-700 border-green-300",
  OCCUPIED: "bg-red-100 text-red-600 border-red-200",
  RESERVED: "bg-amber-100 text-amber-700 border-amber-300",
  CLEANING: "bg-slate-200 text-slate-700 border-slate-300",
};

const STATUS_ORDER = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING"];

const ACTIONS = [
  { key: "AVAILABLE", label: "Mark Available", style: "bg-green-600 hover:bg-green-700" },
  { key: "OCCUPIED", label: "Mark Occupied", style: "bg-red-600 hover:bg-red-700" },
  { key: "RESERVED", label: "Reserve", style: "bg-amber-500 hover:bg-amber-600" },
  { key: "CLEANING", label: "Send to Cleaning", style: "bg-slate-600 hover:bg-slate-700" },
];

const TableButton = ({ status, onSetStatus, busy }) => (
  <div className="flex flex-wrap gap-2">
    {ACTIONS.map((action) => (
      <button
        key={action.key}
        onClick={() => onSetStatus(action.key)}
        disabled={busy || status === action.key}
        className={`px-3 py-1.5 text-xs font-semibold text-white rounded-md transition ${
          action.style
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {action.label}
      </button>
    ))}
  </div>
);

const TableCard = ({ table, onSetStatus, busy }) => (
  <div className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-lg font-semibold text-slate-800">Table {table.number}</div>
        {table.name && <div className="text-sm text-slate-500">{table.name}</div>}
        <div className="text-xs text-slate-500 mt-1">Capacity: {table.capacity}</div>
        {table.currentOrder && (
          <div className="mt-1 text-xs text-orange-600">Active Order: {table.currentOrder}</div>
        )}
      </div>
      <span
        className={`px-3 py-1 text-xs font-semibold rounded-full border ${STATUS_STYLES[table.status] || STATUS_STYLES.AVAILABLE}`}
      >
        {table.status}
      </span>
    </div>
    <TableButton status={table.status} onSetStatus={onSetStatus} busy={busy} />
    <div className="text-[10px] text-slate-400">
      Updated {new Date(table.updatedAt).toLocaleTimeString()}
    </div>
  </div>
);

export default function Staff() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [quickTable, setQuickTable] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);

  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/tables");
      setTables(data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleSetStatus = async (table, status) => {
    setBusyId(table._id);
    try {
      await api.patch(`/tables/${table._id}`, { status });
      setTables((prev) =>
        prev.map((t) =>
          t._id === table._id
            ? { ...t, status, currentOrder: status === "AVAILABLE" ? null : t.currentOrder }
            : t
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update table status");
      fetchTables();
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickAvailable = async (e) => {
    e.preventDefault();
    const trimmed = quickTable.trim();
    if (!trimmed) return;

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      alert("Enter a valid table number");
      return;
    }

    const table = tables.find((t) => t.number === numeric);
    if (!table) {
      alert(`Table ${numeric} not found. Refresh and try again.`);
      return;
    }

    setQuickBusy(true);
    try {
      if (table.status === "AVAILABLE") {
        alert(`Table ${numeric} is already available.`);
      } else {
        await api.patch(`/tables/${table._id}`, { status: "AVAILABLE" });
        setTables((prev) =>
          prev.map((t) =>
            t._id === table._id ? { ...t, status: "AVAILABLE", currentOrder: null } : t
          )
        );
        alert(`Table ${numeric} is now marked Available.`);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update table");
    } finally {
      setQuickBusy(false);
      setQuickTable("");
    }
  };

  const filteredTables = useMemo(() => {
    return tables
      .filter((table) =>
        statusFilter === "ALL" ? true : table.status === statusFilter
      )
      .filter((table) =>
        search.trim()
          ? String(table.number).includes(search.trim()) ||
            (table.name || "").toLowerCase().includes(search.trim().toLowerCase())
          : true
      )
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.number - b.number);
  }, [tables, statusFilter, search]);

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Floor Assist</h1>
          <p className="text-sm text-slate-500">
            Quick actions for waiters to free, reserve, or service tables.
          </p>
        </div>
        <button
          onClick={fetchTables}
          className="self-start md:self-auto px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
        >
          Refresh
        </button>
      </header>

      <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
        <form onSubmit={handleQuickAvailable} className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Mark table available
            </label>
            <div className="flex gap-2 mt-1">
              <input
                value={quickTable}
                onChange={(e) => setQuickTable(e.target.value)}
                placeholder="Enter table number e.g. 12"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={quickBusy}
                className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-60"
              >
                Set Available
              </button>
            </div>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Search tables
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by number or label"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Filter by status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All tables</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </form>
      </section>

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading tables…</div>
      ) : filteredTables.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded-xl">
          No tables match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTables.map((table) => (
            <TableCard
              key={table._id}
              table={table}
              busy={busyId === table._id}
              onSetStatus={(status) => handleSetStatus(table, status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}







