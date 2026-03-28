import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { haptic } from '../helpers.js'

/**
 * LockScreen - The gateway to the Business OS.
 * Premium 3D Glassmorphism Security Interface.
 */
export default function LockScreen() {
  const { login, wrongAttempts, lockedUntil } = useAuth()

  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [remainingMs, setRemainingMs] = useState(0)

  const isLocked = lockedUntil && Date.now() < lockedUntil

  // Live countdown timer during lockout
  useEffect(() => {
    if (!lockedUntil) return
    const update = () => {
      const ms = lockedUntil - Date.now()
      setRemainingMs(ms > 0 ? ms : 0)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [lockedUntil])
  const MAX_DOTS = Math.max(pin.length, 4)

  function handleKey(digit) {
    if (isLocked || loading) return
    haptic()
    setPin(prev => {
      if (prev.length >= 8) return prev  // Max PIN length
      return prev + digit
    })
    setError('')
  }

  function handleBackspace() {
    haptic()
    setPin(p => p.slice(0, -1))
    setError('')
  }

  async function attemptLogin() {
    if (pin.length < 4 || loading || isLocked) return
    setLoading(true)
    try {
      await login(pin)
    } catch (err) {
      haptic()
      setError(err.message)
      setPin('')
      const dots = document.getElementById('pin-dots')
      if (dots) {
        dots.style.animation = 'none'
        dots.offsetHeight // reflow
        dots.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97) both'
      }
    } finally {
      setLoading(false)
    }
  }

  const dots = Array.from({ length: MAX_DOTS }, (_, i) => i < pin.length)

  return (
    <div style={s.container}>
      <div style={s.card}>
        {/* Branding */}
        <div style={s.logoMark}>B</div>
        <h1 style={s.title}>Business OS</h1>
        <p style={s.subtitle}>Terminal Authentication Required</p>

        {/* PIN Entry Area */}
        <div id="pin-dots" style={s.dots} role="group" aria-label="PIN entry dots">
          {dots.map((filled, i) => (
            <div
              key={i}
              style={{
                ...s.dot,
                borderColor: error ? 'var(--red-border)' : filled ? 'var(--amber)' : 'var(--glass-border)',
                background: error ? 'var(--red-dim)' : filled ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
                boxShadow: filled ? '0 0 15px rgba(245, 158, 11, 0.3)' : 'none',
                transform: filled ? 'scale(1.05)' : 'scale(1)',
              }}
              aria-hidden="true"
            >
              {filled ? <div style={s.dotInner} /> : null}
            </div>
          ))}
        </div>

        {/* Message HUD */}
        <div style={s.msgArea}>
          {error && <div style={s.error}>{error}</div>}
          {isLocked && (
            <div style={s.lockout}>
              <div style={{ fontWeight: 800, marginBottom: '4px' }}>Brute-force Protection Active</div>
              Attempt limit exceeded. Secure in {formatCountdown(remainingMs)}.
            </div>
          )}
          {!error && !isLocked && <div style={s.idleMsg}>{loading ? 'Authenticating...' : pin.length < 4 ? 'Enter 4–8 digit PIN' : 'Tap Unlock to continue'}</div>}
        </div>

        {/* Integrated Keypad */}
        <div style={s.keypad} role="group" aria-label="PIN keypad">
          {['1','2','3','4','5','6','7','8','9','CLR','0','⌫'].map((key, i) => (
            <button
              key={i}
              style={{
                ...s.key,
                opacity: isLocked ? 0.3 : 1,
                color: key === '⌫' || key === 'CLR' ? 'var(--amber)' : 'var(--text)',
                background: key === '⌫' || key === 'CLR' ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.03)',
                fontSize: key === 'CLR' ? '12px' : '22px',
              }}
              onClick={() => {
                if (key === '⌫') handleBackspace()
                else if (key === 'CLR') { haptic(); setPin('') }
                else handleKey(key)
              }}
              disabled={isLocked || loading}
              aria-label={key === '⌫' ? 'Backspace' : key === 'CLR' ? 'Clear PIN' : `Digit ${key}`}
              tabIndex={0}
            >
              {key}
            </button>
          ))}
        </div>

        {/* Unlock button — only visible when PIN has 4+ digits */}
        {pin.length >= 4 && !isLocked && (
          <button
            style={s.unlockBtn}
            onClick={attemptLogin}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : `Unlock (${pin.length} digits)`}
          </button>
        )}
      </div>

      {/* Security Proofs */}
      <div style={s.badges}>
        <div style={s.badge}>⚛️ Local Core</div>
        <div style={s.badge}>🔐 Poly-AES</div>
        <div style={s.badge}>☁️ Zero-Sync</div>
      </div>

      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function formatCountdown(ms) {
  if (ms <= 0) return '0s'
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min > 0) return `${min}m ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

const s = {
  container: {
    minHeight: '100vh',
    background: '#080808',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    backgroundImage: 'radial-gradient(circle at 50% 50%, #111 0%, #050505 100%)',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'var(--glass)',
    backdropFilter: 'blur(40px)',
    borderRadius: '48px',
    padding: '56px 32px',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 50px 100px rgba(0,0,0,0.8)',
    animation: 'fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
  },
  logoMark: {
    width: '56px',
    height: '56px',
    background: 'var(--grad-amber)',
    borderRadius: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--mono)',
    fontSize: '24px',
    fontWeight: '900',
    color: '#000',
    marginBottom: '24px',
    boxShadow: '0 8px 16px rgba(245, 158, 11, 0.4)',
  },
  title: {
    fontSize: '26px',
    fontWeight: 900,
    color: 'var(--text)',
    marginBottom: '8px',
    letterSpacing: '-0.05em',
  },
  subtitle: {
    fontSize: '11px',
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 800,
    marginBottom: '40px',
  },
  dots: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
  },
  dot: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    border: '1px solid var(--glass-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  dotInner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--amber)',
    boxShadow: '0 0 10px var(--amber)',
  },
  msgArea: {
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    marginBottom: '20px',
    width: '100%',
  },
  idleMsg: { fontSize: '12px', color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.02em' },
  error: { fontSize: '13px', color: 'var(--red)', fontWeight: 800, animation: 'fadeIn 0.2s ease' },
  lockout: { padding: '12px 20px', background: 'var(--red-dim)', borderRadius: '16px', border: '1px solid var(--red-border)', color: 'var(--red)', fontSize: '11px', lineHeight: 1.5 },

  keypad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    width: '100%',
  },
  key: {
    aspectRatio: '1/0.8',
    borderRadius: '20px',
    border: '1px solid var(--glass-border)',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  unlockBtn: {
    width: '100%',
    padding: '16px',
    marginTop: '20px',
    borderRadius: '16px',
    border: '1px solid var(--amber-border)',
    background: 'rgba(245,158,11,0.1)',
    color: 'var(--amber)',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
    letterSpacing: '0.05em',
    transition: 'all 0.2s',
  },
  badges: {
    display: 'flex',
    gap: '16px',
    marginTop: '64px',
    opacity: 0.6,
  },
  badge: {
    fontSize: '9px',
    fontWeight: 900,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
}
