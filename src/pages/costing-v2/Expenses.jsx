import React, { useEffect, useState } from "react";
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  getExpenseCategories,
} from "../../services/costingV2Api";
import { FaPlus, FaEdit, FaTrash, FaRupeeSign, FaChartPie, FaCalendarAlt, FaFilter } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { useAuth } from "../../context/AuthContext";

const categoryLabels = {
  rent: "Rent",
  utilities: "Utilities",
  salaries: "Salaries",
  marketing: "Marketing",
  maintenance: "Maintenance",
  insurance: "Insurance",
  licenses: "Licenses",
  supplies: "Supplies",
  transport: "Transport",
  communication: "Communication",
  professional: "Professional",
  depreciation: "Depreciation",
  bank_charges: "Bank Charges",
  miscellaneous: "Miscellaneous",
};

const paymentModes = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque", "Credit", "Other"];

// Define which fields are relevant for each category
const categoryFieldConfig = {
  salaries: {
    showVendor: false,
    showInvoiceNumber: false,
    showSubCategory: true, // e.g., "Manager", "Chef", "Waiter"
    subCategoryPlaceholder: "e.g., Manager, Chef, Waiter",
  },
  rent: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: false,
    vendorLabel: "Landlord/Property Owner",
    invoiceLabel: "Rent Receipt Number",
  },
  utilities: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Electricity, Water, Gas",
    vendorLabel: "Utility Company",
    invoiceLabel: "Bill Number",
  },
  marketing: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Facebook Ads, Google Ads, Print Media",
    vendorLabel: "Marketing Agency/Platform",
    invoiceLabel: "Invoice Number",
  },
  maintenance: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Equipment Repair, Plumbing, Electrical",
    vendorLabel: "Service Provider",
    invoiceLabel: "Service Invoice Number",
  },
  insurance: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Business Insurance, Equipment Insurance",
    vendorLabel: "Insurance Company",
    invoiceLabel: "Policy/Invoice Number",
  },
  licenses: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., FSSAI, Shop Act, GST",
    vendorLabel: "Licensing Authority",
    invoiceLabel: "License Number",
  },
  supplies: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Cleaning Supplies, Packaging, Stationery",
    vendorLabel: "Supplier",
    invoiceLabel: "Invoice Number",
  },
  transport: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Delivery, Fuel, Vehicle Maintenance",
    vendorLabel: "Transport Company",
    invoiceLabel: "Invoice Number",
  },
  communication: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Phone, Internet, Mobile",
    vendorLabel: "Service Provider",
    invoiceLabel: "Bill Number",
  },
  professional: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Legal, Accounting, Consulting",
    vendorLabel: "Professional Service",
    invoiceLabel: "Invoice Number",
  },
  depreciation: {
    showVendor: false,
    showInvoiceNumber: false,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Equipment, Furniture, Vehicles",
  },
  bank_charges: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Transaction Fees, Interest, Service Charges",
    vendorLabel: "Bank",
    invoiceLabel: "Statement/Charge Slip Number",
  },
  miscellaneous: {
    showVendor: true,
    showInvoiceNumber: true,
    showSubCategory: true,
    subCategoryPlaceholder: "e.g., Other expenses",
    vendorLabel: "Vendor",
    invoiceLabel: "Invoice Number",
  },
};

const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [filters, setFilters] = useState({
    category: "",
    search: "",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    expenseDate: new Date().toISOString().split("T")[0],
    amount: 0,
    category: "miscellaneous",
    subCategory: "",
    description: "",
    paymentMode: "Cash",
    vendor: "",
    invoiceNumber: "",
    isRecurring: false,
    recurringFrequency: "",
  });

  useEffect(() => {
    fetchData();
  }, [selectedOutlet, dateRange, filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {
        from: dateRange.from,
        to: dateRange.to,
        ...(selectedOutlet && { outletId: selectedOutlet }),
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
      };

      const [expensesRes, summaryRes] = await Promise.all([
        getExpenses(params),
        getExpenseSummary(params),
      ]);

      if (expensesRes.data.success) setExpenses(expensesRes.data.data);
      if (summaryRes.data.success) setSummary(summaryRes.data.data);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      alert("Failed to fetch expenses");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await updateExpense(editingExpense._id, formData);
        alert("Expense updated successfully!");
      } else {
        await createExpense(formData);
        alert("Expense created successfully!");
      }
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert(`Failed to save expense: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      expenseDate: new Date(expense.expenseDate).toISOString().split("T")[0],
      amount: expense.amount,
      category: expense.category,
      subCategory: expense.subCategory || "",
      description: expense.description || "",
      paymentMode: expense.paymentMode || "Cash",
      vendor: expense.vendor || "",
      invoiceNumber: expense.invoiceNumber || "",
      isRecurring: expense.isRecurring || false,
      recurringFrequency: expense.recurringFrequency || "",
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteExpense(id);
      alert("Expense deleted successfully!");
      fetchData();
    } catch (error) {
      alert(`Failed to delete expense: ${error.response?.data?.message || error.message}`);
    }
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      expenseDate: new Date().toISOString().split("T")[0],
      amount: 0,
      category: "miscellaneous",
      subCategory: "",
      description: "",
      paymentMode: "Cash",
      vendor: "",
      invoiceNumber: "",
      isRecurring: false,
      recurringFrequency: "",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && !expenses.length) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#d86d2a]"></div>
          <p className="mt-4 text-gray-600">Loading expenses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Expense Management</h1>
          <p className="text-gray-600">Track and manage all operational expenses</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="bg-[#d86d2a] text-white px-6 py-3 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2 shadow-lg"
        >
          <FaPlus /> Add Expense
        </button>
      </div>

      {/* Filters & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Date Range & Filters */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
              >
                <option value="">All Categories</option>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search description, vendor, invoice..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
              />
            </div>
            <OutletFilter selectedOutlet={selectedOutlet} onOutletChange={setSelectedOutlet} />
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-[#d86d2a] to-[#c75b1a] rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Total Expenses</h3>
            <FaRupeeSign className="text-2xl" />
          </div>
          <p className="text-3xl font-bold mb-2">
            {summary ? formatCurrency(summary.total) : "₹0"}
          </p>
          <p className="text-sm opacity-90">{summary?.count || 0} transactions</p>
        </div>
      </div>

      {/* Category Summary */}
      {summary && summary.summary.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FaChartPie /> Expense by Category
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {summary.summary.map((item) => (
              <div
                key={item.category}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-gray-600">
                    {categoryLabels[item.category] || item.category}
                  </span>
                  <span className="text-xs text-gray-500">{item.count} items</span>
                </div>
                <p className="text-xl font-bold text-[#d86d2a]">{formatCurrency(item.total)}</p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#d86d2a] h-2 rounded-full"
                    style={{
                      width: `${(item.total / summary.total) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Mode
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No expenses found for the selected period
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(expense.expenseDate).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {categoryLabels[expense.category] || expense.category}
                      </span>
                      {expense.subCategory && (
                        <span className="ml-2 text-xs text-gray-500">({expense.subCategory})</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{expense.description || "-"}</div>
                      {expense.invoiceNumber && (
                        <div className="text-xs text-gray-500">Invoice: {expense.invoiceNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.vendor || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.paymentMode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleEdit(expense)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(expense._id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingExpense ? "Edit Expense" : "Add New Expense"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" key={formData.category}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => {
                      const newCategory = e.target.value;
                      // Reset vendor and invoice when category changes if not needed
                      const config = categoryFieldConfig[newCategory];
                      setFormData({
                        ...formData,
                        category: newCategory,
                        vendor: config?.showVendor ? formData.vendor : "",
                        invoiceNumber: config?.showInvoiceNumber ? formData.invoiceNumber : "",
                        subCategory: config?.showSubCategory ? formData.subCategory : "",
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  >
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {categoryFieldConfig[formData.category]?.showSubCategory && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
                    <input
                      type="text"
                      value={formData.subCategory}
                      onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                      placeholder={categoryFieldConfig[formData.category]?.subCategoryPlaceholder || "Sub category"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode *</label>
                  <select
                    required
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  >
                    {paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>
                {categoryFieldConfig[formData.category]?.showVendor && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {categoryFieldConfig[formData.category]?.vendorLabel || "Vendor"}
                    </label>
                    <input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder={categoryFieldConfig[formData.category]?.vendorLabel || "Vendor/Supplier name"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                    />
                  </div>
                )}
                {categoryFieldConfig[formData.category]?.showInvoiceNumber && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {categoryFieldConfig[formData.category]?.invoiceLabel || "Invoice Number"}
                    </label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      placeholder={categoryFieldConfig[formData.category]?.invoiceLabel || "Invoice/Bill number"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                  placeholder="Expense description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                    className="rounded border-gray-300 text-[#d86d2a] focus:ring-[#d86d2a]"
                  />
                  <span className="text-sm font-medium text-gray-700">Recurring Expense</span>
                </label>
                {formData.isRecurring && (
                  <select
                    value={formData.recurringFrequency}
                    onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d86d2a] focus:border-transparent"
                  >
                    <option value="">Select frequency</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a]"
                >
                  {editingExpense ? "Update" : "Create"} Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;

