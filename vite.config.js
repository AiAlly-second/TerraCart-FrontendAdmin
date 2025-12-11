import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Proxy Socket.IO requests to avoid CORS issues in development
      '/socket.io': {
        target: 'https://terracart-backendmain-2.onrender.com',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
        secure: true,
        rewrite: (path) => path, // Don't rewrite the path
      },
      // Proxy API requests
      '/api': {
        target: 'https://terracart-backendmain-2.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
      },
    },
  },
})

