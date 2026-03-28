import { defineConfig } from 'vite'

export default defineConfig({
  // Development server configuration
  server: {
    port: 3000,
    open: true, // Automatically open browser
    host: true  // Allow external connections
  },
  
  // Build configuration
  build: {
    outDir: 'dist'
  },
  
  // Asset handling
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  
  // Enable source maps for debugging
  css: {
    devSourcemap: true
  },
  
  // Optimization
  optimizeDeps: {
    include: ['three']
  }
})