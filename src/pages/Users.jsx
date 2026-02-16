import React, { useState, useEffect } from "react";
import {
  FaUsers,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSpinner,
  FaSearch,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { confirm } from "../utils/confirm";
import { useNavigate } from "react-router-dom";

const Users = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [togglingStatus, setTogglingStatus] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [bulkSelectionUpdating, setBulkSelectionUpdating] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState("");
  const [bulkPersona, setBulkPersona] = useState("franchise_admin");
  const [filterStatus, setFilterStatus] = useState("all"); // "all", "active", "inactive"
  const [viewMode, setViewMode] = useState("list"); // "list", "tile"
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "super_admin", // Default role for super admin user creation
    franchiseId: "",
    cartName: "",
    location: "",
    phone: "",
    address: "",
  });

  const isSuperAdmin = currentUser?.role === "super_admin";
  const ACCESS_MANAGED_ROLES = new Set([
    "franchise_admin",
    "admin",
    "cart_admin",
    "employee",
    "manager",
    "captain",
    "waiter",
    "cook",
  ]);

  // Get allowed roles based on current user's hierarchy
  // Note: manager, cook, waiter, and captain roles cannot be created through this form
  // They should be created through the Employee Management system
  const getAllowedRoles = () => {
    if (!currentUser) return [];

    const userRole = currentUser.role;

    if (userRole === "super_admin") {
      // Super Admin can create: super_admin only
      // Note: franchise_admin role is intentionally NOT creatable via this form
      // to keep franchise creation controlled and separate.
      // Note: cart_admin role is intentionally NOT creatable via this form
      // to keep cart creation controlled through franchise admin.
      return [{ value: "super_admin", label: "Super Admin" }];
    } else if (userRole === "franchise_admin") {
      // Franchise Admin can create: cart_admin only
      // Excluded: manager, captain, waiter, cook (these should be created via Employee Management)
      return [{ value: "cart_admin", label: "Cart Admin" }];
    } else if (userRole === "admin" || userRole === "cart_admin") {
      // Cart Admin cannot create any roles through this form
      // All employee roles (manager, captain, waiter, cook) should be created via Employee Management
      return [];
    }

    return [];
  };

  useEffect(() => {
    // Default to tile view on mobile/tablet for better responsiveness
    if (window.innerWidth < 768) {
      setViewMode("tile");
    }
    fetchUsers();
    fetchFranchises();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/users");
      // Administrative Users page should not display super admin accounts.
      const nonSuperAdminUsers = (response.data || []).filter(
        (u) => u?.role !== "super_admin"
      );
      setUsers(nonSuperAdminUsers);
      setSelectedUserIds(new Set());
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchFranchises = async () => {
    try {
      const response = await api.get("/users");
      const franchiseList = (response.data || []).filter(
        (user) => user.role === "franchise_admin"
      );
      setFranchises(franchiseList);
    } catch (error) {
      console.error("Error fetching franchises:", error);
    }
  };

  const canManageAccess = (user) => {
    const role = String(user?.role || "").toLowerCase();
    return ACCESS_MANAGED_ROLES.has(role);
  };

  const isUserOwnActive = (user) => user?.isActive !== false;

  const applyAccessStateToUser = async (user, nextIsActive) => {
    if (!canManageAccess(user)) {
      return {
        success: false,
        message: "Access toggle is not allowed for this role",
      };
    }

    const ownActive = isUserOwnActive(user);
    if (ownActive === nextIsActive) {
      return { success: true, skipped: true };
    }

    if (user.role === "franchise_admin") {
      await api.patch(`/users/${user._id}/toggle-status`);
      return { success: true };
    }

    if (user.role === "admin" || user.role === "cart_admin") {
      if (nextIsActive && user.franchiseActive === false) {
        return {
          success: false,
          message:
            "Cannot activate cart access while franchise is inactive. Activate franchise first.",
        };
      }
      await api.patch(`/users/${user._id}/toggle-cafe-status`);
      return { success: true };
    }

    if (!isSuperAdmin) {
      return {
        success: false,
        message: "Only Super Admin can change employee access",
      };
    }

    await api.put(`/users/${user._id}`, { isActive: nextIsActive });
    return { success: true };
  };

  const handleToggleStatus = async (user) => {
    if (!canManageAccess(user)) {
      alert(
        "Access toggle is only available for administrative and employee personas"
      );
      return;
    }

    const isCurrentlyActive = isUserOwnActive(user);
    const nextIsActive = !isCurrentlyActive;
    const roleLabel = getRoleLabel(user.role);

    let confirmMessage = `Are you sure you want to ${
      nextIsActive ? "ACTIVATE" : "DEACTIVATE"
    } access for ${roleLabel}?`;

    if (user.role === "franchise_admin") {
      confirmMessage += `\n\n${
        nextIsActive
          ? "All carts under this franchise will also be activated."
          : "All carts under this franchise will also be deactivated."
      }`;
    } else if (user.role === "admin" || user.role === "cart_admin") {
      confirmMessage += "\n\nThis will change cart panel access.";
    } else {
      confirmMessage += "\n\nThis will change staff panel access.";
    }

    const confirmed = await window.confirm(confirmMessage);
    if (!confirmed) return;

    try {
      setTogglingStatus(user._id);
      const result = await applyAccessStateToUser(user, nextIsActive);
      if (!result.success) {
        alert(result.message || "Failed to update access");
        return;
      }
      alert(`Access ${nextIsActive ? "activated" : "deactivated"} successfully`);
      fetchUsers();
    } catch (error) {
      console.error("Error toggling status:", error);
      alert(error.response?.data?.message || "Failed to toggle status");
    } finally {
      setTogglingStatus(null);
    }
  };

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds(new Set());
  };

  const handleBulkSelectedAccess = async (nextIsActive) => {
    const selectedTargets = users.filter(
      (u) => selectedUserIds.has(u._id) && canManageAccess(u)
    );
    if (selectedTargets.length === 0) {
      alert("Please select at least one user");
      return;
    }

    const confirmed = await confirm(
      `Are you sure you want to ${
        nextIsActive ? "ACTIVATE" : "DEACTIVATE"
      } access for ${selectedTargets.length} selected user(s)?`,
      {
        title: `${nextIsActive ? "Activate" : "Deactivate"} Selected Users`,
        warningMessage: "This will update access for all selected users.",
        confirmText: nextIsActive ? "Activate Selected" : "Deactivate Selected",
        cancelText: "Cancel",
        danger: !nextIsActive,
      }
    );
    if (!confirmed) return;

    try {
      setBulkSelectionUpdating(nextIsActive ? "activate" : "deactivate");
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      for (const user of selectedTargets) {
        try {
          const result = await applyAccessStateToUser(user, nextIsActive);
          if (result.success) {
            if (result.skipped) {
              skipped += 1;
            } else {
              updated += 1;
            }
          } else {
            failed += 1;
          }
        } catch (_err) {
          failed += 1;
        }
      }

      alert(
        `Bulk access update completed.\n\nUpdated: ${updated}\nSkipped: ${skipped}\nFailed: ${failed}`
      );
      clearSelectedUsers();
      fetchUsers();
    } catch (error) {
      console.error("Error updating selected users:", error);
      alert(error.response?.data?.message || "Failed to update selected users");
    } finally {
      setBulkSelectionUpdating("");
    }
  };

  const handleBulkAdministrativeStatus = async (nextIsActive) => {
    if (!isSuperAdmin) return;

    const personaLabel =
      bulkPersona === "franchise_admin" ? "Franchise Admins" : "Cart Admins";
    const targetCount = users.filter((u) =>
      bulkPersona === "franchise_admin"
        ? u.role === "franchise_admin"
        : u.role === "admin" || u.role === "cart_admin"
    ).length;

    if (targetCount === 0) {
      alert(`No ${personaLabel.toLowerCase()} found.`);
      return;
    }

    const confirmed = await confirm(
      `Are you sure you want to ${
        nextIsActive ? "ACTIVATE" : "DEACTIVATE"
      } all ${personaLabel}?\n\nAffected users: ${targetCount}`,
      {
        title: `${nextIsActive ? "Activate" : "Deactivate"} ${personaLabel}`,
        warningMessage: `This will update all ${personaLabel.toLowerCase()} at once.`,
        confirmText: nextIsActive ? "Activate All" : "Deactivate All",
        cancelText: "Cancel",
        danger: !nextIsActive,
      }
    );
    if (!confirmed) return;

    try {
      setBulkUpdating(nextIsActive ? "activate" : "deactivate");
      const response = await api.patch("/users/bulk-status", {
        persona: bulkPersona,
        isActive: nextIsActive,
      });

      const data = response?.data?.data || {};
      const detailLines =
        bulkPersona === "franchise_admin"
          ? `Franchises updated: ${data.updatedFranchises || 0}\nCarts updated: ${
              data.updatedCarts || 0
            }`
          : `Carts updated: ${data.updatedCarts || 0}${
              data.skippedCarts
                ? `\nSkipped (inactive franchise): ${data.skippedCarts}`
                : ""
            }`;

      alert(
        `${response?.data?.message || "Bulk status updated successfully"}\n\n${detailLines}`
      );
      fetchUsers();
    } catch (error) {
      console.error("Error updating bulk status:", error);
      alert(error.response?.data?.message || "Failed to update bulk status");
    } finally {
      setBulkUpdating("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update user
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }

        // ALWAYS delete role field since there is no role selector in the form
        // Role changes should not be allowed through this basic user edit form
        delete updateData.role;

        // Only super admin is allowed to change ownership fields
        if (!isSuperAdmin || editingUser.role === "super_admin") {
          delete updateData.franchiseId;
          delete updateData.cartName;
          delete updateData.location;
          delete updateData.phone;
          delete updateData.address;
        } else {
          // For super admin editing non-super_admin users:
          // Convert empty strings to null for ObjectId fields
          // Backend expects null/undefined, not empty strings
          if (updateData.franchiseId === "") {
            updateData.franchiseId = null;
          }
        }

        await api.put(`/users/${editingUser._id}`, updateData);
        alert("User updated successfully");
      } else {
        // Create user - always create as super_admin (role selector removed from UI)
        // For super admin panel, all new users are created as super_admin
        // Validate required fields
        if (!formData.name?.trim()) {
          alert("Name is required");
          return;
        }
        if (!formData.email?.trim()) {
          alert("Email is required");
          return;
        }
        if (!formData.password || formData.password.length < 6) {
          alert("Password is required and must be at least 6 characters");
          return;
        }

        // Create super_admin user
        const userData = {
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: "super_admin", // Always set to super_admin
        };

        await api.post("/users", userData);
        alert("Super admin user created successfully");

        // Close modal and reset form
        setShowModal(false);
        setEditingUser(null);
        setFormData({
          name: "",
          email: "",
          password: "",
          role: "super_admin", // Default role for super admin user creation
          franchiseId: "",
          cartName: "",
          location: "",
          phone: "",
          address: "",
        });
        fetchUsers();
        fetchFranchises();
      }
    } catch (error) {
      console.error("Error saving user:", error);
      console.error("Error response:", error.response?.data);
      alert(error.response?.data?.message || "Failed to save user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      franchiseId: user.franchiseId || "",
      cartName: user.cartName || "",
      location: user.location || "",
      phone: user.phone || "",
      address: user.address || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (e, userId) => {
    e.preventDefault();
    e.stopPropagation();

    // Find the user to check their role
    const userToDelete = users.find((u) => u._id === userId);

    // Prevent deleting super admin users
    if (userToDelete && userToDelete.role === "super_admin") {
      alert("Super admin users cannot be deleted");
      return;
    }

    // Role check removed to allow cleaning up orphaned users


    const userName = userToDelete?.name || "this user";
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE "${userName}"?\n\nThis action cannot be undone.`,
      {
        title: "Delete User",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    try {
      await api.delete(`/users/${userId}`);
      alert("User deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const filteredUsers = users.filter((user) => {
    // Search filter
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    let isEffectivelyActive;
    if (
      (user.role === "admin" || user.role === "cart_admin") &&
      user.effectivelyActive !== undefined
    ) {
      isEffectivelyActive = user.effectivelyActive;
    } else {
      isEffectivelyActive = user.isActive !== false;
    }

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && isEffectivelyActive) ||
      (filterStatus === "inactive" && !isEffectivelyActive);

    return matchesSearch && matchesStatus;
  });
  const selectableFilteredUsers = filteredUsers.filter((user) =>
    canManageAccess(user)
  );
  const selectedCount = selectedUserIds.size;
  const allVisibleSelected =
    selectableFilteredUsers.length > 0 &&
    selectableFilteredUsers.every((user) => selectedUserIds.has(user._id));
  const anyVisibleSelectable = selectableFilteredUsers.length > 0;

  const toggleSelectAllVisible = () => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        selectableFilteredUsers.forEach((user) => next.delete(user._id));
      } else {
        selectableFilteredUsers.forEach((user) => next.add(user._id));
      }
      return next;
    });
  };

  // Calculate stats
  const totalUsers = users.length;
  const activeUsers = users.filter((user) => {
    if (
      (user.role === "admin" || user.role === "cart_admin") &&
      user.effectivelyActive !== undefined
    ) {
      return user.effectivelyActive;
    }
    return user.isActive !== false;
  }).length;
  const inactiveUsers = totalUsers - activeUsers;
  const bulkTargetCount = users.filter((u) =>
    bulkPersona === "franchise_admin"
      ? u.role === "franchise_admin"
      : u.role === "admin" || u.role === "cart_admin"
  ).length;

  const roleColors = {
    super_admin: "bg-purple-100 text-purple-800",
    franchise_admin: "bg-blue-100 text-blue-800",
    admin: "bg-green-100 text-green-800",
    cart_admin: "bg-green-100 text-green-800",
    manager: "bg-indigo-100 text-indigo-800",
    captain: "bg-teal-100 text-teal-800",
    waiter: "bg-yellow-100 text-yellow-800",
    cook: "bg-orange-100 text-orange-800",
    employee: "bg-yellow-100 text-yellow-800",
    customer: "bg-gray-100 text-gray-800",
  };

  const getRoleLabel = (role) => {
    const labels = {
      super_admin: "Super Admin",
      franchise_admin: "Franchise Admin",
      admin: "Cart Admin",
      cart_admin: "Cart Admin",
      manager: "Manager",
      captain: "Captain",
      waiter: "Waiter",
      cook: "Cook",
      employee: "Employee",
      customer: "Customer",
    };
    return labels[role] || role;
  };

  const getStatusBadge = (user) => {
    // For cart admins, use effectivelyActive which considers franchise status
    // For other users, use isActive directly
    let isEffectivelyActive;
    let statusLabel;
    let extraInfo = "";

    if (
      (user.role === "admin" || user.role === "cart_admin") &&
      user.effectivelyActive !== undefined
    ) {
      isEffectivelyActive = user.effectivelyActive;
      // Check if inactive due to franchise being inactive
      if (
        !isEffectivelyActive &&
        user.isActive !== false &&
        user.franchiseActive === false
      ) {
        extraInfo = " (Franchise Inactive)";
      }
    } else {
      isEffectivelyActive = user.isActive !== false;
    }

    statusLabel = isEffectivelyActive ? "Active" : "Inactive";

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          isEffectivelyActive
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}
        title={extraInfo ? `Cart's own status is Active, but${extraInfo}` : ""}
      >
        {statusLabel}
        {extraInfo && <span className="text-red-600">{extraInfo}</span>}
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
            Users
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 sm:mt-2">
            Manage all system users
          </p>
        </div>
        {/* Hide Add New User button for Super Admin */}
        {!isSuperAdmin && (
          <button
            onClick={() => {
              setEditingUser(null);
              setFormData({
                name: "",
                email: "",
                password: "",
                role: "super_admin", // Default role for super admin user creation
                franchiseId: "",
                cartName: "",
                location: "",
                phone: "",
                address: "",
              });
              setShowModal(true);
            }}
            className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
          >
            <FaPlus className="mr-1.5 sm:mr-2" />
            <span className="whitespace-nowrap">Add New User</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <button
          onClick={() => setFilterStatus("all")}
          className={`bg-white rounded-lg shadow p-3 sm:p-4 transition-all hover:shadow-md cursor-pointer text-left ${
            filterStatus === "all"
              ? "ring-2 ring-blue-500 border-2 border-blue-500"
              : ""
          }`}
        >
          <p className="text-xs sm:text-sm text-gray-500">Total Users</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-800">
            {totalUsers}
          </p>
        </button>
        <button
          onClick={() => setFilterStatus("active")}
          className={`bg-white rounded-lg shadow p-3 sm:p-4 transition-all hover:shadow-md cursor-pointer text-left ${
            filterStatus === "active"
              ? "ring-2 ring-green-500 border-2 border-green-500"
              : ""
          }`}
        >
          <p className="text-xs sm:text-sm text-gray-500">Active</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {activeUsers}
          </p>
        </button>
        <button
          onClick={() => setFilterStatus("inactive")}
          className={`bg-white rounded-lg shadow p-3 sm:p-4 transition-all hover:shadow-md cursor-pointer text-left ${
            filterStatus === "inactive"
              ? "ring-2 ring-red-500 border-2 border-red-500"
              : ""
          }`}
        >
          <p className="text-xs sm:text-sm text-gray-500">Inactive</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">
            {inactiveUsers}
          </p>
        </button>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Franchises</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {users.filter((u) => u.role === "franchise_admin").length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
        <div className="mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FaSearch className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm sm:text-base" />
              <input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded transition-colors ${
                  viewMode === "list"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                title="List View"
              >
                List
              </button>
              <button
                onClick={() => setViewMode("tile")}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded transition-colors ${
                  viewMode === "tile"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                title="Tile View"
              >
                Tile
              </button>
            </div>
          </div>
        </div>

        <div className="mb-3 sm:mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-3">
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-900">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                disabled={!anyVisibleSelectable || !!bulkSelectionUpdating}
                onChange={toggleSelectAllVisible}
                className="w-4 h-4"
              />
              Select all visible
            </label>
            <span className="text-xs sm:text-sm text-blue-800">
              Selected: {selectedCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkSelectedAccess(true)}
                disabled={selectedCount === 0 || !!bulkSelectionUpdating}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-md text-white transition-colors ${
                  selectedCount === 0 || bulkSelectionUpdating
                    ? "bg-green-300 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {bulkSelectionUpdating === "activate"
                  ? "Activating..."
                  : "Activate Selected"}
              </button>
              <button
                onClick={() => handleBulkSelectedAccess(false)}
                disabled={selectedCount === 0 || !!bulkSelectionUpdating}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-md text-white transition-colors ${
                  selectedCount === 0 || bulkSelectionUpdating
                    ? "bg-red-300 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {bulkSelectionUpdating === "deactivate"
                  ? "Deactivating..."
                  : "Deactivate Selected"}
              </button>
              <button
                onClick={clearSelectedUsers}
                disabled={selectedCount === 0 || !!bulkSelectionUpdating}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                  selectedCount === 0 || bulkSelectionUpdating
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                }`}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <FaSpinner className="animate-spin text-gray-400 text-3xl" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaUsers className="mx-auto text-4xl mb-4 text-gray-300" />
            <p>No users found</p>
          </div>
        ) : viewMode === "tile" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredUsers.map((user) => {
              let isEffectivelyActive;
              if (
                (user.role === "admin" || user.role === "cart_admin") &&
                user.effectivelyActive !== undefined
              ) {
                isEffectivelyActive = user.effectivelyActive;
              } else {
                isEffectivelyActive = user.isActive !== false;
              }
              const isOwnActive = isUserOwnActive(user);
              const isSelected = selectedUserIds.has(user._id);

              return (
                <div
                  key={user._id}
                  className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-all p-3 sm:p-4 ${
                    !isEffectivelyActive
                      ? "opacity-75 border-gray-300"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 text-sm mb-1 truncate">
                        {user.name}
                      </h3>
                      {(user.cartName || user.cafeName) && (
                        <p className="text-xs text-gray-500 truncate mb-1">
                          Cart: {user.cartName || user.cafeName}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 truncate">
                        {user.email}
                      </p>
                    </div>
                    {getStatusBadge(user)}
                  </div>

                  <div className="mb-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        roleColors[user.role] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {canManageAccess(user) && (
                      <label
                        className="px-1.5 py-1.5 text-xs rounded border border-gray-300 bg-white cursor-pointer"
                        title="Select user"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectUser(user._id)}
                          className="w-3.5 h-3.5"
                        />
                      </label>
                    )}
                    <button
                      onClick={() => handleEdit(user)}
                      className="flex-1 px-2 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <FaEdit size={12} className="inline mr-1" />
                      Edit
                    </button>
                    {canManageAccess(user) && (
                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={togglingStatus === user._id}
                        className={`px-2 py-1.5 text-xs rounded transition-colors ${
                          isOwnActive
                            ? "text-green-600 hover:bg-green-50"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                        title={isOwnActive ? "Deactivate Access" : "Activate Access"}
                      >
                        {togglingStatus === user._id ? (
                          <FaSpinner className="animate-spin" size={12} />
                        ) : isOwnActive ? (
                          <FaToggleOn size={14} />
                        ) : (
                          <FaToggleOff size={14} />
                        )}
                      </button>
                    )}
                    {user.role !== "super_admin" && (
                        <button
                          onClick={(e) => handleDelete(e, user._id)}
                          className="px-2 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <FaTrash size={12} />
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-3 sm:px-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        disabled={!anyVisibleSelectable || !!bulkSelectionUpdating}
                        onChange={toggleSelectAllVisible}
                        className="w-4 h-4"
                        title="Select all visible users"
                      />
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">
                      Name
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">
                      Email
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">
                      Role
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">
                      Status
                    </th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm hidden md:table-cell">
                      Created
                    </th>
                    <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isOwnActive = isUserOwnActive(user);
                    const isSelected = selectedUserIds.has(user._id);

                    return (
                      <tr
                        key={user._id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          {canManageAccess(user) && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectUser(user._id)}
                              className="w-4 h-4"
                              title="Select user"
                            />
                          )}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <div>
                            <p className="font-medium text-xs sm:text-sm">
                              {user.name}
                            </p>
                            {user.cartName && (
                              <p className="text-[10px] sm:text-xs text-gray-500">
                                Cart: {user.cartName}
                              </p>
                            )}
                            {user.cafeName && !user.cartName && (
                              <p className="text-[10px] sm:text-xs text-gray-500">
                                Cart: {user.cafeName}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                          {user.email}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                              roleColors[user.role] || roleColors.customer
                            }`}
                          >
                            {getRoleLabel(user.role)}
                          </span>
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          {getStatusBadge(user)}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-500 text-xs sm:text-sm hidden md:table-cell">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                          <div className="flex justify-end space-x-1 sm:space-x-2">
                            {canManageAccess(user) && (
                              <button
                                onClick={() => handleToggleStatus(user)}
                                disabled={togglingStatus === user._id}
                                className={`p-2 rounded transition-colors ${
                                  isOwnActive
                                    ? "text-green-600 hover:bg-green-50"
                                    : "text-red-600 hover:bg-red-50"
                                } ${
                                  togglingStatus === user._id
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                                title={
                                  isOwnActive
                                    ? "Click to Deactivate Access"
                                    : "Click to Activate Access"
                                }
                              >
                                {togglingStatus === user._id ? (
                                  <FaSpinner className="animate-spin text-sm sm:text-base" />
                                ) : isOwnActive ? (
                                  <FaToggleOn className="text-base sm:text-xl" />
                                ) : (
                                  <FaToggleOff className="text-base sm:text-xl" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(user)}
                              className="p-1 sm:p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <FaEdit className="text-sm sm:text-base" />
                            </button>
                            {user.role !== "super_admin" && (
                              <button
                                type="button"
                                onClick={(e) => handleDelete(e, user._id)}
                                className="p-1 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <FaTrash className="text-sm sm:text-base" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl my-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                {editingUser ? "Edit User" : "Create New User"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                  setFormData({
                    name: "",
                    email: "",
                    password: "",
                    role: "",
                    franchiseId: "",
                    cartName: "",
                    location: "",
                    phone: "",
                    address: "",
                  });
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {editingUser && "(leave blank to keep current)"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {/* Role selector removed - super admin users are created with "super_admin" role by default */}

              {/* Cart Admin specific fields removed - not applicable for super admin user creation */}
              {false &&
                !editingUser &&
                (formData.role === "admin" ||
                  formData.role === "cart_admin") && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Franchise <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.franchiseId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            franchiseId: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a franchise</option>
                        {franchises.map((franchise) => (
                          <option key={franchise._id} value={franchise._id}>
                            {franchise.name}{" "}
                            {franchise.franchiseCode
                              ? `(${franchise.franchiseCode})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Cart Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.cartName}
                        onChange={(e) =>
                          setFormData({ ...formData, cartName: e.target.value })
                        }
                        placeholder="e.g., Downtown Cart"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.location}
                        onChange={(e) =>
                          setFormData({ ...formData, location: e.target.value })
                        }
                        placeholder="e.g., Mumbai, Maharashtra"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="e.g., +91 9876543210"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Address
                      </label>
                      <textarea
                        value={formData.address}
                        onChange={(e) =>
                          setFormData({ ...formData, address: e.target.value })
                        }
                        placeholder="Full address of the cart"
                        rows="3"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-gray-200 mt-4 sm:mt-6">
                <button
                  type="submit"
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
                >
                  {editingUser ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    setFormData({
                      name: "",
                      email: "",
                      password: "",
                      role: "",
                      franchiseId: "",
                      cartName: "",
                      location: "",
                      phone: "",
                      address: "",
                    });
                  }}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors text-sm sm:text-base font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;

