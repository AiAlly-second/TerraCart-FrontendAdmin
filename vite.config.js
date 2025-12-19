import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
            if (id.includes("react") || id.includes("react-dom")) {
              return "vendor-react";
            }
            if (id.includes("react-router")) {
              return "vendor-router";
            }
            if (id.includes("socket.io-client")) {
              return "vendor-socket";
            }
            if (
              id.includes("react-icons") ||
              id.includes("@heroicons") ||
              id.includes("lucide-react")
            ) {
              return "vendor-icons";
            }
            // All other node_modules
            return "vendor";
          }
          // Page chunks for better code splitting
          if (id.includes("/pages/")) {
            const pageName = id.split("/pages/")[1]?.split("/")[0];
            if (pageName) {
              return `page-${pageName}`;
            }
          }
          // Return undefined for other files (no chunk splitting)
          return undefined;
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
        target: "https://terracart-backendmain-2.onrender.com",
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
        secure: true,
        rewrite: (path) => path, // Don't rewrite the path
      },
      // Proxy API requests
      "/api": {
        target: "https://terracart-backendmain-2.onrender.com",
        changeOrigin: true,
        secure: true,
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
