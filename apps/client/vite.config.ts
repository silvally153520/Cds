import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/ai': {
        target: process.env.AI_WORKER_DEV_URL?.trim() || 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
