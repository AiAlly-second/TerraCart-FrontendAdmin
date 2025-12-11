import React, { useEffect, useState, useMemo } from "react";
import api from "../utils/api";

const InventoryManagement = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStockStatus, setFilterStockStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [stockUpdateItem, setStockUpdateItem] = useState(null);
  const [stockUpdateQuantity, setStockUpdateQuantity] = useState("");
  const [stockOperation, setStockOperation] = useState("set");

  const emptyForm = {
    name: "",
    description: "",
    category: "",
    unit: "piece",
    quantity: 0,
    minStockLevel: 0,
    maxStockLevel: "",
    unitPrice: 0,
    supplier: "",
    supplierContact: "",
    location: "Main Storage",
    expiryDate: "",
    batchNumber: "",
    notes: "",
    isActive: true,
  };

  const [formData, setFormData] = useState(emptyForm);

  const units = ["kg", "g", "L", "mL", "piece", "pack", "box", "bottle", "dozen"];

  const loadInventory = async () => {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, statsRes] = await Promise.all([
        api.get("/inventory"),
        api.get("/inventory/stats").catch(() => null),
      ]);
      setInventory(itemsRes.data || []);
      if (statsRes?.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(inventory.map((item) => item.category))].filter(Boolean);
    return cats.sort();
  }, [inventory]);

  const getStockStatus = (item) => {
    if (item.quantity === 0) return "out_of_stock";
    if (item.quantity <= item.minStockLevel) return "low_stock";
    if (item.maxStockLevel && item.quantity >= item.maxStockLevel) return "over_stock";
    return "in_stock";
  };

  const getStockStatusColor = (status) => {
    switch (status) {
      case "out_of_stock":
        return "bg-red-100 text-red-800 border-red-200";
      case "low_stock":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "over_stock":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-green-100 text-green-800 border-green-200";
    }
  };

  const getStockStatusLabel = (status) => {
    switch (status) {
      case "out_of_stock":
        return "Out of Stock";
      case "low_stock":
        return "Low Stock";
      case "over_stock":
        return "Over Stock";
      default:
        return "In Stock";
    }
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory === "all" || item.category === filterCategory;

      const status = getStockStatus(item);
      const matchesStockStatus =
        filterStockStatus === "all" || status === filterStockStatus;

      return matchesSearch && matchesCategory && matchesStockStatus;
    });
  }, [inventory, searchTerm, filterCategory, filterStockStatus]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.patch(`/inventory/${editingItem._id}`, formData);
      } else {
        await api.post("/inventory", formData);
      }
      setFormData(emptyForm);
      setEditingItem(null);
      setShowForm(false);
      await loadInventory();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save inventory item");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      description: item.description || "",
      category: item.category || "",
      unit: item.unit || "piece",
      quantity: item.quantity || 0,
      minStockLevel: item.minStockLevel || 0,
      maxStockLevel: item.maxStockLevel || "",
      unitPrice: item.unitPrice || 0,
      supplier: item.supplier || "",
      supplierContact: item.supplierContact || "",
      location: item.location || "Main Storage",
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split("T")[0] : "",
      batchNumber: item.batchNumber || "",
      notes: item.notes || "",
      isActive: item.isActive !== undefined ? item.isActive : true,
    });
    setShowForm(true);
  };

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { confirm } = await import('../utils/confirm');
    const confirmed = await confirm(
      "Are you sure you want to PERMANENTLY DELETE this inventory item?\n\nThis action cannot be undone.",
      {
        title: 'Delete Inventory Item',
        warningMessage: 'WARNING: PERMANENTLY DELETE',
        danger: true,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/inventory/${id}`);
      await loadInventory();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete inventory item");
    }
  };

  const handleStockUpdate = async () => {
    if (!stockUpdateItem || !stockUpdateQuantity) {
      alert("Please enter quantity");
      return;
    }
    try {
      await api.patch(`/inventory/${stockUpdateItem._id}/stock`, {
        quantity: Number(stockUpdateQuantity),
        operation: stockOperation,
      });
      setStockUpdateItem(null);
      setStockUpdateQuantity("");
      setStockOperation("set");
      await loadInventory();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update stock");
    }
  };

  const handleNewItem = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
          <p className="text-gray-500 mt-1">Manage your inventory items and stock levels</p>
        </div>
        <button
          onClick={handleNewItem}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow"
        >
          + Add Item
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border">
            <div className="text-sm text-gray-500">Total Items</div>
            <div className="text-2xl font-bold text-gray-800">{stats.totalItems}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-yellow-200">
            <div className="text-sm text-gray-500">Low Stock</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStockItems}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-red-200">
            <div className="text-sm text-gray-500">Out of Stock</div>
            <div className="text-2xl font-bold text-red-600">{stats.outOfStockItems}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-green-200">
            <div className="text-sm text-gray-500">Total Value</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalValue)}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name, description, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
            <select
              value={filterStockStatus}
              onChange={(e) => setFilterStockStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="over_stock">Over Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                    No inventory items found
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const status = getStockStatus(item);
                  return (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-gray-500">{item.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.category}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.quantity} {item.unit}
                        </div>
                        <div className="text-xs text-gray-500">
                          Min: {item.minStockLevel} {item.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStockStatusColor(
                            status
                          )}`}
                        >
                          {getStockStatusLabel(status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(item.unitPrice)}/{item.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{item.location}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setStockUpdateItem(item);
                              setStockUpdateQuantity("");
                              setStockOperation("set");
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Stock
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, item._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editingItem ? "Edit Inventory Item" : "Add New Inventory Item"}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingItem(null);
                  setFormData(emptyForm);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="e.g., Vegetables, Beverages, Spices"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    rows="2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <select
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Stock Level *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.minStockLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, minStockLevel: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Stock Level
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxStockLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxStockLevel: e.target.value ? Number(e.target.value) : "",
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, unitPrice: Number(e.target.value) })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Contact
                  </label>
                  <input
                    type="text"
                    value={formData.supplierContact}
                    onChange={(e) =>
                      setFormData({ ...formData, supplierContact: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, batchNumber: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  rows="3"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingItem(null);
                    setFormData(emptyForm);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingItem ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Update Modal */}
      {stockUpdateItem && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Update Stock</h2>
              <button
                onClick={() => {
                  setStockUpdateItem(null);
                  setStockUpdateQuantity("");
                  setStockOperation("set");
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">
                Item: <span className="font-semibold">{stockUpdateItem.name}</span>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                Current Stock:{" "}
                <span className="font-semibold">
                  {stockUpdateItem.quantity} {stockUpdateItem.unit}
                </span>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Operation</label>
                <select
                  value={stockOperation}
                  onChange={(e) => setStockOperation(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="set">Set Quantity</option>
                  <option value="add">Add Quantity</option>
                  <option value="subtract">Subtract Quantity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={stockUpdateQuantity}
                  onChange={(e) => setStockUpdateQuantity(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder={`Enter quantity in ${stockUpdateItem.unit}`}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setStockUpdateItem(null);
                  setStockUpdateQuantity("");
                  setStockOperation("set");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleStockUpdate}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-700"
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;











