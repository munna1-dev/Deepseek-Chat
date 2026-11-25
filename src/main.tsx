window.onerror = function(message, source, lineno, colno, error) { document.body.innerHTML = `<div style="color:red; padding:20px; font-size:20px;"><b>Error:</b> ${message}<br><br>Line: ${lineno}</div>`; };
import { createRoot } from 'react-dom/client'
import { App } from './app/App.js'
import { setupTheme } from './app/theme.js'
import { ensureKatex } from './services/markdown/katex.js'
import './app/theme.css'
import './app/global.css'

ensureKatex()
setupTheme()

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
