import React, { useState, useEffect } from "react";
import costingApi from "../../services/costingApi";
import ConfirmModal from "../../components/costing/ConfirmModal";
import DateRangePicker from "../../components/costing/DateRangePicker";
import FileUploader from "../../components/costing/FileUploader";

import { useAuth } from "../../context/AuthContext";

const InventoryCosting = () => {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ingredients"); // 'ingredients', 'transactions', or 'purchases'
  const [purchases, setPurchases] = useState([]);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [deletePurchaseModal, setDeletePurchaseModal] = useState({
    isOpen: false,
    id: null,
  });

  // Determine user roles
  const isCartAdmin = user?.role === "admin" || user?.role === "cart_admin";
  const isFranchiseAdmin = user?.role === "franchise_admin";
  const isSuperAdmin = user?.role === "super_admin";

  const [purchaseFormData, setPurchaseFormData] = useState({
    cartId: "",
    franchiseId: "",
    ingredientId: "",
    qtyPurchased: "",
    unit: "kg",
    totalCost: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    vendor: "",
    remarks: "",
  });
  const [purchaseInvoiceFile, setPurchaseInvoiceFile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    changeType: "",
    ingredientId: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    unit: "kg",
    costPerUnit: "",
    vendorId: "",
  });
  const [adjustFormData, setAdjustFormData] = useState({
    ingredientId: "",
    changeQty: "",
    changeType: "adjustment",
    cost: "",
    remarks: "",
  });

  useEffect(() => {
    if (activeTab === "ingredients") {
      fetchIngredients();
    } else if (activeTab === "transactions") {
      fetchTransactions();
    } else if (activeTab === "purchases") {
      fetchPurchases();
    }
  }, [activeTab, filters]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getIngredientPurchases(filters);
      setPurchases(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch purchases:", error);
      alert("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getIngredients();
      setIngredients(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch ingredients:", error);
      alert("Failed to load ingredients");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getInventoryTransactions(filters);
      setTransactions(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      alert("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (ingredient = null) => {
    if (ingredient) {
      setEditingIngredient(ingredient);
      setFormData({
        name: ingredient.name || "",
        unit: ingredient.unit || "kg",
        costPerUnit: ingredient.costPerUnit || "",
        vendorId: ingredient.vendorId?._id || "",
      });
    } else {
      setEditingIngredient(null);
      setFormData({
        name: "",
        unit: "kg",
        costPerUnit: "",
        vendorId: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingIngredient(null);
    setFormData({
      name: "",
      unit: "kg",
      costPerUnit: "",
      vendorId: "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        costPerUnit: parseFloat(formData.costPerUnit),
        vendorId: formData.vendorId || null,
      };

      if (editingIngredient) {
        await costingApi.updateIngredient(editingIngredient._id, data);
      } else {
        await costingApi.createIngredient(data);
      }

      handleCloseModal();
      fetchIngredients();
      alert(
        `Ingredient ${editingIngredient ? "updated" : "created"} successfully!`,
      );
    } catch (error) {
      console.error("Failed to save ingredient:", error);
      alert(
        `Failed to ${editingIngredient ? "update" : "create"} ingredient: ${error.response?.data?.message || error.message}`,
      );
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...adjustFormData,
        changeQty: parseFloat(adjustFormData.changeQty),
        cost: parseFloat(adjustFormData.cost || 0),
        referenceId: null,
      };

      await costingApi.adjustInventory(data);
      setAdjustModalOpen(false);
      setAdjustFormData({
        ingredientId: "",
        changeQty: "",
        changeType: "adjustment",
        cost: "",
        remarks: "",
      });
      fetchTransactions();
      alert("Inventory adjustment recorded successfully!");
    } catch (error) {
      console.error("Failed to adjust inventory:", error);
      alert(
        `Failed to record adjustment: ${error.response?.data?.message || error.message}`,
      );
    }
  };

  const handleDelete = async () => {
    try {
      await costingApi.deleteIngredient(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null });
      fetchIngredients();
      alert("Ingredient deleted successfully!");
    } catch (error) {
      console.error("Failed to delete ingredient:", error);
      alert(
        `Failed to delete ingredient: ${error.response?.data?.message || error.message}`,
      );
    }
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const units = ["kg", "g", "l", "ml", "pcs", "pack", "box", "bottle", "dozen"];
  const changeTypes = [
    { value: "purchase", label: "Purchase" },
    { value: "adjustment", label: "Adjustment" },
    { value: "wastage", label: "Wastage" },
    { value: "consumption", label: "Consumption" },
  ];

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
        <h2 className="text-2xl font-bold text-[#4a2e1f]">Inventory Costing</h2>
        <div className="flex gap-3">
          {activeTab === "ingredients" && (
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
            >
              + Add Ingredient
            </button>
          )}
          {activeTab === "transactions" && (
            <button
              onClick={() => setAdjustModalOpen(true)}
              className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
            >
              + Record Adjustment
            </button>
          )}
          {activeTab === "purchases" && (
            <button
              onClick={() => {
                setPurchaseFormData({
                  cartId: isCartAdmin ? user._id : "",
                  franchiseId: isFranchiseAdmin ? user._id : "",
                  ingredientId: "",
                  qtyPurchased: "",
                  unit: "kg",
                  totalCost: "",
                  purchaseDate: new Date().toISOString().split("T")[0],
                  vendor: "",
                  remarks: "",
                });
                setPurchaseInvoiceFile(null);
                setPurchaseModalOpen(true);
              }}
              className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
            >
              + Add Purchase
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("ingredients")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "ingredients"
                ? "border-[#d86d2a] text-[#d86d2a]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Ingredients
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "transactions"
                ? "border-[#d86d2a] text-[#d86d2a]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab("purchases")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "purchases"
                ? "border-[#d86d2a] text-[#d86d2a]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Ingredient Purchases
          </button>
        </nav>
      </div>

      {/* Ingredients Tab */}
      {activeTab === "ingredients" && (
        <div className="bg-white rounded-lg shadow-md border border-[#e2c1ac] overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#f5e3d5]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                  Cost Per Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ingredients.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-4 text-center text-gray-500"
                  >
                    No ingredients found
                  </td>
                </tr>
              ) : (
                ingredients.map((ingredient) => (
                  <tr key={ingredient._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {ingredient.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {ingredient.unit}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                      {formatCurrency(ingredient.costPerUnit)}/{ingredient.unit}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(ingredient.lastUpdatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(ingredient)}
                          className="text-[#d86d2a] hover:text-[#b85a1f]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            setDeleteModal({ isOpen: true, id: ingredient._id })
                          }
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">
              Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) =>
                  setFilters({ ...filters, startDate: date })
                }
                onEndDateChange={(date) =>
                  setFilters({ ...filters, endDate: date })
                }
              />
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Change Type
                </label>
                <select
                  value={filters.changeType}
                  onChange={(e) =>
                    setFilters({ ...filters, changeType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                >
                  <option value="">All Types</option>
                  {changeTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Ingredient
                </label>
                <select
                  value={filters.ingredientId}
                  onChange={(e) =>
                    setFilters({ ...filters, ingredientId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                >
                  <option value="">All Ingredients</option>
                  {ingredients.map((ing) => (
                    <option key={ing._id} value={ing._id}>
                      {ing.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-lg shadow-md border border-[#e2c1ac] overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f5e3d5]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Ingredient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Change Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {transaction.ingredientId?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            transaction.changeType === "purchase"
                              ? "bg-green-100 text-green-800"
                              : transaction.changeType === "wastage"
                                ? "bg-red-100 text-red-800"
                                : transaction.changeType === "consumption"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {transaction.changeType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {transaction.changeQty > 0 ? "+" : ""}
                        {transaction.changeQty}{" "}
                        {transaction.ingredientId?.unit || ""}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                        {formatCurrency(transaction.cost)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {transaction.remarks || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Ingredient Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
              {editingIngredient ? "Edit Ingredient" : "Add Ingredient"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Unit *
                  </label>
                  <select
                    required
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Cost Per Unit *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={formData.costPerUnit}
                    onChange={(e) =>
                      setFormData({ ...formData, costPerUnit: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Vendor ID
                </label>
                <input
                  type="text"
                  value={formData.vendorId}
                  onChange={(e) =>
                    setFormData({ ...formData, vendorId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  placeholder="Optional"
                />
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
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
                >
                  {editingIngredient ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjustModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
              Record Inventory Adjustment
            </h3>
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Ingredient *
                </label>
                <select
                  required
                  value={adjustFormData.ingredientId}
                  onChange={(e) =>
                    setAdjustFormData({
                      ...adjustFormData,
                      ingredientId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                >
                  <option value="">Select Ingredient</option>
                  {ingredients.map((ing) => (
                    <option key={ing._id} value={ing._id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Change Type *
                  </label>
                  <select
                    required
                    value={adjustFormData.changeType}
                    onChange={(e) =>
                      setAdjustFormData({
                        ...adjustFormData,
                        changeType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  >
                    {changeTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={adjustFormData.changeQty}
                    onChange={(e) =>
                      setAdjustFormData({
                        ...adjustFormData,
                        changeQty: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    placeholder="Use - for decrease"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Cost
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adjustFormData.cost}
                  onChange={(e) =>
                    setAdjustFormData({
                      ...adjustFormData,
                      cost: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Remarks
                </label>
                <textarea
                  value={adjustFormData.remarks}
                  onChange={(e) =>
                    setAdjustFormData({
                      ...adjustFormData,
                      remarks: e.target.value,
                    })
                  }
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  placeholder="Optional"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustModalOpen(false);
                    setAdjustFormData({
                      ingredientId: "",
                      changeQty: "",
                      changeType: "adjustment",
                      cost: "",
                      remarks: "",
                    });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchases Tab */}
      {activeTab === "purchases" && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">
              Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) =>
                  setFilters({ ...filters, startDate: date })
                }
                onEndDateChange={(date) =>
                  setFilters({ ...filters, endDate: date })
                }
              />
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Ingredient
                </label>
                <select
                  value={filters.ingredientId}
                  onChange={(e) =>
                    setFilters({ ...filters, ingredientId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                >
                  <option value="">All Ingredients</option>
                  {ingredients.map((ing) => (
                    <option key={ing._id} value={ing._id}>
                      {ing.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Purchases Table */}
          <div className="bg-white rounded-lg shadow-md border border-[#e2c1ac] overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f5e3d5]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Purchase ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Ingredient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Unit Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Total Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No purchases found
                    </td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {purchase.purchaseId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(purchase.purchaseDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {purchase.ingredientId?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {purchase.qtyPurchased} {purchase.unit}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                        {formatCurrency(purchase.unitCost || 0)}/{purchase.unit}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                        {formatCurrency(purchase.totalCost)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {purchase.vendor || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setPurchaseFormData({
                                cartId: purchase.cartId?._id || "",
                                franchiseId: purchase.franchiseId?._id || "",
                                ingredientId: purchase.ingredientId?._id || "",
                                qtyPurchased: purchase.qtyPurchased,
                                unit: purchase.unit,
                                totalCost: purchase.totalCost,
                                purchaseDate: new Date(purchase.purchaseDate)
                                  .toISOString()
                                  .split("T")[0],
                                vendor: purchase.vendor || "",
                                remarks: purchase.remarks || "",
                              });
                              setPurchaseInvoiceFile(null);
                              setPurchaseModalOpen(true);
                            }}
                            className="text-[#d86d2a] hover:text-[#b85a1f]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setDeletePurchaseModal({
                                isOpen: true,
                                id: purchase._id,
                              })
                            }
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Purchase Create/Edit Modal */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
              Add Ingredient Purchase
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const data = {
                    ...purchaseFormData,
                    qtyPurchased: parseFloat(purchaseFormData.qtyPurchased),
                    totalCost: parseFloat(purchaseFormData.totalCost),
                    cartId: purchaseFormData.cartId || null,
                    franchiseId: purchaseFormData.franchiseId || null,
                  };
                  await costingApi.createIngredientPurchase(
                    data,
                    purchaseInvoiceFile,
                  );
                  setPurchaseModalOpen(false);
                  fetchPurchases();
                  alert("Purchase created successfully!");
                } catch (error) {
                  console.error("Failed to create purchase:", error);
                  alert(
                    `Failed to create purchase: ${error.response?.data?.message || error.message}`,
                  );
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Outlet ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={purchaseFormData.cartId}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        cartId: e.target.value,
                      })
                    }
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] ${isCartAdmin ? "bg-gray-100 cursor-not-allowed" : ""}`}
                    disabled={isCartAdmin}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Franchise ID
                  </label>
                  <input
                    type="text"
                    value={purchaseFormData.franchiseId}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        franchiseId: e.target.value,
                      })
                    }
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a] ${isFranchiseAdmin ? "bg-gray-100 cursor-not-allowed" : ""}`}
                    placeholder="Optional"
                    disabled={isFranchiseAdmin}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Ingredient *
                  </label>
                  <select
                    required
                    value={purchaseFormData.ingredientId}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        ingredientId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  >
                    <option value="">Select Ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing._id} value={ing._id}>
                        {ing.name} ({ing.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseFormData.purchaseDate}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        purchaseDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={purchaseFormData.qtyPurchased}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        qtyPurchased: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Unit *
                  </label>
                  <select
                    required
                    value={purchaseFormData.unit}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        unit: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Total Cost *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={purchaseFormData.totalCost}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        totalCost: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Vendor
                  </label>
                  <input
                    type="text"
                    value={purchaseFormData.vendor}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        vendor: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    placeholder="Optional"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">
                    Remarks
                  </label>
                  <textarea
                    value={purchaseFormData.remarks}
                    onChange={(e) =>
                      setPurchaseFormData({
                        ...purchaseFormData,
                        remarks: e.target.value,
                      })
                    }
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    placeholder="Optional"
                  />
                </div>
                <div className="md:col-span-2">
                  <FileUploader
                    onFileSelect={setPurchaseInvoiceFile}
                    currentFile={null}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setPurchaseModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Purchase Confirmation Modal */}
      <ConfirmModal
        isOpen={deletePurchaseModal.isOpen}
        onClose={() => setDeletePurchaseModal({ isOpen: false, id: null })}
        onConfirm={async () => {
          try {
            await costingApi.deleteIngredientPurchase(deletePurchaseModal.id);
            setDeletePurchaseModal({ isOpen: false, id: null });
            fetchPurchases();
            alert("Purchase deleted successfully!");
          } catch (error) {
            console.error("Failed to delete purchase:", error);
            alert(
              `Failed to delete purchase: ${error.response?.data?.message || error.message}`,
            );
          }
        }}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Ingredient"
        message="Are you sure you want to delete this ingredient? This action cannot be undone. Make sure it's not used in any recipes."
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
      />
    </div>
  );
};

export default InventoryCosting;
