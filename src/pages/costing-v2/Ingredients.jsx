import React, { useEffect, useState } from "react";
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getFIFOLayers,
  pushToCartAdmins,
} from "../../services/costingV2Api";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaEye,
  FaBox,
  FaWarehouse,
  FaExclamationTriangle,
  FaArrowDown,
} from "react-icons/fa";
import { formatUnit } from "../../utils/unitConverter";
import { confirm } from "../../utils/confirm";
import { useAuth } from "../../context/AuthContext";

const Ingredients = () => {
  const { user } = useAuth();
  const userRole = user?.role;
  const isSuperAdmin = userRole === "super_admin";

  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Other",
    storageLocation: "Dry Storage",
    uom: "kg",
    baseUnit: "kg",
    reorderLevel: 0,
    shelfTimeDays: 7,
    qtyOnHand: 0,
    isActive: true,
  });
  const [fifoModalOpen, setFifoModalOpen] = useState(false);
  const [fifoLayers, setFifoLayers] = useState([]);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const res = await getIngredients();
      if (res.data.success) {
        setIngredients(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching ingredients:", error);
      alert("Failed to fetch ingredients");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prevent duplicate global ingredients (by name) for super admin
      if (
        isSuperAdmin &&
        !editing &&
        formData.name &&
        ingredients.some(
          (ing) =>
            ing.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
        )
      ) {
        alert(
          "An ingredient with this name already exists in the global master. Please edit the existing ingredient instead of creating a duplicate."
        );
        return;
      }

      if (editing) {
        await updateIngredient(editing._id, formData);
        alert("Ingredient updated successfully!");
      } else {
        await createIngredient(formData);
        alert("Ingredient created successfully!");
      }
      setModalOpen(false);
      setEditing(null);
      setFormData({
        name: "",
        category: "Other",
        storageLocation: "Dry Storage",
        uom: "kg",
        baseUnit: "kg",
        reorderLevel: 0,
        shelfTimeDays: 7,
        qtyOnHand: 0,
        isActive: true,
      });
      fetchIngredients();
    } catch (error) {
      alert(
        `Failed to save ingredient: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleEdit = (ingredient) => {
    setEditing(ingredient);
    setFormData({
      name: ingredient.name,
      category: ingredient.category || "Other",
      storageLocation: ingredient.storageLocation || "Dry Storage",
      uom: ingredient.uom,
      baseUnit: ingredient.baseUnit,
      reorderLevel: ingredient.reorderLevel,
      shelfTimeDays: ingredient.shelfTimeDays,
      qtyOnHand: ingredient.qtyOnHand,
      isActive: ingredient.isActive,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id, ingredientName) => {
    const ingredient = ingredients.find((ing) => ing._id === id);
    const name = ingredient?.name || "this ingredient";

    const confirmed = await confirm(
      `Are you sure you want to delete "${name}"?\n\nThis action cannot be undone.`,
      {
        title: "Delete Ingredient",
        confirmText: "Delete",
        cancelText: "Cancel",
        danger: true,
        requireInput: false,
      }
    );

    if (!confirmed) return;

    try {
      await deleteIngredient(id);
      alert(`Ingredient "${name}" deleted successfully!`);
      fetchIngredients();
    } catch (error) {
      alert(
        `Failed to delete ingredient: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleViewFIFO = async (ingredient) => {
    try {
      const res = await getFIFOLayers(ingredient._id);
      if (res.data.success) {
        setFifoLayers(res.data.data);
        setSelectedIngredient(ingredient);
        setFifoModalOpen(true);
      }
    } catch (error) {
      alert("Failed to fetch FIFO layers");
    }
  };

  const handlePushToCartAdmins = async () => {
    if (!isSuperAdmin) return;

    const confirmed = await confirm(
      "This will push all your ingredients and BOMs to all cart admins.\n\n" +
        "Existing cart admin data will be updated with your master data, but their inventory quantities and costs will be preserved.\n\n" +
        "Do you want to continue?",
      {
        title: "Push to Cart Admins",
        confirmText: "Push",
        cancelText: "Cancel",
        danger: false,
        requireInput: false,
      }
    );

    if (!confirmed) return;

    try {
      setPushing(true);
      const res = await pushToCartAdmins({});
      if (res.data.success) {
        const results = res.data.data;
        const message =
          `Successfully pushed data to ${results.cartAdmins.length} cart admin(s)!\n\n` +
          `Ingredients: ${results.ingredients.created} created, ${results.ingredients.updated} updated\n` +
          `BOMs: ${results.recipes.created} created, ${results.recipes.updated} updated`;
        alert(message);
      } else {
        alert(res.data.message || "Failed to push data");
      }
    } catch (error) {
      alert(
        `Failed to push data: ${error.response?.data?.message || error.message}`
      );
    } finally {
      setPushing(false);
    }
  };

  const filteredIngredients = ingredients.filter((ing) => {
    const matchesSearch = ing.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || ing.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    ...new Set(ingredients.map((ing) => ing.category)),
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#d86d2a] border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading ingredients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">
              Ingredients
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {isSuperAdmin
                ? "Define global ingredient master data for recipes. Inventory is managed by franchises."
                : "Manage your inventory ingredients, stock and thresholds."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {isSuperAdmin && (
              <button
                onClick={handlePushToCartAdmins}
                disabled={pushing}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm sm:text-base font-medium w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaArrowDown className="text-sm sm:text-base" />
                {pushing ? "Pushing..." : "Push to Cart Admins"}
              </button>
            )}
            <button
              onClick={() => {
                setEditing(null);
                setFormData({
                  name: "",
                  category: "Other",
                  storageLocation: "Dry Storage",
                  uom: "kg",
                  baseUnit: "kg",
                  reorderLevel: 0,
                  shelfTimeDays: 7,
                  qtyOnHand: 0,
                  isActive: true,
                });
                setModalOpen(true);
              }}
              className="bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm sm:text-base font-medium w-full sm:w-auto justify-center"
            >
              <FaPlus className="text-sm sm:text-base" /> Add Ingredient
            </button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search ingredients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm sm:text-base"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm sm:text-base w-full sm:w-auto"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Total Ingredients</p>
            <FaBox className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{ingredients.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Active</p>
            <FaBox className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">
            {ingredients.filter((i) => i.isActive).length}
          </p>
        </div>
        {!isSuperAdmin && (
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm opacity-90">Low Stock</p>
              <FaExclamationTriangle className="text-lg sm:text-xl" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold">
              {
                ingredients.filter(
                  (i) => i.qtyOnHand <= i.reorderLevel && i.isActive
                ).length
              }
            </p>
          </div>
        )}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Categories</p>
            <FaWarehouse className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{categories.length}</p>
        </div>
      </div>

      {/* Ingredients Grid */}
      {filteredIngredients.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FaBox className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No ingredients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredIngredients.map((ing) => (
            <div
              key={ing._id}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
            >
              {/* Card Header */}
              <div
                className={`p-4 sm:p-5 ${
                  ing.isActive
                    ? "bg-gradient-to-r from-green-50 to-green-100"
                    : "bg-gradient-to-r from-gray-50 to-gray-100"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-base sm:text-lg truncate flex-1">
                    {ing.name}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium ml-2 ${
                      ing.isActive
                        ? "bg-green-500 text-white"
                        : "bg-gray-400 text-white"
                    }`}
                  >
                    {ing.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-lg text-[10px] sm:text-xs font-medium">
                    {ing.category || "Other"}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-lg text-[10px] sm:text-xs font-medium">
                    {ing.storageLocation || "Dry Storage"}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 space-y-3">
                {!isSuperAdmin && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-600">
                        Quantity on Hand
                      </span>
                      <span className="font-bold text-sm sm:text-base text-gray-800">
                        {formatUnit(ing.qtyOnHand, ing.uom)}
                      </span>
                    </div>
                    {ing.qtyOnHand <= ing.reorderLevel && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2">
                        <FaExclamationTriangle className="text-red-600 text-xs" />
                        <span className="text-red-700 text-xs font-medium">
                          Low Stock Alert
                        </span>
                      </div>
                    )}
                    <div className="flex items_center justify-between">
                      <span className="text-xs sm:text-sm text-gray-600">
                        Reorder Level
                      </span>
                      <span className="text-sm sm:text-base text-gray-700">
                        {formatUnit(ing.reorderLevel, ing.uom)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">Unit</span>
                  <span className="text-sm sm:text-base text-gray-700 font-medium">
                    {ing.uom}
                  </span>
                </div>
                {!isSuperAdmin && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-xs sm:text-sm text-gray-600">
                      Cost/Unit
                    </span>
                    <span className="text-sm sm:text-base font-bold text-[#d86d2a]">
                      ₹{ing.currentCostPerBaseUnit?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                {!isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => handleViewFIFO(ing)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View FIFO Layers"
                  >
                    <FaEye className="text-sm sm:text-base" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleEdit(ing)}
                  className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <FaEdit className="text-sm sm:text-base" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(ing._id, ing.name);
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <FaTrash className="text-sm sm:text-base" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white p-4 sm:p-6 rounded-t-2xl">
              <h2 className="text-xl sm:text-2xl font-bold">
                {editing ? "Edit Ingredient" : "Add Ingredient"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  >
                    <optgroup label="Raw Ingredients">
                      <option value="Vegetables">Vegetables</option>
                      <option value="Dairy">Dairy</option>
                      <option value="Meat & Poultry">Meat & Poultry</option>
                      <option value="Grains & Staples">Grains & Staples</option>
                      <option value="Spices & Seasoning">
                        Spices & Seasoning
                      </option>
                      <option value="Cooking Oils & Ghee">
                        Cooking Oils & Ghee
                      </option>
                      <option value="Bread, Buns & Rotis">
                        Bread, Buns & Rotis
                      </option>
                      <option value="Snacks Ingredients">
                        Snacks Ingredients
                      </option>
                      <option value="Packaged Items">Packaged Items</option>
                      <option value="Beverages">Beverages</option>
                    </optgroup>
                    <optgroup label="Consumables & Non-Food">
                      <option value="Tissue & Paper Products">
                        Tissue & Paper Products
                      </option>
                      <option value="Packaging Materials">
                        Packaging Materials
                      </option>
                      <option value="Disposable Items">Disposable Items</option>
                      <option value="Cleaning Supplies">
                        Cleaning Supplies
                      </option>
                      <option value="Safety & Hygiene">Safety & Hygiene</option>
                      <option value="Gas & Fuel">Gas & Fuel</option>
                    </optgroup>
                    <optgroup label="Prepared Items">
                      <option value="Prepared Items">Prepared Items</option>
                      <option value="Pre-mixes">Pre-mixes</option>
                    </optgroup>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Storage Location *
                  </label>
                  <select
                    required
                    value={formData.storageLocation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        storageLocation: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  >
                    <option value="Dry Storage">Dry Storage</option>
                    <option value="Cold Storage">Cold Storage</option>
                    <option value="Frozen Storage">Frozen Storage</option>
                    <option value="Vegetables Section">
                      Vegetables Section
                    </option>
                    <option value="Cleaning Supplies">Cleaning Supplies</option>
                    <option value="Packaging Supplies">
                      Packaging Supplies
                    </option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UOM *
                  </label>
                  <select
                    required
                    value={formData.uom}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        uom: e.target.value,
                        baseUnit: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="bottle">bottle</option>
                    <option value="dozen">dozen</option>
                  </select>
                </div>
                {!isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reorder Level
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.reorderLevel}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reorderLevel: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shelf time (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.shelfTimeDays}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      shelfTimeDays: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="rounded border-gray-300 text-[#d86d2a] focus:ring-[#d86d2a]"
                />
                <label className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditing(null);
                  }}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded-lg hover:shadow-lg font-medium transition-all"
                >
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FIFO Layers Modal */}
      {fifoModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 sm:p-6 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-xl sm:text-2xl font-bold">
                FIFO Layers - {selectedIngredient?.name}
              </h2>
              <button
                onClick={() => setFifoModalOpen(false)}
                className="text-white hover:text-gray-200 text-xl font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {fifoLayers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No FIFO layers found
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Remaining
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Unit Cost
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {fifoLayers.map((layer, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {new Date(layer.date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatUnit(layer.qty, layer.uom)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatUnit(layer.remainingQty, layer.uom)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            ₹{layer.unitCost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">
                            ₹{(layer.remainingQty * layer.unitCost).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ingredients;
