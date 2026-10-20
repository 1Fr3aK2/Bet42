/*
vite.config.js — tells Vite how to build/serve this project.
`react()` plugin lets Vite understand JSX and enables Fast Refresh
(hot-reloading that preserves component state) during development.
`tailwindcss()` generates the Tailwind utility classes used in the JSX.
*/
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: smaller chunks, cached separately.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          candles: ['lightweight-charts'],
          realtime: ['socket.io-client'],
        },
      },
    },
  },
});
