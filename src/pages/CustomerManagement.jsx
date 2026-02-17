import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const CustomerManagement = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("lastVisitAt");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    fetchCustomers();
    fetchStats();
  }, [sortBy, sortOrder]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = {
        sortBy,
        sortOrder,
        // Include customers from all sources (orders, feedback, takeaway)
        includeAllSources: true,
      };
      if (searchQuery) params.search = searchQuery;

      console.log(
        "[CustomerManagement] Fetching customers with params:",
        params,
      );
      console.log(
        "[CustomerManagement] User role:",
        user?.role,
        "User ID:",
        user?._id,
      );

      const response = await api.get("/customers", { params });
      const customersData = response.data.customers || response.data || [];

      console.log(
        "[CustomerManagement] Received customers:",
        customersData.length,
      );

      // For cart admin, verify filtering is working
      if (user?.role === "admin") {
        console.log(
          "[CustomerManagement] Cart admin - verifying customer data includes feedback and takeaway customers",
        );
        // Log sample customer data to verify sources
        if (customersData.length > 0) {
          console.log("[CustomerManagement] Sample customer:", {
            name: customersData[0].name,
            hasOrders: !!customersData[0].orders,
            hasRatings: !!customersData[0].ratings,
            visitCount: customersData[0].visitCount,
          });
        }
      }

      setCustomers(customersData);
    } catch (error) {
      console.error("Error fetching customers:", error);
      console.error("Error details:", error.response?.data);
      alert(
        "Failed to load customers. Please check console for details.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/customers/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchCustomerDetails = async (customerId) => {
    try {
      const response = await api.get(`/customers/${customerId}`);
      setSelectedCustomer(response.data);
    } catch (error) {
      console.error("Error fetching customer details:", error);
      alert("Failed to load customer details");
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCustomers();
  };

  const getRatingStars = (rating) => {
    if (!rating) return "No ratings";
    return "⭐".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`;
  };

  const getFeedbackComment = (feedback) => {
    if (!feedback) return "";
    return (
      feedback.orderFeedback?.comments ||
      feedback.overallExperience?.overallComments ||
      ""
    );
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          Customer Management
        </h1>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
            <div className="text-xs sm:text-sm text-gray-600">
              Total Customers
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">
              {stats.totalCustomers}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
            <div className="text-xs sm:text-sm text-gray-600">Total Visits</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">
              {stats.totalVisits}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
            <div className="text-xs sm:text-sm text-gray-600">
              Average Rating
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-600">
              {stats.averageRating || "0.00"} ⭐
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
            <div className="text-xs sm:text-sm text-gray-600">
              Customers with Ratings
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">
              {stats.customersWithRatings}
            </div>
          </div>
        </div>
      )}

      {/* Search and Sort */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4">
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end"
        >
          <div className="flex-1">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Search Customers
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or phone..."
              className="w-full px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="lastVisitAt">Last Visit</option>
              <option value="visitCount">Visit Count</option>
              <option value="averageRating">Average Rating</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base w-full sm:w-auto"
          >
            Search
          </button>
        </form>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Contact
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visits
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Ratings
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Rating
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                  Last Visit
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {customer.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.phone &&
                      !customer.phone.startsWith("email-") ? (
                        <div className="text-sm text-gray-500">
                          {customer.phone}
                        </div>
                      ) : customer.email ? (
                        <div className="text-sm text-gray-500">
                          {customer.email}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">
                          No contact info
                        </div>
                      )}
                      {customer.email &&
                        customer.phone &&
                        !customer.phone.startsWith("email-") && (
                          <div className="text-xs text-gray-400">
                            {customer.email}
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.visitCount || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.totalRatings !== undefined
                          ? customer.totalRatings
                          : customer.ratings?.length || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {customer.averageRating && customer.averageRating > 0
                          ? `${Number(customer.averageRating).toFixed(1)} ⭐`
                          : "No ratings"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(customer.lastVisitAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => fetchCustomerDetails(customer._id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">
                  Customer Details
                </h2>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Name
                  </label>
                  <div className="text-lg font-semibold">
                    {selectedCustomer.name}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Phone
                  </label>
                  <div className="text-lg">
                    {selectedCustomer.phone &&
                    !selectedCustomer.phone.startsWith("email-")
                      ? selectedCustomer.phone
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Email
                  </label>
                  <div className="text-lg">
                    {selectedCustomer.email || "N/A"}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Total Visits
                  </label>
                  <div className="text-lg font-semibold text-blue-600">
                    {selectedCustomer.visitCount}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    First Visit
                  </label>
                  <div className="text-lg">
                    {formatDate(selectedCustomer.firstVisitAt)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Last Visit
                  </label>
                  <div className="text-lg">
                    {formatDate(selectedCustomer.lastVisitAt)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Average Rating
                  </label>
                  <div className="text-lg font-semibold text-yellow-600">
                    {selectedCustomer.averageRating || "0.00"} ⭐
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Total Spent
                  </label>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(selectedCustomer.totalSpent)}
                  </div>
                </div>
              </div>

              {/* All Ratings History */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Rating History ({selectedCustomer.ratings?.length || 0})
                </h3>
                <div className="space-y-3">
                  {selectedCustomer.ratings &&
                  selectedCustomer.ratings.length > 0 ? (
                    selectedCustomer.ratings.map((rating, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-lg font-semibold">
                              {getRatingStars(rating.rating)} ({rating.rating}
                              /5)
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDate(rating.createdAt)}
                            </div>
                          </div>
                        </div>
                        {rating.comments && (
                          <div className="text-sm text-gray-700 mt-2">
                            {rating.comments}
                          </div>
                        )}
                        {(rating.foodQuality ||
                          rating.serviceSpeed ||
                          rating.orderAccuracy) && (
                          <div className="mt-2 text-xs text-gray-600">
                            Food: {rating.foodQuality || "N/A"} | Service:{" "}
                            {rating.serviceSpeed || "N/A"} | Accuracy:{" "}
                            {rating.orderAccuracy || "N/A"}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">No ratings yet</div>
                  )}
                </div>
              </div>

              {/* Raw Feedback Entries */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Feedback Entries ({selectedCustomer.feedbacks?.length || 0})
                </h3>
                <div className="space-y-3">
                  {selectedCustomer.feedbacks &&
                  selectedCustomer.feedbacks.length > 0 ? (
                    selectedCustomer.feedbacks.map((feedback) => (
                      <div
                        key={feedback._id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-lg font-semibold text-yellow-700">
                              {getRatingStars(feedback.overallRating)} (
                              {feedback.overallRating}/5)
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatDate(feedback.createdAt)}
                            </div>
                          </div>
                          {feedback.orderId && (
                            <div className="text-xs text-gray-500">
                              Order: {feedback.orderId}
                            </div>
                          )}
                        </div>

                        {(feedback.customerName ||
                          feedback.customerPhone ||
                          feedback.customerEmail) && (
                          <div className="text-xs text-gray-600 mb-2">
                            {feedback.customerName && (
                              <span>Name: {feedback.customerName} </span>
                            )}
                            {feedback.customerPhone && (
                              <span>Phone: {feedback.customerPhone} </span>
                            )}
                            {feedback.customerEmail && (
                              <span>Email: {feedback.customerEmail}</span>
                            )}
                          </div>
                        )}

                        {getFeedbackComment(feedback) && (
                          <div className="text-sm text-gray-700 mt-2">
                            {getFeedbackComment(feedback)}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">No feedback entries yet</div>
                  )}
                </div>
              </div>

              {/* Recent Orders */}
              {selectedCustomer.orders &&
                selectedCustomer.orders.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                      Recent Orders ({selectedCustomer.totalOrders})
                    </h3>
                    <div className="space-y-2">
                      {selectedCustomer.orders.map((order) => (
                        <div
                          key={order._id}
                          className="border border-gray-200 rounded-lg p-3"
                        >
                          <div className="flex justify-between">
                            <div>
                              <div className="font-semibold">
                                Order #{order._id}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDate(order.createdAt)} | Status:{" "}
                                {order.status}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">
                                {formatCurrency(
                                  order.kotLines && order.kotLines.length > 0
                                    ? order.kotLines[order.kotLines.length - 1]
                                        .totalAmount
                                    : 0,
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;

