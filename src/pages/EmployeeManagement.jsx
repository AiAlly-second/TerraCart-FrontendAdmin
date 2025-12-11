import React, { useState, useEffect } from 'react';
import { FaUsers, FaPlus, FaEdit, FaTrash, FaSpinner, FaSearch, FaBuilding, FaStore, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Minimum age as per Indian Labor Laws (18 years for general employment)
const MINIMUM_WORKING_AGE = 18;

// Helper function to calculate age from DOB
const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper function to get maximum DOB date (18 years ago from today)
const getMaxDOBDate = () => {
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - MINIMUM_WORKING_AGE, today.getMonth(), today.getDate());
  return maxDate.toISOString().split('T')[0];
};

const EmployeeManagement = () => {
  const { user } = useAuth();
  const userRole = user?.role;
  const isCartAdmin = userRole === 'admin';
  const [hierarchy, setHierarchy] = useState([]);
  const [orphanEmployees, setOrphanEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFranchises, setExpandedFranchises] = useState(new Set());
  const [expandedCafes, setExpandedCafes] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedFranchise, setSelectedFranchise] = useState('');
  const [selectedCafe, setSelectedCafe] = useState('');
  const [franchises, setFranchises] = useState([]);
  const [cafes, setCafes] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    mobile: '',
    email: '', // Add email field for user creation
    password: '', // Add password field for user creation
    role: 'waiter', // Use role instead of employeeRole
    franchiseId: '',
    cafeId: '',
    kycVerified: false,
    disability: {
      hasDisability: false,
      type: ''
    },
    deviceIssued: {
      smartwatch: false,
      tracker: false
    },
    imei: {
      device: '',
      phone: ''
    },
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch hierarchical structure
      const hierarchyResponse = await api.get('/employees/hierarchy');
      setHierarchy(hierarchyResponse.data.hierarchy || []);
      setOrphanEmployees(hierarchyResponse.data.orphanEmployees || []);
      
      // Fetch franchises and cafes for dropdowns (only for franchise admin and super admin)
      if (!isCartAdmin) {
        const usersResponse = await api.get('/users');
        const allUsers = usersResponse.data || [];
        const allFranchises = allUsers.filter(u => u.role === 'franchise_admin');
        
        // For franchise admin, ensure their own franchise is in the list
        if (userRole === 'franchise_admin' && user?._id) {
          const currentFranchise = allFranchises.find(f => 
            f._id?.toString() === user._id?.toString() || 
            f._id === user._id
          );
          // If current franchise not found in list, add it
          if (!currentFranchise) {
            allFranchises.push({
              _id: user._id,
              name: user.name || user.franchiseName || 'My Franchise',
              email: user.email
            });
          }
        }
        
        setFranchises(allFranchises);
        setCafes(allUsers.filter(u => u.role === 'admin'));
      }
      
      // Expand all by default
      const franchiseIds = hierarchyResponse.data.hierarchy.map(f => f._id);
      setExpandedFranchises(new Set(franchiseIds));
      
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch employee data');
    } finally {
      setLoading(false);
    }
  };

  const toggleFranchise = (franchiseId) => {
    const newExpanded = new Set(expandedFranchises);
    if (newExpanded.has(franchiseId)) {
      newExpanded.delete(franchiseId);
    } else {
      newExpanded.add(franchiseId);
    }
    setExpandedFranchises(newExpanded);
  };

  const toggleCafe = (cafeId) => {
    const newExpanded = new Set(expandedCafes);
    if (newExpanded.has(cafeId)) {
      newExpanded.delete(cafeId);
    } else {
      newExpanded.add(cafeId);
    }
    setExpandedCafes(newExpanded);
  };

  const handleFranchiseChange = (franchiseId) => {
    const franchiseIdStr = franchiseId?.toString() || franchiseId || '';
    setSelectedFranchise(franchiseIdStr);
    setSelectedCafe(''); // Reset cafe selection
    setFormData({ ...formData, franchiseId: franchiseIdStr, cafeId: '' });
  };

  const handleCafeChange = (cafeId) => {
    const cafeIdStr = cafeId?.toString() || cafeId || '';
    setSelectedCafe(cafeIdStr);
    setFormData({ ...formData, cafeId: cafeIdStr });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name || !formData.dateOfBirth || !formData.mobile) {
      alert('Please fill in all required fields (Name, DOB, Mobile)');
      return;
    }

    // DOB validation as per Indian Labor Laws (minimum 18 years)
    const age = calculateAge(formData.dateOfBirth);
    if (age < MINIMUM_WORKING_AGE) {
      alert(`⚠️ Age Validation Failed!\n\nAs per Indian Labor Laws (Child and Adolescent Labour (Prohibition and Regulation) Act, 1986), the minimum working age is ${MINIMUM_WORKING_AGE} years.\n\nEmployee's age: ${age} years\nRequired age: ${MINIMUM_WORKING_AGE}+ years\n\nPlease verify the date of birth.`);
      return;
    }

    try {
      const submitData = {
        ...formData,
        dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined,
        franchiseId: selectedFranchise || undefined,
        cafeId: selectedCafe || undefined,
        employeeRole: formData.role, // Map role to employeeRole for Employee model compatibility
        role: formData.role // Also send role for User creation
      };

      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee._id}`, submitData);
        alert('Employee updated successfully');
      } else {
        await api.post('/employees', submitData);
        alert('Employee created successfully');
      }
      
      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving employee:', error);
      alert(error.response?.data?.message || 'Failed to save employee');
    }
  };

  const handleEdit = async (employee) => {
    setEditingEmployee(employee);
    // Cart admin cannot see/edit franchise info
    if (!isCartAdmin) {
      setSelectedFranchise(employee.franchiseId?._id || employee.franchiseId || '');
      setSelectedCafe(employee.cafeId?._id || employee.cafeId || '');
    } else {
      // Cart admin: cafeId is automatically their cart
      setSelectedCafe(user?._id || '');
    }
    
    // Start with employee data (may already have email from hierarchy)
    let fullEmployeeData = { ...employee };
    
    // Check if email is already available from the employee object (from hierarchy)
    // Hierarchy endpoint should populate email from User model
    if (employee.email && employee.email !== 'employee@example.com' && employee.email.trim() !== '') {
      console.log('[EmployeeManagement] Email from hierarchy employee object:', employee.email);
      // Use this email as initial value
      fullEmployeeData.email = employee.email;
    } else if (employee.userId) {
      // Check if userId is populated in the employee object from hierarchy
      if (typeof employee.userId === 'object' && employee.userId.email) {
        fullEmployeeData.email = employee.userId.email;
        console.log('[EmployeeManagement] Email from userId in hierarchy:', employee.userId.email);
      }
    }
    
    try {
      // Fetch full employee details from backend (includes email if stored)
      const employeeResponse = await api.get(`/employees/${employee._id}`);
      
      // Backend returns { success: true, data: employee }
      // Axios response structure: response.data = { success: true, data: employee }
      if (employeeResponse?.data?.success && employeeResponse?.data?.data) {
        // Backend wrapped response: { success: true, data: employee }
        fullEmployeeData = employeeResponse.data.data;
      } else if (employeeResponse?.data && !employeeResponse.data.success) {
        // Direct employee object (no wrapper)
        fullEmployeeData = employeeResponse.data;
      } else {
        // Fallback to provided employee data
        fullEmployeeData = employee;
      }
      
      // ALWAYS check userId for email - User model is the source of truth for login emails
      if (fullEmployeeData.userId) {
        let userEmail = null;
        
        // Check if userId is populated (object) with email
        if (typeof fullEmployeeData.userId === 'object' && fullEmployeeData.userId.email) {
          userEmail = fullEmployeeData.userId.email;
          console.log('[EmployeeManagement] Email from populated userId object:', userEmail);
        } else {
          // userId is just an ID string, fetch User to get email
          const userId = typeof fullEmployeeData.userId === 'object' 
            ? (fullEmployeeData.userId._id || fullEmployeeData.userId.id)
            : fullEmployeeData.userId;
          
          if (userId) {
            try {
              console.log('[EmployeeManagement] Fetching User email for userId:', userId);
              const userResponse = await api.get(`/users/${userId}`);
              
              // Handle different response structures
              let fetchedEmail = null;
              if (userResponse?.data?.email) {
                fetchedEmail = userResponse.data.email;
              } else if (userResponse?.data?.user?.email) {
                fetchedEmail = userResponse.data.user.email;
              } else if (userResponse?.data?.data?.email) {
                fetchedEmail = userResponse.data.data.email;
              }
              
              if (fetchedEmail) {
                userEmail = fetchedEmail;
                console.log('[EmployeeManagement] ✅ Email fetched from User API:', userEmail);
              } else {
                console.warn('[EmployeeManagement] ⚠️ User found but no email in response:', {
                  responseData: userResponse?.data,
                  userId: userId
                });
              }
            } catch (userErr) {
              console.error('[EmployeeManagement] ❌ Error fetching user email:', userErr);
              console.error('[EmployeeManagement] UserId was:', userId);
              console.error('[EmployeeManagement] Error details:', userErr.response?.data || userErr.message);
            }
          }
        }
        
        // Use User email if found, otherwise keep employee email (if valid)
        if (userEmail) {
          fullEmployeeData.email = userEmail;
        } else if (!fullEmployeeData.email || fullEmployeeData.email === 'employee@example.com') {
          // If no valid email found, log warning
          console.warn('[EmployeeManagement] No email found in User model for userId:', fullEmployeeData.userId);
        }
      }
      
      console.log('[EmployeeManagement] Fetched employee data:', {
        rawResponse: employeeResponse?.data,
        extractedData: fullEmployeeData,
        name: fullEmployeeData?.name,
        email: fullEmployeeData?.email,
        mobile: fullEmployeeData?.mobile,
        dateOfBirth: fullEmployeeData?.dateOfBirth,
        userId: fullEmployeeData?.userId,
        userIdType: typeof fullEmployeeData?.userId,
        hasUserIdEmail: fullEmployeeData?.userId?.email
      });
      
      // CRITICAL: If employee has userId but no email yet, fetch from User model
      // This ensures we always get the actual login email
      if (fullEmployeeData.userId && (!fullEmployeeData.email || fullEmployeeData.email === 'employee@example.com')) {
        const userIdToFetch = typeof fullEmployeeData.userId === 'object' 
          ? (fullEmployeeData.userId._id || fullEmployeeData.userId.id || fullEmployeeData.userId)
          : fullEmployeeData.userId;
        
        if (userIdToFetch) {
          try {
            console.log('[EmployeeManagement] Fetching User email directly for userId:', userIdToFetch);
            const directUserResponse = await api.get(`/users/${userIdToFetch}`);
            const userEmail = directUserResponse?.data?.email || directUserResponse?.data?.user?.email;
            if (userEmail) {
              fullEmployeeData.email = userEmail;
              console.log('[EmployeeManagement] ✅ Email successfully fetched from User model:', userEmail);
            } else {
              console.warn('[EmployeeManagement] ⚠️ User found but no email in response:', directUserResponse?.data);
            }
          } catch (directUserErr) {
            console.error('[EmployeeManagement] ❌ Failed to fetch User email:', directUserErr);
            console.error('[EmployeeManagement] UserId attempted:', userIdToFetch);
          }
        }
      }
      
      // FALLBACK: If still no email and employee has email in Employee model, try to find User by email
      // This handles cases where userId link might be missing
      if ((!fullEmployeeData.email || fullEmployeeData.email === 'employee@example.com') && employee.email && employee.email !== 'employee@example.com') {
        try {
          console.log('[EmployeeManagement] Trying to find User by email:', employee.email);
          const usersResponse = await api.get('/users');
          const allUsers = usersResponse.data || [];
          const foundUser = allUsers.find(u => u.email && u.email.toLowerCase().trim() === employee.email.toLowerCase().trim());
          
          if (foundUser) {
            fullEmployeeData.email = foundUser.email;
            fullEmployeeData.userId = foundUser._id;
            console.log('[EmployeeManagement] ✅ Found User by email and linked userId:', foundUser.email, foundUser._id);
          }
        } catch (emailLookupErr) {
          console.warn('[EmployeeManagement] Could not lookup User by email:', emailLookupErr);
        }
      }
    } catch (error) {
      console.error('Error fetching full employee details:', error);
      console.warn('Using provided employee data:', employee);
      // Use the employee data we already have
      fullEmployeeData = employee;
    }
    
    // Format date for input - handle various date formats
    let dob = '';
    if (fullEmployeeData.dateOfBirth) {
      try {
        const dateObj = new Date(fullEmployeeData.dateOfBirth);
        if (!isNaN(dateObj.getTime())) {
          // Format as YYYY-MM-DD for date input
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          dob = `${year}-${month}-${day}`;
        }
      } catch (dateError) {
        console.warn('Error formatting date:', dateError, fullEmployeeData.dateOfBirth);
      }
    }
    
    // Extract franchise and cafe IDs (handle both populated and non-populated)
    const franchiseId = isCartAdmin 
      ? '' 
      : (fullEmployeeData.franchiseId?._id || fullEmployeeData.franchiseId || '');
    const cafeId = isCartAdmin 
      ? (user?._id || '') 
      : (fullEmployeeData.cafeId?._id || fullEmployeeData.cafeId || '');
    
    // Get email - prefer User model email (via userId) over Employee model email
    // User model is the source of truth for login accounts
    let employeeEmail = '';
    
    // First, try to get email from User model (via userId) - this is the actual login email
    if (fullEmployeeData.userId) {
      if (typeof fullEmployeeData.userId === 'object' && fullEmployeeData.userId.email) {
        employeeEmail = fullEmployeeData.userId.email;
        console.log('[EmployeeManagement] Using email from populated userId:', employeeEmail);
      } else {
        // userId is an ID, email should already be in fullEmployeeData.email from the fetch above
        // But if not, we'll use what we have
        if (fullEmployeeData.email && fullEmployeeData.email !== 'employee@example.com') {
          employeeEmail = fullEmployeeData.email;
          console.log('[EmployeeManagement] Using email from fullEmployeeData (fetched from User):', employeeEmail);
        }
      }
    }
    
    // Fallback: use employee.email if it's valid (not placeholder)
    if (!employeeEmail && fullEmployeeData.email && fullEmployeeData.email !== 'employee@example.com') {
      employeeEmail = fullEmployeeData.email;
      console.log('[EmployeeManagement] Using email from Employee model:', employeeEmail);
    }
    
    console.log('[EmployeeManagement] Final email extracted:', {
      employeeEmail,
      fromEmployee: fullEmployeeData.email,
      fromUserId: fullEmployeeData.userId?.email,
      userId: fullEmployeeData.userId,
      userIdType: typeof fullEmployeeData.userId
    });
    
    // Final check - if still no email, log warning
    if (!employeeEmail || employeeEmail === 'employee@example.com') {
      console.warn('[EmployeeManagement] ⚠️ Email not found for employee:', {
        employeeId: fullEmployeeData._id,
        employeeName: fullEmployeeData.name,
        hasUserId: !!fullEmployeeData.userId,
        userIdValue: fullEmployeeData.userId
      });
    }
    
    setFormData({
      name: fullEmployeeData.name || '',
      dateOfBirth: dob,
      mobile: fullEmployeeData.mobile || '',
      email: employeeEmail, // Email from Employee model or User model (via userId)
      password: '', // Don't populate password when editing
      role: fullEmployeeData.employeeRole || fullEmployeeData.role || 'waiter', // Use role, fallback to employeeRole for backward compatibility
      employeeRole: fullEmployeeData.employeeRole || fullEmployeeData.role || 'waiter',
      franchiseId: franchiseId,
      cafeId: cafeId,
      kycVerified: fullEmployeeData.kycVerified || false,
      disability: fullEmployeeData.disability || { hasDisability: false, type: '' },
      deviceIssued: fullEmployeeData.deviceIssued || { smartwatch: false, tracker: false },
      imei: fullEmployeeData.imei || { device: '', phone: '' },
      isActive: fullEmployeeData.isActive !== false
    });
    
    console.log('[EmployeeManagement] Form data set:', {
      name: fullEmployeeData.name,
      email: employeeEmail,
      emailFromEmployee: fullEmployeeData.email,
      emailFromUserId: fullEmployeeData.userId?.email,
      mobile: fullEmployeeData.mobile,
      dateOfBirth: dob,
      role: fullEmployeeData.employeeRole || fullEmployeeData.role,
      userId: fullEmployeeData.userId
    });
    
    // Verify email is set correctly
    if (!employeeEmail || employeeEmail === 'employee@example.com') {
      console.warn('[EmployeeManagement] ⚠️ Email not properly extracted!', {
        employeeEmail,
        fullEmployeeDataEmail: fullEmployeeData.email,
        userId: fullEmployeeData.userId
      });
    }
    
    setShowModal(true);
  };

  const handleDelete = async (e, employeeId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const employee = employees.find(emp => emp._id === employeeId);
    const employeeName = employee?.name || 'this employee';
    
    const { confirm } = await import('../utils/confirm');
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE "${employeeName}"?\n\nThis action cannot be undone.`,
      {
        title: 'Delete Employee',
        warningMessage: 'WARNING: PERMANENTLY DELETE',
        danger: true,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/employees/${employeeId}`);
      alert('Employee deleted successfully');
      fetchData();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Failed to delete employee');
    }
  };

  const resetForm = () => {
    const isFranchiseAdmin = userRole === 'franchise_admin';
    const franchiseId = isFranchiseAdmin ? (user?._id?.toString() || user?._id || '') : '';
    const cafeId = isCartAdmin ? (user?._id?.toString() || user?._id || '') : '';
    
    setFormData({
      name: '',
      dateOfBirth: '',
      mobile: '',
      email: '',
      password: '',
      role: 'waiter',
      franchiseId: franchiseId, // Auto-set for franchise admin
      cafeId: cafeId, // Auto-set for cart admin
      kycVerified: false,
      disability: { hasDisability: false, type: '' },
      deviceIssued: { smartwatch: false, tracker: false },
      imei: { device: '', phone: '' },
      isActive: true
    });
    
    // Pre-populate franchise for franchise admin (ensure it's a string for comparison)
    if (isFranchiseAdmin) {
      setSelectedFranchise(franchiseId);
    } else {
      setSelectedFranchise('');
    }
    
    setSelectedCafe(cafeId);
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
    resetForm();
    setShowModal(true);
  };

  const filteredHierarchy = hierarchy.filter(franchise => {
    const franchiseMatch = franchise.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const cafeMatch = franchise.cafes?.some(cafe => 
      cafe.cafeName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const employeeMatch = [
      ...(franchise.employees || []),
      ...(franchise.cafes?.flatMap(cafe => cafe.employees || []) || [])
    ].some(emp => emp.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return franchiseMatch || cafeMatch || employeeMatch;
  });

  // Unified roles for employee creation (matches User model roles)
  const employeeRoles = [
    { value: 'manager', label: 'Manager' },
    { value: 'captain', label: 'Captain' },
    { value: 'waiter', label: 'Waiter' },
    { value: 'cook', label: 'Cook' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FaSpinner className="animate-spin text-4xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Employee Management</h1>
          <p className="text-gray-600 mt-1">Manage employees hierarchically by Franchise and Cart</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FaPlus className="mr-2" />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by franchise, cart, or employee name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 space-y-4">
          {filteredHierarchy.length === 0 && !loading ? (
            <div className="text-center py-12 text-gray-500">
              <FaUsers className="mx-auto text-4xl mb-4" />
              <p>No employees found</p>
            </div>
          ) : (
            filteredHierarchy.map((franchise) => (
              <div key={franchise._id} className="border border-gray-200 rounded-lg">
                {/* Franchise/Cart Header */}
                {isCartAdmin ? (
                  // Cart Admin View: Show only cart header (no franchise info)
                  <div className="flex items-center justify-between p-4 bg-blue-50">
                    <div className="flex items-center space-x-3">
                      <FaStore className="text-green-600" />
                      <div>
                        <h3 className="font-semibold text-lg">{franchise.name}</h3>
                        <p className="text-sm text-gray-500">{franchise.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {franchise.cafes?.[0]?.employees?.length || 0} Employees
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${franchise.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {franchise.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ) : (
                  // Franchise Admin / Super Admin View: Show franchise header
                  <div
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => toggleFranchise(franchise._id)}
                  >
                    <div className="flex items-center space-x-3">
                      {expandedFranchises.has(franchise._id) ? (
                        <FaChevronDown className="text-gray-500" />
                      ) : (
                        <FaChevronRight className="text-gray-500" />
                      )}
                      <FaBuilding className="text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-lg">{franchise.name}</h3>
                        <p className="text-sm text-gray-500">{franchise.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {franchise.cafes?.length || 0} Carts, {franchise.employees?.length || 0} Franchise Employees
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${franchise.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {franchise.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Franchise Content */}
                {(isCartAdmin || (!isCartAdmin && expandedFranchises.has(franchise._id))) && (
                  <div className="p-4 space-y-4">
                    {/* Franchise-Level Employees - HIDDEN for cart admin */}
                    {!isCartAdmin && franchise.employees && franchise.employees.length > 0 && (
                      <div className="ml-4">
                        <h4 className="font-semibold text-gray-700 mb-2">Franchise Employees</h4>
                        <div className="space-y-2">
                          {franchise.employees.map((employee) => (
                            <div
                              key={employee._id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                            >
                              <div className="flex-1">
                                <div className="font-medium">{employee.name}</div>
                                <div className="text-sm text-gray-600">
                                  {employee.employeeRole || employee.role || 'N/A'} • {employee.mobile}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEdit(employee)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDelete(e, employee._id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Carts */}
                    {franchise.cafes && franchise.cafes.length > 0 && (
                      <div className={isCartAdmin ? "space-y-3" : "ml-4 space-y-3"}>
                        {!isCartAdmin && <h4 className="font-semibold text-gray-700 mb-2">Carts</h4>}
                        {franchise.cafes.map((cafe) => (
                          <div key={cafe._id} className="border border-gray-200 rounded-lg">
                            {/* Cart Header */}
                            {isCartAdmin ? (
                              // Cart Admin: Always show employees (no expand/collapse)
                              <div className="p-4 space-y-2">
                                {cafe.employees && cafe.employees.length > 0 ? (
                                  cafe.employees.map((employee) => (
                                    <div
                                      key={employee._id}
                                      className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                                    >
                                      <div className="flex-1">
                                        <div className="font-medium">{employee.name}</div>
                                        <div className="text-sm text-gray-600">
                                          {employee.employeeRole || employee.role || 'N/A'} • {employee.mobile}
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => handleEdit(employee)}
                                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                          <FaEdit />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => handleDelete(e, employee._id)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                                        >
                                          <FaTrash />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No employees in this cart
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Franchise Admin / Super Admin: Show expandable cart
                              <>
                                <div
                                  className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 cursor-pointer"
                                  onClick={() => toggleCafe(cafe._id)}
                                >
                                  <div className="flex items-center space-x-3">
                                    {expandedCafes.has(cafe._id) ? (
                                      <FaChevronDown className="text-gray-500" />
                                    ) : (
                                      <FaChevronRight className="text-gray-500" />
                                    )}
                                    <FaStore className="text-green-600" />
                                    <div>
                                      <h4 className="font-semibold">{cafe.cafeName || cafe.name}</h4>
                                      <p className="text-sm text-gray-500">{cafe.email}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <span className="text-sm text-gray-600">
                                      {cafe.employees?.length || 0} Employees
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs ${cafe.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                      {cafe.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                  </div>
                                </div>

                                {/* Cart Employees */}
                                {expandedCafes.has(cafe._id) && (
                                  <div className="p-4 space-y-2">
                                    {cafe.employees && cafe.employees.length > 0 ? (
                                      cafe.employees.map((employee) => (
                                        <div
                                          key={employee._id}
                                          className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                                        >
                                          <div className="flex-1">
                                            <div className="font-medium">{employee.name}</div>
                                            <div className="text-sm text-gray-600">
                                              {employee.employeeRole} • {employee.mobile}
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <button
                                              onClick={() => handleEdit(employee)}
                                              className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                              <FaEdit />
                                            </button>
                                            <button
                                              type="button"
                                          onClick={(e) => handleDelete(e, employee._id)}
                                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                                            >
                                              <FaTrash />
                                            </button>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-center py-4 text-gray-500 text-sm">
                                        No employees in this cart
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Orphan Employees (no franchise/cart) */}
          {orphanEmployees && orphanEmployees.length > 0 && (
            <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Unassigned Employees</h3>
              <div className="space-y-2">
                {orphanEmployees.map((employee) => (
                  <div
                    key={employee._id}
                    className="flex items-center justify-between p-3 bg-white rounded border border-yellow-200"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-sm text-gray-600">
                        {employee.employeeRole} • {employee.mobile}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(employee)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(employee._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingEmployee ? 'Edit Employee' : 'Create Employee'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth * <span className="text-xs text-gray-500">(Min age: 18 years as per Indian Labor Laws)</span></label>
                  <input
                    type="date"
                    required
                    max={getMaxDOBDate()}
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {formData.dateOfBirth && (
                    <p className={`mt-1 text-xs ${calculateAge(formData.dateOfBirth) >= MINIMUM_WORKING_AGE ? 'text-green-600' : 'text-red-600'}`}>
                      Age: {calculateAge(formData.dateOfBirth)} years {calculateAge(formData.dateOfBirth) >= MINIMUM_WORKING_AGE ? '✓' : '(Below minimum age)'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {employeeRoles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email {!editingEmployee && '*'}</label>
                  <input
                    type="email"
                    required={!editingEmployee}
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={editingEmployee ? "No email (employee has no login account)" : "employee@example.com"}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      formData.email ? 'border-gray-300' : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {editingEmployee 
                      ? (formData.email 
                          ? `Current login email: ${formData.email}` 
                          : 'Employee has no login account. Add email to create login access.')
                      : 'Required for login access'}
                  </p>
                  {editingEmployee && formData.email && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Email found - employee can login with this email
                    </p>
                  )}
                </div>
                {!editingEmployee && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min 6 characters"
                      minLength={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Employee will use this to login</p>
                  </div>
                )}
                {!isCartAdmin && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Franchise</label>
                      <select
                        value={selectedFranchise?.toString() || ''}
                        onChange={(e) => handleFranchiseChange(e.target.value)}
                        disabled={userRole === 'franchise_admin'} // Disable for franchise admin (they can only add to their own franchise)
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-600"
                      >
                        <option value="">Select Franchise</option>
                        {franchises.map(franchise => (
                          <option 
                            key={franchise._id?.toString() || franchise._id} 
                            value={franchise._id?.toString() || franchise._id}
                          >
                            {franchise.name || franchise.franchiseName || 'Unnamed Franchise'}
                          </option>
                        ))}
                      </select>
                      {userRole === 'franchise_admin' && (
                        <p className="text-xs text-gray-500 mt-1">Your franchise is automatically selected</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cart</label>
                      <select
                        value={selectedCafe}
                        onChange={(e) => handleCafeChange(e.target.value)}
                        disabled={!selectedFranchise}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">Select Cart (Optional)</option>
                        {cafes
                          .filter(cafe => {
                            // For franchise admin, only show carts under their franchise
                            if (userRole === 'franchise_admin') {
                              const franchiseId = user?._id?.toString() || user?._id;
                              const cafeFranchiseId = cafe.franchiseId?._id?.toString() || cafe.franchiseId?._id || cafe.franchiseId?.toString() || cafe.franchiseId;
                              return cafeFranchiseId && cafeFranchiseId.toString() === franchiseId.toString();
                            }
                            // For super admin, filter by selected franchise
                            if (!selectedFranchise) return true;
                            const cafeFranchiseId = cafe.franchiseId?._id?.toString() || cafe.franchiseId?._id || cafe.franchiseId?.toString() || cafe.franchiseId;
                            return cafeFranchiseId && cafeFranchiseId.toString() === selectedFranchise.toString();
                          })
                          .map(cafe => (
                            <option 
                              key={cafe._id?.toString() || cafe._id} 
                              value={cafe._id?.toString() || cafe._id}
                            >
                              {cafe.cafeName || cafe.name}
                            </option>
                          ))}
                      </select>
                      {userRole === 'franchise_admin' && selectedFranchise && (
                        <p className="text-xs text-gray-500 mt-1">Showing carts under your franchise</p>
                      )}
                    </div>
                  </>
                )}
                {isCartAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cart</label>
                    <input
                      type="text"
                      value={user?.name || user?.cartName || 'Your Cart'}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Employees will be assigned to your cart automatically</p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.kycVerified}
                    onChange={(e) => setFormData({ ...formData, kycVerified: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">KYC Verified</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingEmployee(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingEmployee ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;

