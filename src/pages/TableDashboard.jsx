import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import api from "../utils/api";
import { createSocketConnection } from "../utils/socket";

const TableDashboard = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeData, setMergeData] = useState({
    primaryTableId: "",
    secondaryTableIds: [],
  });

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 5000); // Refresh every 5 seconds
    
    // Socket setup for real-time table merge/unmerge updates
    const socket = createSocketConnection();
    
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
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn("[TableDashboard] Could not decode token for socket room:", e);
        }
      }
    }

    socket.on("table:merged", handleTableMerged);
    socket.on("table:unmerged", handleTableUnmerged);

    return () => {
      clearInterval(interval);
      socket.off("table:merged", handleTableMerged);
      socket.off("table:unmerged", handleTableUnmerged);
      socket.disconnect();
    };
  }, []);

  const fetchTables = async () => {
    try {
      const response = await api.get("/tables/dashboard/occupancy");
      // Ensure response.data is an array
      setTables(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching tables:", error);
      // Set empty array on error to prevent crashes
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (
      !mergeData?.primaryTableId ||
      !Array.isArray(mergeData.secondaryTableIds) ||
      mergeData.secondaryTableIds.length === 0
    ) {
      alert("Please select a primary table and at least one secondary table");
      return;
    }
    try {
      await api.post("/tables/merge", mergeData);
      setShowMergeModal(false);
      setMergeData({ primaryTableId: "", secondaryTableIds: [] });
      fetchTables();
    } catch (error) {
      console.error("Error merging tables:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to merge tables";
      alert(errorMessage);
    }
  };

  const handleUnmerge = async (tableId) => {
    if (!tableId) {
      console.error("Cannot unmerge: invalid tableId", tableId);
      return;
    }
    // CRITICAL: window.confirm is now async, must await it
    const confirmed = await window.confirm(
      "Are you sure you want to unmerge this table?"
    );
    if (!confirmed) return;
    try {
      // Ensure tableId is a string
      const idStr = String(tableId);
      console.log("Unmerging table with ID:", idStr, "Type:", typeof idStr);
      const response = await api.post(`/tables/${idStr}/unmerge`);
      if (response?.data?.message) {
        // Success - refresh tables
        fetchTables();
      } else {
        // Still refresh even if no message
        fetchTables();
      }
    } catch (error) {
      console.error("Error unmerging table:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to unmerge table";
      alert(errorMessage);
    }
  };

  const getStatusColor = (status) => {
    if (!status) return "bg-gray-400";
    switch (status) {
      case "AVAILABLE":
        return "bg-green-500";
      case "OCCUPIED":
        return "bg-red-500";
      case "RESERVED":
        return "bg-yellow-500";
      case "CLEANING":
        return "bg-gray-500";
      case "MERGED":
        return "bg-purple-500";
      default:
        return "bg-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const availableTables = tables.filter(
    (t) => t.status === "AVAILABLE" && !t.isMerged
  );
  const occupiedTables = tables.filter((t) => t.isOccupied);
  const mergedTables = tables.filter((t) => t.isMerged);

  return (
    <div className="space-y-4 sm:space-y-6">
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          Table Occupancy Dashboard
        </h1>
        <button
          onClick={() => setShowMergeModal(true)}
          className="px-4 sm:px-5 py-2 sm:py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm sm:text-base font-medium w-full sm:w-auto transition-colors shadow-sm hover:shadow-md"
        >
          Merge Tables
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1">
            Total Tables
          </div>
          <div className="text-xl sm:text-2xl md:text-3xl font-bold">
            {tables.length}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1">Available</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
            {availableTables.length}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1">Occupied</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-red-600">
            {occupiedTables.length}
          </div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow hover:shadow-md transition-shadow">
          <div className="text-xs sm:text-sm text-gray-600 mb-1">Merged</div>
          <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">
            {mergedTables.length}
          </div>
        </div>
      </div>

      {/* Table Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {(Array.isArray(tables) ? tables : []).map((table) => (
          <div
            key={table?.id || Math.random()}
            className={`bg-white rounded-lg shadow-lg p-3 sm:p-4 border-l-4 ${getStatusColor(
              table?.status
            )} cursor-pointer hover:shadow-xl transition-shadow flex flex-col`}
            onClick={() => table && setSelectedTable(table)}
          >
            {/* Header with table name and status - prevent overlap */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 min-h-[3rem]">
              <div className="min-w-0 flex-1 w-full sm:w-auto">
                <h3 className="text-base sm:text-lg font-semibold break-words">
                  Table {table?.number || "N/A"}
                </h3>
                {table?.name && (
                  <p className="text-xs sm:text-sm text-gray-600 break-words mt-0.5">
                    {table.name}
                  </p>
                )}
              </div>
              <span
                className={`px-2 py-1 text-[10px] sm:text-xs rounded ${getStatusColor(
                  table?.status
                )} text-white flex-shrink-0 self-start sm:self-center whitespace-nowrap`}
              >
                {table?.status || "UNKNOWN"}
              </span>
            </div>

            {/* Table details - flex-1 to push button to bottom */}
            <div className="space-y-1 text-xs sm:text-sm flex-1">
              <div>Capacity: {table?.capacity || 0} seats</div>
              {table?.totalCapacity &&
                table.totalCapacity > (table?.capacity || 0) && (
                  <div className="text-purple-600 break-words">
                    Total (merged): {table.totalCapacity} seats
                  </div>
                )}
              {table?.isOccupied && (
                <div className="text-red-600">Currently Occupied</div>
              )}
              {table?.waitlistLength > 0 && (
                <div className="text-blue-600">
                  Waitlist: {table.waitlistLength}
                </div>
              )}
              {table?.mergedTables &&
                Array.isArray(table.mergedTables) &&
                table.mergedTables.length > 0 && (
                  <div className="text-purple-600 text-[10px] sm:text-xs break-words">
                    Merged with:{" "}
                    {table.mergedTables
                      .map((t) => t?.number || "N/A")
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
              {table?.mergedWith && (
                <div className="text-purple-600 text-[10px] sm:text-xs break-words">
                  Merged into Table {table.mergedWith}
                </div>
              )}
            </div>

            {/* Unmerge button - always at bottom, prevent overlap */}
            {table?.isMerged && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnmerge(table?.id);
                }}
                className="mt-3 w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs sm:text-sm font-medium transition-colors"
              >
                Unmerge
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold">Merge Tables</h2>
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeData({ primaryTableId: "", secondaryTableIds: [] });
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                  Primary Table
                </label>
                <select
                  value={mergeData.primaryTableId}
                  onChange={(e) =>
                    setMergeData({
                      ...mergeData,
                      primaryTableId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 sm:px-4 sm:py-2.5 text-sm sm:text-base rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select primary table</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      Table {table.number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm sm:text-base font-medium text-gray-700 mb-2">
                  Secondary Tables (select multiple)
                </label>
                <select
                  multiple
                  value={mergeData.secondaryTableIds}
                  onChange={(e) =>
                    setMergeData({
                      ...mergeData,
                      secondaryTableIds: Array.from(
                        e.target.selectedOptions,
                        (option) => option.value
                      ),
                    })
                  }
                  className="w-full px-3 py-2 text-sm sm:text-base rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  size="5"
                >
                  {availableTables
                    .filter((t) => t.id !== mergeData.primaryTableId)
                    .map((table) => (
                      <option key={table.id} value={table.id}>
                        Table {table.number}
                      </option>
                    ))}
                </select>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  Hold Ctrl/Cmd to select multiple
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6 sm:mt-8 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeData({ primaryTableId: "", secondaryTableIds: [] });
                }}
                className="w-full sm:w-auto px-4 py-2 sm:py-2.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm sm:text-base font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                className="w-full sm:w-auto px-4 py-2 sm:py-2.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm sm:text-base font-medium transition-colors"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Detail Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold">
                Table {selectedTable.number} Details
              </h2>
              <button
                onClick={() => setSelectedTable(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <strong className="text-sm sm:text-base text-gray-700 min-w-[80px]">
                  Status:
                </strong>
                <span
                  className={`px-2 py-1 text-xs sm:text-sm rounded ${getStatusColor(
                    selectedTable.status
                  )} text-white inline-block w-fit`}
                >
                  {selectedTable.status}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <strong className="text-sm sm:text-base text-gray-700 min-w-[80px]">
                  Capacity:
                </strong>
                <span className="text-sm sm:text-base">
                  {selectedTable.capacity} seats
                </span>
              </div>
              {selectedTable.totalCapacity > selectedTable.capacity && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <strong className="text-sm sm:text-base text-gray-700 min-w-[80px]">
                    Total Capacity (merged):
                  </strong>
                  <span className="text-sm sm:text-base text-purple-600">
                    {selectedTable.totalCapacity} seats
                  </span>
                </div>
              )}
              {selectedTable.waitlistLength > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <strong className="text-sm sm:text-base text-gray-700 min-w-[80px]">
                    Waitlist:
                  </strong>
                  <span className="text-sm sm:text-base text-blue-600">
                    {selectedTable.waitlistLength} parties
                  </span>
                </div>
              )}
              {selectedTable.currentOrder && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                  <strong className="text-sm sm:text-base text-gray-700 min-w-[80px]">
                    Current Order:
                  </strong>
                  <span className="text-sm sm:text-base break-words flex-1">
                    {selectedTable.currentOrder}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedTable(null)}
              className="mt-6 sm:mt-8 w-full px-4 py-2.5 sm:py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm sm:text-base font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableDashboard;
