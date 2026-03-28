import { formatMoney, getStatusStyle } from '../helpers.js'

/**
 * MetricCard - Large value cards for Dashboard.
 */
export function MetricCard({ label, value, color, subText }) {
  return (
    <div style={{ ...s.metricCard, borderColor: `var(--${color}-border)` }}>
      <div style={{ ...s.metricTopBorder, background: `var(--${color})` }} />
      <div style={s.metricLabel}>{label}</div>
      <div style={s.metricValue}>{formatMoney(value)}</div>
      <div style={s.metricSubText}>{subText}</div>
    </div>
  )
}

/**
 * StatusPill - Small badge with color coding for record statuses.
 */
export function StatusPill({ status }) {
  const style = getStatusStyle(status)
  return (
    <span style={{ ...s.pill, background: style.background, color: style.color, borderColor: style.color + '40' }}>
      {status}
    </span>
  )
}

/**
 * EmptyState - Illustrated empty container.
 */
export function EmptyState({ message, sub }) {
  return (
    <div style={s.emptyContainer}>
      <div style={s.emptyIcon}>🕳️</div>
      <div style={s.emptyMsg}>{message}</div>
      {sub && <div style={s.emptySub}>{sub}</div>}
    </div>
  )
}

const s = {
  metricCard: {
    background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)',
    borderRadius: '24px', padding: '24px', position: 'relative', overflow: 'hidden',
    boxShadow: 'var(--glass-shadow)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
  },
  metricTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: '4px' },
  metricLabel: { fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: '12px' },
  metricValue: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: '8px', letterSpacing: '-0.02em' },
  metricSubText: { fontSize: '11px', color: 'var(--text2)', opacity: 0.8, fontWeight: 500 },

  pill: { padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--mono)', border: '1px solid' },

  emptyContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' },
  emptyIcon: { fontSize: '40px', marginBottom: '16px', opacity: 0.3 },
  emptyMsg: { fontSize: '14px', fontWeight: 700, color: 'var(--text2)', marginBottom: '4px' },
  emptySub: { fontSize: '12px', color: 'var(--text3)', maxWidth: '200px' },
}
