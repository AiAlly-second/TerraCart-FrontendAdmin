import { useState, useEffect } from "react";
import { FaPlus, FaEdit, FaTrash, FaSave, FaTimes } from "react-icons/fa";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const toId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value._id || value.id || "";
  return String(value);
};
const sanitizeAddonName = (value) => {
  const normalized = String(value || "")
    .replace(/^\(\s*\+\s*\)\s*/u, "")
    .trim();
  return normalized || "Add-on";
};

const defaultFormData = {
  name: "",
  description: "",
  price: "",
  icon: "",
  sortOrder: 0,
};

const GlobalAddons = () => {
  const { user } = useAuth();
  const isFranchiseAdmin = user?.role === "franchise_admin";

  const [addons, setAddons] = useState([]);
  const [cartOptions, setCartOptions] = useState([]);
  const [selectedCartId, setSelectedCartId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (isFranchiseAdmin) {
      loadFranchiseCarts();
      return;
    }

    loadAddons();
  }, [user, isFranchiseAdmin]);

  const loadFranchiseCarts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get("/users");
      const users = Array.isArray(response.data) ? response.data : [];
      const franchiseId = toId(user?._id);

      const carts = users
        .filter((u) => u?.role === "admin" && toId(u?.franchiseId) === franchiseId)
        .map((u) => ({
          id: toId(u?._id),
          name: u?.cartName || u?.name || "Unnamed Cart",
          code: u?.cartCode || "",
        }));

      setCartOptions(carts);

      if (carts.length === 0) {
        setSelectedCartId("");
        setAddons([]);
        setLoading(false);
        return;
      }

      const validCurrent = carts.some((c) => c.id === selectedCartId);
      const targetCartId = validCurrent ? selectedCartId : carts[0].id;
      setSelectedCartId(targetCartId);
      await loadAddons(targetCartId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load carts");
      setLoading(false);
    }
  };

  const loadAddons = async (targetCartId = "") => {
    try {
      setLoading(true);
      setError(null);

      const params =
        isFranchiseAdmin && targetCartId ? { params: { cartId: targetCartId } } : {};

      const response = await api.get("/addons", params);
      const addonsList = Array.isArray(response?.data?.data)
        ? response.data.data.map((addon) => ({
            ...addon,
            name: sanitizeAddonName(addon?.name),
          }))
        : [];
      setAddons(addonsList);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load add-ons");
    } finally {
      setLoading(false);
    }
  };

  const handleCartChange = async (event) => {
    const cartId = event.target.value;
    setSelectedCartId(cartId);
    if (!cartId) {
      setAddons([]);
      return;
    }
    await loadAddons(cartId);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      alert("Add-on name is required");
      return;
    }

    if (isFranchiseAdmin && !selectedCartId) {
      alert("Please select a cart first");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: sanitizeAddonName(formData.name),
        description: formData.description.trim(),
        price: Number(formData.price) || 0,
        icon: formData.icon || "",
        sortOrder: Number(formData.sortOrder) || 0,
        ...(isFranchiseAdmin ? { cartId: selectedCartId } : {}),
      };

      if (editingId) {
        await api.put(`/addons/${editingId}`, payload);
      } else {
        await api.post("/addons", payload);
      }

      setFormData(defaultFormData);
      setShowForm(false);
      setEditingId(null);
      await loadAddons(selectedCartId);

      alert(editingId ? "Add-on updated successfully!" : "Add-on created successfully!");
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to save add-on");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addon) => {
    setFormData({
      name: sanitizeAddonName(addon.name),
      description: addon.description || "",
      price: addon.price || 0,
      icon: addon.icon || "",
      sortOrder: addon.sortOrder || 0,
    });
    setEditingId(addon._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await window.confirm(
      "Are you sure you want to delete this add-on?",
    );
    if (!confirmed) return;

    try {
      await api.delete(`/addons/${id}`);
      await loadAddons(selectedCartId);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete add-on");
    }
  };

  const toggleAvailability = async (addon) => {
    try {
      await api.put(`/addons/${addon._id}`, {
        isAvailable: !addon.isAvailable,
      });
      await loadAddons(selectedCartId);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update add-on");
    }
  };

  const handleCancel = () => {
    setFormData(defaultFormData);
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600">Loading add-ons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Global Add-ons</h1>
          <p className="text-gray-600 mt-1">
            {isFranchiseAdmin
              ? "Create and manage add-ons cart-wise for your franchise"
              : "Manage add-ons that customers can add to their orders"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={isFranchiseAdmin && !selectedCartId}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

      {isFranchiseAdmin && (
        <div className="mb-6 bg-white rounded-lg shadow border border-gray-200 p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Cart
          </label>
          <select
            value={selectedCartId}
            onChange={handleCartChange}
            className="w-full md:w-96 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {cartOptions.length === 0 && <option value="">No carts found</option>}
            {cartOptions.map((cart) => (
              <option key={cart.id} value={cart.id}>
                {cart.name}
                {cart.code ? ` (${cart.code})` : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Cart admins can only show or hide these add-ons from their Menu panel.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

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
                  Price (INR)
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
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: e.target.value })
                  }
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

      <div className="bg-white rounded-lg shadow">
        {addons.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">+</div>
            <p className="text-gray-500 text-lg">
              {isFranchiseAdmin && !selectedCartId
                ? "Select a cart to view add-ons"
                : "No add-ons created yet"}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {isFranchiseAdmin && !selectedCartId
                ? "Choose a cart above, then create add-ons."
                : 'Click "Add New" to create your first add-on'}
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
                        {sanitizeAddonName(addon.name)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500">{addon.description || "-"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-green-600">INR {addon.price || 0}</div>
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
