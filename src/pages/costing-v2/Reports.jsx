import React, { useEffect, useState } from "react";
import {
  getFoodCostReport,
  getMenuEngineeringReport,
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
  const [activeReport, setActiveReport] = useState("food-cost");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [foodCostData, setFoodCostData] = useState(null);
  const [menuEngineeringData, setMenuEngineeringData] = useState([]);
  const [priceHistoryData, setPriceHistoryData] = useState([]);
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);

  // For cart admins, automatically set selectedOutlet to their own cart ID
  useEffect(() => {
    if (user?.role === "admin" && user?._id) {
      // Cart admin should only see their own cart's data
      setSelectedOutlet(user._id);
    }
  }, [user]);

  useEffect(() => {
    fetchReport();
  }, [activeReport, dateRange, selectedOutlet]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      
      // For cart admins, always use their own cart ID
      // For franchise/super admins, use selectedOutlet if provided
      let outletId = null;
      if (user?.role === "admin") {
        outletId = user._id; // Cart admin's own cart
      } else if (selectedOutlet) {
        outletId = selectedOutlet; // Franchise/super admin's selected outlet
      }
      
      const params = { 
        from: dateRange.from, 
        to: dateRange.to,
        ...(outletId && { outletId })
      };

      switch (activeReport) {
        case "food-cost":
          const foodCostRes = await getFoodCostReport(params);
          if (foodCostRes.data.success) setFoodCostData(foodCostRes.data.data);
          break;
        case "menu-engineering":
          const menuEngRes = await getMenuEngineeringReport(params);
          if (menuEngRes.data.success) setMenuEngineeringData(menuEngRes.data.data);
          break;
        case "price-history":
          const priceRes = await getSupplierPriceHistory(params);
          if (priceRes.data.success) setPriceHistoryData(priceRes.data.data);
          break;
        case "pnl":
          const pnlRes = await getPnLReport(params);
          if (pnlRes.data.success) setPnlData(pnlRes.data.data);
          break;
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${filename}.csv`);
  };

  const exportToExcel = (data, filename, sheetName = "Sheet1") => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExportCSV = () => {
    switch (activeReport) {
      case "food-cost":
        exportToCSV([foodCostData], `food-cost-report-${dateRange.from}-${dateRange.to}`);
        break;
      case "menu-engineering":
        exportToCSV(menuEngineeringData, `menu-engineering-report-${dateRange.from}-${dateRange.to}`);
        break;
      case "price-history":
        exportToCSV(priceHistoryData, `supplier-price-history-${new Date().toISOString().split("T")[0]}`);
        break;
      case "pnl":
        exportToCSV([pnlData], `pnl-report-${dateRange.from}-${dateRange.to}`);
        break;
    }
  };

  const handleExportPDF = () => {
    // Simple PDF generation using window.print() - can be enhanced with jsPDF
    window.print();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading report...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <FaFileCsv /> Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <FaFilePdf /> Export PDF
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <OutletFilter selectedOutlet={selectedOutlet} onOutletChange={setSelectedOutlet} />
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b">
        {["food-cost", "menu-engineering", "price-history", "pnl"].map((report) => (
          <button
            key={report}
            onClick={() => setActiveReport(report)}
            className={`px-4 py-2 font-medium capitalize ${
              activeReport === report
                ? "border-b-2 border-[#d86d2a] text-[#d86d2a]"
                : "text-gray-600"
            }`}
          >
            {report.replace("-", " ")}
          </button>
        ))}
      </div>

      {(activeReport === "food-cost" || activeReport === "pnl") && (
        <div className="mb-4 flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        {activeReport === "food-cost" && foodCostData && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Food Cost Report</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Food Cost</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{Number(foodCostData.totalFoodCost || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{Number(foodCostData.totalSales || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded">
                <p className="text-sm text-gray-600">Food Cost %</p>
                <p className="text-2xl font-bold text-[#d86d2a]">
                  {Number(foodCostData.foodCostPercent || 0).toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {activeReport === "menu-engineering" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Menu Engineering Report</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menu Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Popularity</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {menuEngineeringData.map((item) => (
                  <tr key={item.menuItemId}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.quantitySold}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{Number(item.revenue || 0).toLocaleString("en-IN")}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{Number(item.cost || 0).toLocaleString("en-IN")}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{Number(item.margin || 0).toLocaleString("en-IN")}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{Number(item.marginPercent || 0).toFixed(2)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.popularity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === "price-history" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Supplier Price History</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingredient</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {priceHistoryData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.supplierName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{item.ingredientName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatUnit(item.qty, item.uom)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{Number(item.unitPrice || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">₹{Number(item.total || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === "pnl" && pnlData && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Profit & Loss Report</h2>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-3xl font-bold text-green-600">
                  ₹{Number(pnlData.sales || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <p className="text-sm text-gray-600">Total Costs</p>
                <p className="text-2xl font-bold text-red-600">
                  ₹{Number(pnlData.costs?.total || 0).toLocaleString("en-IN")}
                </p>
                <div className="mt-2 text-sm">
                  <p>Food Cost: ₹{Number(pnlData.costs?.foodCost || 0).toLocaleString("en-IN")}</p>
                  <p>Labour: ₹{Number(pnlData.costs?.labour || 0).toLocaleString("en-IN")}</p>
                  <p>Overhead: ₹{Number(pnlData.costs?.overhead || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div className={`p-4 rounded ${pnlData.profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <p className="text-sm text-gray-600">Net Profit</p>
                <p className={`text-3xl font-bold ${pnlData.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ₹{Number(pnlData.profit || 0).toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-gray-600 mt-2">
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



