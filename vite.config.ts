import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
          'vendor-maps': ['leaflet', 'react-leaflet', '@vis.gl/react-google-maps'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-data': ['date-fns', 'zustand', '@supabase/supabase-js']
        }
      }
    }
  }
})
