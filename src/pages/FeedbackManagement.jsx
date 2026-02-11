import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const FeedbackManagement = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchFeedbacks();
    fetchStats();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);

      console.log("[FeedbackManagement] Fetching feedback");
      console.log(
        "[FeedbackManagement] User role:",
        user?.role,
        "User ID:",
        user?._id,
      );

      // Backend should automatically filter by cafeId for cart admins
      const response = await api.get("/feedback");
      const feedbacksData = response.data || [];

      console.log(
        "[FeedbackManagement] Received feedbacks:",
        feedbacksData.length,
      );

      // For cart admin, verify filtering is working
      if (user?.role === "admin" && feedbacksData.length > 0) {
        console.log(
          "[FeedbackManagement] Cart admin - verifying feedback data",
        );
        // Log sample feedback to verify it belongs to this cart
        const sampleFeedback = feedbacksData[0];
        console.log("[FeedbackManagement] Sample feedback:", {
          id: sampleFeedback._id,
          cafeId: sampleFeedback.cafeId,
          orderId: sampleFeedback.orderId,
          customerName: sampleFeedback.customerName,
        });
      }

      setFeedbacks(feedbacksData);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      console.error("Error details:", error.response?.data);
      alert(
        "Failed to load feedback. Please check console for details.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/feedback/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const getRatingStars = (rating) => {
    return "⭐".repeat(rating) + "☆".repeat(5 - rating);
  };

  const filteredFeedbacks = (() => {
    let result = feedbacks;

    // First filter by orderId if provided
    if (orderIdParam) {
      result = result.filter((f) => {
        const feedbackOrderId = f.orderId?._id || f.orderId;
        return feedbackOrderId && feedbackOrderId.toString() === orderIdParam;
      });
    }

    // Then apply rating filter
    if (filter === "high") {
      result = result.filter((f) => f.overallRating >= 4);
    } else if (filter === "low") {
      result = result.filter((f) => f.overallRating <= 2);
    }

    return result;
  })();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">
          Feedback Management
        </h1>
        {orderIdParam && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm">
              Filtered by Order ID: {orderIdParam.substring(0, 12)}...
            </span>
            <button
              onClick={() => (window.location.href = "/feedback")}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
            <div className="text-xs sm:text-sm text-gray-600">
              Total Feedback
            </div>
            <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
            <div className="text-xs sm:text-sm text-gray-600">
              Average Rating
            </div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">
              {stats.averageRating}
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
            <div className="text-xs sm:text-sm text-gray-600">Food Quality</div>
            <div className="text-xl sm:text-2xl font-bold">
              {stats.averageFoodQuality || "N/A"}
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
            <div className="text-xs sm:text-sm text-gray-600">
              Service Speed
            </div>
            <div className="text-xl sm:text-2xl font-bold">
              {stats.averageServiceSpeed || "N/A"}
            </div>
          </div>
          {stats.averageOrderAccuracy && (
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Order Accuracy</div>
              <div className="text-2xl font-bold">
                {stats.averageOrderAccuracy}
              </div>
            </div>
          )}
          {stats.averageAmbiance && (
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Ambiance</div>
              <div className="text-2xl font-bold">{stats.averageAmbiance}</div>
            </div>
          )}
          {stats.averageCleanliness && (
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Cleanliness</div>
              <div className="text-2xl font-bold">
                {stats.averageCleanliness}
              </div>
            </div>
          )}
          {stats.averageStaffBehavior && (
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Staff Behavior</div>
              <div className="text-2xl font-bold">
                {stats.averageStaffBehavior}
              </div>
            </div>
          )}
          {stats.averageValueForMoney && (
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Value for Money</div>
              <div className="text-2xl font-bold">
                {stats.averageValueForMoney}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded text-xs sm:text-sm ${
            filter === "all" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("high")}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded text-xs sm:text-sm ${
            filter === "high" ? "bg-green-600 text-white" : "bg-gray-200"
          }`}
        >
          High (4+)
        </button>
        <button
          onClick={() => setFilter("low")}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded text-xs sm:text-sm ${
            filter === "low" ? "bg-red-600 text-white" : "bg-gray-200"
          }`}
        >
          Low (≤2)
        </button>
      </div>

      {/* Feedback List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Order ID
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Table
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Customer
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Overall Rating
                </th>
                <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">
                  Food Quality
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Service Speed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Order Accuracy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Comments
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFeedbacks.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No feedback found
                  </td>
                </tr>
              ) : (
                filteredFeedbacks.map((feedback) => (
                  <tr key={feedback._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(feedback.createdAt).toLocaleDateString()}
                      <br />
                      <span className="text-xs text-gray-400">
                        {new Date(feedback.createdAt).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-xs">
                      {feedback.orderId
                        ? feedback.orderId.substring(0, 12) + "..."
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {feedback.tableId
                        ? typeof feedback.tableId === "object"
                          ? `Table ${
                              feedback.tableId.number || feedback.tableId._id
                            }`
                          : `Table ${feedback.tableId}`
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {feedback.customerName ? (
                        <div>
                          <div className="font-medium">
                            {feedback.customerName}
                          </div>
                          {feedback.customerEmail && (
                            <div className="text-xs text-gray-500">
                              {feedback.customerEmail}
                            </div>
                          )}
                          {feedback.customerPhone && (
                            <div className="text-xs text-gray-500">
                              {feedback.customerPhone}
                            </div>
                          )}
                        </div>
                      ) : (
                        "Anonymous"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        <span className="mr-2">
                          {getRatingStars(feedback.overallRating)}
                        </span>
                        <span className="font-semibold">
                          ({feedback.overallRating})
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {feedback.orderFeedback?.foodQuality ? (
                        <div className="flex items-center">
                          <span className="mr-1">
                            {getRatingStars(feedback.orderFeedback.foodQuality)}
                          </span>
                          <span>({feedback.orderFeedback.foodQuality})</span>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {feedback.orderFeedback?.serviceSpeed ? (
                        <div className="flex items-center">
                          <span className="mr-1">
                            {getRatingStars(
                              feedback.orderFeedback.serviceSpeed,
                            )}
                          </span>
                          <span>({feedback.orderFeedback.serviceSpeed})</span>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {feedback.orderFeedback?.orderAccuracy ? (
                        <div className="flex items-center">
                          <span className="mr-1">
                            {getRatingStars(
                              feedback.orderFeedback.orderAccuracy,
                            )}
                          </span>
                          <span>({feedback.orderFeedback.orderAccuracy})</span>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="max-w-xs">
                        <div
                          className="truncate"
                          title={
                            feedback.orderFeedback?.comments ||
                            feedback.overallExperience?.overallComments ||
                            ""
                          }
                        >
                          {feedback.orderFeedback?.comments ||
                            feedback.overallExperience?.overallComments ||
                            "No comments"}
                        </div>
                        {feedback.overallExperience?.overallComments &&
                          feedback.orderFeedback?.comments && (
                            <div
                              className="text-xs text-gray-500 mt-1 truncate"
                              title={feedback.overallExperience.overallComments}
                            >
                              Overall:{" "}
                              {feedback.overallExperience.overallComments}
                            </div>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FeedbackManagement;
