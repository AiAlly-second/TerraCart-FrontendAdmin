import api from "../utils/api";

const MENU_DATA_TTL_MS = 10 * 60 * 1000;
const STORAGE_NAMESPACE = "terracart:admin-menu-data:v1";

export const MENU_DATA_RESOURCES = Object.freeze({
  MENU: "menu",
  ADDONS: "addons",
  SPICE_LEVELS: "spice-levels",
  DEFAULT_MENU: "default-menu",
  MODIFIERS_METADATA: "modifiers-metadata",
});

const DEFAULT_SPICE_LEVELS = ["NONE", "MILD", "MEDIUM", "HOT", "EXTREME"];
const memoryCache = new Map();
const inflightRequests = new Map();
const requestVersions = new Map();

let invalidationEpoch = 0;

const diagnostics = {
  memoryHits: 0,
  storageHits: 0,
  misses: 0,
  networkFetches: 0,
  dedupedRequests: 0,
  invalidations: 0,
  staleResponsesDiscarded: 0,
};

const stableParamsKey = (params = {}) =>
  JSON.stringify(
    Object.keys(params || {})
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {}),
  );

const getActiveToken = () => {
  if (typeof window === "undefined") return "";
  try {
    return (
      localStorage.getItem("superAdminToken") ||
      localStorage.getItem("franchiseAdminToken") ||
      localStorage.getItem("adminToken") ||
      ""
    );
  } catch {
    return "";
  }
};

const getAuthScope = () => {
  const token = getActiveToken();
  return token ? `${token.length}:${token.slice(-16)}` : "anonymous";
};

const buildCacheKey = (resource, params = {}) =>
  `${resource}|${getAuthScope()}|${stableParamsKey(params)}`;

const buildStorageKey = (cacheKey) =>
  `${STORAGE_NAMESPACE}:${encodeURIComponent(cacheKey)}`;

const getStorageTargets = () => {
  if (typeof window === "undefined") return [];
  const targets = [];
  try {
    if (window.localStorage) targets.push(window.localStorage);
  } catch {
    // Storage can be unavailable in private browsing or embedded contexts.
  }
  try {
    if (window.sessionStorage) targets.push(window.sessionStorage);
  } catch {
    // Memory cache still covers this session.
  }
  return targets;
};

const isValidEntry = (entry, now = Date.now()) =>
  Boolean(entry && Number(entry.expiresAt) > now);

const readPersistedEntry = (cacheKey) => {
  const storageKey = buildStorageKey(cacheKey);
  for (const storage of getStorageTargets()) {
    try {
      const raw = storage.getItem(storageKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // Corrupt cache entries are ignored and replaced on the next fetch.
    }
  }
  return null;
};

const writePersistedEntry = (cacheKey, entry) => {
  const storageKey = buildStorageKey(cacheKey);
  const payload = JSON.stringify(entry);
  for (const storage of getStorageTargets()) {
    try {
      storage.setItem(storageKey, payload);
    } catch {
      // Cache persistence is best effort; memory cache is still valid.
    }
  }
};

const listPersistedCacheKeys = () => {
  const keys = new Set();
  for (const storage of getStorageTargets()) {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const storageKey = storage.key(index);
        if (!storageKey?.startsWith(`${STORAGE_NAMESPACE}:`)) continue;
        const encodedKey = storageKey.slice(`${STORAGE_NAMESPACE}:`.length);
        try {
          keys.add(decodeURIComponent(encodedKey));
        } catch {
          // Ignore malformed cache keys.
        }
      }
    } catch {
      // Ignore storage enumeration failures.
    }
  }
  return Array.from(keys);
};

const removePersistedEntry = (cacheKey) => {
  const storageKey = buildStorageKey(cacheKey);
  for (const storage of getStorageTargets()) {
    try {
      storage.removeItem(storageKey);
    } catch {
      // Ignore storage removal failures.
    }
  }
};

const normalizeMenu = (payload) => (Array.isArray(payload) ? payload : []);

const normalizeAddons = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.addons)) return payload.addons;
  if (Array.isArray(payload)) return payload;
  return [];
};

const normalizeSpiceLevels = (payload) => {
  if (Array.isArray(payload?.spiceLevels)) return payload.spiceLevels;
  if (Array.isArray(payload)) return payload;
  return DEFAULT_SPICE_LEVELS;
};

const normalizeDefaultMenu = (payload) =>
  payload && typeof payload === "object" ? payload : { categories: [] };

const normalizeModifiersMetadata = (payload) =>
  payload && typeof payload === "object" ? payload : { modifiers: [] };

const readValidCache = (cacheKey) => {
  const now = Date.now();
  const memoryEntry = memoryCache.get(cacheKey);
  if (isValidEntry(memoryEntry, now)) {
    diagnostics.memoryHits += 1;
    return memoryEntry.value;
  }

  const persistedEntry = readPersistedEntry(cacheKey);
  if (isValidEntry(persistedEntry, now)) {
    memoryCache.set(cacheKey, persistedEntry);
    diagnostics.storageHits += 1;
    return persistedEntry.value;
  }

  return undefined;
};

const writeCache = (cacheKey, value, ttlMs = MENU_DATA_TTL_MS) => {
  const entry = {
    value,
    cachedAt: Date.now(),
    expiresAt: Date.now() + Math.max(1000, Number(ttlMs) || MENU_DATA_TTL_MS),
  };
  memoryCache.set(cacheKey, entry);
  writePersistedEntry(cacheKey, entry);
  return value;
};

const getCachedResource = async ({
  resource,
  endpoint,
  params = {},
  normalizer = (payload) => payload,
  options = {},
}) => {
  const {
    force = false,
    ttlMs = MENU_DATA_TTL_MS,
    source = resource,
    fallbackValue,
    allowExpiredOnError = true,
  } = options || {};
  const cacheKey = buildCacheKey(resource, params);

  if (!force) {
    const cached = readValidCache(cacheKey);
    if (cached !== undefined) return cached;
  }

  if (inflightRequests.has(cacheKey)) {
    diagnostics.dedupedRequests += 1;
    return inflightRequests.get(cacheKey);
  }

  diagnostics.misses += 1;
  diagnostics.networkFetches += 1;
  const epochAtStart = invalidationEpoch;
  const requestVersion = (requestVersions.get(cacheKey) || 0) + 1;
  requestVersions.set(cacheKey, requestVersion);

  if (import.meta.env.DEV) {
    console.debug("[menuDataService] fetch", { resource, source, params });
  }

  const request = api
    .get(endpoint, { params })
    .then((response) => {
      const latestVersion = requestVersions.get(cacheKey);
      if (epochAtStart !== invalidationEpoch || latestVersion !== requestVersion) {
        diagnostics.staleResponsesDiscarded += 1;
        return normalizer(response?.data);
      }

      return writeCache(cacheKey, normalizer(response?.data), ttlMs);
    })
    .catch((error) => {
      if (allowExpiredOnError) {
        const expired = memoryCache.get(cacheKey) || readPersistedEntry(cacheKey);
        if (expired?.value !== undefined) return expired.value;
      }
      if (fallbackValue !== undefined) return fallbackValue;
      throw error;
    })
    .finally(() => {
      if (inflightRequests.get(cacheKey) === request) {
        inflightRequests.delete(cacheKey);
      }
    });

  inflightRequests.set(cacheKey, request);
  return request;
};

const forceFor = (options, resource) => {
  if (options?.force) return true;
  return Array.isArray(options?.forceResources)
    ? options.forceResources.includes(resource)
    : false;
};

export const getMenu = (params = {}, options = {}) =>
  getCachedResource({
    resource: MENU_DATA_RESOURCES.MENU,
    endpoint: "/menu",
    params,
    normalizer: normalizeMenu,
    options,
  });

export const getAddons = (params = {}, options = {}) =>
  getCachedResource({
    resource: MENU_DATA_RESOURCES.ADDONS,
    endpoint: "/addons",
    params,
    normalizer: normalizeAddons,
    options,
  });

export const getSpiceLevels = (options = {}) =>
  getCachedResource({
    resource: MENU_DATA_RESOURCES.SPICE_LEVELS,
    endpoint: "/menu/meta/spice-levels",
    normalizer: normalizeSpiceLevels,
    options: {
      fallbackValue: DEFAULT_SPICE_LEVELS,
      ...options,
    },
  });

export const getDefaultMenu = (options = {}) =>
  getCachedResource({
    resource: MENU_DATA_RESOURCES.DEFAULT_MENU,
    endpoint: "/default-menu",
    normalizer: normalizeDefaultMenu,
    options,
  });

export const getModifiersMetadata = (options = {}) => {
  const cacheKey = buildCacheKey(MENU_DATA_RESOURCES.MODIFIERS_METADATA, {});
  if (!options?.force) {
    const cached = readValidCache(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached);
  }

  return Promise.resolve(
    writeCache(
      cacheKey,
      normalizeModifiersMetadata(options?.value),
      options?.ttlMs || MENU_DATA_TTL_MS,
    ),
  );
};

export const getMenuData = async (
  { cartId, includeAddons = true, includeSpiceLevels = true } = {},
  options = {},
) => {
  const params = cartId ? { cartId } : {};
  const [menu, addons, spiceLevels, modifiersMetadata] = await Promise.all([
    getMenu(params, {
      ...options,
      force: forceFor(options, MENU_DATA_RESOURCES.MENU),
      source: options?.source || "menu-data:menu",
    }),
    includeAddons
      ? getAddons(params, {
          ...options,
          force: forceFor(options, MENU_DATA_RESOURCES.ADDONS),
          source: options?.source || "menu-data:addons",
        })
      : Promise.resolve([]),
    includeSpiceLevels
      ? getSpiceLevels({
          ...options,
          force: forceFor(options, MENU_DATA_RESOURCES.SPICE_LEVELS),
          source: options?.source || "menu-data:spice-levels",
        })
      : Promise.resolve(DEFAULT_SPICE_LEVELS),
    getModifiersMetadata({
      ...options,
      force: forceFor(options, MENU_DATA_RESOURCES.MODIFIERS_METADATA),
    }),
  ]);

  return {
    menu,
    categories: menu,
    addons,
    spiceLevels,
    modifiersMetadata,
  };
};

export const invalidateMenuData = ({
  resources = Object.values(MENU_DATA_RESOURCES),
  reason = "manual",
} = {}) => {
  const resourceSet = new Set(resources);
  invalidationEpoch += 1;
  diagnostics.invalidations += 1;

  const shouldRemove = (cacheKey) => {
    const [resource] = String(cacheKey || "").split("|");
    return resourceSet.has(resource);
  };

  for (const key of Array.from(memoryCache.keys())) {
    if (shouldRemove(key)) memoryCache.delete(key);
  }

  for (const key of Array.from(inflightRequests.keys())) {
    if (shouldRemove(key)) inflightRequests.delete(key);
  }

  for (const key of Array.from(requestVersions.keys())) {
    if (shouldRemove(key)) requestVersions.delete(key);
  }

  for (const key of listPersistedCacheKeys()) {
    if (shouldRemove(key)) removePersistedEntry(key);
  }

  if (import.meta.env.DEV) {
    console.info("[menuDataService] invalidated", {
      resources: Array.from(resourceSet),
      reason,
    });
  }
};

export const invalidateMenuOnly = (reason = "menu-update") =>
  invalidateMenuData({
    resources: [MENU_DATA_RESOURCES.MENU],
    reason,
  });

export const invalidateAddonsOnly = (reason = "addons-update") =>
  invalidateMenuData({
    resources: [MENU_DATA_RESOURCES.ADDONS],
    reason,
  });

export const invalidateDefaultMenuOnly = (reason = "default-menu-update") =>
  invalidateMenuData({
    resources: [MENU_DATA_RESOURCES.DEFAULT_MENU],
    reason,
  });

export const clearMenuDataCache = (reason = "logout") =>
  invalidateMenuData({ reason });

export const getMenuDataDiagnostics = () => ({
  ...diagnostics,
  memoryKeys: memoryCache.size,
  inflightKeys: inflightRequests.size,
  invalidationEpoch,
});

const menuDataService = {
  getMenu,
  getAddons,
  getSpiceLevels,
  getDefaultMenu,
  getModifiersMetadata,
  getMenuData,
  invalidateMenuData,
  invalidateMenuOnly,
  invalidateAddonsOnly,
  invalidateDefaultMenuOnly,
  clearMenuDataCache,
  getMenuDataDiagnostics,
};

export default menuDataService;
