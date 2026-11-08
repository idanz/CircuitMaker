import { defineConfig } from 'vite';
export default defineConfig({
  worker: { format: 'iife' },
  build: { target: 'es2022', chunkSizeWarningLimit: 12000 },
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
});
