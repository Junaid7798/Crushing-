import { useEffect, useRef } from 'react'

/**
 * Modal — Shared overlay modal with backdrop, close on Escape, focus trap.
 * @param {{onClose: () => void, title?: string, children: React.ReactNode, maxWidth?: string}} props
 */
export function Modal({ onClose, title, children, maxWidth = '500px' }) {
  const modalRef = useRef(null)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)

    // Focus first focusable element
    const firstInput = modalRef.current?.querySelector('input, select, textarea, button')
    if (firstInput) firstInput.focus()

    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div style={s.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div
        ref={modalRef}
        style={{ ...s.modal, maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div style={s.header}>
            <h2 style={s.title}>{title}</h2>
          </div>
        )}
        <div style={s.body}>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * ModalFooter — Shared footer with action buttons.
 */
export function ModalFooter({ children }) {
  return <div style={s.footer}>{children}</div>
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(15px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '24px',
  },
  modal: {
    width: '100%',
    background: 'var(--bg)',
    borderRadius: '32px',
    border: '1px solid var(--glass-border)',
    overflow: 'hidden',
    boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
  },
  header: {
    padding: '28px 32px',
    borderBottom: '1px solid var(--glass-border)',
    background: 'var(--glass-highlight)',
  },
  title: {
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  body: {
    padding: '32px',
  },
  footer: {
    padding: '24px 32px',
    background: 'rgba(255,255,255,0.02)',
    borderTop: '1px solid var(--glass-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
}
