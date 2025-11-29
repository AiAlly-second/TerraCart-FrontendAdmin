import React, { useState, useEffect } from 'react';
import { FaUsers, FaPlus, FaEdit, FaTrash, FaSpinner, FaSearch, FaBuilding, FaStore, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import api from '../utils/api';

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
    employeeRole: 'waiter',
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
      
      // Fetch franchises and cafes for dropdowns
      const usersResponse = await api.get('/users');
      const allUsers = usersResponse.data || [];
      setFranchises(allUsers.filter(u => u.role === 'franchise_admin'));
      setCafes(allUsers.filter(u => u.role === 'admin'));
      
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
    setSelectedFranchise(franchiseId);
    setSelectedCafe(''); // Reset cafe selection
    setFormData({ ...formData, franchiseId, cafeId: '' });
  };

  const handleCafeChange = (cafeId) => {
    setSelectedCafe(cafeId);
    setFormData({ ...formData, cafeId });
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
        cafeId: selectedCafe || undefined
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

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setSelectedFranchise(employee.franchiseId?._id || '');
    setSelectedCafe(employee.cafeId?._id || '');
    
    // Format date for input
    const dob = employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().split('T')[0] : '';
    
    setFormData({
      name: employee.name || '',
      dateOfBirth: dob,
      mobile: employee.mobile || '',
      employeeRole: employee.employeeRole || 'waiter',
      franchiseId: employee.franchiseId?._id || '',
      cafeId: employee.cafeId?._id || '',
      kycVerified: employee.kycVerified || false,
      disability: employee.disability || { hasDisability: false, type: '' },
      deviceIssued: employee.deviceIssued || { smartwatch: false, tracker: false },
      imei: employee.imei || { device: '', phone: '' },
      isActive: employee.isActive !== false
    });
    setShowModal(true);
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }
    
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
    setFormData({
      name: '',
      dateOfBirth: '',
      mobile: '',
      employeeRole: 'waiter',
      franchiseId: '',
      cafeId: '',
      kycVerified: false,
      disability: { hasDisability: false, type: '' },
      deviceIssued: { smartwatch: false, tracker: false },
      imei: { device: '', phone: '' },
      isActive: true
    });
    setSelectedFranchise('');
    setSelectedCafe('');
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

  const employeeRoles = [
    { value: 'waiter', label: 'Waiter' },
    { value: 'chef', label: 'Chef' },
    { value: 'manager', label: 'Manager' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'cleaner', label: 'Cleaner' },
    { value: 'franchise_manager', label: 'Franchise Manager' },
    { value: 'area_manager', label: 'Area Manager' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'hr_manager', label: 'HR Manager' },
    { value: 'operations_manager', label: 'Operations Manager' },
    { value: 'quality_auditor', label: 'Quality Auditor' },
    { value: 'training_coordinator', label: 'Training Coordinator' },
    { value: 'other', label: 'Other' }
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
          <p className="text-gray-600 mt-1">Manage employees hierarchically by Franchise and Cafe</p>
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
            placeholder="Search by franchise, cafe, or employee name..."
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
                {/* Franchise Header */}
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
                      {franchise.cafes?.length || 0} Cafes, {franchise.employees?.length || 0} Franchise Employees
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${franchise.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {franchise.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Franchise Content */}
                {expandedFranchises.has(franchise._id) && (
                  <div className="p-4 space-y-4">
                    {/* Franchise-Level Employees */}
                    {franchise.employees && franchise.employees.length > 0 && (
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

                    {/* Cafes */}
                    {franchise.cafes && franchise.cafes.length > 0 && (
                      <div className="ml-4 space-y-3">
                        <h4 className="font-semibold text-gray-700 mb-2">Cafes</h4>
                        {franchise.cafes.map((cafe) => (
                          <div key={cafe._id} className="border border-gray-200 rounded-lg">
                            {/* Cafe Header */}
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

                            {/* Cafe Employees */}
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
                                          onClick={() => handleDelete(employee._id)}
                                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                                        >
                                          <FaTrash />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No employees in this cafe
                                  </div>
                                )}
                              </div>
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

          {/* Orphan Employees (no franchise/cafe) */}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Role *</label>
                  <select
                    required
                    value={formData.employeeRole}
                    onChange={(e) => setFormData({ ...formData, employeeRole: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {employeeRoles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Franchise</label>
                  <select
                    value={selectedFranchise}
                    onChange={(e) => handleFranchiseChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Franchise</option>
                    {franchises.map(franchise => (
                      <option key={franchise._id} value={franchise._id}>{franchise.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cafe</label>
                  <select
                    value={selectedCafe}
                    onChange={(e) => handleCafeChange(e.target.value)}
                    disabled={!selectedFranchise}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">Select Cafe (Optional)</option>
                    {cafes
                      .filter(cafe => !selectedFranchise || (cafe.franchiseId && (cafe.franchiseId._id || cafe.franchiseId).toString() === selectedFranchise))
                      .map(cafe => (
                        <option key={cafe._id} value={cafe._id}>{cafe.cafeName || cafe.name}</option>
                      ))}
                  </select>
                </div>
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

