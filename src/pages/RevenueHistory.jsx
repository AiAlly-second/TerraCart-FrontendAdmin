import React, { useState, useEffect } from "react";
import {
  FaCalendarAlt,
  FaChartLine,
  FaRupeeSign,
  FaSpinner,
  FaDownload,
  FaBuilding,
  FaStore,
  FaChevronDown,
  FaChevronRight,
  FaGlobe,
  FaArrowUp,
  FaArrowDown,
  FaSync,
  FaFilter,
  FaChartBar,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import api from "../utils/api";

const RevenueHistory = () => {
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState("daily");
  const [history, setHistory] = useState([]);
  const [currentRevenue, setCurrentRevenue] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [viewMode, setViewMode] = useState("hierarchy"); // 'hierarchy' or 'table'
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [periodType]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch both history and current revenue in parallel
      const [historyResponse, currentResponse] = await Promise.all([
        api.get(`/revenue/history?periodType=${periodType}&limit=30`),
        api.get("/revenue/current"),
      ]);

      if (historyResponse.data?.success) {
        setHistory(historyResponse.data.data || []);
      }

      if (currentResponse.data?.success) {
        setCurrentRevenue(currentResponse.data.data);
      }
    } catch (error) {
      console.error("Error fetching revenue data:", error);
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
      setExpandedFranchises(
        new Set(currentRevenue.franchiseRevenue.map((f) => f.franchiseId))
      );
    }
  };

  const collapseAll = () => {
    setExpandedFranchises(new Set());
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const calculatePercentage = (part, total) => {
    if (!total || total === 0) return 0;
    return ((part / total) * 100).toFixed(1);
  };

  const exportHistory = async () => {
    try {
      setExporting(true);
      const dateStr = new Date().toISOString().split("T")[0];
      
      // Fetch detailed data from backend export endpoint
      let url = '/revenue/export';
      const params = new URLSearchParams();
      
      if (dateRange.startDate && dateRange.endDate) {
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);
        url += `?${params.toString()}`;
      }
      
      const response = await api.get(url);
      const detailedData = response.data?.data || {};
      const { orders = [], items = [] } = detailedData;

      if (orders.length === 0) {
        alert("No data found for the selected period.");
        setExporting(false);
        return;
      }

      // Build comprehensive data structures
      const franchiseMap = new Map();
      const dailyMap = new Map();

      orders.forEach(order => {
        const franchiseName = order.Franchise || "Unknown";
        const cartName = order.Cart || "Unknown";
        const totalAmount = parseFloat(order.TotalAmount) || 0;
        const orderDate = order.Date || "Unknown";

        // Franchise and Cart aggregation
        if (!franchiseMap.has(franchiseName)) {
          franchiseMap.set(franchiseName, {
            revenue: 0,
            orderCount: 0,
            carts: new Map()
          });
        }
        
        const franchise = franchiseMap.get(franchiseName);
        franchise.revenue += totalAmount;
        franchise.orderCount += 1;

        if (!franchise.carts.has(cartName)) {
          franchise.carts.set(cartName, {
            revenue: 0,
            orderCount: 0,
            orders: []
          });
        }
        
        const cart = franchise.carts.get(cartName);
        cart.revenue += totalAmount;
        cart.orderCount += 1;
        cart.orders.push(order);

        // Daily aggregation
        if (!dailyMap.has(orderDate)) {
          dailyMap.set(orderDate, {
            revenue: 0,
            orderCount: 0
          });
        }
        
        const daily = dailyMap.get(orderDate);
        daily.revenue += totalAmount;
        daily.orderCount += 1;
      });

      // Calculate totals
      const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.TotalAmount) || 0), 0);
      const totalOrders = orders.length;

      // ========== CREATE SINGLE COMPREHENSIVE SHEET ==========
      const allData = [];

      // SECTION 1: HEADER & SUMMARY
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push(["COMPREHENSIVE REVENUE REPORT - ALL DATA IN ONE SHEET"]);
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push([""]);
      allData.push(["Generated:", new Date().toLocaleString("en-IN")]);
      allData.push(["Date Range:", dateRange.startDate && dateRange.endDate ? `${dateRange.startDate} to ${dateRange.endDate}` : "All Time"]);
      allData.push([""]);
      allData.push(["OVERALL SUMMARY"]);
      allData.push(["Total Revenue:", `₹${totalRevenue.toFixed(2)}`]);
      allData.push(["Total Orders:", totalOrders]);
      allData.push(["Total Franchises:", franchiseMap.size]);
      allData.push(["Total Carts:", Array.from(franchiseMap.values()).reduce((sum, f) => sum + f.carts.size, 0)]);
      allData.push(["Average Order Value:", `₹${(totalRevenue / totalOrders).toFixed(2)}`]);
      allData.push([""]);
      allData.push([""]);

      // SECTION 2: FRANCHISE & CART BREAKDOWN
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push(["SECTION 1: FRANCHISE & CART REVENUE BREAKDOWN"]);
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push([""]);
      allData.push(["#", "Type", "Name", "Parent Franchise", "Revenue (₹)", "Orders", "Avg Order (₹)", "Carts", "% of Franchise", "% of Total"]);
      allData.push(["─────", "─────────", "─────────────────────", "─────────────────────", "─────────────", "───────", "──────────────", "──────", "──────────────", "───────────"]);

      let rowNum = 1;
      Array.from(franchiseMap.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .forEach(([franchiseName, franchiseData]) => {
          // Franchise row
          allData.push([
            rowNum++,
            "FRANCHISE",
            franchiseName,
            "—",
            franchiseData.revenue.toFixed(2),
            franchiseData.orderCount,
            (franchiseData.revenue / franchiseData.orderCount).toFixed(2),
            franchiseData.carts.size,
            "100.00%",
            `${((franchiseData.revenue / totalRevenue) * 100).toFixed(2)}%`
          ]);

          // Cart rows
          Array.from(franchiseData.carts.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .forEach(([cartName, cartData]) => {
              allData.push([
                `  ${rowNum++}`,
                "  └ CART",
                `  ${cartName}`,
                franchiseName,
                cartData.revenue.toFixed(2),
                cartData.orderCount,
                (cartData.revenue / cartData.orderCount).toFixed(2),
                "—",
                `${((cartData.revenue / franchiseData.revenue) * 100).toFixed(2)}%`,
                `${((cartData.revenue / totalRevenue) * 100).toFixed(2)}%`
              ]);
            });

          allData.push([""]); // Spacing
        });

      // Add totals
      allData.push(["", "GRAND TOTAL", `${franchiseMap.size} Franchises, ${Array.from(franchiseMap.values()).reduce((sum, f) => sum + f.carts.size, 0)} Carts`, "", totalRevenue.toFixed(2), totalOrders, (totalRevenue / totalOrders).toFixed(2), "", "", "100.00%"]);
      allData.push([""]);
      allData.push([""]);

      // SECTION 3: DAILY REVENUE BREAKDOWN
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push(["SECTION 2: DAILY REVENUE BREAKDOWN"]);
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push([""]);
      allData.push(["Date", "Revenue (₹)", "Orders", "Avg Order Value (₹)"]);
      allData.push(["─────────────", "─────────────", "───────", "───────────────────"]);

      Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([date, data]) => {
          allData.push([
            date,
            data.revenue.toFixed(2),
            data.orderCount,
            (data.revenue / data.orderCount).toFixed(2)
          ]);
        });

      allData.push([""]);
      allData.push([""]);

      // SECTION 4: ALL ORDERS
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push(["SECTION 3: ALL ORDERS (COMPLETE DETAILS)"]);
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push([""]);
      allData.push(["Order ID", "Invoice", "Date", "Time", "Franchise", "Cart", "Service Type", "Order Type", "Customer", "Mobile", "Payment", "Subtotal (₹)", "GST (₹)", "Total (₹)"]);
      allData.push(["───────────", "──────────────", "────────────", "────────", "───────────────", "───────────────", "─────────────", "────────────", "──────────────", "──────────────", "─────────", "──────────────", "────────", "──────────"]);

      orders.forEach(order => {
        allData.push([
          order.OrderID,
          order.InvoiceNo,
          order.Date,
          order.Time,
          order.Franchise,
          order.Cart,
          order.ServiceType,
          order.OrderType || "N/A",
          order.CustomerName || "N/A",
          order.Mobile || "N/A",
          order.PaymentMethod,
          order.Subtotal,
          order.GST,
          order.TotalAmount
        ]);
      });

      allData.push([""]);
      allData.push([""]);

      // SECTION 5: ALL LINE ITEMS
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push(["SECTION 4: ALL LINE ITEMS (ITEM-LEVEL DETAILS)"]);
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push([""]);
      allData.push(["Order ID", "Item Name", "Quantity", "Unit Price (₹)", "Total Price (₹)", "Is Returned", "Is Takeaway", "Franchise", "Cart"]);
      allData.push(["───────────", "────────────────────", "──────────", "───────────────", "────────────────", "────────────", "─────────────", "───────────────", "───────────────"]);

      items.forEach(item => {
        allData.push([
          item.OrderID,
          item.ItemName,
          item.Quantity,
          item.UnitPrice,
          item.TotalPrice,
          item.Isreturned,
          item.IsTakeaway,
          item.Franchise,
          item.Cart
        ]);
      });

      allData.push([""]);
      allData.push([""]);
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);
      allData.push(["END OF REPORT"]);
      allData.push(["═════════════════════════════════════════════════════════════════════════════"]);

      // Create workbook with single sheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(allData);
      
      // Set column widths for better readability
      worksheet["!cols"] = [
        { wch: 12 },  // Column A
        { wch: 15 },  // Column B
        { wch: 28 },  // Column C
        { wch: 22 },  // Column D
        { wch: 15 },  // Column E
        { wch: 10 },  // Column F
        { wch: 15 },  // Column G
        { wch: 12 },  // Column H
        { wch: 15 },  // Column I
        { wch: 15 },  // Column J
        { wch: 12 },  // Column K
        { wch: 14 },  // Column L
        { wch: 10 },  // Column M
        { wch: 12 }   // Column N
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, "Complete Revenue Report");

      // Generate filename
      const fileName = `revenue-complete-${dateRange.startDate || 'all'}-to-${dateRange.endDate || dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      alert(`Export successful! All data consolidated in one sheet with ${orders.length} orders.`);
    } catch (error) {
      console.error("Error exporting revenue report:", error);
      alert(`Failed to export: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setExporting(false);
    }
  };

  // Get carts for a specific franchise
  const getCafesForFranchise = (franchiseId) => {
    if (!currentRevenue?.cartRevenue) return [];
    return currentRevenue.cartRevenue.filter(
      (cafe) => cafe.franchiseId === franchiseId
    );
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
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <FaChartLine className="text-[#d86d2a]" />
            </div>
            Revenue History
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Track global, franchise, and cart revenue performance over time
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
          >
            <FaSync className={`text-gray-400 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={exportHistory}
            disabled={exporting}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#d86d2a] rounded-lg hover:bg-[#c75b1a] transition-all shadow-sm hover:shadow active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {exporting ? <FaSpinner className="animate-spin" /> : <FaDownload />}
            {exporting ? "Exporting..." : "Export In-Depth Report"}
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setPeriodType("daily")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
              periodType === "daily"
                ? "bg-white text-[#d86d2a] shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Daily Revenue
          </button>
          {/* Add more period types here if needed in future */}
        </div>
        
        <div className="flex items-center gap-2">
           <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">View Mode</span>
           <div className="flex p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode("hierarchy")}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === "hierarchy"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <FaBuilding className="text-xs" /> Hierarchy
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === "table"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <FaChartBar className="text-xs" /> Table
              </button>
           </div>
        </div>
      </div>

      {/* Level 1: Global Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <FaGlobe className="text-6xl text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {formatCurrency(currentRevenue?.totalRevenue)}
            </h3>
          </div>
          <p className="text-xs text-green-600 mt-2 flex items-center font-medium">
             <FaArrowUp className="mr-1" /> Live Updates
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <FaChartBar className="text-6xl text-purple-500" />
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Orders</p>
          <div className="mt-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
               {currentRevenue?.totalOrders || 0}
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-2">Across all locations</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <FaBuilding className="text-6xl text-[#d86d2a]" />
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Franchises</p>
          <div className="mt-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
               {currentRevenue?.franchiseRevenue?.length || 0}
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-2">Contributing revenue</p>
        </div>

         <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
             <FaStore className="text-6xl text-teal-500" />
          </div>
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Carts</p>
          <div className="mt-2">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
               {currentRevenue?.cartRevenue?.length || 0}
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-2">Currently active</p>
        </div>
      </div>

      {/* Preserved Data Notification */}
      {currentRevenue?.preservedData?.deletedFranchiseOrdersCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 text-sm text-amber-800">
            <span className="text-lg">ℹ️</span>
            <p>
              <strong>Historical Data Note:</strong> {currentRevenue.preservedData.deletedFranchiseOrdersCount} orders 
              ({formatCurrency(currentRevenue.preservedData.deletedFranchiseRevenue)}) are from franchises/carts that are no longer active, but are preserved here for accurate totals.
            </p>
          </div>
      )}
      
      <div className="text-xs text-right text-gray-400 -mt-2">
          Calculated: {currentRevenue?.calculatedAt ? new Date(currentRevenue.calculatedAt).toLocaleString("en-IN") : "N/A"}
      </div>

      {/* ==================== TABLE VIEW ==================== */}
      {viewMode === "table" && (
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
               <div className="p-1.5 bg-purple-100 rounded-md">
                 <FaChartBar className="text-purple-600" />
               </div>
               <div>
                  <h2 className="text-lg font-bold text-gray-900">Complete Revenue Table</h2>
                  <p className="text-xs text-gray-500">Detailed breakdown of all franchises and carts</p>
               </div>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      #
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Type
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Name
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">
                      Parent Franchise
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Orders
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Revenue
                    </th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      % of Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {!currentRevenue?.franchiseRevenue ||
                  currentRevenue.franchiseRevenue.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-6 py-12 text-center text-gray-500"
                      >
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
                          const cafes = getCafesForFranchise(
                            franchise.franchiseId
                          );
                          const franchiseOrders = cafes.reduce(
                            (sum, c) => sum + (c.orderCount || 0),
                            0
                          );

                          return (
                            <React.Fragment key={franchise.franchiseId}>
                              {/* Franchise Row */}
                              <tr className="bg-[#fef4ec] hover:bg-[#f5e3d5] transition-colors border-b border-[#e2c1ac]">
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-[#4a2e1f] whitespace-nowrap">
                                  {index + 1}
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3">
                                  <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-[#4a2e1f] text-white whitespace-nowrap">
                                    <FaBuilding className="mr-0.5 sm:mr-1 text-[10px] sm:text-xs" />{" "}
                                    <span className="hidden sm:inline">
                                      Franchise
                                    </span>
                                    <span className="sm:hidden">F</span>
                                  </span>
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-[#4a2e1f] min-w-[120px]">
                                  <span className="truncate block">
                                    {franchise.franchiseName}
                                  </span>
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#6b4423] whitespace-nowrap">
                                  —
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-[#4a2e1f] whitespace-nowrap">
                                  {franchiseOrders}
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-[#d86d2a] whitespace-nowrap">
                                  {formatCurrency(franchise.revenue)}
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <div className="w-12 sm:w-16 h-2 bg-[#e2c1ac] rounded-full overflow-hidden flex-shrink-0">
                                      <div
                                        className="h-full bg-[#d86d2a] rounded-full"
                                        style={{
                                          width: `${calculatePercentage(
                                            franchise.revenue,
                                            currentRevenue.totalRevenue
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] sm:text-xs text-[#6b4423] font-medium whitespace-nowrap">
                                      {calculatePercentage(
                                        franchise.revenue,
                                        currentRevenue.totalRevenue
                                      )}
                                      %
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* Cart Rows under this Franchise */}
                              {cafes
                                .sort((a, b) => b.revenue - a.revenue)
                                .map((cafe, cafeIndex) => (
                                  <tr
                                    key={cafe.cartId}
                                    className="hover:bg-[#fef4ec] transition-colors"
                                  >
                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#6b4423] pl-4 sm:pl-8 whitespace-nowrap">
                                      {index + 1}.{cafeIndex + 1}
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                                      <span className="inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-[#d86d2a] text-white whitespace-nowrap">
                                        <FaStore className="mr-0.5 sm:mr-1 text-[10px] sm:text-xs" />{" "}
                                        <span className="hidden sm:inline">
                                          Cart
                                        </span>
                                        <span className="sm:hidden">C</span>
                                      </span>
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#4a2e1f] pl-4 sm:pl-8 min-w-[120px]">
                                      <span className="truncate block">
                                        {cafe.cartName || cafe.cafeName}
                                      </span>
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#6b4423] min-w-[120px]">
                                      <span className="truncate block">
                                        {franchise.franchiseName}
                                      </span>
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#4a2e1f] whitespace-nowrap">
                                      {cafe.orderCount || 0}
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-[#d86d2a] whitespace-nowrap">
                                      {formatCurrency(cafe.revenue)}
                                    </td>
                                    <td className="px-2 sm:px-4 py-2 sm:py-3">
                                      <div className="flex items-center gap-1 sm:gap-2">
                                        <div className="w-12 sm:w-16 h-2 bg-[#e2c1ac] rounded-full overflow-hidden flex-shrink-0">
                                          <div
                                            className="h-full bg-[#d86d2a] rounded-full"
                                            style={{
                                              width: `${calculatePercentage(
                                                cafe.revenue,
                                                currentRevenue.totalRevenue
                                              )}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] sm:text-xs text-[#6b4423] whitespace-nowrap">
                                          {calculatePercentage(
                                            cafe.revenue,
                                            currentRevenue.totalRevenue
                                          )}
                                          %
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
                      <td
                        colSpan="4"
                        className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-white"
                      >
                        GRAND TOTAL
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                        {currentRevenue?.totalOrders || 0}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                        {formatCurrency(currentRevenue?.totalRevenue)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                        100%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LEVEL 2: FRANCHISE REVENUE (Hierarchy View) ==================== */}
      {viewMode === "hierarchy" && (
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 rounded-md">
                  <FaBuilding className="text-[#d86d2a]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Franchise Revenue Hierarchy</h2>
                  <p className="text-xs text-gray-500">Interactive breakdown by franchise</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm"
                >
                  Collapse All
                </button>
            </div>
          </div>

          <div className="p-4">
            {!currentRevenue?.franchiseRevenue ||
            currentRevenue.franchiseRevenue.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FaBuilding className="mx-auto text-4xl mb-4 opacity-50" />
                <p>No franchise revenue data available</p>
                <p className="text-sm mt-2">
                  Revenue will appear here when orders are paid
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentRevenue.franchiseRevenue
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((franchise, index) => {
                    const cafes = getCafesForFranchise(franchise.franchiseId);
                    const isExpanded = expandedFranchises.has(
                      franchise.franchiseId
                    );
                    const percentage = calculatePercentage(
                      franchise.revenue,
                      currentRevenue.totalRevenue
                    );

                    return (
                      <div
                        key={franchise.franchiseId}
                        className="border border-[#e2c1ac] rounded-lg overflow-hidden bg-white"
                      >
                        {/* Franchise Header */}
                        <div
                          className={`flex flex-col md:flex-row md:items-center md:justify-between p-4 cursor-pointer transition-colors ${
                            isExpanded
                              ? "bg-[#fef4ec]"
                              : "bg-white hover:bg-[#fef4ec]"
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
                              <h3 className="font-semibold text-[#4a2e1f]">
                                {franchise.franchiseName}
                              </h3>
                              <p className="text-xs md:text-sm text-[#6b4423]">
                                {franchise.cartCount || cafes.length} cart(s)
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:justify-end gap-2 sm:gap-4 md:gap-6 mt-2 sm:mt-0">
                            {/* Progress Bar */}
                            <div className="hidden sm:block w-full sm:w-32">
                              <div className="h-2 bg-[#e2c1ac] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#d86d2a] rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <p className="text-xs text-[#6b4423] mt-1 text-center">
                                {percentage}% of total
                              </p>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-sm sm:text-base md:text-lg font-bold text-[#d86d2a] break-words">
                                {formatCurrency(franchise.revenue)}
                              </p>
                              <p className="text-xs text-[#6b4423]">
                                {cafes.reduce(
                                  (sum, c) => sum + (c.orderCount || 0),
                                  0
                                )}{" "}
                                orders
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
                                  LEVEL 3: CART REVENUE -{" "}
                                  {franchise.franchiseName}
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
                                    const cafePercentage = calculatePercentage(
                                      cafe.revenue,
                                      franchise.revenue
                                    );
                                    return (
                                      <div
                                        key={cafe.cartId}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 hover:bg-white transition-colors gap-2 sm:gap-4"
                                      >
                                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                          <div className="w-6 h-6 bg-[#d86d2a] rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                            {cafeIndex + 1}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="font-medium text-[#4a2e1f] text-sm sm:text-base truncate">
                                              {cafe.cartName || cafe.cafeName}
                                            </p>
                                            <p className="text-xs text-[#6b4423]">
                                              {cafe.orderCount || 0} orders
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end space-x-2 sm:space-x-4">
                                          {/* Mini Progress Bar */}
                                          <div className="hidden sm:block w-20 sm:w-24 flex-shrink-0">
                                            <div className="h-1.5 bg-[#e2c1ac] rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-[#d86d2a] rounded-full"
                                                style={{
                                                  width: `${cafePercentage}%`,
                                                }}
                                              />
                                            </div>
                                            <p className="text-xs text-[#6b4423] mt-0.5 text-center">
                                              {cafePercentage}%
                                            </p>
                                          </div>

                                          <p className="font-semibold text-[#d86d2a] text-sm sm:text-base whitespace-nowrap">
                                            {formatCurrency(cafe.revenue)}
                                          </p>
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-md">
               <FaCalendarAlt className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Historical Revenue Data</h2>
              <p className="text-xs text-gray-500">Daily revenue records (Last 30 days)</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Total Revenue</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Orders</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Active Units</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider">Avg Order Value</th>
                <th className="px-6 py-3 font-medium uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-400 flex flex-col items-center">
                    <FaChartBar className="text-4xl mb-3 opacity-20" />
                    <p>No historical data available yet</p>
                  </td>
                </tr>
              ) : (
                history.map((record, index) => {
                  const avgOrderValue = record.totalOrders > 0
                    ? record.totalRevenue / record.totalOrders
                    : 0;
                  const prevRecord = history[index + 1];
                  const revenueChange = prevRecord
                    ? (((record.totalRevenue - prevRecord.totalRevenue) / prevRecord.totalRevenue) * 100).toFixed(1)
                    : null;

                  return (
                    <tr key={record._id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">
                        {new Date(record.date).toLocaleDateString("en-IN", {
                          year: "numeric", month: "short", day: "numeric"
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{formatCurrency(record.totalRevenue)}</span>
                            {revenueChange !== null && (
                              <span className={`text-xs flex items-center ${parseFloat(revenueChange) >= 0 ? "text-green-600" : "text-red-500"}`}>
                                {parseFloat(revenueChange) >= 0 ? <FaArrowUp className="mr-1 text-[10px]" /> : <FaArrowDown className="mr-1 text-[10px]" />}
                                {Math.abs(parseFloat(revenueChange))}%
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {record.totalOrders || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          <div className="flex items-center gap-2">
                            <span title="Franchises" className="px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold">{record.franchiseRevenue?.length || 0} F</span>
                            <span className="text-gray-300">|</span>
                            <span title="Carts" className="px-2 py-0.5 rounded bg-gray-100 text-xs font-semibold">{record.cartRevenue?.length || record.cafeRevenue?.length || 0} C</span>
                          </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {formatCurrency(avgOrderValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => {
                            console.log("View Report clicked for:", record);
                            setSelectedPeriod(record);
                          }}
                          className="text-[#d86d2a] hover:text-[#c75b1a] text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#d86d2a]/30 hover:bg-[#d86d2a]/5 transition-all"
                        >
                          View Report
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
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-[100] p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-[#e2c1ac] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col my-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#4a2e1f] to-[#6b4423] p-3 sm:p-4 md:p-6 text-white flex-shrink-0">
              <div className="flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold">
                    Revenue Details
                  </h2>
                  <p className="text-white/80 text-xs sm:text-sm md:text-base mt-1">
                    {new Date(selectedPeriod.date).toLocaleDateString("en-IN", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPeriod(null)}
                  className="text-white/80 hover:text-white text-2xl leading-none p-1 ml-2 flex-shrink-0"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
                <div className="bg-white rounded-lg p-2 sm:p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-[10px] sm:text-xs md:text-sm text-[#6b4423] font-medium truncate">
                    Total Revenue
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#4a2e1f] break-words">
                    {formatCurrency(selectedPeriod.totalRevenue || 0)}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-[10px] sm:text-xs md:text-sm text-[#6b4423] font-medium truncate">
                    Total Orders
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#4a2e1f]">
                    {selectedPeriod.totalOrders || 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-[10px] sm:text-xs md:text-sm text-[#6b4423] font-medium truncate">
                    Franchises
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#4a2e1f]">
                    {selectedPeriod.franchiseRevenue &&
                    Array.isArray(selectedPeriod.franchiseRevenue)
                      ? selectedPeriod.franchiseRevenue.length
                      : 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 sm:p-3 md:p-4 border border-[#e2c1ac] shadow-sm">
                  <p className="text-[10px] sm:text-xs md:text-sm text-[#6b4423] font-medium truncate">
                    Avg Order Value
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#4a2e1f] break-words">
                    {formatCurrency(
                      selectedPeriod.totalOrders > 0 &&
                        selectedPeriod.totalRevenue
                        ? selectedPeriod.totalRevenue /
                            selectedPeriod.totalOrders
                        : 0
                    )}
                  </p>
                </div>
              </div>

              {/* Franchise Breakdown */}
              <div className="mb-6">
                <h3 className="text-base md:text-lg font-bold text-[#4a2e1f] mb-4 flex items-center">
                  <FaBuilding className="mr-2 text-[#d86d2a]" />
                  Franchise-wise Revenue
                </h3>
                {selectedPeriod.franchiseRevenue &&
                selectedPeriod.franchiseRevenue.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {selectedPeriod.franchiseRevenue
                      .sort((a, b) => b.revenue - a.revenue)
                      .map((franchise, index) => (
                        <div
                          key={franchise.franchiseId || index}
                          className="bg-white rounded-lg border border-[#e2c1ac] p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-[#4a2e1f]">
                                {franchise.franchiseName || "Unknown Franchise"}
                              </p>
                              <p className="text-xs md:text-sm text-[#6b4423]">
                                {franchise.cartCount ||
                                  franchise.cafeCount ||
                                  0}{" "}
                                cart(s)
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-base md:text-lg font-bold text-[#d86d2a]">
                                {formatCurrency(franchise.revenue || 0)}
                              </p>
                              <p className="text-xs text-[#6b4423]">
                                {calculatePercentage(
                                  franchise.revenue || 0,
                                  selectedPeriod.totalRevenue || 0
                                )}
                                % of total
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 bg-[#e2c1ac] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#d86d2a] rounded-full"
                              style={{
                                width: `${calculatePercentage(
                                  franchise.revenue || 0,
                                  selectedPeriod.totalRevenue || 0
                                )}%`,
                              }}
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
                (selectedPeriod.cartRevenue || selectedPeriod.cafeRevenue)
                  .length > 0 ? (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <table className="w-full min-w-[500px]">
                        <thead className="bg-[#fef4ec]">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-[#4a2e1f] uppercase whitespace-nowrap">
                              #
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-[#4a2e1f] uppercase min-w-[100px]">
                              Cart
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-[#4a2e1f] uppercase min-w-[100px]">
                              Franchise
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-[#4a2e1f] uppercase whitespace-nowrap">
                              Orders
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-[#4a2e1f] uppercase whitespace-nowrap">
                              Revenue
                            </th>
                            <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-[#4a2e1f] uppercase whitespace-nowrap">
                              % Share
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2c1ac]">
                          {(
                            selectedPeriod.cartRevenue ||
                            selectedPeriod.cafeRevenue ||
                            []
                          )
                            .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                            .map((cafe, index) => (
                              <tr
                                key={cafe.cartId || cafe.cafeId || index}
                                className="hover:bg-[#fef4ec]"
                              >
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#6b4423] whitespace-nowrap">
                                  {index + 1}
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-[#4a2e1f] min-w-[100px]">
                                  <span className="truncate block">
                                    {cafe.cartName ||
                                      cafe.cafeName ||
                                      "Unknown Cart"}
                                  </span>
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#6b4423] min-w-[100px]">
                                  <span className="truncate block">
                                    {cafe.franchiseName || "Unknown"}
                                  </span>
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-[#4a2e1f] whitespace-nowrap">
                                  {cafe.orderCount || 0}
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-[#4a2e1f] whitespace-nowrap">
                                  {formatCurrency(cafe.revenue || 0)}
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3">
                                  <div className="flex items-center gap-1 sm:gap-2">
                                    <div className="w-12 sm:w-16 h-2 bg-[#e2c1ac] rounded-full overflow-hidden flex-shrink-0">
                                      <div
                                        className="h-full bg-[#d86d2a] rounded-full"
                                        style={{
                                          width: `${calculatePercentage(
                                            cafe.revenue || 0,
                                            selectedPeriod.totalRevenue || 0
                                          )}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] sm:text-xs text-[#6b4423] whitespace-nowrap">
                                      {calculatePercentage(
                                        cafe.revenue || 0,
                                        selectedPeriod.totalRevenue || 0
                                      )}
                                      %
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
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
