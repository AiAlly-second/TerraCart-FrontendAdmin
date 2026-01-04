import React, { useState } from 'react';
import costingApi from '../../services/costingApi';
import DateRangePicker from '../../components/costing/DateRangePicker';

const Reports = () => {
  const [pnlData, setPnlData] = useState(null);
  const [roiData, setRoiData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeReport, setActiveReport] = useState('pnl'); // 'pnl', 'roi', 'profitability', or 'costPerDish'
  const [profitabilityData, setProfitabilityData] = useState(null);
  const [costPerDishData, setCostPerDishData] = useState(null);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    franchiseId: '',
    kioskId: '',
  });

  const fetchPnLReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      alert('Please select start and end dates');
      return;
    }

    try {
      setLoading(true);
      const response = await costingApi.getPnLReport(filters);
      setPnlData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch P&L report:', error);
      alert('Failed to load P&L report');
    } finally {
      setLoading(false);
    }
  };

  const fetchROIReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      alert('Please select start and end dates');
      return;
    }

    try {
      setLoading(true);
      const response = await costingApi.getROIReport(filters);
      setRoiData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch ROI report:', error);
      alert('Failed to load ROI report');
    } finally {
      setLoading(false);
    }
  };

  const exportPnLCSV = async () => {
    if (!filters.startDate || !filters.endDate) {
      alert('Please select start and end dates');
      return;
    }

    try {
      setLoading(true);
      const response = await costingApi.getPnLReport({ ...filters, format: 'csv' });
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pnl-report-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export P&L CSV:', error);
      alert('Failed to export CSV');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#4a2e1f]">Reports & P&L</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveReport('pnl')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'pnl'
                ? 'border-[#d86d2a] text-[#d86d2a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Profit & Loss
          </button>
          <button
            onClick={() => setActiveReport('roi')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'roi'
                ? 'border-[#d86d2a] text-[#d86d2a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ROI & Breakeven
          </button>
          <button
            onClick={() => setActiveReport('profitability')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'profitability'
                ? 'border-[#d86d2a] text-[#d86d2a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Profitability
          </button>
          <button
            onClick={() => setActiveReport('costPerDish')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeReport === 'costPerDish'
                ? 'border-[#d86d2a] text-[#d86d2a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Cost Per Dish
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
        <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <DateRangePicker
            startDate={filters.startDate}
            endDate={filters.endDate}
            onStartDateChange={(date) => setFilters({ ...filters, startDate: date })}
            onEndDateChange={(date) => setFilters({ ...filters, endDate: date })}
          />
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Franchise ID</label>
            <input
              type="text"
              placeholder="Optional"
              value={filters.franchiseId}
              onChange={(e) => setFilters({ ...filters, franchiseId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Kiosk ID</label>
            <input
              type="text"
              placeholder="Optional"
              value={filters.kioskId}
              onChange={(e) => setFilters({ ...filters, kioskId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          {activeReport === 'pnl' && (
            <>
              <button
                onClick={fetchPnLReport}
                disabled={loading}
                className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate P&L Report'}
              </button>
              {pnlData && (
                <button
                  onClick={exportPnLCSV}
                  disabled={loading}
                  className="px-4 py-2 bg-[#6b4423] text-white rounded-lg hover:bg-[#5a3520] transition-colors disabled:opacity-50"
                >
                  📥 Export CSV
                </button>
              )}
            </>
          )}
          {activeReport === 'roi' && (
            <button
              onClick={fetchROIReport}
              disabled={loading}
              className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Generate ROI Report'}
            </button>
          )}
          {activeReport === 'profitability' && (
            <button
              onClick={async () => {
                if (!filters.startDate || !filters.endDate) {
                  alert('Please select start and end dates');
                  return;
                }
                try {
                  setLoading(true);
                  const response = await costingApi.getProfitabilityReport(filters);
                  setProfitabilityData(response.data.data);
                } catch (error) {
                  console.error('Failed to fetch profitability report:', error);
                  alert('Failed to load profitability report');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Generate Profitability Report'}
            </button>
          )}
          {activeReport === 'costPerDish' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">Outlet ID *</label>
                <input
                  type="text"
                  required
                  value={filters.kioskId}
                  onChange={(e) => setFilters({ ...filters, kioskId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
              <button
                onClick={async () => {
                  if (!filters.startDate || !filters.endDate || !filters.kioskId) {
                    alert('Please select start date, end date, and outlet ID');
                    return;
                  }
                  try {
                    setLoading(true);
                    const response = await costingApi.getCostPerDishReport({ ...filters, cartId: filters.kioskId });
                    setCostPerDishData(response.data.data);
                  } catch (error) {
                    console.error('Failed to fetch cost per dish report:', error);
                    alert('Failed to load cost per dish report');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Generate Cost Per Dish Report'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* P&L Report */}
      {activeReport === 'pnl' && pnlData && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-[#e2c1ac]">
          <h3 className="text-xl font-bold text-[#4a2e1f] mb-4">Profit & Loss Report</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#f5e3d5] p-4 rounded-lg">
                <p className="text-sm text-gray-600">Period</p>
                <p className="text-lg font-semibold text-[#4a2e1f]">
                  {new Date(pnlData.period.startDate).toLocaleDateString()} - {new Date(pnlData.period.endDate).toLocaleDateString()}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(pnlData.revenue)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">COGS</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(pnlData.cogs)}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Gross Profit</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(pnlData.grossProfit)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Expenses</p>
                <p className="text-2xl font-bold text-yellow-600">{formatCurrency(pnlData.expenses)}</p>
              </div>
              <div className={`p-4 rounded-lg ${pnlData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm text-gray-600">Net Profit</p>
                <p className={`text-2xl font-bold ${pnlData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(pnlData.netProfit)}
                </p>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Food Cost Percentage</p>
              <p className="text-xl font-semibold text-[#4a2e1f]">{pnlData.foodCostPercentage}%</p>
            </div>
          </div>
        </div>
      )}

      {/* ROI Report */}
      {activeReport === 'roi' && roiData && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-[#e2c1ac]">
          <h3 className="text-xl font-bold text-[#4a2e1f] mb-4">ROI & Breakeven Report</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#f5e3d5] p-4 rounded-lg">
                <p className="text-sm text-gray-600">Period</p>
                <p className="text-lg font-semibold text-[#4a2e1f]">
                  {new Date(roiData.period.startDate).toLocaleDateString()} - {new Date(roiData.period.endDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">({roiData.period.months} months)</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Investment</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(roiData.totalInvestment)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg ${roiData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm text-gray-600">Net Profit</p>
                <p className={`text-2xl font-bold ${roiData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(roiData.netProfit)}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${roiData.roi >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm text-gray-600">ROI</p>
                <p className={`text-2xl font-bold ${roiData.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {roiData.roi.toFixed(2)}%
                </p>
              </div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Breakeven Months</p>
              <p className="text-2xl font-bold text-yellow-600">
                {roiData.breakevenMonths ? `${roiData.breakevenMonths.toFixed(1)} months` : 'N/A'}
              </p>
              {roiData.breakevenMonths && (
                <p className="text-xs text-gray-500 mt-1">
                  Based on average monthly net profit of {formatCurrency(roiData.netProfit / roiData.period.months)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d86d2a]"></div>
        </div>
      )}

      {!loading && activeReport === 'pnl' && !pnlData && (
        <div className="text-center py-12 text-gray-500">
          Click "Generate P&L Report" to view the report
        </div>
      )}

      {!loading && activeReport === 'roi' && !roiData && (
        <div className="text-center py-12 text-gray-500">
          Click "Generate ROI Report" to view the report
        </div>
      )}

      {/* Profitability Report */}
      {activeReport === 'profitability' && profitabilityData && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-[#e2c1ac]">
          <h3 className="text-xl font-bold text-[#4a2e1f] mb-4">Profitability Report</h3>
          <div className="space-y-4">
            <div className="bg-[#f5e3d5] p-4 rounded-lg">
              <p className="text-sm text-gray-600">Period</p>
              <p className="text-lg font-semibold text-[#4a2e1f]">
                {new Date(profitabilityData.period.startDate).toLocaleDateString()} - {new Date(profitabilityData.period.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(profitabilityData.summary.totalRevenue)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(profitabilityData.summary.totalCost)}</p>
              </div>
              <div className={`p-4 rounded-lg ${profitabilityData.summary.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-sm text-gray-600">Total Profit</p>
                <p className={`text-2xl font-bold ${profitabilityData.summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(profitabilityData.summary.totalProfit)}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <h4 className="text-lg font-semibold text-[#4a2e1f] mb-3">Outlet Details</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-[#f5e3d5]">
                    <tr>
                      <th className="px-4 py-2 text-left">Outlet</th>
                      <th className="px-4 py-2 text-left">Revenue</th>
                      <th className="px-4 py-2 text-left">Direct Cost</th>
                      <th className="px-4 py-2 text-left">OPEX</th>
                      <th className="px-4 py-2 text-left">Depreciation</th>
                      <th className="px-4 py-2 text-left">Total Cost</th>
                      <th className="px-4 py-2 text-left">Profit</th>
                      <th className="px-4 py-2 text-left">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitabilityData.outlets.map((outlet, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-2">{outlet.outletName}</td>
                        <td className="px-4 py-2">{formatCurrency(outlet.revenue)}</td>
                        <td className="px-4 py-2">{formatCurrency(outlet.directCost)}</td>
                        <td className="px-4 py-2">{formatCurrency(outlet.opex)}</td>
                        <td className="px-4 py-2">{formatCurrency(outlet.depreciation)}</td>
                        <td className="px-4 py-2">{formatCurrency(outlet.totalCost)}</td>
                        <td className={`px-4 py-2 font-semibold ${outlet.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(outlet.profit)}
                        </td>
                        <td className={`px-4 py-2 ${outlet.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {outlet.profitMargin.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Per Dish Report */}
      {activeReport === 'costPerDish' && costPerDishData && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-[#e2c1ac]">
          <h3 className="text-xl font-bold text-[#4a2e1f] mb-4">Cost Per Dish Report</h3>
          <div className="space-y-4">
            <div className="bg-[#f5e3d5] p-4 rounded-lg">
              <p className="text-sm text-gray-600">Period</p>
              <p className="text-lg font-semibold text-[#4a2e1f]">
                {new Date(costPerDishData.period.startDate).toLocaleDateString()} - {new Date(costPerDishData.period.endDate).toLocaleDateString()}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[#f5e3d5]">
                  <tr>
                    <th className="px-4 py-2 text-left">Dish Name</th>
                    <th className="px-4 py-2 text-left">Selling Price</th>
                    <th className="px-4 py-2 text-left">Standard Cost</th>
                    <th className="px-4 py-2 text-left">Overhead</th>
                    <th className="px-4 py-2 text-left">Full Cost</th>
                    <th className="px-4 py-2 text-left">Profit/Dish</th>
                    <th className="px-4 py-2 text-left">Margin %</th>
                    <th className="px-4 py-2 text-left">Units Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {costPerDishData.dishes.map((dish, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-4 py-2 font-medium">{dish.recipeName}</td>
                      <td className="px-4 py-2">{formatCurrency(dish.sellingPrice)}</td>
                      <td className="px-4 py-2">{formatCurrency(dish.standardDishCost)}</td>
                      <td className="px-4 py-2">{formatCurrency(dish.overheadPerDish)}</td>
                      <td className="px-4 py-2 font-semibold">{formatCurrency(dish.fullCostPerDish)}</td>
                      <td className={`px-4 py-2 font-semibold ${dish.profitPerDish >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(dish.profitPerDish)}
                      </td>
                      <td className={`px-4 py-2 ${dish.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dish.profitMargin.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2">{dish.totalUnitsSold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeReport === 'profitability' && !profitabilityData && (
        <div className="text-center py-12 text-gray-500">
          Click "Generate Profitability Report" to view the report
        </div>
      )}

      {!loading && activeReport === 'costPerDish' && !costPerDishData && (
        <div className="text-center py-12 text-gray-500">
          Enter outlet ID and click "Generate Cost Per Dish Report" to view the report
        </div>
      )}
    </div>
  );
};

export default Reports;




