import menuDataService from "../services/menuDataService";

const asAxiosLikeResponse = (data) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: {},
  request: null,
});

export const getMenuCached = async (params = {}, options = {}) =>
  asAxiosLikeResponse(await menuDataService.getMenu(params, options));

export const getDefaultMenuCached = async (options = {}) =>
  asAxiosLikeResponse(await menuDataService.getDefaultMenu(options));

export const invalidateMenuCache = (reason = "manual") => {
  menuDataService.invalidateMenuData({ reason });
};

export const invalidateDefaultMenuCache = (reason = "manual") => {
  menuDataService.invalidateDefaultMenuOnly(reason);
};

export const clearMenuCacheOnLogout = () => {
  menuDataService.clearMenuDataCache("logout");
};

export const getMenuCacheDiagnostics = () =>
  menuDataService.getMenuDataDiagnostics();
