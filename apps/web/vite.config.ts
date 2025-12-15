import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
      }
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/svelte')) return 'svelte'
          if (id.includes('node_modules')) return 'vendor'
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@cc/analyzer']
  },
  worker: {
    format: 'es'
  },
  // Add WASM support
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@cc/analyzer': 'cc-analyzer'
    }
  }
})
