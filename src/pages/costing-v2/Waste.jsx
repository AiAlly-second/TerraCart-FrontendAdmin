import React, { useEffect, useState } from "react";
import {
  getWaste,
  recordWaste,
  getIngredients,
} from "../../services/costingV2Api";
import { FaPlus } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { useAuth } from "../../context/AuthContext";
import { formatUnit, convertUnit, areUnitsCompatible } from "../../utils/unitConverter";

const Waste = () => {
  const { user } = useAuth();
  const [wasteRecords, setWasteRecords] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    ingredientId: "",
    qty: "",
    uom: "kg",
    reason: "spoilage",
    reasonDetails: "",
  });
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [convertedQty, setConvertedQty] = useState(null);

  useEffect(() => {
    fetchData();
  }, [selectedOutlet]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedOutlet ? { cartId: selectedOutlet } : {};
      const [wasteRes, ingredientsRes] = await Promise.all([
        getWaste(params),
        getIngredients(),
      ]);
      if (wasteRes.data.success) {
        setWasteRecords(Array.isArray(wasteRes.data.data) ? wasteRes.data.data : []);
      } else {
        setWasteRecords([]);
      }
      if (ingredientsRes.data.success) {
        setIngredients(Array.isArray(ingredientsRes.data.data) ? ingredientsRes.data.data : []);
      } else {
        setIngredients([]);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching data:", error);
      }
      alert("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleIngredientChange = (ingredientId) => {
    const ingredient = ingredients.find(ing => ing._id === ingredientId);
    if (ingredient) {
      setSelectedIngredient(ingredient);
      setFormData(prev => ({
        ...prev,
        ingredientId,
        uom: ingredient.uom || prev.uom,
      }));
      setConvertedQty(null);
    } else {
      setSelectedIngredient(null);
      setFormData(prev => ({ ...prev, ingredientId }));
      setConvertedQty(null);
    }
  };

  const handleUomChange = (newUom) => {
    if (!formData.qty || formData.qty === "" || formData.qty === 0) {
      setFormData(prev => ({ ...prev, uom: newUom }));
      setConvertedQty(null);
      return;
    }

    const currentQty = parseFloat(formData.qty);
    if (isNaN(currentQty)) {
      setFormData(prev => ({ ...prev, uom: newUom }));
      setConvertedQty(null);
      return;
    }

    // Check if units are compatible
    if (areUnitsCompatible(formData.uom, newUom)) {
      try {
        const converted = convertUnit(currentQty, formData.uom, newUom);
        setFormData(prev => ({ ...prev, uom: newUom, qty: converted.toFixed(2) }));
        setConvertedQty(null);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Conversion error:", error);
        }
        setFormData(prev => ({ ...prev, uom: newUom }));
        setConvertedQty(null);
      }
    } else {
      // Units not compatible - show warning but allow change
      alert(`Warning: Cannot convert from ${formData.uom} to ${newUom}. Please enter a new quantity.`);
      setFormData(prev => ({ ...prev, uom: newUom, qty: "" }));
      setConvertedQty(null);
    }
  };

  const handleQtyChange = (newQty) => {
    setFormData(prev => ({ ...prev, qty: newQty }));
    setConvertedQty(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Ensure qty is a number
      if (!formData.ingredientId) {
        alert("Please select an ingredient");
        return;
      }

      const submitData = {
        ...formData,
        qty: parseFloat(formData.qty) || 0,
      };
      
      if (submitData.qty <= 0) {
        alert("Please enter a valid quantity greater than 0");
        return;
      }

      // Add cartId if selected (for franchise/super admin)
      if (selectedOutlet) {
        submitData.cartId = selectedOutlet;
      }

      await recordWaste(submitData);
      alert("Waste recorded successfully!");
      setModalOpen(false);
      setFormData({
        ingredientId: "",
        qty: "",
        uom: "kg",
        reason: "spoilage",
        reasonDetails: "",
      });
      setSelectedIngredient(null);
      setConvertedQty(null);
      fetchData();
    } catch (error) {
      alert(`Failed to record waste: ${error.response?.data?.message || error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading waste records...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Waste Records</h1>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <OutletFilter
            selectedOutlet={selectedOutlet}
            onOutletChange={setSelectedOutlet}
          />
          <button
            onClick={() => setModalOpen(true)}
            className="bg-[#d86d2a] text-white px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2 whitespace-nowrap"
          >
            <FaPlus /> Record Waste
          </button>
        </div>
      </div>

      {!Array.isArray(wasteRecords) || wasteRecords.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-2">No waste records found</p>
          <p className="text-gray-400 text-sm">
            {selectedOutlet ? "Try selecting a different kiosk or clear the filter." : "Start recording waste to track ingredient losses."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ingredient</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Allocated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wasteRecords.map((waste) => (
                  <tr key={waste._id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {waste.date ? new Date(waste.date).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {waste.ingredientId?.name || "N/A"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {waste.qty && waste.uom ? formatUnit(waste.qty, waste.uom) : "N/A"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800 capitalize">
                        {waste.reason || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{Number(waste.costAllocated || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Waste Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Record Waste</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient *</label>
                <select
                  required
                  value={formData.ingredientId}
                  onChange={(e) => handleIngredientChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Ingredient</option>
                  {Array.isArray(ingredients) && ingredients.length > 0 ? (
                    ingredients.map((ing) => (
                      <option key={ing._id} value={ing._id}>
                        {ing.name} ({ing.uom || 'N/A'})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>No ingredients available</option>
                  )}
                </select>
                {selectedIngredient && (
                  <p className="mt-1 text-xs text-gray-500">
                    Ingredient UOM: <strong>{selectedIngredient.uom}</strong>
                    {selectedIngredient.uom !== formData.uom && (
                      <span className="ml-2 text-orange-600">
                        (UOM changed to {formData.uom})
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.qty}
                    onChange={(e) => handleQtyChange(e.target.value)}
                    placeholder="Enter quantity"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  {convertedQty !== null && (
                    <p className="mt-1 text-xs text-gray-500">
                      Converted: {formatUnit(convertedQty, formData.uom, { autoConvert: false })}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UOM *</label>
                  <select
                    required
                    value={formData.uom}
                    onChange={(e) => handleUomChange(e.target.value)}
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
                  {selectedIngredient && formData.qty && formData.qty !== "" && areUnitsCompatible(selectedIngredient.uom, formData.uom) && selectedIngredient.uom !== formData.uom && (
                    <p className="mt-1 text-xs text-blue-600">
                      {formatUnit(parseFloat(formData.qty), formData.uom)} = {formatUnit(convertUnit(parseFloat(formData.qty), formData.uom, selectedIngredient.uom), selectedIngredient.uom)}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <select
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="spoilage">Spoilage</option>
                  <option value="overcooking">Overcooking</option>
                  <option value="expired">Expired</option>
                  <option value="damaged">Damaged</option>
                  <option value="spillage">Spillage</option>
                  <option value="portion_error">Portion Error</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason Details</label>
                <textarea
                  value={formData.reasonDetails}
                  onChange={(e) => setFormData({ ...formData, reasonDetails: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setFormData({
                      ingredientId: "",
                      qty: "",
                      uom: "kg",
                      reason: "spoilage",
                      reasonDetails: "",
                    });
                    setSelectedIngredient(null);
                    setConvertedQty(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a]"
                >
                  Record Waste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Waste;



