import React, { useEffect, useState } from "react";
import {
  getLowStock,
  getFoodCostReport,
  getPnLReport,
  getHierarchicalCosting,
} from "../../services/costingV2Api";
import { FaExclamationTriangle, FaChartLine, FaRupeeSign, FaBuilding, FaStore, FaChevronDown, FaChevronRight, FaCalendarAlt } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { useAuth } from "../../context/AuthContext";
import { formatUnit } from "../../utils/unitConverter";

const Dashboard = () => {
  const { user } = useAuth();
  const [lowStock, setLowStock] = useState([]);
  const [foodCost, setFoodCost] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [hierarchicalData, setHierarchicalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
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
      if (selectedOutlet) params.outletId = selectedOutlet;

      if (user?.role === "super_admin" || user?.role === "franchise_admin") {
        // Super admin and franchise admin get hierarchical data
        const hierarchicalRes = await getHierarchicalCosting(params);
        if (hierarchicalRes.data.success) {
          setHierarchicalData(hierarchicalRes.data.data);
          // Auto-expand all franchises/kiosks
          const franchiseIds = hierarchicalRes.data.data.franchises.map(f => f.franchiseId.toString());
          setExpandedFranchises(new Set(franchiseIds));
        }
      } else {
        // Other roles get regular dashboard data
        const [lowStockRes, foodCostRes, pnlRes] = await Promise.all([
          getLowStock(),
          getFoodCostReport(params),
          getPnLReport(params),
        ]);

        if (lowStockRes.data.success) setLowStock(lowStockRes.data.data);
        if (foodCostRes.data.success) setFoodCost(foodCostRes.data.data);
        if (pnlRes.data.success) setPnl(pnlRes.data.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d86d2a]"></div>
          <p className="mt-4 text-gray-600">Loading costing data...</p>
        </div>
      </div>
    );
  }

  // Super Admin & Franchise Admin View - Hierarchical Dashboard
  if ((user?.role === "super_admin" || user?.role === "franchise_admin") && hierarchicalData) {
    const isFranchiseAdmin = user?.role === "franchise_admin";
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Costing Overview</h1>
          <p className="text-gray-600">
            {isFranchiseAdmin 
              ? "Kiosk-by-kiosk view of your franchise" 
              : "Hierarchical view of all franchises and kiosks"}
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <FaCalendarAlt className="text-[#d86d2a]" />
            <div className="flex gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Grand Totals - Only show for super admin */}
        {!isFranchiseAdmin && hierarchicalData.grandTotals && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm opacity-90">Total Sales</p>
                <FaRupeeSign className="text-2xl opacity-75" />
              </div>
              <p className="text-3xl font-bold">
                ₹{Number(hierarchicalData.grandTotals.sales || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm opacity-90">Total Costs</p>
                <FaChartLine className="text-2xl opacity-75" />
              </div>
              <p className="text-3xl font-bold">
                ₹{Number(hierarchicalData.grandTotals.totalCost || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm opacity-90">Total Profit</p>
                <FaChartLine className="text-2xl opacity-75" />
              </div>
              <p className={`text-3xl font-bold ${hierarchicalData.grandTotals.profit >= 0 ? "" : "text-yellow-200"}`}>
                ₹{Number(hierarchicalData.grandTotals.profit || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm opacity-90">Profit Margin</p>
                <FaChartLine className="text-2xl opacity-75" />
              </div>
              <p className="text-3xl font-bold">
                {Number(hierarchicalData.grandTotals.profitMargin || 0).toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {/* Franchise List (or Kiosk List for Franchise Admin) */}
        <div className="space-y-4">
          {hierarchicalData.franchises.map((franchise) => {
            const isExpanded = expandedFranchises.has(franchise.franchiseId.toString());
            // For franchise admin, always show kiosks expanded (no franchise header needed)
            if (isFranchiseAdmin) {
              return (
                <div key={franchise.franchiseId} className="space-y-3">
                  {/* Franchise Summary Card (non-expandable for franchise admin) */}
                  <div className="bg-gradient-to-r from-[#6b4423] to-[#8b5a3c] text-white p-4 rounded-lg shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FaBuilding className="text-2xl" />
                        <div>
                          <h3 className="text-xl font-bold">{franchise.franchiseName}</h3>
                          {franchise.franchiseCode && (
                            <p className="text-sm opacity-90">Code: {franchise.franchiseCode}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs opacity-90">Total Sales</p>
                          <p className="text-lg font-bold">₹{Number(franchise.totals.sales || 0).toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-xs opacity-90">Total Profit</p>
                          <p className={`text-lg font-bold ${franchise.totals.profit >= 0 ? "text-green-200" : "text-red-200"}`}>
                            ₹{Number(franchise.totals.profit || 0).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs opacity-90">Profit Margin</p>
                          <p className="text-lg font-bold">{Number(franchise.totals.profitMargin || 0).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-xs opacity-90">Kiosks</p>
                          <p className="text-lg font-bold">{franchise.kiosks.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Kiosks List - Always visible for franchise admin */}
                  <div className="space-y-3">
                    {franchise.kiosks.length === 0 ? (
                      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">No kiosks found</div>
                    ) : (
                      franchise.kiosks.map((kiosk) => (
                        <div key={kiosk.kioskId} className="bg-white rounded-lg shadow-lg p-4 hover:shadow-xl transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FaStore className="text-[#d86d2a] text-xl" />
                              <div>
                                <h4 className="font-semibold text-gray-800 text-lg">{kiosk.kioskName}</h4>
                                <p className="text-xs text-gray-500 font-mono">Code: {kiosk.kioskCode || kiosk.kioskId.toString().slice(-8)}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-4 text-sm">
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Sales</p>
                                <p className="font-semibold text-green-600">
                                  ₹{Number(kiosk.sales || 0).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Food Cost</p>
                                <p className="font-semibold text-red-600">
                                  ₹{Number(kiosk.foodCost || 0).toLocaleString("en-IN")}
                                </p>
                                <p className="text-xs text-gray-500">{Number(kiosk.foodCostPercent || 0).toFixed(1)}%</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Labour</p>
                                <p className="font-semibold text-orange-600">
                                  ₹{Number(kiosk.labourCost || 0).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Overhead</p>
                                <p className="font-semibold text-yellow-600">
                                  ₹{Number(kiosk.overheadCost || 0).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Profit</p>
                                <p className={`font-semibold ${kiosk.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  ₹{Number(kiosk.profit || 0).toLocaleString("en-IN")}
                                </p>
                                <p className="text-xs text-gray-500">{Number(kiosk.profitMargin || 0).toFixed(1)}%</p>
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
              <div key={franchise.franchiseId} className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Franchise Header */}
                <div
                  className="bg-gradient-to-r from-[#6b4423] to-[#8b5a3c] text-white p-4 cursor-pointer hover:from-[#8b5a3c] hover:to-[#a06a4d] transition-all"
                  onClick={() => toggleFranchise(franchise.franchiseId.toString())}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button className="text-white hover:text-gray-200">
                        {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                      </button>
                      <FaBuilding className="text-2xl" />
                      <div>
                        <h3 className="text-xl font-bold">{franchise.franchiseName}</h3>
                        {franchise.franchiseCode && (
                          <p className="text-sm opacity-90">Code: {franchise.franchiseCode}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs opacity-90">Sales</p>
                        <p className="text-lg font-bold">₹{Number(franchise.totals.sales || 0).toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-xs opacity-90">Profit</p>
                        <p className={`text-lg font-bold ${franchise.totals.profit >= 0 ? "text-green-200" : "text-red-200"}`}>
                          ₹{Number(franchise.totals.profit || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs opacity-90">Margin</p>
                        <p className="text-lg font-bold">{Number(franchise.totals.profitMargin || 0).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-xs opacity-90">Kiosks</p>
                        <p className="text-lg font-bold">{franchise.kiosks.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kiosks List */}
                {isExpanded && (
                  <div className="divide-y divide-gray-200">
                    {franchise.kiosks.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No kiosks found</div>
                    ) : (
                      franchise.kiosks.map((kiosk) => (
                        <div key={kiosk.kioskId} className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FaStore className="text-[#d86d2a] text-xl" />
                              <div>
                                <h4 className="font-semibold text-gray-800">{kiosk.kioskName}</h4>
                                <p className="text-xs text-gray-500 font-mono">Code: {kiosk.kioskCode || kiosk.kioskId.toString().slice(-8)}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-4 text-sm">
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Sales</p>
                                <p className="font-semibold text-green-600">
                                  ₹{Number(kiosk.sales || 0).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Food Cost</p>
                                <p className="font-semibold text-red-600">
                                  ₹{Number(kiosk.foodCost || 0).toLocaleString("en-IN")}
                                </p>
                                <p className="text-xs text-gray-500">{Number(kiosk.foodCostPercent || 0).toFixed(1)}%</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Labour</p>
                                <p className="font-semibold text-orange-600">
                                  ₹{Number(kiosk.labourCost || 0).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Overhead</p>
                                <p className="font-semibold text-yellow-600">
                                  ₹{Number(kiosk.overheadCost || 0).toLocaleString("en-IN")}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-600 text-xs mb-1">Profit</p>
                                <p className={`font-semibold ${kiosk.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  ₹{Number(kiosk.profit || 0).toLocaleString("en-IN")}
                                </p>
                                <p className="text-xs text-gray-500">{Number(kiosk.profitMargin || 0).toFixed(1)}%</p>
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

        {hierarchicalData.franchises.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <FaBuilding className="text-6xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No franchise data available for the selected period</p>
          </div>
        )}
      </div>
    );
  }

  // Regular Dashboard for Franchise Admin and Cart Admin
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Costing Dashboard</h1>
        <OutletFilter
          selectedOutlet={selectedOutlet}
          onOutletChange={setSelectedOutlet}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Food Cost %</p>
              <p className="text-3xl font-bold text-[#d86d2a]">
                {foodCost?.foodCostPercent?.toFixed(2) || "0.00"}%
              </p>
            </div>
            <FaChartLine className="text-4xl text-[#d86d2a] opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Sales</p>
              <p className="text-3xl font-bold text-green-600">
                ₹{Number(foodCost?.totalSales || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <FaRupeeSign className="text-4xl text-green-600 opacity-50" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Profit Margin</p>
              <p className="text-3xl font-bold text-blue-600">
                {pnl?.profitMargin?.toFixed(2) || "0.00"}%
              </p>
            </div>
            <FaChartLine className="text-4xl text-blue-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
          <div className="flex items-center">
            <FaExclamationTriangle className="text-yellow-400 mr-2" />
            <h3 className="font-semibold text-yellow-800">
              Low Stock Alert ({lowStock.length} items)
            </h3>
          </div>
          <div className="mt-2">
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {lowStock.slice(0, 5).map((item) => (
                <li key={item._id}>
                  {item.name}: {formatUnit(item.qtyOnHand, item.uom)} (Reorder: {formatUnit(item.reorderLevel, item.uom)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* P&L Summary */}
      {pnl && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">P&L Summary (Last 30 Days)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Sales</p>
              <p className="text-2xl font-bold text-green-600">
                ₹{Number(pnl.sales || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Food Cost</p>
              <p className="text-2xl font-bold text-red-600">
                ₹{Number(pnl.costs?.foodCost || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Total Costs</p>
              <p className="text-2xl font-bold text-orange-600">
                ₹{Number(pnl.costs?.total || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Profit</p>
              <p className={`text-2xl font-bold ${pnl.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
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
