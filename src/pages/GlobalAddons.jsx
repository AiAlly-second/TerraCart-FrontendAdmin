import { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const GlobalAddons = () => {
  const { user } = useAuth();
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    icon: "➕",
    sortOrder: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadAddons();
  }, [user]);

  const loadAddons = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[GlobalAddons] Loading add-ons for user:", user?._id, "role:", user?.role);
      const response = await api.get("/addons");
      console.log("[GlobalAddons] Add-ons loaded:", response.data);
      const addonsList = response.data.data || [];
      console.log("[GlobalAddons] Found", addonsList.length, "add-ons");
      if (addonsList.length > 0) {
        console.log("[GlobalAddons] Add-ons cartIds:", addonsList.map(a => ({
          name: a.name,
          cartId: a.cartId?.toString() || a.cartId,
          isAvailable: a.isAvailable
        })));
      }
      setAddons(addonsList);
    } catch (err) {
      console.error("[GlobalAddons] Failed to load add-ons:", err);
      console.error("[GlobalAddons] Error response:", err.response?.data);
      setError(err.response?.data?.message || "Failed to load add-ons");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert("Add-on name is required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number(formData.price) || 0,
        icon: formData.icon || "➕",
        sortOrder: Number(formData.sortOrder) || 0,
      };

      console.log("[GlobalAddons] Submitting add-on:", payload);

      let response;
      if (editingId) {
        response = await api.put(`/addons/${editingId}`, payload);
        console.log("[GlobalAddons] Update response:", response.data);
      } else {
        response = await api.post("/addons", payload);
        console.log("[GlobalAddons] Create response:", response.data);
      }

      // Reset form
      setFormData({
        name: "",
        description: "",
        price: "",
        icon: "➕",
        sortOrder: 0,
      });
      setShowForm(false);
      setEditingId(null);
      
      // Reload list
      await loadAddons();
      
      alert(editingId ? "Add-on updated successfully!" : "Add-on created successfully!");
    } catch (err) {
      console.error("[GlobalAddons] Failed to save add-on:", err);
      console.error("[GlobalAddons] Error response:", err.response?.data);
      console.error("[GlobalAddons] Error status:", err.response?.status);
      alert(err.response?.data?.message || err.message || "Failed to save add-on");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addon) => {
    setFormData({
      name: addon.name,
      description: addon.description || "",
      price: addon.price || 0,
      icon: addon.icon || "➕",
      sortOrder: addon.sortOrder || 0,
    });
    setEditingId(addon._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this add-on?")) return;

    try {
      await api.delete(`/addons/${id}`);
      await loadAddons();
    } catch (err) {
      console.error("Failed to delete add-on:", err);
      alert(err.response?.data?.message || "Failed to delete add-on");
    }
  };

  const toggleAvailability = async (addon) => {
    try {
      await api.put(`/addons/${addon._id}`, {
        isAvailable: !addon.isAvailable,
      });
      await loadAddons();
    } catch (err) {
      console.error("Failed to update add-on:", err);
      alert(err.response?.data?.message || "Failed to update add-on");
    }
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      icon: "➕",
      sortOrder: 0,
    });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading add-ons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Global Add-ons</h1>
          <p className="text-gray-600 mt-1">
            Manage add-ons that customers can add to their orders
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          {showForm ? (
            <>
              <FaTimes /> Cancel
            </>
          ) : (
            <>
              <FaPlus /> Add New
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 bg-white rounded-lg shadow p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">
            {editingId ? "Edit Add-on" : "Create New Add-on"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Extra Napkins"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₹)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="hidden">
                <input
                  type="hidden"
                  value={formData.icon}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <FaSave />
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add-ons List */}
      <div className="bg-white rounded-lg shadow">
        {addons.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">➕</div>
            <p className="text-gray-500 text-lg">No add-ons created yet</p>
            <p className="text-gray-400 text-sm mt-2">
              Click "Add New" to create your first add-on
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>

                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {addons.map((addon) => (
                  <tr key={addon._id} className="hover:bg-gray-50">

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {addon.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">
                        {addon.description || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">
                        ₹{addon.price || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleAvailability(addon)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          addon.isAvailable
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {addon.isAvailable ? "Available" : "Unavailable"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(addon)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edit"
                        >
                          <FaEdit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(addon._id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalAddons;

