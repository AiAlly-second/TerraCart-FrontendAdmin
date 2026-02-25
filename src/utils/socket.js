import io from "socket.io-client";

/**
 * Get the API URL from environment variable
 * In development, we can use the Vite proxy to avoid CORS issues
 */
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_NODE_API_URL;

  // In development mode, check if we should use the Vite proxy
  // The proxy is configured in vite.config.js to forward /socket.io to the backend
  if (import.meta.env.DEV && typeof window !== "undefined") {
    // Use proxy if explicitly enabled, disabled, or if connecting to remote backend
    // Default to using proxy for remote backends to avoid CORS and connection issues
    const explicitlyDisabled = import.meta.env.VITE_USE_PROXY === "false";
    const explicitlyEnabled = import.meta.env.VITE_USE_PROXY === "true";
    const isRemoteBackend =
      envUrl &&
      (envUrl.includes("onrender.com") ||
        envUrl.includes("herokuapp.com") ||
        envUrl.includes("vercel.app") ||
        envUrl.includes("netlify.app"));

    const useProxy =
      explicitlyEnabled || (!explicitlyDisabled && isRemoteBackend);

    if (useProxy) {
      // Use same origin - Vite proxy will handle forwarding to backend
      // Socket.IO will connect to the same origin, avoiding CORS
      if (import.meta.env.DEV) {
        console.log("[Socket] Using Vite proxy to avoid CORS issues");
      }
      return window.location.origin; // e.g., "http://localhost:5174"
    }
  }

  return envUrl || "http://localhost:5001";
};

const getSocketAuthToken = () => {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("superAdminToken") ||
    localStorage.getItem("franchiseAdminToken") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token")
  );
};

/**
 * Create and configure a Socket.IO connection
 * This handles cross-origin connections properly
 */
export const createSocketConnection = (options = {}) => {
  const apiUrl = getApiUrl();
  const envUrl = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";

  // Determine if we're connecting to a different origin (cross-origin)
  const isCrossOrigin =
    typeof window !== "undefined" &&
    window.location.origin !== new URL(apiUrl, window.location.href).origin;

  // Check if connecting to Render.com (which can be slow to wake up)
  // Use envUrl to check the actual backend, not the proxied URL
  const isRenderBackend = envUrl.includes("onrender.com");

  // Use longer timeout for remote servers, especially Render.com
  // Render.com free tier can take 30-60 seconds to wake up from sleep
  const baseTimeout = isRenderBackend ? 120000 : 60000; // 120s for Render, 60s for others

  // Configure Socket.IO with proper options for cross-origin connections
  const socketOptions = {
    // Try polling first for better compatibility, then upgrade to websocket
    transports: ["polling", "websocket"],
    // Enable auto-connect
    autoConnect: true,
    // Reconnection options - more aggressive for remote servers
    reconnection: true,
    reconnectionDelay: isRenderBackend ? 2000 : 1000,
    reconnectionDelayMax: isRenderBackend ? 10000 : 5000,
    reconnectionAttempts: isRenderBackend ? 10 : 5,
    // Timeout for connection - increased for remote servers
    // This gives enough time for slow networks or high latency connections
    timeout: baseTimeout,
    // Connection timeout for initial handshake
    connectTimeout: baseTimeout,
    // Upgrade timeout - time to wait for transport upgrade
    upgradeTimeout: 30000,
    // For cross-origin connections, ensure proper handshake
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

  // If cross-origin, add withCredentials for cookies/auth
  if (isCrossOrigin) {
    socketOptions.withCredentials = true;
  }

  if (import.meta.env.DEV) {
    console.log(`[Socket] Connecting to: ${apiUrl}`, {
      isCrossOrigin,
      isRenderBackend,
      timeout: baseTimeout,
      options: socketOptions,
    });
  }

  const socket = io(apiUrl, socketOptions);

  // Track connection attempts to avoid spam
  let connectionAttempts = 0;
  let lastErrorTime = 0;
  const ERROR_LOG_INTERVAL = 10000; // Only log detailed errors every 10 seconds

  // Add error handlers
  socket.on("connect_error", (error) => {
    connectionAttempts++;
    const now = Date.now();
    const shouldLogDetailed = now - lastErrorTime > ERROR_LOG_INTERVAL;

    if (shouldLogDetailed) {
      lastErrorTime = now;

      // Handle timeout errors specifically
      if (
        error.message?.includes("timeout") ||
        error.type === "TransportError" ||
        error.message?.includes("xhr poll error")
      ) {
        const backendUrl =
          apiUrl !== window?.location?.origin ? apiUrl : envUrl;
        if (import.meta.env.DEV) {
          console.warn(
            `[Socket] Connection Timeout (Attempt ${connectionAttempts})!\n` +
              `Connecting to: ${backendUrl}\n` +
              (apiUrl !== window?.location?.origin
                ? `(via proxy: ${apiUrl})\n`
                : "") +
              (isRenderBackend
                ? "⏳ Render.com servers may take 30-60s to wake up from sleep. Please wait...\n"
                : "") +
              `\n🔧 Solutions:\n` +
              `1. Check if backend server is running\n` +
              `2. Verify network connectivity\n` +
              `3. For Render.com: Server may be sleeping (free tier)\n` +
              `4. Check API URL in .env file\n` +
              (apiUrl === window?.location?.origin
                ? `5. Proxy is enabled - connection will retry automatically\n`
                : `5. Try setting VITE_USE_PROXY=true in .env to use Vite proxy\n`)
          );
        }
      } else if (
        error.message?.includes("CORS") ||
        error.message?.includes("Not allowed by CORS")
      ) {
        const backendUrl =
          apiUrl !== window?.location?.origin ? apiUrl : envUrl;
        if (import.meta.env.DEV) {
          console.error(
            "[Socket] CORS Error Detected!\n" +
              `Frontend: ${
                typeof window !== "undefined" ? window.location.origin : "N/A"
              }\n` +
              `Backend: ${backendUrl}\n` +
              (apiUrl !== window?.location?.origin
                ? `(via proxy: ${apiUrl})\n`
                : "") +
              `\n🔧 Solutions:\n` +
              (apiUrl === window?.location?.origin
                ? "1. Proxy is enabled - this shouldn't happen. Check Vite proxy config.\n"
                : "1. Set VITE_USE_PROXY=true in .env (recommended for dev)\n") +
              "2. Add your origin to backend CORS settings\n" +
              "3. Restart dev server after changing .env"
          );
        }
      } else {
        // Other connection errors - log less frequently
        if (import.meta.env.DEV && connectionAttempts % 3 === 0) {
          console.warn(
            `[Socket] Connection error (attempt ${connectionAttempts}):`,
            error.message || error.type
          );
        }
      }
    }
  });

  socket.on("connect", () => {
    connectionAttempts = 0; // Reset on successful connection
    if (import.meta.env.DEV) {
      console.log(`[Socket] ✅ Connected successfully (ID: ${socket.id})`);
    }
  });

  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") {
      // Server disconnected the client, reconnect manually
      if (import.meta.env.DEV) {
        console.warn("[Socket] Server disconnected. Reconnecting...");
      }
      socket.connect();
    } else {
      if (import.meta.env.DEV) {
        console.log(`[Socket] Disconnected: ${reason}`);
      }
    }
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    if (import.meta.env.DEV && (attemptNumber % 3 === 0 || attemptNumber === 1)) {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}...`);
    }
  });

  socket.on("reconnect", (attemptNumber) => {
    if (import.meta.env.DEV) {
      console.log(`[Socket] ✅ Reconnected after ${attemptNumber} attempts`);
    }
  });

  socket.on("reconnect_failed", () => {
    if (import.meta.env.DEV) {
      console.error(
        "[Socket] ❌ Reconnection failed after all attempts.\n" +
          "Please refresh the page or check your network connection."
      );
    }
  });

  return socket;
};

/**
 * Default socket instance (singleton pattern)
 * Use this for most cases where you need a shared socket connection
 */
let defaultSocketInstance = null;

export const getSocket = () => {
  if (!defaultSocketInstance) {
    defaultSocketInstance = createSocketConnection();
  }
  return defaultSocketInstance;
};

/**
 * Disconnect the default socket instance
 */
export const disconnectSocket = () => {
  if (defaultSocketInstance) {
    defaultSocketInstance.disconnect();
    defaultSocketInstance = null;
  }
};
