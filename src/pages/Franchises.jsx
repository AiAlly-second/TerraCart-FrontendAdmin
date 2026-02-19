import React, { useState, useEffect } from "react";
import {
  FaBuilding,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSpinner,
  FaSearch,
  FaToggleOn,
  FaToggleOff,
  FaChevronDown,
  FaChevronRight,
  FaStore,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaEnvelope,
  FaPhone,
  FaIdCard,
  FaCalendarAlt,
  FaEye,
  FaTimes,
  FaUsers,
  FaFilter,
} from "react-icons/fa";
import api from "../utils/api";
import { confirmFranchiseDelete, confirm } from "../utils/confirm";

const Franchises = () => {
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState(null);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [franchiseCarts, setFranchiseCarts] = useState({});
  const [loadingCarts, setLoadingCarts] = useState({});
  const [viewDetails, setViewDetails] = useState(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedFranchiseForCart, setSelectedFranchiseForCart] =
    useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    mobile: "",
    gstNumber: "",
  });
  const [files, setFiles] = useState({
    udyamCertificate: null,
    aadharCard: null,
    panCard: null,
  });
  const [documentExpiryDates, setDocumentExpiryDates] = useState({
    udyamCertificateExpiry: "",
    aadharCardExpiry: "",
    panCardExpiry: "",
  });
  const [cartFormData, setCartFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    cartName: "",
    location: "",
    phone: "",
    address: "",
    fssaiNumber: "",
    shopActLicenseExpiry: "",
    fssaiLicenseExpiry: "",
  });
  const [cartFiles, setCartFiles] = useState({
    aadharCard: null,
    panCard: null,
    shopActLicense: null,
    fssaiLicense: null,
  });
  const [cartFormError, setCartFormError] = useState(null);
  const [cartFormErrors, setCartFormErrors] = useState({});
  const [isSubmittingCart, setIsSubmittingCart] = useState(false);
  const [editingCart, setEditingCart] = useState(null);
  const [cartExistingDocs, setCartExistingDocs] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all"); // "all", "active", "inactive"
  const [viewMode, setViewMode] = useState("list"); // "list", "tile"
  
  // Sorting state
  const [sortField, setSortField] = useState("name"); // "name", "email", "createdAt", "status", "carts"
  const [sortDirection, setSortDirection] = useState("asc"); // "asc", "desc"
  
  // Bulk selection state
  const [selectedFranchises, setSelectedFranchises] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    fetchFranchises();
  }, []);

  const fetchFranchises = async () => {
    try {
      setLoading(true);
      const response = await api.get("/users");
      const allUsers = response.data || [];
      const franchiseUsers = allUsers.filter(
        (u) => u.role === "franchise_admin"
      );
      setFranchises(franchiseUsers);

      try {
        // Always fetch fresh cart statistics from API
        const cartStatsResponse = await api.get("/users/stats/carts");
        const cartStats = cartStatsResponse.data || {};
        if (cartStats.franchiseStats) {
          const statsMap = {};
          cartStats.franchiseStats.forEach((stat) => {
            const franchiseId =
              stat.franchiseId?.toString() || stat.franchiseId;
            // Preserve existing carts if they exist (for expanded franchises)
            // But always update the stats from API
            const existingCarts = franchiseCarts[franchiseId]?.carts || null;

            statsMap[franchiseId] = {
              // Always use fresh stats from API
              totalCarts: stat.totalCarts || 0,
              activeCarts: stat.activeCarts || 0,
              inactiveCarts: stat.inactiveCarts || 0,
              pendingApproval: stat.pendingApproval || 0,
              // Preserve carts if they exist, otherwise let them be fetched fresh
              ...(existingCarts ? { carts: existingCarts } : {}),
            };
          });
          setFranchiseCarts(statsMap);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Error fetching cart statistics:", err);
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching franchises:", error);
      }
      alert("Failed to fetch franchises");
    } finally {
      setLoading(false);
    }
  };

  const fetchCartsForFranchise = async (franchiseId, forceRefresh = false) => {
    // Only skip if carts are already loaded and we're not forcing a refresh
    if (!forceRefresh && franchiseCarts[franchiseId]?.carts) {
      return;
    }

    try {
      setLoadingCarts((prev) => ({ ...prev, [franchiseId]: true }));
      // Always fetch fresh data from API
      const response = await api.get("/users");
      const allUsers = response.data || [];

      // Normalize franchiseId for comparison - handle both string and ObjectId formats
      const targetFranchiseId = franchiseId?.toString() || franchiseId;

      // Filter carts that belong to this franchise
      const carts = allUsers.filter((u) => {
        // Must be a cart (admin role)
        if (u.role !== "admin") {
          return false;
        }

        // Must have a franchiseId
        if (!u.franchiseId) {
          console.warn(
            `[Franchises] Cart ${u._id} (${
              u.cartName || u.name
            }) has no franchiseId`
          );
          return false;
        }

        // Handle different franchiseId formats: ObjectId, string, or populated object
        let cartFranchiseId = u.franchiseId;
        if (cartFranchiseId && typeof cartFranchiseId === "object") {
          // If it's an object, extract the _id if it exists, otherwise use the object itself
          cartFranchiseId = cartFranchiseId._id || cartFranchiseId;
        }

        // Convert to string for comparison
        const cartFranchiseIdStr =
          cartFranchiseId?.toString() || String(cartFranchiseId);
        const matches = cartFranchiseIdStr === targetFranchiseId;

        if (!matches && u.franchiseId && import.meta.env.DEV) {
          // Log mismatches for troubleshooting (development only)
          const debugCartFranchiseId =
            typeof u.franchiseId === "object"
              ? u.franchiseId._id?.toString() || u.franchiseId.toString()
              : u.franchiseId.toString();
          console.debug(
            `[Franchises] Cart ${u._id} franchiseId mismatch: ` +
              `cart=${debugCartFranchiseId}, target=${targetFranchiseId}`
          );
        }

        return matches;
      });

      if (import.meta.env.DEV) {
        console.log(
          `[Franchises] Fetched ${carts.length} carts for franchise ${franchiseId} ` +
            `(from ${
              allUsers.filter((u) => u.role === "admin").length
            } total carts)`
        );

        if (carts.length === 0) {
          console.warn(
            `[Franchises] No carts found for franchise ${franchiseId}. ` +
              `This might indicate a data issue or the franchise has no carts yet.`
          );
        }
      }

      // Calculate cart stats from fetched carts
      const totalCarts = carts.length;
      const activeCarts = carts.filter(
        (c) => c.isActive !== false && c.isApproved === true
      ).length;
      const inactiveCarts = carts.filter(
        (c) => c.isActive === false || c.isApproved !== true
      ).length;
      const pendingApproval = carts.filter(
        (c) => c.isApproved === false
      ).length;

      setFranchiseCarts((prev) => ({
        ...prev,
        [franchiseId]: {
          ...prev[franchiseId],
          carts: carts,
          totalCarts: totalCarts,
          activeCarts: activeCarts,
          inactiveCarts: inactiveCarts,
          pendingApproval: pendingApproval,
        },
      }));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching carts:", error);
      }
      alert("Failed to fetch carts. Please try again.");
    } finally {
      setLoadingCarts((prev) => ({ ...prev, [franchiseId]: false }));
    }
  };

  const toggleFranchiseExpand = async (franchiseId) => {
    const newExpanded = new Set(expandedFranchises);
    if (newExpanded.has(franchiseId)) {
      newExpanded.delete(franchiseId);
    } else {
      newExpanded.add(franchiseId);
      // Force refresh to get latest carts
      await fetchCartsForFranchise(franchiseId, true);
    }
    setExpandedFranchises(newExpanded);
  };

  const handleToggleCartStatus = async (cartId, currentStatus) => {
    // Find the cart to get its name and approval status
    let cartName = "this cart";
    let cartIsApproved = true;
    for (const franchise of franchises) {
      const carts = franchiseCarts[franchise._id]?.carts || [];
      const cart = carts.find((c) => c._id === cartId);
      if (cart) {
        cartName = cart.cartName || cart.name || "this cart";
        cartIsApproved = cart.isApproved !== false;
        break;
      }
    }

    // If cart is not approved, this is an approval action
    if (!cartIsApproved) {
      try {
        const { confirm } = await import("../utils/confirm");
        const confirmed = await confirm(
          `Are you sure you want to APPROVE cart "${cartName}"?\n\n✅ This will approve the cart and activate it.\n\nThe cart will be able to accept new orders.`,
          {
            title: "Approve Cart",
            warningMessage: "Cart Approval",
            danger: false,
            confirmText: "Approve",
            cancelText: "Cancel",
          }
        );

        if (!confirmed) return;
      } catch (error) {
        if (error.response?.status !== 400) {
          console.error("Error in confirmation:", error);
        }
        return;
      }
    } else {
      // Cart is approved, this is a toggle status action
      const isCurrentlyActive = currentStatus !== false;
      const action = isCurrentlyActive ? "DEACTIVATE" : "ACTIVATE";

      try {
        const { confirm } = await import("../utils/confirm");
        const confirmed = await confirm(
          `Are you sure you want to ${action} cart "${cartName}"?\n\n${
            isCurrentlyActive
              ? "⚠️ This will prevent the cart from accepting new orders."
              : "✅ The cart will be able to accept new orders again."
          }`,
          {
            title: `${action} Cart`,
            warningMessage: isCurrentlyActive
              ? "WARNING: DEACTIVATION"
              : "Activation",
            danger: isCurrentlyActive,
            confirmText: action,
            cancelText: "Cancel",
          }
        );

        if (!confirmed) return;
      } catch (error) {
        if (error.response?.status !== 400) {
          console.error("Error in confirmation:", error);
        }
        return;
      }
    }

    try {
      const response = await api.patch(`/users/${cartId}/toggle-cafe-status`);
      if (response.data?.success) {
        alert(response.data.message || "Cart status updated successfully");
        const franchise = franchises.find((f) =>
          franchiseCarts[f._id]?.carts?.some((c) => c._id === cartId)
        );
        if (franchise) {
          const franchiseId = franchise._id?.toString() || franchise._id;

          // Collapse the franchise dropdown to force refresh on next expand
          const newExpanded = new Set(expandedFranchises);
          newExpanded.delete(franchiseId);
          setExpandedFranchises(newExpanded);

          // Clear cached carts and reset stats temporarily for immediate UI update
          setFranchiseCarts((prev) => {
            const updated = { ...prev };
            if (updated[franchiseId]) {
              delete updated[franchiseId].carts;
            }
            return updated;
          });

          // Refresh franchises and stats
          await fetchFranchises();
        } else {
          // If franchise not found, just refresh everything
          await fetchFranchises();
        }
      } else {
        alert(response.data?.message || "Failed to update cart status");
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error toggling cart status:", error);
      }
      if (error.response?.status !== 400) {
        // Don't show alert if user cancelled
        const errorMessage =
          error.response?.data?.message ||
          error.message ||
          "Failed to update cart status";
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  const handleEditCart = async (cart) => {
    try {
      // Fetch full cart details
      const response = await api.get(`/users/${cart._id}`);
      const cartData = response.data;

      // Format expiry dates for date inputs (YYYY-MM-DD format)
      const formatDateForInput = (date) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toISOString().split("T")[0];
      };

      setEditingCart(cartData);
      setSelectedFranchiseForCart(
        franchises.find((f) => f._id === cartData.franchiseId) ||
          selectedFranchiseForCart
      );
      setCartFormData({
        name: cartData.name || "",
        email: cartData.email || "",
        password: "", // Don't pre-fill password
        confirmPassword: "",
        cartName: cartData.cartName || cartData.cafeName || "",
        location: cartData.location || "",
        phone: cartData.phone || "",
        address: cartData.address || "",
        fssaiNumber: cartData.fssaiNumber || cartData.gstNumber || "", // Prefer new field, fallback to old
        shopActLicenseExpiry: formatDateForInput(cartData.shopActLicenseExpiry),
        fssaiLicenseExpiry: formatDateForInput(cartData.fssaiLicenseExpiry),
      });
      setCartFiles({
        aadharCard: null,
        panCard: null,
        shopActLicense: null,
        fssaiLicense: null,
      });
      setCartExistingDocs({
        aadharCard: cartData.aadharCard || "",
        panCard: cartData.panCard || "",
        shopActLicense: cartData.shopActLicense || "",
        fssaiLicense: cartData.fssaiLicense || "",
      });
      setCartFormError(null);
      setCartFormErrors({});
      setShowCartModal(true);
    } catch (error) {
      console.error("Error fetching cart details:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to fetch cart details";
      alert(errorMessage);
    }
  };

  const handleDeleteCart = async (cartId, cartName) => {
    // Show confirmation dialog using custom confirm utility
    const confirmed = await confirm(
      `Are you sure you want to delete cart "${cartName}"?\n\nThis action cannot be undone.`,
      {
        title: "Delete Cart",
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
        requireInput: false,
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/users/${cartId}`);
      alert("Cart deleted successfully");

      // Find the franchise that owns this cart
      const franchise = franchises.find((f) =>
        franchiseCarts[f._id]?.carts?.some((c) => c._id === cartId)
      );

      if (franchise) {
        const franchiseId = franchise._id?.toString() || franchise._id;

        // Collapse the franchise dropdown to force refresh on next expand
        const newExpanded = new Set(expandedFranchises);
        newExpanded.delete(franchiseId);
        setExpandedFranchises(newExpanded);

        // Clear cached carts
        setFranchiseCarts((prev) => {
          const updated = { ...prev };
          if (updated[franchiseId]) {
            delete updated[franchiseId].carts;
          }
          return updated;
        });

        // Refresh franchises and stats
        await fetchFranchises();
      } else {
        // If franchise not found, just refresh everything
        await fetchFranchises();
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error deleting cart:", error);
      }
      alert(error.response?.data?.message || "Failed to delete cart");
    }
  };

  // Validation functions
  const validateEmail = (email) => {
    if (!email || !email.trim()) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || !phone.trim()) return ""; // Phone is optional
    // Remove spaces, dashes, and country code for validation
    const cleaned = phone.replace(/[\s\-+]/g, "").replace(/^91/, "");
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(cleaned)) {
      return "Please enter a valid 10-digit Indian mobile number";
    }
    return "";
  };

  const validateName = (name) => {
    if (!name || !name.trim()) return "Name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";
    if (name.trim().length > 50) return "Name must be less than 50 characters";
    return "";
  };

  const validatePassword = (password) => {
    if (!password || !password.trim()) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const validateGSTNumber = (gst) => {
    if (!gst) return true; // Optional field
    // GST format: 15 characters, alphanumeric
    // Format: 29ABCDE1234F1Z5 (2 digits + 10 alphanumeric + 1 letter + 1 digit + 1 letter + 1 digit)
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst.toUpperCase());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Trim all form data
    const trimmedData = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password.trim(),
      mobile: formData.mobile.trim(),
      gstNumber: formData.gstNumber.trim().toUpperCase(),
    };

    // Validation for create mode
    if (!editingFranchise) {
      // Required fields validation
      if (!trimmedData.name) {
        setFormError("Franchise name is required");
        return;
      }
      if (!trimmedData.email) {
        setFormError("Email is required");
        return;
      }
      if (!trimmedData.password) {
        setFormError("Password is required");
        return;
      }
      if (trimmedData.password.length < 6) {
        setFormError("Password must be at least 6 characters long");
        return;
      }
    }

    // Email validation
    const emailError = validateEmail(trimmedData.email);
    if (emailError) {
      setFormError(emailError);
      return;
    }

    // Phone number validation
    if (trimmedData.mobile) {
      const mobileError = validatePhoneNumber(trimmedData.mobile);
      if (mobileError) {
        setFormError(mobileError);
        return;
      }
    }

    // GST number validation - REMOVED or replaced with FSSAI length check if desired.
    // FSSAI is 14 digits.
    if (trimmedData.gstNumber && trimmedData.gstNumber.length !== 14) {
       // Optional: validate FSSAI format if strictly needed, otherwise loose check or no check.
       // For now, accepting it as string.
    }

    // Password validation for edit mode (if password is provided)
    if (
      editingFranchise &&
      trimmedData.password &&
      trimmedData.password.length < 6
    ) {
      setFormError("Password must be at least 6 characters long");
      return;
    }

    // Document validation for create mode only (Aadhar and PAN are now optional)
    if (!editingFranchise) {
      if (!files.udyamCertificate) {
        setFormError("Udyam Certificate is required");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingFranchise) {
        // Use FormData for updates to support file uploads
        const formDataToSend = new FormData();
        formDataToSend.append("name", trimmedData.name);
        formDataToSend.append("email", trimmedData.email);
        formDataToSend.append("role", "franchise_admin");
        if (trimmedData.mobile) {
          const cleanedMobile = trimmedData.mobile.replace(/[\s\-]/g, "");
          formDataToSend.append("mobile", cleanedMobile);
        }
        if (trimmedData.gstNumber) {
          formDataToSend.append("gstNumber", trimmedData.gstNumber);
        }
        if (trimmedData.password) {
          formDataToSend.append("password", trimmedData.password);
        }

        // Add document files if provided
        if (files.udyamCertificate) {
          formDataToSend.append("udyamCertificate", files.udyamCertificate);
        }
        if (files.aadharCard) {
          formDataToSend.append("aadharCard", files.aadharCard);
        }
        if (files.panCard) {
          formDataToSend.append("panCard", files.panCard);
        }

        // Add expiry dates if provided
        if (documentExpiryDates.udyamCertificateExpiry) {
          formDataToSend.append(
            "udyamCertificateExpiry",
            documentExpiryDates.udyamCertificateExpiry
          );
        }
        if (documentExpiryDates.aadharCardExpiry) {
          formDataToSend.append(
            "aadharCardExpiry",
            documentExpiryDates.aadharCardExpiry
          );
        }
        if (documentExpiryDates.panCardExpiry) {
          formDataToSend.append(
            "panCardExpiry",
            documentExpiryDates.panCardExpiry
          );
        }

        await api.put(`/users/${editingFranchise._id}`, formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Franchise updated successfully");
      } else {
        const formDataToSend = new FormData();
        formDataToSend.append("name", trimmedData.name);
        formDataToSend.append("email", trimmedData.email);
        formDataToSend.append("password", trimmedData.password);
        formDataToSend.append("role", "franchise_admin");
        if (trimmedData.mobile) {
          // Clean phone number: remove spaces, dashes, keep +91 if present
          const cleanedMobile = trimmedData.mobile.replace(/[\s\-]/g, "");
          formDataToSend.append("mobile", cleanedMobile);
        }
        if (trimmedData.gstNumber) {
          formDataToSend.append("gstNumber", trimmedData.gstNumber);
        }

        if (files.udyamCertificate)
          formDataToSend.append("udyamCertificate", files.udyamCertificate);
        if (files.aadharCard)
          formDataToSend.append("aadharCard", files.aadharCard);
        if (files.panCard) formDataToSend.append("panCard", files.panCard);

        // Add expiry dates if provided
        if (documentExpiryDates.udyamCertificateExpiry) {
          formDataToSend.append(
            "udyamCertificateExpiry",
            documentExpiryDates.udyamCertificateExpiry
          );
        }
        if (documentExpiryDates.aadharCardExpiry) {
          formDataToSend.append(
            "aadharCardExpiry",
            documentExpiryDates.aadharCardExpiry
          );
        }
        if (documentExpiryDates.panCardExpiry) {
          formDataToSend.append(
            "panCardExpiry",
            documentExpiryDates.panCardExpiry
          );
        }

        await api.post("/users", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        alert("Franchise created successfully");
      }
      setShowModal(false);
      setEditingFranchise(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        mobile: "",
        gstNumber: "",
      });
      setFiles({ udyamCertificate: null, aadharCard: null, panCard: null });
      setDocumentExpiryDates({
        udyamCertificateExpiry: "",
        aadharCardExpiry: "",
        panCardExpiry: "",
      });
      setFormError(null);
      fetchFranchises();
    } catch (error) {
      console.error("Error saving franchise:", error);
      setFormError(
        error.response?.data?.message ||
          "Failed to save franchise. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (franchise) => {
    try {
      // Fetch full franchise details to get all document paths
      const response = await api.get(`/users/${franchise._id}`);
      const franchiseData = response.data;

      setEditingFranchise(franchiseData);
      setFormData({
        name: franchiseData.name || "",
        email: franchiseData.email || "",
        password: "",
        mobile: franchiseData.mobile || "",
        gstNumber: franchiseData.gstNumber || "",
      });
      setFiles({ udyamCertificate: null, aadharCard: null, panCard: null });

      // Format expiry dates for date input (YYYY-MM-DD)
      const formatDateForInput = (date) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toISOString().split("T")[0];
      };

      setDocumentExpiryDates({
        udyamCertificateExpiry: formatDateForInput(
          franchiseData.udyamCertificateExpiry
        ),
        aadharCardExpiry: formatDateForInput(franchiseData.aadharCardExpiry),
        panCardExpiry: formatDateForInput(franchiseData.panCardExpiry),
      });
      setFormError(null);
      setShowModal(true);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching franchise details:", error);
      }
      const errorMessage =
        error.response?.data?.message || "Failed to fetch franchise details";
      alert(errorMessage);
    }
  };

  const handleToggleStatus = async (franchiseId) => {
    const franchise = franchises.find((f) => f._id === franchiseId);
    const franchiseName = franchise?.name || "this franchise";
    const isCurrentlyActive = franchise?.isActive !== false;
    const action = isCurrentlyActive ? "DEACTIVATE" : "ACTIVATE";

    try {
      const { confirm } = await import("../utils/confirm");
      const confirmed = await confirm(
        `Are you sure you want to ${action} franchise "${franchiseName}"?\n\n${
          isCurrentlyActive
            ? "⚠️ WARNING: All carts under this franchise will also be deactivated.\n\nThis will prevent all carts from accepting new orders."
            : "✅ All carts under this franchise will also be activated.\n\nCarts will be able to accept new orders again."
        }`,
        {
          title: `${action} Franchise`,
          warningMessage: isCurrentlyActive
            ? "WARNING: DEACTIVATION"
            : "Activation",
          danger: isCurrentlyActive,
          confirmText: action,
          cancelText: "Cancel",
        }
      );

      if (!confirmed) return;

      const response = await api.patch(`/users/${franchiseId}/toggle-status`);
      if (response.data?.success) {
        alert(response.data.message || "Franchise status updated successfully");
        setFranchiseCarts((prev) => {
          const updated = { ...prev };
          if (updated[franchiseId]) {
            delete updated[franchiseId].carts;
          }
          return updated;
        });
        fetchFranchises();
        if (expandedFranchises.has(franchiseId)) {
          fetchCartsForFranchise(franchiseId);
        }
      }
    } catch (error) {
      console.error("Error toggling franchise status:", error);
      if (error.response?.status !== 400) {
        // Don't show alert if user cancelled
        alert(
          error.response?.data?.message || "Failed to update franchise status"
        );
      }
    }
  };

  const handleDelete = async (franchiseId) => {
    const franchise = franchises.find((f) => f._id === franchiseId);
    const franchiseName = franchise?.name || "this franchise";

    const items = [
      "The franchise account and login",
      "ALL carts under this franchise",
      "ALL cart login credentials",
      "ALL employees (franchise and cart level)",
      "ALL menu items and categories",
      "ALL tables and waitlist entries",
      "ALL non-paid orders and payments",
      "Paid orders will be PRESERVED for revenue tracking",
    ];

    const confirmed = await confirmFranchiseDelete(franchiseName);

    if (!confirmed) {
      return;
    }

    try {
      const response = await api.delete(`/users/${franchiseId}`);
      alert(
        `✅ Franchise Permanently Deleted!\n\n` +
          `Franchise "${franchiseName}" has been permanently deleted.\n\n` +
          (response.data?.preservedPaidOrders > 0
            ? `${response.data.preservedPaidOrders} paid orders preserved for revenue tracking.\n\n`
            : "") +
          `All associated carts, employees, and data have been removed.`,
        "success"
      );
      fetchFranchises();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error deleting franchise:", error);
      }
      alert(
        error.response?.data?.message ||
          "Failed to delete franchise. Please try again.",
        "error"
      );
    }
  };

  const filteredFranchises = franchises.filter((franchise) => {
    // Search filter
    const matchesSearch =
      franchise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      franchise.email.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && franchise.isActive !== false) ||
      (filterStatus === "inactive" && franchise.isActive === false) ||
      (filterStatus === "pending" && (franchiseCarts[franchise._id]?.pendingApproval || 0) > 0);

    return matchesSearch && matchesStatus;
  });

  // Stats calculations
  const totalFranchises = franchises.length;
  const activeFranchises = franchises.filter(
    (f) => f.isActive !== false
  ).length;
  const inactiveFranchises = totalFranchises - activeFranchises;
  const totalCarts = Object.values(franchiseCarts).reduce(
    (sum, f) => sum + (f.totalCarts || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaBuilding className="text-blue-600 flex-shrink-0" />
            <span className="truncate">Franchise Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage all franchise locations and their carts
          </p>
        </div>
        <button
          onClick={() => {
            setEditingFranchise(null);
            setFormData({
              name: "",
              email: "",
              password: "",
              mobile: "",
              gstNumber: "",
            });
            setFiles({
              udyamCertificate: null,
              aadharCard: null,
              panCard: null,
            });
            setDocumentExpiryDates({
              udyamCertificateExpiry: "",
              aadharCardExpiry: "",
              panCardExpiry: "",
            });
            setFormError(null);
            setShowModal(true);
          }}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm w-full sm:w-auto justify-center"
        >
          <FaPlus className="mr-1.5" size={12} />
          <span className="whitespace-nowrap">Add Franchise</span>
        </button>
      </div>

      {/* Stats Cards - Display Only */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium mb-1">Total Franchises</p>
              <p className="text-2xl font-bold text-gray-900">{totalFranchises}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FaBuilding className="text-blue-600" size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 font-medium mb-1">Active</p>
              <p className="text-2xl font-bold text-emerald-700">{activeFranchises}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FaCheckCircle className="text-emerald-600" size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-rose-600 font-medium mb-1">Inactive</p>
              <p className="text-2xl font-bold text-rose-700">{inactiveFranchises}</p>
            </div>
            <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center">
              <FaTimesCircle className="text-rose-600" size={20} />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-600 font-medium mb-1">Total Carts</p>
              <p className="text-2xl font-bold text-purple-700">{totalCarts}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <FaStore className="text-purple-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        {/* Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-gray-100">
          <FaFilter className="text-gray-400" size={14} />
          <span className="text-sm font-medium text-gray-700 mr-2">Filter:</span>
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All Franchises
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === "active"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Active Only
          </button>
          <button
            onClick={() => setFilterStatus("inactive")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === "inactive"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            Inactive Only
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filterStatus === "pending"
                ? "bg-yellow-600 text-white shadow-sm"
                : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
            }`}
          >
            Pending Carts
          </button>
        </div>
        
        {/* Search & View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FaSearch
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={14}
            />
            <input
              type="text"
              placeholder="Search by name, email, or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode("tile")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === "tile"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Card View
            </button>
          </div>
        </div>
      </div>

      {/* Franchises List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <FaSpinner className="animate-spin text-blue-500 text-2xl" />
          </div>
        ) : filteredFranchises.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaBuilding className="mx-auto text-4xl mb-3 text-gray-300" />
            <p className="font-medium">No franchises found</p>
            <p className="text-sm mt-1">
              Create your first franchise to get started
            </p>
          </div>
        ) : viewMode === "tile" ? (
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filteredFranchises.map((franchise) => {
                const isActive = franchise.isActive !== false;
                const cartStats = franchiseCarts[franchise._id] || {};

                return (
                  <div
                    key={franchise._id}
                    className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-all ${
                      !isActive
                        ? "opacity-75 border-gray-300"
                        : "border-gray-200"
                    } ${
                      filterStatus === "active" && !isActive ? "hidden" : ""
                    } ${
                      filterStatus === "inactive" && isActive ? "hidden" : ""
                    } ${
                      filterStatus === "pending" && !(cartStats.pendingApproval > 0) ? "hidden" : ""
                    }`}
                  >
                    <div className="p-3 sm:p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                            isActive
                              ? "bg-gradient-to-br from-blue-500 to-blue-600"
                              : "bg-gray-400"
                          }`}
                        >
                          {franchise.name.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`px-2 py-1 text-[10px] font-medium rounded whitespace-nowrap ${
                            isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Franchise Info */}
                      <div className="mb-3">
                        {franchise.franchiseCode && (
                          <div className="mb-1">
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded">
                              {franchise.franchiseCode}
                            </span>
                          </div>
                        )}
                        <h3 className="font-semibold text-gray-800 text-sm mb-1 truncate">
                          {franchise.name}
                        </h3>
                        <p className="text-xs text-gray-500 truncate mb-1">
                          <FaEnvelope size={9} className="inline mr-1" />
                          {franchise.email}
                        </p>
                        {franchise.mobile && (
                          <p className="text-xs text-gray-500 truncate">
                            <FaPhone size={9} className="inline mr-1" />
                            {franchise.mobile}
                          </p>
                        )}
                      </div>

                      {/* Cart Stats */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                          <FaStore size={10} />
                          <span className="font-medium">
                            {cartStats.totalCarts || 0}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded text-xs">
                          <FaCheckCircle size={10} />
                          <span>{cartStats.activeCarts || 0}</span>
                        </div>
                        {(cartStats.pendingApproval || 0) > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-600 rounded text-xs">
                            <FaClock size={10} />
                            <span>{cartStats.pendingApproval}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setViewDetails(franchise)}
                          className="flex-1 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
                          title="View Details"
                        >
                          <FaEye size={14} className="inline mr-1.5" />
                          View
                        </button>
                        <button
                          onClick={() => handleToggleStatus(franchise._id)}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            isActive
                              ? "text-emerald-600 hover:bg-emerald-50"
                              : "text-gray-400 hover:bg-gray-100"
                          }`}
                          title={isActive ? "Deactivate" : "Activate"}
                        >
                          {isActive ? (
                            <FaToggleOn size={18} />
                          ) : (
                            <FaToggleOff size={18} />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(franchise)}
                          className="px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(franchise._id)}
                          className="px-3 py-2 text-sm text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase font-semibold tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3">Franchise Details</th>
                  <th className="px-4 py-3">Contact Info</th>
                  <th className="px-4 py-3 text-center">Carts</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFranchises.map((franchise) => {
                  const isActive = franchise.isActive !== false;
                  const isExpanded = expandedFranchises.has(franchise._id);
                  const cartStats = franchiseCarts[franchise._id] || {};
                  const carts = franchiseCarts[franchise._id]?.carts || [];
                  const isLoadingCarts = loadingCarts[franchise._id];

                  return (
                    <React.Fragment key={franchise._id}>
                      {/* Franchise Row */}
                      <tr
                        className={`hover:bg-gray-50/80 transition-colors group ${
                          !isActive ? "bg-gray-50/50" : "bg-white"
                        } ${isExpanded ? "bg-blue-50/30" : ""}`}
                      >
                        <td className="px-4 py-3 align-middle">
                          <button
                            onClick={() => toggleFranchiseExpand(franchise._id)}
                            className={`p-1.5 rounded-md transition-colors ${
                              isExpanded
                                ? "bg-blue-100 text-blue-600"
                                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            }`}
                          >
                            {isExpanded ? (
                              <FaChevronDown size={12} />
                            ) : (
                              <FaChevronRight size={12} />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm ${
                                isActive
                                  ? "bg-gradient-to-br from-blue-500 to-blue-600"
                                  : "bg-gray-400"
                              }`}
                            >
                              {franchise.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-sm">
                                  {franchise.name}
                                </span>
                                {franchise.franchiseCode && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-gray-100 text-gray-600 rounded border border-gray-200">
                                    {franchise.franchiseCode}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                Created:{" "}
                                {new Date(franchise.createdAt).toLocaleDateString(
                                  "en-IN"
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <FaEnvelope size={12} className="text-gray-400" />
                              <span className="truncate max-w-[180px]" title={franchise.email}>{franchise.email}</span>
                            </div>
                            {franchise.mobile && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <FaPhone size={12} className="text-gray-400" />
                                <span>{franchise.mobile}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center justify-center gap-2">
                            <div
                              className="flex flex-col items-center px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 min-w-[60px]"
                              title="Total Carts"
                            >
                              <span className="text-xs font-bold text-gray-700">
                                {cartStats.totalCarts || 0}
                              </span>
                              <span className="text-[10px] text-gray-400 uppercase font-medium">
                                Total
                              </span>
                            </div>
                            <div
                              className="flex flex-col items-center px-3 py-1 bg-green-50 rounded-lg border border-green-100 min-w-[60px]"
                              title="Active Carts"
                            >
                              <span className="text-xs font-bold text-green-700">
                                {cartStats.activeCarts || 0}
                              </span>
                              <span className="text-[10px] text-green-600/70 uppercase font-medium">
                                Active
                              </span>
                            </div>
                            {(cartStats.pendingApproval || 0) > 0 && (
                              <div
                                className="flex flex-col items-center px-3 py-1 bg-yellow-50 rounded-lg border border-yellow-100 min-w-[60px]"
                                title="Pending Approval"
                              >
                                <span className="text-xs font-bold text-yellow-700">
                                  {cartStats.pendingApproval}
                                </span>
                                <span className="text-[10px] text-yellow-600/70 uppercase font-medium">
                                  Pending
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                            }`}
                          >
                            {isActive ? (
                              <FaCheckCircle size={10} />
                            ) : (
                              <FaTimesCircle size={10} />
                            )}
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setViewDetails(franchise)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="View Details"
                            >
                              <FaEye size={16} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(franchise._id)}
                              className={`p-1.5 rounded-lg transition-colors border border-transparent ${
                                isActive
                                  ? "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100"
                                  : "text-gray-400 hover:bg-gray-100 hover:border-gray-200"
                              }`}
                              title={isActive ? "Deactivate" : "Activate"}
                            >
                              {isActive ? (
                                <FaToggleOn size={18} />
                              ) : (
                                <FaToggleOff size={18} />
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(franchise)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="Edit"
                            >
                              <FaEdit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(franchise._id)}
                              className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                              title="Delete"
                            >
                              <FaTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Section (Child Table) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="6" className="p-0 border-b border-gray-100 bg-gray-50/60">
                            <div className="px-4 py-4 sm:px-10">
                              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                {/* Child Header */}
                                <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                  <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <FaStore className="text-blue-500" />
                                    Managed Carts
                                    <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">
                                      {carts.length}
                                    </span>
                                  </h4>
                                  <button
                                    onClick={() => {
                                      setSelectedFranchiseForCart(franchise);
                                      setCartFormData({
                                        name: "",
                                        email: "",
                                        password: "",
                                        confirmPassword: "",
                                        cartName: "",
                                        location: "",
                                        phone: "",
                                        address: "",
                                        fssaiNumber: franchise.fssaiNumber || franchise.gstNumber || "",
                                        shopActLicenseExpiry: "",
                                        fssaiLicenseExpiry: "",
                                      });
                                      setCartFiles({
                                        aadharCard: null,
                                        panCard: null,
                                        shopActLicense: null,
                                        fssaiLicense: null,
                                      });
                                      setCartFormError(null);
                                      setCartFormErrors({});
                                      setIsSubmittingCart(false);
                                      setShowCartModal(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                  >
                                    <FaPlus size={10} />
                                    Add New Cart
                                  </button>
                                </div>

                                {/* Child Content */}
                                {isLoadingCarts ? (
                                  <div className="flex justify-center py-8">
                                    <FaSpinner className="animate-spin text-blue-500" size={24} />
                                  </div>
                                ) : carts.length === 0 ? (
                                  <div className="py-8 text-center text-gray-500">
                                    <p className="text-sm">No carts found under this franchise.</p>
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                      <thead className="bg-white text-gray-500 text-xs border-b border-gray-100">
                                        <tr>
                                          <th className="px-5 py-2.5 font-medium w-12 text-center">#</th>
                                          <th className="px-5 py-2.5 font-medium">Cart Name</th>
                                          <th className="px-5 py-2.5 font-medium">Location</th>
                                          <th className="px-5 py-2.5 font-medium">Contact</th>
                                          <th className="px-5 py-2.5 font-medium text-center">Status</th>
                                          <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {carts.map((cart, idx) => {
                                          const cartIsActive =
                                            cart.isActive !== false &&
                                            cart.isApproved === true &&
                                            isActive;
                                          
                                          return (
                                            <tr key={cart._id} className="hover:bg-gray-50 transition-colors">
                                              <td className="px-5 py-3 text-center text-xs text-gray-400">
                                                {idx + 1}
                                              </td>
                                              <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                  <div className="font-medium text-gray-900">
                                                    {cart.cartName || cart.cafeName || cart.name}
                                                  </div>
                                                  {cart.cartCode && (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-orange-100 text-orange-700 rounded border border-orange-200">
                                                      {cart.cartCode}
                                                    </span>
                                                  )}
                                                </div>
                                                {cart.isApproved === false && (
                                                   <span className="mt-1 inline-flex items-center text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                                                     Waiting Approval
                                                   </span>
                                                )}
                                              </td>
                                              <td className="px-5 py-3 text-gray-600 text-xs">
                                                {cart.location || "-"}
                                                {cart.address && (
                                                  <div className="text-[10px] text-gray-400 truncate max-w-[150px]" title={cart.address}>
                                                    {cart.address}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="px-5 py-3">
                                                 <div className="text-xs text-gray-600">
                                                   <div className="flex items-center gap-1.5" title={cart.email}>
                                                     <FaEnvelope size={10} className="text-gray-400" />
                                                     <span className="truncate max-w-[140px]">{cart.email}</span>
                                                   </div>
                                                   {cart.phone && (
                                                     <div className="flex items-center gap-1.5 mt-1">
                                                       <FaPhone size={10} className="text-gray-400" />
                                                       <span>{cart.phone}</span>
                                                     </div>
                                                   )}
                                                 </div>
                                              </td>
                                              <td className="px-5 py-3 text-center">
                                                <span
                                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                                    cart.isApproved === false
                                                      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                                      : cartIsActive
                                                      ? "bg-green-50 text-green-700 border-green-200"
                                                      : "bg-gray-100 text-gray-600 border-gray-200"
                                                  }`}
                                                >
                                                  {cart.isApproved === false
                                                    ? "Pending"
                                                    : cartIsActive
                                                    ? "Active"
                                                    : "Inactive"}
                                                </span>
                                              </td>
                                              <td className="px-5 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                  {cart.isApproved ? (
                                                    <button
                                                      onClick={() => handleToggleCartStatus(cart._id, cartIsActive)}
                                                      disabled={!isActive}
                                                      className={`p-1.5 rounded-md transition-colors ${
                                                        !isActive
                                                          ? "text-gray-300 cursor-not-allowed"
                                                          : cartIsActive
                                                          ? "text-green-600 hover:bg-green-50"
                                                          : "text-gray-400 hover:bg-gray-100"
                                                      }`}
                                                      title={
                                                        !isActive 
                                                          ? "Parent franchise inactive"
                                                          : cartIsActive 
                                                            ? "Deactivate Cart" 
                                                            : "Activate Cart"
                                                      }
                                                    >
                                                      {cartIsActive ? <FaToggleOn size={16} /> : <FaToggleOff size={16} />}
                                                    </button>
                                                  ) : (
                                                    <button
                                                      onClick={() => handleToggleCartStatus(cart._id, cartIsActive)}
                                                      className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-md transition-colors"
                                                      title="Approve Cart"
                                                    >
                                                      <FaCheckCircle size={16} />
                                                    </button>
                                                  )}
                                                  
                                                  <button
                                                    onClick={() => handleEditCart(cart)}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                    title="Edit Cart"
                                                  >
                                                    <FaEdit size={14} />
                                                  </button>
                                                  
                                                  <button
                                                    onClick={() => handleDeleteCart(cart._id, cart.cartName || cart.cafeName || cart.name)}
                                                    className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                    title="Delete Cart"
                                                  >
                                                    <FaTrash size={14} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {viewDetails && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden my-auto flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 sm:p-4 text-white flex-shrink-0">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base sm:text-lg font-bold truncate">
                    {viewDetails.name}
                  </h2>
                  {viewDetails.franchiseCode && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded text-xs font-mono">
                      {viewDetails.franchiseCode}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setViewDetails(null)}
                  className="text-white/80 hover:text-white text-2xl leading-none p-1 ml-2 flex-shrink-0"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-4 space-y-3 overflow-y-auto flex-1">
              <div className="flex items-center gap-3 text-sm">
                <FaEnvelope className="text-gray-400" size={14} />
                <span className="text-gray-700">{viewDetails.email}</span>
              </div>
              {viewDetails.mobile && (
                <div className="flex items-center gap-3 text-sm">
                  <FaPhone className="text-gray-400" size={14} />
                  <span className="text-gray-700">{viewDetails.mobile}</span>
                </div>
              )}
              {viewDetails.gstNumber && (
                <div className="flex items-center gap-3 text-sm">
                  <FaIdCard className="text-gray-400" size={14} />
                  <span className="text-gray-700">{viewDetails.gstNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <FaCalendarAlt className="text-gray-400" size={14} />
                <span className="text-gray-700">
                  Created:{" "}
                  {new Date(viewDetails.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FaUsers className="text-gray-400" size={14} />
                <span className="text-gray-700">
                  {franchiseCarts[viewDetails._id]?.totalCarts || 0} Carts
                </span>
              </div>
              <div className="pt-3 border-t">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    viewDetails.isActive !== false
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {viewDetails.isActive !== false ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Franchise Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl bg-gradient-to-br from-[#fef4ec] via-white to-[#fde1c3] border border-[#f5d0a1] flex flex-col my-auto">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-[#b45309] via-[#d97706] to-[#f97316] px-3 sm:px-5 py-3 sm:py-4 text-white flex justify-between items-center flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-bold tracking-wide truncate">
                  {editingFranchise ? "Edit Franchise" : "Create New Franchise"}
                </h2>
                <p className="text-[10px] sm:text-xs text-orange-100 mt-1 hidden sm:block">
                  Primary details for the franchise owner. You can add carts
                  later.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingFranchise(null);
                  setFormError(null);
                  setDocumentExpiryDates({
                    udyamCertificateExpiry: "",
                    aadharCardExpiry: "",
                    panCardExpiry: "",
                  });
                }}
                className="text-white/80 hover:text-white text-2xl leading-none p-1 ml-2 flex-shrink-0"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {/* Error Message Display */}
            {formError && (
              <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <FaTimesCircle
                    className="text-red-600 mt-0.5 flex-shrink-0"
                    size={16}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">
                      Validation Error
                    </p>
                    <p className="text-sm text-red-700 mt-1">{formError}</p>
                  </div>
                  <button
                    onClick={() => setFormError(null)}
                    className="text-red-600 hover:text-red-800 flex-shrink-0"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>
            )}
            {/* Modal body */}
            <form
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
            >
              <div className="bg-white/80 rounded-xl border border-orange-100 shadow-sm p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-1">
                  Franchise Owner Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Franchise Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        // Clear error when user starts typing
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter franchise name"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        // Clear error when user starts typing
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Mobile
                    </label>
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, mobile: value });
                        // Clear error when user starts typing
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="9876543210 or +91 9876543210"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      10-digit Indian mobile number
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      FSSAI Number
                    </label>
                    <input
                      type="text"
                      value={formData.fssaiNumber || formData.gstNumber || ""}
                      onChange={(e) => {
                        const value = e.target.value; // FSSAI is usually numeric, but can be string
                        setFormData({ ...formData, fssaiNumber: value, gstNumber: value }); // Keep gstNumber for backward compatibility if needed in handleSubmit
                        // Clear error when user starts typing
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="12345678901234"
                      maxLength={14}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      14 digit FSSAI license number
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Password{" "}
                      {editingFranchise && (
                        <span className="font-normal text-gray-400">
                          (leave blank to keep)
                        </span>
                      )}
                      {!editingFranchise && " *"}
                    </label>
                    <input
                      type="password"
                      required={!editingFranchise}
                      value={formData.password}
                      onChange={(e) => {
                        setFormData({ ...formData, password: e.target.value });
                        // Clear error when user starts typing
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/70 rounded-xl border border-orange-300 p-4 mt-1">
                <h3 className="text-xs font-semibold text-gray-700 mb-1">
                  {editingFranchise
                    ? "Documents (Optional)"
                    : "Documents"}
                </h3>
                <p className="text-[11px] text-gray-500 mb-3">
                  {editingFranchise
                    ? "Update documents if needed. Leave blank to keep existing documents."
                    : "Udyam Certificate is required. Aadhar and PAN are optional."}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Udyam Certificate {!editingFranchise && "*"}
                    </label>
                    {editingFranchise && editingFranchise.udyamCertificate && (
                      <p className="text-xs text-gray-600 mb-1">
                        Current:{" "}
                        <a
                          href={
                            editingFranchise.udyamCertificate?.startsWith("http")
                              ? editingFranchise.udyamCertificate
                              : `${
                                  import.meta.env.VITE_NODE_API_URL ||
                                  "http://localhost:5001"
                                }/${editingFranchise.udyamCertificate}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file && file.size > 5 * 1024 * 1024) {
                          alert("File size must be less than 5MB");
                          e.target.value = "";
                          return;
                        }
                        setFiles({
                          ...files,
                          udyamCertificate: file,
                        });
                        // Clear error when user selects file
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    />
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={documentExpiryDates.udyamCertificateExpiry}
                        onChange={(e) =>
                          setDocumentExpiryDates({
                            ...documentExpiryDates,
                            udyamCertificateExpiry: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Aadhar Card <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    {editingFranchise && editingFranchise.aadharCard && (
                      <p className="text-xs text-gray-600 mb-1">
                        Current:{" "}
                        <a
                          href={
                            editingFranchise.aadharCard?.startsWith("http")
                              ? editingFranchise.aadharCard
                              : `${
                                  import.meta.env.VITE_NODE_API_URL ||
                                  "http://localhost:5001"
                                }/${editingFranchise.aadharCard}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file && file.size > 5 * 1024 * 1024) {
                          alert("File size must be less than 5MB");
                          e.target.value = "";
                          return;
                        }
                        setFiles({ ...files, aadharCard: file });
                        // Clear error when user selects file
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    />
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={documentExpiryDates.aadharCardExpiry}
                        onChange={(e) =>
                          setDocumentExpiryDates({
                            ...documentExpiryDates,
                            aadharCardExpiry: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      PAN Card <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    {editingFranchise && editingFranchise.panCard && (
                      <p className="text-xs text-gray-600 mb-1">
                        Current:{" "}
                        <a
                          href={
                            editingFranchise.panCard?.startsWith("http")
                              ? editingFranchise.panCard
                              : `${
                                  import.meta.env.VITE_NODE_API_URL ||
                                  "http://localhost:5001"
                                }/${editingFranchise.panCard}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file && file.size > 5 * 1024 * 1024) {
                          alert("File size must be less than 5MB");
                          e.target.value = "";
                          return;
                        }
                        setFiles({ ...files, panCard: file });
                        // Clear error when user selects file
                        if (formError) setFormError(null);
                      }}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    />
                    <div className="mt-2">
                      <label className="block text-xs text-gray-600 mb-1">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={documentExpiryDates.panCardExpiry}
                        onChange={(e) =>
                          setDocumentExpiryDates({
                            ...documentExpiryDates,
                            panCardExpiry: e.target.value,
                          })
                        }
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
            {/* Modal footer */}
            <div className="px-5 py-3 border-t bg-gradient-to-r from-white via-[#fff7eb] to-white flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingFranchise(null);
                  setFormError(null);
                  setDocumentExpiryDates({
                    udyamCertificateExpiry: "",
                    aadharCardExpiry: "",
                    panCardExpiry: "",
                  });
                }}
                className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-sm bg-[#b45309] text-white rounded-lg hover:bg-[#92400e] transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <FaSpinner className="animate-spin" size={14} />
                    <span>
                      {editingFranchise ? "Updating..." : "Creating..."}
                    </span>
                  </>
                ) : (
                  <span>{editingFranchise ? "Update" : "Create"}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Cart Modal */}
      {showCartModal && selectedFranchiseForCart && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] p-4 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">
                  {editingCart ? "Edit Cart" : "Add New Cart"}
                </h2>
                <p className="text-sm text-orange-100 mt-1">
                  Under: {selectedFranchiseForCart.name}{" "}
                  {selectedFranchiseForCart.franchiseCode
                    ? `(${selectedFranchiseForCart.franchiseCode})`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCartModal(false);
                  setSelectedFranchiseForCart(null);
                  setEditingCart(null);
                  setCartFormError(null);
                  setCartFormErrors({});
                  setIsSubmittingCart(false);
                }}
                className="p-1 hover:bg-white/20 rounded"
              >
                <FaTimes size={16} />
              </button>
            </div>
            {/* Error Message Display */}
            {cartFormError && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <FaTimesCircle
                    className="text-red-600 mt-0.5 flex-shrink-0"
                    size={16}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-700 mt-1">{cartFormError}</p>
                  </div>
                  <button
                    onClick={() => setCartFormError(null)}
                    className="text-red-600 hover:text-red-800 flex-shrink-0"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>
            )}
            <form
              id="cart-form"
              className="flex-1 overflow-y-auto p-4 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();

                // Clear previous errors
                setCartFormError(null);
                setCartFormErrors({});

                // Trim all form data
                const trimmedData = {
                  name: cartFormData.name.trim(),
                  email: cartFormData.email.trim().toLowerCase(),
                  password: cartFormData.password.trim(),
                  confirmPassword: cartFormData.confirmPassword.trim(),
                  cartName: cartFormData.cartName.trim(),
                  location: cartFormData.location.trim(),
                  phone: cartFormData.phone.trim(),
                  address: cartFormData.address.trim(),
                  fssaiNumber: cartFormData.fssaiNumber ? cartFormData.fssaiNumber.trim() : "",
                  shopActLicenseExpiry: cartFormData.shopActLicenseExpiry,
                  fssaiLicenseExpiry: cartFormData.fssaiLicenseExpiry,
                };

                const errors = {};

                // Validate name
                const nameError = validateName(trimmedData.name);
                if (nameError) errors.name = nameError;

                // Validate email
                const emailError = validateEmail(trimmedData.email);
                if (emailError) errors.email = emailError;

                // Validate password
                const passwordError = validatePassword(trimmedData.password);
                if (passwordError) errors.password = passwordError;

                // Validate confirm password
                if (!trimmedData.confirmPassword) {
                  errors.confirmPassword = "Please confirm your password";
                } else if (
                  trimmedData.password !== trimmedData.confirmPassword
                ) {
                  errors.confirmPassword = "Passwords do not match";
                }

                // Validate cart name
                if (!trimmedData.cartName) {
                  errors.cartName = "Cart name is required";
                } else if (trimmedData.cartName.length < 2) {
                  errors.cartName = "Cart name must be at least 2 characters";
                }

                // Validate location
                if (!trimmedData.location) {
                  errors.location = "Location is required";
                } else if (trimmedData.location.length < 2) {
                  errors.location = "Location must be at least 2 characters";
                }

                // Validate phone (optional but if provided, must be valid)
                if (trimmedData.phone) {
                  const phoneError = validatePhoneNumber(trimmedData.phone);
                  if (phoneError) errors.phone = phoneError;
                }

                // Validate FSSAI number (Mandatory, 14 digits)
                if (!trimmedData.fssaiNumber) {
                  errors.fssaiNumber = "FSSAI Number is required";
                } else if (!/^\d{14}$/.test(trimmedData.fssaiNumber)) {
                  errors.fssaiNumber = "FSSAI Number must be 14 digits";
                }

                // Validate required documents only for create mode (Shop Act, Aadhar and PAN are optional)
                if (!editingCart) {
                  if (!cartFiles.fssaiLicense) {
                    errors.fssaiLicense = "FSSAI License is required";
                  }
                }

                // Validate file sizes (max 10MB)
                const maxSize = 10 * 1024 * 1024; // 10MB
                if (
                  cartFiles.aadharCard &&
                  cartFiles.aadharCard.size > maxSize
                ) {
                  errors.aadharCard =
                    "Aadhar Card file size must be less than 10MB";
                }
                if (cartFiles.panCard && cartFiles.panCard.size > maxSize) {
                  errors.panCard = "PAN Card file size must be less than 10MB";
                }
                if (
                  cartFiles.shopActLicense &&
                  cartFiles.shopActLicense.size > maxSize
                ) {
                  errors.shopActLicense =
                    "Shop Act License file size must be less than 10MB";
                }
                if (
                  cartFiles.fssaiLicense &&
                  cartFiles.fssaiLicense.size > maxSize
                ) {
                  errors.fssaiLicense =
                    "FSSAI License file size must be less than 10MB";
                }

                // For edit mode, password is optional
                if (
                  editingCart &&
                  trimmedData.password &&
                  trimmedData.password.length > 0
                ) {
                  if (trimmedData.password.length < 6) {
                    errors.password = "Password must be at least 6 characters";
                  } else if (
                    trimmedData.password !== trimmedData.confirmPassword
                  ) {
                    errors.confirmPassword = "Passwords do not match";
                  }
                }

                // If there are errors, display them and stop submission
                if (Object.keys(errors).length > 0) {
                  setCartFormErrors(errors);
                  // Scroll to first error
                  const firstErrorField = Object.keys(errors)[0];
                  const errorElement = document.querySelector(
                    `[name="${firstErrorField}"]`
                  );
                  if (errorElement) {
                    errorElement.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                    errorElement.focus();
                  }
                  return;
                }

                setIsSubmittingCart(true);
                try {
                  const formDataToSend = new FormData();
                  formDataToSend.append("name", trimmedData.name);
                  formDataToSend.append("email", trimmedData.email);

                  if (editingCart) {
                    // Edit mode: PUT request
                    if (
                      trimmedData.password &&
                      trimmedData.password.length > 0
                    ) {
                      formDataToSend.append("password", trimmedData.password);
                    }
                    formDataToSend.append("cartName", trimmedData.cartName);
                    formDataToSend.append("location", trimmedData.location);
                    if (trimmedData.phone) {
                      const cleanedPhone = trimmedData.phone.replace(
                        /[\s\-]/g,
                        ""
                      );
                      formDataToSend.append("phone", cleanedPhone);
                    }
                    if (trimmedData.address)
                      formDataToSend.append("address", trimmedData.address);
                    if (trimmedData.fssaiNumber)
                      formDataToSend.append("fssaiNumber", trimmedData.fssaiNumber);
                    if (trimmedData.shopActLicenseExpiry)
                      formDataToSend.append(
                        "shopActLicenseExpiry",
                        trimmedData.shopActLicenseExpiry
                      );
                    if (trimmedData.fssaiLicenseExpiry)
                      formDataToSend.append(
                        "fssaiLicenseExpiry",
                        trimmedData.fssaiLicenseExpiry
                      );

                    // Only append files if new ones are selected
                    if (cartFiles.aadharCard)
                      formDataToSend.append("aadharCard", cartFiles.aadharCard);
                    if (cartFiles.panCard)
                      formDataToSend.append("panCard", cartFiles.panCard);
                    if (cartFiles.shopActLicense)
                      formDataToSend.append(
                        "shopActLicense",
                        cartFiles.shopActLicense
                      );
                    if (cartFiles.fssaiLicense)
                      formDataToSend.append(
                        "fssaiLicense",
                        cartFiles.fssaiLicense
                      );

                    await api.put(`/users/${editingCart._id}`, formDataToSend, {
                      headers: { "Content-Type": "multipart/form-data" },
                    });
                  } else {
                    // Create mode: POST request
                    formDataToSend.append("password", trimmedData.password);
                    formDataToSend.append("cartName", trimmedData.cartName);
                    formDataToSend.append("location", trimmedData.location);
                    formDataToSend.append(
                      "franchiseId",
                      selectedFranchiseForCart._id
                    );
                    if (trimmedData.phone) {
                      const cleanedPhone = trimmedData.phone.replace(
                        /[\s\-]/g,
                        ""
                      );
                      formDataToSend.append("phone", cleanedPhone);
                    }
                    if (trimmedData.address)
                      formDataToSend.append("address", trimmedData.address);
                    if (trimmedData.fssaiNumber)
                      formDataToSend.append("fssaiNumber", trimmedData.fssaiNumber);
                    if (trimmedData.shopActLicenseExpiry)
                      formDataToSend.append(
                        "shopActLicenseExpiry",
                        trimmedData.shopActLicenseExpiry
                      );
                    if (trimmedData.fssaiLicenseExpiry)
                      formDataToSend.append(
                        "fssaiLicenseExpiry",
                        trimmedData.fssaiLicenseExpiry
                      );

                    if (cartFiles.aadharCard)
                      formDataToSend.append("aadharCard", cartFiles.aadharCard);
                    if (cartFiles.panCard)
                      formDataToSend.append("panCard", cartFiles.panCard);
                    if (cartFiles.shopActLicense)
                      formDataToSend.append(
                        "shopActLicense",
                        cartFiles.shopActLicense
                      );
                    if (cartFiles.fssaiLicense)
                      formDataToSend.append(
                        "fssaiLicense",
                        cartFiles.fssaiLicense
                      );

                    await api.post(
                      "/users/register-cafe-admin",
                      formDataToSend,
                      {
                        headers: { "Content-Type": "multipart/form-data" },
                      }
                    );
                  }

                  // Success - reset form and close modal
                  setCartFormError(null);
                  setCartFormErrors({});
                  setShowCartModal(false);
                  setSelectedFranchiseForCart(null);
                  setEditingCart(null);
                  setCartExistingDocs({});
                  setCartFormData({
                    name: "",
                    email: "",
                    password: "",
                    confirmPassword: "",
                    cartName: "",
                    location: "",
                    phone: "",
                    address: "",
                    fssaiNumber: "",
                    shopActLicenseExpiry: "",
                    fssaiLicenseExpiry: "",
                  });
                  setCartFiles({
                    aadharCard: null,
                    panCard: null,
                    shopActLicense: null,
                    fssaiLicense: null,
                  });

                  // Get franchise ID before clearing
                  const franchiseId =
                    selectedFranchiseForCart?._id?.toString() ||
                    selectedFranchiseForCart?._id;

                  // Collapse the franchise dropdown to force refresh on next expand
                  if (franchiseId) {
                    const newExpanded = new Set(expandedFranchises);
                    newExpanded.delete(franchiseId);
                    setExpandedFranchises(newExpanded);

                    // Clear cached carts
                    setFranchiseCarts((prev) => {
                      const updated = { ...prev };
                      if (updated[franchiseId]) {
                        delete updated[franchiseId].carts;
                      }
                      return updated;
                    });
                  }

                  // Refresh franchises and cart stats
                  await fetchFranchises();
                } catch (error) {
                  if (import.meta.env.DEV) {
                    console.error("Error creating/updating cart:", error);
                    console.error("Error response:", error.response);
                    console.error("Error data:", error.response?.data);
                  }

                  const errorMessage =
                    error.response?.data?.message ||
                    error.message ||
                    (editingCart
                      ? "Failed to update cart"
                      : "Failed to create cart");

                  // Map backend errors to form fields
                  const lowerErrorMessage = errorMessage.toLowerCase();
                  const backendErrors = {};

                  if (
                    lowerErrorMessage.includes("email already registered") ||
                    lowerErrorMessage.includes("already registered")
                  ) {
                    backendErrors.email = `This email address is already registered. Please use a different email address.`;
                  } else if (lowerErrorMessage.includes("email")) {
                    backendErrors.email = errorMessage;
                  } else if (lowerErrorMessage.includes("password")) {
                    backendErrors.password = errorMessage;
                  } else if (
                    lowerErrorMessage.includes("cart name") ||
                    lowerErrorMessage.includes("cartname")
                  ) {
                    backendErrors.cartName = errorMessage;
                  } else if (lowerErrorMessage.includes("location")) {
                    backendErrors.location = errorMessage;
                  } else {
                    setCartFormError(errorMessage);
                  }

                  if (Object.keys(backendErrors).length > 0) {
                    setCartFormErrors((prev) => ({
                      ...prev,
                      ...backendErrors,
                    }));
                  }

                  // Scroll to error
                  setTimeout(() => {
                    const errorElement =
                      document.querySelector(".bg-red-50") ||
                      document.querySelector('[class*="border-red"]');
                    if (errorElement) {
                      errorElement.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                    }
                  }, 100);
                } finally {
                  setIsSubmittingCart(false);
                }
              }}
            >
              {/* Basic Information */}
              <div className="border-b pb-4">
                <h3 className="text-base font-semibold text-[#4a2e1f] mb-3 flex items-center gap-2">
                  <FaIdCard className="text-[#d86d2a]" />
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      value={cartFormData.name}
                      onChange={(e) => {
                        setCartFormData({
                          ...cartFormData,
                          name: e.target.value,
                        });
                        if (cartFormErrors.name)
                          setCartFormErrors({ ...cartFormErrors, name: "" });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.name
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="John Doe"
                    />
                    {cartFormErrors.name && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={cartFormData.email}
                      onChange={(e) => {
                        setCartFormData({
                          ...cartFormData,
                          email: e.target.value,
                        });
                        if (cartFormErrors.email)
                          setCartFormErrors({ ...cartFormErrors, email: "" });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.email
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="manager@cart.com"
                    />
                    {cartFormErrors.email && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Password {editingCart ? "" : "*"}
                    </label>
                    <input
                      type="password"
                      name="password"
                      required={!editingCart}
                      value={cartFormData.password}
                      onChange={(e) => {
                        setCartFormData({
                          ...cartFormData,
                          password: e.target.value,
                        });
                        if (cartFormErrors.password)
                          setCartFormErrors({
                            ...cartFormErrors,
                            password: "",
                          });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.password
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder={
                        editingCart
                          ? "Leave blank to keep current password"
                          : "Minimum 6 characters"
                      }
                    />
                    {cartFormErrors.password && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.password}
                      </p>
                    )}
                    {!cartFormErrors.password && !editingCart && (
                      <p className="text-xs text-gray-500 mt-1">
                        Password must be at least 6 characters
                      </p>
                    )}
                    {!cartFormErrors.password && editingCart && (
                      <p className="text-xs text-gray-500 mt-1">
                        Leave blank to keep current password
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Confirm Password {editingCart ? "" : "*"}
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      required={!editingCart}
                      value={cartFormData.confirmPassword}
                      onChange={(e) => {
                        setCartFormData({
                          ...cartFormData,
                          confirmPassword: e.target.value,
                        });
                        if (cartFormErrors.confirmPassword)
                          setCartFormErrors({
                            ...cartFormErrors,
                            confirmPassword: "",
                          });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.confirmPassword
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="Confirm password"
                    />
                    {cartFormErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Cart Name *
                    </label>
                    <input
                      type="text"
                      name="cartName"
                      required
                      value={cartFormData.cartName}
                      onChange={(e) => {
                        setCartFormData({
                          ...cartFormData,
                          cartName: e.target.value,
                        });
                        if (cartFormErrors.cartName)
                          setCartFormErrors({
                            ...cartFormErrors,
                            cartName: "",
                          });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.cartName
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="Terra Cart Downtown"
                    />
                    {cartFormErrors.cartName && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.cartName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Location *
                    </label>
                    <input
                      type="text"
                      name="location"
                      required
                      value={cartFormData.location}
                      onChange={(e) => {
                        setCartFormData({
                          ...cartFormData,
                          location: e.target.value,
                        });
                        if (cartFormErrors.location)
                          setCartFormErrors({
                            ...cartFormErrors,
                            location: "",
                          });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.location
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="Downtown, City"
                    />
                    {cartFormErrors.location && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.location}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={cartFormData.phone}
                      onChange={(e) => {
                        setCartFormData({
                          ...cartFormData,
                          phone: e.target.value,
                        });
                        if (cartFormErrors.phone)
                          setCartFormErrors({ ...cartFormErrors, phone: "" });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.phone
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="9876543210 or +91 9876543210"
                    />
                    {cartFormErrors.phone && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.phone}
                      </p>
                    )}
                    {!cartFormErrors.phone && (
                      <p className="text-xs text-gray-500 mt-1">
                        Optional: 10-digit Indian mobile number
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      FSSAI Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="fssaiNumber"
                      value={cartFormData.fssaiNumber}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCartFormData({ ...cartFormData, fssaiNumber: value });
                        if (cartFormErrors.fssaiNumber)
                          setCartFormErrors({
                            ...cartFormErrors,
                            fssaiNumber: "",
                          });
                      }}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                        cartFormErrors.fssaiNumber
                          ? "border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:ring-blue-500"
                      }`}
                      placeholder="e.g., 12345678901234"
                      maxLength={14}
                    />
                    {cartFormErrors.fssaiNumber && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.fssaiNumber}
                      </p>
                    )}
                    {!cartFormErrors.fssaiNumber && (
                      <p className="mt-1 text-xs text-gray-500">
                         14-digit FSSAI number (Inherited from Franchise)
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Address
                    </label>
                    <textarea
                      value={cartFormData.address}
                      onChange={(e) =>
                        setCartFormData({
                          ...cartFormData,
                          address: e.target.value,
                        })
                      }
                      rows="3"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Full address of the cart"
                    />
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-[#4a2e1f] mb-2">
                  Owner Documents
                </h3>
                <p className="text-sm text-[#6b4423] mb-4">
                  📄{" "}
                  {editingCart
                    ? "Upload new files to update existing documents. Leave blank to keep current documents."
                    : "FSSAI License is required. Shop Act License, Aadhar and PAN are optional."}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#4a2e1f]">
                      Aadhar Card of Owner{" "}
                      <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    {editingCart && cartExistingDocs.aadharCard && (
                      <p className="text-xs text-gray-600 mb-1">
                        Current:{" "}
                        <a
                          href={
                            cartExistingDocs.aadharCard?.startsWith("http")
                              ? cartExistingDocs.aadharCard
                              : `${
                                  import.meta.env.VITE_NODE_API_URL ||
                                  "http://localhost:5001"
                                }/${cartExistingDocs.aadharCard}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    )}
                    <input
                      type="file"
                      name="aadharCard"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0] || null;
                        if (file) {
                          // Check file size (max 5MB)
                          const maxSize = 5 * 1024 * 1024;
                          if (file.size > maxSize) {
                            setCartFormErrors({
                              ...cartFormErrors,
                              aadharCard: "File size must be less than 5MB",
                            });
                            e.target.value = "";
                            return;
                          }
                        }
                        setCartFiles({ ...cartFiles, aadharCard: file });
                        if (cartFormErrors.aadharCard)
                          setCartFormErrors({
                            ...cartFormErrors,
                            aadharCard: "",
                          });
                      }}
                      className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                        cartFormErrors.aadharCard
                          ? "border border-red-500 rounded-lg"
                          : ""
                      }`}
                    />
                    {cartFiles.aadharCard && (
                      <p className="mt-1 text-xs text-green-600">
                        ✓ Selected: {cartFiles.aadharCard.name}
                      </p>
                    )}
                    {cartFormErrors.aadharCard && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.aadharCard}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4a2e1f]">
                      PAN Card{" "}
                      <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    {editingCart && cartExistingDocs.panCard && (
                      <p className="text-xs text-gray-600 mb-1">
                        Current:{" "}
                        <a
                          href={
                            cartExistingDocs.panCard?.startsWith("http")
                              ? cartExistingDocs.panCard
                              : `${
                                  import.meta.env.VITE_NODE_API_URL ||
                                  "http://localhost:5001"
                                }/${cartExistingDocs.panCard}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    )}
                    <input
                      type="file"
                      name="panCard"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0] || null;
                        if (file) {
                          // Check file size (max 5MB)
                          const maxSize = 5 * 1024 * 1024;
                          if (file.size > maxSize) {
                            setCartFormErrors({
                              ...cartFormErrors,
                              panCard: "File size must be less than 5MB",
                            });
                            e.target.value = "";
                            return;
                          }
                        }
                        setCartFiles({ ...cartFiles, panCard: file });
                        if (cartFormErrors.panCard)
                          setCartFormErrors({ ...cartFormErrors, panCard: "" });
                      }}
                      className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                        cartFormErrors.panCard
                          ? "border border-red-500 rounded-lg"
                          : ""
                      }`}
                    />
                    {cartFiles.panCard && (
                      <p className="mt-1 text-xs text-green-600">
                        ✓ Selected: {cartFiles.panCard.name}
                      </p>
                    )}
                    {cartFormErrors.panCard && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.panCard}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4a2e1f]">
                      Shop Act License{" "}
                      <span className="text-gray-400 text-xs">(Optional)</span>
                    </label>
                    {editingCart && cartExistingDocs.shopActLicense && (
                      <p className="text-xs text-gray-600 mb-1">
                        Current:{" "}
                        <a
                          href={
                            cartExistingDocs.shopActLicense?.startsWith("http")
                              ? cartExistingDocs.shopActLicense
                              : `${
                                  import.meta.env.VITE_NODE_API_URL ||
                                  "http://localhost:5001"
                                }/${cartExistingDocs.shopActLicense}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    )}
                    <input
                      type="file"
                      name="shopActLicense"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0] || null;
                        if (file) {
                          // Check file size (max 5MB)
                          const maxSize = 5 * 1024 * 1024;
                          if (file.size > maxSize) {
                            setCartFormErrors({
                              ...cartFormErrors,
                              shopActLicense:
                                "File size must be less than 5MB",
                            });
                            e.target.value = "";
                            return;
                          }
                        }
                        setCartFiles({ ...cartFiles, shopActLicense: file });
                        if (cartFormErrors.shopActLicense)
                          setCartFormErrors({
                            ...cartFormErrors,
                            shopActLicense: "",
                          });
                      }}
                      className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                        cartFormErrors.shopActLicense
                          ? "border border-red-500 rounded-lg"
                          : ""
                      }`}
                    />
                    {cartFiles.shopActLicense && (
                      <p className="mt-1 text-xs text-green-600">
                        ✓ Selected: {cartFiles.shopActLicense.name}
                      </p>
                    )}
                    {cartFormErrors.shopActLicense && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.shopActLicense}
                      </p>
                    )}
                    <input
                      type="date"
                      value={cartFormData.shopActLicenseExpiry}
                      onChange={(e) =>
                        setCartFormData({
                          ...cartFormData,
                          shopActLicenseExpiry: e.target.value,
                        })
                      }
                      className="mt-2 block w-full border border-[#e2c1ac] rounded-lg px-3 py-2 text-sm text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                    />
                    <p className="mt-1 text-xs text-[#6b4423]">
                      Expiry Date (Optional)
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#4a2e1f]">
                      FSSAI License{" "}
                      {editingCart ? (
                        ""
                      ) : (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    {editingCart && cartExistingDocs.fssaiLicense && (
                      <p className="text-xs text-gray-600 mb-1">
                        Current:{" "}
                        <a
                          href={
                            cartExistingDocs.fssaiLicense?.startsWith("http")
                              ? cartExistingDocs.fssaiLicense
                              : `${
                                  import.meta.env.VITE_NODE_API_URL ||
                                  "http://localhost:5001"
                                }/${cartExistingDocs.fssaiLicense}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Document
                        </a>
                      </p>
                    )}
                    <input
                      type="file"
                      name="fssaiLicense"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files[0] || null;
                        if (file) {
                          // Check file size (max 5MB)
                          const maxSize = 5 * 1024 * 1024;
                          if (file.size > maxSize) {
                            setCartFormErrors({
                              ...cartFormErrors,
                              fssaiLicense: "File size must be less than 5MB",
                            });
                            e.target.value = "";
                            return;
                          }
                        }
                        setCartFiles({ ...cartFiles, fssaiLicense: file });
                        if (cartFormErrors.fssaiLicense)
                          setCartFormErrors({
                            ...cartFormErrors,
                            fssaiLicense: "",
                          });
                      }}
                      className={`mt-1 block w-full text-sm text-[#6b4423] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#fef4ec] file:text-[#d86d2a] hover:file:bg-[#f5e3d5] ${
                        cartFormErrors.fssaiLicense
                          ? "border border-red-500 rounded-lg"
                          : ""
                      }`}
                    />
                    {cartFiles.fssaiLicense && (
                      <p className="mt-1 text-xs text-green-600">
                        ✓ Selected: {cartFiles.fssaiLicense.name}
                      </p>
                    )}
                    {cartFormErrors.fssaiLicense && (
                      <p className="mt-1 text-xs text-red-600">
                        {cartFormErrors.fssaiLicense}
                      </p>
                    )}
                    <input
                      type="date"
                      value={cartFormData.fssaiLicenseExpiry}
                      onChange={(e) =>
                        setCartFormData({
                          ...cartFormData,
                          fssaiLicenseExpiry: e.target.value,
                        })
                      }
                      className="mt-2 block w-full border border-[#e2c1ac] rounded-lg px-3 py-2 text-sm text-[#4a2e1f] bg-[#fef4ec] focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:border-[#d86d2a]"
                    />
                    <p className="mt-1 text-xs text-[#6b4423]">
                      Expiry Date (Optional)
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-[#6b4423]">
                  {editingCart
                    ? "Upload new files to update existing documents. "
                    : "FSSAI License is required. Shop Act License, Aadhar and PAN are optional. "}
                  Accepted formats: PDF, JPG, PNG, WEBP (Max 5MB per file)
                </p>
              </div>
            </form>
            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCartModal(false);
                  setSelectedFranchiseForCart(null);
                  setEditingCart(null);
                  setCartExistingDocs({});
                  setCartFormError(null);
                  setCartFormErrors({});
                  setIsSubmittingCart(false);
                }}
                disabled={isSubmittingCart}
                className="flex-1 px-4 py-2 text-sm border border-[#e2c1ac] rounded-lg text-[#4a2e1f] hover:bg-[#fef4ec] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="cart-form"
                disabled={isSubmittingCart}
                className="flex-1 px-4 py-2 text-sm font-bold text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] focus:ring-opacity-50 transition-colors shadow-md bg-[#d86d2a] hover:bg-[#c75b1a] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmittingCart ? (
                  <>
                    <FaSpinner className="animate-spin" size={14} />
                    <span>Processing...</span>
                  </>
                ) : editingCart ? (
                  "Update Cart"
                ) : (
                  "Create Cart"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Franchises;
  
