import React, { useState, useEffect } from 'react';
import { FaUsers, FaPlus, FaEdit, FaTrash, FaSpinner, FaSearch, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [togglingStatus, setTogglingStatus] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'waiter',
    franchiseId: '',
    cartName: '',
    location: '',
    phone: '',
    address: ''
  });

  // Get allowed roles based on current user's hierarchy
  const getAllowedRoles = () => {
    if (!currentUser) return [];
    
    const userRole = currentUser.role;
    
    if (userRole === 'super_admin') {
      // Super Admin can create all roles
      return [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'franchise_admin', label: 'Franchise Admin' },
        { value: 'cart_admin', label: 'Cart Admin' },
        { value: 'manager', label: 'Manager' },
        { value: 'captain', label: 'Captain' },
        { value: 'waiter', label: 'Waiter' },
        { value: 'cook', label: 'Cook' }
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

  const handleToggleStatus = async (user) => {
    // Determine which endpoint to use based on role
    let endpoint = '';
    let confirmMessage = '';
    
    const isCurrentlyActive = user.isActive !== false;
    
    if (user.role === 'franchise_admin') {
      endpoint = `/users/${user._id}/toggle-status`;
      confirmMessage = `Are you sure you want to ${isCurrentlyActive ? 'DEACTIVATE' : 'ACTIVATE'} this franchise?\n\n${isCurrentlyActive ? '⚠️ All carts under this franchise will also be deactivated.' : '✅ All carts under this franchise will also be activated.'}`;
    } else if (user.role === 'admin' || user.role === 'cart_admin') {
      endpoint = `/users/${user._id}/toggle-cafe-status`;
      confirmMessage = `Are you sure you want to ${isCurrentlyActive ? 'DEACTIVATE' : 'ACTIVATE'} this cart?`;
    } else {
      // For other roles like employees, don't allow toggle
      alert('Status toggle is only available for Franchise Admins and Cart Admins');
      return;
    }

    if (!window.confirm(confirmMessage)) return;

    try {
      setTogglingStatus(user._id);
      const response = await api.patch(endpoint);
      
      if (response.data.success) {
        alert(response.data.message || 'Status updated successfully');
        fetchUsers(); // Refresh the list
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      alert(error.response?.data?.message || 'Failed to toggle status');
    } finally {
      setTogglingStatus(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update user
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        // Remove role from update data - role should not be changed when editing
        delete updateData.role;
        delete updateData.franchiseId;
        delete updateData.cartName;
        delete updateData.location;
        delete updateData.phone;
        delete updateData.address;
        await api.put(`/users/${editingUser._id}`, updateData);
        alert('User updated successfully');
      } else {
        // Create user
        if (formData.role === 'admin' || formData.role === 'cart_admin') {
          // For cart admin, use registerCafeAdmin endpoint with franchiseId
          if (!formData.franchiseId) {
            alert('Please select a franchise for the cart admin');
            return;
          }
          if (!formData.cartName || !formData.location) {
            alert('Please provide cart name and location');
            return;
          }
          // Validate all required fields before sending
          if (!formData.name?.trim()) {
            alert('Name is required');
            return;
          }
          if (!formData.email?.trim()) {
            alert('Email is required');
            return;
          }
          if (!formData.password || formData.password.length < 6) {
            alert('Password is required and must be at least 6 characters');
            return;
          }
          if (!formData.cartName?.trim()) {
            alert('Cart name is required');
            return;
          }
          if (!formData.location?.trim()) {
            alert('Location is required');
            return;
          }
          if (!formData.franchiseId) {
            alert('Please select a franchise');
            return;
          }

          const cartAdminData = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            cartName: formData.cartName.trim(),
            location: formData.location.trim(),
            franchiseId: formData.franchiseId
          };
          
          // Add optional fields only if they have values
          if (formData.phone?.trim()) {
            cartAdminData.phone = formData.phone.trim();
          }
          if (formData.address?.trim()) {
            cartAdminData.address = formData.address.trim();
          }

          try {
            console.log('[Users] Creating cart admin with data:', cartAdminData);
            const response = await api.post('/users/register-cafe-admin', cartAdminData);
            console.log('[Users] Cart admin created successfully:', response.data);
            alert('Cart admin created successfully');
            setShowModal(false);
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'employee', franchiseId: '', cartName: '', location: '', phone: '', address: '' });
            fetchUsers();
            fetchFranchises();
          } catch (error) {
            console.error('[Users] Error creating cart admin:', error);
            console.error('[Users] Error response:', error.response?.data);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to create cart admin';
            alert(`Error: ${errorMessage}\n\nPlease check:\n- All required fields are filled\n- Franchise is selected\n- Email is valid\n- Password is at least 6 characters`);
            // Don't close modal on error so user can fix and retry
            return;
          }
        } else {
          // For other roles, use regular createUser endpoint
          const userData = { ...formData };
          delete userData.franchiseId;
          delete userData.cartName;
          delete userData.location;
          delete userData.phone;
          delete userData.address;
          await api.post('/users', userData);
          alert('User created successfully');
        }
      }
      // Only close modal if we reach here (not for cart admin creation which handles its own success)
      if (formData.role !== 'admin' && formData.role !== 'cart_admin') {
        setShowModal(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', password: '', role: 'employee', franchiseId: '', cartName: '', location: '', phone: '', address: '' });
        fetchUsers();
        fetchFranchises();
      }
    } catch (error) {
      console.error('Error saving user:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.message || 'Failed to save user');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      franchiseId: user.franchiseId || '',
      cartName: user.cartName || '',
      location: user.location || '',
      phone: user.phone || '',
      address: user.address || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    // Find the user to check their role
    const userToDelete = users.find(u => u._id === userId);
    
    // Prevent deleting super admin users
    if (userToDelete && userToDelete.role === 'super_admin') {
      alert('Super admin users cannot be deleted');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Users</h1>
          <p className="text-gray-600 mt-2">Manage all system users</p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role: 'employee', franchiseId: '', cartName: '', location: '', phone: '', address: '' });
            setShowModal(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FaPlus className="mr-2" />
          Add New User
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="text-2xl font-bold text-gray-800">{users.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">
            {users.filter(u => u.effectivelyActive !== undefined ? u.effectivelyActive : u.isActive !== false).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Inactive</p>
          <p className="text-2xl font-bold text-red-600">
            {users.filter(u => u.effectivelyActive !== undefined ? !u.effectivelyActive : u.isActive === false).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Franchises</p>
          <p className="text-2xl font-bold text-blue-600">
            {users.filter(u => u.role === 'franchise_admin').length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        {user.cartName && (
                          <p className="text-xs text-gray-500">Cart: {user.cartName}</p>
                        )}
                        {user.cafeName && !user.cartName && (
                          <p className="text-xs text-gray-500">Cart: {user.cafeName}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role] || roleColors.customer}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(user)}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end space-x-2">
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
                              <FaSpinner className="animate-spin" />
                            ) : (user.effectivelyActive !== undefined ? !user.effectivelyActive : user.isActive === false) ? (
                              <FaToggleOff className="text-xl" />
                            ) : (
                              <FaToggleOn className="text-xl" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <FaEdit />
                        </button>
                        {user.role !== 'super_admin' && (
                          <button
                            onClick={() => handleDelete(user._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value, franchiseId: '', cartName: '', location: '', phone: '', address: '' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a role</option>
                    {getAllowedRoles().map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Cart Admin specific fields */}
              {!editingUser && (formData.role === 'admin' || formData.role === 'cart_admin') && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Franchise <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.franchiseId}
                      onChange={(e) => setFormData({ ...formData, franchiseId: e.target.value })}
                      required
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
                      Cart Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.cartName}
                      onChange={(e) => setFormData({ ...formData, cartName: e.target.value })}
                      placeholder="e.g., Downtown Cart"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g., Mumbai, Maharashtra"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g., +91 9876543210"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Address</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Full address of the cart"
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingUser ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    setFormData({ name: '', email: '', password: '', role: 'waiter', franchiseId: '', cartName: '', location: '', phone: '', address: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
