// Build error fallback DOM safely (no innerHTML — prevents DOM-based XSS)
function renderFatalError(message) {
  const root = document.getElementById('root')
  if (!root || root.hasChildNodes()) return

  const wrapper = document.createElement('div')
  Object.assign(wrapper.style, {
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '40px',
    textAlign: 'center', background: '#080808', color: '#f59e0b',
    fontFamily: 'system-ui, sans-serif',
  })

  const icon = document.createElement('div')
  icon.textContent = '⚠️'
  Object.assign(icon.style, { fontSize: '48px', marginBottom: '24px' })

  const heading = document.createElement('h2')
  heading.textContent = 'Application Error'
  Object.assign(heading.style, { fontSize: '24px', fontWeight: '800', marginBottom: '16px', color: '#fff' })

  const para = document.createElement('p')
  para.textContent = message
  Object.assign(para.style, {
    fontSize: '14px', color: '#888', marginBottom: '32px',
    maxWidth: '400px', wordBreak: 'break-all',
  })

  const btn = document.createElement('button')
  btn.textContent = 'Reload Application'
  btn.addEventListener('click', () => window.location.reload())
  Object.assign(btn.style, {
    padding: '16px 32px', background: 'linear-gradient(135deg,#f59e0b,#d97706)',
    color: '#000', border: 'none', borderRadius: '12px', fontSize: '14px',
    fontWeight: '800', cursor: 'pointer',
  })

  wrapper.append(icon, heading, para, btn)
  root.appendChild(wrapper)
}

// Global error handlers to catch unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
  const isProd = import.meta.env.PROD;
  renderFatalError(isProd ? 'An unexpected error occurred. Please reload the application.' : (event.error?.stack || event.error?.message || 'Unknown error occurred'))
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason)
  const isProd = import.meta.env.PROD;
  renderFatalError(isProd ? 'An unexpected process failed. Please reload the application.' : (event.reason?.stack || event.reason?.message || 'Promise rejection occurred'))
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { DBProvider } from './contexts/DBContext.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import './index.css'

try {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Root element not found')

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <DBProvider>
                <App />
              </DBProvider>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
} catch (error) {
  console.error('Failed to render:', error)
}
