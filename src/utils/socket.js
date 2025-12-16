import io from 'socket.io-client';

/**
 * Get the API URL from environment variable
 * In development, we can use the Vite proxy to avoid CORS issues
 */
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_NODE_API_URL;
  
  // In development mode, check if we should use the Vite proxy
  // The proxy is configured in vite.config.js to forward /socket.io to the backend
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Use proxy if explicitly enabled or if connecting to remote backend
    const useProxy = import.meta.env.VITE_USE_PROXY === 'true' || 
                     (envUrl && envUrl.includes('terracart-backendmain-2.onrender.com'));
    
    if (useProxy) {
      // Use same origin - Vite proxy will handle forwarding to backend
      // Socket.IO will connect to the same origin, avoiding CORS
      console.log('[Socket] Using Vite proxy to avoid CORS issues');
      return window.location.origin; // e.g., "http://localhost:5174"
    }
  }
  
  return envUrl || "http://localhost:5001";
};

/**
 * Create and configure a Socket.IO connection
 * This handles cross-origin connections properly
 */
export const createSocketConnection = (options = {}) => {
  const apiUrl = getApiUrl();
  
  // Determine if we're connecting to a different origin (cross-origin)
  const isCrossOrigin = typeof window !== 'undefined' && 
    window.location.origin !== new URL(apiUrl, window.location.href).origin;

  // Configure Socket.IO with proper options for cross-origin connections
  const socketOptions = {
    // Force websocket transport for better cross-origin support
    transports: ['websocket', 'polling'],
    // Enable auto-connect
    autoConnect: true,
    // Reconnection options
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    // Timeout for connection
    timeout: 20000,
    // For cross-origin connections, ensure proper handshake
    ...options,
  };

  // If cross-origin, add withCredentials for cookies/auth
  if (isCrossOrigin) {
    socketOptions.withCredentials = true;
  }

  console.log(`[Socket] Connecting to: ${apiUrl}`, { isCrossOrigin, options: socketOptions });

  const socket = io(apiUrl, socketOptions);

  // Add error handlers
  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
    if (error.message?.includes('CORS') || error.message?.includes('Not allowed by CORS') || error.type === 'TransportError') {
      console.error(
        '[Socket] CORS/Connection Error Detected!\n' +
        `Frontend origin: ${typeof window !== 'undefined' ? window.location.origin : 'N/A'}\n` +
        `Attempting to connect to: ${apiUrl}\n\n` +
        '🔧 Solutions:\n' +
        '1. Use Vite proxy: Set VITE_USE_PROXY=true in .env (recommended for dev)\n' +
        '2. Backend CORS: Add your origin to ALLOWED_ORIGINS on Render\n' +
        '3. See TROUBLESHOOTING_CORS.md for detailed steps'
      );
      
      // If in dev mode and not using proxy, suggest it
      if (import.meta.env.DEV && apiUrl.includes('terracart-backendmain-2.onrender.com')) {
        console.warn(
          '💡 TIP: To avoid CORS in development, add this to your .env file:\n' +
          'VITE_USE_PROXY=true\n' +
          'Then restart your dev server.'
        );
      }
    }
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected successfully:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
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
