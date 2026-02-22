import React, { useEffect, useState } from "react";
import {
  getLowStock,
  getFoodCostReport,
  getPnLReport,
  getHierarchicalCosting,
} from "../../services/costingV2Api";
import {
  FaExclamationTriangle,
  FaChartLine,
  FaRupeeSign,
  FaBuilding,
  FaStore,
  FaChevronDown,
  FaChevronRight,
  FaCalendarAlt,
  FaDownload,
} from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { useAuth } from "../../context/AuthContext";
import { formatUnit, convertUnit } from "../../utils/unitConverter";
import api from "../../utils/api";
import { exportRowsToExcel } from "../../utils/excelReport";

const Dashboard = () => {
  const { user } = useAuth();
  const [lowStock, setLowStock] = useState([]);
  const [foodCost, setFoodCost] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [hierarchicalData, setHierarchicalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [exportingRevenue, setExportingRevenue] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchDashboardData();
  }, [selectedOutlet, dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = {
        from: dateRange.from,
        to: dateRange.to,
      };
      if (selectedOutlet) params.cartId = selectedOutlet;

      if (user?.role === "super_admin" || user?.role === "franchise_admin") {
        // Super admin and franchise admin get hierarchical data
        const hierarchicalRes = await getHierarchicalCosting(params);
        if (hierarchicalRes.data.success) {
          setHierarchicalData(hierarchicalRes.data.data);
          // Auto-expand all franchises/kiosks
          const franchises = hierarchicalRes.data.data?.franchises || [];
          if (Array.isArray(franchises) && franchises.length > 0) {
            const franchiseIds = franchises.map((f) =>
              f?.franchiseId?.toString()
            ).filter(Boolean);
            setExpandedFranchises(new Set(franchiseIds));
          }
        }
      } else {
        // Other roles get regular dashboard data (food cost from BOM/consumption + order sales)
        const defaultFoodCost = {
          totalFoodCost: 0,
          totalSales: 0,
          foodCostPercent: 0,
          period: { from: dateRange.from, to: dateRange.to },
          meta: { transactionCount: 0 },
        };
        let lowStockRes = { data: {} };
        let foodCostRes = { data: {} };
        let pnlRes = { data: {} };
        try {
          [lowStockRes, foodCostRes, pnlRes] = await Promise.all([
            getLowStock(),
            getFoodCostReport(params),
            getPnLReport(params),
          ]);
        } catch (apiErr) {
          if (import.meta.env.DEV) console.error("Dashboard API error:", apiErr);
        }
        if (lowStockRes.data?.success) setLowStock(lowStockRes.data.data);
        if (foodCostRes.data?.success && foodCostRes.data?.data) {
          setFoodCost({
            ...defaultFoodCost,
            ...foodCostRes.data.data,
          });
        } else {
          setFoodCost(defaultFoodCost);
        }
        if (pnlRes.data?.success) setPnl(pnlRes.data.data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching dashboard data:", error);
      }
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

  const handleExportDateWiseRevenue = async () => {
    if (user?.role !== "franchise_admin") return;

    if (!dateRange.from || !dateRange.to) {
      alert("Please select both From and To dates.");
      return;
    }
    if (dateRange.from > dateRange.to) {
      alert("From date cannot be after To date.");
      return;
    }

    try {
      setExportingRevenue(true);
      const response = await api.get("/revenue/franchise", {
        params: {
          startDate: dateRange.from,
          endDate: dateRange.to,
        },
      });

      const payload = response?.data?.data || {};
      const dailyBreakdown = Array.isArray(payload?.dailyBreakdown)
        ? payload.dailyBreakdown
        : [];

      if (dailyBreakdown.length === 0) {
        alert("No date-wise revenue data available for selected dates.");
        return;
      }

      const franchiseName = payload?.franchiseName || user?.name || "Franchise";
      const rangeLabel = `${dateRange.from} to ${dateRange.to}`;
      const rows = dailyBreakdown.map((day) => {
        const orders = Number(day?.orderCount || 0);
        const revenue = Number(day?.revenue || 0);
        return {
          Franchise: franchiseName,
          "Date Range": rangeLabel,
          Date: day?.date || "",
          Orders: orders,
          "Revenue (Rs)": Number(revenue.toFixed(2)),
          "Avg Order Value (Rs)": Number(
            (orders > 0 ? revenue / orders : 0).toFixed(2)
          ),
        };
      });

      const fileName = `franchise-date-wise-revenue-${dateRange.from}-to-${dateRange.to}.xlsx`;
      const exported = exportRowsToExcel({
        rows,
        fileName,
        sheetName: "DateWiseRevenue",
      });

      if (!exported) {
        alert("No data available to export.");
      }
    } catch (error) {
      alert(
        error?.response?.data?.message ||
          "Failed to export date-wise revenue. Please try again."
      );
    } finally {
      setExportingRevenue(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d86d2a]"></div>
          <p className="mt-4 text-gray-600">Loading costing data...</p>
        </div>
      </div>
    );
  }

  // Super Admin & Franchise Admin View - Hierarchical Dashboard
  if (
    (user?.role === "super_admin" || user?.role === "franchise_admin") &&
    hierarchicalData
  ) {
    const isFranchiseAdmin = user?.role === "franchise_admin";
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen p-2 sm:p-4 md:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-1 sm:mb-2">
            Costing Overview
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">
            {isFranchiseAdmin
              ? "Kiosk-by-kiosk view of your franchise"
              : "Hierarchical view of all franchises and kiosks"}
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <FaCalendarAlt className="text-[#d86d2a] text-base sm:text-lg flex-shrink-0" />
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="flex-1 sm:flex-initial">
                <label className="block text-[10px] sm:text-xs text-gray-600 mb-1">
                  From
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
                <label className="block text-[10px] sm:text-xs text-gray-600 mb-1">
                  To
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
            {isFranchiseAdmin && (
              <button
                onClick={handleExportDateWiseRevenue}
                disabled={exportingRevenue}
                className="inline-flex items-center justify-center px-3 py-2 text-xs sm:text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Export date-wise revenue for selected date range"
              >
                <FaDownload className="mr-2" />
                {exportingRevenue ? "Exporting..." : "Export Date-wise Revenue"}
              </button>
            )}
          </div>
        </div>

        {/* Grand Totals - Only show for super admin */}
        {!isFranchiseAdmin && hierarchicalData.grandTotals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-2 sm:p-3 md:p-4 lg:p-6 text-white">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <p className="text-[10px] sm:text-xs md:text-sm opacity-90 truncate">
                  Total Sales
                </p>
                <FaRupeeSign className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-75 flex-shrink-0 ml-1" />
              </div>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold break-words">
                ₹
                {Number(hierarchicalData.grandTotals.sales || 0).toLocaleString(
                  "en-IN"
                )}
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-2 sm:p-3 md:p-4 lg:p-6 text-white">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <p className="text-[10px] sm:text-xs md:text-sm opacity-90 truncate">
                  Total Costs
                </p>
                <FaChartLine className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-75 flex-shrink-0 ml-1" />
              </div>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold break-words">
                ₹
                {Number(
                  hierarchicalData.grandTotals.totalCost || 0
                ).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-2 sm:p-3 md:p-4 lg:p-6 text-white">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <p className="text-[10px] sm:text-xs md:text-sm opacity-90 truncate">
                  Total Profit
                </p>
                <FaChartLine className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-75 flex-shrink-0 ml-1" />
              </div>
              <p
                className={`text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold break-words ${
                  hierarchicalData.grandTotals.profit >= 0
                    ? ""
                    : "text-yellow-200"
                }`}
              >
                ₹
                {Number(
                  hierarchicalData.grandTotals.profit || 0
                ).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-2 sm:p-3 md:p-4 lg:p-6 text-white">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <p className="text-[10px] sm:text-xs md:text-sm opacity-90 truncate">
                  Profit Margin
                </p>
                <FaChartLine className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl opacity-75 flex-shrink-0 ml-1" />
              </div>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold">
                {Number(hierarchicalData.grandTotals.profitMargin || 0).toFixed(
                  2
                )}
                %
              </p>
            </div>
          </div>
        )}

        {/* Franchise List (or Kiosk List for Franchise Admin) */}
        <div className="space-y-4">
          {(hierarchicalData?.franchises || []).map((franchise) => {
            const isExpanded = expandedFranchises.has(
              franchise.franchiseId.toString()
            );
            // For franchise admin, always show kiosks expanded (no franchise header needed)
            if (isFranchiseAdmin) {
              return (
                <div key={franchise.franchiseId} className="space-y-3">
                  {/* Franchise Summary Card (non-expandable for franchise admin) */}
                  <div className="bg-gradient-to-r from-[#6b4423] to-[#8b5a3c] text-white p-3 sm:p-4 rounded-lg shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <FaBuilding className="text-lg sm:text-xl md:text-2xl flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg md:text-xl font-bold truncate">
                            {franchise.franchiseName}
                          </h3>
                          {franchise.franchiseCode && (
                            <p className="text-xs sm:text-sm opacity-90 truncate">
                              Code: {franchise.franchiseCode}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-3 md:gap-6 sm:text-right gap-2">
                        <div>
                          <p className="text-[10px] sm:text-xs opacity-90">
                            Total Sales
                          </p>
                          <p className="text-sm sm:text-base md:text-lg font-bold break-words">
                            ₹
                            {Number(franchise.totals.sales || 0).toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs opacity-90">
                            Total Profit
                          </p>
                          <p
                            className={`text-sm sm:text-base md:text-lg font-bold break-words ${
                              franchise.totals.profit >= 0
                                ? "text-green-200"
                                : "text-red-200"
                            }`}
                          >
                            ₹
                            {Number(
                              franchise.totals.profit || 0
                            ).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs opacity-90">
                            Profit Margin
                          </p>
                          <p className="text-sm sm:text-base md:text-lg font-bold">
                            {Number(franchise.totals.profitMargin || 0).toFixed(
                              2
                            )}
                            %
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs opacity-90">
                            Kiosks
                          </p>
                          <p className="text-sm sm:text-base md:text-lg font-bold">
                            {franchise.kiosks.length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Kiosks List - Always visible for franchise admin */}
                  <div className="space-y-3">
                    {(!franchise?.kiosks || franchise.kiosks.length === 0) ? (
                      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                        No kiosks found
                      </div>
                    ) : (
                      (franchise.kiosks || []).map((kiosk) => (
                        <div
                          key={kiosk.kioskId}
                          className="bg-white rounded-lg shadow-lg p-3 sm:p-4 hover:shadow-xl transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <FaStore className="text-[#d86d2a] text-base sm:text-lg md:text-xl flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-semibold text-gray-800 text-sm sm:text-base md:text-lg truncate">
                                  {kiosk.kioskName}
                                </h4>
                                <p className="text-[10px] sm:text-xs text-gray-500 font-mono truncate">
                                  Code:{" "}
                                  {kiosk.kioskCode ||
                                    kiosk.kioskId.toString().slice(-8)}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Sales
                                </p>
                                <p className="font-semibold text-green-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(kiosk.sales || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Food Cost
                                </p>
                                <p className="font-semibold text-red-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(kiosk.foodCost || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                                <p className="text-[9px] sm:text-xs text-gray-500">
                                  {Number(kiosk.foodCostPercent || 0).toFixed(
                                    1
                                  )}
                                  %
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Labour
                                </p>
                                <p className="font-semibold text-orange-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(kiosk.labourCost || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Overhead
                                </p>
                                <p className="font-semibold text-yellow-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(
                                    kiosk.overheadCost || 0
                                  ).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Profit
                                </p>
                                <p
                                  className={`font-semibold text-xs sm:text-sm break-words ${
                                    kiosk.profit >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  ₹
                                  {Number(kiosk.profit || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                                <p className="text-[9px] sm:text-xs text-gray-500">
                                  {Number(kiosk.profitMargin || 0).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            }

            // Super admin view - expandable franchise cards
            return (
              <div
                key={franchise.franchiseId}
                className="bg-white rounded-lg shadow-lg overflow-hidden"
              >
                {/* Franchise Header */}
                <div
                  className="bg-gradient-to-r from-[#6b4423] to-[#8b5a3c] text-white p-3 sm:p-4 cursor-pointer hover:from-[#8b5a3c] hover:to-[#a06a4d] transition-all"
                  onClick={() =>
                    toggleFranchise(franchise.franchiseId.toString())
                  }
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <button className="text-white hover:text-gray-200 flex-shrink-0">
                        {isExpanded ? (
                          <FaChevronDown className="text-sm sm:text-base" />
                        ) : (
                          <FaChevronRight className="text-sm sm:text-base" />
                        )}
                      </button>
                      <FaBuilding className="text-lg sm:text-xl md:text-2xl flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg md:text-xl font-bold truncate">
                          {franchise.franchiseName}
                        </h3>
                        {franchise.franchiseCode && (
                          <p className="text-xs sm:text-sm opacity-90 truncate">
                            Code: {franchise.franchiseCode}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:items-center sm:gap-3 md:gap-6 sm:text-right gap-2">
                      <div>
                        <p className="text-[10px] sm:text-xs opacity-90">
                          Sales
                        </p>
                        <p className="text-sm sm:text-base md:text-lg font-bold break-words">
                          ₹
                          {Number(franchise.totals.sales || 0).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs opacity-90">
                          Profit
                        </p>
                        <p
                          className={`text-sm sm:text-base md:text-lg font-bold break-words ${
                            franchise.totals.profit >= 0
                              ? "text-green-200"
                              : "text-red-200"
                          }`}
                        >
                          ₹
                          {Number(franchise.totals.profit || 0).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs opacity-90">
                          Margin
                        </p>
                        <p className="text-sm sm:text-base md:text-lg font-bold">
                          {Number(franchise.totals.profitMargin || 0).toFixed(
                            2
                          )}
                          %
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] sm:text-xs opacity-90">
                          Kiosks
                        </p>
                        <p className="text-sm sm:text-base md:text-lg font-bold">
                          {franchise.kiosks.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kiosks List */}
                {isExpanded && (
                  <div className="divide-y divide-gray-200">
                    {(!franchise?.kiosks || franchise.kiosks.length === 0) ? (
                      <div className="p-6 text-center text-gray-500">
                        No kiosks found
                      </div>
                    ) : (
                      (franchise.kiosks || []).map((kiosk) => (
                        <div
                          key={kiosk.kioskId}
                          className="p-3 sm:p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              <FaStore className="text-[#d86d2a] text-base sm:text-lg md:text-xl flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <h4 className="font-semibold text-gray-800 text-sm sm:text-base md:text-lg truncate">
                                  {kiosk.kioskName}
                                </h4>
                                <p className="text-[10px] sm:text-xs text-gray-500 font-mono truncate">
                                  Code:{" "}
                                  {kiosk.kioskCode ||
                                    kiosk.kioskId.toString().slice(-8)}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm">
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Sales
                                </p>
                                <p className="font-semibold text-green-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(kiosk.sales || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Food Cost
                                </p>
                                <p className="font-semibold text-red-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(kiosk.foodCost || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                                <p className="text-[9px] sm:text-xs text-gray-500">
                                  {Number(kiosk.foodCostPercent || 0).toFixed(
                                    1
                                  )}
                                  %
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Labour
                                </p>
                                <p className="font-semibold text-orange-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(kiosk.labourCost || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Overhead
                                </p>
                                <p className="font-semibold text-yellow-600 text-xs sm:text-sm break-words">
                                  ₹
                                  {Number(
                                    kiosk.overheadCost || 0
                                  ).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
                                  Profit
                                </p>
                                <p
                                  className={`font-semibold text-xs sm:text-sm break-words ${
                                    kiosk.profit >= 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  ₹
                                  {Number(kiosk.profit || 0).toLocaleString(
                                    "en-IN"
                                  )}
                                </p>
                                <p className="text-[9px] sm:text-xs text-gray-500">
                                  {Number(kiosk.profitMargin || 0).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(!hierarchicalData?.franchises || hierarchicalData.franchises.length === 0) && (
          <div className="bg-white rounded-lg shadow p-6 sm:p-8 md:p-12 text-center">
            <FaBuilding className="text-4xl sm:text-5xl md:text-6xl text-gray-300 mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-600 text-sm sm:text-base md:text-lg px-2">
              No franchise data available for the selected period
            </p>
          </div>
        )}
      </div>
    );
  }

  // Regular Dashboard for Franchise Admin and Cart Admin
  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          Costing Dashboard
        </h1>
        <div className="w-full sm:w-auto">
          <OutletFilter
            selectedOutlet={selectedOutlet}
            onOutletChange={setSelectedOutlet}
          />
        </div>
      </div>

      {/* KPI Cards - Food cost from BOM/consumption + order sales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">
                Food Cost %
              </p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-[#d86d2a] break-words">
                {foodCost?.foodCostPercent?.toFixed(2) || "0.00"}%
              </p>
            </div>
            <FaChartLine className="text-2xl sm:text-3xl md:text-4xl text-[#d86d2a] opacity-50 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">
                Food Cost (₹)
              </p>
              <div>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600 break-words">
                  ₹{Number(foodCost?.totalFoodCost ?? 0).toLocaleString("en-IN")}
                </p>
                {foodCost?.totalSales > 0 && 
                 foodCost?.meta?.transactionCount === 0 && (
                  <p className="text-[10px] sm:text-xs text-red-500 mt-1 flex items-center font-medium" title="Ensure orders go through Preparing/Being Prepared status, menu items are linked to BOM in Finances, and ingredients have prices.">
                    <FaExclamationTriangle className="mr-1" /> 
                    No consumption data — ensure orders go through Preparing/Being Prepared, link menu items to BOM in Finances, and set ingredient prices
                  </p>
                )}
                {foodCost?.totalSales > 0 && 
                 foodCost?.meta?.transactionCount > 0 && 
                 foodCost?.meta?.zeroCostCount === foodCost?.meta?.transactionCount && (
                  <p className="text-[10px] sm:text-xs text-orange-500 mt-1 flex items-center font-medium">
                    <FaExclamationTriangle className="mr-1" /> 
                    Zero cost recorded (Check Inventory Prices)
                  </p>
                )}
              </div>
            </div>
            <FaRupeeSign className="text-2xl sm:text-3xl md:text-4xl text-orange-600 opacity-50 flex-shrink-0 ml-2" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">
                Total Sales
              </p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 break-words">
                ₹{Number(foodCost?.totalSales || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <FaRupeeSign className="text-2xl sm:text-3xl md:text-4xl text-green-600 opacity-50 flex-shrink-0 ml-2" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-gray-600 text-xs sm:text-sm mb-1">
                Profit Margin
              </p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600 break-words">
                {pnl?.profitMargin?.toFixed(2) || "0.00"}%
              </p>
            </div>
            <FaChartLine className="text-2xl sm:text-3xl md:text-4xl text-blue-600 opacity-50 flex-shrink-0 ml-2" />
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {Array.isArray(lowStock) && lowStock.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 mb-4 sm:mb-6 rounded">
          <div className="flex items-center">
            <FaExclamationTriangle className="text-yellow-400 mr-1.5 sm:mr-2 text-sm sm:text-base flex-shrink-0" />
            <h3 className="font-semibold text-yellow-800 text-xs sm:text-sm md:text-base">
              Low Stock Alert ({lowStock.length} items)
            </h3>
          </div>
          <div className="mt-2">
            <ul className="list-disc list-inside text-xs sm:text-sm text-yellow-700 space-y-1">
              {(lowStock || []).slice(0, 5).map((item) => (
                <li key={item._id} className="break-words">
                  {item.name}: {item.baseUnit && item.baseUnit !== item.uom
                    ? formatUnit(convertUnit(item.qtyOnHand, item.baseUnit, item.uom), item.uom)
                    : formatUnit(item.qtyOnHand, item.uom)} (Reorder:{" "}
                  {item.baseUnit && item.baseUnit !== item.uom
                    ? formatUnit(convertUnit(item.reorderLevel, item.baseUnit, item.uom), item.uom)
                    : formatUnit(item.reorderLevel, item.uom)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* P&L Summary */}
      {pnl && (
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">
            P&L Summary (Last 30 Days)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            <div>
              <p className="text-gray-600 text-xs sm:text-sm mb-1">Sales</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 break-words">
                ₹{Number(pnl.sales || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-xs sm:text-sm mb-1">Food Cost</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-red-600 break-words">
                ₹{Number(pnl.costs?.foodCost || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-xs sm:text-sm mb-1">
                Total Costs
              </p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600 break-words">
                ₹{Number(pnl.costs?.total || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-xs sm:text-sm mb-1">Profit</p>
              <p
                className={`text-lg sm:text-xl md:text-2xl font-bold break-words ${
                  pnl.profit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ₹{Number(pnl.profit || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
