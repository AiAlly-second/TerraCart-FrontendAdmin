import React, { useState, useEffect } from "react";
import costingApi from "../../services/costingApi";
import FileUploader from "../../components/costing/FileUploader";
import ConfirmModal from "../../components/costing/ConfirmModal";
import DateRangePicker from "../../components/costing/DateRangePicker";
import * as XLSX from "xlsx";

const DailyExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [bulkImportModal, setBulkImportModal] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses"); // 'expenses' or 'opex'
  const [opexList, setOpexList] = useState([]);
  const [opexModalOpen, setOpexModalOpen] = useState(false);
  const [editingOpex, setEditingOpex] = useState(null);
  const [deleteOpexModal, setDeleteOpexModal] = useState({
    isOpen: false,
    id: null,
  });
  const [opexFormData, setOpexFormData] = useState({
    franchiseId: "",
    costCategory: "",
    amount: "",
    periodStartDate: new Date().toISOString().split("T")[0],
    periodEndDate: new Date().toISOString().split("T")[0],
    description: "",
  });
  const [opexInvoiceFile, setOpexInvoiceFile] = useState(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    expenseCategoryId: "",
    franchiseId: "",
    kioskId: "",
  });
  const [formData, setFormData] = useState({
    franchiseId: "",
    kioskId: "",
    expenseCategoryId: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().split("T")[0],
    paymentMode: "Cash",
  });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [bulkData, setBulkData] = useState([]);

  useEffect(() => {
    if (activeTab === "expenses") {
      fetchExpenses();
      fetchCategories();
    } else if (activeTab === "opex") {
      fetchOPEX();
    }
  }, [filters, activeTab]);

  const fetchOPEX = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getOutletOPEX(filters);
      setOpexList(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch OPEX:", error);
      alert("Failed to load OPEX");
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getExpenses(filters);
      setExpenses(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
      alert("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await costingApi.getExpenseCategories();
      setCategories(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  };

  const handleOpenModal = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        franchiseId: expense.franchiseId?._id || "",
        kioskId: expense.kioskId?._id || "",
        expenseCategoryId: expense.expenseCategoryId?._id || "",
        amount: expense.amount || "",
        description: expense.description || "",
        expenseDate: expense.expenseDate
          ? new Date(expense.expenseDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        paymentMode: expense.paymentMode || "Cash",
      });
    } else {
      setEditingExpense(null);
      setFormData({
        franchiseId: "",
        kioskId: "",
        expenseCategoryId: "",
        amount: "",
        description: "",
        expenseDate: new Date().toISOString().split("T")[0],
        paymentMode: "Cash",
      });
    }
    setInvoiceFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({
      franchiseId: "",
      kioskId: "",
      expenseCategoryId: "",
      amount: "",
      description: "",
      expenseDate: new Date().toISOString().split("T")[0],
      paymentMode: "Cash",
    });
    setInvoiceFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        amount: parseFloat(formData.amount),
        franchiseId: formData.franchiseId || null,
        kioskId: formData.kioskId || null,
      };

      if (editingExpense) {
        await costingApi.updateExpense(editingExpense._id, data, invoiceFile);
      } else {
        await costingApi.createExpense(data, invoiceFile);
      }

      handleCloseModal();
      fetchExpenses();
      alert(`Expense ${editingExpense ? "updated" : "created"} successfully!`);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to save expense:", error);
      }
      alert(
        `Failed to ${editingExpense ? "update" : "create"} expense: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleDelete = async () => {
    try {
      await costingApi.deleteExpense(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null });
      fetchExpenses();
      alert("Expense deleted successfully!");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to delete expense:", error);
      }
      alert(
        `Failed to delete expense: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleBulkImport = async () => {
    try {
      await costingApi.bulkImportExpenses(bulkData);
      setBulkImportModal(false);
      setBulkData([]);
      fetchExpenses();
      alert("Bulk import completed!");
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to bulk import:", error);
      }
      alert(
        `Failed to bulk import: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        // Input validation: Limit file size and add safety options
        const fileSize = file.size;
        const maxSize = 10 * 1024 * 1024; // 10MB limit
        if (fileSize > maxSize) {
          alert("File size exceeds 10MB limit. Please use a smaller file.");
          return;
        }

        // Use safe parsing options to mitigate prototype pollution
        const workbook = XLSX.read(event.target.result, {
          type: "binary",
          cellDates: false,
          cellNF: false,
          cellStyles: false,
          dense: false,
        });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, {
          defval: null,
          raw: false,
        });

        // Map CSV/Excel columns to expense format
        const mappedData = data
          .map((row, index) => {
            // Try to find category by name
            const category = categories.find(
              (c) =>
                c.name.toLowerCase() ===
                (row.category || row["Expense Category"] || "").toLowerCase()
            );

            return {
              expenseCategoryId: category?._id || "",
              amount: parseFloat(row.amount || row.Amount || 0),
              description: row.description || row.Description || "",
              expenseDate:
                row.date ||
                row.Date ||
                row.expenseDate ||
                new Date().toISOString().split("T")[0],
              paymentMode: row.paymentMode || row["Payment Mode"] || "Cash",
              franchiseId: row.franchiseId || null,
              kioskId: row.kioskId || null,
            };
          })
          .filter((item) => item.expenseCategoryId && item.amount > 0);

        setBulkData(mappedData);
      } catch (error) {
        console.error("Error parsing file:", error);
        alert("Failed to parse file. Please check the format.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const paymentModes = [
    "Cash",
    "UPI",
    "Card",
    "Bank Transfer",
    "Cheque",
    "Other",
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
        <h2 className="text-2xl font-bold text-[#4a2e1f]">
          Daily Expenses & OPEX
        </h2>
        <div className="flex gap-3">
          {activeTab === "expenses" && (
            <>
              <button
                onClick={() => setBulkImportModal(true)}
                className="px-4 py-2 bg-[#6b4423] text-white rounded-lg hover:bg-[#5a3520] transition-colors"
              >
                📥 Bulk Import
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
              >
                + Add Expense
              </button>
            </>
          )}
          {activeTab === "opex" && (
            <button
              onClick={() => {
                setEditingOpex(null);
                setOpexFormData({
                  franchiseId: "",
                  costCategory: "",
                  amount: "",
                  periodStartDate: new Date().toISOString().split("T")[0],
                  periodEndDate: new Date().toISOString().split("T")[0],
                  description: "",
                });
                setOpexInvoiceFile(null);
                setOpexModalOpen(true);
              }}
              className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
            >
              + Add OPEX
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("expenses")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "expenses"
                ? "border-[#d86d2a] text-[#d86d2a]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Daily Expenses
          </button>
          <button
            onClick={() => setActiveTab("opex")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "opex"
                ? "border-[#d86d2a] text-[#d86d2a]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Outlet OPEX
          </button>
        </nav>
      </div>

      {/* Expenses Tab */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">
              Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="md:col-span-2 lg:col-span-2">
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
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Category
                </label>
                <select
                  value={filters.expenseCategoryId}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      expenseCategoryId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Franchise ID
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={filters.franchiseId}
                  onChange={(e) =>
                    setFilters({ ...filters, franchiseId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Kiosk ID
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={filters.kioskId}
                  onChange={(e) =>
                    setFilters({ ...filters, kioskId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
            </div>
          </div>
          {/* Expenses Table */}
          <div className="bg-white rounded-lg shadow-md border border-[#e2c1ac] overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f5e3d5]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Payment Mode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {expenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No expenses found
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(expense.expenseDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {expense.expenseCategoryId?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {expense.paymentMode}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {expense.description || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal(expense)}
                            className="text-[#d86d2a] hover:text-[#b85a1f]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setDeleteModal({ isOpen: true, id: expense._id })
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

          {/* Create/Edit Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
                  {editingExpense ? "Edit Expense" : "Add Expense"}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Category *
                      </label>
                      <select
                        required
                        value={formData.expenseCategoryId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expenseCategoryId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat) => (
                          <option key={cat._id} value={cat._id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Expense Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={formData.expenseDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            expenseDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Payment Mode *
                      </label>
                      <select
                        required
                        value={formData.paymentMode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            paymentMode: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      >
                        {paymentModes.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Franchise ID
                      </label>
                      <input
                        type="text"
                        value={formData.franchiseId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            franchiseId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Kiosk ID
                      </label>
                      <input
                        type="text"
                        value={formData.kioskId}
                        onChange={(e) =>
                          setFormData({ ...formData, kioskId: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FileUploader
                        onFileSelect={setInvoiceFile}
                        currentFile={editingExpense?.invoicePath}
                      />
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
                      className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
                    >
                      {editingExpense ? "Update" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bulk Import Modal */}
          {bulkImportModal && (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
                  Bulk Import Expenses
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#6b4423] mb-1">
                      Upload CSV/Excel File
                    </label>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Expected columns: category, amount, description, date,
                      paymentMode (optional: franchiseId, kioskId)
                    </p>
                  </div>
                  {bulkData.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-[#6b4423] mb-2">
                        Found {bulkData.length} expenses to import
                      </p>
                      <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-3 py-2 text-left">Category</th>
                              <th className="px-3 py-2 text-left">Amount</th>
                              <th className="px-3 py-2 text-left">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkData.slice(0, 10).map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2">
                                  {categories.find(
                                    (c) => c._id === item.expenseCategoryId
                                  )?.name || "—"}
                                </td>
                                <td className="px-3 py-2">₹{item.amount}</td>
                                <td className="px-3 py-2">
                                  {item.expenseDate}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {bulkData.length > 10 && (
                          <p className="px-3 py-2 text-xs text-gray-500">
                            ... and {bulkData.length - 10} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => {
                        setBulkImportModal(false);
                        setBulkData([]);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkImport}
                      disabled={bulkData.length === 0}
                      className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import {bulkData.length > 0 && `(${bulkData.length})`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          <ConfirmModal
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal({ isOpen: false, id: null })}
            onConfirm={handleDelete}
            title="Delete Expense"
            message="Are you sure you want to delete this expense? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            danger={true}
          />
        </div>
      )}

      {/* OPEX Tab */}
      {activeTab === "opex" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">
              Filters
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="md:col-span-2 lg:col-span-2">
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
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Franchise ID
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={filters.franchiseId}
                  onChange={(e) =>
                    setFilters({ ...filters, franchiseId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">
                  Kiosk ID
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={filters.kioskId}
                  onChange={(e) =>
                    setFilters({ ...filters, kioskId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
              </div>
            </div>
          </div>
          {/* OPEX Table */}
          <div className="bg-white rounded-lg shadow-md border border-[#e2c1ac] overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f5e3d5]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    OPEX ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Franchise
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {opexList.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      No OPEX records found
                    </td>
                  </tr>
                ) : (
                  opexList.map((opex) => (
                    <tr key={opex._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {opex.outletOpexId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {opex.costCategory}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                        {formatCurrency(opex.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(opex.periodStartDate).toLocaleDateString()} -{" "}
                        {new Date(opex.periodEndDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {opex.franchiseId?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingOpex(opex);
                              setOpexFormData({
                                franchiseId: opex.franchiseId?._id || "",
                                costCategory: opex.costCategory,
                                amount: opex.amount,
                                periodStartDate: new Date(opex.periodStartDate)
                                  .toISOString()
                                  .split("T")[0],
                                periodEndDate: new Date(opex.periodEndDate)
                                  .toISOString()
                                  .split("T")[0],
                                description: opex.description || "",
                              });
                              setOpexInvoiceFile(null);
                              setOpexModalOpen(true);
                            }}
                            className="text-[#d86d2a] hover:text-[#b85a1f]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              setDeleteOpexModal({ isOpen: true, id: opex._id })
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

          {/* OPEX Create/Edit Modal */}
          {opexModalOpen && (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
                  {editingOpex ? "Edit Outlet OPEX" : "Add Outlet OPEX"}
                </h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const data = {
                        ...opexFormData,
                        amount: parseFloat(opexFormData.amount),
                        franchiseId: opexFormData.franchiseId || null,
                      };
                      if (editingOpex) {
                        await costingApi.updateOutletOPEX(
                          editingOpex._id,
                          data,
                          opexInvoiceFile
                        );
                        alert("OPEX updated successfully!");
                      } else {
                        await costingApi.createOutletOPEX(
                          data,
                          opexInvoiceFile
                        );
                        alert("OPEX created successfully!");
                      }
                      setOpexModalOpen(false);
                      setEditingOpex(null);
                      fetchOPEX();
                    } catch (error) {
                      console.error("Failed to save OPEX:", error);
                      alert(
                        `Failed to ${editingOpex ? "update" : "create"} OPEX: ${
                          error.response?.data?.message || error.message
                        }`
                      );
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Franchise ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={opexFormData.franchiseId}
                        onChange={(e) =>
                          setOpexFormData({
                            ...opexFormData,
                            franchiseId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                        placeholder="Enter Franchise ID"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Cost Category *
                      </label>
                      <select
                        required
                        value={opexFormData.costCategory}
                        onChange={(e) =>
                          setOpexFormData({
                            ...opexFormData,
                            costCategory: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      >
                        <option value="">Select Category</option>
                        {[
                          "Salary",
                          "Electricity",
                          "Water",
                          "Gas",
                          "Cleaning",
                          "Licensing",
                          "AMC",
                          "Rent",
                          "Insurance",
                          "Marketing",
                          "Maintenance",
                          "Other",
                        ].map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Amount *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        value={opexFormData.amount}
                        onChange={(e) =>
                          setOpexFormData({
                            ...opexFormData,
                            amount: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Period Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={opexFormData.periodStartDate}
                        onChange={(e) =>
                          setOpexFormData({
                            ...opexFormData,
                            periodStartDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Period End Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={opexFormData.periodEndDate}
                        onChange={(e) =>
                          setOpexFormData({
                            ...opexFormData,
                            periodEndDate: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">
                        Description
                      </label>
                      <textarea
                        value={opexFormData.description}
                        onChange={(e) =>
                          setOpexFormData({
                            ...opexFormData,
                            description: e.target.value,
                          })
                        }
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FileUploader
                        onFileSelect={setOpexInvoiceFile}
                        currentFile={null}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setOpexModalOpen(false)}
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

          {/* Delete OPEX Confirmation Modal */}
          <ConfirmModal
            isOpen={deleteOpexModal.isOpen}
            onClose={() => setDeleteOpexModal({ isOpen: false, id: null })}
            onConfirm={async () => {
              try {
                await costingApi.deleteOutletOPEX(deleteOpexModal.id);
                setDeleteOpexModal({ isOpen: false, id: null });
                fetchOPEX();
                alert("OPEX deleted successfully!");
              } catch (error) {
                console.error("Failed to delete OPEX:", error);
                alert(
                  `Failed to delete OPEX: ${
                    error.response?.data?.message || error.message
                  }`
                );
              }
            }}
            title="Delete OPEX"
            message="Are you sure you want to delete this OPEX record? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            danger={true}
          />
        </div>
      )}
    </div>
  );
};

export default DailyExpenses;
