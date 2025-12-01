import React, { useState, useEffect } from 'react';
import costingApi from '../../services/costingApi';
import FileUploader from '../../components/costing/FileUploader';
import ConfirmModal from '../../components/costing/ConfirmModal';
import DateRangePicker from '../../components/costing/DateRangePicker';
import * as XLSX from 'xlsx';

const DailyExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [bulkImportModal, setBulkImportModal] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    expenseCategoryId: '',
    franchiseId: '',
    kioskId: '',
  });
  const [formData, setFormData] = useState({
    franchiseId: '',
    kioskId: '',
    expenseCategoryId: '',
    amount: '',
    description: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
  });
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [bulkData, setBulkData] = useState([]);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getExpenses(filters);
      setExpenses(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
      alert('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await costingApi.getExpenseCategories();
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleOpenModal = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        franchiseId: expense.franchiseId?._id || '',
        kioskId: expense.kioskId?._id || '',
        expenseCategoryId: expense.expenseCategoryId?._id || '',
        amount: expense.amount || '',
        description: expense.description || '',
        expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        paymentMode: expense.paymentMode || 'Cash',
      });
    } else {
      setEditingExpense(null);
      setFormData({
        franchiseId: '',
        kioskId: '',
        expenseCategoryId: '',
        amount: '',
        description: '',
        expenseDate: new Date().toISOString().split('T')[0],
        paymentMode: 'Cash',
      });
    }
    setInvoiceFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormData({
      franchiseId: '',
      kioskId: '',
      expenseCategoryId: '',
      amount: '',
      description: '',
      expenseDate: new Date().toISOString().split('T')[0],
      paymentMode: 'Cash',
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
      alert(`Expense ${editingExpense ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Failed to save expense:', error);
      alert(`Failed to ${editingExpense ? 'update' : 'create'} expense: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      await costingApi.deleteExpense(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null });
      fetchExpenses();
      alert('Expense deleted successfully!');
    } catch (error) {
      console.error('Failed to delete expense:', error);
      alert(`Failed to delete expense: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleBulkImport = async () => {
    try {
      await costingApi.bulkImportExpenses(bulkData);
      setBulkImportModal(false);
      setBulkData([]);
      fetchExpenses();
      alert('Bulk import completed!');
    } catch (error) {
      console.error('Failed to bulk import:', error);
      alert(`Failed to bulk import: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        // Map CSV/Excel columns to expense format
        const mappedData = data.map((row, index) => {
          // Try to find category by name
          const category = categories.find(c => 
            c.name.toLowerCase() === (row.category || row['Expense Category'] || '').toLowerCase()
          );

          return {
            expenseCategoryId: category?._id || '',
            amount: parseFloat(row.amount || row.Amount || 0),
            description: row.description || row.Description || '',
            expenseDate: row.date || row.Date || row.expenseDate || new Date().toISOString().split('T')[0],
            paymentMode: row.paymentMode || row['Payment Mode'] || 'Cash',
            franchiseId: row.franchiseId || null,
            kioskId: row.kioskId || null,
          };
        }).filter(item => item.expenseCategoryId && item.amount > 0);

        setBulkData(mappedData);
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Failed to parse file. Please check the format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const paymentModes = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Other'];

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
        <h2 className="text-2xl font-bold text-[#4a2e1f]">Daily Expenses</h2>
        <div className="flex gap-3">
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
        <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <DateRangePicker
            startDate={filters.startDate}
            endDate={filters.endDate}
            onStartDateChange={(date) => setFilters({ ...filters, startDate: date })}
            onEndDateChange={(date) => setFilters({ ...filters, endDate: date })}
          />
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Category</label>
            <select
              value={filters.expenseCategoryId}
              onChange={(e) => setFilters({ ...filters, expenseCategoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Franchise ID</label>
            <input
              type="text"
              placeholder="Optional"
              value={filters.franchiseId}
              onChange={(e) => setFilters({ ...filters, franchiseId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6b4423] mb-1">Kiosk ID</label>
            <input
              type="text"
              placeholder="Optional"
              value={filters.kioskId}
              onChange={(e) => setFilters({ ...filters, kioskId: e.target.value })}
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
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Payment Mode</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
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
                    {expense.expenseCategoryId?.name || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{expense.paymentMode}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{expense.description || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(expense)}
                        className="text-[#d86d2a] hover:text-[#b85a1f]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, id: expense._id })}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Category *</label>
                  <select
                    required
                    value={formData.expenseCategoryId}
                    onChange={(e) => setFormData({ ...formData, expenseCategoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Payment Mode *</label>
                  <select
                    required
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  >
                    {paymentModes.map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Franchise ID</label>
                  <input
                    type="text"
                    value={formData.franchiseId}
                    onChange={(e) => setFormData({ ...formData, franchiseId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Kiosk ID</label>
                  <input
                    type="text"
                    value={formData.kioskId}
                    onChange={(e) => setFormData({ ...formData, kioskId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                    placeholder="Optional"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  {editingExpense ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">Bulk Import Expenses</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#6b4423] mb-1">Upload CSV/Excel File</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Expected columns: category, amount, description, date, paymentMode (optional: franchiseId, kioskId)
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
                              {categories.find(c => c._id === item.expenseCategoryId)?.name || '—'}
                            </td>
                            <td className="px-3 py-2">₹{item.amount}</td>
                            <td className="px-3 py-2">{item.expenseDate}</td>
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
  );
};

export default DailyExpenses;

