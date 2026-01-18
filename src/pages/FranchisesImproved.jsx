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
  FaCog,
  FaChartLine,
} from "react-icons/fa";
import api from "../utils/api";
import { confirmFranchiseDelete, confirm } from "../utils/confirm";

const FranchisesImproved = () => {
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
  const [selectedFranchiseForCart, setSelectedFranchiseForCart] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    mobile: "",
    fssaiNumber: "",
  });
  const [files, setFiles] = useState({
    udyamCertificate: null,
    aadharCard: null,
    panCard: null,
  });
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all"); // "all", "active", "inactive"
  const [viewMode, setViewMode] = useState("table"); // "table", "cards"

  useEffect(() => {
    fetchFranchises();
  }, []);

  const fetchFranchises = async () => {
    try {
      setLoading(true);
      const response = await api.get("/users");
      const allUsers = response.data || [];
      const franchiseUsers = allUsers.filter((u) => u.role === "franchise_admin");
      setFranchises(franchiseUsers);

      try {
        const cartStatsResponse = await api.get("/users/stats/carts");
        const cartStats = cartStatsResponse.data || {};
        if (cartStats.franchiseStats) {
          const statsMap = {};
          cartStats.franchiseStats.forEach((stat) => {
            const franchiseId = stat.franchiseId?.toString() || stat.franchiseId;
            const existingCarts = franchiseCarts[franchiseId]?.carts || null;

            statsMap[franchiseId] = {
              totalCarts: stat.totalCarts || 0,
              activeCarts: stat.activeCarts || 0,
              inactiveCarts: stat.inactiveCarts || 0,
              pendingApproval: stat.pendingApproval || 0,
              ...(existingCarts ? { carts: existingCarts } : {}),
            };
          });
          setFranchiseCarts(statsMap);
        }
      } catch (err) {
        console.error("Error fetching cart statistics:", err);
      }
    } catch (error) {
      console.error("Error fetching franchises:", error);
      alert("Failed to fetch franchises");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (franchiseId) => {
    const franchise = franchises.find((f) => f._id === franchiseId);
    if (!franchise) return;
    
    const isCurrentlyActive = franchise.isActive !== false;
    const action = isCurrentlyActive ? "DEACTIVATE" : "ACTIVATE";

    const confirmed = await confirm(
      `${action} franchise "${franchise.name}"?`,
      {
        title: `${action} Franchise`,
        danger: isCurrentlyActive,
        confirmText: action,
      }
    );

    if (!confirmed) return;

    try {
      await api.patch(`/users/${franchiseId}/toggle-status`);
      fetchFranchises();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update franchise status");
    }
  };

  const filterBySearch = franchises.filter((franchise) =>
    franchise.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    franchise.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    franchise.franchiseCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

 const filteredFranchises = filterBySearch.filter((franchise) => {
    const isActive = franchise.isActive !== false;
    if (filterStatus === "active") return isActive;
    return true;
  });

  return (
    <div className="p-4">
      <h1>Franchises (Incomplete File)</h1>
      <p>This component seems to be incomplete in the codebase.</p>
    </div>
  );
};

export default FranchisesImproved;
