/**
 * FormField — Shared form field with label, input, and validation error display.
 * @param {{label: string, error?: string, children: React.ReactNode}} props
 */
export function FormField({ label, error, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {children}
      {error && <div style={s.error}>{error}</div>}
    </div>
  )
}

/**
 * Input — Styled input with consistent appearance.
 */
export function Input({ ...props }) {
  return <input style={s.input} {...props} />
}

/**
 * Select — Styled select with consistent appearance.
 */
export function Select({ children, ...props }) {
  return <select style={s.input} {...props}>{children}</select>
}

/**
 * Textarea — Styled textarea with consistent appearance.
 */
export function Textarea({ rows = 4, ...props }) {
  return <textarea style={{ ...s.input, height: `${rows * 28}px`, resize: 'vertical' }} {...props} />
}

/**
 * PrimaryButton — Styled primary action button.
 */
export function PrimaryButton({ children, ...props }) {
  return <button style={s.primaryBtn} {...props}>{children}</button>
}

/**
 * SecondaryButton — Styled secondary/outline button.
 */
export function SecondaryButton({ children, ...props }) {
  return <button style={s.secondaryBtn} {...props}>{children}</button>
}

const s = {
  field: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' },
  label: {
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  error: {
    fontSize: '12px',
    color: 'var(--red)',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '16px',
    borderRadius: '14px',
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--glass-border)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '16px 32px',
    background: 'var(--grad-amber)',
    color: '#000',
    borderRadius: '16px',
    fontWeight: 800,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  secondaryBtn: {
    padding: '14px 24px',
    borderRadius: '14px',
    background: 'var(--glass-highlight)',
    border: '1px solid var(--glass-border)',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
}
