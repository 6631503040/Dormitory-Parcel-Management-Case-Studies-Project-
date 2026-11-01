import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Dev requests to /api/* are proxied to the Go backend so the browser sees one origin — the
// session cookie then works exactly as it will in production behind a single reverse proxy,
// with no CORS configuration needed on either side.
const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  // Two pages: the Staff desk (/) and the Resident notification PWA (/resident/). Separate entries
  // keep the Resident bundle free of Staff code, and give the PWA its own manifest and service
  // worker scope (public/resident/).
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        resident: fileURLToPath(new URL('./resident/index.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
