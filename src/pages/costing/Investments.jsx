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
  const [activeTab, setActiveTab] = useState('investments'); // 'investments' or 'assets'
  const [assets, setAssets] = useState([]);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [deleteAssetModal, setDeleteAssetModal] = useState({ isOpen: false, id: null });
  const [assetFormData, setAssetFormData] = useState({
    franchiseId: '',
    assetType: '',
    assetName: '',
    purchaseCost: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    usefulLifeMonths: '60',
    depreciationMethod: 'straight_line',
    description: '',
  });
  const [assetInvoiceFile, setAssetInvoiceFile] = useState(null);
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
    if (activeTab === 'investments') {
      fetchInvestments();
    } else if (activeTab === 'assets') {
      fetchAssets();
    }
  }, [filters, activeTab]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await costingApi.getOutletAssets(filters);
      setAssets(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      alert('Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

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
        <h2 className="text-2xl font-bold text-[#4a2e1f]">Investments & Assets</h2>
        {activeTab === 'investments' && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
          >
            + Add Investment
          </button>
        )}
        {activeTab === 'assets' && (
          <button
            onClick={() => {
              setEditingAsset(null);
              setAssetFormData({
                franchiseId: '',
                assetType: '',
                assetName: '',
                purchaseCost: '',
                purchaseDate: new Date().toISOString().split('T')[0],
                usefulLifeMonths: '60',
                depreciationMethod: 'straight_line',
                description: '',
              });
              setAssetInvoiceFile(null);
              setAssetModalOpen(true);
            }}
            className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors"
          >
            + Add Asset
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('investments')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'investments'
                ? 'border-[#d86d2a] text-[#d86d2a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Investments
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assets'
                ? 'border-[#d86d2a] text-[#d86d2a]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Outlet Assets
          </button>
        </nav>
      </div>

      {/* Investments Tab */}
      {activeTab === 'investments' && (
        <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
        <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="md:col-span-2 lg:col-span-2">
            <DateRangePicker
              startDate={filters.startDate}
              endDate={filters.endDate}
              onStartDateChange={(date) => setFilters({ ...filters, startDate: date })}
              onEndDateChange={(date) => setFilters({ ...filters, endDate: date })}
            />
          </div>
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
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
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
      )}

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-[#e2c1ac]">
            <h3 className="text-lg font-semibold text-[#4a2e1f] mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          {/* Assets Table */}
          <div className="bg-white rounded-lg shadow-md border border-[#e2c1ac] overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f5e3d5]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Asset ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Asset Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Purchase Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Current Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Purchase Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Useful Life</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#4a2e1f] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assets.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                      No assets found
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{asset.assetId}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{asset.assetName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{asset.assetType}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-[#4a2e1f]">
                        {formatCurrency(asset.purchaseCost)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-blue-600">
                        {formatCurrency(asset.currentValue || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(asset.purchaseDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {asset.usefulLifeMonths} months
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingAsset(asset);
                              setAssetFormData({
                                franchiseId: asset.franchiseId?._id || '',
                                assetType: asset.assetType,
                                assetName: asset.assetName,
                                purchaseCost: asset.purchaseCost,
                                purchaseDate: new Date(asset.purchaseDate).toISOString().split('T')[0],
                                usefulLifeMonths: asset.usefulLifeMonths.toString(),
                                depreciationMethod: asset.depreciationMethod || 'straight_line',
                                description: asset.description || '',
                              });
                              setAssetInvoiceFile(null);
                              setAssetModalOpen(true);
                            }}
                            className="text-[#d86d2a] hover:text-[#b85a1f]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteAssetModal({ isOpen: true, id: asset._id })}
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

          {/* Asset Create/Edit Modal */}
          {assetModalOpen && (
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 className="text-2xl font-bold text-[#4a2e1f] mb-4">
                  {editingAsset ? 'Edit Outlet Asset' : 'Add Outlet Asset'}
                </h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const data = {
                      ...assetFormData,
                      purchaseCost: parseFloat(assetFormData.purchaseCost),
                      usefulLifeMonths: parseInt(assetFormData.usefulLifeMonths),
                      franchiseId: assetFormData.franchiseId || null,
                    };
                    if (editingAsset) {
                      await costingApi.updateOutletAsset(editingAsset._id, data, assetInvoiceFile);
                      alert('Asset updated successfully!');
                    } else {
                      await costingApi.createOutletAsset(data, assetInvoiceFile);
                      alert('Asset created successfully!');
                    }
                    setAssetModalOpen(false);
                    setEditingAsset(null);
                    fetchAssets();
                  } catch (error) {
                    console.error('Failed to save asset:', error);
                    alert(`Failed to ${editingAsset ? 'update' : 'create'} asset: ${error.response?.data?.message || error.message}`);
                  }
                }} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Franchise ID *</label>
                      <input
                        type="text"
                        required
                        value={assetFormData.franchiseId}
                        onChange={(e) => setAssetFormData({ ...assetFormData, franchiseId: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                        placeholder="Enter Franchise ID or Code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Asset Type *</label>
                      <select
                        required
                        value={assetFormData.assetType}
                        onChange={(e) => setAssetFormData({ ...assetFormData, assetType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      >
                        <option value="">Select Type</option>
                        {['Kiosk', 'POS', 'Freezer', 'Oven', 'Refrigerator', 'Furniture', 'Equipment', 'Vehicle', 'Technology', 'Other'].map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Asset Name *</label>
                      <input
                        type="text"
                        required
                        value={assetFormData.assetName}
                        onChange={(e) => setAssetFormData({ ...assetFormData, assetName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Purchase Cost *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        value={assetFormData.purchaseCost}
                        onChange={(e) => setAssetFormData({ ...assetFormData, purchaseCost: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Purchase Date *</label>
                      <input
                        type="date"
                        required
                        value={assetFormData.purchaseDate}
                        onChange={(e) => setAssetFormData({ ...assetFormData, purchaseDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Useful Life (Months) *</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={assetFormData.usefulLifeMonths}
                        onChange={(e) => setAssetFormData({ ...assetFormData, usefulLifeMonths: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Depreciation Method *</label>
                      <select
                        required
                        value={assetFormData.depreciationMethod}
                        onChange={(e) => setAssetFormData({ ...assetFormData, depreciationMethod: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                      >
                        <option value="straight_line">Straight Line</option>
                        <option value="declining_balance">Declining Balance</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[#6b4423] mb-1">Description</label>
                      <textarea
                        value={assetFormData.description}
                        onChange={(e) => setAssetFormData({ ...assetFormData, description: e.target.value })}
                        rows="3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <FileUploader
                        onFileSelect={setAssetInvoiceFile}
                        currentFile={null}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setAssetModalOpen(false)}
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

          {/* Delete Asset Confirmation Modal */}
          <ConfirmModal
            isOpen={deleteAssetModal.isOpen}
            onClose={() => setDeleteAssetModal({ isOpen: false, id: null })}
            onConfirm={async () => {
              try {
                await costingApi.deleteOutletAsset(deleteAssetModal.id);
                setDeleteAssetModal({ isOpen: false, id: null });
                fetchAssets();
                alert('Asset deleted successfully!');
              } catch (error) {
                console.error('Failed to delete asset:', error);
                alert(`Failed to delete asset: ${error.response?.data?.message || error.message}`);
              }
            }}
            title="Delete Asset"
            message="Are you sure you want to delete this asset? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            danger={true}
          />
        </div>
      )}
    </div>
  );
};

export default Investments;




