import React, { useState, useEffect } from 'react';
import costingApi from '../../services/costingApi';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    franchiseId: '',
    kioskId: '',
  });

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getDashboard(filters);
      setDashboardData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      alert('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const KPICard = ({ title, value, icon, subtitle }) => (
    <div className="bg-white rounded-lg shadow-md p-6 border border-[#e2c1ac]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[#6b4423]">{title}</p>
          <p className="text-2xl font-bold text-[#4a2e1f] mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d86d2a]"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
        <h2 className="text-lg font-semibold text-[#4a2e1f] mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Franchise</label>
            <input
              type="text"
              placeholder="Franchise ID (optional)"
              value={filters.franchiseId}
              onChange={(e) => setFilters({ ...filters, franchiseId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Kiosk</label>
            <input
              type="text"
              placeholder="Kiosk ID (optional)"
              value={filters.kioskId}
              onChange={(e) => setFilters({ ...filters, kioskId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard
          title="Total Investment"
          value={`₹${dashboardData.totalInvestment?.toLocaleString('en-IN') || '0'}`}
          icon="💰"
        />
        <KPICard
          title="Monthly Expenses"
          value={`₹${dashboardData.monthlyExpenses?.toLocaleString('en-IN') || '0'}`}
          icon="📊"
        />
        <KPICard
          title="Food Cost (COGS)"
          value={`₹${dashboardData.cogs?.toLocaleString('en-IN') || '0'}`}
          icon="🍲"
        />
        <KPICard
          title="Food Cost %"
          value={`${dashboardData.foodCostPercentage || '0'}%`}
          icon="🍽️"
          subtitle="COGS / Sales"
        />
        <KPICard
          title="Gross Profit"
          value={`₹${dashboardData.grossProfit?.toLocaleString('en-IN') || '0'}`}
          icon="💵"
        />
        <KPICard
          title="Total Sales"
          value={`₹${dashboardData.totalSales?.toLocaleString('en-IN') || '0'}`}
          icon="🛒"
        />
        <KPICard
          title="Breakeven Months"
          value={dashboardData.breakevenMonths ? `${dashboardData.breakevenMonths.toFixed(1)} months` : 'N/A'}
          icon="📅"
        />
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-[#e2c1ac]">
        <h2 className="text-lg font-semibold text-[#4a2e1f] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/costing/investments"
            className="p-4 bg-[#f5e3d5] rounded-lg hover:bg-[#d86d2a] hover:text-white transition-colors text-center"
          >
            <div className="text-2xl mb-2">💰</div>
            <div className="font-medium">Add Investment</div>
          </a>
          <a
            href="/costing/expenses"
            className="p-4 bg-[#f5e3d5] rounded-lg hover:bg-[#d86d2a] hover:text-white transition-colors text-center"
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="font-medium">Add Expense</div>
          </a>
          <a
            href="/costing/reports"
            className="p-4 bg-[#f5e3d5] rounded-lg hover:bg-[#d86d2a] hover:text-white transition-colors text-center"
          >
            <div className="text-2xl mb-2">📈</div>
            <div className="font-medium">View Reports</div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
















