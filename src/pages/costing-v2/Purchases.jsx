import React, { useEffect, useState } from "react";
import {
  getPurchases,
  createPurchase,
  receivePurchase,
  getSuppliers,
  getIngredients,
} from "../../services/costingV2Api";
import { FaPlus, FaCheck } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { useAuth } from "../../context/AuthContext";

const Purchases = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    supplierId: "",
    date: new Date().toISOString().split("T")[0],
    invoiceNo: "",
    items: [{ ingredientId: "", qty: 0, uom: "kg", unitPrice: 0 }],
  });

  useEffect(() => {
    fetchData();
  }, [selectedOutlet]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedOutlet ? { outletId: selectedOutlet } : {};
      const [purchasesRes, suppliersRes, ingredientsRes] = await Promise.all([
        getPurchases(params),
        getSuppliers(),
        getIngredients(),
      ]);
      if (purchasesRes.data.success) setPurchases(purchasesRes.data.data);
      if (suppliersRes.data.success) setSuppliers(suppliersRes.data.data);
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
      await createPurchase(formData);
      alert("Purchase order created successfully!");
      setModalOpen(false);
      setFormData({
        supplierId: "",
        date: new Date().toISOString().split("T")[0],
        invoiceNo: "",
        items: [{ ingredientId: "", qty: 0, uom: "kg", unitPrice: 0 }],
      });
      fetchData();
    } catch (error) {
      alert(`Failed to create purchase: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleReceive = async (id) => {
    if (!window.confirm("Mark this purchase as received? This will update inventory with FIFO layers.")) return;
    try {
      await receivePurchase(id);
      alert("Purchase received successfully! Inventory updated.");
      fetchData();
    } catch (error) {
      alert(`Failed to receive purchase: ${error.response?.data?.message || error.message}`);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { ingredientId: "", qty: 0, uom: "kg", unitPrice: 0 }],
    });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading purchases...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Purchases</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-[#d86d2a] text-white px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2"
        >
          <FaPlus /> Create Purchase Order
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {purchases.map((purchase) => (
              <tr key={purchase._id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{purchase.purchaseOrderNo || "N/A"}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {purchase.supplierId?.name || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(purchase.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{purchase.invoiceNo || "N/A"}</td>
                <td className="px-6 py-4">
                  <div className="text-sm space-y-1">
                    {purchase.items && purchase.items.length > 0 ? (
                      purchase.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-medium">
                            {item.ingredientId?.name || 'Unknown Ingredient'}:
                          </span>
                          <span className="text-gray-700 font-semibold">
                            {typeof item.qty === 'number' ? item.qty.toFixed(2) : item.qty} {item.uom || 'kg'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-400">No items</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-semibold">
                  ₹{Number(purchase.totalAmount || 0).toLocaleString("en-IN")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs ${
                    purchase.status === "received" ? "bg-green-100 text-green-800" :
                    purchase.status === "cancelled" ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {purchase.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {purchase.status === "created" && (
                    <button
                      onClick={() => handleReceive(purchase._id)}
                      className="text-green-600 hover:text-green-800 flex items-center gap-1"
                      title="Receive Purchase"
                    >
                      <FaCheck /> Receive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Purchase Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Purchase Order</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                  <select
                    required
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No</label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Items *</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-[#d86d2a] hover:underline"
                  >
                    + Add Item
                  </button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                    <select
                      required
                      value={item.ingredientId}
                      onChange={(e) => updateItem(index, "ingredientId", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Ingredient</option>
                      {ingredients.map((ing) => (
                        <option key={ing._id} value={ing._id}>{ing.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) => updateItem(index, "qty", parseFloat(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <select
                      required
                      value={item.uom}
                      onChange={(e) => updateItem(index, "uom", e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="l">l</option>
                      <option value="ml">ml</option>
                      <option value="pcs">pcs</option>
                    </select>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="Unit Price"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a]"
                >
                  Create Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;



