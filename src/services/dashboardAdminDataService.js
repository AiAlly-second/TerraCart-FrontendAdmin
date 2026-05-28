import api from "../utils/api";
import { getIngredients } from "./costingV2Api";
import { runDedupedRequest, throttleRequest } from "../utils/requestManager";
import { STABILITY_FLAGS } from "../utils/stabilityFlags";

export const DASHBOARD_ADMIN_CORE_SECTIONS = Object.freeze([
  "orders",
  "stats",
  "tables",
  "pendingRequests",
]);

export const DASHBOARD_ADMIN_LAZY_WIDGET_SECTIONS = Object.freeze([
  "ingredients",
  "feedback",
]);

const SECTION_KEYS = Object.freeze([
  ...DASHBOARD_ADMIN_CORE_SECTIONS,
  ...DASHBOARD_ADMIN_LAZY_WIDGET_SECTIONS,
]);

const SECTION_TTLS_MS = Object.freeze({
  orders: 30_000,
  stats: 30_000,
  tables: 30_000,
  pendingRequests: 20_000,
  ingredients: 90_000,
  feedback: 90_000,
});

const DEFAULT_ORDERS_WINDOW_HOURS = 24;
const DEFAULT_ORDERS_LIMIT = 120;
const DEFAULT_WIDGET_SECTION_TTL_MS = 90_000;
const REFRESH_STORM_THRESHOLD_PER_MINUTE = 16;
const ROUTE_REMOUNT_THRESHOLD_PER_MINUTE = 10;
const API_STORM_THRESHOLD_PER_MINUTE = 24;
const WIDGET_REASON_MARKERS = Object.freeze([
  "widget",
  "feedback_card",
  "shelf_tab",
  "shelf_alerts",
  "coalesced_follow_up",
]);

const createEmptySnapshot = () => ({
  orders: [],
  tables: [],
  pendingRequests: [],
  ingredients: [],
  dashboardStats: {},
  feedbackStats: {
    averageRating: 0,
    total: 0,
  },
});

const dashboardRuntime = {
  snapshot: createEmptySnapshot(),
  sectionFetchedAt: Object.create(null),
  inFlight: null,
  pendingSections: new Set(),
  refreshTimestamps: [],
  remountTimestamps: [],
  apiTimestampsByKey: new Map(),
  sectionRequestVersion: Object.create(null),
  diagnostics: {
    refreshCount: 0,
    coalescedRefreshCount: 0,
    socketReconnectCount: 0,
    routeRemountCount: 0,
    cacheServeCount: 0,
    cacheStaleRevalidateCount: 0,
    duplicateRefreshSkipCount: 0,
    inFlightReuseCount: 0,
    warningCount: 0,
    widgetFetchCount: 0,
    ingredientsFetchCount: 0,
    feedbackFetchCount: 0,
    pollingRefreshCount: 0,
    mountRefreshCount: 0,
    oversizedPollingBatchCount: 0,
    lazySectionOutOfBandFetchCount: 0,
    lastRefreshAt: 0,
    lastSuccessAt: 0,
    lastRefreshReasons: [],
  },
};

const observabilityEnabled =
  STABILITY_FLAGS?.ENABLE_STABILITY_OBSERVABILITY !== false;

const trimWindow = (timestamps, windowMs) => {
  const cutoff = Date.now() - windowMs;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
};

const pushReason = (reason) => {
  dashboardRuntime.diagnostics.lastRefreshReasons.push(
    `${new Date().toISOString()}:${String(reason || "unknown")}`,
  );
  if (dashboardRuntime.diagnostics.lastRefreshReasons.length > 24) {
    dashboardRuntime.diagnostics.lastRefreshReasons.shift();
  }
};

const warnStability = (message, meta = {}) => {
  if (!observabilityEnabled) return;
  dashboardRuntime.diagnostics.warningCount += 1;
  console.warn(`[DashboardStability] ${message}`, meta);
};

const isLazyWidgetSection = (sectionKey) =>
  DASHBOARD_ADMIN_LAZY_WIDGET_SECTIONS.includes(sectionKey);

const isWidgetReason = (reason) => {
  const normalizedReason = String(reason || "").trim().toLowerCase();
  if (!normalizedReason) return false;
  return WIDGET_REASON_MARKERS.some((marker) => normalizedReason.includes(marker));
};

const normalizeOrdersArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizeTablesArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.tables)) return payload.tables;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizePendingRequestsArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.requests)) return payload.requests;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizeFeedbackStats = (payload) => {
  const source = payload?.data || payload || {};
  const avg = Number.parseFloat(source.averageRating);
  const total = Number.parseInt(source.total, 10);
  return {
    averageRating: Number.isFinite(avg) ? avg : 0,
    total: Number.isFinite(total) ? total : 0,
  };
};

const trackApiCall = (requestKey) => {
  if (!observabilityEnabled) return;

  if (!dashboardRuntime.apiTimestampsByKey.has(requestKey)) {
    dashboardRuntime.apiTimestampsByKey.set(requestKey, []);
  }

  const timestamps = dashboardRuntime.apiTimestampsByKey.get(requestKey);
  timestamps.push(Date.now());
  trimWindow(timestamps, 60_000);

  if (timestamps.length > API_STORM_THRESHOLD_PER_MINUTE) {
    warnStability("Same API key called repeatedly", {
      requestKey,
      callsPerMinute: timestamps.length,
      threshold: API_STORM_THRESHOLD_PER_MINUTE,
    });
  }
};

const trackRefresh = (reason, sectionList, { reusedInFlight = false } = {}) => {
  dashboardRuntime.diagnostics.refreshCount += 1;
  dashboardRuntime.diagnostics.lastRefreshAt = Date.now();
  if (reusedInFlight) {
    dashboardRuntime.diagnostics.inFlightReuseCount += 1;
  }

  const normalizedReason = String(reason || "").trim().toLowerCase();
  if (normalizedReason === "dashboard_mount") {
    dashboardRuntime.diagnostics.mountRefreshCount += 1;
  }
  if (normalizedReason.includes("dashboard_poll")) {
    dashboardRuntime.diagnostics.pollingRefreshCount += 1;
    const oversizedPoll =
      sectionList.length > DASHBOARD_ADMIN_CORE_SECTIONS.length ||
      sectionList.some((sectionKey) => isLazyWidgetSection(sectionKey));
    if (oversizedPoll) {
      dashboardRuntime.diagnostics.oversizedPollingBatchCount += 1;
      warnStability("Polling requested oversized dashboard section batch", {
        reason,
        sections: sectionList,
      });
    }
  }

  pushReason(reason);

  if (!observabilityEnabled) return;

  dashboardRuntime.refreshTimestamps.push(Date.now());
  trimWindow(dashboardRuntime.refreshTimestamps, 60_000);

  if (dashboardRuntime.refreshTimestamps.length > REFRESH_STORM_THRESHOLD_PER_MINUTE) {
    warnStability("Dashboard refresh storm risk", {
      reason,
      sections: sectionList,
      refreshesPerMinute: dashboardRuntime.refreshTimestamps.length,
      threshold: REFRESH_STORM_THRESHOLD_PER_MINUTE,
    });
  }
};

const markLazyWidgetFetch = (sectionKey, reason) => {
  dashboardRuntime.diagnostics.widgetFetchCount += 1;
  if (sectionKey === "ingredients") {
    dashboardRuntime.diagnostics.ingredientsFetchCount += 1;
  } else if (sectionKey === "feedback") {
    dashboardRuntime.diagnostics.feedbackFetchCount += 1;
  }

  if (isWidgetReason(reason)) return;

  dashboardRuntime.diagnostics.lazySectionOutOfBandFetchCount += 1;
  warnStability("Lazy widget section fetched without widget-triggered reason", {
    sectionKey,
    reason,
  });
};

const getSectionFetchers = () => ({
  orders: async () => {
    const summaryKey = "dashboard_admin:orders_summary";
    trackApiCall(summaryKey);
    await throttleRequest(summaryKey, 350);

    try {
      const response = await runDedupedRequest(summaryKey, () =>
        api.get("/orders/dashboard-summary", {
          params: {
            windowHours: DEFAULT_ORDERS_WINDOW_HOURS,
            limit: DEFAULT_ORDERS_LIMIT,
          },
        }),
      );
      const summary = response?.data?.data || response?.data || {};
      return normalizeOrdersArray(summary.orders || summary);
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      if (import.meta.env.DEV) {
        console.warn(
          "[DashboardAdmin] /orders/dashboard-summary unavailable, using /orders fallback",
        );
      }

      const fallbackKey = "dashboard_admin:orders_fallback";
      trackApiCall(fallbackKey);
      await throttleRequest(fallbackKey, 500);
      const fallback = await runDedupedRequest(fallbackKey, () =>
        api.get("/orders", {
          params: {
            includeHistory: "false",
            lightweight: "true",
            page: 1,
            limit: DEFAULT_ORDERS_LIMIT,
          },
        }),
      );
      return normalizeOrdersArray(fallback?.data);
    }
  },
  stats: async () => {
    const requestKey = "dashboard_admin:stats";
    trackApiCall(requestKey);
    await throttleRequest(requestKey, 250);
    const response = await runDedupedRequest(requestKey, () =>
      api.get("/dashboard/stats"),
    );
    return response?.data?.data ?? response?.data ?? {};
  },
  tables: async () => {
    const requestKey = "dashboard_admin:tables";
    trackApiCall(requestKey);
    await throttleRequest(requestKey, 250);
    const response = await runDedupedRequest(requestKey, () => api.get("/tables"));
    return normalizeTablesArray(response?.data);
  },
  pendingRequests: async () => {
    const requestKey = "dashboard_admin:pending_requests";
    trackApiCall(requestKey);
    await throttleRequest(requestKey, 250);
    const response = await runDedupedRequest(requestKey, () =>
      api.get("/customer-requests/pending"),
    );
    return normalizePendingRequestsArray(response?.data);
  },
  ingredients: async ({ reason } = {}) => {
    markLazyWidgetFetch("ingredients", reason);
    const requestKey = "dashboard_admin:ingredients";
    trackApiCall(requestKey);
    await throttleRequest(requestKey, 500);
    const response = await runDedupedRequest(requestKey, () => getIngredients());
    const raw = response?.data?.data ?? response?.data ?? [];
    return Array.isArray(raw) ? raw : [];
  },
  feedback: async ({ reason } = {}) => {
    markLazyWidgetFetch("feedback", reason);
    const requestKey = "dashboard_admin:feedback";
    trackApiCall(requestKey);
    await throttleRequest(requestKey, 500);
    const response = await runDedupedRequest(requestKey, () =>
      api.get("/feedback/stats"),
    );
    return normalizeFeedbackStats(response?.data);
  },
});

const SECTION_FETCHERS = getSectionFetchers();

const normalizeSections = (sections) => {
  if (!sections) return [...DASHBOARD_ADMIN_CORE_SECTIONS];
  const source = Array.isArray(sections) ? sections : [sections];
  const normalized = source
    .map((value) => String(value || "").trim())
    .filter((value) => SECTION_KEYS.includes(value));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : [];
};

const getSectionTtlMs = (sectionKey) => SECTION_TTLS_MS[sectionKey] || 30_000;

const getSectionAgeMs = (sectionKey) => {
  const lastFetchedAt = dashboardRuntime.sectionFetchedAt[sectionKey] || 0;
  if (!lastFetchedAt) return Number.POSITIVE_INFINITY;
  return Date.now() - lastFetchedAt;
};

const isSectionStale = (sectionKey, ttlMs = null) => {
  const effectiveTtl =
    Number.isFinite(Number(ttlMs)) && Number(ttlMs) > 0
      ? Number(ttlMs)
      : getSectionTtlMs(sectionKey);
  return getSectionAgeMs(sectionKey) >= effectiveTtl;
};

const shouldFetchSection = (sectionKey, force) => {
  if (force) return true;
  return isSectionStale(sectionKey);
};

const mergeSnapshot = (updates) => {
  if (!updates || Object.keys(updates).length === 0) {
    return dashboardRuntime.snapshot;
  }

  dashboardRuntime.snapshot = {
    ...dashboardRuntime.snapshot,
    ...updates,
    dashboardStats: updates.dashboardStats
      ? { ...updates.dashboardStats }
      : { ...dashboardRuntime.snapshot.dashboardStats },
    feedbackStats: updates.feedbackStats
      ? { ...updates.feedbackStats }
      : { ...dashboardRuntime.snapshot.feedbackStats },
  };

  return dashboardRuntime.snapshot;
};

const cloneSnapshot = (snapshot) => ({
  orders: Array.isArray(snapshot?.orders) ? [...snapshot.orders] : [],
  tables: Array.isArray(snapshot?.tables) ? [...snapshot.tables] : [],
  pendingRequests: Array.isArray(snapshot?.pendingRequests)
    ? [...snapshot.pendingRequests]
    : [],
  ingredients: Array.isArray(snapshot?.ingredients) ? [...snapshot.ingredients] : [],
  dashboardStats: { ...(snapshot?.dashboardStats || {}) },
  feedbackStats: {
    averageRating: Number(snapshot?.feedbackStats?.averageRating || 0),
    total: Number(snapshot?.feedbackStats?.total || 0),
  },
});

const queueFollowUpRefresh = (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) return;
  setTimeout(() => {
    refreshDashboardAdminData({
      sections,
      force: true,
      reason: "dashboard_coalesced_follow_up",
    }).catch((error) => {
      if (import.meta.env.DEV) {
        console.warn("[DashboardAdmin] coalesced follow-up failed", error);
      }
    });
  }, 0);
};

export const getDashboardAdminSnapshot = () =>
  cloneSnapshot(dashboardRuntime.snapshot);

export const getDashboardAdminDiagnosticsSnapshot = () => ({
  ...dashboardRuntime.diagnostics,
  inFlight: Boolean(dashboardRuntime.inFlight),
  pendingSections: Array.from(dashboardRuntime.pendingSections),
  lastRefreshReasons: [...dashboardRuntime.diagnostics.lastRefreshReasons],
});

export const recordDashboardAdminMount = () => {
  dashboardRuntime.diagnostics.routeRemountCount += 1;

  if (!observabilityEnabled) return;

  dashboardRuntime.remountTimestamps.push(Date.now());
  trimWindow(dashboardRuntime.remountTimestamps, 60_000);

  if (dashboardRuntime.remountTimestamps.length > ROUTE_REMOUNT_THRESHOLD_PER_MINUTE) {
    warnStability("Route remount refresh loop risk", {
      remountsPerMinute: dashboardRuntime.remountTimestamps.length,
      threshold: ROUTE_REMOUNT_THRESHOLD_PER_MINUTE,
    });
  }
};

export const recordDashboardAdminSocketReconnect = () => {
  dashboardRuntime.diagnostics.socketReconnectCount += 1;
};

export const resolveDashboardAdminSectionsForEvent = (eventName) => {
  const normalized = String(eventName || "").trim().toLowerCase();

  if (
    normalized === "socket_connect" ||
    normalized === "socket_reconnect" ||
    normalized === "connect"
  ) {
    return [...DASHBOARD_ADMIN_CORE_SECTIONS];
  }

  if (
    normalized === "neworder" ||
    normalized === "order:created" ||
    normalized === "order.created" ||
    normalized === "orderupdated" ||
    normalized === "order.updated" ||
    normalized === "order:status:updated" ||
    normalized === "order_status_updated" ||
    normalized === "order:upsert" ||
    normalized === "order:updated" ||
    normalized === "orderdeleted" ||
    normalized === "order:deleted"
  ) {
    return ["orders", "stats"];
  }

  if (
    normalized === "paymentcreated" ||
    normalized === "paymentupdated" ||
    normalized === "payment:created" ||
    normalized === "payment:updated" ||
    normalized === "payment.created" ||
    normalized === "payment.updated"
  ) {
    return ["orders", "stats"];
  }

  if (
    normalized === "table:status:updated" ||
    normalized === "table:updated" ||
    normalized === "table.updated" ||
    normalized === "table_status_updated" ||
    normalized === "table:merged" ||
    normalized === "table:unmerged"
  ) {
    return ["tables"];
  }

  if (
    normalized === "assistance_request_created" ||
    normalized === "customer_request_created" ||
    normalized === "customer_request.updated" ||
    normalized === "customer_request_updated" ||
    normalized === "customer-request-updated" ||
    normalized === "request:updated"
  ) {
    return ["pendingRequests", "stats"];
  }

  if (
    normalized === "feedback:created" ||
    normalized === "feedback.created" ||
    normalized === "feedback.updated" ||
    normalized === "feedback:updated"
  ) {
    return ["feedback"];
  }

  return [];
};

export const refreshDashboardAdminData = async ({
  sections = DASHBOARD_ADMIN_CORE_SECTIONS,
  force = false,
  reason = "manual",
} = {}) => {
  const requestedSections = normalizeSections(sections);
  if (requestedSections.length === 0) {
    dashboardRuntime.diagnostics.cacheServeCount += 1;
    return {
      data: getDashboardAdminSnapshot(),
      fromCache: true,
      sectionsFetched: [],
    };
  }

  if (dashboardRuntime.inFlight) {
    requestedSections.forEach((sectionKey) => {
      dashboardRuntime.pendingSections.add(sectionKey);
    });
    dashboardRuntime.diagnostics.duplicateRefreshSkipCount += 1;
    trackRefresh(reason, requestedSections, { reusedInFlight: true });
    return dashboardRuntime.inFlight;
  }

  const sectionsToFetch = requestedSections.filter((sectionKey) =>
    shouldFetchSection(sectionKey, force),
  );

  if (sectionsToFetch.length === 0) {
    dashboardRuntime.diagnostics.cacheServeCount += 1;
    dashboardRuntime.diagnostics.cacheStaleRevalidateCount += 1;
    trackRefresh(reason, requestedSections);
    return {
      data: getDashboardAdminSnapshot(),
      fromCache: true,
      sectionsFetched: [],
    };
  }

  trackRefresh(reason, sectionsToFetch);

  const refreshPromise = (async () => {
    const updates = {};
    const fetchedSections = [];

    await Promise.all(
      sectionsToFetch.map(async (sectionKey) => {
        const fetcher = SECTION_FETCHERS[sectionKey];
        if (typeof fetcher !== "function") return;

        const requestVersion =
          (dashboardRuntime.sectionRequestVersion[sectionKey] || 0) + 1;
        dashboardRuntime.sectionRequestVersion[sectionKey] = requestVersion;

        try {
          const value = await fetcher({ reason, sectionKey });
          if (requestVersion !== dashboardRuntime.sectionRequestVersion[sectionKey]) {
            return;
          }
          updates[sectionKey === "stats" ? "dashboardStats" : sectionKey] = value;
          dashboardRuntime.sectionFetchedAt[sectionKey] = Date.now();
          fetchedSections.push(sectionKey);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn(`[DashboardAdmin] Failed to refresh section '${sectionKey}'`, error);
          }
          warnStability("Section refresh failed", {
            sectionKey,
            reason,
            message: error?.message,
          });
        }
      }),
    );

    mergeSnapshot(updates);
    dashboardRuntime.diagnostics.lastSuccessAt = Date.now();

    return {
      data: getDashboardAdminSnapshot(),
      fromCache: false,
      sectionsFetched: fetchedSections,
    };
  })()
    .finally(() => {
      dashboardRuntime.inFlight = null;
      if (dashboardRuntime.pendingSections.size > 0) {
        const queuedSections = Array.from(dashboardRuntime.pendingSections);
        dashboardRuntime.pendingSections.clear();
        dashboardRuntime.diagnostics.coalescedRefreshCount += 1;
        queueFollowUpRefresh(queuedSections);
      }
    });

  dashboardRuntime.inFlight = refreshPromise;
  return refreshPromise;
};

export const refreshDashboardAdminWidgetData = async ({
  section,
  force = false,
  ttlMs = DEFAULT_WIDGET_SECTION_TTL_MS,
  reason = "dashboard_widget_manual",
} = {}) => {
  const [sectionKey] = normalizeSections([section]).filter((candidate) =>
    DASHBOARD_ADMIN_LAZY_WIDGET_SECTIONS.includes(candidate),
  );

  const snapshot = getDashboardAdminSnapshot();
  if (!sectionKey) {
    return {
      data: snapshot,
      fromCache: true,
      stale: false,
      sectionsFetched: [],
      refreshPromise: null,
    };
  }

  const stale = force || isSectionStale(sectionKey, ttlMs);
  if (!stale) {
    dashboardRuntime.diagnostics.cacheServeCount += 1;
    return {
      data: snapshot,
      fromCache: true,
      stale: false,
      sectionsFetched: [],
      refreshPromise: null,
    };
  }

  const refreshPromise = refreshDashboardAdminData({
    sections: [sectionKey],
    force: true,
    reason,
  });

  return {
    data: snapshot,
    fromCache: true,
    stale: true,
    sectionsFetched: [],
    refreshPromise,
  };
};
