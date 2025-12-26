import React, { useEffect, useState } from "react";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../../services/costingV2Api";
import { FaPlus, FaEdit, FaTrash, FaBuilding, FaCheck, FaPhoneAlt, FaEnvelope } from "react-icons/fa";

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    contact: { phone: "", email: "", person: "" },
    address: { street: "", city: "", state: "", zipCode: "", country: "India" },
    paymentTerms: "Net 30",
    isActive: true,
    notes: "",
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await getSuppliers();
      if (res.data.success) {
        setSuppliers(res.data.data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching suppliers:", error);
      }
      alert("Failed to fetch suppliers");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateSupplier(editing._id, formData);
        alert("Supplier updated successfully!");
      } else {
        await createSupplier(formData);
        alert("Supplier created successfully!");
      }
      setModalOpen(false);
      setEditing(null);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      alert(`Failed to save supplier: ${error.response?.data?.message || error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contact: { phone: "", email: "", person: "" },
      address: { street: "", city: "", state: "", zipCode: "", country: "India" },
      paymentTerms: "Net 30",
      isActive: true,
      notes: "",
    });
  };

  const handleEdit = (supplier) => {
    setEditing(supplier);
    setFormData({
      name: supplier.name,
      contact: supplier.contact || { phone: "", email: "", person: "" },
      address: supplier.address || { street: "", city: "", state: "", zipCode: "", country: "India" },
      paymentTerms: supplier.paymentTerms || "Net 30",
      isActive: supplier.isActive !== undefined ? supplier.isActive : true,
      notes: supplier.notes || "",
    });
    setModalOpen(true);
  };

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    
    const supplier = suppliers.find(s => s._id === id);
    const supplierName = supplier?.name || 'this supplier';
    
    const { confirm } = await import('../../utils/confirm');
    const confirmed = await confirm(
      `Are you sure you want to PERMANENTLY DELETE "${supplierName}"?\n\nThis action cannot be undone.`,
      {
        title: 'Delete Supplier',
        warningMessage: 'WARNING: PERMANENTLY DELETE',
        danger: true,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );
    
    if (!confirmed) return;
    
    try {
      await deleteSupplier(id);
      alert("Supplier deleted successfully!");
      fetchSuppliers();
    } catch (error) {
      alert(`Failed to delete supplier: ${error.response?.data?.message || error.message}`);
    }
  };

  const stats = {
    total: suppliers.length,
    active: suppliers.filter((s) => s.isActive).length,
    withPhone: suppliers.filter((s) => s.contact?.phone).length,
    withEmail: suppliers.filter((s) => s.contact?.email).length,
  };

  if (loading) {
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <div className="text-center py-12 text-sm sm:text-base">Loading suppliers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">Suppliers</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage vendor contacts and terms</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            resetForm();
            setModalOpen(true);
          }}
          className="bg-gradient-to-r from-[#d86d2a] to-[#c75b1a] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto"
        >
          <FaPlus /> Add Supplier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Total Suppliers</p>
            <FaBuilding className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">Active</p>
            <FaCheck className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.active}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">With Phone</p>
            <FaPhoneAlt className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.withPhone}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs sm:text-sm opacity-90">With Email</p>
            <FaEnvelope className="text-lg sm:text-xl" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold">{stats.withEmail}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Contact</th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Address</th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Payment Terms</th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {suppliers.map((supplier) => (
                <tr key={supplier._id}>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 font-medium text-xs sm:text-sm">
                    <div className="truncate max-w-[120px] sm:max-w-none">{supplier.name}</div>
                    <div className="text-[10px] sm:text-xs text-gray-500 md:hidden mt-1">
                      {supplier.contact?.phone && <div>{supplier.contact.phone}</div>}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hidden md:table-cell">
                    <div className="text-xs sm:text-sm">
                      {supplier.contact?.phone && <div>{supplier.contact.phone}</div>}
                      {supplier.contact?.email && <div className="text-gray-500">{supplier.contact.email}</div>}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hidden lg:table-cell">
                    <div className="text-xs sm:text-sm">
                      {supplier.address?.city && supplier.address?.state && (
                        <div>{supplier.address.city}, {supplier.address.state}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 hidden xl:table-cell text-xs sm:text-sm">{supplier.paymentTerms}</td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs ${supplier.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {supplier.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
                    <div className="flex gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(supplier)}
                        className="text-yellow-600 hover:text-yellow-800 p-1"
                        title="Edit"
                      >
                        <FaEdit className="text-sm sm:text-base" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, supplier._id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete"
                      >
                        <FaTrash className="text-sm sm:text-base" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">{editing ? "Edit Supplier" : "Add Supplier"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.contact.phone}
                    onChange={(e) => setFormData({
                      ...formData,
                      contact: { ...formData.contact, phone: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.contact.email}
                    onChange={(e) => setFormData({
                      ...formData,
                      contact: { ...formData.contact, email: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contact.person}
                  onChange={(e) => setFormData({
                    ...formData,
                    contact: { ...formData.contact, person: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => setFormData({
                    ...formData,
                    address: { ...formData.address, street: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.address.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, city: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.address.state}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, state: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                  <input
                    type="text"
                    value={formData.address.zipCode}
                    onChange={(e) => setFormData({
                      ...formData,
                      address: { ...formData.address, zipCode: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="COD">COD</option>
                  <option value="Net 15">Net 15</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Advance">Advance</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <label className="text-sm font-medium text-gray-700">Active</label>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditing(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a]"
                >
                  {editing ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;




