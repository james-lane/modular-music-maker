import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineBuild } from './scripts/offline-build';

export default defineConfig({
  plugins: [react(), offlineBuild()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { target: 'es2022' },
});
