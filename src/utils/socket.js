import io from "socket.io-client";
import { getAdminApiOrigin } from "./adminApiOrigin.js";
import { STABILITY_FLAGS, STABILITY_THRESHOLDS } from "./stabilityFlags";

const getApiUrl = () => getAdminApiOrigin();

const getSocketAuthToken = () => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("superAdminToken") ||
    localStorage.getItem("franchiseAdminToken") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token")
  );
};

const roomJoinStats = [];
const reconnectStats = [];
const joinedRooms = new Set();

const trimWindow = (arr, windowMs) => {
  const cutoff = Date.now() - windowMs;
  while (arr.length > 0 && arr[0] < cutoff) {
    arr.shift();
  }
};

const trackRoomJoin = () => {
  if (!STABILITY_FLAGS.ENABLE_STABILITY_OBSERVABILITY) return;
  roomJoinStats.push(Date.now());
  trimWindow(roomJoinStats, 60_000);
  if (roomJoinStats.length > STABILITY_THRESHOLDS.MAX_ROOM_JOINS_PER_MINUTE) {
    console.warn("[SocketStability] Room join amplification detected", {
      joinsPerMinute: roomJoinStats.length,
      threshold: STABILITY_THRESHOLDS.MAX_ROOM_JOINS_PER_MINUTE,
    });
  }
};

const trackReconnect = () => {
  if (!STABILITY_FLAGS.ENABLE_STABILITY_OBSERVABILITY) return;
  reconnectStats.push(Date.now());
  trimWindow(reconnectStats, 60_000);
  if (reconnectStats.length > STABILITY_THRESHOLDS.MAX_RECONNECTS_PER_MINUTE) {
    console.warn("[SocketStability] Reconnect storm risk detected", {
      reconnectsPerMinute: reconnectStats.length,
      threshold: STABILITY_THRESHOLDS.MAX_RECONNECTS_PER_MINUTE,
    });
  }
};

const reconnectJoinGuard = {
  restoring: false,
  restoredAt: 0,
};
let socketEnsureConnectInFlight = false;
let lastEnsureConnectAt = 0;
let ensureConnectCount = 0;
const ENSURE_CONNECT_COOLDOWN_MS = 1200;

const emitJoin = (socket, eventName, roomValue, { force = false } = {}) => {
  const normalizedRoom = String(roomValue || "").trim();
  if (!normalizedRoom || !socket) return false;

  const dedupeKey = `${eventName}|${normalizedRoom}`;
  if (
    STABILITY_FLAGS.ENABLE_SOCKET_ROOM_JOIN_DEDUPE &&
    !force &&
    joinedRooms.has(dedupeKey)
  ) {
    return false;
  }

  socket.emit(eventName, normalizedRoom);
  joinedRooms.add(dedupeKey);
  trackRoomJoin();
  return true;
};

const restoreJoinedRooms = (socket) => {
  if (!socket || reconnectJoinGuard.restoring) return;
  const now = Date.now();
  if (now - reconnectJoinGuard.restoredAt < 1200) return;

  reconnectJoinGuard.restoring = true;
  try {
    for (const key of joinedRooms) {
      const delimiterIndex = key.indexOf("|");
      if (delimiterIndex <= 0 || delimiterIndex >= key.length - 1) continue;
      const eventName = key.slice(0, delimiterIndex);
      const roomValue = key.slice(delimiterIndex + 1);
      socket.emit(eventName, roomValue);
      trackRoomJoin();
    }
    reconnectJoinGuard.restoredAt = Date.now();
  } finally {
    reconnectJoinGuard.restoring = false;
  }
};

export const createSocketConnection = (options = {}) => {
  const apiUrl = getApiUrl();
  const envUrl =
    import.meta.env.VITE_NODE_API_URL ||
    import.meta.env.VITE_PRIMARY_API_URL ||
    "http://localhost:5001";

  const isCrossOrigin =
    typeof window !== "undefined" &&
    window.location.origin !== new URL(apiUrl, window.location.href).origin;

  const isRenderBackend = envUrl.includes("onrender.com");
  const baseTimeout = isRenderBackend ? 120000 : 60000;

  const socketOptions = {
    transports: ["polling", "websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: isRenderBackend ? 2500 : 1000,
    reconnectionDelayMax: isRenderBackend ? 20000 : 10000,
    reconnectionAttempts: Number.parseInt(
      import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS || "40",
      10,
    ),
    randomizationFactor: STABILITY_FLAGS.ENABLE_SOCKET_BACKOFF_JITTER ? 0.6 : 0,
    timeout: baseTimeout,
    connectTimeout: baseTimeout,
    upgradeTimeout: 30000,
    ...options,
  };

  if (!socketOptions.auth?.token) {
    const authToken = getSocketAuthToken();
    if (authToken) {
      socketOptions.auth = {
        ...(socketOptions.auth || {}),
        token: authToken,
      };
    }
  }

  if (isCrossOrigin) {
    socketOptions.withCredentials = true;
  }

  const socket = io(apiUrl, socketOptions);

  let connectionAttempts = 0;
  let lastErrorTime = 0;
  let reconnectCooldownUntil = 0;
  const ERROR_LOG_INTERVAL = 10000;

  socket.on("connect_error", (error) => {
    connectionAttempts += 1;
    trackReconnect();
    socketEnsureConnectInFlight = false;
    const now = Date.now();

    if (
      STABILITY_FLAGS.ENABLE_SOCKET_BACKOFF_JITTER &&
      connectionAttempts > 8 &&
      now > reconnectCooldownUntil
    ) {
      reconnectCooldownUntil = now + 15000;
      socket.io.opts.reconnectionDelay = Math.min(
        30000,
        Number(socket.io.opts.reconnectionDelay || 1000) + 1500,
      );
      socket.io.opts.reconnectionDelayMax = Math.min(
        45000,
        Number(socket.io.opts.reconnectionDelayMax || 10000) + 3000,
      );
    }

    if (now - lastErrorTime < ERROR_LOG_INTERVAL) return;
    lastErrorTime = now;

    if (
      error?.message?.includes("timeout") ||
      error?.type === "TransportError" ||
      error?.message?.includes("xhr poll error")
    ) {
      const backendUrl = apiUrl !== window?.location?.origin ? apiUrl : envUrl;
      console.warn("[Socket] Connection timeout", {
        backendUrl,
        attempt: connectionAttempts,
        isRenderBackend,
      });
      return;
    }

    if (import.meta.env.DEV && connectionAttempts % 3 === 0) {
      console.warn(`[Socket] connect_error attempt=${connectionAttempts}`, error?.message || error?.type);
    }
  });

  socket.on("connect", () => {
    connectionAttempts = 0;
    reconnectCooldownUntil = 0;
    socketEnsureConnectInFlight = false;
    if (import.meta.env.DEV) {
      console.log(`[Socket] connected id=${socket.id}`);
    }
    restoreJoinedRooms(socket);
  });

  socket.on("reconnect", (attemptNumber) => {
    trackReconnect();
    restoreJoinedRooms(socket);
    if (import.meta.env.DEV) {
      console.log(`[Socket] reconnected after attempts=${attemptNumber}`);
    }
  });

  socket.on("disconnect", (reason) => {
    socketEnsureConnectInFlight = false;
    if (reason === "io server disconnect") {
      socket.connect();
    }
  });

  return socket;
};

let defaultSocketInstance = null;

export const getSocket = () => {
  if (!defaultSocketInstance) {
    defaultSocketInstance = createSocketConnection();
  }
  return defaultSocketInstance;
};

export const ensureSocketConnected = (reason = "unspecified") => {
  const socket = getSocket();
  if (!socket) return socket;
  if (socket.connected || socket.active) {
    return socket;
  }

  const now = Date.now();
  if (
    socketEnsureConnectInFlight &&
    now - lastEnsureConnectAt < ENSURE_CONNECT_COOLDOWN_MS
  ) {
    return socket;
  }

  if (now - lastEnsureConnectAt < ENSURE_CONNECT_COOLDOWN_MS) {
    return socket;
  }

  socketEnsureConnectInFlight = true;
  lastEnsureConnectAt = now;
  ensureConnectCount += 1;

  if (STABILITY_FLAGS.ENABLE_STABILITY_OBSERVABILITY && import.meta.env.DEV) {
    console.log("[SocketStability] ensureSocketConnected", {
      reason,
      connected: socket.connected,
      active: socket.active,
      ensureConnectCount,
    });
  }

  try {
    socket.connect();
  } catch (error) {
    socketEnsureConnectInFlight = false;
    if (import.meta.env.DEV) {
      console.warn("[SocketStability] ensureSocketConnected failed", {
        reason,
        message: error?.message,
      });
    }
  }

  return socket;
};

export const safeSocketOn = (socket, eventName, handler) => {
  if (!socket || !eventName || typeof handler !== "function") {
    return () => {};
  }

  socket.off(eventName, handler);
  socket.on(eventName, handler);

  if (STABILITY_FLAGS.ENABLE_STABILITY_OBSERVABILITY) {
    const attachedCount = Array.isArray(socket.listeners?.(eventName))
      ? socket.listeners(eventName).length
      : null;
    if (
      Number.isFinite(attachedCount) &&
      attachedCount > STABILITY_THRESHOLDS.MAX_LISTENER_ATTACHES_PER_EVENT
    ) {
      console.warn("[SocketStability] Duplicate listener risk", {
        eventName,
        attachedCount,
        threshold: STABILITY_THRESHOLDS.MAX_LISTENER_ATTACHES_PER_EVENT,
      });
    }
  }

  return () => socket.off(eventName, handler);
};

export const joinSocketRoomOnce = (socket, eventName, roomValue, options = {}) =>
  emitJoin(socket, eventName, roomValue, options);

export const clearJoinedRoomMembership = () => {
  joinedRooms.clear();
};

export const getSocketStabilitySnapshot = () => ({
  activeSocket: Boolean(defaultSocketInstance),
  joinedRoomCount: joinedRooms.size,
  joinsPerMinute: roomJoinStats.length,
  reconnectsPerMinute: reconnectStats.length,
  ensureConnectCount,
  lastEnsureConnectAt,
  ensureConnectInFlight: socketEnsureConnectInFlight,
});

export const disconnectSocket = () => {
  if (defaultSocketInstance) {
    defaultSocketInstance.disconnect();
    defaultSocketInstance = null;
  }
  socketEnsureConnectInFlight = false;
  lastEnsureConnectAt = 0;
  ensureConnectCount = 0;
  clearJoinedRoomMembership();
};
