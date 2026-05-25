import api from "./api";

const MENU_CACHE_TTL_MS = 10 * 1000;
const cache = new Map();
const pending = new Map();

const stableParamsKey = (params = {}) =>
  JSON.stringify(
    Object.keys(params || {})
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {}),
  );

export const invalidateMenuCache = () => {
  cache.clear();
  pending.clear();
};

export const getMenuCached = async (params = {}, options = {}) => {
  const key = stableParamsKey(params);
  const now = Date.now();
  const cached = cache.get(key);

  if (!options.force && cached && now < cached.expiresAt) {
    return cached.response;
  }

  if (!options.force && pending.has(key)) {
    return pending.get(key);
  }

  const request = api
    .get("/menu", { params })
    .then((response) => {
      cache.set(key, {
        response,
        expiresAt: Date.now() + MENU_CACHE_TTL_MS,
      });
      return response;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, request);
  return request;
};
