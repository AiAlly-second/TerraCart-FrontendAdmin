import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devBackendHost = env.VITE_DEV_BACKEND_HOST || "127.0.0.1";
  const devBackendPort = env.VITE_DEV_BACKEND_PORT || "5001";
  const devBackendTarget =
    env.VITE_DEV_BACKEND_TARGET || `http://${devBackendHost}:${devBackendPort}`;

  return {
    base: "/",
    plugins: [react(), tailwindcss()],
    build: {
      outDir: "dist",
      sourcemap: false,
      minify: "esbuild", // Use esbuild (built-in) instead of terser for better deployment compatibility
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
      // Optimize build performance
      target: "esnext",
      cssCodeSplit: true,
      // Optimize chunk size warning limit
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 5174,
      strictPort: false,
      proxy: {
        // Proxy Socket.IO requests to avoid CORS issues in development
        "/socket.io": {
          target: devBackendTarget,
          changeOrigin: true,
          ws: true, // Enable WebSocket proxying
          secure: false,
          rewrite: (path) => path, // Don't rewrite the path
        },
        // Proxy API requests
        "/api": {
          target: devBackendTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
        },
      },
    },
    preview: {
      port: 4174,
      strictPort: false,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.js",
      css: true,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
      },
    },
  };
});
