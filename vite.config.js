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
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          icons: ["react-icons"],
        },
      },
    },
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
