import React, { useState, useEffect } from 'react';
import costingApi from '../../services/costingApi';
import ConfirmModal from '../../components/costing/ConfirmModal';

const RecipeCosting = () => {
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    sellingPrice: '',
    overheadPerPlate: '',
    ingredients: [],
  });
  const [newIngredient, setNewIngredient] = useState({
    ingredientId: '',
    quantity: '',
    unit: 'kg',
  });
  const [calculatedPlateCost, setCalculatedPlateCost] = useState(0);

  useEffect(() => {
    fetchRecipes();
    fetchIngredients();
  }, []);

  useEffect(() => {
    calculatePlateCost();
  }, [formData.ingredients, formData.overheadPerPlate]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getRecipes();
      setRecipes(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
      alert('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const fetchIngredients = async () => {
    try {
      const response = await costingApi.getIngredients();
      setIngredients(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch ingredients:', error);
    }
  };

  const calculatePlateCost = async () => {
    if (formData.ingredients.length === 0) {
      setCalculatedPlateCost(0);
      return;
    }

    let totalCost = 0;
    for (const ing of formData.ingredients) {
      const ingredient = ingredients.find(i => i._id === ing.ingredientId);
      if (ingredient) {
        // Convert to base unit
        const quantityInBaseUnit = convertToBaseUnit(parseFloat(ing.quantity), ing.unit);
        totalCost += quantityInBaseUnit * ingredient.costPerUnit;
      }
    }

    const overhead = parseFloat(formData.overheadPerPlate) || 0;
    setCalculatedPlateCost(Number((totalCost + overhead).toFixed(2)));
  };

  const convertToBaseUnit = (quantity, unit) => {
    const conversions = {
      kg: 1,
      g: 0.001,
      l: 1,
      ml: 0.001,
      pcs: 1,
    };
    return quantity * (conversions[unit] || 1);
  };

  const handleOpenModal = (recipe = null) => {
    if (recipe) {
      setEditingRecipe(recipe);
      setFormData({
        name: recipe.name || '',
        sku: recipe.sku || '',
        sellingPrice: recipe.sellingPrice || '',
        overheadPerPlate: recipe.overheadPerPlate || '',
        ingredients: recipe.ingredients?.map(ing => ({
          ingredientId: ing.ingredientId?._id || ing.ingredientId || '',
          quantity: ing.quantity || '',
          unit: ing.unit || 'kg',
        })) || [],
      });
    } else {
      setEditingRecipe(null);
      setFormData({
        name: '',
        sku: '',
        sellingPrice: '',
        overheadPerPlate: '',
        ingredients: [],
      });
    }
    setNewIngredient({ ingredientId: '', quantity: '', unit: 'kg' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRecipe(null);
    setFormData({
      name: '',
      sku: '',
      sellingPrice: '',
      overheadPerPlate: '',
      ingredients: [],
    });
    setNewIngredient({ ingredientId: '', quantity: '', unit: 'kg' });
  };

  const handleAddIngredient = () => {
    if (!newIngredient.ingredientId || !newIngredient.quantity) {
      alert('Please select an ingredient and enter quantity');
      return;
    }

    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { ...newIngredient }],
    });
    setNewIngredient({ ingredientId: '', quantity: '', unit: 'kg' });
  };

  const handleRemoveIngredient = (index) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        sku: formData.sku.toUpperCase(),
        sellingPrice: parseFloat(formData.sellingPrice),
        overheadPerPlate: parseFloat(formData.overheadPerPlate) || 0,
        ingredients: formData.ingredients.map(ing => ({
          ingredientId: ing.ingredientId,
          quantity: parseFloat(ing.quantity),
          unit: ing.unit,
        })),
      };

      if (editingRecipe) {
        await costingApi.updateRecipe(editingRecipe._id, data);
      } else {
        await costingApi.createRecipe(data);
      }

      handleCloseModal();
      fetchRecipes();
      alert(`Recipe ${editingRecipe ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Failed to save recipe:', error);
      alert(`Failed to ${editingRecipe ? 'update' : 'create'} recipe: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      await costingApi.deleteRecipe(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null });
      fetchRecipes();
      alert('Recipe deleted successfully!');
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      alert(`Failed to delete recipe: ${error.response?.data?.message || error.message}`);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateProfitMargin = (sellingPrice, plateCost) => {
    if (!sellingPrice || sellingPrice === 0) return 0;
    return Number((((sellingPrice - plateCost) / sellingPrice) * 100).toFixed(2));
  };

  const units = ['kg', 'g', 'l', 'ml', 'pcs'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d86d2a]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[#4a2e1f]">Recipe Costing</h2>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
        >
          + Add Recipe
        </button>
      </div>

      {/* Recipes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recipes.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No recipes found
          </div>
        ) : (
          recipes.map((recipe) => {
            const profitMargin = calculateProfitMargin(recipe.sellingPrice, recipe.plateCost);
            return (
              <div key={recipe._id} className="bg-white rounded-lg shadow-md p-6 border border-[#e2c1ac]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#4a2e1f]">{recipe.name}</h3>
                    <p className="text-sm text-gray-500">SKU: {recipe.sku}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(recipe)}
                      className="text-[#d86d2a] hover:text-[#b85a1f]"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, id: recipe._id })}
                      className="text-red-600 hover:text-red-800"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Selling Price:</span>
                    <span className="font-semibold text-[#4a2e1f]">{formatCurrency(recipe.sellingPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Plate Cost:</span>
                    <span className="font-semibold text-[#4a2e1f]">{formatCurrency(recipe.plateCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Profit:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(recipe.sellingPrice - recipe.plateCost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Profit Margin:</span>
                    <span className={`font-semibold ${profitMargin >= 30 ? 'text-green-600' : profitMargin >= 20 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {profitMargin}%
                    </span>
                  </div>
                </div>
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Ingredients:</p>
                    <div className="space-y-1">
                      {recipe.ingredients.map((ing, idx) => (
                        <div key={idx} className="text-xs text-gray-600">
                          • {ing.ingredientId?.name || 'Unknown'}: {ing.quantity} {ing.unit}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
              {editingRecipe ? 'Edit Recipe' : 'Add Recipe'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    placeholder="e.g., CS-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Selling Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Overhead Per Plate</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.overheadPerPlate}
                    onChange={(e) => setFormData({ ...formData, overheadPerPlate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Calculated Plate Cost Display */}
              <div className="bg-[#f5e3d5] p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[#4a2e1f]">Calculated Plate Cost:</span>
                  <span className="text-xl font-bold text-[#d86d2a]">{formatCurrency(calculatedPlateCost)}</span>
                </div>
                {formData.sellingPrice && (
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-sm text-gray-600">Profit Margin:</span>
                    <span className={`text-sm font-semibold ${
                      calculateProfitMargin(parseFloat(formData.sellingPrice), calculatedPlateCost) >= 30 ? 'text-green-600' :
                      calculateProfitMargin(parseFloat(formData.sellingPrice), calculatedPlateCost) >= 20 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {calculateProfitMargin(parseFloat(formData.sellingPrice), calculatedPlateCost)}%
                    </span>
                  </div>
                )}
              </div>

              {/* Ingredients List */}
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-2">Ingredients *</label>
                {formData.ingredients.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {formData.ingredients.map((ing, idx) => {
                      const ingredient = ingredients.find(i => i._id === ing.ingredientId);
                      return (
                        <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium">{ingredient?.name || 'Unknown'}</span>
                            <span className="text-sm text-gray-600 ml-2">
                              {ing.quantity} {ing.unit}
                            </span>
                            {ingredient && (
                              <span className="text-xs text-gray-500 ml-2">
                                (₹{ingredient.costPerUnit}/{ingredient.unit})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveIngredient(idx)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Ingredient Form */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div>
                    <select
                      value={newIngredient.ingredientId}
                      onChange={(e) => setNewIngredient({ ...newIngredient, ingredientId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    >
                      <option value="">Select Ingredient</option>
                      {ingredients.map(ing => (
                        <option key={ing._id} value={ing._id}>
                          {ing.name} (₹{ing.costPerUnit}/{ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newIngredient.quantity}
                      onChange={(e) => setNewIngredient({ ...newIngredient, quantity: e.target.value })}
                      placeholder="Quantity"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    />
                  </div>
                  <div>
                    <select
                      value={newIngredient.unit}
                      onChange={(e) => setNewIngredient({ ...newIngredient, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    >
                      {units.map(unit => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddIngredient}
                      className="w-full px-4 py-2 bg-[#6b4423] text-white rounded-lg hover:bg-[#5a3520] transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formData.ingredients.length === 0}
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingRecipe ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Recipe"
        message="Are you sure you want to delete this recipe? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
      />
    </div>
  );
};

export default RecipeCosting;











