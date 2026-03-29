import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext.jsx'
import OnboardingScreen from './screens/OnboardingScreen.jsx'
import LockScreen from './screens/LockScreen.jsx'
import DashboardScreen from './screens/DashboardScreen.jsx'
import TransactionScreen from './screens/TransactionScreen.jsx'
import PDFPreviewScreen from './screens/PDFPreviewScreen.jsx'
import InventoryScreen from './screens/InventoryScreen.jsx'
import RateCardScreen from './screens/RateCardScreen.jsx'
import PartiesScreen from './screens/PartiesScreen.jsx'
import ReportsScreen from './screens/ReportsScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'

/**
 * App - Root component. Uses react-router-dom for screen management.
 */
export default function App() {
  const { status } = useAuth()

  // Core Authentication / Setup Flows
  if (status === 'loading') {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
        <span style={styles.loadingText}>Initialising Business OS...</span>
      </div>
    )
  }

  if (status === 'onboarding') {
    return <OnboardingScreen />
  }

  if (status === 'locked') {
    return <LockScreen />
  }

  // Application Shell (Status is 'unlocked')
  return (
    <div style={styles.unlockedRoot}>
      <Routes>
        <Route path="/" element={<DashboardScreen />} />
        <Route path="/dashboard" element={<Navigate to="/" />} />
        <Route path="/transaction" element={<TransactionScreen />} />
        <Route path="/transaction/:id" element={<PDFPreviewScreen />} />
        <Route path="/inventory" element={<InventoryScreen />} />
        <Route path="/ratecard" element={<RateCardScreen />} />
        <Route path="/parties" element={<PartiesScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <Navigation />
    </div>
  )
}

function Navigation() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const tabs = [
    { id: '/', icon: '📊', label: 'Dashboard' },
    { id: '/transaction', icon: '💰', label: 'Record' },
    { id: '/parties', icon: '👥', label: 'Parties' },
    { id: '/inventory', icon: '📦', label: 'Inventory' },
    { id: '/reports', icon: '📅', label: 'Reports' },
    { id: '/settings', icon: '⚙️', label: 'Settings' },
  ]

  const activePath = pathname

  return (
    <nav style={styles.nav} role="navigation" aria-label="Main navigation">
      {tabs.map(t => {
        const isActive = activePath === t.id || (t.id !== '/' && activePath.startsWith(t.id))
        return (
          <button
            key={t.id}
            style={{
              ...styles.navBtn,
              color: isActive ? 'var(--amber)' : 'var(--text3)',
            }}
            onClick={() => navigate(t.id)}
            aria-label={t.label}
            aria-current={isActive ? 'page' : undefined}
            tabIndex={0}
          >
            <span style={styles.navIcon} aria-hidden="true">{t.icon}</span>
            <span style={styles.navLabel}>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

const styles = {
  loading: {
    height: '100vh',
    width: '100vw',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid var(--glass-border)',
    borderTopColor: 'var(--amber)',
    borderRadius: '50%',
    animation: 'spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
    boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)',
  },
  loadingText: {
    fontSize: '11px',
    color: 'var(--text3)',
    fontFamily: 'var(--mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontWeight: 700,
  },
  unlockedRoot: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    color: 'var(--text)',
  },
  nav: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'calc(100% - 48px)',
    maxWidth: '500px',
    height: '76px',
    background: 'var(--glass)',
    backdropFilter: 'var(--glass-blur)',
    border: '1px solid var(--glass-border)',
    borderRadius: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 12px',
    zIndex: 1000,
    boxShadow: 'var(--glass-shadow)',
  },
  navBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    flex: 1,
    padding: '10px 0',
    borderRadius: '16px',
    border: 'none',
    background: 'transparent',
  },
  navIcon: { fontSize: '22px' },
  navLabel: { fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' },
}
