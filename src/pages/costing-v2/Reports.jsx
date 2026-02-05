import React, { useEffect, useState } from "react";
import {
  getFoodCostReport,
  getSupplierPriceHistory,
  getPnLReport,
} from "../../services/costingV2Api";
import { FaDownload, FaFileCsv, FaFilePdf } from "react-icons/fa";
import * as XLSX from "xlsx";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { formatUnit } from "../../utils/unitConverter";
import { useAuth } from "../../context/AuthContext";

const Reports = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [activeReport, setActiveReport] = useState("food-cost");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [foodCostData, setFoodCostData] = useState(null);

  const [priceHistoryData, setPriceHistoryData] = useState([]);
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);

  // Super admin: do not show price history; ensure active report is never price-history
  useEffect(() => {
    if (isSuperAdmin && activeReport === "price-history") {
      setActiveReport("food-cost");
    }
  }, [isSuperAdmin, activeReport]);

  useEffect(() => {
    fetchReport();
  }, [activeReport, dateRange, selectedOutlet]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = {
        from: dateRange.from,
        to: dateRange.to,
        ...(selectedOutlet && { cartId: selectedOutlet }),
      };

      switch (activeReport) {
        case "food-cost":
          const foodCostRes = await getFoodCostReport(params);
          if (foodCostRes.data.success) setFoodCostData(foodCostRes.data.data);
          break;

        case "price-history":
          if (!isSuperAdmin) {
            const priceRes = await getSupplierPriceHistory(params);
            if (priceRes.data.success) setPriceHistoryData(priceRes.data.data);
          }
          break;
        case "pnl":
          const pnlRes = await getPnLReport(params);
          if (pnlRes.data.success) setPnlData(pnlRes.data.data);
          break;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching report:", error);
      }
      alert("Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const dateStr = new Date().toISOString().split("T")[0];
    const wb = XLSX.utils.book_new();

    if (activeReport === "pnl" && pnlData) {
      // ========== COMPREHENSIVE P&L EXPORT ==========
      const pnlExportData = [];
      
      // Header
      pnlExportData.push(["═════════════════════════════════════════════════════════════════════"]);
      pnlExportData.push(["PROFIT & LOSS STATEMENT - DETAILED REPORT"]);
      pnlExportData.push(["═════════════════════════════════════════════════════════════════════"]);
      pnlExportData.push([""]);
      pnlExportData.push(["Generated:", new Date().toLocaleString("en-IN")]);
      pnlExportData.push(["Period:", `${dateRange.from} to ${dateRange.to}`]);
      pnlExportData.push(["Outlet:", selectedOutlet || "All Outlets"]);
      pnlExportData.push([""]);
      
      // Income Section
      pnlExportData.push(["INCOME"]);
      pnlExportData.push(["─────────────────────────────────────"]);
      pnlExportData.push(["Total Sales", `₹${Number(pnlData.sales || 0).toLocaleString("en-IN")}`]);
      pnlExportData.push([""]);
      
      // Expenses Section
      pnlExportData.push(["EXPENSES"]);
      pnlExportData.push(["─────────────────────────────────────"]);
      pnlExportData.push(["Food Cost", `₹${Number(pnlData.costs?.foodCost || 0).toLocaleString("en-IN")}`]);
      pnlExportData.push(["Labour Cost", `₹${Number(pnlData.costs?.labour || 0).toLocaleString("en-IN")}`]);
      pnlExportData.push(["Overhead Cost", `₹${Number(pnlData.costs?.overhead || 0).toLocaleString("en-IN")}`]);
      pnlExportData.push(["Total Expenses", `₹${Number(pnlData.costs?.total || 0).toLocaleString("en-IN")}`]);
      pnlExportData.push([""]);
      
      // Net Profit Section
      pnlExportData.push(["NET PROFIT"]);
      pnlExportData.push(["─────────────────────────────────────"]);
      pnlExportData.push(["Profit/Loss", `₹${Number(pnlData.profit || 0).toLocaleString("en-IN")}`]);
      pnlExportData.push(["Profit Margin", `${Number(pnlData.profitMargin || 0).toFixed(2)}%`]);
      pnlExportData.push([""]);
      
      // Percentages Breakdown
      pnlExportData.push(["COST BREAKDOWN (% of Sales)"]);
      pnlExportData.push(["─────────────────────────────────────"]);
      pnlExportData.push(["Food Cost %", `${((pnlData.costs?.foodCost / pnlData.sales) * 100 || 0).toFixed(2)}%`]);
      pnlExportData.push(["Labour Cost %", `${((pnlData.costs?.labour / pnlData.sales) * 100 || 0).toFixed(2)}%`]);
      pnlExportData.push(["Overhead Cost %", `${((pnlData.costs?.overhead / pnlData.sales) * 100 || 0).toFixed(2)}%`]);
      
      const pnlSheet = XLSX.utils.aoa_to_sheet(pnlExportData);
      pnlSheet["!cols"] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, pnlSheet, "P&L Statement");
      
      const fileName = `pnl-detailed-${dateRange.from}-to-${dateRange.to}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
    } else if (activeReport === "food-cost" && foodCostData) {
      // ========== COMPREHENSIVE FOOD COST EXPORT ==========
      const foodCostExportData = [];
      
      // Header
      foodCostExportData.push(["═════════════════════════════════════════════════════════════════════"]);
      foodCostExportData.push(["FOOD COST REPORT - DETAILED ANALYSIS"]);
      foodCostExportData.push(["═════════════════════════════════════════════════════════════════════"]);
      foodCostExportData.push([""]);
      foodCostExportData.push(["Generated:", new Date().toLocaleString("en-IN")]);
      foodCostExportData.push(["Period:", `${dateRange.from} to ${dateRange.to}`]);
      foodCostExportData.push(["Outlet:", selectedOutlet || "All Outlets"]);
      foodCostExportData.push([""]);
      
      // Summary
      foodCostExportData.push(["SUMMARY"]);
      foodCostExportData.push(["─────────────────────────────────────"]);
      foodCostExportData.push(["Total Food Cost", `₹${Number(foodCostData.totalFoodCost || 0).toLocaleString("en-IN")}`]);
      foodCostExportData.push(["Total Sales", `₹${Number(foodCostData.totalSales || 0).toLocaleString("en-IN")}`]);
      foodCostExportData.push(["Food Cost Percentage", `${Number(foodCostData.foodCostPercent || 0).toFixed(2)}%`]);
      foodCostExportData.push([""]);
      
      // Analysis
      foodCostExportData.push(["ANALYSIS"]);
      foodCostExportData.push(["─────────────────────────────────────"]);
      foodCostExportData.push(["Target Food Cost %", "30%"]);
      foodCostExportData.push(["Actual Food Cost %", `${Number(foodCostData.foodCostPercent || 0).toFixed(2)}%`]);
      const variance = Number(foodCostData.foodCostPercent || 0) - 30;
      foodCostExportData.push(["Variance", `${variance > 0 ? '+' : ''}${variance.toFixed(2)}%`]);
      foodCostExportData.push(["Status", variance > 5 ? "ATTENTION NEEDED" : variance > 0 ? "Monitor" : "Good"]);
      
      const foodCostSheet = XLSX.utils.aoa_to_sheet(foodCostExportData);
      foodCostSheet["!cols"] = [{ wch: 30 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(wb, foodCostSheet, "Food Cost Analysis");
      
      const fileName = `food-cost-detailed-${dateRange.from}-to-${dateRange.to}.xlsx`;
      XLSX.writeFile(wb, fileName);
      

    } else if (activeReport === "price-history" && !isSuperAdmin && priceHistoryData.length > 0) {
      // ========== COMPREHENSIVE PRICE HISTORY EXPORT (hidden for super admin) ==========
      const priceExportData = [];
      
      // Header
      priceExportData.push(["═════════════════════════════════════════════════════════════════════"]);
      priceExportData.push(["SUPPLIER PRICE HISTORY - COMPLETE RECORDS"]);
      priceExportData.push(["═════════════════════════════════════════════════════════════════════"]);
      priceExportData.push([""]);
      priceExportData.push(["Generated:", new Date().toLocaleString("en-IN")]);
      priceExportData.push(["Outlet:", selectedOutlet || "All Outlets"]);
      priceExportData.push(["Total Records:", priceHistoryData.length]);
      priceExportData.push([""]);
      priceExportData.push([""]);
      
      // Detailed Table
      priceExportData.push(["PURCHASE HISTORY"]);
      priceExportData.push(["─────────────────────────────────────"]);
      priceExportData.push([""]);
      priceExportData.push(["#", "Date", "Supplier", "Ingredient", "Quantity", "Unit", "Unit Price (₹)", "Total (₹)"]);
      priceExportData.push(["───", "────────────", "─────────────", "─────────────", "──────────", "──────", "──────────────", "───────────"]);
      
      priceHistoryData
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach((item, index) => {
          priceExportData.push([
            index + 1,
            new Date(item.date).toLocaleDateString("en-IN"),
            item.supplierName,
            item.ingredientName,
            item.qty,
            item.uom,
            Number(item.unitPrice || 0).toFixed(2),
            Number(item.total || 0).toFixed(2)
          ]);
        });
      
      const priceSheet = XLSX.utils.aoa_to_sheet(priceExportData);
      priceSheet["!cols"] = [
        { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 25 },
        { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(wb, priceSheet, "Price History");
      
      const fileName = `supplier-price-history-detailed-${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
    }
    
    alert("Detailed financial report exported successfully!");
  };

  const handleExportCSV = () => {
    // Use the same comprehensive export but as Excel
    exportToExcel();
  };

  const handleExportPDF = () => {
    // Simple PDF generation using window.print()
    window.print();
  };

  if (loading) {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <div className="text-center py-8 sm:py-12 text-sm sm:text-base">
          Loading report...
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
            Reports
          </h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-green-600 text-white px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-green-700 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm transition-colors"
            >
              <FaFileCsv className="text-xs sm:text-sm" />{" "}
              <span className="whitespace-nowrap">Export CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-red-600 text-white px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-red-700 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm transition-colors"
            >
              <FaFilePdf className="text-xs sm:text-sm" />{" "}
              <span className="whitespace-nowrap">Export PDF</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-0">
          <OutletFilter
            selectedOutlet={selectedOutlet}
            onOutletChange={setSelectedOutlet}
          />
        </div>
      </div>

      <div className="mb-3 sm:mb-4 flex flex-wrap gap-1 sm:gap-2 border-b overflow-x-auto">
        {(isSuperAdmin ? ["food-cost", "pnl"] : ["food-cost", "price-history", "pnl"]).map(
          (report) => (
            <button
              key={report}
              onClick={() => setActiveReport(report)}
              className={`px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 font-medium capitalize text-xs sm:text-sm whitespace-nowrap transition-colors ${
                activeReport === report
                  ? "border-b-2 border-[#d86d2a] text-[#d86d2a]"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {report.replace("-", " ")}
            </button>
          )
        )}
      </div>

      {(activeReport === "food-cost" || activeReport === "pnl") && (
        <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
          <div className="flex-1 sm:flex-initial">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) =>
                setDateRange({ ...dateRange, from: e.target.value })
              }
              className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
          <div className="flex-1 sm:flex-initial">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                setDateRange({ ...dateRange, to: e.target.value })
              }
              className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
        {activeReport === "food-cost" && foodCostData && (
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">
              Food Cost Report
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-gray-50 p-3 sm:p-4 rounded">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">
                  Total Food Cost
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 break-words">
                  ₹
                  {Number(foodCostData.totalFoodCost || 0).toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>
              <div className="bg-gray-50 p-3 sm:p-4 rounded">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">
                  Total Sales
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 break-words">
                  ₹
                  {Number(foodCostData.totalSales || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-gray-50 p-3 sm:p-4 rounded">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">
                  Food Cost %
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-[#d86d2a]">
                  {Number(foodCostData.foodCostPercent || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}



        {activeReport === "price-history" && !isSuperAdmin && (
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">
              Supplier Price History
            </h2>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Date
                      </th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Supplier
                      </th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase min-w-[120px]">
                        Ingredient
                      </th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Quantity
                      </th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Unit Price
                      </th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {priceHistoryData.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString()}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 sm:py-4 text-xs sm:text-sm min-w-[100px]">
                          <span className="truncate block">
                            {item.supplierName}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 sm:py-4 text-xs sm:text-sm min-w-[120px]">
                          <span className="truncate block">
                            {item.ingredientName}
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap">
                          {formatUnit(item.qty, item.uom)}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap">
                          ₹{Number(item.unitPrice || 0).toFixed(2)}
                        </td>
                        <td className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap">
                          ₹{Number(item.total || 0).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeReport === "pnl" && pnlData && (
          <div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4">
              Profit & Loss Report
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-green-50 p-3 sm:p-4 rounded">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">
                  Total Sales
                </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 break-words">
                  ₹{Number(pnlData.sales || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-red-50 p-3 sm:p-4 rounded">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">
                  Total Costs
                </p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 break-words">
                  ₹{Number(pnlData.costs?.total || 0).toLocaleString("en-IN")}
                </p>
                <div className="mt-2 text-xs sm:text-sm space-y-1">
                  <p>
                    Food Cost: ₹
                    {Number(pnlData.costs?.foodCost || 0).toLocaleString(
                      "en-IN"
                    )}
                  </p>
                  <p>
                    Labour: ₹
                    {Number(pnlData.costs?.labour || 0).toLocaleString("en-IN")}
                  </p>
                  <p>
                    Overhead: ₹
                    {Number(pnlData.costs?.overhead || 0).toLocaleString(
                      "en-IN"
                    )}
                  </p>
                </div>
              </div>
              <div
                className={`p-3 sm:p-4 rounded ${
                  pnlData.profit >= 0 ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p className="text-xs sm:text-sm text-gray-600 mb-1">
                  Net Profit
                </p>
                <p
                  className={`text-xl sm:text-2xl md:text-3xl font-bold break-words ${
                    pnlData.profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  ₹{Number(pnlData.profit || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-xs sm:text-sm text-gray-600 mt-2">
                  Profit Margin: {Number(pnlData.profitMargin || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
