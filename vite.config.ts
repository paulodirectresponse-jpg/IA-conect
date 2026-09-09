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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
}));
