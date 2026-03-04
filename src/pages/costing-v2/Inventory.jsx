import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getInventoryTransactions,
  consumeInventory,
  returnToInventory,
  getIngredients,
} from "../../services/costingV2Api";
import {
  FaPlus,
  FaFilter,
  FaSearch,
  FaExclamationTriangle,
  FaUndo,
  FaShoppingCart,
} from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { formatUnit, convertUnit } from "../../utils/unitConverter";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

const parseDateSafely = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toFiniteNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getShelfLifeInfo = (ingredient) => {
  const shelfDays = toFiniteNumberOrNull(ingredient.shelfTimeDays);
  const explicitExpiryDate = parseDateSafely(
    ingredient.expiryDate || ingredient.expiryAt,
  );
  const startDate = parseDateSafely(ingredient.lastReceivedAt);

  let expiryDate = explicitExpiryDate;
  if (!expiryDate && shelfDays !== null && startDate) {
    expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + shelfDays);
  }

  if (!expiryDate) {
    if (shelfDays !== null) {
      return {
        mode: "shelf_only",
        shelfDays,
      };
    }
    return { mode: "none", shelfDays: null };
  }

  const now = new Date();
  const remainingMs = expiryDate.getTime() - now.getTime();
  const remainingMinutes = Math.ceil(remainingMs / ONE_MINUTE_MS);
  const daysRemaining = Math.ceil(remainingMs / ONE_DAY_MS);

  let remainingText = "Expired";
  if (remainingMs > 0 && remainingMinutes < 60) {
    remainingText = `${remainingMinutes} min left`;
  } else if (remainingMs > 0 && remainingMs < ONE_DAY_MS) {
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    remainingText =
      mins === 0
        ? `${hours} hr${hours !== 1 ? "s" : ""} left`
        : `${hours} hr${hours !== 1 ? "s" : ""} ${mins} min left`;
  } else if (remainingMs > 0) {
    remainingText = `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left`;
  }

  return {
    mode: "countdown",
    shelfDays,
    expiryDate,
    remainingMs,
    daysRemaining,
    remainingText,
    status: remainingMs <= 0 ? "expired" : daysRemaining <= 3 ? "near" : "fresh",
  };
};

const Inventory = () => {
  const [ingredients, setIngredients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("stock"); // "stock" or "transactions"
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStorage, setSelectedStorage] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [formData, setFormData] = useState({
    ingredientId: "",
    qty: 0,
    uom: "kg",
    refType: "manual",
  });
  const [returnFormData, setReturnFormData] = useState({
    ingredientId: "",
    qty: 0,
    uom: "kg",
    originalTransactionId: null,
    notes: "",
  });

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const params = selectedOutlet ? { cartId: selectedOutlet } : {};
      const [transactionsRes, ingredientsRes] = await Promise.all([
        getInventoryTransactions(params),
        getIngredients(params),
      ]);
      if (transactionsRes.data.success)
        setTransactions(transactionsRes.data.data);
      if (ingredientsRes.data.success) {
        // DEBUG: Log what we received
        if (import.meta.env.DEV) {
          console.log(
            `[FRONTEND] Received ${ingredientsRes.data.data.length} ingredients`,
          );
          if (ingredientsRes.data.data.length > 0) {
            const sampleIng = ingredientsRes.data.data[0];
            console.log(`[FRONTEND] Sample ingredient:`, {
              name: sampleIng.name,
              qtyOnHand: sampleIng.qtyOnHand,
              currentCostPerBaseUnit: sampleIng.currentCostPerBaseUnit,
              lastPurchaseUnitPrice: sampleIng.lastPurchaseUnitPrice,
              lastPurchaseUom: sampleIng.lastPurchaseUom,
              baseUnit: sampleIng.baseUnit,
              uom: sampleIng.uom,
            });
          }
        }
        setIngredients(ingredientsRes.data.data);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error fetching data:", error);
      }
      if (!silent) {
        alert("Failed to fetch data");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedOutlet]);

  useEffect(() => {
    fetchData();

    // Keep inventory in sync with order/BOM consumption without manual refresh.
    const intervalId = setInterval(() => {
      fetchData({ silent: true });
    }, 10000);

    const handleFocus = () => fetchData({ silent: true });
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchData({ silent: true });
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await consumeInventory({
        ...formData,
        qty: parseFloat(formData.qty) || 0,
        cartId: selectedOutlet,
      });
      alert("Inventory consumed successfully!");
      setModalOpen(false);
      setFormData({
        ingredientId: "",
        qty: 0,
        uom: "kg",
        refType: "manual",
      });
      fetchData();
    } catch (error) {
      alert(
        `Failed to consume inventory: ${error.response?.data?.message || error.message}`,
      );
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();

    if (!returnFormData.ingredientId || returnFormData.qty <= 0) {
      alert("Please select an ingredient and enter a valid quantity.");
      return;
    }

    try {
      await returnToInventory({
        ingredientId: returnFormData.ingredientId,
        qty: parseFloat(returnFormData.qty) || 0,
        uom: returnFormData.uom,
        refType: "return",
        notes:
          returnFormData.notes || "Unused ingredients returned to inventory",
        cartId: selectedOutlet,
      });
      alert("Unused ingredients returned to inventory successfully!");
      setReturnModalOpen(false);
      setReturnFormData({
        ingredientId: "",
        qty: 0,
        uom: "kg",
        originalTransactionId: null,
        notes: "",
      });
      fetchData();
    } catch (error) {
      alert(
        `Failed to return inventory: ${error.response?.data?.message || error.message}`,
      );
    }
  };

  const handleReturnClick = () => {
    // Simple return - just open modal to return unused ingredients
    setSelectedTransaction(null);
    setReturnFormData({
      ingredientId: "",
      qty: 0,
      uom: "kg",
      originalTransactionId: null,
      notes: "",
    });
    setReturnModalOpen(true);
  };

  // Get unique categories
  const categories = [
    "all",
    ...new Set(ingredients.map((ing) => ing.category || "Other")),
  ];
  const storageLocations = [
    "all",
    ...new Set(ingredients.map((ing) => ing.storageLocation || "Dry Storage")),
  ];

  // Filter ingredients
  const filteredIngredients = ingredients.filter((ing) => {
    if (
      selectedCategory !== "all" &&
      (ing.category || "Other") !== selectedCategory
    )
      return false;
    if (
      selectedStorage !== "all" &&
      (ing.storageLocation || "Dry Storage") !== selectedStorage
    )
      return false;
    if (
      searchTerm &&
      !ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    if (showLowStockOnly && ing.qtyOnHand > ing.reorderLevel) return false;
    return true;
  });

  // Group by category
  const groupedByCategory = filteredIngredients.reduce((acc, ing) => {
    const category = ing.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(ing);
    return acc;
  }, {});

  // Calculate statistics
  const totalItems = ingredients.length;
  const lowStockItems = ingredients.filter(
    (ing) => ing.qtyOnHand <= ing.reorderLevel,
  ).length;

  // WEIGHTED AVERAGE: Calculate total value using weighted average costs
  // Formula: totalValue = sum of (qty in base unit × weighted avg cost per base unit) for each ingredient
  // Uses weighted average cost stored in currentCostPerBaseUnit
  const totalValue = filteredIngredients.reduce((sum, ing) => {
    const qty = Number(ing.qtyOnHand) || 0;
    const cost = Number(ing.currentCostPerBaseUnit) || 0;

    // Skip items with no stock or no cost
    if (qty <= 0 || cost <= 0) {
      return sum;
    }

    // Calculate item value: qty (base unit) × cost (per base unit)
    const itemValue = qty * cost;

    // Safety check: ensure itemValue is valid and positive
    if (isNaN(itemValue) || itemValue <= 0) {
      return sum;
    }

    return sum + itemValue;
  }, 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Info banner: Add stock via Purchase Orders */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-blue-800 font-medium">
            To add new stock from suppliers, create a Purchase Order and mark it
            as received.
          </p>
          <p className="text-sm text-blue-600 mt-1">
            The &quot;Return to Inventory&quot; option below is for returning
            unused ingredients from previous consumption only.
          </p>
        </div>
        <Link
          to="/costing-v2/purchases"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
        >
          <FaShoppingCart /> Go to Purchases
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Inventory Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Manage all inventory items including ingredients, supplies, and
              consumables
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => setModalOpen(true)}
              className="bg-[#d86d2a] text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <FaPlus />{" "}
              <span className="whitespace-nowrap">Consume Inventory</span>
            </button>
            <button
              onClick={handleReturnClick}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
              title="Return unused ingredients from previous consumption. For new stock, use Purchase Orders."
            >
              <FaUndo />{" "}
              <span className="whitespace-nowrap">
                Return Unused Ingredients
              </span>
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <OutletFilter
            selectedOutlet={selectedOutlet}
            onOutletChange={setSelectedOutlet}
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Items</div>
          <div className="text-2xl font-bold text-gray-800">{totalItems}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Low Stock Items</div>
          <div className="text-2xl font-bold text-red-600">{lowStockItems}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Inventory Value</div>
          <div className="text-2xl font-bold text-gray-800">
            ₹{Math.round(totalValue)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Active Items</div>
          <div className="text-2xl font-bold text-green-600">
            {ingredients.filter((ing) => ing.isActive).length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("stock")}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === "stock"
                  ? "border-[#d86d2a] text-[#d86d2a]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Stock Levels
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === "transactions"
                  ? "border-[#d86d2a] text-[#d86d2a]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Transactions
            </button>
          </nav>
        </div>

        {/* Filters */}
        {activeTab === "stock" && (
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Categories</option>
                  {categories
                    .filter((c) => c !== "all")
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <select
                  value={selectedStorage}
                  onChange={(e) => setSelectedStorage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Storage Locations</option>
                  {storageLocations
                    .filter((s) => s !== "all")
                    .map((storage) => (
                      <option key={storage} value={storage}>
                        {storage}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="lowStockOnly"
                  checked={showLowStockOnly}
                  onChange={(e) => setShowLowStockOnly(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="lowStockOnly" className="text-sm text-gray-700">
                  Low Stock Only
                </label>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 flex items-center sm:col-span-2 lg:col-span-1">
                Showing {filteredIngredients.length} of {totalItems} items
              </div>
            </div>
          </div>
        )}

        {/* Stock Levels Tab */}
        {activeTab === "stock" && (
          <div className="p-3 sm:p-4">
            {Object.keys(groupedByCategory).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No items found
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByCategory).map(([category, items]) => (
                  <div
                    key={category}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <div className="bg-gray-100 px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">
                      {category} ({items.length} items)
                    </div>
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Item Name
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Storage
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              UOM
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Stock
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Reorder Level
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Weighted Avg Cost
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Total Value
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Shelf Life
                            </th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {items.map((ing) => {
                            // Convert reorderLevel to base unit for comparison if needed
                            const reorderLevelInBaseUnit =
                              ing.baseUnit && ing.baseUnit !== ing.uom
                                ? convertUnit(
                                    ing.reorderLevel,
                                    ing.uom,
                                    ing.baseUnit,
                                  )
                                : ing.reorderLevel;
                            const isLowStock =
                              ing.qtyOnHand <= reorderLevelInBaseUnit;
                            // WEIGHTED AVERAGE: Calculate stock value using weighted average cost from backend
                            // qtyOnHand is ALWAYS in base unit (g, ml, or pcs)
                            // currentCostPerBaseUnit is the weighted average cost per base unit
                            // stockValue = qtyOnHand (base) × currentCostPerBaseUnit (weighted avg per base)
                            const qty = Number(ing.qtyOnHand) || 0;
                            const cost =
                              Number(ing.currentCostPerBaseUnit) || 0;

                            // SIMPLE: Calculate value - stock × cost
                            // If stock is 0 or cost is 0, value is 0
                            let stockValue = 0;
                            if (qty > 0 && cost > 0) {
                              stockValue = qty * cost;
                              // Safety check
                              if (isNaN(stockValue) || stockValue < 0) {
                                stockValue = 0;
                              }
                            }
                            return (
                              <tr
                                key={ing._id}
                                className={isLowStock ? "bg-red-50" : ""}
                              >
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap font-medium text-sm sm:text-base">
                                  {ing.name}
                                  {isLowStock && (
                                    <FaExclamationTriangle
                                      className="inline-block ml-2 text-red-600"
                                      title="Low Stock"
                                    />
                                  )}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                                    {ing.storageLocation || "Dry Storage"}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  {/* Display the preferred unit (uom) for this ingredient */}
                                  {ing.uom}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  <span
                                    className={
                                      isLowStock
                                        ? "text-red-600 font-semibold"
                                        : ""
                                    }
                                  >
                                    {(() => {
                                      // qtyOnHand is always stored in baseUnit (g, ml, or pcs)
                                      // Convert from baseUnit to the ingredient's preferred uom for display
                                      if (ing.baseUnit && ing.uom) {
                                        if (ing.baseUnit !== ing.uom) {
                                          // Convert from base unit to display unit (uom)
                                          const convertedQty = convertUnit(
                                            ing.qtyOnHand,
                                            ing.baseUnit,
                                            ing.uom,
                                          );
                                          // Round to zero decimals as requested
                                          const roundedQty =
                                            Math.round(convertedQty);
                                          // Format with the ingredient's uom (no auto-conversion, respect the uom setting)
                                          return formatUnit(
                                            roundedQty,
                                            ing.uom,
                                            { autoConvert: false },
                                          );
                                        } else {
                                          // Same unit, round to zero decimals and format it
                                          const roundedQty = Math.round(
                                            ing.qtyOnHand || 0,
                                          );
                                          return formatUnit(
                                            roundedQty,
                                            ing.uom,
                                            { autoConvert: false },
                                          );
                                        }
                                      }
                                      // Fallback - round to zero decimals
                                      const roundedQty = Math.round(
                                        ing.qtyOnHand || 0,
                                      );
                                      return formatUnit(
                                        roundedQty,
                                        ing.uom || "pcs",
                                        { autoConvert: false },
                                      );
                                    })()}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  {formatUnit(ing.reorderLevel, ing.uom)}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  {(() => {
                                    // WEIGHTED AVERAGE: Use weighted average cost from currentCostPerBaseUnit
                                    const qty = Number(ing.qtyOnHand) || 0;

                                    // CRITICAL: If stock is 0, cost MUST be 0 (no exceptions)
                                    if (qty <= 0) {
                                      return `₹0 / ${ing.uom || ""}`;
                                    }

                                    // Use weighted average cost (stored in currentCostPerBaseUnit)
                                    // This is calculated as: (Existing Stock Qty × Existing Avg Cost + New Purchase Qty × New Purchase Cost) / (Existing Stock Qty + New Purchase Qty)
                                    const baseCost =
                                      Number(ing.currentCostPerBaseUnit) || 0;
                                    let unitPrice = 0;
                                    let displayUom = ing.uom || "";

                                    if (
                                      baseCost > 0 &&
                                      ing.baseUnit &&
                                      ing.uom
                                    ) {
                                      try {
                                        // Convert weighted average cost from base unit to display unit
                                        // Formula: cost per display unit = cost per base unit × (base units per display unit)
                                        // Example: If weighted avg cost is ₹0.22/g (base) and uom is kg, we need ₹220/kg
                                        // convertUnit(1, "kg", "g") = 1000 (how many grams in 1 kg)
                                        // So: 0.22 × 1000 = 220
                                        const baseUnitsPerDisplayUnit =
                                          convertUnit(1, ing.uom, ing.baseUnit);
                                        unitPrice =
                                          baseCost * baseUnitsPerDisplayUnit;
                                        displayUom = ing.uom;
                                      } catch (error) {
                                        unitPrice = 0;
                                      }
                                    }

                                    // Round to 2 decimals for better precision (weighted average can have decimals)
                                    return `₹${isNaN(unitPrice) ? "0.00" : unitPrice.toFixed(2)} / ${displayUom}`;
                                  })()}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  ₹{Math.round(stockValue)}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 text-sm text-gray-700">
                                  {(() => {
                                    const shelfInfo = getShelfLifeInfo(ing);
                                    if (shelfInfo.mode === "countdown") {
                                      const statusClass =
                                        shelfInfo.status === "expired"
                                          ? "text-red-600"
                                          : shelfInfo.status === "near"
                                          ? "text-amber-600"
                                          : "text-green-700";
                                      return (
                                        <span className="block">
                                          <span className={`${statusClass} font-medium`}>
                                            {shelfInfo.remainingText}
                                          </span>
                                          <span className="block text-xs text-gray-500 mt-0.5">
                                            Expires {shelfInfo.expiryDate.toLocaleString()}
                                            {shelfInfo.shelfDays != null ? (
                                              <>
                                                {" "}- Shelf: {shelfInfo.shelfDays} day
                                                {shelfInfo.shelfDays !== 1 ? "s" : ""}
                                              </>
                                            ) : null}
                                          </span>
                                        </span>
                                      );
                                    }
                                    if (shelfInfo.mode === "shelf_only") {
                                      return (
                                        <span className="block">
                                          <span>
                                            Shelf: {shelfInfo.shelfDays} day
                                            {shelfInfo.shelfDays !== 1 ? "s" : ""}
                                          </span>
                                          <span className="block text-xs text-gray-500 mt-0.5">
                                            - Set start date (receive/return stock) to
                                            see countdown
                                          </span>
                                        </span>
                                      );
                                    }
                                    return "-";
                                  })()}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  <span
                                    className={`px-2 py-1 rounded text-xs ${
                                      ing.isActive
                                        ? "bg-green-100 text-green-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {ing.isActive ? "Active" : "Inactive"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="p-3 sm:p-4">
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Item
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Category
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Type
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Quantity
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Cost Allocated
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Reference
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="px-3 sm:px-6 py-4 text-center text-gray-500 text-sm"
                      >
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    transactions.map((txn) => (
                      <tr key={txn._id}>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                          {new Date(txn.date).toLocaleDateString()}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap font-medium text-sm">
                          {txn.ingredientId?.name || "N/A"}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            {txn.ingredientId?.category || "Other"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              txn.type === "IN"
                                ? "bg-green-100 text-green-800"
                                : txn.type === "OUT"
                                  ? "bg-red-100 text-red-800"
                                  : txn.type === "WASTE"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : txn.type === "RETURN"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {txn.type}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                          {formatUnit(txn.qty, txn.uom)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                          ₹{Number(txn.costAllocated || 0).toFixed(2)}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                          {txn.refType === "order"
                            ? `Order: ${txn.refId || "-"}`
                            : txn.refType}
                        </td>
                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                          {/* Actions column - can be used for future features */}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Consume Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">
              Consume Inventory
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item *
                </label>
                <select
                  required
                  value={formData.ingredientId}
                  onChange={(e) =>
                    setFormData({ ...formData, ingredientId: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg"
                >
                  <option value="">Select Item</option>
                  {ingredients
                    .filter((ing) => ing.isActive)
                    .map((ing) => (
                      <option key={ing._id} value={ing._id}>
                        {ing.name} ({ing.category || "Other"})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.qty || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, qty: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    UOM *
                  </label>
                  <select
                    required
                    value={formData.uom}
                    onChange={(e) =>
                      setFormData({ ...formData, uom: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="bottle">bottle</option>
                    <option value="dozen">dozen</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Type
                </label>
                <select
                  value={formData.refType}
                  onChange={(e) =>
                    setFormData({ ...formData, refType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="manual">Manual</option>
                  <option value="recipe">Recipe</option>
                  <option value="waste">Waste</option>
                  <option value="adjustment">Adjustment</option>
                </select>
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
                  Consume
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal - Simple return unused ingredients */}
      {returnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-4">
              Return Unused Ingredients to Inventory
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">
              Return unused ingredients from previous consumption back to
              inventory. For adding new stock from suppliers, use{" "}
              <Link
                to="/costing-v2/purchases"
                className="text-blue-600 hover:underline font-medium"
              >
                Purchase Orders
              </Link>{" "}
              instead.
            </p>
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredient *
                </label>
                <select
                  required
                  value={returnFormData.ingredientId}
                  onChange={(e) => {
                    const selectedIng = ingredients.find(
                      (ing) => ing._id === e.target.value,
                    );
                    setReturnFormData({
                      ...returnFormData,
                      ingredientId: e.target.value,
                      uom: selectedIng?.uom || "kg",
                    });
                  }}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg"
                >
                  <option value="">Select Ingredient</option>
                  {ingredients
                    .filter((ing) => ing.isActive)
                    .map((ing) => (
                      <option key={ing._id} value={ing._id}>
                        {ing.name} ({ing.category || "Other"}) - Stock:{" "}
                        {ing.baseUnit && ing.baseUnit !== ing.uom
                          ? formatUnit(
                              convertUnit(ing.qtyOnHand, ing.baseUnit, ing.uom),
                              ing.uom,
                            )
                          : formatUnit(ing.qtyOnHand, ing.uom)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Return Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={returnFormData.qty || ""}
                    onChange={(e) =>
                      setReturnFormData({
                        ...returnFormData,
                        qty: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit *
                  </label>
                  <select
                    required
                    value={returnFormData.uom}
                    onChange={(e) =>
                      setReturnFormData({
                        ...returnFormData,
                        uom: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="bottle">bottle</option>
                    <option value="dozen">dozen</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason/Notes
                </label>
                <textarea
                  value={returnFormData.notes}
                  onChange={(e) =>
                    setReturnFormData({
                      ...returnFormData,
                      notes: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                  placeholder="e.g., Unused from preparation, Over-ordered, etc."
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>How it works:</strong> The returned quantity will be
                  added back to inventory stock and valued at the current
                  weighted average cost. This does not recalculate the average
                  cost.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setReturnModalOpen(false);
                    setSelectedTransaction(null);
                    setReturnFormData({
                      ingredientId: "",
                      qty: 0,
                      uom: "kg",
                      originalTransactionId: null,
                      notes: "",
                    });
                  }}
                  className="px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <FaUndo /> Return to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
