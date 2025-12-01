import React, { useState, useEffect } from 'react';
import costingApi from '../../services/costingApi';
import FileUploader from '../../components/costing/FileUploader';
import ConfirmModal from '../../components/costing/ConfirmModal';
import DateRangePicker from '../../components/costing/DateRangePicker';

const Investments = () => {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    franchiseId: '',
    kioskId: '',
  });
  const [formData, setFormData] = useState({
    franchiseId: '',
    kioskId: '',
    title: '',
    amount: '',
    category: '',
    description: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    vendor: '',
  });
  const [invoiceFile, setInvoiceFile] = useState(null);

  useEffect(() => {
    fetchInvestments();
  }, [filters]);

  const fetchInvestments = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getInvestments(filters);
      setInvestments(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch investments:', error);
      alert('Failed to load investments');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (investment = null) => {
    if (investment) {
      setEditingInvestment(investment);
      setFormData({
        franchiseId: investment.franchiseId?._id || '',
        kioskId: investment.kioskId?._id || '',
        title: investment.title || '',
        amount: investment.amount || '',
        category: investment.category || '',
        description: investment.description || '',
        purchaseDate: investment.purchaseDate ? new Date(investment.purchaseDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        vendor: investment.vendor || '',
      });
    } else {
      setEditingInvestment(null);
      setFormData({
        franchiseId: '',
        kioskId: '',
        title: '',
        amount: '',
        category: '',
        description: '',
        purchaseDate: new Date().toISOString().split('T')[0],
        vendor: '',
      });
    }
    setInvoiceFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingInvestment(null);
    setFormData({
      franchiseId: '',
      kioskId: '',
      title: '',
      amount: '',
      category: '',
      description: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      vendor: '',
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

      if (editingInvestment) {
        await costingApi.updateInvestment(editingInvestment._id, data, invoiceFile);
      } else {
        await costingApi.createInvestment(data, invoiceFile);
      }

      handleCloseModal();
      fetchInvestments();
      alert(`Investment ${editingInvestment ? 'updated' : 'created'} successfully!`);
    } catch (error) {
      console.error('Failed to save investment:', error);
      alert(`Failed to ${editingInvestment ? 'update' : 'create'} investment: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      await costingApi.deleteInvestment(deleteModal.id);
      setDeleteModal({ isOpen: false, id: null });
      fetchInvestments();
      alert('Investment deleted successfully!');
    } catch (error) {
      console.error('Failed to delete investment:', error);
      alert(`Failed to delete investment: ${error.response?.data?.message || error.message}`);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const categories = ['Equipment', 'Infrastructure', 'Marketing', 'Technology', 'Furniture', 'License', 'Other'];

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
        <h2 className="text-2xl font-bold text-[#4a2e1f]">Investments</h2>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
        >
          + Add Investment
        </button>
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
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
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

      {/* Investments Table */}
      <div className="bg-white rounded-lg shadow-md border border-[#e2c1ac] overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-[#f5e3d5]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Purchase Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {investments.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  No investments found
                </td>
              </tr>
            ) : (
              investments.map((investment) => (
                <tr key={investment._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{investment.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{investment.category}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">{formatCurrency(investment.amount)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(investment.purchaseDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{investment.vendor || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(investment)}
                        className="text-[#d86d2a] hover:text-[#b85a1f]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, id: investment._id })}
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
              {editingInvestment ? 'Edit Investment' : 'Add Investment'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
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
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Purchase Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                  />
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
                  <label className="block text-sm font-medium text-[#6b4423] mb-1">Vendor</label>
                  <input
                    type="text"
                    value={formData.vendor}
                    onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
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
                    currentFile={editingInvestment?.invoicePath}
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
                  {editingInvestment ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Investment"
        message="Are you sure you want to delete this investment? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        danger={true}
      />
    </div>
  );
};

export default Investments;

