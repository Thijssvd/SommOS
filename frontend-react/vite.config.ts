import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SOMMOS_API_PORT || process.env.API_PORT || 3001}`,
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    port: 4173,
    strictPort: true
  }
}));
