import { createRoot } from 'react-dom/client'
import { App } from './App'
// Fuentes empaquetadas: la interfaz no pide nada a servidores externos.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-ext-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-ext-600.css'
import '@fontsource/source-serif-4/latin-400.css'
import '@fontsource/source-serif-4/latin-ext-400.css'
import '@fontsource/source-serif-4/latin-500.css'
import '@fontsource/source-serif-4/latin-ext-500.css'
import './style.css'

createRoot(document.getElementById('root')!).render(<App />)
