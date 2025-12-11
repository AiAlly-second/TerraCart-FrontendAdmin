import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const TableDashboard = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeData, setMergeData] = useState({ primaryTableId: '', secondaryTableIds: [] });

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchTables = async () => {
    try {
      const response = await api.get('/tables/dashboard/occupancy');
      setTables(response.data);
    } catch (error) {
      console.error('Error fetching tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async () => {
    if (!mergeData.primaryTableId || mergeData.secondaryTableIds.length === 0) {
      alert('Please select a primary table and at least one secondary table');
      return;
    }
    try {
      await api.post('/tables/merge', mergeData);
      setShowMergeModal(false);
      setMergeData({ primaryTableId: '', secondaryTableIds: [] });
      fetchTables();
    } catch (error) {
      console.error('Error merging tables:', error);
      alert('Failed to merge tables');
    }
  };

  const handleUnmerge = async (tableId) => {
    if (!window.confirm('Are you sure you want to unmerge this table?')) return;
    try {
      // Ensure tableId is a string
      const idStr = String(tableId);
      console.log('Unmerging table with ID:', idStr, 'Type:', typeof idStr);
      const response = await api.post(`/tables/${idStr}/unmerge`);
      if (response.data.message) {
        // Success - refresh tables
        fetchTables();
      }
    } catch (error) {
      console.error('Error unmerging table:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to unmerge table';
      alert(errorMessage);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-green-500';
      case 'OCCUPIED': return 'bg-red-500';
      case 'RESERVED': return 'bg-yellow-500';
      case 'CLEANING': return 'bg-gray-500';
      case 'MERGED': return 'bg-purple-500';
      default: return 'bg-gray-400';
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const availableTables = tables.filter(t => t.status === 'AVAILABLE' && !t.isMerged);
  const occupiedTables = tables.filter(t => t.isOccupied);
  const mergedTables = tables.filter(t => t.isMerged);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Table Occupancy Dashboard</h1>
        <button
          onClick={() => setShowMergeModal(true)}
          className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm sm:text-base w-full sm:w-auto"
        >
          Merge Tables
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600">Total Tables</div>
          <div className="text-xl sm:text-2xl font-bold">{tables.length}</div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600">Available</div>
          <div className="text-xl sm:text-2xl font-bold text-green-600">{availableTables.length}</div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600">Occupied</div>
          <div className="text-xl sm:text-2xl font-bold text-red-600">{occupiedTables.length}</div>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="text-xs sm:text-sm text-gray-600">Merged</div>
          <div className="text-xl sm:text-2xl font-bold text-purple-600">{mergedTables.length}</div>
        </div>
      </div>

      {/* Table Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {tables.map((table) => (
          <div
            key={table.id}
            className={`bg-white rounded-lg shadow-lg p-3 sm:p-4 border-l-4 ${getStatusColor(table.status)} cursor-pointer hover:shadow-xl transition-shadow`}
            onClick={() => setSelectedTable(table)}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold truncate">Table {table.number}</h3>
                {table.name && <p className="text-xs sm:text-sm text-gray-600 truncate">{table.name}</p>}
              </div>
              <span className={`px-2 py-1 text-[10px] sm:text-xs rounded ${getStatusColor(table.status)} text-white flex-shrink-0 ml-2`}>
                {table.status}
              </span>
            </div>
            <div className="space-y-1 text-xs sm:text-sm">
              <div>Capacity: {table.capacity} seats</div>
              {table.totalCapacity > table.capacity && (
                <div className="text-purple-600">Total (merged): {table.totalCapacity} seats</div>
              )}
              {table.isOccupied && (
                <div className="text-red-600">Currently Occupied</div>
              )}
              {table.waitlistLength > 0 && (
                <div className="text-blue-600">Waitlist: {table.waitlistLength}</div>
              )}
              {table.mergedTables && table.mergedTables.length > 0 && (
                <div className="text-purple-600 text-[10px] sm:text-xs">
                  Merged with: {table.mergedTables.map(t => t.number).join(', ')}
                </div>
              )}
              {table.mergedWith && (
                <div className="text-purple-600 text-[10px] sm:text-xs">Merged into Table {table.mergedWith}</div>
              )}
            </div>
            {table.isMerged && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnmerge(table.id);
                }}
                className="mt-2 w-full px-2 sm:px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs sm:text-sm"
              >
                Unmerge
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Merge Tables</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Table</label>
                <select
                  value={mergeData.primaryTableId}
                  onChange={(e) => setMergeData({ ...mergeData, primaryTableId: e.target.value })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select primary table</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.id}>Table {table.number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Tables (select multiple)</label>
                <select
                  multiple
                  value={mergeData.secondaryTableIds}
                  onChange={(e) => setMergeData({ ...mergeData, secondaryTableIds: Array.from(e.target.selectedOptions, option => option.value) })}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  size="5"
                >
                  {availableTables.filter(t => t.id !== mergeData.primaryTableId).map((table) => (
                    <option key={table.id} value={table.id}>Table {table.number}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setMergeData({ primaryTableId: '', secondaryTableIds: [] });
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table Detail Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Table {selectedTable.number} Details</h2>
            <div className="space-y-2">
              <div><strong>Status:</strong> {selectedTable.status}</div>
              <div><strong>Capacity:</strong> {selectedTable.capacity} seats</div>
              {selectedTable.totalCapacity > selectedTable.capacity && (
                <div><strong>Total Capacity (merged):</strong> {selectedTable.totalCapacity} seats</div>
              )}
              {selectedTable.waitlistLength > 0 && (
                <div><strong>Waitlist:</strong> {selectedTable.waitlistLength} parties</div>
              )}
              {selectedTable.currentOrder && (
                <div><strong>Current Order:</strong> {selectedTable.currentOrder}</div>
              )}
            </div>
            <button
              onClick={() => setSelectedTable(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
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

