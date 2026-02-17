import React, { useCallback, useEffect, useState } from "react";
import {
  FaChartLine,
  FaDownload,
  FaRupeeSign,
  FaShoppingBag,
  FaSpinner,
  FaStore,
  FaSync,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { buildExcelFileName, exportRowsToExcel } from "../utils/excelReport";

const Revenue = () => {
  const { user } = useAuth();
  const role = user?.role;
  const isSuperAdmin = role === "super_admin";
  const isFranchiseAdmin = role === "franchise_admin";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const fetchData = useCallback(
    async ({ showLoader = true } = {}) => {
      try {
        if (showLoader) setLoading(true);
        setError("");

        if (isFranchiseAdmin) {
          const params = {};
          if (appliedStartDate && appliedEndDate) {
            params.startDate = appliedStartDate;
            params.endDate = appliedEndDate;
          }
          const res = await api.get("/revenue/franchise", {
            params: Object.keys(params).length > 0 ? params : undefined,
          });
          if (res.data?.success) {
            setData(res.data.data);
          } else {
            setData(null);
          }
        } else if (isSuperAdmin) {
          const res = await api.get("/revenue/current");
          if (res.data?.success) {
            setData(res.data.data);
          } else {
            setData(null);
          }
        } else {
          setData(null);
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load revenue data");
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isFranchiseAdmin, isSuperAdmin, appliedStartDate, appliedEndDate],
  );

  useEffect(() => {
    fetchData({ showLoader: true });
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData({ showLoader: false });
  };

  const handleApplyDateFilter = () => {
    if (!startDateInput || !endDateInput) {
      alert("Please select both start date and end date.");
      return;
    }
    if (startDateInput > endDateInput) {
      alert("Start date cannot be after end date.");
      return;
    }
    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
  };

  const handleClearDateFilter = () => {
    setStartDateInput("");
    setEndDateInput("");
    setAppliedStartDate("");
    setAppliedEndDate("");
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
        <p className="text-gray-600">
          Revenue analytics are not available for this role.
        </p>
      </div>
    );
  }

  // Franchise-level view
  if (isFranchiseAdmin) {
    const totalRevenue = Number(data?.totalRevenue || 0);
    const totalOrders = Number(data?.totalOrders || 0);
    const carts = Array.isArray(data?.cartRevenue) ? data.cartRevenue : [];
    const dailyBreakdown = Array.isArray(data?.dailyBreakdown)
      ? data.dailyBreakdown
      : [];

    const cartRows = carts
      .map((cart) => {
        const revenue = Number(cart.revenue || 0);
        const orderCount = Number(cart.orderCount || 0);
        const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
        const revenueShare = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
        return {
          cartId: cart.cartId || "",
          cartName: cart.cartName || "Unnamed Cart",
          revenue,
          orderCount,
          avgOrderValue,
          revenueShare,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const appliedPeriodLabel =
      appliedStartDate && appliedEndDate
        ? `${appliedStartDate} to ${appliedEndDate}`
        : "All Dates";

    const handleDownloadReport = () => {
      const cartSummaryRows = cartRows.map((cart, index) => ({
        Section: "Cart Summary",
        "Date Range": appliedPeriodLabel,
        Rank: index + 1,
        "Cart Name": cart.cartName,
        "Cart ID": cart.cartId,
        Orders: cart.orderCount,
        "Revenue (Rs)": Number(cart.revenue.toFixed(2)),
        "Avg Order Value (Rs)": Number(cart.avgOrderValue.toFixed(2)),
        "Revenue Share (%)": Number(cart.revenueShare.toFixed(2)),
      }));

      const dailyRows = dailyBreakdown.map((day) => ({
        Section: "Daily Breakdown",
        "Date Range": appliedPeriodLabel,
        Date: day.date || "",
        Orders: Number(day.orderCount || 0),
        "Revenue (Rs)": Number((day.revenue || 0).toFixed(2)),
      }));

      const rows = [...cartSummaryRows, ...dailyRows];
      const fileName =
        appliedStartDate && appliedEndDate
          ? `franchise-revenue-report-${appliedStartDate}-to-${appliedEndDate}.xlsx`
          : buildExcelFileName("franchise-revenue-report");

      const exported = exportRowsToExcel({
        rows,
        fileName,
        sheetName: "FranchiseRevenue",
      });

      if (!exported) {
        alert("No revenue data available for the selected dates.");
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Revenue</h1>
            <p className="text-gray-600 mt-2">
              Revenue summary for{" "}
              <span className="font-semibold">
                {data?.franchiseName || user.name}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <FaSync className={`mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleDownloadReport}
              className="flex items-center px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              <FaDownload className="mr-2" />
              Download Excel
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleApplyDateFilter}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              onClick={handleClearDateFilter}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-100"
            >
              Reset
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Showing: <span className="font-semibold">{appliedPeriodLabel}</span>
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  Rs {totalRevenue.toLocaleString("en-IN")}
                </p>
              </div>
              <FaRupeeSign className="text-3xl text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {totalOrders}
                </p>
              </div>
              <FaShoppingBag className="text-3xl text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Carts</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {cartRows.length}
                </p>
              </div>
              <FaStore className="text-3xl text-purple-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <FaChartLine className="mr-2 text-blue-500" />
              Cart-wise Revenue Details
            </h2>
            <span className="text-sm text-gray-500">
              Revenue, order count, and average order value
            </span>
          </div>

          {cartRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600">
                    <th className="text-left py-2 pr-3">Cart</th>
                    <th className="text-right py-2 px-3">Orders</th>
                    <th className="text-right py-2 px-3">Revenue (Rs)</th>
                    <th className="text-right py-2 px-3">
                      Avg Order Value (Rs)
                    </th>
                    <th className="text-right py-2 pl-3">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {cartRows.map((cart) => (
                    <tr key={cart.cartId} className="border-b border-gray-100">
                      <td className="py-2 pr-3 font-medium text-gray-800">
                        {cart.cartName}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-700">
                        {cart.orderCount}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-700">
                        {cart.revenue.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-700">
                        {cart.avgOrderValue.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2 pl-3 text-right text-gray-700">
                        {cart.revenueShare.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">
              No revenue data available for the selected dates.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Date-wise Revenue
            </h2>
            <span className="text-sm text-gray-500">
              Orders and revenue by date
            </span>
          </div>

          {dailyBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-600">
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-right py-2 px-3">Orders</th>
                    <th className="text-right py-2 pl-3">Revenue (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.map((day) => (
                    <tr key={String(day.date || "")} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-800">{day.date || "-"}</td>
                      <td className="py-2 px-3 text-right text-gray-700">
                        {Number(day.orderCount || 0)}
                      </td>
                      <td className="py-2 pl-3 text-right text-gray-700">
                        {Number(day.revenue || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6">
              No date-wise revenue data available.
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
          <h1 className="text-3xl font-bold text-gray-800">
            Revenue Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            System-wide revenue overview across all active franchises and carts
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <FaSync className={`mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                Rs {totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
            <FaRupeeSign className="text-3xl text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {totalOrders}
              </p>
            </div>
            <FaShoppingBag className="text-3xl text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Franchises</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {franchiseRevenue.length}
              </p>
            </div>
            <FaStore className="text-3xl text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Carts</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {cartRevenue.length}
              </p>
            </div>
            <FaStore className="text-3xl text-purple-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Franchise Revenue
        </h2>
        {franchiseRevenue.length > 0 ? (
          <div className="space-y-3">
            {franchiseRevenue
              .slice()
              .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
              .map((franchise) => (
                <div
                  key={franchise.franchiseId}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {franchise.franchiseName || "Unknown Franchise"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Carts: {franchise.cartCount || 0} | Orders:{" "}
                      {franchise.orderCount || 0}
                    </p>
                  </div>
                  <p className="font-bold text-green-600">
                    Rs {Number(franchise.revenue || 0).toLocaleString("en-IN")}
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

