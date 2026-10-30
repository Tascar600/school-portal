import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // The charts library is by far the biggest part; keep it in its own file so only the pages that draw charts fetch it
      output: { manualChunks: { charts: ['recharts'] } },
    },
    chunkSizeWarningLimit: 600, // the charts file is about 520 kB on purpose
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
});
