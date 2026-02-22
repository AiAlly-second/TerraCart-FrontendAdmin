import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

// Helper: get API base URL with protocol ensured
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
  // If URL doesn't start with http:// or https://, add http://
  if (envUrl && !envUrl.match(/^https?:\/\//)) {
    return `http://${envUrl}`;
  }
  return envUrl;
};

// Helper function to normalize image URLs
// Converts absolute URLs from the same API server to proper URLs
// Then prepends API base URL to relative paths
const nodeApiBase = getApiBaseUrl();
const normalizedApiBase = nodeApiBase.replace(/\/$/, "");
const sanitizeAddonName = (value) => {
  const normalized = String(value || "")
    .replace(/^\(\s*\+\s*\)\s*/u, "")
    .trim();
  return normalized || "Add-on";
};
const htmlEntityDecoder =
  typeof document !== "undefined" ? document.createElement("textarea") : null;
const decodeHtmlEntities = (value) => {
  const input = String(value ?? "");
  if (!input.includes("&")) return input;
  if (!htmlEntityDecoder) return input;
  let decoded = input;
  for (let i = 0; i < 2; i += 1) {
    htmlEntityDecoder.innerHTML = decoded;
    const next = htmlEntityDecoder.value;
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
};
const normalizeMenuPayload = (payload) =>
  (Array.isArray(payload) ? payload : []).map((category) => ({
    ...category,
    name: decodeHtmlEntities(category?.name || ""),
    description: decodeHtmlEntities(category?.description || ""),
    icon: decodeHtmlEntities(category?.icon || ""),
    items: (Array.isArray(category?.items) ? category.items : []).map((item) => ({
      ...item,
      name: decodeHtmlEntities(item?.name || ""),
      description: decodeHtmlEntities(item?.description || ""),
      image: decodeHtmlEntities(item?.image || ""),
      tags: Array.isArray(item?.tags)
        ? item.tags.map((tag) => decodeHtmlEntities(String(tag || "")))
        : item?.tags,
      allergens: Array.isArray(item?.allergens)
        ? item.allergens.map((allergen) =>
            decodeHtmlEntities(String(allergen || ""))
          )
        : item?.allergens,
    })),
  }));
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

const emptyCategoryForm = {
  name: "",
  description: "",
  icon: "",
  sortOrder: 0,
  isActive: true,
};

const emptyItemForm = {
  name: "",
  description: "",
  price: "",
  image: "",
  spiceLevel: "NONE",
  sortOrder: 0,
  isAvailable: true,
  isFeatured: false,
  tags: "",
  allergens: "",
  calories: "",
};

const MenuManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = user?.role;
  
  // Debug: Log user role to verify it's being read correctly
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("[MenuManager] User role:", userRole, "User:", user);
    }
  }, [userRole, user]);
  
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [categorySaving, setCategorySaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [itemSaving, setItemSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [spiceLevels, setSpiceLevels] = useState([
    "NONE",
    "MILD",
    "MEDIUM",
    "HOT",
    "EXTREME",
  ]);
  const [addons, setAddons] = useState([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [addonsError, setAddonsError] = useState("");

  const selectedCategory = useMemo(
    () => menu.find((cat) => cat._id === selectedCategoryId) || null,
    [menu, selectedCategoryId]
  );

  const loadMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const [menuRes, spiceRes] = await Promise.all([
        api.get("/menu"),
        api.get("/menu/meta/spice-levels").catch(() => null),
      ]);
      const menuData = normalizeMenuPayload(menuRes.data || []);

      // Log menu data (development only)
      if (import.meta.env.DEV) {
        console.log(
          "[FRANCHISE ADMIN] Menu loaded:",
          menuData.length,
          "categories"
        );
        menuData.forEach((cat, catIdx) => {
          if (cat.items && cat.items.length > 0) {
            cat.items.forEach((item, itemIdx) => {
              console.log(
                `[FRANCHISE ADMIN] Category ${catIdx + 1}, Item ${
                  itemIdx + 1
                }: "${item.name}" - Image: ${item.image || "NO IMAGE"}`
              );
            });
          }
        });
      }

      setMenu(menuData);
      if (spiceRes?.data?.spiceLevels) {
        setSpiceLevels(spiceRes.data.spiceLevels);
      }
      if (menuData.length && !selectedCategoryId && menuData[0]?._id) {
        setSelectedCategoryId(menuData[0]._id);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error(err);
      }
      setError(err.response?.data?.message || "Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const loadAddons = async () => {
    if (userRole !== "admin") return;
    try {
      setAddonsLoading(true);
      setAddonsError("");
      const response = await api.get("/addons");
      const list = Array.isArray(response?.data?.data)
        ? response.data.data.map((addon) => ({
            ...addon,
            name: sanitizeAddonName(addon?.name),
          }))
        : [];
      setAddons(list);
    } catch (err) {
      setAddons([]);
      setAddonsError(err.response?.data?.message || "Failed to load add-ons");
    } finally {
      setAddonsLoading(false);
    }
  };

  const handleToggleAddonAvailability = async (addon) => {
    if (!addon?._id) return;
    try {
      await api.put(`/addons/${addon._id}`, {
        isAvailable: addon.isAvailable === false,
      });
      await loadAddons();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update add-on status");
    }
  };

  useEffect(() => {
    if (userRole === "admin") {
      loadAddons();
    }
  }, [userRole]);

  const handleCategorySubmit = async (event) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) {
      return alert("Category name is required");
    }
    setCategorySaving(true);
    try {
      if (editingCategoryId) {
        await api.patch(`/menu/categories/${editingCategoryId}`, categoryForm);
      } else {
        await api.post("/menu/categories", categoryForm);
      }
      setCategoryForm(emptyCategoryForm);
      setEditingCategoryId(null);
      await loadMenu();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save category");
    } finally {
      setCategorySaving(false);
    }
  };

  const handleEditCategory = (category) => {
    if (!category || !category._id) {
      console.error("Cannot edit: invalid category", category);
      return;
    }
    setCategoryForm({
      name: category.name || "",
      description: category.description || "",
      icon: category.icon || "",
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
    });
    setEditingCategoryId(category._id);
  };

  const handleDeleteCategory = async (e, category) => {
    if (!category || !category._id) {
      console.error("Cannot delete: invalid category", category);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE category "${
        category.name || "this category"
      }"?\n\nThis requires the category to be empty. This action cannot be undone.`,
      {
        title: "Delete Category",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    try {
      await api.delete(`/menu/categories/${category._id}`);
      if (selectedCategoryId === category._id) {
        setSelectedCategoryId(null);
      }
      await loadMenu();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete category");
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm(emptyCategoryForm);
    setEditingCategoryId(null);
  };

  const handleItemSubmit = async (event) => {
    event.preventDefault();
    if (!selectedCategoryId) {
      return alert("Please select a category first");
    }
    if (!itemForm.name.trim()) {
      return alert("Item name is required");
    }
    if (!itemForm.price) {
      return alert("Item price is required");
    }
    const payload = {
      ...itemForm,
      price: Number(itemForm.price),
      calories: itemForm.calories ? Number(itemForm.calories) : undefined,
      tags: itemForm.tags
        ? itemForm.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      allergens: itemForm.allergens
        ? itemForm.allergens
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    };
    delete payload.tagsOriginal;
    delete payload.allergensOriginal;
    setItemSaving(true);
    try {
      if (editingItemId) {
        await api.patch(`/menu/items/${editingItemId}`, {
          ...payload,
          categoryId: selectedCategoryId,
        });
      } else {
        await api.post("/menu/items", {
          ...payload,
          categoryId: selectedCategoryId,
        });
      }
      setItemForm(emptyItemForm);
      setEditingItemId(null);
      await loadMenu();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save menu item");
    } finally {
      setItemSaving(false);
    }
  };

  // Move a menu item from the current category to another category (cart/franchise level)
  const handleMoveItemToCategory = async (item, targetCategoryId) => {
    if (
      !item ||
      !item._id ||
      !targetCategoryId ||
      targetCategoryId === selectedCategoryId
    ) {
      return;
    }
    try {
      await api.patch(`/menu/items/${item._id}`, {
        categoryId: targetCategoryId,
      });
      // Reload menu so UI reflects new category assignment
      await loadMenu();
      // Optionally, keep current category selected; item will disappear from this list
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to move item to the selected category"
      );
    }
  };

  const handleEditItem = (item) => {
    if (!item || !item._id) {
      console.error("Cannot edit: invalid item", item);
      return;
    }
    setItemForm({
      name: item.name || "",
      description: item.description || "",
      price: item.price ?? "",
      image: item.image || "",
      spiceLevel: item.spiceLevel || "NONE",
      sortOrder: item.sortOrder ?? 0,
      isAvailable: item.isAvailable ?? true,
      isFeatured: item.isFeatured ?? false,
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
      allergens: Array.isArray(item.allergens) ? item.allergens.join(", ") : "",
      calories: item.calories ?? "",
    });
    setEditingItemId(item._id);
  };

  const resetItemForm = () => {
    setItemForm(emptyItemForm);
    setEditingItemId(null);
  };

  const handleDeleteItem = async (e, item) => {
    if (!item || !item._id) {
      console.error("Cannot delete: invalid item", item);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const { confirm } = await import("../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE "${
        item.name || "this item"
      }" from the menu?\n\nThis action cannot be undone.`,
      {
        title: "Delete Menu Item",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    try {
      await api.delete(`/menu/items/${item._id}`);
      await loadMenu();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete menu item");
    }
  };

  const handleToggleAvailability = async (item) => {
    if (!item || !item._id) {
      console.error("Cannot toggle availability: invalid item", item);
      return;
    }
    try {
      await api.patch(`/menu/items/${item._id}/availability`, {
        isAvailable: !item.isAvailable,
      });
      await loadMenu();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update availability");
    }
  };

  const handleToggleSpecial = async (item) => {
    if (!item || !item._id) {
      console.error("Cannot toggle special flag: invalid item", item);
      return;
    }
    try {
      await api.patch(`/menu/items/${item._id}`, {
        isFeatured: !(item.isFeatured === true),
      });
      await loadMenu();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update special item flag");
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("image", file);
    setUploadingImage(true);
    try {
      // Don't set Content-Type manually - axios will automatically set it with the correct boundary for FormData
      const { data } = await api.post("/menu/uploads", formData);
      setItemForm((prev) => ({ ...prev, image: data.url }));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const categoriesSorted = useMemo(
    () =>
      [...menu].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.name.localeCompare(b.name);
      }),
    [menu]
  );

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          Menu Manager
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-1">
          Maintain menu categories, items, and availability. Changes sync
          instantly to the customer app.
        </p>
      </div>

      {userRole === "admin" && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Add-ons</h2>
              <p className="text-xs text-slate-500 mt-1">
                Add-ons are managed by franchise admin. You can only hide or
                show them for this cart.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAddons}
              className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>

          {addonsLoading ? (
            <div className="mt-4 text-sm text-slate-500">Loading add-ons...</div>
          ) : addonsError ? (
            <div className="mt-4 text-sm text-red-600">{addonsError}</div>
          ) : addons.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">
              No add-ons available for this cart.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {addons.map((addon) => (
                <div
                  key={addon._id}
                  className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {sanitizeAddonName(addon.name)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ₹{Number(addon.price || 0).toFixed(2)}
                    </p>
                    {addon.description ? (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {addon.description}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleAddonAvailability(addon)}
                    className={`text-xs px-2.5 py-1.5 rounded border ${
                      addon.isAvailable !== false
                        ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                        : "border-green-200 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {addon.isAvailable !== false ? "Hide" : "Show"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 md:p-4 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-6 md:p-8 text-center text-slate-500">
          Loading menu...
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 items-start">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5 space-y-4 md:space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Categories
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Sort order controls the display order in both admin and customer
                menus.
              </p>
            </div>

            <div className="space-y-3">
              {categoriesSorted.map((category) => (
                <div
                  key={category._id}
                  onClick={() => setSelectedCategoryId(category._id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedCategoryId(category._id);
                    }
                  }}
                  className={`w-full text-left px-4 py-3 border rounded-lg transition ${
                    selectedCategoryId === category._id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{category.name}</p>
                      {category.description && (
                        <p className="text-xs text-slate-500 mt-1">
                          {category.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {category.items?.length ?? 0} items
                    </span>
                  </div>
                  {!category.isActive && (
                    <p className="text-xs text-amber-600 mt-1">
                      Inactive · hidden from customers
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleEditCategory(category);
                      }}
                      className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    {/* Hide delete button for cart admin (role: "admin") */}
                    {userRole !== "admin" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(e, category);
                        }}
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-100"
                        title={`Delete category (visible to ${userRole || 'unknown role'})`}
                      >
                        Delete
                      </button>
                    )}
                    {/* Debug indicator - remove after verification */}
                    {import.meta.env.DEV && userRole === "admin" && (
                      <span className="text-[10px] text-gray-400 italic">
                        (delete hidden)
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {categoriesSorted.length === 0 && (
                <div className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg px-4 py-6 text-center">
                  No categories yet. Create your first category to start
                  building the menu.
                </div>
              )}
            </div>

            {(userRole !== "admin" || editingCategoryId) && (
            <form
              onSubmit={handleCategorySubmit}
              className="space-y-3 border-t border-slate-200 pt-4"
            >
              <h3 className="text-sm font-semibold text-slate-700">
                {editingCategoryId ? "Edit category" : "Add new category"}
              </h3>
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">Name</label>
                <input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Starters"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">
                  Description
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Short summary"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs text-slate-500">
                    Sort order
                  </label>
                  <input
                    type="number"
                    value={categoryForm.sortOrder}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        sortOrder: Number(e.target.value || 0),
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs text-slate-500">
                    Icon URL (optional)
                  </label>
                  <input
                    value={categoryForm.icon}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        icon: e.target.value,
                      }))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={categoryForm.isActive}
                  onChange={(e) =>
                    setCategoryForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                />
                Active (visible to customers)
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={categorySaving}
                  className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {categorySaving
                    ? editingCategoryId
                      ? "Saving..."
                      : "Creating..."
                    : editingCategoryId
                    ? "Save changes"
                    : "Create category"}
                </button>
                {editingCategoryId && (
                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                    onClick={resetCategoryForm}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
            )}
          </div>

          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Items {selectedCategory ? `· ${selectedCategory.name}` : ""}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Toggle availability to hide items temporarily. Once marked
                  unavailable, the customer app instantly prevents ordering.
                  Mark items as Special to show them in the customer special
                  section.
                </p>
              </div>
            </div>

            {!selectedCategory ? (
              <div className="p-6 text-center text-slate-500 border border-dashed border-slate-300 rounded-lg">
                Select a category to manage its items.
              </div>
            ) : (
              <>
                {/* Items Grid View */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                  {(selectedCategory?.items || []).map((item) => (
                    <div
                      key={item?._id || Math.random()}
                      className={`bg-white rounded-lg border overflow-hidden shadow-sm hover:shadow transition-all ${
                        item.isAvailable
                          ? "border-slate-200"
                          : "border-amber-300 bg-amber-50"
                      }`}
                    >
                      {/* Item Image */}
                      <div className="h-32 md:h-36 bg-gradient-to-br from-slate-100 to-slate-200 relative">
                        {item?.image ? (
                          <img
                            src={getImageUrl(item.image)}
                            alt={item?.name || "Menu item"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error(
                                "[FRANCHISE ADMIN] Image load error for:",
                                item.name,
                                "URL:",
                                getImageUrl(item.image)
                              );
                              e.target.onerror = null;
                              e.target.src =
                                "https://via.placeholder.com/150x80?text=No+Image";
                            }}
                            onLoad={() => {
                              console.log(
                                "[FRANCHISE ADMIN] Image loaded successfully for:",
                                item.name,
                                "URL:",
                                getImageUrl(item.image)
                              );
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-2xl text-slate-300">🍽️</span>
                          </div>
                        )}
                        {/* Badges */}
                        <div className="absolute top-1 left-1 flex gap-0.5 items-center flex-wrap">
                          {item.isFeatured && (
                            <span className="px-1 py-0.5 bg-purple-600 text-white text-[10px] rounded">
                              Special
                            </span>
                          )}
                          {!item.isAvailable && (
                            <span className="px-1 py-0.5 bg-red-500 text-white text-[10px] rounded">
                              Off
                            </span>
                          )}
                        </div>
                        {/* Price */}
                        <div className="absolute bottom-1 right-1">
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white font-bold rounded text-xs shadow">
                            ₹{item?.price ? Number(item.price).toFixed(0) : "0"}
                          </span>
                        </div>
                      </div>

                      {/* Item Details */}
                      <div className="p-2">
                        <h4
                          className="font-semibold text-sm text-slate-800 truncate"
                          title={item?.name || "Unnamed item"}
                        >
                          {item?.name || "Unnamed item"}
                        </h4>

                        {item?.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        )}

                        {/* Meta Tags */}
                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px]">
                          {item?.spiceLevel && item.spiceLevel !== "NONE" && (
                            <span>🌶️</span>
                          )}
                          {item?.calories && (
                            <span className="text-slate-400">
                              {item.calories}cal
                            </span>
                          )}
                          {item?.tags &&
                            Array.isArray(item.tags) &&
                            item.tags.length > 0 && (
                              <span className="text-purple-500">
                                {item.tags[0]}
                              </span>
                            )}
                          {item?.allergens &&
                            Array.isArray(item.allergens) &&
                            item.allergens.length > 0 && (
                              <span className="text-red-400">⚠️</span>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                item && handleToggleAvailability(item)
                              }
                              className={`flex-1 text-[10px] px-1 py-1 rounded border ${
                                item?.isAvailable !== false
                                  ? "border-amber-200 text-amber-600"
                                  : "border-green-200 text-green-600"
                              }`}
                            >
                              {item?.isAvailable !== false ? "Hide" : "Show"}
                            </button>
                            <button
                              onClick={() => item && handleToggleSpecial(item)}
                              className={`flex-1 text-[10px] px-1 py-1 rounded border ${
                                item?.isFeatured
                                  ? "border-purple-200 text-purple-700 bg-purple-50"
                                  : "border-slate-200 text-slate-600"
                              }`}
                            >
                              {item?.isFeatured ? "Special On" : "Special Off"}
                            </button>
                            <button
                              onClick={() => item && handleEditItem(item)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <FaEdit size={11} />
                            </button>
                            {/* Only show delete button for franchise_admin and super_admin, not cart admin */}
                            {userRole !== "admin" && (
                              <button
                                type="button"
                                onClick={(e) => item && handleDeleteItem(e, item)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <FaTrash size={11} />
                              </button>
                            )}
                          </div>

                          {/* Define BOM / Recipe shortcut into Finances for Franchise Admin */}
                          {userRole === "franchise_admin" && (
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/costing-v2/recipes?name=${encodeURIComponent(
                                    item?.name || ""
                                  )}`
                                )
                              }
                              className="mt-0.5 text-[9px] px-1 py-0.5 rounded border border-green-200 text-green-700 hover:bg-green-50"
                              title="Define BOM / Recipe for this item in Finances"
                            >
                              Define Recipe in Finances
                            </button>
                          )}

                          {/* Move item to another category */}
                          {menu?.length > 1 && (
                            <div className="flex items-center gap-1">
                              <label className="text-[9px] text-slate-400">
                                Move to
                              </label>
                              <select
                                className="flex-1 border border-slate-200 rounded px-1 py-0.5 text-[9px] bg-white"
                                defaultValue=""
                                onChange={(e) => {
                                  const targetId = e.target.value;
                                  if (!targetId) return;
                                  handleMoveItemToCategory(item, targetId);
                                  // Reset to placeholder so user can move again
                                  e.target.value = "";
                                }}
                              >
                                <option value="">Select category</option>
                                {menu
                                  .filter(
                                    (cat) => cat._id !== selectedCategoryId
                                  )
                                  .map((cat) => (
                                    <option key={cat._id} value={cat._id}>
                                      {cat.name || "Unnamed Category"}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedCategory.items?.length === 0 && (
                    <div className="col-span-full text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                      <span className="text-2xl mb-1 block">🍽️</span>
                      <p className="text-sm">
                        No items yet. Use form below to add.
                      </p>
                    </div>
                  )}
                </div>

                {(userRole !== "admin" || editingItemId) && (
                <form
                  onSubmit={handleItemSubmit}
                  className="border border-slate-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">
                      {editingItemId ? "Edit menu item" : "Add new menu item"}
                    </h3>
                    {editingItemId && (
                      <button
                        type="button"
                        onClick={resetItemForm}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-500">
                        Name
                      </label>
                      <input
                        value={itemForm.name}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Dish name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-500">
                        Price (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemForm.price}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            price: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="199"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-slate-500">
                      Description
                    </label>
                    <textarea
                      value={itemForm.description}
                      onChange={(e) =>
                        setItemForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      rows={2}
                      placeholder="Short summary"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-500">
                        Image URL
                      </label>
                      <input
                        value={itemForm.image}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            image: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="https://..."
                      />
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                          <span className="px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-100">
                            Upload image
                          </span>
                        </label>
                        {uploadingImage && <span>Uploading...</span>}
                      </div>
                      {itemForm.image && (
                        <img
                          src={getImageUrl(itemForm.image)}
                          alt="Preview"
                          className="mt-2 h-24 w-24 rounded-lg object-cover border border-slate-200"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-500">
                        Spice level
                      </label>
                      <select
                        value={itemForm.spiceLevel}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            spiceLevel: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      >
                        {spiceLevels.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-500">
                        Sort order
                      </label>
                      <input
                        type="number"
                        value={itemForm.sortOrder}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            sortOrder: Number(e.target.value || 0),
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-500">
                        Calories
                      </label>
                      <input
                        type="number"
                        value={itemForm.calories}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            calories: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs text-slate-500">
                        Tags
                      </label>
                      <input
                        value={itemForm.tags}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            tags: e.target.value,
                          }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="comma-separated e.g. vegan, bestseller"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs text-slate-500">
                      Allergens
                    </label>
                    <input
                      value={itemForm.allergens}
                      onChange={(e) =>
                        setItemForm((prev) => ({
                          ...prev,
                          allergens: e.target.value,
                        }))
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="comma-separated e.g. nuts, dairy"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={itemForm.isAvailable}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            isAvailable: e.target.checked,
                          }))
                        }
                      />
                      Available
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={itemForm.isFeatured}
                        onChange={(e) =>
                          setItemForm((prev) => ({
                            ...prev,
                            isFeatured: e.target.checked,
                          }))
                        }
                      />
                      Show as Special item (Customer side)
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={itemSaving}
                      className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {itemSaving
                        ? editingItemId
                          ? "Saving..."
                          : "Creating..."
                        : editingItemId
                        ? "Save changes"
                        : "Create item"}
                    </button>
                    {(itemForm.name || itemForm.price) && (
                      <button
                        type="button"
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100"
                        onClick={resetItemForm}
                      >
                        Reset form
                      </button>
                    )}
                  </div>
                </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManager;

