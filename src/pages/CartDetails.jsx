import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../utils/api";
// Removed socket import - using HTTP polling instead

const CartDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    activeTables: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchCartStats = useCallback(async () => {
    try {
      if (import.meta.env.DEV) {
        console.log(`[CartDetails] Fetching stats for cart ID: ${id}`);
      }

      // Fetch orders - backend filters by franchiseId, but we need to filter by cartId
      const ordersResponse = await api.get("/orders");
      const allOrders = ordersResponse.data || [];
      if (import.meta.env.DEV) {
        console.log(`[CartDetails] Total orders from API: ${allOrders.length}`);
      }

      // Filter orders by cartId (the cart we're viewing)
      const cartOrders = allOrders.filter((order) => {
        // Handle both populated objects and ObjectId strings
        let orderCartId = order.cartId;
        if (!orderCartId) {
          // If cartId is missing, try to get it from populated table
          if (order.table && order.table.cartId) {
            orderCartId = order.table.cartId;
          } else {
            return false;
          }
        }

        if (orderCartId && typeof orderCartId === "object") {
          orderCartId = orderCartId._id || orderCartId;
        }

        const orderCartIdStr = orderCartId ? orderCartId.toString() : null;
        const targetIdStr = id ? id.toString() : null;
        const matches = orderCartIdStr === targetIdStr;

        return matches;
      });

      if (import.meta.env.DEV) {
        console.log(
          `[CartDetails] Filtered orders for this cart: ${cartOrders.length}`
        );
      }

      const paidOrders = cartOrders.filter((order) => order.status === "Paid");
      if (import.meta.env.DEV) {
        console.log(`[CartDetails] Paid orders: ${paidOrders.length}`);
      }

      const totalRevenue = paidOrders.reduce((sum, order) => {
        if (!order.kotLines || !Array.isArray(order.kotLines)) return sum;
        return (
          sum +
          order.kotLines.reduce((kotSum, kot) => {
            return kotSum + Number(kot.totalAmount || 0);
          }, 0)
        );
      }, 0);

      // Fetch tables - filter by cartId
      // Note: Tables endpoint may only allow cart admins, so we try/catch
      let activeTables = 0;
      try {
        const tablesResponse = await api.get("/tables");
        const allTables = tablesResponse.data || [];
        if (import.meta.env.DEV) {
          console.log(
            `[CartDetails] Total tables from API: ${allTables.length}`
          );
        }

        const cartTables = allTables.filter((table) => {
          // Handle both populated objects and ObjectId strings
          let tableCartId = table.cartId;
          if (!tableCartId) return false;

          if (tableCartId && typeof tableCartId === "object") {
            tableCartId = tableCartId._id || tableCartId;
          }

          const tableCartIdStr = tableCartId ? tableCartId.toString() : null;
          const targetIdStr = id ? id.toString() : null;
          return tableCartIdStr === targetIdStr;
        });

        if (import.meta.env.DEV) {
          console.log(
            `[CartDetails] Filtered tables for this cart: ${cartTables.length}`
          );
        }

        activeTables = cartTables.filter(
          (table) => table.status !== "AVAILABLE"
        ).length;
      } catch (tableError) {
        if (import.meta.env.DEV) {
          console.warn(
            `[CartDetails] Could not fetch tables (may require cart admin access):`,
            tableError
          );
        }
        // Set activeTables to 0 if we can't fetch tables
        activeTables = 0;
      }

      if (import.meta.env.DEV) {
        console.log(`[CartDetails] Final stats:`, {
          totalOrders: cartOrders.length,
          totalRevenue,
          activeTables,
        });
      }

      setStats({
        totalOrders: cartOrders.length,
        totalRevenue,
        activeTables,
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching cart stats:", error);
      }
      // Set default stats on error
      setStats({
        totalOrders: 0,
        totalRevenue: 0,
        activeTables: 0,
      });
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchCartDetails();
      fetchCartStats();
    }
  }, [id, fetchCartStats]);

  // HTTP polling for real-time updates (replaces Socket.IO)
  useEffect(() => {
    if (!id) return;

    // Poll cart stats every 10 seconds to check for new/updated/deleted orders
    const pollingInterval = setInterval(() => {
      fetchCartStats();
    }, 10000); // 10 seconds polling interval

    return () => {
      clearInterval(pollingInterval);
    };
  }, [id, fetchCartStats]);

  const handleRefreshStats = async () => {
    setRefreshing(true);
    await fetchCartStats();
    setRefreshing(false);
  };

  const fetchCartDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${id}`);
      const user = response.data;

      setCart({
        id: user._id,
        name: user.name || "Unnamed Cart",
        managerName: user.name,
        email: user.email,
        location: user.location || "Not specified",
        phone: user.phone || "Not provided",
        address: user.address || "Not provided",
        cartName: user.cartName || user.name,
        status:
          user.isActive !== false
            ? user.isApproved
              ? "Active"
              : "Pending Approval"
            : "Inactive",
        isApproved: user.isApproved || false,
        isActive: user.isActive !== false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Document fields (matching registration form)
        aadharCard: user.aadharCard,
        panCard: user.panCard,
        shopActLicense: user.shopActLicense,
        fssaiLicense: user.fssaiLicense,
        // Expiry dates
        shopActLicenseExpiry: user.shopActLicenseExpiry,
        fssaiLicenseExpiry: user.fssaiLicenseExpiry,
      });
    } catch (error) {
      console.error("Error fetching cart details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentUrl = (docPath) => {
    if (!docPath) return null;
    if (docPath.startsWith("http")) return docPath;
    const nodeApiBase =
      import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
    const baseUrl = nodeApiBase.replace(/\/$/, "");
    return `${baseUrl}${docPath}`;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
          Loading cart details..
        </div>
      </div>
    );
  }

  if (!cart) {
    return (
      <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500 mb-4">Cart not found</p>
          <button
            onClick={() => navigate("/carts")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Back to Carts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <button
          onClick={() => navigate("/carts")}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
        >
          ← Back to Carts
        </button>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            {cart.name}
          </h1>
          <div className="flex gap-2 mt-4 md:mt-0">
            <button
              onClick={() => navigate(`/carts/${id}/edit`)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
            >
              Edit Cart
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cart Information */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Cart Information
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Cart Name
                  </label>
                  <p className="text-lg font-semibold text-gray-800">
                    {cart.cartName || cart.name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Owner Name
                  </label>
                  <p className="text-lg font-semibold text-gray-800">
                    {cart.managerName}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Email
                  </label>
                  <p className="text-lg text-gray-800">{cart.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Phone
                  </label>
                  <p className="text-lg text-gray-800">
                    {cart.phone || "Not provided"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">
                    Location
                  </label>
                  <p className="text-lg text-gray-800">{cart.location}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">
                    Address
                  </label>
                  <p className="text-lg text-gray-800">
                    {cart.address || "Not provided"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Owner Documents - Optional Section */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Owner Documents
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              📄 All documents are optional
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Aadhar Card */}
              <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                  Aadhar Card
                </label>
                {cart.aadharCard ? (
                  <a
                    href={getDocumentUrl(cart.aadharCard)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#d86d2a] hover:underline text-sm font-medium"
                  >
                    View Document →
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Not uploaded</p>
                )}
              </div>

              {/* PAN Card */}
              <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                  PAN Card
                </label>
                {cart.panCard ? (
                  <a
                    href={getDocumentUrl(cart.panCard)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#d86d2a] hover:underline text-sm font-medium"
                  >
                    View Document →
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Not uploaded</p>
                )}
              </div>

              {/* Shop Act License */}
              <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                  Shop Act License
                </label>
                {cart.shopActLicense ? (
                  <div className="space-y-2">
                    <a
                      href={getDocumentUrl(cart.shopActLicense)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#d86d2a] hover:underline text-sm font-medium block"
                    >
                      View Document →
                    </a>
                    {cart.shopActLicenseExpiry && (
                      <p className="text-xs text-[#6b4423]">
                        Expiry: {formatDate(cart.shopActLicenseExpiry)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Not uploaded</p>
                )}
              </div>

              {/* FSSAI License */}
              <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                  FSSAI License
                </label>
                {cart.fssaiLicense ? (
                  <div className="space-y-2">
                    <a
                      href={getDocumentUrl(cart.fssaiLicense)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#d86d2a] hover:underline text-sm font-medium block"
                    >
                      View Document →
                    </a>
                    {cart.fssaiLicenseExpiry && (
                      <p className="text-xs text-[#6b4423]">
                        Expiry: {formatDate(cart.fssaiLicenseExpiry)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Not uploaded</p>
                )}
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Cart Statistics
              </h2>
              <button
                onClick={handleRefreshStats}
                disabled={refreshing}
                className="px-3 py-1.5 text-sm bg-[#d86d2a] hover:bg-[#c75b1a] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Refresh Statistics"
              >
                <span className={refreshing ? "animate-spin" : ""}>🔄</span>
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Total Orders</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.totalOrders}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹
                  {stats.totalRevenue.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Active Tables</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.activeTables}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Status</h3>
            <span
              className={`px-4 py-2 text-sm font-semibold rounded-full ${
                cart.status === "Active"
                  ? "bg-green-100 text-green-800"
                  : cart.status === "Pending Approval"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {cart.status}
            </span>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">Approval Status:</span>{" "}
                <span
                  className={
                    cart.isApproved
                      ? "text-green-600 font-semibold"
                      : "text-yellow-600 font-semibold"
                  }
                >
                  {cart.isApproved ? "Approved" : "Pending"}
                </span>
              </p>
              <p>
                <span className="font-medium">Active Status:</span>{" "}
                <span
                  className={
                    cart.isActive
                      ? "text-green-600 font-semibold"
                      : "text-red-600 font-semibold"
                  }
                >
                  {cart.isActive ? "Active" : "Inactive"}
                </span>
              </p>
              <p>
                <span className="font-medium">Created:</span>{" "}
                {new Date(cart.createdAt).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium">Last Updated:</span>{" "}
                {new Date(cart.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/orders?cafeId=${id}`)}
                className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                📋 View Orders for This Cart
              </button>
              <button
                onClick={handleRefreshStats}
                disabled={refreshing}
                className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
              >
                <span>🔄 Refresh Statistics</span>
                {refreshing && (
                  <span className="text-xs text-gray-500">Updating...</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartDetails;
