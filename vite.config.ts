import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineBuild } from './scripts/offline-build';
import { appVersion } from './scripts/app-version';
import { CONFIG } from './src/config';

export default defineConfig({
  plugins: [react(), appVersion(), offlineBuild()],
  server: {
    host: '127.0.0.1',
    port: CONFIG.localApi.developmentPort,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  build: { target: 'es2022' },
});
