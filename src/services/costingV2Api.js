import api from "../utils/api";

// ==================== SUPPLIERS ====================
export const getSuppliers = (params) =>
  api.get("/costing-v2/suppliers", { params });
export const createSupplier = (data) => api.post("/costing-v2/suppliers", data);
export const updateSupplier = (id, data) =>
  api.put(`/costing-v2/suppliers/${id}`, data);
export const deleteSupplier = (id) => api.delete(`/costing-v2/suppliers/${id}`);

// ==================== INGREDIENTS ====================
export const getIngredients = (params) =>
  api.get("/costing-v2/ingredients", { params });
export const createIngredient = (data) =>
  api.post("/costing-v2/ingredients", data);
export const updateIngredient = (id, data) =>
  api.put(`/costing-v2/ingredients/${id}`, data);
export const deleteIngredient = (id) =>
  api.delete(`/costing-v2/ingredients/${id}`);
export const getFIFOLayers = (id) =>
  api.get(`/costing-v2/ingredients/${id}/fifo-layers`);

// ==================== PURCHASES ====================
export const getPurchases = (params) =>
  api.get("/costing-v2/purchases", { params });
export const createPurchase = (data) => api.post("/costing-v2/purchases", data);
export const receivePurchase = (id) =>
  api.post(`/costing-v2/purchases/${id}/receive`);

// ==================== INVENTORY ====================
export const consumeInventory = (data) =>
  api.post("/costing-v2/inventory/consume", data);
export const returnToInventory = (data) =>
  api.post("/costing-v2/inventory/return", data);
export const getInventoryTransactions = (params) =>
  api.get("/costing-v2/inventory/transactions", { params });
export const diagnoseConsumption = (params) =>
  api.get("/costing-v2/diagnose-consumption", { params });
export const getLowStock = () => api.get("/costing-v2/low-stock");

// ==================== WASTE ====================
export const recordWaste = (data) => api.post("/costing-v2/waste", data);
export const getWaste = (params) => api.get("/costing-v2/waste", { params });

// ==================== RECIPES ====================
export const getRecipes = (params) =>
  api.get("/costing-v2/recipes", { params });
export const createRecipe = (data) => api.post("/costing-v2/recipes", data);
export const updateRecipe = (id, data) =>
  api.put(`/costing-v2/recipes/${id}`, data);
export const deleteRecipe = (id) => api.delete(`/costing-v2/recipes/${id}`);
export const recalculateRecipeCost = (id) =>
  api.post(`/costing-v2/recipes/${id}/calculate-cost`);

// ==================== MENU ITEMS ====================
export const getMenuItems = (params) =>
  api.get("/costing-v2/menu-items", { params });
export const createMenuItem = (data) =>
  api.post("/costing-v2/menu-items", data);
export const updateMenuItem = (id, data) =>
  api.put(`/costing-v2/menu-items/${id}`, data);
export const deleteMenuItem = (id) =>
  api.delete(`/costing-v2/menu-items/${id}`);
export const getDefaultMenuItems = (params) =>
  api.get("/costing-v2/default-menu-items", { params });
export const importFromDefaultMenu = (data) =>
  api.post("/costing-v2/menu-items/import-from-default", data);

// ==================== LABOUR & OVERHEAD ====================
export const getLabourCosts = (params) =>
  api.get("/costing-v2/labour-costs", { params });
export const createLabourCost = (data) =>
  api.post("/costing-v2/labour-costs", data);
export const getOverheads = (params) =>
  api.get("/costing-v2/overheads", { params });
export const createOverhead = (data) => api.post("/costing-v2/overheads", data);

// ==================== REPORTS ====================
export const getFoodCostReport = (params) =>
  api.get("/costing-v2/reports/food-cost", { params });
export const getMenuEngineeringReport = (params) =>
  api.get("/costing-v2/reports/menu-engineering", { params });
export const getSupplierPriceHistory = (params) =>
  api.get("/costing-v2/reports/supplier-price-history", { params });
export const getPnLReport = (params) =>
  api.get("/costing-v2/reports/pnl", { params });

// ==================== EXPENSES ====================
export const getExpenses = (params) =>
  api.get("/costing-v2/expenses", { params });
export const createExpense = (data) => api.post("/costing-v2/expenses", data);
export const updateExpense = (id, data) =>
  api.put(`/costing-v2/expenses/${id}`, data);
export const deleteExpense = (id) => api.delete(`/costing-v2/expenses/${id}`);
export const getExpenseSummary = (params) =>
  api.get("/costing-v2/expenses/summary", { params });
export const getExpenseCategories = () =>
  api.get("/costing-v2/expense-categories");
export const createExpenseCategory = (data) =>
  api.post("/costing-v2/expense-categories", data);

// ==================== SYNC ====================
export const syncMenuItemsFromDefault = (data) =>
  api.post("/costing-v2/menu-items/sync-from-default", data);
export const linkMatchingBoms = (data) =>
  api.post("/costing-v2/menu-items/link-matching-boms", data);

// ==================== OUTLETS ====================
export const getOutlets = () => api.get("/costing-v2/outlets");

// ==================== PUSH ====================
export const pushToCartAdmins = (data) =>
  api.post("/costing-v2/push-to-cart-admins", data);

// ==================== HIERARCHICAL COSTING ====================
export const getHierarchicalCosting = (params) =>
  api.get("/costing-v2/hierarchical-costing", { params });

export default api;
