import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true, // Automatically open the app in the browser on server start
  },
  build: {
    outDir: 'dist', // The output directory for the production build
    sourcemap: true, // Generate source maps for debugging
  },
});
