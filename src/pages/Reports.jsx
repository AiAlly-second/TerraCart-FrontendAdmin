import React, { useEffect, useState } from 'react';
import {
  FaSpinner,
  FaUsers,
  FaBuilding,
  FaStore,
  FaRupeeSign,
  FaShoppingBag,
  FaDownload,
  FaSync,
} from 'react-icons/fa';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Reports = () => {
  const { user } = useAuth();
  const userRole = user?.role;
  const isSuperAdmin = userRole === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFranchises: 0,
    totalCarts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    usersByRole: {},
  });
  const [franchiseRevenue, setFranchiseRevenue] = useState([]);
  const [cartRevenue, setCartRevenue] = useState([]);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());

  useEffect(() => {
    if (isSuperAdmin) {
      fetchReportData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Fetch all users
      const usersRes = await api.get('/users');
      const users = usersRes.data || [];
      const totalUsers = users.length;
      const totalFranchises = users.filter((u) => u.role === 'franchise_admin').length;
      const totalCarts = users.filter((u) => u.role === 'admin').length;

      // Group users by role
      const usersByRole = users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {});

      // Fetch current revenue snapshot
      let revenueData = {
        totalRevenue: 0,
        totalOrders: 0,
        franchiseRevenue: [],
        cartRevenue: [],
      };

      try {
        const revenueRes = await api.get('/revenue/current');
        if (revenueRes.data?.success && revenueRes.data.data) {
          revenueData = revenueRes.data.data;
        }
      } catch (err) {
        console.error('Could not fetch revenue snapshot:', err);
      }

      setStats({
        totalUsers,
        totalFranchises,
        totalCarts,
        totalOrders: Number(revenueData.totalOrders || 0),
        totalRevenue: Number(revenueData.totalRevenue || 0),
        usersByRole,
      });

      setFranchiseRevenue(revenueData.franchiseRevenue || []);
      setCartRevenue(revenueData.cartRevenue || []);
    } catch (err) {
      console.error('Error fetching reports data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReportData();
  };

  const toggleFranchiseExpand = (franchiseId) => {
    setExpandedFranchises((prev) => {
      const next = new Set(prev);
      if (next.has(franchiseId)) {
        next.delete(franchiseId);
      } else {
        next.add(franchiseId);
      }
      return next;
    });
  };

  const exportReport = () => {
    try {
      const workbook = XLSX.utils.book_new();
      const dateStr = new Date().toISOString().split('T')[0];

      // Sheet 1: Executive Summary
      const summaryData = [
        ['SUPER ADMIN REPORT'],
        ['Generated At:', new Date().toLocaleString('en-IN')],
        [],
        ['OVERALL STATISTICS'],
        ['Total Users', stats.totalUsers],
        ['Total Franchises', stats.totalFranchises],
        ['Total Carts (Kiosks)', stats.totalCarts],
        ['Total Orders', stats.totalOrders],
        ['Total Revenue', `₹${Number(stats.totalRevenue || 0).toLocaleString('en-IN')}`],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet['!cols'] = [{ wch: 28 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // Sheet 2: Users by Role
      const usersByRoleData = [
        ['Role', 'Count'],
        ...Object.entries(stats.usersByRole).map(([role, count]) => [
          role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          count,
        ]),
      ];
      const usersByRoleSheet = XLSX.utils.aoa_to_sheet(usersByRoleData);
      usersByRoleSheet['!cols'] = [{ wch: 25 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(workbook, usersByRoleSheet, 'Users By Role');

      // Sheet 3: Franchise Revenue
      if (franchiseRevenue.length > 0) {
        const franchiseHeaders = ['#', 'Franchise Name', 'Revenue', 'Orders (approx)', 'Carts'];
        const franchiseRows = franchiseRevenue
          .slice()
          .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
          .map((f, index) => [
            index + 1,
            f.franchiseName || 'Unknown',
            Number(f.revenue || 0),
            '', // Approx orders per franchise can be derived if needed
            f.cartCount || 0,
          ]);
        const franchiseSheet = XLSX.utils.aoa_to_sheet([franchiseHeaders, ...franchiseRows]);
        franchiseSheet['!cols'] = [
          { wch: 5 },
          { wch: 30 },
          { wch: 18 },
          { wch: 16 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(workbook, franchiseSheet, 'Franchise Revenue');
      }

      // Sheet 4: Cart Revenue
      if (cartRevenue.length > 0) {
        const cartHeaders = ['#', 'Cart Name', 'Franchise Name', 'Revenue', 'Orders'];
        const cartRows = cartRevenue
          .slice()
          .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
          .map((c, index) => [
            index + 1,
            c.cartName || c.cafeName || 'Unknown',
            c.franchiseName || 'Unknown',
            Number(c.revenue || 0),
            c.orderCount || 0,
          ]);
        const cartSheet = XLSX.utils.aoa_to_sheet([cartHeaders, ...cartRows]);
        cartSheet['!cols'] = [
          { wch: 5 },
          { wch: 30 },
          { wch: 30 },
          { wch: 18 },
          { wch: 10 },
        ];
        XLSX.utils.book_append_sheet(workbook, cartSheet, 'Cart Revenue');
      }

      const fileName = `super-admin-report-${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Error exporting reports:', err);
      alert('Failed to export Excel report. Please try again.');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">Reports are only available for Super Admin.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <FaSpinner className="animate-spin text-gray-400 text-4xl" />
      </div>
    );
  }

  const safeTotalRevenue = Number(stats.totalRevenue || 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Super Admin Reports</h1>
          <p className="text-gray-600 mt-2">
            Snapshot of users, franchises, kiosks and current revenue distribution
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <FaSync className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportReport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaDownload className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalUsers}</p>
            </div>
            <FaUsers className="text-3xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Franchises</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalFranchises}</p>
            </div>
            <FaBuilding className="text-3xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Kiosks</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalCarts}</p>
            </div>
            <FaStore className="text-3xl text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stats.totalOrders}</p>
            </div>
              <FaShoppingBag className="text-3xl text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                ₹{safeTotalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <FaRupeeSign className="text-3xl text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Franchise Performance Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            Franchise Performance Chart
          </h2>
          <span className="text-sm text-gray-500">Top franchises by revenue</span>
        </div>

        {franchiseRevenue.length > 0 ? (
          <div className="space-y-4">
            {franchiseRevenue
              .slice()
              .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
              .map((f, index, arr) => {
                const maxRevenue = arr[0]?.revenue || 1;
                const fracRevenue = Number(f.revenue || 0);
                const widthPercent = (fracRevenue / maxRevenue) * 100;
                return (
                  <div key={f.franchiseId} className="flex items-center gap-4">
                    <div className="w-32 text-sm text-gray-700 truncate" title={f.franchiseName}>
                      {f.franchiseName || 'Unknown'}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                        style={{ width: `${Math.max(widthPercent, 3)}%` }}
                      >
                        {widthPercent > 20 && (
                          <span className="text-white text-xs font-semibold">
                            ₹{fracRevenue.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {widthPercent <= 20 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-semibold">
                          ₹{fracRevenue.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="w-24 text-right text-sm text-gray-500">
                      {f.cartCount || 0} kiosks
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-6">
            No franchise revenue data available.
          </p>
        )}
      </div>

      {/* Franchise & Kiosk Level Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          Franchise & Kiosk Level Breakdown
        </h2>

        {franchiseRevenue.length === 0 ? (
          <p className="text-gray-500 text-sm">No franchise data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700 w-8"></th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Type</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Orders</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Revenue</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Kiosks</th>
                </tr>
              </thead>
              <tbody>
                {franchiseRevenue
                  .slice()
                  .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                  .map((f) => {
                    const isExpanded = expandedFranchises.has(f.franchiseId);
                    const cafes =
                      cartRevenue.filter((c) => c.franchiseId === f.franchiseId) || [];
                    const franchiseOrders = cafes.reduce(
                      (sum, c) => sum + Number(c.orderCount || 0),
                      0
                    );
                    const franchiseRevenueValue = Number(f.revenue || 0);

                    return (
                      <React.Fragment key={f.franchiseId}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            {cafes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleFranchiseExpand(f.franchiseId)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                {isExpanded ? '▾' : '▸'}
                              </button>
                            )}
                          </td>
                          <td className="py-2 px-3 font-medium text-gray-800">
                            {f.franchiseName || 'Unknown'}
                          </td>
                          <td className="py-2 px-3 text-gray-600">Franchise</td>
                          <td className="py-2 px-3 text-right text-gray-800">
                            {franchiseOrders}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-800">
                            ₹{franchiseRevenueValue.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-800">
                            {f.cartCount || cafes.length}
                          </td>
                        </tr>

                        {isExpanded &&
                          cafes.map((cafe) => (
                            <tr key={cafe.cartId} className="bg-gray-50 border-b border-gray-100">
                              <td className="py-2 px-3"></td>
                              <td className="py-2 px-3 pl-8">
                                <span className="text-gray-800">
                                  {cafe.cartName || cafe.cafeName || 'Unknown Cart'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-gray-600">Kiosk</td>
                              <td className="py-2 px-3 text-right text-gray-700">
                                {Number(cafe.orderCount || 0)}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700">
                                ₹{Number(cafe.revenue || 0).toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-400">—</td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users by Role */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Users by Role</h2>
        {Object.keys(stats.usersByRole).length === 0 ? (
          <p className="text-gray-500 text-sm">No user data available.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(stats.usersByRole).map(([role, count]) => (
              <div
                key={role}
                className="flex items-center justify-between border-b border-gray-100 py-2"
              >
                <span className="text-gray-700">
                  {role.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;


