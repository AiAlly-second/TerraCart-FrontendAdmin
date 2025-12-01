import React, { useState, useEffect } from 'react';
import { 
  FaCalendarAlt, FaChartLine, FaRupeeSign, FaSpinner, FaDownload, 
  FaBuilding, FaStore, FaChevronDown, FaChevronRight, FaGlobe,
  FaArrowUp, FaArrowDown, FaSync, FaFilter, FaChartBar
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
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
    try {
      const workbook = XLSX.utils.book_new();
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Sheet 1: Summary/Overview
      const summaryData = [
        ['REVENUE HISTORY REPORT'],
        ['Generated At:', new Date().toLocaleString('en-IN')],
        ['Period Type:', periodType === 'daily' ? 'Daily' : 'Monthly'],
        [],
        ['GLOBAL REVENUE SUMMARY'],
        ['Total Revenue', formatCurrency(currentRevenue?.totalRevenue || 0)],
        ['Total Orders', currentRevenue?.totalOrders || 0],
        ['Active Franchises', currentRevenue?.franchiseRevenue?.length || 0],
        ['Active Carts', currentRevenue?.cartRevenue?.length || 0],
        [],
        ['Last Calculated:', currentRevenue?.calculatedAt ? new Date(currentRevenue.calculatedAt).toLocaleString('en-IN') : 'N/A'],
      ];
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Sheet 2: Franchise Revenue Breakdown
      if (currentRevenue?.franchiseRevenue && currentRevenue.franchiseRevenue.length > 0) {
        const franchiseHeaders = ['#', 'Franchise Name', 'Revenue', 'Orders', 'Carts', '% of Total'];
        const franchiseRows = currentRevenue.franchiseRevenue
          .sort((a, b) => b.revenue - a.revenue)
          .map((franchise, index) => [
            index + 1,
            franchise.franchiseName || 'Unknown',
            franchise.revenue || 0,
            getCafesForFranchise(franchise.franchiseId).reduce((sum, c) => sum + (c.orderCount || 0), 0),
            franchise.cartCount || getCafesForFranchise(franchise.franchiseId).length,
            `${calculatePercentage(franchise.revenue, currentRevenue.totalRevenue)}%`,
          ]);
        
        const franchiseData = [franchiseHeaders, ...franchiseRows];
        const franchiseSheet = XLSX.utils.aoa_to_sheet(franchiseData);
        
        franchiseSheet['!cols'] = [
          { wch: 5 },   // #
          { wch: 30 },  // Franchise Name
          { wch: 18 },  // Revenue
          { wch: 10 },  // Orders
          { wch: 10 },  // Carts
          { wch: 12 },  // % of Total
        ];
        
        XLSX.utils.book_append_sheet(workbook, franchiseSheet, 'Franchise Revenue');
      }
      
      // Sheet 3: Cart Revenue Breakdown
      if (currentRevenue?.cartRevenue && currentRevenue.cartRevenue.length > 0) {
        const cartHeaders = ['#', 'Cart Name', 'Franchise Name', 'Revenue', 'Orders', '% of Total'];
        const cartRows = currentRevenue.cartRevenue
          .sort((a, b) => b.revenue - a.revenue)
          .map((cart, index) => [
            index + 1,
            cart.cartName || cart.cafeName || 'Unknown',
            cart.franchiseName || 'Unknown',
            cart.revenue || 0,
            cart.orderCount || 0,
            `${calculatePercentage(cart.revenue, currentRevenue.totalRevenue)}%`,
          ]);
        
        const cartData = [cartHeaders, ...cartRows];
        const cartSheet = XLSX.utils.aoa_to_sheet(cartData);
        
        cartSheet['!cols'] = [
          { wch: 5 },   // #
          { wch: 30 },  // Cart Name
          { wch: 30 },  // Franchise Name
          { wch: 18 },  // Revenue
          { wch: 10 },  // Orders
          { wch: 12 },  // % of Total
        ];
        
        XLSX.utils.book_append_sheet(workbook, cartSheet, 'Cart Revenue');
      }
      
      // Sheet 4: Historical Data
      if (history && history.length > 0) {
        const historyHeaders = ['Date', 'Total Revenue', 'Orders', 'Franchises', 'Carts', 'Avg Order Value'];
        const historyRows = history.map((record) => {
          const avgOrderValue = record.totalOrders > 0 
            ? record.totalRevenue / record.totalOrders 
            : 0;
          return [
            new Date(record.date).toLocaleDateString('en-IN'),
            record.totalRevenue || 0,
            record.totalOrders || 0,
            record.franchiseRevenue?.length || 0,
            record.cartRevenue?.length || record.cafeRevenue?.length || 0,
            avgOrderValue,
          ];
        });
        
        const historyData = [historyHeaders, ...historyRows];
        const historySheet = XLSX.utils.aoa_to_sheet(historyData);
        
        historySheet['!cols'] = [
          { wch: 15 },  // Date
          { wch: 18 },  // Total Revenue
          { wch: 10 },  // Orders
          { wch: 12 },  // Franchises
          { wch: 10 },  // Carts
          { wch: 18 },  // Avg Order Value
        ];
        
        XLSX.utils.book_append_sheet(workbook, historySheet, 'Historical Data');
      }
      
      // Sheet 5: Detailed Franchise-Cart Hierarchy
      if (currentRevenue?.franchiseRevenue && currentRevenue.franchiseRevenue.length > 0) {
        const hierarchyHeaders = ['Level', 'Type', 'Name', 'Parent Franchise', 'Orders', 'Revenue', '% of Total'];
        const hierarchyRows = [];
        
        currentRevenue.franchiseRevenue
          .sort((a, b) => b.revenue - a.revenue)
          .forEach((franchise, fIndex) => {
            const cafes = getCafesForFranchise(franchise.franchiseId);
            const franchiseOrders = cafes.reduce((sum, c) => sum + (c.orderCount || 0), 0);
            
            // Add franchise row
            hierarchyRows.push([
              'Level 2',
              'Franchise',
              franchise.franchiseName || 'Unknown',
              '—',
              franchiseOrders,
              franchise.revenue || 0,
              `${calculatePercentage(franchise.revenue, currentRevenue.totalRevenue)}%`,
            ]);
            
            // Add cart rows under this franchise
            cafes
              .sort((a, b) => b.revenue - a.revenue)
              .forEach((cafe, cIndex) => {
                hierarchyRows.push([
                  'Level 3',
                  'Cart',
                  cafe.cartName || cafe.cafeName || 'Unknown',
                  franchise.franchiseName || 'Unknown',
                  cafe.orderCount || 0,
                  cafe.revenue || 0,
                  `${calculatePercentage(cafe.revenue, currentRevenue.totalRevenue)}%`,
                ]);
              });
          });
        
        const hierarchyData = [hierarchyHeaders, ...hierarchyRows];
        const hierarchySheet = XLSX.utils.aoa_to_sheet(hierarchyData);
        
        hierarchySheet['!cols'] = [
          { wch: 10 },  // Level
          { wch: 12 },  // Type
          { wch: 30 },  // Name
          { wch: 30 },  // Parent Franchise
          { wch: 10 },  // Orders
          { wch: 18 },  // Revenue
          { wch: 12 },  // % of Total
        ];
        
        XLSX.utils.book_append_sheet(workbook, hierarchySheet, 'Hierarchy View');
      }
      
      // Generate Excel file
      const fileName = `revenue-history-${periodType}-${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export Excel file. Please try again.');
    }
  };

  // Get carts for a specific franchise
  const getCafesForFranchise = (franchiseId) => {
    if (!currentRevenue?.cartRevenue) return [];
    return currentRevenue.cartRevenue.filter(cafe => cafe.franchiseId === franchiseId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <FaSpinner className="animate-spin text-[#d86d2a] text-5xl mx-auto mb-4" />
          <p className="text-[#6b4423]">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#4a2e1f] flex items-center">
            <FaChartLine className="mr-3 text-[#d86d2a]" />
            Revenue History
          </h1>
          <p className="text-[#6b4423] mt-2 text-sm md:text-base">Hierarchical revenue tracking: Global → Franchise → Cart</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center px-4 py-2 bg-white text-[#4a2e1f] rounded-lg hover:bg-[#fef4ec] border border-[#e2c1ac] transition-colors shadow-sm"
          >
            <FaSync className="mr-2" />
            Refresh
          </button>
          <button
            onClick={exportHistory}
            className="flex items-center px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a] transition-colors shadow-md"
          >
            <FaDownload className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Period Type Toggle */}
      <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex gap-3">
            <button
              onClick={() => setPeriodType('daily')}
              className={`px-4 md:px-6 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'daily'
                  ? 'bg-[#d86d2a] text-white shadow-md'
                  : 'bg-[#fef4ec] text-[#4a2e1f] hover:bg-[#f5e3d5] border border-[#e2c1ac]'
              }`}
            >
              Daily Revenue
            </button>
            <button
              onClick={() => setPeriodType('monthly')}
              className={`px-4 md:px-6 py-2 rounded-lg font-medium transition-colors ${
                periodType === 'monthly'
                  ? 'bg-[#d86d2a] text-white shadow-md'
                  : 'bg-[#fef4ec] text-[#4a2e1f] hover:bg-[#f5e3d5] border border-[#e2c1ac]'
              }`}
            >
              Monthly Revenue
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'hierarchy'
                  ? 'bg-[#4a2e1f] text-white shadow-md'
                  : 'bg-[#fef4ec] text-[#4a2e1f] hover:bg-[#f5e3d5] border border-[#e2c1ac]'
              }`}
            >
              Hierarchy View
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#4a2e1f] text-white shadow-md'
                  : 'bg-[#fef4ec] text-[#4a2e1f] hover:bg-[#f5e3d5] border border-[#e2c1ac]'
              }`}
            >
              Table View
            </button>
          </div>
        </div>
      </div>

      {/* ==================== LEVEL 1: GLOBAL REVENUE ==================== */}
      <div className="bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] rounded-xl shadow-lg border border-[#e2c1ac] p-4 md:p-6 text-white">
        <div className="flex items-center mb-4">
          <FaGlobe className="text-2xl md:text-3xl mr-3 opacity-90" />
          <div>
            <h2 className="text-lg md:text-xl font-bold">LEVEL 1: GLOBAL REVENUE</h2>
            <p className="text-white/80 text-xs md:text-sm">Total revenue across all active franchises</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mt-4 md:mt-6">
          <div className="bg-white/15 rounded-lg p-3 md:p-4 backdrop-blur border border-white/20">
            <p className="text-white/80 text-xs md:text-sm mb-1">Total Revenue</p>
            <p className="text-xl md:text-3xl font-bold">{formatCurrency(currentRevenue?.totalRevenue)}</p>
          </div>
          <div className="bg-white/15 rounded-lg p-3 md:p-4 backdrop-blur border border-white/20">
            <p className="text-white/80 text-xs md:text-sm mb-1">Total Orders</p>
            <p className="text-xl md:text-3xl font-bold">{currentRevenue?.totalOrders || 0}</p>
          </div>
          <div className="bg-white/15 rounded-lg p-3 md:p-4 backdrop-blur border border-white/20">
            <p className="text-white/80 text-xs md:text-sm mb-1">Active Franchises</p>
            <p className="text-xl md:text-3xl font-bold">{currentRevenue?.franchiseRevenue?.length || 0}</p>
          </div>
          <div className="bg-white/15 rounded-lg p-3 md:p-4 backdrop-blur border border-white/20">
            <p className="text-white/80 text-xs md:text-sm mb-1">Active Carts</p>
            <p className="text-xl md:text-3xl font-bold">{currentRevenue?.cartRevenue?.length || 0}</p>
          </div>
        </div>

        {/* Preserved Data Info */}
        {currentRevenue?.preservedData?.deletedFranchiseOrdersCount > 0 && (
          <div className="mt-4 bg-yellow-500/20 rounded-lg p-3 text-sm border border-yellow-400/30">
            <p className="text-yellow-100">
              ℹ️ {currentRevenue.preservedData.deletedFranchiseOrdersCount} orders ({formatCurrency(currentRevenue.preservedData.deletedFranchiseRevenue)}) 
              from inactive/deleted franchises are preserved but excluded from active revenue.
            </p>
          </div>
        )}
        
        <p className="text-white/70 text-xs mt-4">
          Last calculated: {currentRevenue?.calculatedAt ? new Date(currentRevenue.calculatedAt).toLocaleString('en-IN') : 'N/A'}
        </p>
      </div>

      {/* ==================== TABLE VIEW ==================== */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] overflow-hidden">
          <div className="bg-gradient-to-r from-[#4a2e1f] to-[#6b4423] p-4 text-white">
            <div className="flex items-center">
              <FaChartBar className="text-xl md:text-2xl mr-3 opacity-90" />
              <div>
                <h2 className="text-base md:text-lg font-bold">COMPLETE REVENUE TABLE</h2>
                <p className="text-white/80 text-xs md:text-sm">All franchises and carts in table format</p>
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
                            <tr className="bg-[#fef4ec] hover:bg-[#f5e3d5] transition-colors border-b border-[#e2c1ac]">
                              <td className="px-4 py-3 text-sm font-bold text-[#4a2e1f]">{index + 1}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#4a2e1f] text-white">
                                  <FaBuilding className="mr-1" /> Franchise
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-[#4a2e1f]">{franchise.franchiseName}</td>
                              <td className="px-4 py-3 text-sm text-[#6b4423]">—</td>
                              <td className="px-4 py-3 text-sm font-medium text-[#4a2e1f]">{franchiseOrders}</td>
                              <td className="px-4 py-3 text-sm font-bold text-[#d86d2a]">{formatCurrency(franchise.revenue)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <div className="w-16 h-2 bg-[#e2c1ac] rounded-full overflow-hidden mr-2">
                                    <div 
                                      className="h-full bg-[#d86d2a] rounded-full"
                                      style={{ width: `${calculatePercentage(franchise.revenue, currentRevenue.totalRevenue)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-[#6b4423] font-medium">
                                    {calculatePercentage(franchise.revenue, currentRevenue.totalRevenue)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Cart Rows under this Franchise */}
                            {cafes
                              .sort((a, b) => b.revenue - a.revenue)
                              .map((cafe, cafeIndex) => (
                                <tr key={cafe.cartId} className="hover:bg-[#fef4ec] transition-colors">
                                  <td className="px-4 py-3 text-sm text-[#6b4423] pl-8">{index + 1}.{cafeIndex + 1}</td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#d86d2a] text-white">
                                      <FaStore className="mr-1" /> Cart
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[#4a2e1f] pl-8">{cafe.cartName || cafe.cafeName}</td>
                                  <td className="px-4 py-3 text-sm text-[#6b4423]">{franchise.franchiseName}</td>
                                  <td className="px-4 py-3 text-sm text-[#4a2e1f]">{cafe.orderCount || 0}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-[#d86d2a]">{formatCurrency(cafe.revenue)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center">
                                      <div className="w-16 h-2 bg-[#e2c1ac] rounded-full overflow-hidden mr-2">
                                        <div 
                                          className="h-full bg-[#d86d2a] rounded-full"
                                          style={{ width: `${calculatePercentage(cafe.revenue, currentRevenue.totalRevenue)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-[#6b4423]">
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
                <tfoot className="bg-[#4a2e1f] border-t-2 border-[#6b4423]">
                  <tr>
                    <td colSpan="4" className="px-4 py-3 text-sm font-bold text-white">GRAND TOTAL</td>
                    <td className="px-4 py-3 text-sm font-bold text-white">{currentRevenue?.totalOrders || 0}</td>
                    <td className="px-4 py-3 text-sm font-bold text-white">{formatCurrency(currentRevenue?.totalRevenue)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-white">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ==================== LEVEL 2: FRANCHISE REVENUE (Hierarchy View) ==================== */}
      {viewMode === 'hierarchy' && (
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] overflow-hidden">
          <div className="bg-gradient-to-r from-[#4a2e1f] to-[#6b4423] p-4 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center">
                <FaBuilding className="text-xl md:text-2xl mr-3 opacity-90" />
                <div>
                  <h2 className="text-base md:text-lg font-bold">LEVEL 2: FRANCHISE REVENUE</h2>
                  <p className="text-white/80 text-xs md:text-sm">Revenue breakdown by franchise</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-1 bg-white/20 rounded text-xs md:text-sm hover:bg-white/30 transition-colors border border-white/30"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1 bg-white/20 rounded text-xs md:text-sm hover:bg-white/30 transition-colors border border-white/30"
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
                      <div key={franchise.franchiseId} className="border border-[#e2c1ac] rounded-lg overflow-hidden bg-white">
                        {/* Franchise Header */}
                        <div
                          className={`flex flex-col md:flex-row md:items-center md:justify-between p-4 cursor-pointer transition-colors ${
                            isExpanded ? 'bg-[#fef4ec]' : 'bg-white hover:bg-[#fef4ec]'
                          }`}
                          onClick={() => toggleFranchise(franchise.franchiseId)}
                        >
                          <div className="flex items-center space-x-4 mb-2 md:mb-0">
                            <div className="flex items-center">
                              {isExpanded ? (
                                <FaChevronDown className="text-[#d86d2a] mr-2" />
                              ) : (
                                <FaChevronRight className="text-[#6b4423] mr-2" />
                              )}
                              <div className="w-8 h-8 bg-[#d86d2a] rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {index + 1}
                              </div>
                            </div>
                            <div>
                              <h3 className="font-semibold text-[#4a2e1f]">{franchise.franchiseName}</h3>
                              <p className="text-xs md:text-sm text-[#6b4423]">{franchise.cartCount || cafes.length} cart(s)</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between md:justify-end space-x-4 md:space-x-6">
                            {/* Progress Bar */}
                            <div className="hidden md:block w-32">
                              <div className="h-2 bg-[#e2c1ac] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-[#d86d2a] rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <p className="text-xs text-[#6b4423] mt-1 text-center">{percentage}% of total</p>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-base md:text-lg font-bold text-[#d86d2a]">{formatCurrency(franchise.revenue)}</p>
                              <p className="text-xs text-[#6b4423]">
                                {cafes.reduce((sum, c) => sum + (c.orderCount || 0), 0)} orders
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ==================== LEVEL 3: CART REVENUE ==================== */}
                        {isExpanded && (
                          <div className="border-t border-[#e2c1ac] bg-[#fef4ec]">
                            <div className="p-3 bg-[#d86d2a] border-b border-[#c75b1a]">
                              <div className="flex items-center">
                                <FaStore className="text-white mr-2" />
                                <span className="text-xs md:text-sm font-semibold text-white">
                                  LEVEL 3: CART REVENUE - {franchise.franchiseName}
                                </span>
                              </div>
                            </div>
                            
                            {cafes.length === 0 ? (
                              <div className="p-4 text-center text-[#6b4423] text-sm">
                                No cart data available for this franchise
                              </div>
                            ) : (
                              <div className="divide-y divide-[#e2c1ac]">
                                {cafes
                                  .sort((a, b) => b.revenue - a.revenue)
                                  .map((cafe, cafeIndex) => {
                                    const cafePercentage = calculatePercentage(cafe.revenue, franchise.revenue);
                                    return (
                                      <div 
                                        key={cafe.cartId} 
                                        className="flex flex-col md:flex-row md:items-center md:justify-between p-4 hover:bg-white transition-colors"
                                      >
                                        <div className="flex items-center space-x-3 mb-2 md:mb-0">
                                          <div className="w-6 h-6 bg-[#d86d2a] rounded-full flex items-center justify-center text-white text-xs font-bold">
                                            {cafeIndex + 1}
                                          </div>
                                          <div>
                                            <p className="font-medium text-[#4a2e1f]">{cafe.cartName || cafe.cafeName}</p>
                                            <p className="text-xs text-[#6b4423]">{cafe.orderCount || 0} orders</p>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-4">
                                          {/* Mini Progress Bar */}
                                          <div className="hidden md:block w-24">
                                            <div className="h-1.5 bg-[#e2c1ac] rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-[#d86d2a] rounded-full"
                                                style={{ width: `${cafePercentage}%` }}
                                              />
                                            </div>
                                            <p className="text-xs text-[#6b4423] mt-0.5 text-center">{cafePercentage}%</p>
                                          </div>
                                          
                                          <p className="font-semibold text-[#d86d2a]">{formatCurrency(cafe.revenue)}</p>
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
      <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] overflow-hidden">
        <div className="bg-gradient-to-r from-[#4a2e1f] to-[#6b4423] p-4 text-white">
          <div className="flex items-center">
            <FaCalendarAlt className="text-xl md:text-2xl mr-3 opacity-90" />
            <div>
              <h2 className="text-base md:text-lg font-bold">HISTORICAL REVENUE DATA</h2>
              <p className="text-white/80 text-xs md:text-sm">
                {periodType === 'daily' ? 'Daily' : 'Monthly'} revenue records (Last 30 entries)
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
              <thead className="bg-[#fef4ec]">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase tracking-wider">
                  Orders
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase tracking-wider">
                  Franchises
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase tracking-wider">
                  Carts
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase tracking-wider">
                  Avg Order Value
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2c1ac]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-[#6b4423]">
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
                    <tr key={record._id} className="hover:bg-[#fef4ec] transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-2 text-[#6b4423]" />
                          <span className="text-sm font-medium text-[#4a2e1f]">
                            {new Date(record.date).toLocaleDateString('en-IN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-sm font-bold text-[#4a2e1f]">
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
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-[#4a2e1f]">
                        {record.totalOrders || 0}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-[#4a2e1f]">
                        {record.franchiseRevenue?.length || 0}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-[#4a2e1f]">
                        {record.cartRevenue?.length || record.cafeRevenue?.length || 0}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-[#4a2e1f]">
                        {formatCurrency(avgOrderValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            console.log('Selected period data:', record);
                            setSelectedPeriod(record);
                          }}
                          className="text-[#d86d2a] hover:text-[#c75b1a] text-sm font-medium hover:underline"
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
          <div className="bg-white rounded-xl shadow-2xl border border-[#e2c1ac] w-full max-w-5xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#4a2e1f] to-[#6b4423] p-4 md:p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Revenue Details</h2>
                  <p className="text-white/80 text-sm md:text-base">
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                <div className="bg-white rounded-lg p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-xs md:text-sm text-[#6b4423] font-medium">Total Revenue</p>
                  <p className="text-lg md:text-2xl font-bold text-[#4a2e1f]">{formatCurrency(selectedPeriod.totalRevenue || 0)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-xs md:text-sm text-[#6b4423] font-medium">Total Orders</p>
                  <p className="text-lg md:text-2xl font-bold text-[#4a2e1f]">{selectedPeriod.totalOrders || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-xs md:text-sm text-[#6b4423] font-medium">Franchises</p>
                  <p className="text-lg md:text-2xl font-bold text-[#4a2e1f]">
                    {(selectedPeriod.franchiseRevenue && Array.isArray(selectedPeriod.franchiseRevenue)) 
                      ? selectedPeriod.franchiseRevenue.length 
                      : 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-xs md:text-sm text-[#6b4423] font-medium">Avg Order Value</p>
                  <p className="text-lg md:text-2xl font-bold text-[#4a2e1f]">
                    {formatCurrency((selectedPeriod.totalOrders > 0 && selectedPeriod.totalRevenue) 
                      ? selectedPeriod.totalRevenue / selectedPeriod.totalOrders 
                      : 0)}
                  </p>
                </div>
              </div>

              {/* Franchise Breakdown */}
              <div className="mb-6">
                <h3 className="text-base md:text-lg font-bold text-[#4a2e1f] mb-4 flex items-center">
                  <FaBuilding className="mr-2 text-[#d86d2a]" />
                  Franchise-wise Revenue
                </h3>
                {selectedPeriod.franchiseRevenue && selectedPeriod.franchiseRevenue.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {selectedPeriod.franchiseRevenue.sort((a, b) => b.revenue - a.revenue).map((franchise, index) => (
                    <div 
                        key={franchise.franchiseId || index} 
                      className="bg-white rounded-lg border border-[#e2c1ac] p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold text-[#4a2e1f]">{franchise.franchiseName || 'Unknown Franchise'}</p>
                            <p className="text-xs md:text-sm text-[#6b4423]">{franchise.cartCount || franchise.cafeCount || 0} cart(s)</p>
                        </div>
                        <div className="text-right">
                            <p className="text-base md:text-lg font-bold text-[#d86d2a]">{formatCurrency(franchise.revenue || 0)}</p>
                          <p className="text-xs text-[#6b4423]">
                              {calculatePercentage(franchise.revenue || 0, selectedPeriod.totalRevenue || 0)}% of total
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 bg-[#e2c1ac] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#d86d2a] rounded-full"
                            style={{ width: `${calculatePercentage(franchise.revenue || 0, selectedPeriod.totalRevenue || 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                ) : (
                  <div className="text-center py-8 text-[#6b4423] bg-[#fef4ec] rounded-lg border border-[#e2c1ac]">
                    <FaBuilding className="mx-auto text-3xl mb-2 opacity-50" />
                    <p>No franchise revenue data available for this period</p>
                  </div>
                )}
              </div>

              {/* Cart Breakdown */}
              <div>
                <h3 className="text-base md:text-lg font-bold text-[#4a2e1f] mb-4 flex items-center">
                  <FaStore className="mr-2 text-[#d86d2a]" />
                  Cart-wise Revenue
                </h3>
                {(selectedPeriod.cartRevenue || selectedPeriod.cafeRevenue) && 
                 (selectedPeriod.cartRevenue || selectedPeriod.cafeRevenue).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#fef4ec]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Cart</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Franchise</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Orders</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Revenue</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">% Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2c1ac]">
                      {(selectedPeriod.cartRevenue || selectedPeriod.cafeRevenue || [])
                          .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                        .map((cafe, index) => (
                            <tr key={cafe.cartId || cafe.cafeId || index} className="hover:bg-[#fef4ec]">
                            <td className="px-4 py-3 text-sm text-[#6b4423]">{index + 1}</td>
                            <td className="px-4 py-3 text-sm font-medium text-[#4a2e1f]">
                                {cafe.cartName || cafe.cafeName || 'Unknown Cart'}
                            </td>
                              <td className="px-4 py-3 text-sm text-[#6b4423]">{cafe.franchiseName || 'Unknown'}</td>
                              <td className="px-4 py-3 text-sm text-[#4a2e1f]">{cafe.orderCount || 0}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-[#4a2e1f]">
                                {formatCurrency(cafe.revenue || 0)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <div className="w-16 h-2 bg-[#e2c1ac] rounded-full overflow-hidden mr-2">
                                  <div 
                                    className="h-full bg-[#d86d2a] rounded-full"
                                      style={{ width: `${calculatePercentage(cafe.revenue || 0, selectedPeriod.totalRevenue || 0)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-[#6b4423]">
                                    {calculatePercentage(cafe.revenue || 0, selectedPeriod.totalRevenue || 0)}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                ) : (
                  <div className="text-center py-8 text-[#6b4423] bg-[#fef4ec] rounded-lg border border-[#e2c1ac]">
                    <FaStore className="mx-auto text-3xl mb-2 opacity-50" />
                    <p>No cart revenue data available for this period</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueHistory;
