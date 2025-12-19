import React, { useEffect, useState } from "react";
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getRecipes,
  getDefaultMenuItems,
  importFromDefaultMenu,
  syncMenuItemsFromDefault,
} from "../../services/costingV2Api";
import { useAuth } from "../../context/AuthContext";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaDownload,
  FaLink,
  FaSync,
  FaCheck,
  FaChartPie,
  FaExclamationTriangle,
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDefaultItems, setSelectedDefaultItems] = useState(new Set());
  const [importRecipeId, setImportRecipeId] = useState("");
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
      const params = selectedOutlet ? { outletId: selectedOutlet } : {};
      const [menuItemsRes, recipesRes, defaultMenuRes] = await Promise.all([
        getMenuItems(params),
        getRecipes(),
        getDefaultMenuItems(),
      ]);
      if (menuItemsRes.data.success) setMenuItems(menuItemsRes.data.data);
      if (recipesRes.data.success) setRecipes(recipesRes.data.data);
      if (defaultMenuRes.data.success)
        setDefaultMenuItems(defaultMenuRes.data.data);
    } catch (error) {
      console.error("Error fetching data:", error);
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
          "Please select an outlet/cart at the top-right before creating a menu item."
        );
        return;
      }

      const payload = {
        ...formData,
        // For cart admin, backend derives outletId from the user.
        // For super/franchise admin, we send the selected outlet explicitly.
        outletId: isCartAdmin ? undefined : selectedOutlet,
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
        }`
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
  };

  const handleImportFromDefault = async () => {
    if (selectedDefaultItems.size === 0) {
      alert("Please select at least one item to import");
      return;
    }

    // For super_admin / franchise_admin we MUST know which outlet (cart) to import into
    if (!isCartAdmin && !selectedOutlet) {
      alert(
        "Please select an outlet/cart at the top-right before importing menu items."
      );
      return;
    }

    try {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/660a5fbf-4359-420f-956f-3831103456fb",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "import-menu-click",
            hypothesisId: "H2",
            location: "MenuItems.jsx:137",
            message: "Import from default clicked",
            data: {
              selectedOutlet,
              selectedDefaultCount: selectedDefaultItems.size,
              importRecipeId: importRecipeId || null,
              isCartAdmin,
            },
            timestamp: Date.now(),
          }),
        }
      ).catch(() => {});
      // #endregion agent log
      const itemsToImport = Array.from(selectedDefaultItems).map((index) => {
        const item = defaultMenuItems[index];
        return {
          name: item.name,
          category: item.category,
          price: item.price,
          franchiseId: item.franchiseId,
          defaultMenuPath: item.defaultMenuPath,
        };
      });

      const res = await importFromDefaultMenu({
        items: itemsToImport,
        // Recipe is optional now; when omitted, items are created without a recipe
        recipeId: importRecipeId || undefined,
        // For cart admin, backend can derive outletId from the user.
        // For super/franchise admin, we send the selected outlet explicitly.
        outletId: isCartAdmin ? undefined : selectedOutlet,
      });

      if (res.data.success) {
        alert(
          `Successfully imported ${res.data.data.imported} item(s). ${
            res.data.data.errors > 0 ? `${res.data.data.errors} failed.` : ""
          }`
        );
        setImportModalOpen(false);
        setSelectedDefaultItems(new Set());
        setImportRecipeId("");
        fetchData();
      }
    } catch (error) {
      alert(
        `Failed to import: ${error.response?.data?.message || error.message}`
      );
    }
  };

  const handleSyncFromDefault = async () => {
    // CRITICAL: window.confirm is now async, must await it
    const confirmed = await window.confirm(
      "This will update all costing menu items with the latest prices from the default menu. Continue?"
    );
    if (!confirmed) {
      return;
    }

    try {
      const res = await syncMenuItemsFromDefault({});
      if (res.data.success) {
        alert(
          `Successfully synced ${res.data.data.updated} menu item(s) with updated prices from default menu.`
        );
        fetchData();
      } else {
        alert(
          `Sync completed with ${
            res.data.data.errors?.length || 0
          } error(s). Check console for details.`
        );
      }
    } catch (error) {
      alert(
        `Failed to sync: ${error.response?.data?.message || error.message}`
      );
    }
  };

  const handleSelectDefaultItem = (index) => {
    const item = defaultMenuItems[index];
    setFormData({
      name: item.name,
      category: item.category,
      sellingPrice: item.price,
      recipeId: formData.recipeId,
      isActive: true,
      defaultMenuFranchiseId: item.franchiseId,
      defaultMenuCategoryName: item.category,
      defaultMenuItemName: item.name,
    });
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
      }
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
        }`
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={handleSyncFromDefault}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm sm:text-base"
              title="Sync prices from default menu"
            >
              <FaSync /> Sync Prices
            </button>
            <button
              onClick={() => {
                setImportModalOpen(true);
                setSelectedDefaultItems(new Set());
                setImportRecipeId("");
              }}
              className="bg-gradient-to-r from-green-600 to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm sm:text-base"
            >
              <FaDownload /> Import
            </button>
            <button
              onClick={async () => {
                setEditing(null);
                resetForm();
                // Refresh recipes list before opening modal
                try {
                  const recipesRes = await getRecipes();
                  if (recipesRes.data.success) setRecipes(recipesRes.data.data);
                } catch (error) {
                  console.error("Error fetching recipes:", error);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                    ₹{Number(item.costPerPortion || 0).toFixed(2)}
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
                    <span
                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${
                        item.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
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
              {defaultMenuItems.length > 0 && !editing && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Select from Default Menu
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleSelectDefaultItem(parseInt(e.target.value));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select from Default Menu...</option>
                    {defaultMenuItems.map((item, idx) => (
                      <option key={idx} value={idx}>
                        {item.category} - {item.name} (₹{item.price})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipe
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
                  Optional: Link a recipe to automatically calculate food cost
                </p>
              </div>
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

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              Import from Default Menu
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link a Recipe (Optional)
                </label>
                <select
                  value={importRecipeId}
                  onChange={(e) => setImportRecipeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">No Recipe (Manual Pricing)</option>
                  {recipes.map((recipe) => (
                    <option key={recipe._id} value={recipe._id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Items to Import
                </label>
                {defaultMenuItems.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    No default menu items available
                  </p>
                ) : (
                  <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={
                                selectedDefaultItems.size ===
                                defaultMenuItems.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDefaultItems(
                                    new Set(
                                      defaultMenuItems.map((_, idx) => idx)
                                    )
                                  );
                                } else {
                                  setSelectedDefaultItems(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Category
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Name
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {defaultMenuItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedDefaultItems.has(idx)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedDefaultItems);
                                  if (e.target.checked) {
                                    newSet.add(idx);
                                  } else {
                                    newSet.delete(idx);
                                  }
                                  setSelectedDefaultItems(newSet);
                                }}
                              />
                            </td>
                            <td className="px-4 py-2">{item.category}</td>
                            <td className="px-4 py-2 font-medium">
                              {item.name}
                            </td>
                            <td className="px-4 py-2">
                              ₹{Number(item.price || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setImportModalOpen(false);
                    setSelectedDefaultItems(new Set());
                    setImportRecipeId("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportFromDefault}
                  disabled={selectedDefaultItems.size === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Import{" "}
                  {selectedDefaultItems.size > 0
                    ? `${selectedDefaultItems.size} `
                    : ""}
                  Item(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuItems;
