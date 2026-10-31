import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Stamps the time of the build into the service worker (public/sw.js), so each new version of the portal gets a fresh
// cache and the previous one is deleted instead of piling up on people's phones.
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const file = path.join(outDir, 'sw.js');
      if (fs.existsSync(file)) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/__BUILD_ID__/g, String(Date.now())));
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
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
