import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
        target: "http://localhost:5001",
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
        secure: false,
        rewrite: (path) => path, // Don't rewrite the path
      },
      // Proxy API requests
      "/api": {
        target: "http://localhost:5001",
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
});
