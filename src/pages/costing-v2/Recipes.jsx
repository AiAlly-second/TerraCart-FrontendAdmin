import React, { useEffect, useState } from "react";
import {
  getRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  recalculateRecipeCost,
  getIngredients,
} from "../../services/costingV2Api";
import { FaPlus, FaEdit, FaTrash, FaCalculator } from "react-icons/fa";
import { formatUnit } from "../../utils/unitConverter";

const Recipes = () => {
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [recipesRes, ingredientsRes] = await Promise.all([
        getRecipes(),
        getIngredients(),
      ]);
      if (recipesRes.data.success) setRecipes(recipesRes.data.data);
      if (ingredientsRes.data.success) setIngredients(ingredientsRes.data.data);
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
      // Convert empty strings to 0 for qty before submission
      const submitData = {
        ...formData,
        ingredients: formData.ingredients.map(ing => ({
          ...ing,
          qty: ing.qty === "" || ing.qty === null || ing.qty === undefined ? 0 : parseFloat(ing.qty) || 0,
        }))
      };
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
      alert(`Failed to save recipe: ${error.response?.data?.message || error.message}`);
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
  };

  const handleEdit = (recipe) => {
    setEditing(recipe);
    setFormData({
      name: recipe.name,
      yieldPercent: recipe.yieldPercent,
      portions: recipe.portions,
      instructions: recipe.instructions || "",
      ingredients: recipe.ingredients ? recipe.ingredients.map(ing => ({
        ...ing,
        qty: ing.qty || ""
      })) : [{ ingredientId: "", qty: "", uom: "kg" }],
      isActive: recipe.isActive !== undefined ? recipe.isActive : true,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this recipe?")) return;
    try {
      await deleteRecipe(id);
      alert("Recipe deleted successfully!");
      fetchData();
    } catch (error) {
      alert(`Failed to delete recipe: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleRecalculate = async (id) => {
    try {
      await recalculateRecipeCost(id);
      alert("Recipe cost recalculated successfully!");
      fetchData();
    } catch (error) {
      alert(`Failed to recalculate: ${error.response?.data?.message || error.message}`);
    }
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { ingredientId: "", qty: "", uom: "kg" }],
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading recipes...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Recipes</h1>
        <button
          onClick={() => {
            setEditing(null);
            resetForm();
            setModalOpen(true);
          }}
          className="bg-[#d86d2a] text-white px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2"
        >
          <FaPlus /> Add Recipe
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Portions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yield %</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost/Portion</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recipes.map((recipe) => (
              <tr key={recipe._id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{recipe.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{recipe.portions}</td>
                <td className="px-6 py-4 whitespace-nowrap">{recipe.yieldPercent}%</td>
                <td className="px-6 py-4 whitespace-nowrap">₹{Number(recipe.totalCostCached || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap font-semibold">
                  ₹{Number(recipe.costPerPortion || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${recipe.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {recipe.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                  <button
                    onClick={() => handleRecalculate(recipe._id)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Recalculate Cost"
                  >
                    <FaCalculator />
                  </button>
                  <button
                    onClick={() => handleEdit(recipe)}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(recipe._id)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{editing ? "Edit Recipe" : "Add Recipe"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Portions *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.portions}
                    onChange={(e) => setFormData({ ...formData, portions: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yield % *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="100"
                    value={formData.yieldPercent}
                    onChange={(e) => setFormData({ ...formData, yieldPercent: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Ingredients *</label>
                  <button
                    type="button"
                    onClick={addIngredient}
                    className="text-sm text-[#d86d2a] hover:underline"
                  >
                    + Add Ingredient
                  </button>
                </div>
                {formData.ingredients.map((ing, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 mb-2">
                    <select
                      required
                      value={ing.ingredientId}
                      onChange={(e) => updateIngredient(index, "ingredientId", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select Ingredient</option>
                      {ingredients.map((ingredient) => (
                        <option key={ingredient._id} value={ingredient._id}>{ingredient.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="Quantity"
                      value={ing.qty === "" || ing.qty === null || ing.qty === undefined ? "" : ing.qty}
                      onChange={(e) => updateIngredient(index, "qty", e.target.value === "" ? "" : parseFloat(e.target.value) || "")}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <select
                      required
                      value={ing.uom}
                      onChange={(e) => updateIngredient(index, "uom", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
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
                    <button
                      type="button"
                      onClick={() => removeIngredient(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
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
    </div>
  );
};

export default Recipes;




