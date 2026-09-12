import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { config } from './config'
import './index.css'

(window as any).__TYPE_CLUB_SITE_URL__ = config.siteUrl

window.addEventListener('error', (e) => {
  console.error('[UNCAUGHT ERROR]', e.error || e.message, e)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED REJECTION]', e.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
