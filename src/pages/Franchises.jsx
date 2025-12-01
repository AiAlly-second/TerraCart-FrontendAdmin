import React, { useState, useEffect } from 'react';
import { 
  FaBuilding, FaPlus, FaEdit, FaTrash, FaSpinner, FaSearch, 
  FaToggleOn, FaToggleOff, FaChevronDown, FaChevronRight, FaStore, 
  FaCheckCircle, FaTimesCircle, FaClock, FaEnvelope, FaPhone, 
  FaIdCard, FaCalendarAlt, FaEye, FaTimes, FaUsers
} from 'react-icons/fa';
import api from '../utils/api';

const Franchises = () => {
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState(null);
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [franchiseCarts, setFranchiseCarts] = useState({});
  const [loadingCarts, setLoadingCarts] = useState({});
  const [viewDetails, setViewDetails] = useState(null);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedFranchiseForCart, setSelectedFranchiseForCart] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    gstNumber: '',
  });
  const [files, setFiles] = useState({
    udyamCertificate: null,
    aadharCard: null,
    panCard: null,
  });
  const [cartFormData, setCartFormData] = useState({
    name: '',
    email: '',
    password: '',
    cartName: '',
    location: '',
    phone: '',
    address: '',
    shopActLicenseExpiry: '',
    fssaiLicenseExpiry: '',
    gstCertificateExpiry: '',
  });
  const [cartFiles, setCartFiles] = useState({
    aadharCard: null,
    panCard: null,
    gstCertificate: null,
    shopActLicense: null,
    fssaiLicense: null,
    electricityBill: null,
    rentAgreement: null,
  });

  useEffect(() => {
    fetchFranchises();
  }, []);

  const fetchFranchises = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      const allUsers = response.data || [];
      const franchiseUsers = allUsers.filter(u => u.role === 'franchise_admin');
      setFranchises(franchiseUsers);
      
      try {
        const cartStatsResponse = await api.get('/users/stats/carts');
        const cartStats = cartStatsResponse.data || {};
        if (cartStats.franchiseStats) {
          const statsMap = {};
          cartStats.franchiseStats.forEach(stat => {
            statsMap[stat.franchiseId] = stat;
          });
          setFranchiseCarts(statsMap);
        }
      } catch (err) {
        console.error('Error fetching cart statistics:', err);
      }
    } catch (error) {
      console.error('Error fetching franchises:', error);
      alert('Failed to fetch franchises');
    } finally {
      setLoading(false);
    }
  };

  const fetchCartsForFranchise = async (franchiseId) => {
    if (franchiseCarts[franchiseId]?.carts) {
      return;
    }
    
    try {
      setLoadingCarts(prev => ({ ...prev, [franchiseId]: true }));
      const response = await api.get('/users');
      const allUsers = response.data || [];
      const carts = allUsers.filter(u => 
        u.role === 'admin' && 
        u.franchiseId && 
        u.franchiseId.toString() === franchiseId.toString()
      );
      
      setFranchiseCarts(prev => ({
        ...prev,
        [franchiseId]: {
          ...prev[franchiseId],
          carts: carts,
        }
      }));
    } catch (error) {
      console.error('Error fetching carts:', error);
      alert('Failed to fetch carts');
    } finally {
      setLoadingCarts(prev => ({ ...prev, [franchiseId]: false }));
    }
  };

  const toggleFranchiseExpand = (franchiseId) => {
    const newExpanded = new Set(expandedFranchises);
    if (newExpanded.has(franchiseId)) {
      newExpanded.delete(franchiseId);
    } else {
      newExpanded.add(franchiseId);
      fetchCartsForFranchise(franchiseId);
    }
    setExpandedFranchises(newExpanded);
  };

  const handleToggleCartStatus = async (cartId, currentStatus) => {
    try {
      const response = await api.patch(`/users/${cartId}/toggle-cafe-status`);
      if (response.data?.success) {
        alert(response.data.message || 'Cart status updated successfully');
        const franchise = franchises.find(f => 
          franchiseCarts[f._id]?.carts?.some(c => c._id === cartId)
        );
        if (franchise) {
          setFranchiseCarts(prev => {
            const updated = { ...prev };
            if (updated[franchise._id]) {
              delete updated[franchise._id].carts;
            }
            return updated;
          });
          fetchCartsForFranchise(franchise._id);
        }
        fetchFranchises();
      } else {
        alert(response.data?.message || 'Failed to update cart status');
      }
    } catch (error) {
      console.error('Error toggling cart status:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update cart status';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleDeleteCart = async (cartId, cartName) => {
    if (!window.confirm(`Are you sure you want to delete cart "${cartName}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      await api.delete(`/users/${cartId}`);
      alert('Cart deleted successfully');
      const franchise = franchises.find(f => 
        franchiseCarts[f._id]?.carts?.some(c => c._id === cartId)
      );
      if (franchise) {
        fetchCartsForFranchise(franchise._id);
      }
      fetchFranchises();
    } catch (error) {
      console.error('Error deleting cart:', error);
      alert(error.response?.data?.message || 'Failed to delete cart');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFranchise) {
        const updateData = { ...formData, role: 'franchise_admin' };
        if (!updateData.password) {
          delete updateData.password;
        }
        await api.put(`/users/${editingFranchise._id}`, updateData);
        alert('Franchise updated successfully');
      } else {
        const formDataToSend = new FormData();
        formDataToSend.append('name', formData.name);
        formDataToSend.append('email', formData.email);
        formDataToSend.append('password', formData.password);
        formDataToSend.append('role', 'franchise_admin');
        if (formData.mobile) formDataToSend.append('mobile', formData.mobile);
        if (formData.gstNumber) formDataToSend.append('gstNumber', formData.gstNumber);
        
        if (files.udyamCertificate) formDataToSend.append('udyamCertificate', files.udyamCertificate);
        if (files.aadharCard) formDataToSend.append('aadharCard', files.aadharCard);
        if (files.panCard) formDataToSend.append('panCard', files.panCard);
        
        await api.post('/users', formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        alert('Franchise created successfully');
      }
      setShowModal(false);
      setEditingFranchise(null);
      setFormData({ name: '', email: '', password: '', mobile: '', gstNumber: '' });
      setFiles({ udyamCertificate: null, aadharCard: null, panCard: null });
      fetchFranchises();
    } catch (error) {
      console.error('Error saving franchise:', error);
      alert(error.response?.data?.message || 'Failed to save franchise');
    }
  };

  const handleEdit = (franchise) => {
    setEditingFranchise(franchise);
    setFormData({
      name: franchise.name,
      email: franchise.email,
      password: '',
      mobile: franchise.mobile || '',
      gstNumber: franchise.gstNumber || '',
    });
    setFiles({ udyamCertificate: null, aadharCard: null, panCard: null });
    setShowModal(true);
  };

  const handleToggleStatus = async (franchiseId) => {
    try {
      const response = await api.patch(`/users/${franchiseId}/toggle-status`);
      if (response.data?.success) {
        alert(response.data.message || 'Franchise status updated successfully');
        setFranchiseCarts(prev => {
          const updated = { ...prev };
          if (updated[franchiseId]) {
            delete updated[franchiseId].carts;
          }
          return updated;
        });
        fetchFranchises();
        if (expandedFranchises.has(franchiseId)) {
          fetchCartsForFranchise(franchiseId);
        }
      }
    } catch (error) {
      console.error('Error toggling franchise status:', error);
      alert(error.response?.data?.message || 'Failed to update franchise status');
    }
  };

  const handleDelete = async (franchiseId) => {
    const franchise = franchises.find(f => f._id === franchiseId);
    const franchiseName = franchise?.name || 'this franchise';
    
    const confirmMessage = `⚠️ WARNING: PERMANENTLY DELETE FRANCHISE\n\n` +
      `You are about to PERMANENTLY DELETE "${franchiseName}".\n\n` +
      `This will PERMANENTLY DELETE:\n` +
      `• The franchise account and login\n` +
      `• ALL carts under this franchise\n` +
      `• ALL cart login credentials\n` +
      `• ALL employees (franchise and cart level)\n` +
      `• ALL menu items and categories\n` +
      `• ALL tables and waitlist entries\n` +
      `• ALL non-paid orders and payments\n` +
      `• Paid orders will be PRESERVED for revenue tracking\n\n` +
      `⚠️ This action CANNOT be undone!\n\n` +
      `Type "DELETE" to confirm:`;
    
    const userInput = window.prompt(confirmMessage);
    
    if (userInput !== 'DELETE') {
      if (userInput !== null) {
        alert('Action cancelled. You must type "DELETE" exactly to confirm.');
      }
      return;
    }
    
    try {
      const response = await api.delete(`/users/${franchiseId}`);
      alert(
        `✅ Franchise Permanently Deleted!\n\n` +
        `Franchise "${franchiseName}" has been permanently deleted.\n\n` +
        (response.data?.preservedPaidOrders > 0 
          ? `${response.data.preservedPaidOrders} paid orders preserved for revenue tracking.\n\n`
          : ''
        ) +
        `All associated carts, employees, and data have been removed.`
      );
      fetchFranchises();
    } catch (error) {
      console.error('Error deleting franchise:', error);
      alert(error.response?.data?.message || 'Failed to delete franchise. Please try again.');
    }
  };

  const filteredFranchises = franchises.filter(franchise =>
    franchise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    franchise.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats calculations
  const totalFranchises = franchises.length;
  const activeFranchises = franchises.filter(f => f.isActive !== false).length;
  const inactiveFranchises = totalFranchises - activeFranchises;
  const totalCarts = Object.values(franchiseCarts).reduce((sum, f) => sum + (f.totalCarts || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaBuilding className="text-blue-600" />
            Franchise Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage all franchise locations and their carts</p>
        </div>
        <button
          onClick={() => {
            setEditingFranchise(null);
            setFormData({ name: '', email: '', password: '', mobile: '', gstNumber: '' });
            setFiles({ udyamCertificate: null, aadharCard: null, panCard: null });
            setShowModal(true);
          }}
          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
        >
          <FaPlus className="mr-1.5" size={12} />
          Add Franchise
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Total</p>
              <p className="text-xl font-bold text-gray-800">{totalFranchises}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FaBuilding className="text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-green-200 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium">Active</p>
              <p className="text-xl font-bold text-green-700">{activeFranchises}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FaCheckCircle className="text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 font-medium">Inactive</p>
              <p className="text-xl font-bold text-red-700">{inactiveFranchises}</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FaTimesCircle className="text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-purple-200 p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-600 font-medium">Total Carts</p>
              <p className="text-xl font-bold text-purple-700">{totalCarts}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FaStore className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Franchises List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <FaSpinner className="animate-spin text-blue-500 text-2xl" />
          </div>
        ) : filteredFranchises.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaBuilding className="mx-auto text-4xl mb-3 text-gray-300" />
            <p className="font-medium">No franchises found</p>
            <p className="text-sm mt-1">Create your first franchise to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredFranchises.map((franchise) => {
              const isActive = franchise.isActive !== false;
              const isExpanded = expandedFranchises.has(franchise._id);
              const cartStats = franchiseCarts[franchise._id] || {};
              const carts = franchiseCarts[franchise._id]?.carts || [];
              const isLoadingCarts = loadingCarts[franchise._id];
              
              return (
                <div key={franchise._id} className={`${!isActive && 'bg-gray-50'}`}>
                  {/* Franchise Row */}
                  <div className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Expand Button */}
                      <button
                        onClick={() => toggleFranchiseExpand(franchise._id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                      </button>

                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm ${
                        isActive ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gray-400'
                      }`}>
                        {franchise.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {franchise.franchiseCode && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded">
                              {franchise.franchiseCode}
                            </span>
                          )}
                          <span className="font-semibold text-gray-800 text-sm truncate">{franchise.name}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                            isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <FaEnvelope size={10} />
                            {franchise.email}
                          </span>
                          {franchise.mobile && (
                            <span className="hidden sm:flex items-center gap-1">
                              <FaPhone size={10} />
                              {franchise.mobile}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cart Stats */}
                      <div className="hidden md:flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded">
                          <FaStore size={10} />
                          <span className="font-medium">{cartStats.totalCarts || 0}</span>
                        </div>
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded">
                          <FaCheckCircle size={10} />
                          <span>{cartStats.activeCarts || 0}</span>
                        </div>
                        {(cartStats.pendingApproval || 0) > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-600 rounded">
                            <FaClock size={10} />
                            <span>{cartStats.pendingApproval}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewDetails(franchise)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                        >
                          <FaEye size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(franchise._id)}
                          className={`p-1.5 rounded transition-colors ${
                            isActive ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                          }`}
                          title={isActive ? 'Deactivate' : 'Activate'}
                        >
                          {isActive ? <FaToggleOn size={16} /> : <FaToggleOff size={16} />}
                        </button>
                        <button
                          onClick={() => handleEdit(franchise)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <FaEdit size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(franchise._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Carts Section */}
                  {isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100 px-3 py-2">
                      <div className="ml-8">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                            <FaStore size={10} />
                            Carts ({carts.length})
                          </p>
                          <button
                            onClick={() => {
                              setSelectedFranchiseForCart(franchise);
                              setCartFormData({
                                name: '',
                                email: '',
                                password: '',
                                cartName: '',
                                location: '',
                                phone: '',
                                address: '',
                                shopActLicenseExpiry: '',
                                fssaiLicenseExpiry: '',
                                gstCertificateExpiry: '',
                              });
                              setCartFiles({
                                aadharCard: null,
                                panCard: null,
                                gstCertificate: null,
                                shopActLicense: null,
                                fssaiLicense: null,
                                electricityBill: null,
                                rentAgreement: null,
                              });
                              setShowCartModal(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            <FaPlus size={10} />
                            Add Cart
                          </button>
                        </div>
                        {isLoadingCarts ? (
                          <div className="flex justify-center py-4">
                            <FaSpinner className="animate-spin text-gray-400" size={14} />
                          </div>
                        ) : carts.length === 0 ? (
                          <p className="text-xs text-gray-400 py-3 text-center bg-white rounded border border-dashed border-gray-200">
                            No carts under this franchise
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {carts.map((cart) => {
                              const cartIsActive = cart.isActive !== false && cart.isApproved === true && isActive;
                              return (
                                <div 
                                  key={cart._id}
                                  className={`bg-white border rounded-lg p-2.5 ${
                                    cartIsActive ? 'border-gray-200' : 'border-amber-200 bg-amber-50'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {cart.cartCode && (
                                          <span className="px-1 py-0.5 text-[9px] font-mono font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded">
                                            {cart.cartCode}
                                          </span>
                                        )}
                                        <span className="font-medium text-xs text-gray-800 truncate">
                                          {cart.cartName || cart.cafeName || cart.name}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-gray-500 mt-0.5 truncate">{cart.email}</p>
                                      <div className="flex items-center gap-1 mt-1">
                                        <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${
                                          cart.isApproved === false 
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : cartIsActive 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                          {cart.isApproved === false ? 'Pending' : cartIsActive ? 'Active' : 'Inactive'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                      {cart.isApproved ? (
                                        <button
                                          onClick={() => handleToggleCartStatus(cart._id, cartIsActive)}
                                          disabled={!isActive && !cartIsActive}
                                          className={`p-1 rounded ${
                                            !isActive && !cartIsActive
                                              ? 'text-gray-300 cursor-not-allowed'
                                              : cartIsActive
                                              ? 'text-green-500 hover:bg-green-50'
                                              : 'text-gray-400 hover:bg-gray-100'
                                          }`}
                                        >
                                          {cartIsActive ? <FaToggleOn size={14} /> : <FaToggleOff size={14} />}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleToggleCartStatus(cart._id, cartIsActive)}
                                          className="p-1 text-yellow-600 hover:bg-yellow-50 rounded"
                                          title="Approve"
                                        >
                                          <FaCheckCircle size={12} />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteCart(cart._id, cart.cafeName || cart.name)}
                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                      >
                                        <FaTrash size={10} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {viewDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold">{viewDetails.name}</h2>
                  {viewDetails.franchiseCode && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded text-xs font-mono">
                      {viewDetails.franchiseCode}
                    </span>
                  )}
                </div>
                <button onClick={() => setViewDetails(null)} className="p-1 hover:bg-white/20 rounded">
                  <FaTimes size={16} />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <FaEnvelope className="text-gray-400" size={14} />
                <span className="text-gray-700">{viewDetails.email}</span>
              </div>
              {viewDetails.mobile && (
                <div className="flex items-center gap-3 text-sm">
                  <FaPhone className="text-gray-400" size={14} />
                  <span className="text-gray-700">{viewDetails.mobile}</span>
                </div>
              )}
              {viewDetails.gstNumber && (
                <div className="flex items-center gap-3 text-sm">
                  <FaIdCard className="text-gray-400" size={14} />
                  <span className="text-gray-700">{viewDetails.gstNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <FaCalendarAlt className="text-gray-400" size={14} />
                <span className="text-gray-700">Created: {new Date(viewDetails.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FaUsers className="text-gray-400" size={14} />
                <span className="text-gray-700">
                  {franchiseCarts[viewDetails._id]?.totalCarts || 0} Carts
                </span>
              </div>
              <div className="pt-3 border-t">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  viewDetails.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {viewDetails.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">
                {editingFranchise ? 'Edit Franchise' : 'Create New Franchise'}
              </h2>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setEditingFranchise(null);
                }}
                className="p-1 hover:bg-white/20 rounded"
              >
                <FaTimes size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Franchise Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter franchise name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 1234567890"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">GST Number</label>
                  <input
                    type="text"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="29ABCDE1234F1Z5"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password {editingFranchise && <span className="font-normal text-gray-400">(leave blank to keep)</span>}
                    {!editingFranchise && ' *'}
                  </label>
                  <input
                    type="password"
                    required={!editingFranchise}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              
              {!editingFranchise && (
                <div className="border-t pt-4">
                  <h3 className="text-xs font-semibold text-gray-700 mb-3">Documents (Optional)</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Udyam Certificate</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setFiles({ ...files, udyamCertificate: e.target.files[0] })}
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Aadhar Card</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setFiles({ ...files, aadharCard: e.target.files[0] })}
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">PAN Card</label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setFiles({ ...files, panCard: e.target.files[0] })}
                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>
            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingFranchise(null);
                }}
                className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingFranchise ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Cart Modal */}
      {showCartModal && selectedFranchiseForCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Add New Cart</h2>
                <p className="text-sm text-blue-100 mt-1">
                  Under: {selectedFranchiseForCart.name} {selectedFranchiseForCart.franchiseCode ? `(${selectedFranchiseForCart.franchiseCode})` : ''}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowCartModal(false);
                  setSelectedFranchiseForCart(null);
                }}
                className="p-1 hover:bg-white/20 rounded"
              >
                <FaTimes size={16} />
              </button>
            </div>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const formDataToSend = new FormData();
                  formDataToSend.append('name', cartFormData.name);
                  formDataToSend.append('email', cartFormData.email);
                  formDataToSend.append('password', cartFormData.password);
                  formDataToSend.append('cartName', cartFormData.cartName);
                  formDataToSend.append('location', cartFormData.location);
                  formDataToSend.append('franchiseId', selectedFranchiseForCart._id);
                  if (cartFormData.phone) formDataToSend.append('phone', cartFormData.phone);
                  if (cartFormData.address) formDataToSend.append('address', cartFormData.address);
                  if (cartFormData.shopActLicenseExpiry) formDataToSend.append('shopActLicenseExpiry', cartFormData.shopActLicenseExpiry);
                  if (cartFormData.fssaiLicenseExpiry) formDataToSend.append('fssaiLicenseExpiry', cartFormData.fssaiLicenseExpiry);
                  if (cartFormData.gstCertificateExpiry) formDataToSend.append('gstCertificateExpiry', cartFormData.gstCertificateExpiry);
                  
                  if (cartFiles.aadharCard) formDataToSend.append('aadharCard', cartFiles.aadharCard);
                  if (cartFiles.panCard) formDataToSend.append('panCard', cartFiles.panCard);
                  if (cartFiles.gstCertificate) formDataToSend.append('gstCertificate', cartFiles.gstCertificate);
                  if (cartFiles.shopActLicense) formDataToSend.append('shopActLicense', cartFiles.shopActLicense);
                  if (cartFiles.fssaiLicense) formDataToSend.append('fssaiLicense', cartFiles.fssaiLicense);
                  if (cartFiles.electricityBill) formDataToSend.append('electricityBill', cartFiles.electricityBill);
                  if (cartFiles.rentAgreement) formDataToSend.append('rentAgreement', cartFiles.rentAgreement);

                  await api.post('/users/register-cafe-admin', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  
                  alert('Cart admin created successfully');
                  setShowCartModal(false);
                  setSelectedFranchiseForCart(null);
                  setCartFormData({
                    name: '',
                    email: '',
                    password: '',
                    cartName: '',
                    location: '',
                    phone: '',
                    address: '',
                    shopActLicenseExpiry: '',
                    fssaiLicenseExpiry: '',
                    gstCertificateExpiry: '',
                  });
                  setCartFiles({
                    aadharCard: null,
                    panCard: null,
                    gstCertificate: null,
                    shopActLicense: null,
                    fssaiLicense: null,
                    electricityBill: null,
                    rentAgreement: null,
                  });
                  fetchFranchises();
                  if (expandedFranchises.has(selectedFranchiseForCart._id)) {
                    fetchCartsForFranchise(selectedFranchiseForCart._id);
                  }
                } catch (error) {
                  console.error('Error creating cart:', error);
                  alert(error.response?.data?.message || 'Failed to create cart');
                }
              }}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {/* Basic Information */}
              <div className="border-b pb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Manager Name *</label>
                    <input
                      type="text"
                      required
                      value={cartFormData.name}
                      onChange={(e) => setCartFormData({ ...cartFormData, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={cartFormData.email}
                      onChange={(e) => setCartFormData({ ...cartFormData, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="manager@cart.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={cartFormData.password}
                      onChange={(e) => setCartFormData({ ...cartFormData, password: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cart Name *</label>
                    <input
                      type="text"
                      required
                      value={cartFormData.cartName}
                      onChange={(e) => setCartFormData({ ...cartFormData, cartName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Terra Cart Downtown"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Location *</label>
                    <input
                      type="text"
                      required
                      value={cartFormData.location}
                      onChange={(e) => setCartFormData({ ...cartFormData, location: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Downtown, City"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={cartFormData.phone}
                      onChange={(e) => setCartFormData({ ...cartFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+91 1234567890"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                    <textarea
                      value={cartFormData.address}
                      onChange={(e) => setCartFormData({ ...cartFormData, address: e.target.value })}
                      rows="3"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Full address of the cart"
                    />
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              <div className="border-b pb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Owner Documents (Optional)</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Documents can be uploaded later. You can create the cart now and add documents anytime.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Aadhar Card</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCartFiles({ ...cartFiles, aadharCard: e.target.files[0] || null })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {cartFiles.aadharCard && (
                      <p className="mt-1 text-xs text-gray-500">Selected: {cartFiles.aadharCard.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">PAN Card</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCartFiles({ ...cartFiles, panCard: e.target.files[0] || null })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {cartFiles.panCard && (
                      <p className="mt-1 text-xs text-gray-500">Selected: {cartFiles.panCard.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">GST Certificate</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCartFiles({ ...cartFiles, gstCertificate: e.target.files[0] || null })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {cartFiles.gstCertificate && (
                      <p className="mt-1 text-xs text-gray-500">Selected: {cartFiles.gstCertificate.name}</p>
                    )}
                    <input
                      type="date"
                      value={cartFormData.gstCertificateExpiry}
                      onChange={(e) => setCartFormData({ ...cartFormData, gstCertificateExpiry: e.target.value })}
                      className="mt-2 w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Expiry Date (Optional)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Act License</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCartFiles({ ...cartFiles, shopActLicense: e.target.files[0] || null })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {cartFiles.shopActLicense && (
                      <p className="mt-1 text-xs text-gray-500">Selected: {cartFiles.shopActLicense.name}</p>
                    )}
                    <input
                      type="date"
                      value={cartFormData.shopActLicenseExpiry}
                      onChange={(e) => setCartFormData({ ...cartFormData, shopActLicenseExpiry: e.target.value })}
                      className="mt-2 w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Expiry Date (Optional)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">FSSAI License</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCartFiles({ ...cartFiles, fssaiLicense: e.target.files[0] || null })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {cartFiles.fssaiLicense && (
                      <p className="mt-1 text-xs text-gray-500">Selected: {cartFiles.fssaiLicense.name}</p>
                    )}
                    <input
                      type="date"
                      value={cartFormData.fssaiLicenseExpiry}
                      onChange={(e) => setCartFormData({ ...cartFormData, fssaiLicenseExpiry: e.target.value })}
                      className="mt-2 w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Expiry Date (Optional)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Electricity Bill</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCartFiles({ ...cartFiles, electricityBill: e.target.files[0] || null })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {cartFiles.electricityBill && (
                      <p className="mt-1 text-xs text-gray-500">Selected: {cartFiles.electricityBill.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Rent Agreement</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCartFiles({ ...cartFiles, rentAgreement: e.target.files[0] || null })}
                      className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {cartFiles.rentAgreement && (
                      <p className="mt-1 text-xs text-gray-500">Selected: {cartFiles.rentAgreement.name}</p>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  All documents are optional. Accepted formats: PDF, JPG, PNG, WEBP (Max 10MB per file)
                </p>
              </div>
            </form>
            <div className="p-4 border-t bg-gray-50 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCartModal(false);
                  setSelectedFranchiseForCart(null);
                }}
                className="flex-1 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const form = e.target.closest('.bg-white').querySelector('form');
                  if (form) {
                    form.requestSubmit();
                  }
                }}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Franchises;
