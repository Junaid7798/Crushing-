import { useState, useCallback, createContext, useContext } from 'react'

const ToastContext = createContext(null)

/**
 * ToastProvider — Non-blocking notification system to replace alert().
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div style={styles.container} role="alert" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} style={{ ...styles.toast, ...styles[t.type] }}>
            <span style={styles.message}>{t.message}</span>
            <button style={styles.close} onClick={() => removeToast(t.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/**
 * useToast — Hook to show toast notifications.
 * @returns {{addToast: (message, type?, duration?) => void}}
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

const styles = {
  container: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '400px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderRadius: '14px',
    background: 'var(--surface)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    animation: 'slideUp 0.3s ease both',
    fontSize: '13px',
    fontWeight: 600,
  },
  message: { flex: 1, color: 'var(--text)' },
  close: {
    background: 'none',
    border: 'none',
    color: 'var(--text3)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 0 0 12px',
    fontWeight: 700,
  },
  info: { borderLeft: '3px solid var(--amber)' },
  success: { borderLeft: '3px solid var(--teal)' },
  error: { borderLeft: '3px solid var(--red)' },
}
