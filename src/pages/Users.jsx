import React, { useState, useEffect } from 'react';
import { FaUsers, FaPlus, FaEdit, FaTrash, FaSpinner, FaSearch, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { confirm } from '../utils/confirm';

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [togglingStatus, setTogglingStatus] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    franchiseId: '',
    cafeId: '',
    cartName: '',
    location: '',
    phone: '',
    mobile: '',
    gstNumber: '',
    address: ''
  });

  // Get allowed roles based on current user's hierarchy
  const getAllowedRoles = () => {
    if (!currentUser) return [];
    
    const userRole = currentUser.role;
    
    if (userRole === 'super_admin') {
      // Super Admin can create: super_admin, franchise_admin, cart_admin only
      return [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'franchise_admin', label: 'Franchise Admin' },
        { value: 'cart_admin', label: 'Cart Admin' }
      ];
    } else if (userRole === 'franchise_admin') {
      // Franchise Admin can create: cart_admin, manager, captain, waiter, cook
      return [
        { value: 'cart_admin', label: 'Cart Admin' },
        { value: 'manager', label: 'Manager' },
        { value: 'captain', label: 'Captain' },
        { value: 'waiter', label: 'Waiter' },
        { value: 'cook', label: 'Cook' }
      ];
    } else if (userRole === 'admin' || userRole === 'cart_admin') {
      // Cart Admin can create: manager, captain, waiter, cook
      return [
        { value: 'manager', label: 'Manager' },
        { value: 'captain', label: 'Captain' },
        { value: 'waiter', label: 'Waiter' },
        { value: 'cook', label: 'Cook' }
      ];
    }
    
    return [];
  };

  useEffect(() => {
    fetchUsers();
    fetchFranchises();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchFranchises = async () => {
    try {
      const response = await api.get('/users');
      const franchiseList = (response.data || []).filter(user => user.role === 'franchise_admin');
      setFranchises(franchiseList);
    } catch (error) {
      console.error('Error fetching franchises:', error);
    }
  };

  const fetchCafes = async (franchiseId, forceRefresh = false) => {
    if (!franchiseId) {
      setCafes([]);
      return;
    }
    try {
      // Always fetch fresh data to ensure we have the latest carts
      const response = await api.get('/users');
      const cafeList = (response.data || []).filter(user => {
        if (user.role !== 'admin' && user.role !== 'cart_admin') return false;
        if (!user.franchiseId) return false;
        
        // Handle both populated and non-populated franchiseId
        const userFranchiseId = user.franchiseId._id?.toString() || user.franchiseId.toString();
        return userFranchiseId === franchiseId.toString();
      });
      setCafes(cafeList);
    } catch (error) {
      console.error('Error fetching cafes:', error);
      setCafes([]);
    }
  };

  // Validation functions
  const validateEmail = (email) => {
    if (!email || !email.trim()) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || !phone.trim()) return 'Phone number is required';
    // Remove spaces, dashes, and country code for validation
    const cleaned = phone.replace(/[\s\-+]/g, '').replace(/^91/, '');
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(cleaned)) {
      return 'Please enter a valid 10-digit Indian mobile number';
    }
    return '';
  };

  const validateName = (name) => {
    if (!name || !name.trim()) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    if (name.trim().length > 50) return 'Name must be less than 50 characters';
    const nameRegex = /^[a-zA-Z\s.'-]+$/;
    if (!nameRegex.test(name.trim())) {
      return 'Name can only contain letters, spaces, and common characters';
    }
    return '';
  };

  const validatePassword = (password, isEditing = false) => {
    if (isEditing && !password) return ''; // Password optional when editing
    if (!password || !password.trim()) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return '';
  };

  const validateGSTNumber = (gst) => {
    if (!gst || !gst.trim()) return ''; // GST is optional
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gst.trim().toUpperCase())) {
      return 'Please enter a valid GST number (15 characters, e.g., 27ABCDE1234F1Z5)';
    }
    return '';
  };

  const handleToggleStatus = async (user) => {
    // Determine which endpoint to use based on role
    let endpoint = '';
    let title = '';
    let message = '';
    
    const isCurrentlyActive = user.isActive !== false;
    const action = isCurrentlyActive ? 'DEACTIVATE' : 'ACTIVATE';
    const userName = user.name || user.cartName || 'this user';
    
    if (user.role === 'franchise_admin') {
      endpoint = `/users/${user._id}/toggle-status`;
      title = `${action} Franchise`;
      message = `Are you sure you want to ${action} franchise "${userName}"?\n\n${
        isCurrentlyActive 
          ? '⚠️ WARNING: All carts under this franchise will also be deactivated.\n\nThis will prevent all carts from accepting new orders.'
          : '✅ All carts under this franchise will also be activated.\n\nCarts will be able to accept new orders again.'
      }`;
    } else if (user.role === 'admin' || user.role === 'cart_admin') {
      endpoint = `/users/${user._id}/toggle-cafe-status`;
      title = `${action} Cart`;
      message = `Are you sure you want to ${action} cart "${userName}"?\n\n${
        isCurrentlyActive 
          ? '⚠️ This will prevent the cart from accepting new orders.'
          : '✅ The cart will be able to accept new orders again.'
      }`;
    } else {
      // For other roles like employees, don't allow toggle
      alert('Status toggle is only available for Franchise Admins and Cart Admins');
      return;
    }

    try {
      const { confirm } = await import('../utils/confirm');
      const confirmed = await confirm(
        message,
        {
          title: title,
          warningMessage: isCurrentlyActive ? 'WARNING: DEACTIVATION' : 'Activation',
          danger: isCurrentlyActive,
          confirmText: action,
          cancelText: 'Cancel'
        }
      );

      if (!confirmed) return;

      setTogglingStatus(user._id);
      const response = await api.patch(endpoint);
      
      if (response.data.success) {
        alert(response.data.message || 'Status updated successfully');
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      if (error.response?.status !== 400) { // Don't show alert if user cancelled
        alert(error.response?.data?.message || 'Failed to toggle status');
      }
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    // Trim all form data
    const trimmedData = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password.trim(),
      role: formData.role,
      franchiseId: formData.franchiseId,
      cafeId: formData.cafeId,
      cartName: formData.cartName.trim(),
      location: formData.location.trim(),
      phone: formData.phone.trim(),
      mobile: formData.mobile.trim(),
      gstNumber: formData.gstNumber.trim().toUpperCase(),
      address: formData.address.trim()
    };

    const errors = {};

    // Validate name (required for all)
    const nameError = validateName(trimmedData.name);
    if (nameError) errors.name = nameError;

    // Validate email (required for all)
    const emailError = validateEmail(trimmedData.email);
    if (emailError) errors.email = emailError;

    // Validate password (required for new users, optional for editing)
    const passwordError = validatePassword(trimmedData.password, !!editingUser);
    if (passwordError) errors.password = passwordError;

    // Role-specific validation
    if (!editingUser) {
      // Role is required when creating
      if (!trimmedData.role) {
        errors.role = 'Please select a role';
      }

      // Cart Admin validation
      if (trimmedData.role === 'admin' || trimmedData.role === 'cart_admin') {
        if (!trimmedData.franchiseId) {
          errors.franchiseId = 'Please select a franchise';
        }
        if (!trimmedData.cartName) {
          errors.cartName = 'Cart name is required';
        }
        if (!trimmedData.location) {
          errors.location = 'Location is required';
        }
        // Phone validation (optional but if provided, must be valid)
        if (trimmedData.phone) {
          const phoneError = validatePhoneNumber(trimmedData.phone);
          if (phoneError) errors.phone = phoneError;
        }
      }

      // Employee roles (cook, captain, waiter, manager) validation
      const employeeRoles = ['cook', 'captain', 'waiter', 'manager'];
      if (employeeRoles.includes(trimmedData.role)) {
        if (!trimmedData.franchiseId || trimmedData.franchiseId === '') {
          errors.franchiseId = 'Please select a franchise';
        }
        if (!trimmedData.cafeId || trimmedData.cafeId === '') {
          errors.cafeId = 'Please select a cart';
        }
      }

      // Franchise Admin validation
      if (trimmedData.role === 'franchise_admin') {
        // Mobile is optional but if provided, must be valid
        if (trimmedData.mobile) {
          const mobileError = validatePhoneNumber(trimmedData.mobile);
          if (mobileError) errors.mobile = mobileError;
        }
        // GST is optional but if provided, must be valid
        if (trimmedData.gstNumber) {
          const gstError = validateGSTNumber(trimmedData.gstNumber);
          if (gstError) errors.gstNumber = gstError;
        }
      }
    } else {
      // For editing, validate phone if provided
      if (trimmedData.phone) {
        const phoneError = validatePhoneNumber(trimmedData.phone);
        if (phoneError) errors.phone = phoneError;
      }
      if (trimmedData.mobile) {
        const mobileError = validatePhoneNumber(trimmedData.mobile);
        if (mobileError) errors.mobile = mobileError;
      }
      if (trimmedData.gstNumber) {
        const gstError = validateGSTNumber(trimmedData.gstNumber);
        if (gstError) errors.gstNumber = gstError;
      }
    }

    // If there are errors, display them and stop submission
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsSubmitting(false);
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      const errorElement = document.querySelector(`[name="${firstErrorField}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errorElement.focus();
      }
      return;
    }

    try {
      if (editingUser) {
        // Update user
        const updateData = { 
          name: trimmedData.name,
          email: trimmedData.email
        };
        
        if (trimmedData.password) {
          updateData.password = trimmedData.password;
        }

        // Add optional fields only if they have values
        if (trimmedData.phone) {
          updateData.phone = trimmedData.phone;
        }
        if (trimmedData.mobile) {
          updateData.mobile = trimmedData.mobile;
        }
        if (trimmedData.gstNumber) {
          updateData.gstNumber = trimmedData.gstNumber;
        }

        // Add franchise and cart for employee roles
        const employeeRoles = ['cook', 'captain', 'waiter', 'manager'];
        if (employeeRoles.includes(editingUser.role)) {
          if (trimmedData.franchiseId) {
            updateData.franchiseId = trimmedData.franchiseId;
          }
          if (trimmedData.cafeId) {
            updateData.cafeId = trimmedData.cafeId;
          }
        }

        await api.put(`/users/${editingUser._id}`, updateData);
        alert('User updated successfully');
        setShowModal(false);
        setEditingUser(null);
        resetForm();
        fetchUsers();
        fetchFranchises();
      } else {
        // Create user
        if (trimmedData.role === 'admin' || trimmedData.role === 'cart_admin') {
          // For cart admin, use registerCafeAdmin endpoint
          const cartAdminData = {
            name: trimmedData.name,
            email: trimmedData.email,
            password: trimmedData.password,
            cartName: trimmedData.cartName,
            location: trimmedData.location,
            franchiseId: trimmedData.franchiseId
          };
          
          // Add optional fields only if they have values
          if (trimmedData.phone) {
            cartAdminData.phone = trimmedData.phone;
          }
          if (trimmedData.address) {
            cartAdminData.address = trimmedData.address;
          }

          try {
            const response = await api.post('/users/register-cafe-admin', cartAdminData);
            alert('Cart admin created successfully');
            setShowModal(false);
            setEditingUser(null);
            resetForm();
            await fetchUsers();
            await fetchFranchises();
            // Refresh cafes list if a franchise was selected (for employee role forms)
            if (trimmedData.franchiseId) {
              await fetchCafes(trimmedData.franchiseId);
            }
          } catch (error) {
            console.error('[Users] Error creating cart admin:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to create cart admin';
            
            // Map backend errors to form fields
            const backendErrors = {};
            if (errorMessage.toLowerCase().includes('email')) {
              backendErrors.email = errorMessage;
            } else if (errorMessage.toLowerCase().includes('franchise')) {
              backendErrors.franchiseId = errorMessage;
            } else {
              backendErrors.general = errorMessage;
            }
            
            if (Object.keys(backendErrors).length > 0) {
              setFormErrors(backendErrors);
            } else {
              alert(`Error: ${errorMessage}`);
            }
            setIsSubmitting(false);
            return;
          }
        } else if (trimmedData.role === 'franchise_admin') {
          // For franchise admin, use createUser endpoint with FormData for documents
          const franchiseData = {
            name: trimmedData.name,
            email: trimmedData.email,
            password: trimmedData.password,
            role: trimmedData.role
          };

          if (trimmedData.mobile) {
            franchiseData.mobile = trimmedData.mobile;
          }
          if (trimmedData.gstNumber) {
            franchiseData.gstNumber = trimmedData.gstNumber;
          }

          try {
            await api.post('/users', franchiseData);
            alert('Franchise admin created successfully');
            setShowModal(false);
            setEditingUser(null);
            resetForm();
            fetchUsers();
            fetchFranchises();
          } catch (error) {
            console.error('[Users] Error creating franchise admin:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to create franchise admin';
            
            // Map backend errors to form fields
            const backendErrors = {};
            if (errorMessage.toLowerCase().includes('email')) {
              backendErrors.email = errorMessage;
            } else {
              backendErrors.general = errorMessage;
            }
            
            if (Object.keys(backendErrors).length > 0) {
              setFormErrors(backendErrors);
            } else {
              alert(`Error: ${errorMessage}`);
            }
            setIsSubmitting(false);
            return;
          }
        } else {
          // For other roles (super_admin, manager, captain, waiter, cook)
          const userData = {
            name: trimmedData.name,
            email: trimmedData.email,
            password: trimmedData.password,
            role: trimmedData.role
          };

          // Add franchise and cart for employee roles
          const employeeRoles = ['cook', 'captain', 'waiter', 'manager'];
          if (employeeRoles.includes(trimmedData.role)) {
            if (trimmedData.franchiseId) {
              userData.franchiseId = trimmedData.franchiseId;
            }
            if (trimmedData.cafeId) {
              userData.cafeId = trimmedData.cafeId;
            }
          }
          
          try {
            await api.post('/users', userData);
            alert('User created successfully');
            setShowModal(false);
            setEditingUser(null);
            resetForm();
            fetchUsers();
            fetchFranchises();
          } catch (error) {
            console.error('[Users] Error creating user:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to create user';
            
            // Map backend errors to form fields
            const backendErrors = {};
            if (errorMessage.toLowerCase().includes('email')) {
              backendErrors.email = errorMessage;
            } else if (errorMessage.toLowerCase().includes('franchise')) {
              backendErrors.franchiseId = errorMessage;
            } else if (errorMessage.toLowerCase().includes('cart') || errorMessage.toLowerCase().includes('cafe')) {
              backendErrors.cafeId = errorMessage;
            } else {
              backendErrors.general = errorMessage;
            }
            
            if (Object.keys(backendErrors).length > 0) {
              setFormErrors(backendErrors);
            } else {
              alert(`Error: ${errorMessage}`);
            }
            setIsSubmitting(false);
            return;
          }
        }
      }
      setIsSubmitting(false);
    } catch (error) {
      console.error('Error saving user:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save user';
      setFormErrors({ general: errorMessage });
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: '',
      franchiseId: '',
      cafeId: '',
      cartName: '',
      location: '',
      phone: '',
      mobile: '',
      gstNumber: '',
      address: ''
    });
    setFormErrors({});
    setCafes([]);
  };

  const handleEdit = async (user) => {
    setEditingUser(user);
    const franchiseId = user.franchiseId?._id?.toString() || user.franchiseId?.toString() || user.franchiseId || '';
    const cafeId = user.cafeId?._id?.toString() || user.cafeId?.toString() || user.cafeId || '';
    
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || '',
      franchiseId: franchiseId,
      cafeId: cafeId,
      cartName: user.cartName || '',
      location: user.location || '',
      phone: user.phone || '',
      mobile: user.mobile || '',
      gstNumber: user.gstNumber || '',
      address: user.address || ''
    });
    setFormErrors({});
    
    // Fetch cafes if franchise is set
    if (franchiseId) {
      await fetchCafes(franchiseId);
    } else {
      setCafes([]);
    }
    
    setShowModal(true);
  };

  const handleDelete = async (e, userId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Find the user to check their role
    const userToDelete = users.find(u => u._id === userId);
    
    // Prevent deleting super admin users
    if (userToDelete && userToDelete.role === 'super_admin') {
      alert('Super admin users cannot be deleted');
      return;
    }
    
    const userName = userToDelete?.name || 'this user';
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE "${userName}"?\n\nThis action cannot be undone.`,
      {
        title: 'Delete User',
        warningMessage: 'WARNING: PERMANENTLY DELETE',
        danger: true,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/users/${userId}`);
      alert('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleColors = {
    super_admin: 'bg-purple-100 text-purple-800',
    franchise_admin: 'bg-blue-100 text-blue-800',
    admin: 'bg-green-100 text-green-800',
    cart_admin: 'bg-green-100 text-green-800',
    manager: 'bg-indigo-100 text-indigo-800',
    captain: 'bg-teal-100 text-teal-800',
    waiter: 'bg-yellow-100 text-yellow-800',
    cook: 'bg-orange-100 text-orange-800',
    employee: 'bg-yellow-100 text-yellow-800',
    customer: 'bg-gray-100 text-gray-800'
  };

  const getRoleLabel = (role) => {
    const labels = {
      super_admin: 'Super Admin',
      franchise_admin: 'Franchise Admin',
      admin: 'Cart Admin',
      cart_admin: 'Cart Admin',
      manager: 'Manager',
      captain: 'Captain',
      waiter: 'Waiter',
      cook: 'Cook',
      employee: 'Employee',
      customer: 'Customer'
    };
    return labels[role] || role;
  };

  const getStatusBadge = (user) => {
    // For cart admins, use effectivelyActive which considers franchise status
    // For other users, use isActive directly
    let isEffectivelyActive;
    let statusLabel;
    let extraInfo = '';
    
    if ((user.role === 'admin' || user.role === 'cart_admin') && user.effectivelyActive !== undefined) {
      isEffectivelyActive = user.effectivelyActive;
      // Check if inactive due to franchise being inactive
      if (!isEffectivelyActive && user.isActive !== false && user.franchiseActive === false) {
        extraInfo = ' (Franchise Inactive)';
      }
    } else {
      isEffectivelyActive = user.isActive !== false;
    }
    
    statusLabel = isEffectivelyActive ? 'Active' : 'Inactive';
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
        isEffectivelyActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`} title={extraInfo ? `Cart's own status is Active, but${extraInfo}` : ''}>
        {statusLabel}{extraInfo && <span className="text-red-600">{extraInfo}</span>}
      </span>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Users</h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 sm:mt-2">Manage all system users</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
        >
          <FaPlus className="mr-1.5 sm:mr-2" />
          <span className="whitespace-nowrap">Add New User</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Users</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-800">{users.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Active</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {users.filter(u => u.effectivelyActive !== undefined ? u.effectivelyActive : u.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Inactive</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">
            {users.filter(u => u.effectivelyActive !== undefined ? !u.effectivelyActive : u.isActive === false).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Franchises</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {users.filter(u => u.role === 'franchise_admin').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6">
        <div className="mb-3 sm:mb-4">
          <div className="relative">
            <FaSearch className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm sm:text-base" />
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <FaSpinner className="animate-spin text-gray-400 text-3xl" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaUsers className="mx-auto text-4xl mb-4 text-gray-300" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <div className="inline-block min-w-full align-middle px-3 sm:px-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Name</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Email</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Role</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Status</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm hidden md:table-cell">Created</th>
                    <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <div>
                          <p className="font-medium text-xs sm:text-sm">{user.name}</p>
                          {user.cartName && (
                            <p className="text-[10px] sm:text-xs text-gray-500">Cart: {user.cartName}</p>
                          )}
                          {user.cafeName && !user.cartName && (
                            <p className="text-[10px] sm:text-xs text-gray-500">Cart: {user.cafeName}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-600 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">{user.email}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${roleColors[user.role] || roleColors.customer}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">
                      {getStatusBadge(user)}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-500 text-xs sm:text-sm hidden md:table-cell">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">
                      <div className="flex justify-end space-x-1 sm:space-x-2">
                        {/* Toggle Status Button - Only for franchise_admin and admin/cart_admin roles */}
                        {(user.role === 'franchise_admin' || user.role === 'admin' || user.role === 'cart_admin') && (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            disabled={togglingStatus === user._id || (user.role === 'admin' && user.franchiseActive === false)}
                            className={`p-2 rounded transition-colors ${
                              (user.effectivelyActive !== undefined ? !user.effectivelyActive : user.isActive === false)
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            } ${togglingStatus === user._id ? 'opacity-50 cursor-not-allowed' : ''} ${user.role === 'admin' && user.franchiseActive === false ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={
                              user.role === 'admin' && user.franchiseActive === false 
                                ? 'Cannot toggle - Franchise is inactive. Activate the franchise first.'
                                : (user.effectivelyActive !== undefined ? !user.effectivelyActive : user.isActive === false) 
                                  ? 'Click to Activate' 
                                  : 'Click to Deactivate'
                            }
                          >
                            {togglingStatus === user._id ? (
                              <FaSpinner className="animate-spin text-sm sm:text-base" />
                            ) : (user.effectivelyActive !== undefined ? !user.effectivelyActive : user.isActive === false) ? (
                              <FaToggleOff className="text-base sm:text-xl" />
                            ) : (
                              <FaToggleOn className="text-base sm:text-xl" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-1 sm:p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <FaEdit className="text-sm sm:text-base" />
                        </button>
                        {user.role !== 'super_admin' && (
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, user._id)}
                            className="p-1 sm:p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <FaTrash className="text-sm sm:text-base" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">
                {editingUser ? 'Edit User' : 'Create New User'}
              </h2>
              {!editingUser && formData.role && (
                <p className="text-sm text-gray-600 mt-1">
                  Creating: <span className="font-semibold text-blue-600">{getRoleLabel(formData.role)}</span>
                </p>
              )}
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleSubmit} className="space-y-4" id="user-form">
              {/* General Error Display */}
              {formErrors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {formErrors.general}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    formErrors.name 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Enter full name"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    formErrors.email 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="example@email.com"
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {editingUser ? '(leave blank to keep current)' : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    if (formErrors.password) setFormErrors({ ...formErrors, password: '' });
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    formErrors.password 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder={editingUser ? 'Enter new password (optional)' : 'Minimum 6 characters'}
                />
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                )}
                {!editingUser && !formErrors.password && (
                  <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters</p>
                )}
              </div>

              {/* Role (only when creating) */}
              {!editingUser && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setFormData({ 
                        ...formData, 
                        role: newRole, 
                        franchiseId: '', 
                        cafeId: '',
                        cartName: '', 
                        location: '', 
                        phone: '', 
                        mobile: '',
                        gstNumber: '',
                        address: '' 
                      });
                      // Clear role-specific errors
                      setFormErrors({ 
                        ...formErrors, 
                        role: '',
                        franchiseId: '',
                        cafeId: '',
                        cartName: '',
                        location: '',
                        phone: '',
                        mobile: '',
                        gstNumber: ''
                      });
                      // Clear cafes when role changes
                      setCafes([]);
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      formErrors.role 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">Select a role</option>
                    {getAllowedRoles().map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  {formErrors.role && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
                  )}
                  {!formData.role && !formErrors.role && (
                    <p className="mt-1 text-xs text-gray-500">
                      Select a role to see additional required fields
                    </p>
                  )}
                </div>
              )}

              {/* Franchise Admin specific fields */}
              {!editingUser && formData.role === 'franchise_admin' && (
                <>
                  <div className="pt-2 border-t border-gray-200 mt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Franchise Admin Details</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={(e) => {
                        setFormData({ ...formData, mobile: e.target.value });
                        if (formErrors.mobile) setFormErrors({ ...formErrors, mobile: '' });
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.mobile 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., 9876543210 or +91 9876543210"
                    />
                    {formErrors.mobile && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.mobile}</p>
                    )}
                    {!formErrors.mobile && (
                      <p className="mt-1 text-xs text-gray-500">Optional: 10-digit Indian mobile number</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      GST Number
                    </label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() });
                        if (formErrors.gstNumber) setFormErrors({ ...formErrors, gstNumber: '' });
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.gstNumber 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., 27ABCDE1234F1Z5"
                      maxLength={15}
                    />
                    {formErrors.gstNumber && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.gstNumber}</p>
                    )}
                    {!formErrors.gstNumber && (
                      <p className="mt-1 text-xs text-gray-500">Optional: 15-character GST number</p>
                    )}
                  </div>
                </>
              )}

              {/* Cart Admin specific fields */}
              {!editingUser && (formData.role === 'admin' || formData.role === 'cart_admin') && (
                <>
                  <div className="pt-2 border-t border-gray-200 mt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Cart Admin Details</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Franchise <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="franchiseId"
                      value={formData.franchiseId}
                      onChange={(e) => {
                        setFormData({ ...formData, franchiseId: e.target.value });
                        if (formErrors.franchiseId) setFormErrors({ ...formErrors, franchiseId: '' });
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.franchiseId 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">Select a franchise</option>
                      {franchises.map((franchise) => (
                        <option key={franchise._id} value={franchise._id}>
                          {franchise.name} {franchise.franchiseCode ? `(${franchise.franchiseCode})` : ''}
                        </option>
                      ))}
                    </select>
                    {formErrors.franchiseId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.franchiseId}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Cart Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="cartName"
                      value={formData.cartName}
                      onChange={(e) => {
                        setFormData({ ...formData, cartName: e.target.value });
                        if (formErrors.cartName) setFormErrors({ ...formErrors, cartName: '' });
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.cartName 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., Downtown Cart"
                    />
                    {formErrors.cartName && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.cartName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={(e) => {
                        setFormData({ ...formData, location: e.target.value });
                        if (formErrors.location) setFormErrors({ ...formErrors, location: '' });
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.location 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., Mumbai, Maharashtra"
                    />
                    {formErrors.location && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.location}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.phone 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., +91 9876543210"
                    />
                    {formErrors.phone && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                    )}
                    {!formErrors.phone && (
                      <p className="mt-1 text-xs text-gray-500">Optional: 10-digit Indian mobile number</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={(e) => {
                        setFormData({ ...formData, address: e.target.value });
                      }}
                      placeholder="Full address of the cart"
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Employee roles (cook, captain, waiter, manager) specific fields */}
              {!editingUser && (formData.role === 'cook' || formData.role === 'captain' || formData.role === 'waiter' || formData.role === 'manager') && (
                <>
                  <div className="pt-2 border-t border-gray-200 mt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Employee Details</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Franchise <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="franchiseId"
                      value={formData.franchiseId}
                      onChange={async (e) => {
                        const selectedFranchiseId = e.target.value;
                        setFormData({ ...formData, franchiseId: selectedFranchiseId, cafeId: '' });
                        if (formErrors.franchiseId) setFormErrors({ ...formErrors, franchiseId: '', cafeId: '' });
                        // Fetch cafes for selected franchise with fresh data
                        await fetchCafes(selectedFranchiseId, true);
                      }}
                      onFocus={async (e) => {
                        // Refresh cafes list when dropdown is focused/opened
                        if (formData.franchiseId) {
                          await fetchCafes(formData.franchiseId, true);
                        }
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.franchiseId 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">Select a franchise</option>
                      {franchises.map((franchise) => (
                        <option key={franchise._id} value={franchise._id}>
                          {franchise.name} {franchise.franchiseCode ? `(${franchise.franchiseCode})` : ''}
                        </option>
                      ))}
                    </select>
                    {formErrors.franchiseId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.franchiseId}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Cart <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="cafeId"
                      value={formData.cafeId}
                      onChange={(e) => {
                        setFormData({ ...formData, cafeId: e.target.value });
                        if (formErrors.cafeId) setFormErrors({ ...formErrors, cafeId: '' });
                      }}
                      onFocus={async (e) => {
                        // Refresh cafes list when cart dropdown is focused/opened
                        if (formData.franchiseId) {
                          await fetchCafes(formData.franchiseId, true);
                        }
                      }}
                      disabled={!formData.franchiseId}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.cafeId 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500'
                      } ${!formData.franchiseId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    >
                      <option value="">
                        {!formData.franchiseId ? 'Select a franchise first' : 'Select a cart'}
                      </option>
                      {cafes.map((cafe) => {
                        const cafeIdValue = cafe._id?.toString() || cafe._id || '';
                        return (
                          <option key={cafeIdValue} value={cafeIdValue}>
                            {cafe.cartName || cafe.name} {cafe.cartCode ? `(${cafe.cartCode})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {formErrors.cafeId && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.cafeId}</p>
                    )}
                    {formData.franchiseId && cafes.length === 0 && !formErrors.cafeId && (
                      <p className="mt-1 text-xs text-yellow-600">No carts available for this franchise</p>
                    )}
                  </div>
                </>
              )}

              {/* Edit mode - show franchise and cart for employee roles */}
              {editingUser && (editingUser.role === 'cook' || editingUser.role === 'captain' || editingUser.role === 'waiter' || editingUser.role === 'manager') && (
                <>
                  <div className="pt-2 border-t border-gray-200 mt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Employee Details</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Franchise
                    </label>
                    <select
                      name="franchiseId"
                      value={formData.franchiseId}
                      onChange={async (e) => {
                        const selectedFranchiseId = e.target.value;
                        setFormData({ ...formData, franchiseId: selectedFranchiseId, cafeId: '' });
                        // Fetch cafes for selected franchise with fresh data
                        await fetchCafes(selectedFranchiseId, true);
                      }}
                      onFocus={async (e) => {
                        // Refresh cafes list when dropdown is focused/opened
                        if (formData.franchiseId) {
                          await fetchCafes(formData.franchiseId, true);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a franchise</option>
                      {franchises.map((franchise) => (
                        <option key={franchise._id} value={franchise._id}>
                          {franchise.name} {franchise.franchiseCode ? `(${franchise.franchiseCode})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Cart
                    </label>
                    <select
                      name="cafeId"
                      value={formData.cafeId}
                      onChange={(e) => {
                        setFormData({ ...formData, cafeId: e.target.value });
                      }}
                      disabled={!formData.franchiseId}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        !formData.franchiseId ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">
                        {!formData.franchiseId ? 'Select a franchise first' : 'Select a cart'}
                      </option>
                      {cafes.map((cafe) => {
                        const cafeIdValue = cafe._id?.toString() || cafe._id || '';
                        return (
                          <option key={cafeIdValue} value={cafeIdValue}>
                            {cafe.cartName || cafe.name} {cafe.cartCode ? `(${cafe.cartCode})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </>
              )}

              {/* Edit mode - show optional fields if they exist */}
              {editingUser && (
                <>
                  {editingUser.phone && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: e.target.value });
                          if (formErrors.phone) setFormErrors({ ...formErrors, phone: '' });
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          formErrors.phone
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="e.g., +91 9876543210"
                      />
                      {formErrors.phone && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                      )}
                    </div>
                  )}
                  {editingUser.mobile && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile</label>
                      <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={(e) => {
                          setFormData({ ...formData, mobile: e.target.value });
                          if (formErrors.mobile) setFormErrors({ ...formErrors, mobile: '' });
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          formErrors.mobile
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="e.g., 9876543210 or +91 9876543210"
                      />
                      {formErrors.mobile && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.mobile}</p>
                      )}
                    </div>
                  )}
                  {editingUser.gstNumber && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">GST Number</label>
                      <input
                        type="text"
                        name="gstNumber"
                        value={formData.gstNumber}
                        onChange={(e) => {
                          setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() });
                          if (formErrors.gstNumber) setFormErrors({ ...formErrors, gstNumber: '' });
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          formErrors.gstNumber 
                            ? 'border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:ring-blue-500'
                        }`}
                        placeholder="e.g., 27ABCDE1234F1Z5"
                        maxLength={15}
                      />
                      {formErrors.gstNumber && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.gstNumber}</p>
                      )}
                    </div>
                  )}
                </>
              )}

              </form>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-3">
                <button
                  type="submit"
                  form="user-form"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="animate-spin mr-2" />
                      {editingUser ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingUser ? 'Update' : 'Create'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
