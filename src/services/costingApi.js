import api from '../utils/api';

const BASE_PATH = '/admin/costing';

export const costingApi = {
  // Dashboard
  getDashboard: (params = {}) => {
    return api.get(`${BASE_PATH}/dashboard`, { params });
  },

  // Investments
  getInvestments: (params = {}) => {
    return api.get(`${BASE_PATH}/investments`, { params });
  },
  getInvestment: (id) => {
    return api.get(`${BASE_PATH}/investments/${id}`);
  },
  createInvestment: (data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.post(`${BASE_PATH}/investments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateInvestment: (id, data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.put(`${BASE_PATH}/investments/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteInvestment: (id) => {
    return api.delete(`${BASE_PATH}/investments/${id}`);
  },

  // Expenses
  getExpenses: (params = {}) => {
    return api.get(`${BASE_PATH}/expenses`, { params });
  },
  getExpense: (id) => {
    return api.get(`${BASE_PATH}/expenses/${id}`);
  },
  createExpense: (data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.post(`${BASE_PATH}/expenses`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateExpense: (id, data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.put(`${BASE_PATH}/expenses/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteExpense: (id) => {
    return api.delete(`${BASE_PATH}/expenses/${id}`);
  },
  bulkImportExpenses: (expenses) => {
    return api.post(`${BASE_PATH}/expenses/bulk-import`, { expenses });
  },

  // Expense Categories
  getExpenseCategories: () => {
    return api.get(`${BASE_PATH}/expense-categories`);
  },
  createExpenseCategory: (data) => {
    return api.post(`${BASE_PATH}/expense-categories`, data);
  },
  updateExpenseCategory: (id, data) => {
    return api.put(`${BASE_PATH}/expense-categories/${id}`, data);
  },
  deleteExpenseCategory: (id) => {
    return api.delete(`${BASE_PATH}/expense-categories/${id}`);
  },

  // Ingredients
  getIngredients: () => {
    return api.get(`${BASE_PATH}/ingredients`);
  },
  createIngredient: (data) => {
    return api.post(`${BASE_PATH}/ingredients`, data);
  },
  updateIngredient: (id, data) => {
    return api.put(`${BASE_PATH}/ingredients/${id}`, data);
  },
  deleteIngredient: (id) => {
    return api.delete(`${BASE_PATH}/ingredients/${id}`);
  },

  // Recipes
  getRecipes: () => {
    return api.get(`${BASE_PATH}/recipes`);
  },
  getRecipe: (id) => {
    return api.get(`${BASE_PATH}/recipes/${id}`);
  },
  createRecipe: (data) => {
    return api.post(`${BASE_PATH}/recipes`, data);
  },
  updateRecipe: (id, data) => {
    return api.put(`${BASE_PATH}/recipes/${id}`, data);
  },
  deleteRecipe: (id) => {
    return api.delete(`${BASE_PATH}/recipes/${id}`);
  },

  // Inventory Transactions
  adjustInventory: (data) => {
    return api.post(`${BASE_PATH}/inventory/adjust`, data);
  },
  getInventoryTransactions: (params = {}) => {
    return api.get(`${BASE_PATH}/inventory/transactions`, { params });
  },

  // Ingredient Purchases
  getIngredientPurchases: (params = {}) => {
    return api.get(`${BASE_PATH}/ingredient-purchases`, { params });
  },
  createIngredientPurchase: (data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.post(`${BASE_PATH}/ingredient-purchases`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateIngredientPurchase: (id, data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.put(`${BASE_PATH}/ingredient-purchases/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteIngredientPurchase: (id) => {
    return api.delete(`${BASE_PATH}/ingredient-purchases/${id}`);
  },

  // Outlet OPEX
  getOutletOPEX: (params = {}) => {
    return api.get(`${BASE_PATH}/outlet-opex`, { params });
  },
  createOutletOPEX: (data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.post(`${BASE_PATH}/outlet-opex`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateOutletOPEX: (id, data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.put(`${BASE_PATH}/outlet-opex/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteOutletOPEX: (id) => {
    return api.delete(`${BASE_PATH}/outlet-opex/${id}`);
  },

  // Outlet Assets
  getOutletAssets: (params = {}) => {
    return api.get(`${BASE_PATH}/outlet-assets`, { params });
  },
  createOutletAsset: (data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.post(`${BASE_PATH}/outlet-assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updateOutletAsset: (id, data, invoiceFile = null) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    if (invoiceFile) {
      formData.append('invoice', invoiceFile);
    }
    return api.put(`${BASE_PATH}/outlet-assets/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteOutletAsset: (id) => {
    return api.delete(`${BASE_PATH}/outlet-assets/${id}`);
  },

  // Reports
  getPnLReport: (params = {}) => {
    return api.get(`${BASE_PATH}/reports/pnl`, { params, responseType: params.format === 'csv' ? 'blob' : 'json' });
  },
  getROIReport: (params = {}) => {
    return api.get(`${BASE_PATH}/reports/roi`, { params });
  },
  getProfitabilityReport: (params = {}) => {
    return api.get(`${BASE_PATH}/reports/profitability`, { params });
  },
  getCostPerDishReport: (params = {}) => {
    return api.get(`${BASE_PATH}/reports/cost-per-dish`, { params });
  },
};

export default costingApi;




