import React, { useEffect, useState } from "react";
import {
  getInventoryTransactions,
  consumeInventory,
  returnToInventory,
  getIngredients,
} from "../../services/costingV2Api";
import { FaPlus, FaFilter, FaSearch, FaExclamationTriangle, FaUndo } from "react-icons/fa";
import OutletFilter from "../../components/costing-v2/OutletFilter";
import { formatUnit, convertUnit } from "../../utils/unitConverter";

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

  useEffect(() => {
    fetchData();
  }, [selectedOutlet]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = selectedOutlet ? { cartId: selectedOutlet } : {};
      const [transactionsRes, ingredientsRes] = await Promise.all([
        getInventoryTransactions(params),
        getIngredients(params),
      ]);
      if (transactionsRes.data.success) setTransactions(transactionsRes.data.data);
      if (ingredientsRes.data.success) setIngredients(ingredientsRes.data.data);
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
      await consumeInventory({
        ...formData,
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
      alert(`Failed to consume inventory: ${error.response?.data?.message || error.message}`);
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
        qty: returnFormData.qty,
        uom: returnFormData.uom,
        refType: "return",
        notes: returnFormData.notes || "Unused ingredients returned to inventory",
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
      alert(`Failed to return inventory: ${error.response?.data?.message || error.message}`);
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
  const categories = ["all", ...new Set(ingredients.map((ing) => ing.category || "Other"))];
  const storageLocations = ["all", ...new Set(ingredients.map((ing) => ing.storageLocation || "Dry Storage"))];

  // Filter ingredients
  const filteredIngredients = ingredients.filter((ing) => {
    if (selectedCategory !== "all" && (ing.category || "Other") !== selectedCategory) return false;
    if (selectedStorage !== "all" && (ing.storageLocation || "Dry Storage") !== selectedStorage) return false;
    if (searchTerm && !ing.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
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
  const lowStockItems = ingredients.filter((ing) => ing.qtyOnHand <= ing.reorderLevel).length;
  
  // IMPORTANT: Calculate total value using the SAME filteredIngredients array that's displayed
  // This ensures the total matches the sum of individual stock values
  // Calculate total value - handle null/undefined values and ensure we use valid numbers
  // Only include ingredients with stock > 0 for accurate total value
  // IMPORTANT: This must match the individual stockValue calculation EXACTLY
  const totalValue = filteredIngredients.reduce((sum, ing) => {
    // Use EXACT same calculation as individual stockValue (lines 393-430)
    const qty = Math.abs(Number(ing.qtyOnHand) || 0);
    let cost = Math.abs(Number(ing.currentCostPerBaseUnit) || 0);
    
    // CRITICAL: Apply same cost correction logic as individual stockValue
    // Detect if cost is stored incorrectly (per display unit instead of per base unit)
    if (cost > 0 && ing.baseUnit && ing.uom && ing.baseUnit !== ing.uom) {
      try {
        const baseUnitsPerDisplayUnit = convertUnit(1, ing.uom, ing.baseUnit);
        
        // If cost is very high (> 100) and baseUnit is g/ml, it's likely stored per display unit
        if (cost > 100 && (ing.baseUnit === 'g' || ing.baseUnit === 'ml')) {
          const correctedCost = cost / baseUnitsPerDisplayUnit;
          if (correctedCost > 0.01 && correctedCost < 1000) {
            // Cost is likely stored per display unit - correct it
            if (import.meta.env.DEV) {
              console.warn(`[Total Value] ${ing.name}: Cost correction - ${cost}/${ing.uom} → ${correctedCost.toFixed(4)}/${ing.baseUnit}`);
            }
            cost = correctedCost;
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(`[Total Value] Cost correction error for ${ing.name}:`, error);
        }
      }
    }
    
    // CRITICAL: Skip items with no stock - use same threshold as stockValue (0.0001)
    if (qty < 0.0001) {
      // Debug logging if cost is still > 0 when stock is 0 (this should not happen)
      if (import.meta.env.DEV && cost > 0) {
        console.warn(`[Total Value Bug] ${ing.name}: qty=${qty}, cost=${cost} - skipping from total value`);
      }
      return sum; // Skip items with no stock
    }
    
    // Only calculate if stock > 0 AND cost > 0 (matches stockValue logic)
    if (cost <= 0) {
      return sum; // Skip items with no cost
    }
    
    // Calculate item value: qty (base unit) × cost (per base unit)
    // This matches the individual stockValue calculation exactly
    let itemValue = qty * cost;
    
    // Additional safety check: ensure itemValue is valid and positive
    if (isNaN(itemValue) || itemValue <= 0) {
      if (import.meta.env.DEV) {
        console.warn(`[Total Value] Invalid value for ${ing.name}: qty=${qty}, cost=${cost}, itemValue=${itemValue}`);
      }
      return sum;
    }
    
    // Debug logging in development - show all calculations
    if (import.meta.env.DEV) {
      console.log(`[Total Value] ${ing.name}: ${qty.toFixed(4)} ${ing.baseUnit || 'base'} × ₹${cost.toFixed(4)}/${ing.baseUnit || 'base'} = ₹${itemValue.toFixed(2)}`);
    }
    
    return sum + itemValue;
  }, 0);
  
  // Debug: Log summary
  if (import.meta.env.DEV) {
    const itemsWithStock = filteredIngredients.filter(ing => {
      const qty = Math.abs(Number(ing.qtyOnHand) || 0);
      const cost = Math.abs(Number(ing.currentCostPerBaseUnit) || 0);
      return qty >= 0.0001 && cost > 0;
    }).length;
    console.log(`[Total Value Summary] Total: ₹${totalValue.toFixed(2)}, Items with stock: ${itemsWithStock}/${filteredIngredients.length}`);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Inventory Management</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">Manage all inventory items including ingredients, supplies, and consumables</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
            <button
              onClick={() => setModalOpen(true)}
              className="bg-[#d86d2a] text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-[#c75b1a] flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <FaPlus /> <span className="whitespace-nowrap">Consume Inventory</span>
            </button>
            <button
              onClick={handleReturnClick}
              className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <FaUndo /> <span className="whitespace-nowrap">Return to Inventory</span>
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <OutletFilter selectedOutlet={selectedOutlet} onOutletChange={setSelectedOutlet} />
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
          <div className="text-2xl font-bold text-gray-800">₹{totalValue.toFixed(2)}</div>
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
                  {categories.filter((c) => c !== "all").map((cat) => (
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
                  {storageLocations.filter((s) => s !== "all").map((storage) => (
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
              <div className="text-center py-12 text-gray-500">No items found</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByCategory).map(([category, items]) => (
                  <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-3 font-semibold text-gray-800 border-b border-gray-200">
                      {category} ({items.length} items)
                    </div>
                    <div className="overflow-x-auto -mx-3 sm:mx-0">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Item Name</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Storage</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">UOM</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Stock</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Reorder Level</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Unit Cost</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Total Value</th>
                            <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {items.map((ing) => {
                            // Convert reorderLevel to base unit for comparison if needed
                            const reorderLevelInBaseUnit = ing.baseUnit && ing.baseUnit !== ing.uom
                              ? convertUnit(ing.reorderLevel, ing.uom, ing.baseUnit)
                              : ing.reorderLevel;
                            const isLowStock = ing.qtyOnHand <= reorderLevelInBaseUnit;
                            // Calculate stock value - handle null/undefined values
                            // CRITICAL: Use absolute value and strict comparison to catch edge cases
                            // IMPORTANT: qtyOnHand is ALWAYS in base unit (g, ml, or pcs)
                            // currentCostPerBaseUnit should be per base unit, but might be stored incorrectly
                            // So: stockValue = qtyOnHand (base) × currentCostPerBaseUnit (per base)
                            const qty = Math.abs(Number(ing.qtyOnHand) || 0);
                            let cost = Math.abs(Number(ing.currentCostPerBaseUnit) || 0);
                            
                            // CRITICAL: Detect and correct if cost is stored per display unit instead of per base unit
                            // This happens when cost is stored incorrectly in the database
                            // Example: Cost stored as ₹608.26 per gram (should be ₹0.60826 per gram)
                            if (cost > 0 && ing.baseUnit && ing.uom && ing.baseUnit !== ing.uom) {
                              try {
                                const baseUnitsPerDisplayUnit = convertUnit(1, ing.uom, ing.baseUnit);
                                
                                // If cost is very high (> 100) and baseUnit is g/ml, it's likely stored per display unit
                                // Also check if uom is kg/l - this confirms the mismatch
                                if (cost > 100 && (ing.baseUnit === 'g' || ing.baseUnit === 'ml') && (ing.uom === 'kg' || ing.uom === 'l')) {
                                  const correctedCost = cost / baseUnitsPerDisplayUnit;
                                  if (correctedCost > 0.01 && correctedCost < 1000) {
                                    // Cost is likely stored per display unit - correct it
                                    if (import.meta.env.DEV) {
                                      console.warn(`[Stock Value] ${ing.name}: Cost correction - ${cost.toFixed(6)}/${ing.uom} → ${correctedCost.toFixed(6)}/${ing.baseUnit}`);
                                    }
                                    cost = correctedCost;
                                  } else if (import.meta.env.DEV) {
                                    console.warn(`[Stock Value] ${ing.name}: Cost correction skipped - correctedCost=${correctedCost.toFixed(6)} (outside range 0.01-1000)`);
                                  }
                                } else if (import.meta.env.DEV && cost > 100 && (ing.baseUnit === 'g' || ing.baseUnit === 'ml')) {
                                  console.warn(`[Stock Value] ${ing.name}: Cost correction skipped - cost=${cost}, baseUnit=${ing.baseUnit}, uom=${ing.uom}, condition not met`);
                                }
                              } catch (error) {
                                if (import.meta.env.DEV) {
                                  console.error(`[Stock Value] Cost correction error for ${ing.name}:`, error);
                                }
                              }
                            }
                            
                            // CRITICAL: If stock is 0 or very close to 0, value MUST be 0
                            // This is the absolute rule - check stock FIRST
                            let stockValue = 0;
                            
                            // Only calculate value if stock > 0 AND cost > 0
                            if (qty >= 0.0001 && cost > 0) {
                              stockValue = qty * cost;
                              
                              // Safety check: ensure calculated value is valid
                              if (isNaN(stockValue) || stockValue < 0) {
                                stockValue = 0;
                              }
                              
                              // Debug: Log calculation details for verification
                              if (import.meta.env.DEV) {
                                console.log(`[Stock Value] ${ing.name}: ${qty.toFixed(4)} ${ing.baseUnit || 'base'} × ₹${cost.toFixed(6)}/${ing.baseUnit || 'base'} = ₹${stockValue.toFixed(2)}`);
                              }
                            }
                            
                            // Final safety check - ensure value is 0 if stock is essentially 0
                            // This overrides any previous calculation
                            if (qty < 0.0001) {
                              stockValue = 0;
                            }
                            
                            // Additional check - if cost is 0, value must be 0
                            if (cost <= 0) {
                              stockValue = 0;
                            }
                            
                            // Debug logging for problematic values
                            if (import.meta.env.DEV && qty <= 0 && cost > 0) {
                              console.warn(`[Stock Value Bug] ${ing.name}: qty=${qty}, cost=${cost}, calculated value=${stockValue}`);
                            }
                            return (
                              <tr key={ing._id} className={isLowStock ? "bg-red-50" : ""}>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap font-medium text-sm sm:text-base">
                                  {ing.name}
                                  {isLowStock && (
                                    <FaExclamationTriangle className="inline-block ml-2 text-red-600" title="Low Stock" />
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
                                  <span className={isLowStock ? "text-red-600 font-semibold" : ""}>
                                    {(() => {
                                      // qtyOnHand is always stored in baseUnit (g, ml, or pcs)
                                      // Convert from baseUnit to the ingredient's preferred uom for display
                                      if (ing.baseUnit && ing.uom) {
                                        if (ing.baseUnit !== ing.uom) {
                                          // Convert from base unit to display unit (uom)
                                          const convertedQty = convertUnit(ing.qtyOnHand, ing.baseUnit, ing.uom);
                                          // Format with the ingredient's uom (no auto-conversion, respect the uom setting)
                                          return formatUnit(convertedQty, ing.uom, { autoConvert: false });
                                        } else {
                                          // Same unit, just format it
                                          return formatUnit(ing.qtyOnHand, ing.uom, { autoConvert: false });
                                        }
                                      }
                                      // Fallback
                                      return formatUnit(ing.qtyOnHand || 0, ing.uom || "pcs", { autoConvert: false });
                                    })()}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  {formatUnit(ing.reorderLevel, ing.uom)}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">
                                  {(() => {
                                    const qty = Number(ing.qtyOnHand) || 0;
                                    const baseCost = Number(ing.currentCostPerBaseUnit) || 0;
                                    
                                    // CRITICAL: If stock is 0, cost MUST be 0 (no exceptions)
                                    // This is the absolute rule - check stock FIRST
                                    if (qty <= 0) {
                                      return `₹0.00 / ${ing.uom || ""}`;
                                    }
                                    
                                    // Stock > 0, but check if cost is valid
                                    if (!baseCost || baseCost <= 0) {
                                      return `₹0.00 / ${ing.uom || ""}`;
                                    }
                                    
                                    // IMPORTANT: currentCostPerBaseUnit should be per base unit, but might be stored incorrectly
                                    // If cost is stored per display unit (kg/l) instead of per base unit (g/ml), we need to correct it
                                    // Example: If cost is stored as ₹608.26 per gram (should be ₹0.60826 per gram)
                                    let correctedBaseCost = baseCost;
                                    
                                    // CRITICAL: Apply SAME cost correction logic as stock value and total value
                                    // Detect if cost is stored incorrectly (per display unit instead of per base unit)
                                    if (baseCost > 0 && ing.baseUnit && ing.uom && ing.baseUnit !== ing.uom) {
                                      try {
                                        const baseUnitsPerDisplayUnit = convertUnit(1, ing.uom, ing.baseUnit);
                                        
                                        // If cost is very high (> 100) and baseUnit is g/ml, it's likely stored per display unit
                                        if (baseCost > 100 && (ing.baseUnit === 'g' || ing.baseUnit === 'ml')) {
                                          const correctedCost = baseCost / baseUnitsPerDisplayUnit;
                                          if (correctedCost > 0.01 && correctedCost < 1000) {
                                            // Cost is likely stored per display unit - correct it
                                            if (import.meta.env.DEV) {
                                              console.warn(`[Unit Cost Display] ${ing.name}: Cost correction - ${baseCost.toFixed(6)}/${ing.uom} → ${correctedCost.toFixed(6)}/${ing.baseUnit}`);
                                            }
                                            correctedBaseCost = correctedCost;
                                          }
                                        }
                                      } catch (error) {
                                        if (import.meta.env.DEV) {
                                          console.error(`[Unit Cost Display] Cost correction error for ${ing.name}:`, error);
                                        }
                                      }
                                    }
                                    
                                    // Now convert the corrected base cost to display unit
                                    // costPerDisplayUnit = costPerBaseUnit × (baseUnitsPerDisplayUnit)
                                    // Example: If corrected cost is ₹0.60826/g and uom is kg:
                                    //   baseUnitsPerDisplayUnit = convertUnit(1, "kg", "g") = 1000
                                    //   costPerDisplayUnit = 0.60826 × 1000 = ₹608.26/kg ✓
                                    let costPerDisplayUnit = correctedBaseCost;
                                    
                                    if (ing.baseUnit && ing.uom && ing.baseUnit !== ing.uom) {
                                      try {
                                        // Get conversion factor: how many base units in 1 display unit
                                        const baseUnitsPerDisplayUnit = convertUnit(1, ing.uom, ing.baseUnit);
                                        
                                        // Convert cost from base unit to display unit
                                        costPerDisplayUnit = correctedBaseCost * baseUnitsPerDisplayUnit;
                                        
                                        // Debug logging
                                        if (import.meta.env.DEV) {
                                          console.log(`[Unit Cost Display] ${ing.name}: correctedBaseCost=₹${correctedBaseCost.toFixed(6)}/${ing.baseUnit}, conversionFactor=${baseUnitsPerDisplayUnit}, costPerDisplayUnit=₹${costPerDisplayUnit.toFixed(2)}/${ing.uom}`);
                                        }
                                      } catch (error) {
                                        if (import.meta.env.DEV) {
                                          console.error(`[Unit Cost Display] Conversion error for ${ing.name}:`, error);
                                        }
                                        // Fallback: use corrected base cost directly
                                        costPerDisplayUnit = correctedBaseCost;
                                      }
                                    }
                                    
                                    return `₹${isNaN(costPerDisplayUnit) ? "0.00" : costPerDisplayUnit.toFixed(2)} / ${ing.uom || ""}`;
                                  })()}
                                </td>
                                <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-sm">₹{stockValue.toFixed(2)}</td>
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
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Item</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Category</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Type</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Quantity</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Cost Allocated</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Reference</th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-3 sm:px-6 py-4 text-center text-gray-500 text-sm">
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
                          {txn.refType}
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
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Consume Inventory</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
                <select
                  required
                  value={formData.ingredientId}
                  onChange={(e) => setFormData({ ...formData, ingredientId: e.target.value })}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.qty || ""}
                    onChange={(e) => setFormData({ ...formData, qty: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UOM *</label>
                  <select
                    required
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Type</label>
                <select
                  value={formData.refType}
                  onChange={(e) => setFormData({ ...formData, refType: e.target.value })}
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
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Return Unused Ingredients to Inventory</h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-4">
              Return unused ingredients back to inventory stock. Items will be valued at current weighted average cost.
            </p>
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient *</label>
                <select
                  required
                  value={returnFormData.ingredientId}
                  onChange={(e) => {
                    const selectedIng = ingredients.find(ing => ing._id === e.target.value);
                    setReturnFormData({ 
                      ...returnFormData, 
                      ingredientId: e.target.value,
                      uom: selectedIng?.uom || "kg"
                    });
                  }}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg"
                >
                  <option value="">Select Ingredient</option>
                  {ingredients
                    .filter((ing) => ing.isActive)
                    .map((ing) => (
                      <option key={ing._id} value={ing._id}>
                        {ing.name} ({ing.category || "Other"}) - Stock: {ing.baseUnit && ing.baseUnit !== ing.uom
                          ? formatUnit(convertUnit(ing.qtyOnHand, ing.baseUnit, ing.uom), ing.uom)
                          : formatUnit(ing.qtyOnHand, ing.uom)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Quantity *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={returnFormData.qty || ""}
                    onChange={(e) => setReturnFormData({ ...returnFormData, qty: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <select
                    required
                    value={returnFormData.uom}
                    onChange={(e) => setReturnFormData({ ...returnFormData, uom: e.target.value })}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason/Notes</label>
                <textarea
                  value={returnFormData.notes}
                  onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                  placeholder="e.g., Unused from preparation, Over-ordered, etc."
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>How it works:</strong> The returned quantity will be added back to inventory stock and valued at the current weighted average cost. This does not recalculate the average cost.
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
