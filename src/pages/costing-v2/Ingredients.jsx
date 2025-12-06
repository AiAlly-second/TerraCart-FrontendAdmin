import React, { useEffect, useState } from "react";
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getFIFOLayers,
} from "../../services/costingV2Api";
import { FaPlus, FaEdit, FaTrash, FaEye } from "react-icons/fa";
import { formatUnit } from "../../utils/unitConverter";

const Ingredients = () => {
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
      alert(`Failed to save ingredient: ${error.response?.data?.message || error.message}`);
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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this ingredient?")) return;
    try {
      await deleteIngredient(id);
      alert("Ingredient deleted successfully!");
      fetchIngredients();
    } catch (error) {
      alert(`Failed to delete ingredient: ${error.response?.data?.message || error.message}`);
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

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading ingredients...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Ingredients</h1>
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
          className="bg-[#d86d2a] text-white px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2"
        >
          <FaPlus /> Add Ingredient
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty on Hand</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost/Unit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ingredients.map((ing) => (
              <tr key={ing._id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{ing.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">{ing.category || "Other"}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">{ing.storageLocation || "Dry Storage"}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{ing.uom}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium">
                    {formatUnit(ing.qtyOnHand, ing.uom)}
                  </span>
                  {ing.qtyOnHand <= ing.reorderLevel && (
                    <span className="ml-2 text-red-600 text-xs">⚠ Low Stock</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {formatUnit(ing.reorderLevel, ing.uom)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">₹{ing.currentCostPerBaseUnit.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${ing.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {ing.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap flex gap-2">
                  <button
                    onClick={() => handleViewFIFO(ing)}
                    className="text-blue-600 hover:text-blue-800"
                    title="View FIFO Layers"
                  >
                    <FaEye />
                  </button>
                  <button
                    onClick={() => handleEdit(ing)}
                    className="text-yellow-600 hover:text-yellow-800"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(ing._id)}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">{editing ? "Edit Ingredient" : "Add Ingredient"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <optgroup label="Raw Ingredients">
                      <option value="Vegetables">Vegetables</option>
                      <option value="Dairy">Dairy</option>
                      <option value="Meat & Poultry">Meat & Poultry</option>
                      <option value="Grains & Staples">Grains & Staples</option>
                      <option value="Spices & Seasoning">Spices & Seasoning</option>
                      <option value="Cooking Oils & Ghee">Cooking Oils & Ghee</option>
                      <option value="Bread, Buns & Rotis">Bread, Buns & Rotis</option>
                      <option value="Snacks Ingredients">Snacks Ingredients</option>
                      <option value="Packaged Items">Packaged Items</option>
                      <option value="Beverages">Beverages</option>
                    </optgroup>
                    <optgroup label="Consumables & Non-Food">
                      <option value="Tissue & Paper Products">Tissue & Paper Products</option>
                      <option value="Packaging Materials">Packaging Materials</option>
                      <option value="Disposable Items">Disposable Items</option>
                      <option value="Cleaning Supplies">Cleaning Supplies</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location *</label>
                  <select
                    required
                    value={formData.storageLocation}
                    onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Dry Storage">Dry Storage</option>
                    <option value="Cold Storage">Cold Storage</option>
                    <option value="Frozen Storage">Frozen Storage</option>
                    <option value="Vegetables Section">Vegetables Section</option>
                    <option value="Cleaning Supplies">Cleaning Supplies</option>
                    <option value="Packaging Supplies">Packaging Supplies</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UOM *</label>
                  <select
                    required
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value, baseUnit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shelf time (Days)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.shelfTimeDays}
                  onChange={(e) => setFormData({ ...formData, shelfTimeDays: parseInt(e.target.value) })}
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

      {/* FIFO Layers Modal */}
      {fifoModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">FIFO Layers - {selectedIngredient?.name}</h2>
              <button
                onClick={() => setFifoModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {fifoLayers.length === 0 ? (
              <p className="text-gray-500">No FIFO layers found</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {fifoLayers.map((layer, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{new Date(layer.date).toLocaleDateString()}</td>
                      <td className="px-4 py-2">{formatUnit(layer.qty, layer.uom)}</td>
                      <td className="px-4 py-2">{formatUnit(layer.remainingQty, layer.uom)}</td>
                      <td className="px-4 py-2">₹{layer.unitCost.toFixed(2)}</td>
                      <td className="px-4 py-2">₹{(layer.remainingQty * layer.unitCost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Ingredients;


