import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { cargarConfigInstalacion } from './lib/config'

// config.json se lee ANTES de pintar nada. Así el resto de la aplicación puede
// consultar la configuración de forma síncrona y no hay un primer render con
// la base de datos aún sin resolver.
cargarConfigInstalacion().finally(() => {
    createRoot(document.getElementById('root')!).render(<App />)
})
