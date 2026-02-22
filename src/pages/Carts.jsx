import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const Carts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [approvingId, setApprovingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [approvalModal, setApprovalModal] = useState(null); // Store the cart data for approval modal
  const [approvalData, setApprovalData] = useState(null); // Store full user data with documents

  useEffect(() => {
    fetchCarts();
  }, []);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      const usersResponse = await api.get("/users");
      const allUsers = usersResponse.data || [];

      // Build a map of franchiseId -> franchiseName for super admin view
      const franchiseMap = {};
      allUsers
        .filter((u) => u.role === "franchise_admin")
        .forEach((f) => {
          if (f._id) {
            franchiseMap[f._id.toString()] = f.name || "Unnamed Franchise";
          }
        });

      // Filter admin users (cart admins)
      const adminUsers = allUsers.filter((user) => user.role === "admin");

      // Transform to cart format
      const cartsData = adminUsers.map((user) => ({
        id: user._id,
        name: user.cartName || user.name || "Unname Cart",
        managerName: user.name,
        email: user.email,
        location: user.location || "Not specified",
        phone: user.phone || "Not provided",
        address: user.address || "Not provided",
        isApproved: user.isApproved || false,
        isActive: user.isActive !== false, // Default to true if not set
        status: !user.isApproved
          ? "Pending Approval"
          : user.isActive !== false
            ? "Active"
            : "Inactive",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        cartCode: user.cartCode, // Cart ID code (e.g., MAH001)
        cartSequence: user.cartSequence,
        // For super admin, include franchise information so we can show carts franchise-wise
        franchiseId: user.franchiseId || null,
        franchiseName:
          (user.franchiseId &&
            franchiseMap[user.franchiseId.toString?.() || user.franchiseId]) ||
          null,
      }));

      setCarts(cartsData);
    } catch (error) {
      console.error("Error fetching cartts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = async (cartId) => {
    try {
      // Fetch full user data with documents
      const response = await api.get(`/users/${cartId}`);
      const userData = response.data;

      // Set approval modal data
      setApprovalData(userData);
      setApprovalModal(cartId);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to load cart details");
    }
  };

  const handleApprove = async () => {
    if (!approvalModal) return;

    try {
      setApprovingId(approvalModal);
      await api.patch(`/users/${approvalModal}/approve`);
      alert("Cart admin approved successfully!");
      setApprovalModal(null);
      setApprovalData(null);
      fetchCarts();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to approve cart admin");
    } finally {
      setApprovingId(null);
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

  const handleReject = async (cartId) => {
    // CRITICAL: window.confirm is now async, must await it
    const confirmed = await window.confirm(
      "Are you sure you want to reject this cart admin? This action cannot be undone.",
    );
    if (!confirmed) {
      return;
    }
    try {
      setApprovingId(cartId);
      await api.patch(`/users/${cartId}/reject`);
      alert("Cart admin rejected and removed.");
      fetchCarts();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to reject cart admin");
    } finally {
      setApprovingId(null);
    }
  };

  const handleToggleStatus = async (cartId) => {
    const cart = carts.find((c) => c.id === cartId);
    const newStatus = cart?.isActive ? "deactivate" : "activate";

    // CRITICAL: window.confirm is now async, must await it
    const confirmed = await window.confirm(
      `Are you sure you want to ${newStatus} this cart?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setTogglingId(cartId);
      const response = await api.patch(`/users/${cartId}/toggle-cafe-status`);
      alert(response.data.message || `Cart ${newStatus}d successfully!`);
      fetchCarts();
    } catch (error) {
      alert(error.response?.data?.message || `Failed to ${newStatus} cart`);
    } finally {
      setTogglingId(null);
    }
  };

  const filteredCarts = carts.filter((cart) => {
    const matchesSearch =
      !searchTerm ||
      cart.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.managerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cart.cartCode &&
        cart.cartCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      cart.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === "all" ||
      (filterStatus === "active" && cart.isApproved && cart.isActive) ||
      (filterStatus === "inactive" && cart.isApproved && !cart.isActive) ||
      (filterStatus === "pending" && !cart.isApproved);

    return matchesSearch && matchesFilter;
  });

  // For super admin, group carts by franchise so the panel is franchise-wise
  const groupedCarts = isSuperAdmin
    ? filteredCarts.reduce((acc, cart) => {
        const key = cart.franchiseName || "Unassigned Franchise";
        if (!acc[key]) acc[key] = [];
        acc[key].push(cart);
        return acc;
      }, {})
    : null;

  return (
    <div className="p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[#4a2e1f]">
          Cart Management
        </h1>
        <button
          onClick={() => navigate("/carts/new")}
          className="bg-[#d86d2a] hover:bg-[#c75b1a] text-white font-bold py-2 px-3 sm:px-4 rounded-lg shadow-md transition-colors text-sm sm:text-base w-full sm:w-auto"
        >
          + Register Cart
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search by cart name, owner, location, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-[#e2c1ac] bg-[#fef4ec] text-[#4a2e1f] rounded-lg py-2 px-3 sm:px-4 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a] transition-colors"
            />
          </div>
          <div className="w-full md:w-52">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-[#e2c1ac] bg-[#fef4ec] text-[#4a2e1f] rounded-lg py-2 px-3 sm:px-4 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a] transition-colors"
            >
              <option value="all">All Carts</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending Approval</option>
            </select>
          </div>
        </div>
      </div>

      {/* Carts List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-8 text-center text-[#6b4423]">
          Loading carts...
        </div>
      ) : filteredCarts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-8 text-center text-[#6b4423]">
          {searchTerm || filterStatus !== "all"
            ? "No carts match your search criteria."
            : "No carts found. Add your first cart to get started."}
        </div>
      ) : isSuperAdmin ? (
        // Super admin: show carts grouped by franchise
        <div className="space-y-6">
          {Object.entries(groupedCarts).map(
            ([franchiseName, franchiseCarts]) => (
              <div key={franchiseName} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg sm:text-xl font-semibold text-[#4a2e1f] break-words">
                    {franchiseName}
                  </h2>
                  <span className="text-xs sm:text-sm text-[#6b4423]">
                    {franchiseCarts.length} cart
                    {franchiseCarts.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {franchiseCarts.map((cart) => (
                    <div
                      key={cart.id}
                      className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-5 hover:shadow-lg hover:border-[#d86d2a] transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {/* Cart Code Badge */}
                            {cart.cartCode && (
                              <span className="px-2 py-1 text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded shadow-sm">
                                {cart.cartCode}
                              </span>
                            )}
                            <h3 className="text-lg md:text-xl font-bold text-[#4a2e1f] break-words">
                              {cart.name}
                            </h3>
                          </div>
                          <p className="text-sm text-[#6b4423] break-words">
                            {cart.location}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              cart.status === "Active"
                                ? "bg-green-100 text-green-800"
                                : cart.status === "Inactive"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {cart.status}
                          </span>
                          {cart.isApproved && (
                            <button
                              onClick={() => handleToggleStatus(cart.id)}
                              disabled={togglingId === cart.id}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                cart.isActive ? "bg-green-500" : "bg-gray-300"
                              } ${
                                togglingId === cart.id
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                              title={
                                cart.isActive
                                  ? "Deactivate Cart"
                                  : "Activate Cart"
                              }
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  cart.isActive
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                          <span className="font-medium w-20 md:w-24 flex-shrink-0">
                            Owner:
                          </span>
                          <span className="min-w-0 break-words">
                            {cart.managerName}
                          </span>
                        </div>
                        <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                          <span className="font-medium w-20 md:w-24 flex-shrink-0">
                            Email:
                          </span>
                          <span className="min-w-0 break-all">
                            {cart.email}
                          </span>
                        </div>
                        {cart.phone && (
                          <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                            <span className="font-medium w-20 md:w-24 flex-shrink-0">
                              Phone:
                            </span>
                            <span className="min-w-0 break-words">
                              {cart.phone}
                            </span>
                          </div>
                        )}
                        <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                          <span className="font-medium w-20 md:w-24 flex-shrink-0">
                            Created:
                          </span>
                          <span>
                            {new Date(cart.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-2">
                        {!cart.isApproved ? (
                          <>
                            <button
                              onClick={() => handleApproveClick(cart.id)}
                              disabled={approvingId === cart.id}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 shadow-md text-sm"
                            >
                              Review & Approve
                            </button>
                            <button
                              onClick={() => handleReject(cart.id)}
                              disabled={approvingId === cart.id}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 shadow-md text-sm"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => navigate(`/carts/${cart.id}`)}
                              className="flex-1 bg-[#d86d2a] hover:bg-[#c75b1a] text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-md text-sm"
                            >
                              View Details
                            </button>
                            <button
                              onClick={() => navigate(`/carts/${cart.id}/edit`)}
                              className="w-full md:w-auto px-4 py-2 border border-[#e2c1ac] text-[#4a2e1f] hover:bg-[#fef4ec] font-semibold rounded-lg transition-colors text-sm"
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                      {cart.isApproved && (
                        <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
                          <span>
                            Status: {cart.isActive ? "Active" : "Inactive"}
                          </span>
                          <span className="text-gray-400">
                            Toggle above to change
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      ) : (
        // Franchise admin: flat list (only their own franchise carts are visible)
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredCarts.map((cart) => (
            <div
              key={cart.id}
              className="bg-white rounded-xl shadow-md border border-[#e2c1ac] p-4 md:p-5 hover:shadow-lg hover:border-[#d86d2a] transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {/* Cart Code Badge */}
                    {cart.cartCode && (
                      <span className="px-2 py-1 text-xs font-mono font-bold bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded shadow-sm">
                        {cart.cartCode}
                      </span>
                    )}
                    <h3 className="text-lg md:text-xl font-bold text-[#4a2e1f] break-words">
                      {cart.name}
                    </h3>
                  </div>
                  <p className="text-sm text-[#6b4423] break-words">
                    {cart.location}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      cart.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : cart.status === "Inactive"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {cart.status}
                  </span>
                  {cart.isApproved && (
                    <button
                      onClick={() => handleToggleStatus(cart.id)}
                      disabled={togglingId === cart.id}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        cart.isActive ? "bg-green-500" : "bg-gray-300"
                      } ${
                        togglingId === cart.id
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      title={
                        cart.isActive ? "Deactivate Cart" : "Activate Cart"
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          cart.isActive ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                  <span className="font-medium w-20 md:w-24 flex-shrink-0">
                    Owner:
                  </span>
                  <span className="min-w-0 break-words">
                    {cart.managerName}
                  </span>
                </div>
                <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                  <span className="font-medium w-20 md:w-24 flex-shrink-0">
                    Email:
                  </span>
                  <span className="min-w-0 break-all">{cart.email}</span>
                </div>
                {cart.phone && (
                  <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                    <span className="font-medium w-20 md:w-24 flex-shrink-0">
                      Phone:
                    </span>
                    <span className="min-w-0 break-words">{cart.phone}</span>
                  </div>
                )}
                <div className="flex items-start md:items-center text-xs sm:text-sm text-gray-600">
                  <span className="font-medium w-20 md:w-24 flex-shrink-0">
                    Created:
                  </span>
                  <span>{new Date(cart.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-2">
                {!cart.isApproved ? (
                  <>
                    <button
                      onClick={() => handleApproveClick(cart.id)}
                      disabled={approvingId === cart.id}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 shadow-md text-sm"
                    >
                      Review & Approve
                    </button>
                    <button
                      onClick={() => handleReject(cart.id)}
                      disabled={approvingId === cart.id}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 shadow-md text-sm"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/carts/${cart.id}`)}
                      className="flex-1 bg-[#d86d2a] hover:bg-[#c75b1a] text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-md text-sm"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => navigate(`/carts/${cart.id}/edit`)}
                      className="w-full md:w-auto px-4 py-2 border border-[#e2c1ac] text-[#4a2e1f] hover:bg-[#fef4ec] font-semibold rounded-lg transition-colors text-sm"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
              {cart.isApproved && (
                <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500 md:flex-row md:items-center md:justify-between">
                  <span>Status: {cart.isActive ? "Active" : "Inactive"}</span>
                  <span className="text-gray-400">Toggle above to change</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-4">
          <p className="text-sm text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1">
            Showing{" "}
            <span className="font-semibold">{filteredCarts.length}</span> of{" "}
            <span className="font-semibold">{carts.length}</span> carts
            {carts.filter((c) => !c.isApproved).length > 0 && (
              <span className="text-yellow-600">
                ({carts.filter((c) => !c.isApproved).length} pending approval)
              </span>
            )}
            {carts.filter((c) => c.isApproved && !c.isActive).length > 0 && (
              <span className="text-red-600">
                ({carts.filter((c) => c.isApproved && !c.isActive).length}{" "}
                inactive)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Approval Modal */}
      {approvalModal && approvalData && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto my-auto">
            <div className="sticky top-0 bg-white border-b border-[#e2c1ac] p-4 md:p-5 flex items-start justify-between gap-3 z-10">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-[#4a2e1f] leading-tight">
                Review Cart Admin Details
              </h2>
              <button
                onClick={() => {
                  setApprovalModal(null);
                  setApprovalData(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
                aria-label="Close"
              >
                x
              </button>
            </div>

            <div className="p-4 md:p-5 space-y-5 md:space-y-6">
              {/* Basic Information */}
              <div className="border-b border-[#e2c1ac] pb-6">
                <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#6b4423] mb-1">
                      Manager Name
                    </label>
                    <p className="text-[#4a2e1f] font-medium">
                      {approvalData.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4423] mb-1">
                      Email
                    </label>
                    <p className="text-[#4a2e1f] font-medium">
                      {approvalData.email || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4423] mb-1">
                      Cart Name
                    </label>
                    <p className="text-[#4a2e1f] font-medium">
                      {approvalData.cartName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4423] mb-1">
                      Location
                    </label>
                    <p className="text-[#4a2e1f] font-medium">
                      {approvalData.location || "N/A"}
                    </p>
                  </div>
                  {approvalData.phone && (
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Phone
                      </label>
                      <p className="text-[#4a2e1f] font-medium">
                        {approvalData.phone}
                      </p>
                    </div>
                  )}
                  {approvalData.address && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Address
                      </label>
                      <p className="text-[#4a2e1f] font-medium">
                        {approvalData.address}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents Section */}
              <div className="border-b border-[#e2c1ac] pb-6">
                <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">
                  Owner Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Aadhar Card */}
                  <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                    <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                      Aadhar Card <span className="text-red-500">*</span>
                    </label>
                    {approvalData.aadharCard ? (
                      <div>
                        <a
                          href={getDocumentUrl(approvalData.aadharCard)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#d86d2a] hover:underline text-sm font-medium"
                        >
                          View Document
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600">Not uploaded</p>
                    )}
                  </div>

                  {/* PAN Card */}
                  <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                    <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                      PAN Card <span className="text-red-500">*</span>
                    </label>
                    {approvalData.panCard ? (
                      <div>
                        <a
                          href={getDocumentUrl(approvalData.panCard)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#d86d2a] hover:underline text-sm font-medium"
                        >
                          View Document
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600">Not uploaded</p>
                    )}
                  </div>

                  {/* Shop Act License */}
                  <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                    <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                      Shop Act License
                    </label>
                    {approvalData.shopActLicense ? (
                      <div className="space-y-2">
                        <a
                          href={getDocumentUrl(approvalData.shopActLicense)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#d86d2a] hover:underline text-sm font-medium block"
                        >
                          View Document
                        </a>
                        {approvalData.shopActLicenseExpiry && (
                          <p className="text-xs text-[#6b4423]">
                            Expiry:{" "}
                            {formatDate(approvalData.shopActLicenseExpiry)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Not provided</p>
                    )}
                  </div>

                  {/* FSSAI License */}
                  <div className="border border-[#e2c1ac] rounded-lg p-4 bg-[#fef4ec]">
                    <label className="block text-sm font-medium text-[#4a2e1f] mb-2">
                      FSSAI License
                    </label>
                    {approvalData.fssaiLicense ? (
                      <div className="space-y-2">
                        <a
                          href={getDocumentUrl(approvalData.fssaiLicense)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#d86d2a] hover:underline text-sm font-medium block"
                        >
                          View Document
                        </a>
                        {approvalData.fssaiLicenseExpiry && (
                          <p className="text-xs text-[#6b4423]">
                            Expiry:{" "}
                            {formatDate(approvalData.fssaiLicenseExpiry)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Not provided</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Registration Date */}
              <div className="text-sm text-[#6b4423]">
                <p>
                  <span className="font-medium">Registration Date:</span>{" "}
                  {formatDate(approvalData.createdAt)}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="sticky bottom-0 bg-white border-t border-[#e2c1ac] p-4 md:p-5 flex flex-col md:flex-row gap-2 md:gap-4 justify-end">
              <button
                onClick={() => {
                  setApprovalModal(null);
                  setApprovalData(null);
                }}
                className="w-full md:w-auto px-6 py-2.5 md:py-2 border border-[#e2c1ac] text-[#4a2e1f] rounded-lg hover:bg-[#fef4ec] font-semibold transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(approvalModal)}
                disabled={approvingId === approvalModal}
                className="w-full md:w-auto px-6 py-2.5 md:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 text-sm md:text-base"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={approvingId === approvalModal}
                className="w-full md:w-auto px-6 py-2.5 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 text-sm md:text-base"
              >
                {approvingId === approvalModal
                  ? "Approving..."
                  : "Approve Cart Admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Carts;
