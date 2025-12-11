import React, { useEffect, useState } from "react";
import {
  getInventoryTransactions,
  consumeInventory,
  getIngredients,
} from "../../services/costingV2Api";
import { FaPlus, FaFilter, FaSearch, FaExclamationTriangle } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { formatUnit } from "../../utils/unitConverter";

const Inventory = () => {
  const [ingredients, setIngredients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stock"); // "stock" or "transactions"
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStorage, setSelectedStorage] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [formData, setFormData] = useState({
    ingredientId: "",
    qty: 0,
    uom: "kg",
    refType: "manual",
  });

  useEffect(() => {
    fetchData();
  }, [selectedOutlet]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedOutlet ? { outletId: selectedOutlet } : {};
      const [transactionsRes, ingredientsRes] = await Promise.all([
        getInventoryTransactions(params),
        getIngredients(params),
      ]);
      if (transactionsRes.data.success) setTransactions(transactionsRes.data.data);
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
      await consumeInventory({
        ...formData,
      });
      alert("Inventory consumed successfully!");
      setModalOpen(false);
      setFormData({
        ingredientId: "",
        qty: 0,
        uom: "kg",
        refType: "manual",
      });
      fetchData();
    } catch (error) {
      alert(`Failed to consume inventory: ${error.response?.data?.message || error.message}`);
    }
  };

  // Get unique categories
  const categories = ["all", ...new Set(ingredients.map((ing) => ing.category || "Other"))];
  const storageLocations = ["all", ...new Set(ingredients.map((ing) => ing.storageLocation || "Dry Storage"))];

  // Filter ingredients
  const filteredIngredients = ingredients.filter((ing) => {
    if (selectedCategory !== "all" && (ing.category || "Other") !== selectedCategory) return false;
    if (selectedStorage !== "all" && (ing.storageLocation || "Dry Storage") !== selectedStorage) return false;
    if (searchTerm && !ing.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (showLowStockOnly && ing.qtyOnHand > ing.reorderLevel) return false;
    return true;
  });

  // Group by category
  const groupedByCategory = filteredIngredients.reduce((acc, ing) => {
    const category = ing.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(ing);
    return acc;
  }, {});

  // Calculate statistics
  const totalItems = ingredients.length;
  const lowStockItems = ingredients.filter((ing) => ing.qtyOnHand <= ing.reorderLevel).length;
  const totalValue = ingredients.reduce((sum, ing) => sum + (ing.qtyOnHand * ing.currentCostPerBaseUnit), 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
            <p className="text-gray-600 mt-1">Manage all inventory items including ingredients, supplies, and consumables</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-[#d86d2a] text-white px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2"
          >
            <FaPlus /> Consume Inventory
          </button>
        </div>
        <div className="flex justify-end">
          <OutletFilter selectedOutlet={selectedOutlet} onOutletChange={setSelectedOutlet} />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Items</div>
          <div className="text-2xl font-bold text-gray-800">{totalItems}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Low Stock Items</div>
          <div className="text-2xl font-bold text-red-600">{lowStockItems}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Inventory Value</div>
          <div className="text-2xl font-bold text-gray-800">₹{totalValue.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Active Items</div>
          <div className="text-2xl font-bold text-green-600">
            {ingredients.filter((ing) => ing.isActive).length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("stock")}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === "stock"
                  ? "border-[#d86d2a] text-[#d86d2a]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Stock Levels
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === "transactions"
                  ? "border-[#d86d2a] text-[#d86d2a]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Transactions
            </button>
          </nav>
        </div>

        {/* Filters */}
        {activeTab === "stock" && (
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Categories</option>
                  {categories.filter((c) => c !== "all").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={selectedStorage}
                  onChange={(e) => setSelectedStorage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Storage Locations</option>
                  {storageLocations.filter((s) => s !== "all").map((storage) => (
                    <option key={storage} value={storage}>
                      {storage}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="lowStockOnly"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="lowStockOnly" className="text-sm text-gray-700">
                  Low Stock Only
                </label>
              </div>
              <div className="text-sm text-gray-600 flex items-center">
                Showing {filteredIngredients.length} of {totalItems} items
              </div>
            </div>
          </div>
        )}

        {/* Stock Levels Tab */}
        {activeTab === "stock" && (
          <div className="p-4">
            {Object.keys(groupedByCategory).length === 0 ? (
              <div className="text-center py-12 text-gray-500">No items found</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByCategory).map(([category, items]) => (
                  <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">
                      {category} ({items.length} items)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UOM</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {items.map((ing) => {
                            const isLowStock = ing.qtyOnHand <= ing.reorderLevel;
                            const stockValue = ing.qtyOnHand * ing.currentCostPerBaseUnit;
                            return (
                              <tr key={ing._id} className={isLowStock ? "bg-red-50" : ""}>
                                <td className="px-4 py-3 whitespace-nowrap font-medium">
                                  {ing.name}
                                  {isLowStock && (
                                    <FaExclamationTriangle className="inline-block ml-2 text-red-600" title="Low Stock" />
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                                    {ing.storageLocation || "Dry Storage"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">{ing.uom}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={isLowStock ? "text-red-600 font-semibold" : ""}>
                                    {formatUnit(ing.qtyOnHand, ing.uom)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">{formatUnit(ing.reorderLevel, ing.uom)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">₹{ing.currentCostPerBaseUnit.toFixed(2)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">₹{stockValue.toFixed(2)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      ing.isActive
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {ing.isActive ? "Active" : "Inactive"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Allocated</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => (
                      <tr key={txn._id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(txn.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {txn.ingredientId?.name || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {txn.ingredientId?.category || "Other"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              txn.type === "IN"
                                ? "bg-green-100 text-green-800"
                                : txn.type === "OUT"
                                ? "bg-red-100 text-red-800"
                                : txn.type === "WASTE"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {txn.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatUnit(txn.qty, txn.uom)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          ₹{Number(txn.costAllocated || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {txn.refType}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Consume Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Consume Inventory</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                <select
                  required
                  value={formData.ingredientId}
                  onChange={(e) => setFormData({ ...formData, ingredientId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Item</option>
                  {ingredients
                    .filter((ing) => ing.isActive)
                    .map((ing) => (
                      <option key={ing._id} value={ing._id}>
                        {ing.name} ({ing.category || "Other"})
                      </option>
                    ))}
                </select>
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
                    onChange={(e) => setFormData({ ...formData, qty: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UOM *</label>
                  <select
                    required
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Type</label>
                <select
                  value={formData.refType}
                  onChange={(e) => setFormData({ ...formData, refType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="manual">Manual</option>
                  <option value="recipe">Recipe</option>
                  <option value="waste">Waste</option>
                  <option value="adjustment">Adjustment</option>
                </select>
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
                  Consume
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
