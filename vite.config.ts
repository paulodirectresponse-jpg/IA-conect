import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Vitest runs in mode=test. Loading the Workers runtime plugin inside Vitest
  // bootstraps workerd and conflicts with the Node-based unit-test runner.
  plugins: mode === 'test'
    ? [react(), tailwindcss()]
    : [cloudflare(), react(), tailwindcss()],
  // firebase-admin/google-gax still contains a few CommonJS modules that refer to
  // __dirname/__filename during module initialization. Workers runs ESM, so give
  // those compatibility-only references stable virtual values. Firestore itself
  // is configured with preferRest and does not use native gRPC transport.
  define: mode === 'test' ? {} : {
    __dirname: JSON.stringify('/'),
    __filename: JSON.stringify('/worker.js'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
