import React, { useEffect, useState } from 'react';
import { FaSpinner, FaRupeeSign, FaShoppingBag, FaStore, FaChartLine, FaSync } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Revenue = () => {
  const { user } = useAuth();
  const role = user?.role;
  const isSuperAdmin = role === 'super_admin';
  const isFranchiseAdmin = role === 'franchise_admin';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (isFranchiseAdmin) {
        const res = await api.get('/revenue/franchise');
        if (res.data?.success) {
          setData(res.data.data);
        }
      } else if (isSuperAdmin) {
        const res = await api.get('/revenue/current');
        if (res.data?.success) {
          setData(res.data.data);
        }
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('Error fetching revenue data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <FaSpinner className="animate-spin text-gray-400 text-4xl" />
      </div>
    );
  }

  if (!isSuperAdmin && !isFranchiseAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">Revenue analytics are not available for this role.</p>
      </div>
    );
  }

  // Franchise-level view
  if (isFranchiseAdmin) {
    const totalRevenue = Number(data?.totalRevenue || 0);
    const totalOrders = data?.totalOrders || 0;
    const carts = data?.cartRevenue || [];

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Revenue</h1>
            <p className="text-gray-600 mt-2">
              Revenue summary for <span className="font-semibold">{data?.franchiseName || user.name}</span>
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            <FaSync className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </p>
              </div>
              <FaRupeeSign className="text-3xl text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{totalOrders}</p>
              </div>
              <FaShoppingBag className="text-3xl text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Carts with Revenue</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{carts.length}</p>
              </div>
              <FaStore className="text-3xl text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <FaChartLine className="mr-2 text-blue-500" />
              Cart-wise Revenue
            </h2>
            <span className="text-sm text-gray-500">Revenue and orders per cart</span>
          </div>

          {carts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {carts.map((cart) => (
                <div
                  key={cart.cartId}
                  className="bg-[#fef4ec] rounded-lg p-4 border border-[#e2c1ac] hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-[#4a2e1f]">
                      {cart.cartName || 'Unnamed Cart'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center mt-3">
                    <div className="bg-white rounded p-2">
                      <p className="text-xs text-[#6b4423]">Orders</p>
                      <p className="text-lg font-bold text-[#4a2e1f]">{cart.orderCount || 0}</p>
                    </div>
                    <div className="bg-white rounded p-2">
                      <p className="text-xs text-[#6b4423]">Revenue</p>
                      <p className="text-sm font-bold text-green-600">
                        ₹{(cart.revenue || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">
              No revenue data available yet for your carts.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Super admin view
    const totalRevenue = Number(data?.totalRevenue || 0);
    const totalOrders = Number(data?.totalOrders || 0);
  const franchiseRevenue = data?.franchiseRevenue || [];
  const cartRevenue = data?.cartRevenue || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Revenue Analytics</h1>
          <p className="text-gray-600 mt-2">
            System-wide revenue overview across all active franchises and carts
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <FaSync className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                ₹{totalRevenue.toLocaleString('en-IN')}
              </p>
            </div>
            <FaRupeeSign className="text-3xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{totalOrders}</p>
            </div>
            <FaShoppingBag className="text-3xl text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Franchises</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{franchiseRevenue.length}</p>
            </div>
            <FaStore className="text-3xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Carts</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{cartRevenue.length}</p>
            </div>
            <FaStore className="text-3xl text-purple-500" />
          </div>
        </div>
      </div>

      {/* Franchise revenue list */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Franchise Revenue</h2>
        {franchiseRevenue.length > 0 ? (
          <div className="space-y-3">
            {franchiseRevenue
              .slice()
              .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
              .map((f) => (
                <div
                  key={f.franchiseId}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {f.franchiseName || 'Unknown Franchise'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Carts: {f.cartCount || 0} • Orders: {f.orderCount || 0}
                    </p>
                  </div>
                  <p className="font-bold text-green-600">
                    ₹{(f.revenue || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-6">
            No franchise revenue data available yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default Revenue;


