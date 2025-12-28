import React, { useEffect, useState } from "react";
import { getOutlets } from "../../services/costingV2Api";
import { useAuth } from "../../context/AuthContext";

const OutletFilter = ({
  selectedOutlet,
  onOutletChange,
  label = "Filter by Kiosk",
}) => {
  const { user } = useAuth();
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only fetch outlets for franchise_admin and super_admin
    if (user?.role === "franchise_admin" || user?.role === "super_admin") {
      fetchOutlets();
    }
  }, [user]);

  const fetchOutlets = async () => {
    try {
      setLoading(true);
      const res = await getOutlets();
      if (res.data.success) {
        setOutlets(res.data.data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching outlets:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Cart admin (admin role) - don't show filter, they only see their own kiosk
  if (user?.role === "admin") {
    return null;
  }

  // Franchise admin and super admin - show outlet filter
  return (
    <div className="mb-3 sm:mb-4 w-full sm:w-auto min-w-[150px] sm:min-w-[200px]">
      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        value={selectedOutlet || ""}
        onChange={(e) => onOutletChange(e.target.value || null)}
        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
        disabled={loading}
      >
        <option value="">All Kiosks</option>
        {outlets.map((outlet) => (
          <option key={outlet._id} value={outlet._id}>
            {outlet.cafeName || outlet.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default OutletFilter;
