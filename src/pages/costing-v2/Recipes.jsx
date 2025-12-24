import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  recalculateRecipeCost,
  getIngredients,
  getDefaultMenuItems,
} from "../../services/costingV2Api";
import { useAuth } from "../../context/AuthContext";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaCalculator,
  FaUtensils,
  FaCheck,
  FaExclamationTriangle,
} from "react-icons/fa";
import { formatUnit } from "../../utils/unitConverter";

const Recipes = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isCartAdmin = user?.role === "admin";
  const [searchParams] = useSearchParams();
  const recipeNameFromMenu = searchParams.get("name") || "";
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [defaultMenuItems, setDefaultMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    yieldPercent: 100,
    portions: 1,
    instructions: "",
    ingredients: [{ ingredientId: "", qty: "", uom: "kg" }],
    isActive: true,
  });
  const [initializedFromMenu, setInitializedFromMenu] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  // If coming from Default Menu / Menu Manager with a specific item name,
  // pre-fill the recipe name and open the modal (only once).
  useEffect(() => {
    if (!initializedFromMenu && recipeNameFromMenu && !loading) {
      const existing = recipes.find(
        (r) =>
          r.name.trim().toLowerCase() ===
          recipeNameFromMenu.trim().toLowerCase()
      );
      if (!existing) {
        setFormData((prev) => ({
          ...prev,
          name: recipeNameFromMenu,
        }));
        setEditing(null);
        setModalOpen(true);
      }
      setInitializedFromMenu(true);
    }
  }, [initializedFromMenu, recipeNameFromMenu, loading, recipes]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recipesRes, ingredientsRes, defaultMenuRes] = await Promise.all([
        getRecipes(),
        getIngredients(),
        getDefaultMenuItems(),
      ]);
      if (recipesRes.data.success) setRecipes(recipesRes.data.data);
      if (ingredientsRes.data.success) setIngredients(ingredientsRes.data.data);
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
      // Enforce linking to a default menu item (mandatory)
      if (!selectedMenuItemId) {
        alert("Please select a Default Menu item for this BOM.");
        return;
      }

      const submitData = {
        ...formData,
        ingredients: formData.ingredients.map((ing) => ({
          ...ing,
          qty:
            ing.qty === "" || ing.qty === null || ing.qty === undefined
              ? 0
              : parseFloat(ing.qty) || 0,
        })),
      };

      // Prevent multiple BOMs with the same name for the same outlet (only when creating, not editing)
      if (!editing) {
        // For cart admin, check against their own outletId
        // For super admin, check against outletId: null (global BOMs)
        const currentOutletId = isCartAdmin ? user._id : null;
        const duplicateRecipe = recipes.find(
          (r) =>
            r.name.trim().toLowerCase() ===
              submitData.name.trim().toLowerCase() &&
            ((isCartAdmin &&
              r.outletId?.toString() === currentOutletId?.toString()) ||
              (isSuperAdmin && !r.outletId))
        );

        if (duplicateRecipe) {
          alert(
            `A BOM with the name "${submitData.name}" already exists${
              isCartAdmin ? " for your outlet" : " (global BOM)"
            }. Please use a different name or edit the existing BOM.`
          );
          return;
        }
      }

      if (editing) {
        await updateRecipe(editing._id, submitData);
        alert("Recipe updated successfully!");
      } else {
        await createRecipe(submitData);
        alert("Recipe created successfully!");
      }
      setModalOpen(false);
      setEditing(null);
      resetForm();
      fetchData();
    } catch (error) {
      alert(
        `Failed to save recipe: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      yieldPercent: 100,
      portions: 1,
      instructions: "",
      ingredients: [{ ingredientId: "", qty: "", uom: "kg" }],
      isActive: true,
    });
    setSelectedMenuItemId("");
  };

  const handleEdit = (recipe) => {
    setEditing(recipe);
    // Try to auto-select a linked default menu item by matching name
    const linkedDefaultItem = defaultMenuItems.find(
      (m) => m.name === recipe.name
    );
    setSelectedMenuItemId(linkedDefaultItem ? linkedDefaultItem.name : "");
    setFormData({
      name: recipe.name,
      yieldPercent: recipe.yieldPercent,
      portions: recipe.portions,
      instructions: recipe.instructions || "",
      ingredients: recipe.ingredients
        ? recipe.ingredients.map((ing) => ({
            ...ing,
            qty: ing.qty || "",
          }))
        : [{ ingredientId: "", qty: "", uom: "kg" }],
      isActive: recipe.isActive !== undefined ? recipe.isActive : true,
    });
    setModalOpen(true);
  };

  const handleSelectMenuItem = (menuItemId) => {
    setSelectedMenuItemId(menuItemId);
    const defaultItem = defaultMenuItems.find((m) => m.name === menuItemId);
    if (defaultItem) {
      // When a default menu item is selected, use its name for the BOM
      setFormData((prev) => ({
        ...prev,
        name: defaultItem.name,
      }));
    }
  };

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();

    const recipe = recipes.find((r) => r._id === id);
    const recipeName = recipe?.name || "this recipe";

    const { confirm } = await import("../../utils/confirm");
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE "${recipeName}"?\n\nThis action cannot be undone.`,
      {
        title: "Delete Recipe",
        warningMessage: "WARNING: PERMANENTLY DELETE",
        danger: true,
        confirmText: "Delete",
        cancelText: "Cancel",
      }
    );

    if (!confirmed) return;

    try {
      await deleteRecipe(id);
      alert("Recipe deleted successfully!");
      fetchData();
    } catch (error) {
      alert(
        `Failed to delete recipe: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleRecalculate = async (id) => {
    try {
      await recalculateRecipeCost(id);
      alert("Recipe cost recalculated successfully!");
      fetchData();
    } catch (error) {
      alert(
        `Failed to recalculate: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [
        ...formData.ingredients,
        { ingredientId: "", qty: "", uom: "kg" },
      ],
    });
  };

  const removeIngredient = (index) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  };

  const updateIngredient = (index, field, value) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const stats = {
    total: recipes.length,
    active: recipes.filter((r) => r.isActive).length,
    inactive: recipes.filter((r) => !r.isActive).length,
    avgCost: recipes.length
      ? recipes.reduce((sum, r) => sum + (r.costPerPortion || 0), 0) /
        recipes.length
      : 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#d86d2a] border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading recipes...</p>
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
              BOM (Bill of Material)
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              {isSuperAdmin
                ? "Define global bill of materials. Actual food cost is calculated separately for each franchise based on their purchases."
                : "Define and track bill of materials and recipe costs for your franchise."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                setEditing(null);
                resetForm();
                setModalOpen(true);
              }}
              className="bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm sm:text-base font-medium w-full sm:w-auto justify-center"
            >
              <FaPlus className="text-sm sm:text-base" /> Add BOM
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Total Recipes</p>
            <FaUtensils className="text-lg sm:text-xl" />
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
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Inactive</p>
            <FaExclamationTriangle className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.inactive}</p>
        </div>
        {!isSuperAdmin && (
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm opacity-90">Avg Cost/Portion</p>
              <FaCalculator className="text-lg sm:text-xl" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold">
              ₹{stats.avgCost.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Recipes Grid */}
      {recipes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FaUtensils className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No recipes found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {recipes.map((recipe) => (
            <div
              key={recipe._id}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
            >
              {/* Card Header */}
              <div
                className={`p-4 sm:p-5 ${
                  recipe.isActive
                    ? "bg-gradient-to-r from-green-50 to-green-100"
                    : "bg-gradient-to-r from-gray-50 to-gray-100"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-base sm:text-lg truncate flex-1">
                    {recipe.name}
                  </h3>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium ml-2 ${
                      recipe.isActive
                        ? "bg-green-500 text-white"
                        : "bg-gray-400 text-white"
                    }`}
                  >
                    {recipe.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-600">
                  <span className="px-2 py-1 bg-white/60 rounded-lg font-medium">
                    Portions: {recipe.portions}
                  </span>
                  <span className="px-2 py-1 bg-white/60 rounded-lg font-medium">
                    Yield: {recipe.yieldPercent}%
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 space-y-3">
                {!isSuperAdmin && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-600">
                        Total Cost
                      </span>
                      {Number(recipe.totalCostCached || 0) > 0 ? (
                        <span className="text-lg sm:text-xl font-bold text-[#d86d2a]">
                          ₹{Number(recipe.totalCostCached || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-gray-400 italic">
                          N/A (Create purchases)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-600">
                        Cost / Portion
                      </span>
                      {Number(recipe.costPerPortion || 0) > 0 ? (
                        <span className="text-sm sm:text-base font-semibold text-gray-800">
                          ₹{Number(recipe.costPerPortion || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 italic">
                          N/A
                        </span>
                      )}
                    </div>
                    {Number(recipe.totalCostCached || 0) === 0 && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-xs text-yellow-700">
                          💡 Create purchases for ingredients to calculate cost
                        </p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">
                    Ingredients ({recipe.ingredients?.length || 0})
                  </p>
                  <div className="space-y-1.5">
                    {recipe.ingredients && recipe.ingredients.length > 0 ? (
                      <>
                        {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs sm:text-sm bg-gray-50 rounded-lg p-2"
                          >
                            <span className="font-medium text-gray-800 truncate flex-1">
                              {ing.ingredientId?.name || "Unknown"}
                            </span>
                            <span className="text-gray-700 font-semibold ml-2">
                              {formatUnit(ing.qty, ing.uom || "kg")}
                            </span>
                          </div>
                        ))}
                        {recipe.ingredients.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            +{recipe.ingredients.length - 3} more ingredients
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400 text-xs sm:text-sm">
                        No ingredients added
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t flex items-center justify-end gap-2">
                {!isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => handleRecalculate(recipe._id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Recalculate Cost"
                  >
                    <FaCalculator className="text-sm sm:text-base" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleEdit(recipe)}
                  className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <FaEdit className="text-sm sm:text-base" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, recipe._id)}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white p-4 sm:p-6 rounded-t-2xl">
              <h2 className="text-xl sm:text-2xl font-bold">
                {editing ? "Edit Recipe" : "Add Recipe"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Portions *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.portions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        portions: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yield % *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={formData.yieldPercent}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        yieldPercent: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Link to Menu Item from Menu */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isCartAdmin
                    ? "Link to Menu Item *"
                    : "Link to Default Menu Item *"}
                </label>
                <select
                  required
                  value={selectedMenuItemId}
                  onChange={(e) => handleSelectMenuItem(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                >
                  <option
                    value={
                      isCartAdmin
                        ? "Select from Menu..."
                        : "Select from Default Menu..."
                    }
                  >
                    {isCartAdmin
                      ? "Select from Menu..."
                      : "Select from Default Menu..."}
                  </option>
                  {defaultMenuItems.map((item, idx) => (
                    <option
                      key={`${item.category}-${item.name}-${idx}`}
                      value={item.name}
                    >
                      {item.category} - {item.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {isCartAdmin
                    ? "Selecting a menu item will set this BOM's name to match the menu item."
                    : "Selecting a default menu item will set this BOM's name to match the default menu item."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instructions
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, instructions: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  rows="3"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Ingredients *
                  </label>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="text-sm text-[#d86d2a] hover:text-[#c75b1a] font-medium flex items-center gap-1"
                  >
                    <FaPlus /> Add Ingredient
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.ingredients.map((ing, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <select
                        required
                        value={ing.ingredientId}
                        onChange={(e) =>
                          updateIngredient(
                            index,
                            "ingredientId",
                            e.target.value
                          )
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm sm:col-span-2"
                      >
                        <option value="">Select Ingredient</option>
                        {ingredients.map((ingredient) => (
                          <option key={ingredient._id} value={ingredient._id}>
                            {ingredient.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="Quantity"
                        value={
                          ing.qty === "" ||
                          ing.qty === null ||
                          ing.qty === undefined
                            ? ""
                            : ing.qty
                        }
                        onChange={(e) =>
                          updateIngredient(
                            index,
                            "qty",
                            e.target.value === ""
                              ? ""
                              : parseFloat(e.target.value) || ""
                          )
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm"
                      />
                      <select
                        required
                        value={ing.uom}
                        onChange={(e) =>
                          updateIngredient(index, "uom", e.target.value)
                        }
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm"
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
                      <div className="flex justify-end">
                        {formData.ingredients.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeIngredient(index)}
                            className="text-red-600 hover:text-red-800 px-3 py-2"
                            title="Remove"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
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
    </div>
  );
};

export default Recipes;
