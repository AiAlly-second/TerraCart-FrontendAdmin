import React, { useEffect, useState } from "react";
import {
  getPurchases,
  createPurchase,
  receivePurchase,
  getSuppliers,
  getIngredients,
} from "../../services/costingV2Api";
import { FaPlus, FaCheck, FaShoppingCart, FaFileInvoice, FaCalendarAlt, FaTruck } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { useAuth } from "../../context/AuthContext";
import { formatUnit } from "../../utils/unitConverter";
import { confirm } from "../../utils/confirm";

const Purchases = () => {
  const { user } = useAuth();
  const isCartAdmin = String(user?.role || "").toLowerCase() === "admin";
  const canReceivePurchase = !isCartAdmin;
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
    items: [{ ingredientId: "", qty: "", uom: "kg", unitPrice: "" }],
  });

  useEffect(() => {
    fetchData();
  }, [selectedOutlet]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedOutlet ? { cartId: selectedOutlet } : {};
      const [purchasesRes, suppliersRes, ingredientsRes] = await Promise.all([
        getPurchases(params),
        getSuppliers(),
        getIngredients(),
      ]);
      if (purchasesRes.data.success) setPurchases(purchasesRes.data.data);
      if (suppliersRes.data.success) setSuppliers(suppliersRes.data.data);
      if (ingredientsRes.data.success) setIngredients(ingredientsRes.data.data);
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
      const submitData = {
        ...formData,
        items: formData.items.map(item => ({
          ...item,
          qty: item.qty === "" || item.qty === null || item.qty === undefined ? 0 : parseFloat(item.qty) || 0,
          unitPrice: item.unitPrice === "" || item.unitPrice === null || item.unitPrice === undefined ? 0 : parseFloat(item.unitPrice) || 0,
        }))
      };
      await createPurchase(submitData);
      alert("Purchase order created successfully!");
      setModalOpen(false);
      setFormData({
        supplierId: "",
        date: new Date().toISOString().split("T")[0],
        invoiceNo: "",
        items: [{ ingredientId: "", qty: "", uom: "kg", unitPrice: "" }],
      });
      fetchData();
    } catch (error) {
      alert(`Failed to create purchase: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleReceive = async (id) => {
    if (!canReceivePurchase) {
      return;
    }

    const purchase = purchases.find(p => p._id === id);
    const purchaseInfo = purchase 
      ? `Purchase Order #${purchase.purchaseOrderNo || purchase._id.slice(-6)}`
      : 'this purchase';
    
    const confirmed = await confirm(
      `Are you sure you want to mark ${purchaseInfo} as received?\n\nThis will update inventory with FIFO layers and cannot be undone.`,
      {
        title: 'Receive Purchase',
        confirmText: 'Receive',
        cancelText: 'Cancel',
        danger: false,
        requireInput: false
      }
    );
    
    if (!confirmed) return;
    
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
      items: [...formData.items, { ingredientId: "", qty: "", uom: "kg", unitPrice: "" }],
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
    
    // When ingredient is selected, auto-set the UOM to match the ingredient's UOM
    if (field === "ingredientId" && value) {
      const selectedIngredient = ingredients.find(ing => ing._id === value);
      if (selectedIngredient && selectedIngredient.uom) {
        newItems[index].uom = selectedIngredient.uom;
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const totalAmount = formData.items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(item.unitPrice) || 0;
    return sum + (qty * price);
  }, 0);

  const stats = {
    total: purchases.length,
    pending: purchases.filter(p => p.status === "created").length,
    received: purchases.filter(p => p.status === "received").length,
    totalValue: purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#d86d2a] border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading purchases...</p>
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
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">Purchase Orders</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage your ingredient purchases</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <OutletFilter selectedOutlet={selectedOutlet} onOutletChange={setSelectedOutlet} />
            <button
              onClick={() => setModalOpen(true)}
              className="bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm sm:text-base font-medium w-full sm:w-auto justify-center"
            >
              <FaPlus className="text-sm sm:text-base" /> Create Purchase Order
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Total Orders</p>
            <FaShoppingCart className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Pending</p>
            <FaFileInvoice className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.pending}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Received</p>
            <FaCheck className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.received}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Total Value</p>
            <FaTruck className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">₹{Number(stats.totalValue).toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Purchases Grid */}
      {purchases.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <FaShoppingCart className="text-5xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No purchase orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {purchases.map((purchase) => (
            <div
              key={purchase._id}
              className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
            >
              {/* Card Header */}
              <div className={`p-4 sm:p-5 ${
                purchase.status === "received" ? "bg-gradient-to-r from-green-50 to-green-100" :
                purchase.status === "cancelled" ? "bg-gradient-to-r from-red-50 to-red-100" :
                "bg-gradient-to-r from-yellow-50 to-yellow-100"
              }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-gray-800 text-base sm:text-lg">
                      PO #{purchase.purchaseOrderNo || purchase._id.slice(-8)}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      {purchase.supplierId?.name || "N/A"}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                    purchase.status === "received" ? "bg-green-500 text-white" :
                    purchase.status === "cancelled" ? "bg-red-500 text-white" :
                    "bg-yellow-500 text-white"
                  }`}>
                    {purchase.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <FaCalendarAlt className="text-xs" />
                    <span>{new Date(purchase.date).toLocaleDateString()}</span>
                  </div>
                  {purchase.invoiceNo && (
                    <div className="flex items-center gap-1">
                      <FaFileInvoice className="text-xs" />
                      <span>{purchase.invoiceNo}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 space-y-3">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2">Items ({purchase.items?.length || 0})</p>
                  <div className="space-y-1.5">
                    {purchase.items && purchase.items.length > 0 ? (
                      <>
                        {purchase.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs sm:text-sm bg-gray-50 rounded-lg p-2">
                            <span className="font-medium text-gray-800 truncate flex-1">
                              {item.ingredientId?.name || 'Unknown'}
                            </span>
                            <span className="text-gray-700 font-semibold ml-2">
                              {formatUnit(item.qty, item.uom || 'kg')}
                            </span>
                          </div>
                        ))}
                        {purchase.items.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            +{purchase.items.length - 3} more items
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-400 text-xs sm:text-sm">No items</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs sm:text-sm text-gray-600">Total Amount</span>
                  <span className="text-lg sm:text-xl font-bold text-[#d86d2a]">
                    ₹{Number(purchase.totalAmount || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              {purchase.status === "created" && canReceivePurchase && (
                <div className="px-4 sm:px-5 py-3 bg-gray-50 border-t flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleReceive(purchase._id);
                    }}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm font-medium"
                    title="Receive Purchase"
                  >
                    <FaCheck className="text-sm" /> Receive
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Purchase Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white p-4 sm:p-6 rounded-t-2xl">
              <h2 className="text-xl sm:text-2xl font-bold">Create Purchase Order</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supplier *</label>
                  <select
                    required
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Invoice No</label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">Items *</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-[#d86d2a] hover:text-[#c75b1a] font-medium flex items-center gap-1"
                  >
                    <FaPlus /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-3 bg-gray-50 rounded-lg">
                      <select
                        required
                        value={item.ingredientId}
                        onChange={(e) => updateItem(index, "ingredientId", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm sm:col-span-2"
                      >
                        <option value="">Select Ingredient</option>
                        {ingredients.map((ing) => (
                          <option key={ing._id} value={ing._id}>{ing.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        placeholder="Quantity"
                        value={item.qty === "" || item.qty === null || item.qty === undefined ? "" : item.qty}
                        onChange={(e) => updateItem(index, "qty", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm"
                      />
                      <select
                        required
                        value={item.uom}
                        onChange={(e) => updateItem(index, "uom", e.target.value)}
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
                      <div className="flex gap-2">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          placeholder="Unit Price"
                          value={item.unitPrice === "" || item.unitPrice === null || item.unitPrice === undefined ? "" : item.unitPrice}
                          onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent text-sm"
                        />
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
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
                {totalAmount > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Estimated Total:</span>
                      <span className="text-lg font-bold text-[#d86d2a]">₹{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white rounded-lg hover:shadow-lg font-medium transition-all"
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
