import React, { useEffect, useState } from "react";
import {
  getLabourCosts,
  createLabourCost,
  getOverheads,
  createOverhead,
} from "../../services/costingV2Api";
import { FaPlus } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { useAuth } from "../../context/AuthContext";

const LabourOverhead = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("labour");
  const [labourCosts, setLabourCosts] = useState([]);
  const [overheads, setOverheads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    periodFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    periodTo: new Date().toISOString().split("T")[0],
    amount: 0,
    allocationMethod: "fixed_period",
    category: "other",
    description: "",
  });

  useEffect(() => {
    fetchData();
  }, [selectedOutlet, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedOutlet ? { cartId: selectedOutlet } : {};
      const [labourRes, overheadRes] = await Promise.all([
        getLabourCosts(params),
        getOverheads(params),
      ]);
      if (labourRes.data.success) setLabourCosts(labourRes.data.data);
      if (overheadRes.data.success) setOverheads(overheadRes.data.data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching data:", error);
      }
      alert("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (activeTab === "labour") {
        await createLabourCost(formData);
        alert("Labour cost created successfully!");
      } else {
        await createOverhead(formData);
        alert("Overhead created successfully!");
      }
      setModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      alert(`Failed to save: ${error.response?.data?.message || error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      periodFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      periodTo: new Date().toISOString().split("T")[0],
      amount: 0,
      allocationMethod: "fixed_period",
      category: "other",
      description: "",
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Labour & Overhead</h1>
          <button
            onClick={() => setModalOpen(true)}
            className="bg-[#d86d2a] text-white px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center gap-2"
          >
            <FaPlus /> Add {activeTab === "labour" ? "Labour Cost" : "Overhead"}
          </button>
        </div>
        <div className="flex justify-end">
          <OutletFilter selectedOutlet={selectedOutlet} onOutletChange={setSelectedOutlet} />
        </div>
      </div>

      <div className="mb-4 flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("labour")}
          className={`px-4 py-2 font-medium ${
            activeTab === "labour"
              ? "border-b-2 border-[#d86d2a] text-[#d86d2a]"
              : "text-gray-600"
          }`}
        >
          Labour Costs
        </button>
        <button
          onClick={() => setActiveTab("overhead")}
          className={`px-4 py-2 font-medium ${
            activeTab === "overhead"
              ? "border-b-2 border-[#d86d2a] text-[#d86d2a]"
              : "text-gray-600"
          }`}
        >
          Overheads
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period From</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period To</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allocation Method</th>
              {activeTab === "overhead" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {(activeTab === "labour" ? labourCosts : overheads).map((item) => (
              <tr key={item._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(item.periodFrom).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(item.periodTo).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-semibold">
                  ₹{Number(item.amount || 0).toLocaleString("en-IN")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                    {item.allocationMethod.replace("_", " ")}
                  </span>
                </td>
                {activeTab === "overhead" && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                      {item.category}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4">{item.description || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">
              Add {activeTab === "labour" ? "Labour Cost" : "Overhead"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period From *</label>
                  <input
                    type="date"
                    required
                    value={formData.periodFrom}
                    onChange={(e) => setFormData({ ...formData, periodFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period To *</label>
                  <input
                    type="date"
                    required
                    value={formData.periodTo}
                    onChange={(e) => setFormData({ ...formData, periodTo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Allocation Method *</label>
                <select
                  required
                  value={formData.allocationMethod}
                  onChange={(e) => setFormData({ ...formData, allocationMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="fixed_period">Fixed Per Period</option>
                  <option value="revenue_percent">Revenue Percentage</option>
                  <option value="item_count">Item Count</option>
                </select>
              </div>
              {activeTab === "overhead" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="rent">Rent</option>
                    <option value="utilities">Utilities</option>
                    <option value="insurance">Insurance</option>
                    <option value="marketing">Marketing</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="depreciation">Depreciation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#c75b1a]"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabourOverhead;



