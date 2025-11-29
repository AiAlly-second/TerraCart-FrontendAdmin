import React, { useState, useEffect, useMemo } from 'react';
import { FaFileAlt, FaSpinner, FaDownload, FaChartLine, FaRupeeSign, FaShoppingBag, FaUsers, FaStore, FaBuilding, FaChartBar, FaSync, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import api from '../utils/api';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [reportData, setReportData] = useState({
    totalUsers: 0,
    totalFranchises: 0,
    totalCarts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    paidPayments: 0,
    pendingPayments: 0,
    usersByRole: {},
    recentOrders: [],
    franchiseRevenue: [],
    cartRevenue: [],
  });

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const usersResponse = await api.get('/users');
      const users = usersResponse.data || [];
      
      // Fetch orders
      let orders = [];
      try {
        const ordersResponse = await api.get('/orders');
        orders = ordersResponse.data || [];
      } catch (err) {
        console.log('Could not fetch orders:', err);
      }
      
      // Fetch payments
      let payments = [];
      try {
        const paymentsResponse = await api.get('/payments');
        payments = paymentsResponse.data || [];
      } catch (err) {
        console.log('Could not fetch payments:', err);
      }

      // Fetch current revenue with franchise and cart breakdown
      let revenueData = { franchiseRevenue: [], cartRevenue: [], totalRevenue: 0, totalOrders: 0 };
      try {
        const revenueResponse = await api.get('/revenue/current');
        if (revenueResponse.data?.success) {
          revenueData = revenueResponse.data.data;
        }
      } catch (err) {
        console.log('Could not fetch revenue data:', err);
      }

      // Calculate statistics
      const franchises = users.filter(u => u.role === 'franchise_admin');
      const carts = users.filter(u => u.role === 'admin');
      const paidPayments = payments.filter(p => p.status === 'PAID');
      const pendingPayments = payments.filter(p => p.status === 'PENDING' || p.status === 'CASH_PENDING');
      const totalRevenue = revenueData.totalRevenue || paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Group users by role
      const usersByRole = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {});

      // Get recent orders
      const recentOrders = orders
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);

      // Build franchise-cart mapping for the hierarchical view
      const franchiseCartMap = {};
      carts.forEach(cart => {
        const franchiseId = cart.franchiseId?.toString() || 'unassigned';
        if (!franchiseCartMap[franchiseId]) {
          franchiseCartMap[franchiseId] = [];
        }
        
        // Find revenue data for this cart
        const cartRevenueData = revenueData.cartRevenue?.find(
          c => c.cartId === cart._id.toString()
        );
        
        franchiseCartMap[franchiseId].push({
          ...cart,
          revenue: cartRevenueData?.revenue || 0,
          orderCount: cartRevenueData?.orderCount || 0,
        });
      });

      // Enhance franchise data with cart counts and revenue
      const enhancedFranchiseRevenue = franchises.map(franchise => {
        const revenueInfo = revenueData.franchiseRevenue?.find(
          f => f.franchiseId === franchise._id.toString()
        );
        const franchiseCarts = franchiseCartMap[franchise._id.toString()] || [];
        
        return {
          franchiseId: franchise._id,
          franchiseName: franchise.name,
          email: franchise.email,
          isActive: franchise.isActive !== false,
          revenue: revenueInfo?.revenue || 0,
          cartCount: revenueInfo?.cartCount || franchiseCarts.length,
          carts: franchiseCarts,
          orderCount: franchiseCarts.reduce((sum, c) => sum + (c.orderCount || 0), 0),
        };
      });

      setReportData({
        totalUsers: users.length,
        totalFranchises: franchises.length,
        totalCarts: carts.length,
        totalOrders: revenueData.totalOrders || orders.length,
        totalRevenue,
        paidPayments: paidPayments.length,
        pendingPayments: pendingPayments.length,
        usersByRole,
        recentOrders,
        franchiseRevenue: enhancedFranchiseRevenue,
        cartRevenue: revenueData.cartRevenue || [],
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
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
    const newExpanded = new Set(expandedFranchises);
    if (newExpanded.has(franchiseId)) {
      newExpanded.delete(franchiseId);
    } else {
      newExpanded.add(franchiseId);
    }
    setExpandedFranchises(newExpanded);
  };

  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: reportData.totalUsers,
        totalFranchises: reportData.totalFranchises,
        totalCarts: reportData.totalCarts,
        totalOrders: reportData.totalOrders,
        totalRevenue: reportData.totalRevenue,
      },
      franchiseBreakdown: reportData.franchiseRevenue,
      cartBreakdown: reportData.cartRevenue,
      usersByRole: reportData.usersByRole,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `super-admin-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate chart data for franchise performance
  const chartData = useMemo(() => {
    if (!reportData.franchiseRevenue?.length) return { maxRevenue: 0, franchises: [] };
    
    const sortedFranchises = [...reportData.franchiseRevenue]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 franchises
    
    const maxRevenue = Math.max(...sortedFranchises.map(f => f.revenue), 1);
    
    return {
      maxRevenue,
      franchises: sortedFranchises,
    };
  }, [reportData.franchiseRevenue]);

  // Chart colors
  const chartColors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
    'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500',
    'bg-indigo-500', 'bg-teal-500'
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <FaSpinner className="animate-spin text-gray-400 text-4xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reports & Analytics</h1>
          <p className="text-gray-600 mt-2">Comprehensive view of franchise and kiosk performance</p>
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
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{reportData.totalUsers}</p>
            </div>
            <FaUsers className="text-3xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Franchises</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{reportData.totalFranchises}</p>
            </div>
            <FaBuilding className="text-3xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Kiosks</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{reportData.totalCarts}</p>
            </div>
            <FaStore className="text-3xl text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{reportData.totalOrders}</p>
            </div>
            <FaShoppingBag className="text-3xl text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">₹{reportData.totalRevenue.toLocaleString('en-IN')}</p>
            </div>
            <FaRupeeSign className="text-3xl text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Franchise Performance Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <FaChartBar className="mr-2 text-blue-500" />
            Franchise Performance Chart
          </h2>
          <span className="text-sm text-gray-500">Top 10 by Revenue</span>
        </div>
        
        {chartData.franchises.length > 0 ? (
          <div className="space-y-4">
            {chartData.franchises.map((franchise, index) => {
              const widthPercent = (franchise.revenue / chartData.maxRevenue) * 100;
              return (
                <div key={franchise.franchiseId} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-gray-700 truncate" title={franchise.franchiseName}>
                    {franchise.franchiseName}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                    <div 
                      className={`h-full ${chartColors[index % chartColors.length]} rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                      style={{ width: `${Math.max(widthPercent, 2)}%` }}
                    >
                      {widthPercent > 20 && (
                        <span className="text-white text-xs font-semibold">
                          ₹{franchise.revenue.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    {widthPercent <= 20 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-semibold">
                        ₹{franchise.revenue.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <div className="w-20 text-right text-sm text-gray-500">
                    {franchise.orderCount} orders
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FaChartBar className="mx-auto text-4xl mb-2 text-gray-300" />
            <p>No franchise revenue data available</p>
          </div>
        )}
      </div>

      {/* Franchise & Kiosk Level Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <FaBuilding className="mr-2 text-green-500" />
          Franchise & Kiosk Level Breakdown
        </h2>
        
        {reportData.franchiseRevenue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 w-8"></th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Orders</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Revenue</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Kiosks</th>
                </tr>
              </thead>
              <tbody>
                {reportData.franchiseRevenue.map((franchise) => {
                  const isExpanded = expandedFranchises.has(franchise.franchiseId);
                  const hasCarts = franchise.carts && franchise.carts.length > 0;
                  
                  return (
                    <React.Fragment key={franchise.franchiseId}>
                      {/* Franchise Row */}
                      <tr 
                        className={`border-b border-gray-100 hover:bg-gray-50 ${hasCarts ? 'cursor-pointer' : ''}`}
                        onClick={() => hasCarts && toggleFranchiseExpand(franchise.franchiseId)}
                      >
                        <td className="py-3 px-4">
                          {hasCarts && (
                            <button className="text-gray-500 hover:text-gray-700">
                              {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <FaBuilding className="text-green-500 mr-2" />
                            <span className="font-medium text-gray-800">{franchise.franchiseName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            Franchise
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            franchise.isActive 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {franchise.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-800">
                          {franchise.orderCount}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-800">
                          ₹{franchise.revenue.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                            {franchise.cartCount} kiosks
                          </span>
                        </td>
                      </tr>
                      
                      {/* Kiosk Rows (Expandable) */}
                      {isExpanded && franchise.carts && franchise.carts.map((cart, cartIndex) => (
                        <tr 
                          key={cart._id} 
                          className="bg-gray-50 border-b border-gray-100"
                        >
                          <td className="py-2 px-4"></td>
                          <td className="py-2 px-4 pl-10">
                            <div className="flex items-center">
                              <FaStore className="text-purple-500 mr-2" />
                              <span className="text-gray-700">{cart.cartName || cart.name || `Kiosk ${cartIndex + 1}`}</span>
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                              Kiosk
                            </span>
                          </td>
                          <td className="py-2 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              cart.isActive !== false && cart.isApproved !== false
                                ? 'bg-emerald-100 text-emerald-800' 
                                : cart.isApproved === false
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {cart.isApproved === false ? 'Pending' : cart.isActive !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right text-gray-600">
                            {cart.orderCount || 0}
                          </td>
                          <td className="py-2 px-4 text-right text-gray-600">
                            ₹{(cart.revenue || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-4 text-right text-gray-400">—</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FaBuilding className="mx-auto text-4xl mb-2 text-gray-300" />
            <p>No franchise data available</p>
          </div>
        )}
      </div>

      {/* Additional Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Role */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <FaUsers className="mr-2 text-blue-500" />
            Users by Role
          </h2>
          <div className="space-y-3">
            {Object.entries(reportData.usersByRole).map(([role, count]) => (
              <div key={role} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-700 capitalize font-medium">{role.replace('_', ' ')}</span>
                <span className="font-bold text-gray-800 px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Statistics */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <FaRupeeSign className="mr-2 text-yellow-500" />
            Payment Statistics
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700 font-medium">Paid Payments</span>
              <span className="font-bold text-green-600 px-3 py-1 bg-green-100 rounded-full">
                {reportData.paidPayments}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700 font-medium">Pending Payments</span>
              <span className="font-bold text-yellow-600 px-3 py-1 bg-yellow-100 rounded-full">
                {reportData.pendingPayments}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700 font-medium">Total Revenue</span>
              <span className="font-bold text-blue-600 px-3 py-1 bg-blue-100 rounded-full">
                ₹{reportData.totalRevenue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
          <FaShoppingBag className="mr-2 text-orange-500" />
          Recent Orders
        </h2>
        {reportData.recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Order ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Service Type</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {reportData.recentOrders.map((order) => {
                  const orderAmount = order.kotLines?.reduce((sum, kot) => sum + Number(kot.totalAmount || 0), 0) || 0;
                  return (
                    <tr key={order._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{order._id.slice(-8)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'Paid' ? 'bg-green-100 text-green-800' :
                          order.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.serviceType === 'TAKEAWAY' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {order.serviceType === 'TAKEAWAY' ? 'Takeaway' : 'Dine In'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        ₹{orderAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <FaShoppingBag className="mx-auto text-4xl mb-2 text-gray-300" />
            <p>No orders found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
