// vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 1. Import the polyfills plugin
import { nodePolyfills } from 'vite-plugin-node-polyfills'; 

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 2. Add the plugin to your plugins array
    nodePolyfills({
      // To make sure 'Buffer' is fully functional, include it explicitly.
      // Setting 'globals.Buffer' to true ensures Buffer is injected correctly.
      globals: {
        Buffer: true,
      },
    }),
  ],
  // 3. Optional: Add global define for robust compatibility
  define: {
    // This helps libraries that expect 'global' or 'process' to be defined
    global: 'globalThis',
    'process.env': {},
  },
});