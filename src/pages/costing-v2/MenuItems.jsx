import React, { useEffect, useState } from "react";
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getRecipes,
  getDefaultMenuItems,
  syncMenuItemsFromDefault,
  linkMatchingBoms,
} from "../../services/costingV2Api";
import { useAuth } from "../../context/AuthContext";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaLink,
  FaCheck,
  FaChartPie,
  FaExclamationTriangle,
  FaSync,
  FaMagic,
} from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";

const MenuItems = () => {
  const { user } = useAuth();
  const isCartAdmin = user?.role === "admin";
  const [menuItems, setMenuItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [defaultMenuItems, setDefaultMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [linkingBoms, setLinkingBoms] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    sellingPrice: 0,
    recipeId: "",
    isActive: true,
    defaultMenuFranchiseId: null,
    defaultMenuCategoryName: "",
    defaultMenuItemName: "",
  });

  useEffect(() => {
    fetchData();
  }, [selectedOutlet]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedOutlet ? { cartId: selectedOutlet } : {};
      const [menuItemsRes, recipesRes, defaultMenuRes] = await Promise.all([
        getMenuItems(params),
        getRecipes(),
        isCartAdmin
          ? getDefaultMenuItems()
          : Promise.resolve({ data: { success: true, data: [] } }),
      ]);
      if (menuItemsRes.data.success) setMenuItems(menuItemsRes.data.data);
      if (recipesRes.data.success) setRecipes(recipesRes.data.data);
      if (defaultMenuRes.data.success)
        setDefaultMenuItems(defaultMenuRes.data.data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching data:", error);
      }
      alert("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // For super_admin / franchise_admin we MUST know which outlet (cart) to create into
      if (!isCartAdmin && !selectedOutlet) {
        alert(
          "Please select an outlet/cart at the top-right before creating a menu item.",
        );
        return;
      }

      // For cart admin creating new item, validate that menu item is selected
      if (isCartAdmin && !editing) {
        if (!formData.name || !formData.category) {
          alert("Please select a menu item from your operational menu.");
          return;
        }
        if (!formData.sellingPrice || formData.sellingPrice <= 0) {
          alert(
            "Selling price is required. Please select a menu item from your menu.",
          );
          return;
        }
      }

      const payload = {
        ...formData,
        // For cart admin, backend derives cartId from the user.
        // For super/franchise admin, we send the selected cart explicitly.
        cartId: isCartAdmin ? undefined : selectedOutlet,
      };

      if (editing) {
        await updateMenuItem(editing._id, payload);
        alert("Menu item updated successfully!");
      } else {
        await createMenuItem(payload);
        alert("Menu item created successfully!");
      }
      setModalOpen(false);
      setEditing(null);
      resetForm();
      fetchData();
    } catch (error) {
      alert(
        `Failed to save menu item: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      sellingPrice: 0,
      recipeId: "",
      isActive: true,
      defaultMenuFranchiseId: null,
      defaultMenuCategoryName: "",
      defaultMenuItemName: "",
    });
  };

  const stats = {
    total: menuItems.length,
    active: menuItems.filter((m) => m.isActive).length,
    linked: menuItems.filter((m) => m.defaultMenuPath).length,
    highFoodCost: menuItems.filter((m) => (m.foodCostPercent || 0) > 40).length,
    noBom: menuItems.filter((m) => !m.recipeId || !m.recipeId._id).length,
  };

  const handleSyncFromCart = async () => {
    try {
      setSyncing(true);
      const payload = isCartAdmin ? {} : { cartId: selectedOutlet };
      const res = await syncMenuItemsFromDefault(payload);
      if (res.data?.success) {
        alert(
          res.data.data?.message ||
            `Synced ${res.data.data?.updated || 0} items. ${res.data.data?.created || 0} created.`
        );
        fetchData();
      } else {
        alert(res.data?.message || "Sync failed");
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkMatchingBoms = async () => {
    try {
      setLinkingBoms(true);
      const payload = isCartAdmin ? {} : { cartId: selectedOutlet };
      const res = await linkMatchingBoms(payload);
      if (res.data?.success) {
        alert(
          res.data.data?.message ||
            `Linked ${res.data.data?.linked || 0} menu items to BOMs.`
        );
        fetchData();
      } else {
        alert(res.data?.message || "Link failed");
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Link failed");
    } finally {
      setLinkingBoms(false);
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setFormData({
      name: item.name,
      category: item.category,
      sellingPrice: item.sellingPrice,
      recipeId: item.recipeId?._id || item.recipeId || "",
      isActive: item.isActive !== undefined ? item.isActive : true,
      defaultMenuFranchiseId: item.defaultMenuFranchiseId || null,
      defaultMenuCategoryName: item.defaultMenuCategoryName || "",
      defaultMenuItemName: item.defaultMenuItemName || "",
    });
    setModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();

    const { confirm } = await import("../../utils/confirm");
    const confirmed = await confirm(
      "Are you sure you want to PERMANENTLY DELETE this menu item?\n\nThis action cannot be undone.",
      {
        title: "Delete Menu Item",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      },
    );

    if (!confirmed) return;

    try {
      await deleteMenuItem(id);
      alert("Menu item deleted successfully!");
      fetchData();
    } catch (error) {
      alert(
        `Failed to delete menu item: ${
          error.response?.data?.message || error.message
        }`,
      );
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading menu items...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">
              Menu Items
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              Manage pricing, linking, and sync
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleSyncFromCart}
              disabled={syncing || (!isCartAdmin && !selectedOutlet)}
              title={
                !isCartAdmin && !selectedOutlet
                  ? "Select an outlet first"
                  : "Sync menu items from your cart menu"
              }
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <FaSync className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing…" : "Sync from Cart Menu"}
            </button>
            {stats.noBom > 0 && (
              <button
                onClick={handleLinkMatchingBoms}
                disabled={linkingBoms || (!isCartAdmin && !selectedOutlet)}
                title="Link menu items without BOM to matching recipes by name"
                className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <FaMagic className={linkingBoms ? "animate-pulse" : ""} />
                {linkingBoms ? "Linking…" : "Link matching BOMs"}
              </button>
            )}
            <button
              onClick={async () => {
                setEditing(null);
                resetForm();
                try {
                  const recipesRes = await getRecipes();
                  if (recipesRes.data.success) setRecipes(recipesRes.data.data);
                } catch (error) {
                  if (import.meta.env.DEV) {
                    console.error("Error fetching recipes:", error);
                  }
                }
                setModalOpen(true);
              }}
              className="bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white px-3 sm:px-4 py-2 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm sm:text-base"
            >
              <FaPlus /> Add Menu Item
            </button>
          </div>
        </div>
        <div className="flex justify-start sm:justify-end">
          <OutletFilter
            selectedOutlet={selectedOutlet}
            onOutletChange={setSelectedOutlet}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Total Items</p>
            <FaChartPie className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Active</p>
            <FaCheck className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.active}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Linked</p>
            <FaLink className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.linked}</p>
        </div>
        <div
          className={`rounded-xl shadow-lg p-4 sm:p-5 text-white ${
            stats.noBom > 0
              ? "bg-gradient-to-br from-amber-500 to-amber-600"
              : "bg-gradient-to-br from-gray-500 to-gray-600"
          }`}
          title="Items without BOM – inventory cannot be consumed"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">No BOM</p>
            <FaExclamationTriangle className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.noBom}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">
              High Food Cost (&gt;40%)
            </p>
            <FaExclamationTriangle className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.highFoodCost}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Category
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Price
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Cost/Portion
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Food Cost %
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">
                  Margin
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Linked
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {menuItems.map((item) => (
                <tr key={item._id}>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 font-medium text-xs sm:text-sm">
                    <div className="truncate max-w-[120px] sm:max-w-none">
                      {item.name}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 md:hidden mt-1">
                      {item.category}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hidden md:table-cell text-xs sm:text-sm">
                    {item.category}
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 text-xs sm:text-sm">
                    ₹{Number(item.sellingPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hidden lg:table-cell text-xs sm:text-sm">
                    {(() => {
                      // Use menu item's costPerPortion (updated by backend), or fallback to recipe's costPerPortion
                      let costPerPortion = item.costPerPortion || 0;

                      // If costPerPortion is 0 and recipe exists, try to get from populated recipe
                      if (costPerPortion === 0 && item.recipeId) {
                        if (
                          typeof item.recipeId === "object" &&
                          item.recipeId.costPerPortion
                        ) {
                          costPerPortion = item.recipeId.costPerPortion;
                        }
                      }

                      return `₹${Number(costPerPortion).toFixed(2)}`;
                    })()}
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
                    <span
                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${
                        item.foodCostPercent > 40
                          ? "bg-red-100 text-red-800"
                          : item.foodCostPercent > 30
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {Number(item.foodCostPercent || 0).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hidden xl:table-cell text-xs sm:text-sm">
                    ₹{Number(item.contributionMargin || 0).toFixed(2)}
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hidden lg:table-cell">
                    {item.defaultMenuPath ? (
                      <span
                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-blue-100 text-blue-800 flex items-center gap-1"
                        title={item.defaultMenuPath}
                      >
                        <FaLink className="text-xs" />{" "}
                        <span className="hidden sm:inline">Linked</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${
                          item.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </span>
                      {(!item.recipeId || !item.recipeId._id) && (
                        <span
                          className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs bg-amber-100 text-amber-800"
                          title="No BOM linked – inventory will not be consumed for orders"
                        >
                          No BOM
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
                    <div className="flex gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="text-yellow-600 hover:text-yellow-800 p-1"
                        title="Edit"
                      >
                        <FaEdit className="text-sm sm:text-base" />
                      </button>
                      {isCartAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, item._id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete"
                        >
                          <FaTrash className="text-sm sm:text-base" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editing ? "Edit Menu Item" : "Add Menu Item"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* For cart admin, require selection from operational menu */}
              {isCartAdmin && !editing && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Menu Item from Your Menu *
                  </label>
                  <select
                    required={!editing}
                    value={(() => {
                      if (!formData.name) return "";
                      const idx = defaultMenuItems.findIndex(
                        (item) =>
                          item.name === formData.name &&
                          item.category === formData.category,
                      );
                      return idx >= 0 ? idx.toString() : "";
                    })()}
                    onChange={(e) => {
                      if (e.target.value) {
                        const item = defaultMenuItems[parseInt(e.target.value)];
                        setFormData({
                          name: item.name,
                          category: item.category,
                          sellingPrice: item.price,
                          recipeId: formData.recipeId || "",
                          isActive: true,
                          defaultMenuFranchiseId: item.franchiseId,
                          defaultMenuCategoryName: item.category,
                          defaultMenuItemName: item.name,
                        });
                      } else {
                        resetForm();
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">-- Select from your menu --</option>
                    {defaultMenuItems.map((item, idx) => (
                      <option key={idx} value={idx}>
                        {item.category} - {item.name} (₹{item.price})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select an item from your operational menu. Price will be set
                    automatically.
                  </p>
                </div>
              )}

              {/* For non-cart admin or editing, show manual fields */}
              {(!isCartAdmin || editing) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isCartAdmin && !editing && formData.name}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      disabled={isCartAdmin && !editing && formData.category}
                    />
                  </div>
                </>
              )}

              {/* Show selected item details for cart admin */}
              {isCartAdmin && formData.name && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Selected Item:
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">{formData.name}</span> -{" "}
                    {formData.category}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Price:{" "}
                    <span className="font-semibold text-green-700">
                      ₹{Number(formData.sellingPrice || 0).toFixed(2)}
                    </span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Recipe {!isCartAdmin && "(Optional)"}
                </label>
                <select
                  value={formData.recipeId || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipeId: e.target.value || null,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">No Recipe (Manual Pricing)</option>
                  {recipes.map((recipe) => (
                    <option key={recipe._id} value={recipe._id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {isCartAdmin
                    ? "Link a recipe to automatically calculate food cost based on ingredient prices"
                    : "Optional: Link a recipe to automatically calculate food cost"}
                </p>
              </div>

              {/* Only show selling price for non-cart admin or when editing */}
              {(!isCartAdmin || editing) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selling Price *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sellingPrice: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded"
                />
                <label className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditing(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a]"
                >
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuItems;
