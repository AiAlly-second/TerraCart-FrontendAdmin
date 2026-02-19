import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUtensils,
  FaPlus,
  FaEdit,
  FaTrash,
  FaSpinner,
  FaSave,
  FaChevronDown,
  FaChevronRight,
  FaSync,
  FaBuilding,
  FaUpload,
  FaImage,
  FaTimes,
} from "react-icons/fa";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

// Helper function to normalize image URLs
// Converts absolute URLs from the same API server to relative URLs
// Then prepends API base URL to relative paths
const nodeApiBase =
  import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
const normalizedApiBase = nodeApiBase.replace(/\/$/, "");
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // If it's an absolute URL, check if it's from the same API server
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    // Extract the path from absolute URL if it's from our API server
    try {
      const url = new URL(imagePath);
      const apiUrl = new URL(normalizedApiBase);

      // If same origin (host + port), convert to relative path
      if (url.origin === apiUrl.origin) {
        return imagePath; // Same origin, use as-is (will work)
      }
      // Different origin but has /uploads/ path, try to extract relative path
      if (url.pathname.startsWith("/uploads/")) {
        return `${normalizedApiBase}${url.pathname}`;
      }
    } catch (e) {
      // Invalid URL, fall through to return as-is
    }
    return imagePath; // External URL or invalid, use as-is
  }

  // Relative path starting with /
  if (imagePath.startsWith("/")) {
    return `${normalizedApiBase}${imagePath}`;
  }

  // Just filename, check if it already includes uploads path
  if (imagePath.startsWith("uploads/")) {
    return `${normalizedApiBase}/${imagePath}`;
  }

  // Just filename, construct full path
  return `${normalizedApiBase}/uploads/${imagePath}`;
};

// Decode common HTML entities coming from backend payloads (e.g. "&amp;" => "&")
const htmlEntityDecoder =
  typeof document !== "undefined" ? document.createElement("textarea") : null;

const decodeHtmlEntities = (value) => {
  if (typeof value !== "string") return value ?? "";
  if (!value.includes("&") || !htmlEntityDecoder) return value;
  htmlEntityDecoder.innerHTML = value;
  return htmlEntityDecoder.value;
};

const decodeDefaultMenuPayload = (payload) => {
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  return {
    ...(payload || {}),
    categories: categories.map((category) => ({
      ...category,
      name: decodeHtmlEntities(category?.name || ""),
      description: decodeHtmlEntities(category?.description || ""),
      items: (Array.isArray(category?.items) ? category.items : []).map((item) => ({
        ...item,
        name: decodeHtmlEntities(item?.name || ""),
        description: decodeHtmlEntities(item?.description || ""),
        tags: Array.isArray(item?.tags)
          ? item.tags
              .map((tag) => decodeHtmlEntities(String(tag || "")).trim())
              .filter(Boolean)
          : [],
        allergens: Array.isArray(item?.allergens)
          ? item.allergens
              .map((allergen) =>
                decodeHtmlEntities(String(allergen || "")).trim()
              )
              .filter(Boolean)
          : [],
      })),
    })),
  };
};

const DefaultMenu = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role;
  const normalizedRole = String(userRole || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const isSuperAdmin =
    normalizedRole === "super_admin" || normalizedRole === "superadmin";
  const isFranchiseAdmin =
    normalizedRole === "franchise_admin" ||
    normalizedRole === "franchiseadmin";
  const [defaultMenu, setDefaultMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingItemCategoryIndex, setEditingItemCategoryIndex] =
    useState(null);
  const [franchises, setFranchises] = useState([]);
  const [selectedFranchises, setSelectedFranchises] = useState(new Set());
  const [pushing, setPushing] = useState(false);
  const [pushResults, setPushResults] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });
  const [itemFormData, setItemFormData] = useState({
    name: "",
    description: "",
    price: 0,
    image: "",
    spiceLevel: "NONE",
    isAvailable: true,
    isFeatured: false,
    sortOrder: 0,
    tags: [],
    allergens: [],
    calories: "",
  });

  const spiceLevels = ["NONE", "MILD", "MEDIUM", "HOT", "EXTREME"];

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      // Don't set Content-Type manually - axios will automatically set it with the correct boundary for FormData
      const response = await api.post("/menu/uploads", formData);

      // The backend returns relative URL (e.g., /uploads/filename.jpg)
      // The getImageUrl helper will prepend the API base URL when displaying
      setItemFormData({ ...itemFormData, image: response.data.url });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error uploading image:", error);
      }
      alert(error.response?.data?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    fetchDefaultMenu();
    if (userRole) {
      fetchFranchises();
    }
  }, [userRole]);

  const fetchDefaultMenu = async () => {
    try {
      setLoading(true);
      const response = await api.get("/default-menu");
      const normalizedMenu = decodeDefaultMenuPayload(response.data);
      setDefaultMenu(normalizedMenu);
      // Expand all categories by default
      if (normalizedMenu?.categories) {
        setExpandedCategories(
          new Set(normalizedMenu.categories.map((_, idx) => idx))
        );
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching default menu:", error);
      }
      // Initialize empty menu if none exists
      setDefaultMenu({ categories: [] });
    } finally {
      setLoading(false);
    }
  };

  const fetchFranchises = async () => {
    try {
      const response = await api.get("/users");
      
      // Super Admin: Fetch franchise admins to push menu to franchises
      // Franchise Admin: Fetch cart admins under their franchise to push menu to carts
      if (isSuperAdmin) {
        const franchiseUsers = (response.data || []).filter(
          (u) => u.role === "franchise_admin"
        );
        setFranchises(franchiseUsers);
      } else if (isFranchiseAdmin) {
        const cartUsers = (response.data || []).filter(
          (u) => u.role === "admin" && u.franchiseId?.toString() === user._id?.toString()
        );
        setFranchises(cartUsers);
      }
    } catch (error) {
      console.error("Error fetching franchises/carts:", error);
    }
  };

  // Auto-save helper: persists the current/default menu categories without requiring a manual button
  const handleSave = async (menuToSave = defaultMenu) => {
    if (!menuToSave || !menuToSave.categories) return;
    try {
      setSaving(true);
      await api.put("/default-menu", {
        categories: menuToSave.categories,
      });
      // #region agent log (disabled - analytics service not available in production)
      // Commented out debug analytics call - only enable if analytics service is running
      /*
      fetch(
        "http://127.0.0.1:7242/ingest/660a5fbf-4359-420f-956f-3831103456fb",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "default-menu-sort",
            hypothesisId: "SORT-ORDER-1",
            location: "DefaultMenu.jsx:handleSave",
            message: "Auto-saved default menu categories with sortOrder",
            data: {
              categories: (menuToSave.categories || []).map((c) => ({
                name: c.name,
                sortOrder: c.sortOrder,
                itemCount: Array.isArray(c.items) ? c.items.length : 0,
                items: (c.items || []).map((it) => ({
                  name: it.name,
                  sortOrder: it.sortOrder,
                })),
              })),
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      */
      // #endregion agent log
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error auto-saving default menu:", error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPushModal = () => {
    if (!defaultMenu?.categories || defaultMenu.categories.length === 0) {
      alert("Please create and save menu first before pushing to franchises.");
      return;
    }
    setSelectedFranchises(new Set());
    setPushResults(null);
    setShowPushModal(true);
  };

  const handlePushToFranchises = async () => {
    if (selectedFranchises.size === 0) {
      alert(`Please select at least one ${isSuperAdmin ? "franchise" : "cart"}.`);
      return;
    }

    const selectedList = Array.from(selectedFranchises);
    const targetNames = selectedList
      .map((id) => {
        const f = franchises.find((fr) => fr._id === id);
        return f?.name || f?.cartName || "Unknown";
      })
      .join(", ");

    const targetType = isSuperAdmin ? "franchise" : "cart";
    const targetTypePlural = isSuperAdmin ? "franchises" : "carts";

    // CRITICAL: window.confirm is now async, must await it
    const confirmed = await window.confirm(
      `Push default menu to ${selectedFranchises.size} ${targetType}(s)?\n\n` +
        `${isSuperAdmin ? "Franchises" : "Carts"}: ${targetNames}\n\n` +
        `This will:\n` +
        `${isSuperAdmin
          ? `- Replace the default menu for each selected franchise\n- The franchise menu will then automatically sync to all their carts`
          : `- Replace the menu for each selected cart`
        }\n\n` +
        `${isSuperAdmin ? `- Global add-ons will also be pushed automatically\n\n` : ""}` +
        `Continue?`
    );
    if (!confirmed) {
      return;
    }

    setPushing(true);
    const results = [];

    // Super Admin pushes to franchises, Franchise Admin pushes to carts
    const endpoint = isSuperAdmin ? "franchise" : "cafe";

    for (const targetId of selectedList) {
      const target = franchises.find((f) => f._id === targetId);
      try {
        const response = await api.post(
          `/default-menu/push/${endpoint}/${targetId}`,
          {
            includeAddons: isSuperAdmin,
          }
        );
        const addonMessage =
          isSuperAdmin &&
          response?.data?.addonsResult
            ? response.data.addonsResult.success
              ? ` | Add-ons: ${response.data.addonsResult.templatesFound || 0} template(s) to ${response.data.addonsResult.cartsUpdated || 0} cart(s)`
              : ` | Add-ons: ${response.data.addonsResult.message || "Not pushed"}`
            : "";
        results.push({
          franchiseId: targetId,
          franchiseName: target?.name || target?.cartName || "Unknown",
          success: true,
          message: isSuperAdmin 
            ? `Updated ${response.data.cafesUpdated || 0} carts${addonMessage}`
            : `Menu pushed successfully`,
          data: response.data,
        });
      } catch (error) {
        results.push({
          franchiseId: targetId,
          franchiseName: target?.name || target?.cartName || "Unknown",
          success: false,
          message: error.response?.data?.message || error.message,
        });
      }
    }

    setPushResults(results);
    setPushing(false);
  };

  const toggleSelectAllFranchises = () => {
    if (selectedFranchises.size === franchises.length) {
      setSelectedFranchises(new Set());
    } else {
      setSelectedFranchises(new Set(franchises.map((f) => f._id)));
    }
  };

  const toggleFranchiseSelection = (franchiseId) => {
    const newSelected = new Set(selectedFranchises);
    if (newSelected.has(franchiseId)) {
      newSelected.delete(franchiseId);
    } else {
      newSelected.add(franchiseId);
    }
    setSelectedFranchises(newSelected);
  };

  const toggleCategory = (index) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: "",
      description: "",
      sortOrder: defaultMenu?.categories?.length || 0,
      isActive: true,
    });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category, index) => {
    setEditingCategory(index);
    setCategoryFormData({
      ...category,
      name: decodeHtmlEntities(category?.name || ""),
      description: decodeHtmlEntities(category?.description || ""),
    });
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (e, index) => {
    // Prevent any event bubbling that might trigger item deletion
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Validate index
    if (
      !defaultMenu?.categories ||
      index < 0 ||
      index >= defaultMenu.categories.length
    ) {
      if (import.meta.env.DEV) {
        console.error("Invalid category index for deletion:", index);
      }
      return;
    }

    const category = defaultMenu.categories[index];
    const categoryName = category?.name || "this category";
    const itemCount = category?.items?.length || 0;

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE category "${categoryName}"${
        itemCount > 0 ? ` and ALL ${itemCount} item(s) inside it` : ""
      }?\n\nThis action cannot be undone.`,
      {
        title: "Delete Category",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete Category",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    // Directly remove the category (this automatically removes all items within it)
    const newCategories = [...(defaultMenu?.categories || [])];
    newCategories.splice(index, 1);
    const updatedMenu = { ...defaultMenu, categories: newCategories };
    setDefaultMenu(updatedMenu);
    handleSave(updatedMenu);
  };

  const handleSaveCategory = () => {
    const normalizedCategoryFormData = {
      ...categoryFormData,
      name: decodeHtmlEntities(categoryFormData.name || "").trim(),
      description: decodeHtmlEntities(categoryFormData.description || ""),
    };

    if (!normalizedCategoryFormData.name) {
      alert("Category name is required");
      return;
    }

    const newCategories = [...(defaultMenu?.categories || [])];
    if (editingCategory !== null) {
      newCategories[editingCategory] = {
        ...newCategories[editingCategory],
        ...normalizedCategoryFormData,
        items: newCategories[editingCategory].items || [],
      };
    } else {
      newCategories.push({
        ...normalizedCategoryFormData,
        items: [],
      });
    }
    // Sort categories by sortOrder so UI and storage reflect the chosen order
    newCategories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const updatedMenu = { ...defaultMenu, categories: newCategories };
    setDefaultMenu(updatedMenu);
    handleSave(updatedMenu);
    setShowCategoryModal(false);
    setEditingCategory(null);
  };

  const handleAddItem = (categoryIndex) => {
    setEditingItem(null);
    setEditingItemCategoryIndex(categoryIndex);
    setItemFormData({
      name: "",
      description: "",
      price: 0,
      image: "",
      spiceLevel: "NONE",
      isAvailable: true,
      isFeatured: false,
      sortOrder: (defaultMenu.categories[categoryIndex].items || []).length,
      tags: [],
      allergens: [],
      calories: "",
    });
    setShowItemModal(true);
  };

  const handleEditItem = (item, categoryIndex, itemIndex) => {
    setEditingItem(itemIndex);
    setEditingItemCategoryIndex(categoryIndex);
    setItemFormData({
      ...item,
      name: decodeHtmlEntities(item?.name || ""),
      description: decodeHtmlEntities(item?.description || ""),
      tags: Array.isArray(item?.tags)
        ? item.tags
            .map((tag) => decodeHtmlEntities(String(tag || "")).trim())
            .filter(Boolean)
        : [],
      allergens: Array.isArray(item?.allergens)
        ? item.allergens
            .map((allergen) => decodeHtmlEntities(String(allergen || "")).trim())
            .filter(Boolean)
        : [],
    });
    setShowItemModal(true);
  };

  const handleDeleteItem = async (e, categoryIndex, itemIndex) => {
    e.preventDefault();
    e.stopPropagation();

    const item = defaultMenu.categories[categoryIndex]?.items[itemIndex];
    const itemName = item?.name || "this item";

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE "${itemName}"?\n\nThis action cannot be undone.`,
      {
        title: "Delete Menu Item",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    const newCategories = [...(defaultMenu?.categories || [])];
    newCategories[categoryIndex].items.splice(itemIndex, 1);
    const updatedMenu = { ...defaultMenu, categories: newCategories };
    setDefaultMenu(updatedMenu);
    handleSave(updatedMenu);
  };

  const handleSaveItem = () => {
    const normalizedItemFormData = {
      ...itemFormData,
      name: decodeHtmlEntities(itemFormData.name || "").trim(),
      description: decodeHtmlEntities(itemFormData.description || ""),
      tags: Array.isArray(itemFormData.tags)
        ? itemFormData.tags
            .map((tag) => decodeHtmlEntities(String(tag || "")).trim())
            .filter(Boolean)
        : [],
      allergens: Array.isArray(itemFormData.allergens)
        ? itemFormData.allergens
            .map((allergen) => decodeHtmlEntities(String(allergen || "")).trim())
            .filter(Boolean)
        : [],
    };

    if (!normalizedItemFormData.name) {
      alert("Item name is required");
      return;
    }

    const newCategories = [...(defaultMenu?.categories || [])];
    const category = newCategories[editingItemCategoryIndex];

    if (!category.items) {
      category.items = [];
    }

    if (editingItem !== null) {
      category.items[editingItem] = {
        ...normalizedItemFormData,
        calories: normalizedItemFormData.calories
          ? Number(normalizedItemFormData.calories)
          : undefined,
      };
    } else {
      category.items.push({
        ...normalizedItemFormData,
        calories: normalizedItemFormData.calories
          ? Number(normalizedItemFormData.calories)
          : undefined,
      });
    }

    // Sort items within this category by sortOrder so they render in the chosen order
    category.items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const updatedMenu = { ...defaultMenu, categories: newCategories };
    setDefaultMenu(updatedMenu);
    handleSave(updatedMenu);
    setShowItemModal(false);
    setEditingItem(null);
    setEditingItemCategoryIndex(null);
  };

  // Move an item from one category to another inside the default menu (super/franchise level)
  const handleMoveItemToCategory = (
    fromCategoryIndex,
    itemIndex,
    toCategoryIndex
  ) => {
    if (
      toCategoryIndex === "" ||
      toCategoryIndex === null ||
      toCategoryIndex === undefined
    ) {
      return;
    }
    const targetIndex = Number(toCategoryIndex);
    if (
      Number.isNaN(targetIndex) ||
      targetIndex === fromCategoryIndex ||
      !defaultMenu?.categories ||
      !defaultMenu.categories[fromCategoryIndex] ||
      !defaultMenu.categories[targetIndex]
    ) {
      return;
    }

    const newCategories = [...(defaultMenu?.categories || [])];
    const sourceCat = newCategories[fromCategoryIndex];
    const targetCat = newCategories[targetIndex];

    if (!sourceCat.items || !sourceCat.items[itemIndex]) {
      return;
    }

    const [item] = sourceCat.items.splice(itemIndex, 1);
    if (!targetCat.items) {
      targetCat.items = [];
    }
    // Place at the end of target category and normalize sort order
    item.sortOrder =
      (targetCat.items[targetCat.items.length - 1]?.sortOrder ?? 0) + 1;
    targetCat.items.push(item);
    targetCat.items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const updatedMenu = { ...defaultMenu, categories: newCategories };
    setDefaultMenu(updatedMenu);
    handleSave(updatedMenu);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
            Global Default Menu
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1">
            Create the master menu template. Changes are saved automatically.
            Push this menu to franchises, who can then customize and push to
            their carts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={handleAddCategory}
            className="flex items-center px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base flex-1 sm:flex-initial justify-center"
          >
            <FaPlus className="mr-1.5 sm:mr-2" />
            <span className="whitespace-nowrap">Add Category</span>
          </button>
          {(isSuperAdmin || isFranchiseAdmin) && (
            <button
              onClick={() => navigate("/addons")}
              className="flex items-center px-3 sm:px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm sm:text-base flex-1 sm:flex-initial justify-center"
            >
              <FaPlus className="mr-1.5 sm:mr-2" />
              <span className="whitespace-nowrap">Global Add-ons</span>
            </button>
          )}
          <button
            onClick={handleOpenPushModal}
            disabled={
              !defaultMenu?.categories || defaultMenu.categories.length === 0
            }
            className="flex items-center px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm sm:text-base flex-1 sm:flex-initial justify-center"
          >
            <FaSync className="mr-1.5 sm:mr-2" />
            <span className="whitespace-nowrap">
              Push to {isSuperAdmin ? "Franchises" : "Carts"}
            </span>
          </button>
        </div>
      </div>

      {/* Menu Flow Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3 md:p-4">
        <h3 className="font-semibold text-blue-800 mb-2 text-xs sm:text-sm md:text-base">
          Menu Hierarchy Flow
        </h3>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-2 md:gap-3 lg:gap-4 text-[10px] sm:text-xs md:text-sm text-blue-700">
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0">
            <span className="bg-blue-600 text-white px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold flex-shrink-0">
              1
            </span>
            <span className="whitespace-nowrap truncate">
              Super Admin creates Global Menu
            </span>
          </div>
          <span className="hidden sm:inline text-blue-500">→</span>
          <span className="sm:hidden text-blue-500 text-center w-full">↓</span>
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0">
            <span className="bg-purple-600 text-white px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold flex-shrink-0">
              2
            </span>
            <span className="whitespace-nowrap truncate">
              {isSuperAdmin ? "Push to Franchises" : "Push to Carts"}
            </span>
          </div>
          <span className="hidden sm:inline text-blue-500">→</span>
          <span className="sm:hidden text-blue-500 text-center w-full">↓</span>
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0">
            <span className="bg-green-600 text-white px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold flex-shrink-0">
              3
            </span>
            <span className="whitespace-nowrap truncate">
              {isSuperAdmin ? "Franchise pushes to Carts" : "Cart Admin toggles availability"}
            </span>
          </div>
          <span className="hidden sm:inline text-blue-500">→</span>
          <span className="sm:hidden text-blue-500 text-center w-full">↓</span>
          <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0">
            <span className="bg-orange-600 text-white px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] md:text-xs font-bold flex-shrink-0">
              4
            </span>
            <span className="whitespace-nowrap truncate">
              Cart Admin toggles availability
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-2 sm:p-3 md:p-4 lg:p-6">
        {!defaultMenu?.categories || defaultMenu.categories.length === 0 ? (
          <div className="text-center py-6 sm:py-8 md:py-12 text-gray-500">
            <FaUtensils className="mx-auto text-2xl sm:text-3xl md:text-4xl mb-2 sm:mb-3 md:mb-4" />
            <p className="text-xs sm:text-sm md:text-base mb-2 px-2">
              No categories in default menu. Click "Add Category" to get
              started.
            </p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            {defaultMenu.categories.map((category, catIndex) => (
              <div
                key={catIndex}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 md:p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer relative gap-2 sm:gap-0"
                  onClick={() => toggleCategory(catIndex)}
                >
                  <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-3 min-w-0 flex-1">
                    {expandedCategories.has(catIndex) ? (
                      <FaChevronDown className="text-gray-500 flex-shrink-0 text-xs sm:text-sm" />
                    ) : (
                      <FaChevronRight className="text-gray-500 flex-shrink-0 text-xs sm:text-sm" />
                    )}
                    <FaUtensils className="text-blue-600 flex-shrink-0 text-sm sm:text-base" />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg truncate">
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 truncate mt-0.5">
                          {category.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between sm:justify-end space-x-1.5 sm:space-x-2 md:space-x-3 lg:space-x-4 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] sm:text-xs md:text-sm text-gray-600 hidden sm:inline whitespace-nowrap">
                      {category.items?.length || 0} Items
                    </span>
                    <span
                      className={`px-1 sm:px-1.5 md:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] md:text-xs whitespace-nowrap ${
                        category.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEditCategory(category, catIndex);
                      }}
                      className="p-1 sm:p-1.5 md:p-2 text-blue-600 hover:bg-blue-50 rounded relative z-10 transition-colors"
                      title="Edit Category"
                    >
                      <FaEdit className="text-xs sm:text-sm md:text-base" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Ensure we're deleting the category, not any items
                        handleDeleteCategory(e, catIndex);
                      }}
                      className="p-1 sm:p-1.5 md:p-2 text-red-600 hover:bg-red-50 rounded relative z-10 transition-colors"
                      title="Delete Category"
                    >
                      <FaTrash className="text-xs sm:text-sm md:text-base" />
                    </button>
                  </div>
                </div>

                {expandedCategories.has(catIndex) && (
                  <div className="p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 md:space-y-4">
                    <div className="flex justify-end mb-1 sm:mb-2">
                      <button
                        onClick={() => handleAddItem(catIndex)}
                        className="flex items-center px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs md:text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        <FaPlus className="mr-0.5 sm:mr-1 text-xs sm:text-sm" />
                        <span className="whitespace-nowrap">Add Item</span>
                      </button>
                    </div>
                    {category.items && category.items.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2 md:gap-3">
                        {category.items.map((item, itemIndex) => (
                          <div
                            key={itemIndex}
                            className={`bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow transition-all ${
                              item.isAvailable
                                ? "border-slate-200"
                                : "border-amber-300 bg-amber-50"
                            }`}
                          >
                            {/* Item Image */}
                            <div className="h-24 sm:h-28 md:h-32 lg:h-36 bg-gradient-to-br from-slate-100 to-slate-200 relative">
                              {item.image ? (
                                <img
                                  src={getImageUrl(item.image)}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src =
                                      "https://via.placeholder.com/150x80?text=No+Image";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FaImage className="text-xl sm:text-2xl text-slate-300" />
                                </div>
                              )}
                              {/* Badges */}
                              <div className="absolute top-0.5 sm:top-1 left-0.5 sm:left-1 flex gap-0.5">
                                {item.isFeatured && (
                                  <span className="px-0.5 sm:px-1 py-0.5 bg-yellow-500 text-white text-[9px] sm:text-[10px] rounded">
                                    ⭐
                                  </span>
                                )}
                                {!item.isAvailable && (
                                  <span className="px-0.5 sm:px-1 py-0.5 bg-red-500 text-white text-[9px] sm:text-[10px] rounded">
                                    Off
                                  </span>
                                )}
                              </div>
                              {/* Price */}
                              <div className="absolute bottom-0.5 sm:bottom-1 right-0.5 sm:right-1">
                                <span className="px-1 sm:px-1.5 md:px-1.5 py-0.5 bg-blue-600 text-white font-bold rounded text-[9px] sm:text-[10px] md:text-xs shadow">
                                  ₹
                                  {typeof item.price === "number"
                                    ? item.price.toFixed(0)
                                    : item.price}
                                </span>
                              </div>
                            </div>

                            {/* Item Details */}
                            <div className="p-1.5 sm:p-2">
                              <h4
                                className="font-semibold text-xs sm:text-sm text-slate-800 truncate"
                                title={item.name}
                              >
                                {item.name}
                              </h4>

                              {item.description && (
                                <p className="text-[10px] sm:text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                  {item.description}
                                </p>
                              )}

                              {/* Meta Tags */}
                              <div className="flex flex-wrap items-center gap-1 mt-1 text-[9px] sm:text-[10px]">
                                {item.spiceLevel &&
                                  item.spiceLevel !== "NONE" && (
                                    <span className="text-orange-600">
                                      🌶️ {item.spiceLevel}
                                    </span>
                                  )}
                                {item.calories && (
                                  <span className="text-slate-400">
                                    🔥 {item.calories}cal
                                  </span>
                                )}
                                {item.tags?.length > 0 && (
                                  <span className="text-purple-500">
                                    {item.tags[0]}
                                  </span>
                                )}
                                {item.allergens?.length > 0 && (
                                  <span className="text-red-400">
                                    ⚠️ {item.allergens.length} allergen
                                    {item.allergens.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-slate-100">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      handleEditItem(item, catIndex, itemIndex)
                                    }
                                    className="flex-1 text-[9px] sm:text-[10px] px-1 py-0.5 sm:py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleDeleteItem(e, catIndex, itemIndex)
                                    }
                                    className="p-0.5 sm:p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Delete"
                                  >
                                    <FaTrash className="text-[10px] sm:text-xs" />
                                  </button>
                                </div>

                                {/* Define BOM / Recipe shortcut into Finances for Super/Franchise Admin */}
                                {(isSuperAdmin ||
                                  isFranchiseAdmin) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/costing-v2/recipes?name=${encodeURIComponent(
                                          item.name || ""
                                        )}`
                                      )
                                    }
                                    className="mt-0.5 text-[9px] sm:text-[10px] px-1 py-0.5 rounded border border-green-200 text-green-700 hover:bg-green-50"
                                    title="Define BOM / Recipe for this item in Finances"
                                  >
                                    Define Recipe in Finances
                                  </button>
                                )}

                                {/* Move item to another category (within default menu) */}
                                {defaultMenu?.categories?.length > 1 && (
                                  <div className="flex items-center gap-1">
                                    <label className="text-[9px] text-slate-400">
                                      Move to
                                    </label>
                                    <select
                                      className="flex-1 border border-slate-200 rounded px-1 py-0.5 text-[9px] sm:text-[10px] bg-white"
                                      defaultValue={catIndex}
                                      onChange={(e) => {
                                        const targetIndex = e.target.value;
                                        handleMoveItemToCategory(
                                          catIndex,
                                          itemIndex,
                                          targetIndex
                                        );
                                      }}
                                    >
                                      <option value={catIndex}>
                                        Current category
                                      </option>
                                      {defaultMenu.categories.map(
                                        (cat, idx) =>
                                          idx !== catIndex && (
                                            <option key={idx} value={idx}>
                                              {cat.name ||
                                                `Category ${idx + 1}`}
                                            </option>
                                          )
                                      )}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="col-span-full text-center py-4 sm:py-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <FaUtensils className="text-xl sm:text-2xl mb-1 mx-auto" />
                        <p className="text-xs sm:text-sm px-2">
                          No items yet. Click "Add Item" to add.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Push to Carts Modal */}
      {showPushModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4 lg:p-6 overflow-y-auto">
          <div className="bg-white rounded-lg p-3 sm:p-4 md:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl my-auto mx-2 sm:mx-4">
            <div className="flex justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <FaBuilding className="text-purple-600 flex-shrink-0 text-sm sm:text-base md:text-lg" />
                <span className="truncate">
                  Push Menu to {isSuperAdmin ? "Franchises" : "Carts"}
                </span>
              </h2>
              <button
                onClick={() => {
                  setShowPushModal(false);
                  setPushResults(null);
                  setSelectedFranchises(new Set());
                }}
                className="text-gray-400 hover:text-gray-600 text-xl sm:text-2xl leading-none p-1 ml-1 sm:ml-2 flex-shrink-0"
                aria-label="Close"
              >
                <FaTimes />
              </button>
            </div>

            {pushResults ? (
              // Show results
              <div className="space-y-3 sm:space-y-4">
                <h3 className="font-semibold text-sm sm:text-base md:text-lg">
                  Push Results
                </h3>
                <div className="space-y-2">
                  {pushResults.map((result, idx) => (
                    <div
                      key={idx}
                      className={`p-2 sm:p-3 rounded-lg ${
                        result.success
                          ? "bg-green-50 border border-green-200"
                          : "bg-red-50 border border-red-200"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                        <span className="font-medium text-xs sm:text-sm md:text-base truncate">
                          {result.franchiseName}
                        </span>
                        <span
                          className={`text-xs sm:text-sm whitespace-nowrap ${
                            result.success ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {result.success ? "✓ Success" : "✗ Failed"}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                        {result.message}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-3 sm:pt-4">
                  <button
                    onClick={() => {
                      setShowPushModal(false);
                      setPushResults(null);
                    }}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm md:text-base transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              // Show franchise selection
              <div className="space-y-3 sm:space-y-4">
                <p className="text-gray-600 text-xs sm:text-sm">
                  {isSuperAdmin 
                    ? "Select the franchises you want to push the default menu to. Each franchise will receive a copy of this menu, which they can then customize and push to their carts."
                    : "Select the carts you want to push the default menu to. Each cart will receive a copy of this menu."
                  }
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 border-b pb-2">
                  <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        selectedFranchises.size === franchises.length &&
                        franchises.length > 0
                      }
                      onChange={toggleSelectAllFranchises}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                    />
                    <span className="font-medium text-xs sm:text-sm md:text-base">
                      Select All ({franchises.length} {isSuperAdmin ? "franchises" : "carts"})
                    </span>
                  </label>
                  <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                    {selectedFranchises.size} selected
                  </span>
                </div>

                <div className="max-h-48 sm:max-h-64 overflow-y-auto space-y-2">
                  {franchises.length > 0 ? (
                    franchises.map((franchise) => (
                      <label
                        key={franchise._id}
                        className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFranchises.has(franchise._id)
                            ? "bg-purple-50 border-purple-300"
                            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFranchises.has(franchise._id)}
                          onChange={() =>
                            toggleFranchiseSelection(franchise._id)
                          }
                          className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm md:text-base truncate">
                            {franchise.name}
                          </p>
                          <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 truncate">
                            {franchise.email}
                          </p>
                        </div>
                        <span
                          className={`text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
                            franchise.isActive !== false
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {franchise.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="text-center py-6 sm:py-8 text-gray-500">
                      <FaBuilding className="mx-auto text-2xl sm:text-3xl mb-2" />
                      <p className="text-xs sm:text-sm">
                        No {isSuperAdmin ? "franchises" : "carts"} found
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200 mt-4 sm:mt-6">
                  <button
                    onClick={() => setShowPushModal(false)}
                    className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base w-full sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePushToFranchises}
                    disabled={pushing || selectedFranchises.size === 0}
                    className="flex items-center justify-center px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
                  >
                    {pushing ? (
                      <>
                        <FaSpinner className="animate-spin mr-1.5 sm:mr-2" />
                        <span className="whitespace-nowrap">Pushing...</span>
                      </>
                    ) : (
                      <>
                        <FaSync className="mr-1.5 sm:mr-2" />
                        <span className="whitespace-nowrap">
                          Push to {selectedFranchises.size} Franchise(s)
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
          <div className="bg-white rounded-lg p-3 sm:p-4 md:p-6 w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
            <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-2 sm:mb-3 md:mb-4">
              {editingCategory !== null ? "Edit Category" : "Add Category"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveCategory();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryFormData.name}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={categoryFormData.sortOrder}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={categoryFormData.isActive}
                  onChange={(e) =>
                    setCategoryFormData({
                      ...categoryFormData,
                      isActive: e.target.checked,
                    })
                  }
                  className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4"
                />
                <label className="text-xs sm:text-sm text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                  }}
                  className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto"
                >
                  {editingCategory !== null ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
          <div className="bg-white rounded-lg p-3 sm:p-4 md:p-6 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto mx-2 sm:mx-4">
            <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-2 sm:mb-3 md:mb-4">
              {editingItem !== null ? "Edit Item" : "Add Item"}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveItem();
              }}
              className="space-y-3 sm:space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemFormData.name}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, name: e.target.value })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={itemFormData.price}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        price: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={itemFormData.description}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="2"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Item Image
                  </label>
                  <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3 md:gap-4">
                    {/* Image Preview */}
                    <div className="flex-shrink-0">
                      {itemFormData.image ? (
                        <div className="relative">
                          <img
                            src={getImageUrl(itemFormData.image)}
                            alt="Preview"
                            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-cover rounded-lg border border-gray-300"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src =
                                "https://via.placeholder.com/96?text=No+Image";
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItemFormData({ ...itemFormData, image: "" })
                            }
                            className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white rounded-full p-0.5 sm:p-1 hover:bg-red-600 transition-colors"
                          >
                            <FaTimes className="text-[9px] sm:text-[10px] md:text-xs" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
                          <FaImage className="text-gray-400 text-lg sm:text-xl md:text-2xl" />
                        </div>
                      )}
                    </div>

                    {/* Upload Controls */}
                    <div className="flex-grow space-y-2 w-full sm:w-auto min-w-0">
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-xs sm:text-sm">
                          {uploadingImage ? (
                            <>
                              <FaSpinner className="animate-spin mr-1 sm:mr-1.5 md:mr-2 text-xs sm:text-sm" />
                              <span className="whitespace-nowrap">
                                Uploading...
                              </span>
                            </>
                          ) : (
                            <>
                              <FaUpload className="mr-1 sm:mr-1.5 md:mr-2 text-xs sm:text-sm" />
                              <span className="whitespace-nowrap">
                                Upload Image
                              </span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500">
                        Max size: 5MB. Formats: JPG, PNG, GIF
                      </p>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
                        <span className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 whitespace-nowrap">
                          Or enter URL:
                        </span>
                        <input
                          type="text"
                          value={itemFormData.image}
                          onChange={(e) =>
                            setItemFormData({
                              ...itemFormData,
                              image: e.target.value,
                            })
                          }
                          placeholder="https://example.com/image.jpg or /uploads/image.jpg"
                          className="flex-grow w-full sm:w-auto min-w-0 px-2 py-1 text-[10px] sm:text-xs md:text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Spice Level
                  </label>
                  <select
                    value={itemFormData.spiceLevel}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        spiceLevel: e.target.value,
                      })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {spiceLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={itemFormData.sortOrder}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        sortOrder: Number(e.target.value),
                      })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Calories
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormData.calories}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        calories: e.target.value,
                      })
                    }
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={itemFormData.isAvailable}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        isAvailable: e.target.checked,
                      })
                    }
                    className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4"
                  />
                  <span className="text-xs sm:text-sm text-gray-700">
                    Available
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={itemFormData.isFeatured}
                    onChange={(e) =>
                      setItemFormData({
                        ...itemFormData,
                        isFeatured: e.target.checked,
                      })
                    }
                    className="mr-1.5 sm:mr-2 w-3.5 h-3.5 sm:w-4 sm:h-4"
                  />
                  <span className="text-xs sm:text-sm text-gray-700">
                    Featured
                  </span>
                </label>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowItemModal(false);
                    setEditingItem(null);
                    setEditingItemCategoryIndex(null);
                  }}
                  className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm sm:text-base w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base w-full sm:w-auto"
                >
                  {editingItem !== null ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DefaultMenu;


