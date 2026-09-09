import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // El sitio se sirve en el dominio propio (public/CNAME -> geohacker.app),
  // asi que la raiz es '/'. Con '/GEOHACKER/' el bundle pedia
  // https://geohacker.app/GEOHACKER/assets/... y devolvia 404.
  base: '/',
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
          'vendor-google-maps': ['@vis.gl/react-google-maps'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-data': ['date-fns', 'zustand', '@supabase/supabase-js']
        }
      }
    }
  }
})
