import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Raiz del sitio. Sirve tal cual para un dominio propio y para un servidor
  // propio. Si algun dia se publica en <usuario>.github.io/<repo>/, hay que
  // poner aqui '/<repo>/' Y ademas basename="/<repo>" en el BrowserRouter.
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
