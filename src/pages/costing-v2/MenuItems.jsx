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
import { FaPlus, FaEdit, FaTrash, FaDownload, FaLink, FaSync } from "react-icons/fa";
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
      if (defaultMenuRes.data.success) setDefaultMenuItems(defaultMenuRes.data.data);
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
      if (editing) {
        await updateMenuItem(editing._id, formData);
        alert("Menu item updated successfully!");
      } else {
        await createMenuItem(formData);
        alert("Menu item created successfully!");
      }
      setModalOpen(false);
      setEditing(null);
      resetForm();
      fetchData();
    } catch (error) {
      alert(`Failed to save menu item: ${error.response?.data?.message || error.message}`);
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

  const handleImportFromDefault = async () => {
    if (!importRecipeId) {
      alert("Please select a recipe first");
      return;
    }

    if (selectedDefaultItems.size === 0) {
      alert("Please select at least one item to import");
      return;
    }

    try {
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
        recipeId: importRecipeId,
        outletId: null, // Will be auto-set by backend based on user role
      });

      if (res.data.success) {
        alert(`Successfully imported ${res.data.data.imported} item(s). ${res.data.data.errors > 0 ? `${res.data.data.errors} failed.` : ""}`);
        setImportModalOpen(false);
        setSelectedDefaultItems(new Set());
        setImportRecipeId("");
        fetchData();
      }
    } catch (error) {
      alert(`Failed to import: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSyncFromDefault = async () => {
    if (!window.confirm("This will update all costing menu items with the latest prices from the default menu. Continue?")) {
      return;
    }

    try {
      const res = await syncMenuItemsFromDefault({});
      if (res.data.success) {
        alert(`Successfully synced ${res.data.data.updated} menu item(s) with updated prices from default menu.`);
        fetchData();
      } else {
        alert(`Sync completed with ${res.data.data.errors?.length || 0} error(s). Check console for details.`);
      }
    } catch (error) {
      alert(`Failed to sync: ${error.response?.data?.message || error.message}`);
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this menu item? This action cannot be undone.")) return;
    try {
      await deleteMenuItem(id);
      alert("Menu item deleted successfully!");
      fetchData();
    } catch (error) {
      alert(`Failed to delete menu item: ${error.response?.data?.message || error.message}`);
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
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Menu Items</h1>
          <div className="flex gap-2">
            <button
              onClick={handleSyncFromDefault}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
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
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <FaDownload /> Import from Default Menu
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
            className="bg-[#d86d2a] text-white px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2"
          >
            <FaPlus /> Add Menu Item
          </button>
        </div>
        </div>
        <div className="flex justify-end">
          <OutletFilter selectedOutlet={selectedOutlet} onOutletChange={setSelectedOutlet} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost/Portion</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Food Cost %</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Linked</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {menuItems.map((item) => (
              <tr key={item._id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{item.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{item.category}</td>
                <td className="px-6 py-4 whitespace-nowrap">₹{Number(item.sellingPrice || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">₹{Number(item.costPerPortion || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.foodCostPercent > 40 ? "bg-red-100 text-red-800" :
                    item.foodCostPercent > 30 ? "bg-yellow-100 text-yellow-800" :
                    "bg-green-100 text-green-800"
                  }`}>
                    {Number(item.foodCostPercent || 0).toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  ₹{Number(item.contributionMargin || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.defaultMenuPath ? (
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 flex items-center gap-1" title={item.defaultMenuPath}>
                      <FaLink /> Linked
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${item.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  {isCartAdmin && (
                    <button
                      onClick={() => handleDelete(item._id)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete"
                    >
                      <FaTrash />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editing ? "Edit Menu Item" : "Add Menu Item"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {defaultMenuItems.length > 0 && !editing && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select from Default Menu</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <input
                  type="text"
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe</label>
                <select
                  value={formData.recipeId || ""}
                  onChange={(e) => setFormData({ ...formData, recipeId: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">No Recipe (Manual Pricing)</option>
                  {recipes.map((recipe) => (
                    <option key={recipe._id} value={recipe._id}>{recipe.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Optional: Link a recipe to automatically calculate food cost</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm font-medium text-gray-700">Active</label>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Import from Default Menu</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Recipe *</label>
                <select
                  required
                  value={importRecipeId}
                  onChange={(e) => setImportRecipeId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Recipe</option>
                  {recipes.map((recipe) => (
                    <option key={recipe._id} value={recipe._id}>{recipe.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Items to Import</label>
                {defaultMenuItems.length === 0 ? (
                  <p className="text-gray-500 text-sm">No default menu items available</p>
                ) : (
                  <div className="border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedDefaultItems.size === defaultMenuItems.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDefaultItems(new Set(defaultMenuItems.map((_, idx) => idx)));
                                } else {
                                  setSelectedDefaultItems(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
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
                            <td className="px-4 py-2 font-medium">{item.name}</td>
                            <td className="px-4 py-2">₹{Number(item.price || 0).toFixed(2)}</td>
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
                  disabled={!importRecipeId || selectedDefaultItems.size === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Import {selectedDefaultItems.size > 0 ? `${selectedDefaultItems.size} ` : ""}Item(s)
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

