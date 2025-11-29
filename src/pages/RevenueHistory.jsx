import React, { useState, useEffect } from 'react';
import { 
  FaCalendarAlt, FaChartLine, FaRupeeSign, FaSpinner, FaDownload, 
  FaBuilding, FaStore, FaChevronDown, FaChevronRight, FaGlobe,
  FaArrowUp, FaArrowDown, FaSync, FaFilter, FaChartBar
} from 'react-icons/fa';
import api from '../utils/api';

const RevenueHistory = () => {
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState('daily');
  const [history, setHistory] = useState([]);
  const [currentRevenue, setCurrentRevenue] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [viewMode, setViewMode] = useState('hierarchy'); // 'hierarchy' or 'table'
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchData();
  }, [periodType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch both history and current revenue in parallel
      const [historyResponse, currentResponse] = await Promise.all([
        api.get(`/revenue/history?periodType=${periodType}&limit=30`),
        api.get('/revenue/current')
      ]);
      
      if (historyResponse.data?.success) {
        setHistory(historyResponse.data.data || []);
      }
      
      if (currentResponse.data?.success) {
        setCurrentRevenue(currentResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFranchise = (franchiseId) => {
    const newExpanded = new Set(expandedFranchises);
    if (newExpanded.has(franchiseId)) {
      newExpanded.delete(franchiseId);
    } else {
      newExpanded.add(franchiseId);
    }
    setExpandedFranchises(newExpanded);
  };

  const expandAll = () => {
    if (currentRevenue?.franchiseRevenue) {
      setExpandedFranchises(new Set(currentRevenue.franchiseRevenue.map(f => f.franchiseId)));
    }
  };

  const collapseAll = () => {
    setExpandedFranchises(new Set());
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const calculatePercentage = (part, total) => {
    if (!total || total === 0) return 0;
    return ((part / total) * 100).toFixed(1);
  };

  const exportHistory = () => {
    const data = {
      periodType,
      generatedAt: new Date().toISOString(),
      currentRevenue,
      history,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-history-${periodType}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get cafes for a specific franchise
  const getCafesForFranchise = (franchiseId) => {
    if (!currentRevenue?.cartRevenue) return [];
    return currentRevenue.cartRevenue.filter(cafe => cafe.franchiseId === franchiseId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-500 text-5xl mx-auto mb-4" />
          <p className="text-gray-600">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <FaChartLine className="mr-3 text-blue-600" />
            Revenue History
          </h1>
          <p className="text-gray-600 mt-2">Hierarchical revenue tracking: Global → Franchise → Cafe</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <FaSync className="mr-2" />
            Refresh
          </button>
          <button
            onClick={exportHistory}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FaDownload className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Period Type Toggle */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setPeriodType('daily')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'daily'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Daily Revenue
            </button>
            <button
              onClick={() => setPeriodType('monthly')}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Monthly Revenue
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'hierarchy'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hierarchy View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* ==================== LEVEL 1: GLOBAL REVENUE ==================== */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center mb-4">
          <FaGlobe className="text-3xl mr-3 opacity-80" />
          <div>
            <h2 className="text-xl font-bold">LEVEL 1: GLOBAL REVENUE</h2>
            <p className="text-blue-200 text-sm">Total revenue across all active franchises</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-blue-200 text-sm mb-1">Total Revenue</p>
            <p className="text-3xl font-bold">{formatCurrency(currentRevenue?.totalRevenue)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-blue-200 text-sm mb-1">Total Orders</p>
            <p className="text-3xl font-bold">{currentRevenue?.totalOrders || 0}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-blue-200 text-sm mb-1">Active Franchises</p>
            <p className="text-3xl font-bold">{currentRevenue?.franchiseRevenue?.length || 0}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur">
            <p className="text-blue-200 text-sm mb-1">Active Cafes/Carts</p>
            <p className="text-3xl font-bold">{currentRevenue?.cartRevenue?.length || 0}</p>
          </div>
        </div>

        {/* Preserved Data Info */}
        {currentRevenue?.preservedData?.deletedFranchiseOrdersCount > 0 && (
          <div className="mt-4 bg-yellow-500/20 rounded-lg p-3 text-sm">
            <p className="text-yellow-200">
              ℹ️ {currentRevenue.preservedData.deletedFranchiseOrdersCount} orders ({formatCurrency(currentRevenue.preservedData.deletedFranchiseRevenue)}) 
              from inactive/deleted franchises are preserved but excluded from active revenue.
            </p>
          </div>
        )}
        
        <p className="text-blue-200 text-xs mt-4">
          Last calculated: {currentRevenue?.calculatedAt ? new Date(currentRevenue.calculatedAt).toLocaleString('en-IN') : 'N/A'}
        </p>
      </div>

      {/* ==================== TABLE VIEW ==================== */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 p-4 text-white">
            <div className="flex items-center">
              <FaChartBar className="text-2xl mr-3 opacity-80" />
              <div>
                <h2 className="text-lg font-bold">COMPLETE REVENUE TABLE</h2>
                <p className="text-indigo-200 text-sm">All franchises and cafes in table format</p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent Franchise
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(!currentRevenue?.franchiseRevenue || currentRevenue.franchiseRevenue.length === 0) ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      <FaChartBar className="mx-auto text-4xl mb-4 opacity-50" />
                      <p>No revenue data available</p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Franchise Rows */}
                    {currentRevenue.franchiseRevenue
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((franchise, index) => {
                        const cafes = getCafesForFranchise(franchise.franchiseId);
                        const franchiseOrders = cafes.reduce((sum, c) => sum + (c.orderCount || 0), 0);
                        
                        return (
                          <React.Fragment key={franchise.franchiseId}>
                            {/* Franchise Row */}
                            <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                              <td className="px-4 py-3 text-sm font-bold text-green-700">{index + 1}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <FaBuilding className="mr-1" /> Franchise
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">{franchise.franchiseName}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">—</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-700">{franchiseOrders}</td>
                              <td className="px-4 py-3 text-sm font-bold text-green-600">{formatCurrency(franchise.revenue)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                                    <div 
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${calculatePercentage(franchise.revenue, currentRevenue.totalRevenue)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-600 font-medium">
                                    {calculatePercentage(franchise.revenue, currentRevenue.totalRevenue)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Cafe Rows under this Franchise */}
                            {cafes
                              .sort((a, b) => b.revenue - a.revenue)
                              .map((cafe, cafeIndex) => (
                                <tr key={cafe.cartId} className="hover:bg-orange-50 transition-colors">
                                  <td className="px-4 py-3 text-sm text-gray-400 pl-8">{index + 1}.{cafeIndex + 1}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      <FaStore className="mr-1" /> Cafe
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-800 pl-8">{cafe.cartName || cafe.cafeName}</td>
                                  <td className="px-4 py-3 text-sm text-gray-500">{franchise.franchiseName}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">{cafe.orderCount || 0}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-orange-600">{formatCurrency(cafe.revenue)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center">
                                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                                        <div 
                                          className="h-full bg-orange-400 rounded-full"
                                          style={{ width: `${calculatePercentage(cafe.revenue, currentRevenue.totalRevenue)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-gray-500">
                                        {calculatePercentage(cafe.revenue, currentRevenue.totalRevenue)}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })}
                  </>
                )}
              </tbody>
              {/* Table Footer with Totals */}
              {currentRevenue?.franchiseRevenue?.length > 0 && (
                <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                  <tr>
                    <td colSpan="4" className="px-4 py-3 text-sm font-bold text-blue-800">GRAND TOTAL</td>
                    <td className="px-4 py-3 text-sm font-bold text-blue-800">{currentRevenue?.totalOrders || 0}</td>
                    <td className="px-4 py-3 text-sm font-bold text-blue-800">{formatCurrency(currentRevenue?.totalRevenue)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-blue-800">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ==================== LEVEL 2: FRANCHISE REVENUE (Hierarchy View) ==================== */}
      {viewMode === 'hierarchy' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-green-700 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FaBuilding className="text-2xl mr-3 opacity-80" />
                <div>
                  <h2 className="text-lg font-bold">LEVEL 2: FRANCHISE REVENUE</h2>
                  <p className="text-green-200 text-sm">Revenue breakdown by franchise</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30 transition-colors"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1 bg-white/20 rounded text-sm hover:bg-white/30 transition-colors"
                >
                  Collapse All
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            {(!currentRevenue?.franchiseRevenue || currentRevenue.franchiseRevenue.length === 0) ? (
              <div className="text-center py-12 text-gray-500">
                <FaBuilding className="mx-auto text-4xl mb-4 opacity-50" />
                <p>No franchise revenue data available</p>
                <p className="text-sm mt-2">Revenue will appear here when orders are paid</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentRevenue.franchiseRevenue
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((franchise, index) => {
                    const cafes = getCafesForFranchise(franchise.franchiseId);
                    const isExpanded = expandedFranchises.has(franchise.franchiseId);
                    const percentage = calculatePercentage(franchise.revenue, currentRevenue.totalRevenue);
                    
                    return (
                      <div key={franchise.franchiseId} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Franchise Header */}
                        <div
                          className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${
                            isExpanded ? 'bg-green-50' : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                          onClick={() => toggleFranchise(franchise.franchiseId)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              {isExpanded ? (
                                <FaChevronDown className="text-green-600 mr-2" />
                              ) : (
                                <FaChevronRight className="text-gray-400 mr-2" />
                              )}
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                                {index + 1}
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-800">{franchise.franchiseName}</h3>
                              <p className="text-sm text-gray-500">{franchise.cartCount || cafes.length} cafe(s)</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-6">
                            {/* Progress Bar */}
                            <div className="hidden md:block w-32">
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-1 text-center">{percentage}% of total</p>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">{formatCurrency(franchise.revenue)}</p>
                              <p className="text-xs text-gray-500">
                                {cafes.reduce((sum, c) => sum + (c.orderCount || 0), 0)} orders
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ==================== LEVEL 3: CAFE/CART REVENUE ==================== */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-white">
                            <div className="p-3 bg-orange-50 border-b border-orange-100">
                              <div className="flex items-center">
                                <FaStore className="text-orange-500 mr-2" />
                                <span className="text-sm font-semibold text-orange-700">
                                  LEVEL 3: CAFE/CART REVENUE - {franchise.franchiseName}
                                </span>
                              </div>
                            </div>
                            
                            {cafes.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm">
                                No cafe data available for this franchise
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {cafes
                                  .sort((a, b) => b.revenue - a.revenue)
                                  .map((cafe, cafeIndex) => {
                                    const cafePercentage = calculatePercentage(cafe.revenue, franchise.revenue);
                                    return (
                                      <div 
                                        key={cafe.cartId} 
                                        className="flex items-center justify-between p-4 hover:bg-orange-50 transition-colors"
                                      >
                                        <div className="flex items-center space-x-3">
                                          <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-xs font-bold">
                                            {cafeIndex + 1}
                                          </div>
                                          <div>
                                            <p className="font-medium text-gray-800">{cafe.cartName || cafe.cafeName}</p>
                                            <p className="text-xs text-gray-500">{cafe.orderCount || 0} orders</p>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-4">
                                          {/* Mini Progress Bar */}
                                          <div className="hidden md:block w-24">
                                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-orange-400 rounded-full"
                                                style={{ width: `${cafePercentage}%` }}
                                              />
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5 text-center">{cafePercentage}%</p>
                                          </div>
                                          
                                          <p className="font-semibold text-orange-600">{formatCurrency(cafe.revenue)}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== HISTORICAL DATA TABLE ==================== */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-700 p-4 text-white">
          <div className="flex items-center">
            <FaCalendarAlt className="text-2xl mr-3 opacity-80" />
            <div>
              <h2 className="text-lg font-bold">HISTORICAL REVENUE DATA</h2>
              <p className="text-purple-200 text-sm">
                {periodType === 'daily' ? 'Daily' : 'Monthly'} revenue records (Last 30 entries)
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Franchises
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cafes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Order Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <FaChartBar className="mx-auto text-4xl mb-4 opacity-50" />
                    <p>No historical data available</p>
                    <p className="text-sm mt-2">Click "Calculate {periodType === 'daily' ? 'Daily' : 'Monthly'}" to generate records</p>
                  </td>
                </tr>
              ) : (
                history.map((record, index) => {
                  const avgOrderValue = record.totalOrders > 0 
                    ? record.totalRevenue / record.totalOrders 
                    : 0;
                  const prevRecord = history[index + 1];
                  const revenueChange = prevRecord 
                    ? ((record.totalRevenue - prevRecord.totalRevenue) / prevRecord.totalRevenue * 100).toFixed(1)
                    : null;
                    
                  return (
                    <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-2 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(record.date).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(record.totalRevenue)}
                          </span>
                          {revenueChange !== null && (
                            <span className={`ml-2 text-xs flex items-center ${
                              parseFloat(revenueChange) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {parseFloat(revenueChange) >= 0 ? (
                                <FaArrowUp className="mr-1" />
                              ) : (
                                <FaArrowDown className="mr-1" />
                              )}
                              {Math.abs(parseFloat(revenueChange))}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.totalOrders || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.franchiseRevenue?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.cartRevenue?.length || record.cafeRevenue?.length || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(avgOrderValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedPeriod(record)}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium hover:underline"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== DETAIL MODAL ==================== */}
      {selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Revenue Details</h2>
                  <p className="text-purple-200">
                    {new Date(selectedPeriod.date).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPeriod(null)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-blue-800">{formatCurrency(selectedPeriod.totalRevenue)}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-green-600 font-medium">Total Orders</p>
                  <p className="text-2xl font-bold text-green-800">{selectedPeriod.totalOrders || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <p className="text-sm text-purple-600 font-medium">Franchises</p>
                  <p className="text-2xl font-bold text-purple-800">{selectedPeriod.franchiseRevenue?.length || 0}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm text-orange-600 font-medium">Avg Order Value</p>
                  <p className="text-2xl font-bold text-orange-800">
                    {formatCurrency(selectedPeriod.totalOrders > 0 ? selectedPeriod.totalRevenue / selectedPeriod.totalOrders : 0)}
                  </p>
                </div>
              </div>

              {/* Franchise Breakdown */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <FaBuilding className="mr-2 text-green-600" />
                  Franchise-wise Revenue
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedPeriod.franchiseRevenue?.sort((a, b) => b.revenue - a.revenue).map((franchise, index) => (
                    <div 
                      key={index} 
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-800">{franchise.franchiseName}</p>
                          <p className="text-sm text-gray-500">{franchise.cartCount || franchise.cafeCount} cafe(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{formatCurrency(franchise.revenue)}</p>
                          <p className="text-xs text-gray-500">
                            {calculatePercentage(franchise.revenue, selectedPeriod.totalRevenue)}% of total
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${calculatePercentage(franchise.revenue, selectedPeriod.totalRevenue)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cafe Breakdown */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <FaStore className="mr-2 text-orange-600" />
                  Cafe-wise Revenue
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cafe</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">% Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(selectedPeriod.cartRevenue || selectedPeriod.cafeRevenue || [])
                        .sort((a, b) => b.revenue - a.revenue)
                        .map((cafe, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {cafe.cartName || cafe.cafeName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{cafe.franchiseName}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{cafe.orderCount}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {formatCurrency(cafe.revenue)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden mr-2">
                                  <div 
                                    className="h-full bg-orange-500 rounded-full"
                                    style={{ width: `${calculatePercentage(cafe.revenue, selectedPeriod.totalRevenue)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">
                                  {calculatePercentage(cafe.revenue, selectedPeriod.totalRevenue)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueHistory;
