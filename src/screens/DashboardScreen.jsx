import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useConfig } from '../hooks/useConfig.js'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { formatMoney, getStatusStyle, haptic } from '../helpers.js'
import { MetricCard, StatusPill, EmptyState } from '../components/CommonComponents.jsx'

/**
 * DashboardScreen - Core business overview hub.
 */
export default function DashboardScreen() {
  const navigate = useNavigate()
  const { logout, currentUser } = useAuth()
  const { businessName, isPluginEnabled } = useConfig()
  const { db } = useDB()

  const [duesView, setDuesView] = useState('table') // 'table' | 'kanban'

  const todayRaw = useMemo(() => new Date(), [])
  const [todayStr, setTodayStr] = useState(todayRaw.toISOString().split('T')[0])
  const [today, setToday] = useState(todayRaw)

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        const d = new Date()
        setTodayStr(d.toISOString().split('T')[0])
        setToday(d)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // ── DATA FETCHING ────────────────────────────────
  const { result: summary } = useRxQuery(
    db?.daily_summary.findOne({
      selector: { date: todayStr, business_id: currentUser?.business_id }
    }),
    { live: true, isDoc: true }
  )

  const { result: allTransactions } = useRxQuery(
    db?.transactions.find({
      selector: { business_id: currentUser?.business_id },
      sort: [{ date: 'desc' }],
      limit: 50
    }),
    { live: true }
  )

  // Fetch parties for name lookup in dues table
  const { result: allParties } = useRxQuery(
    db?.parties.find({
      selector: { business_id: currentUser?.business_id }
    }),
    { live: true }
  )

  const partyMap = useMemo(() => {
    const map = {}
    if (allParties) allParties.forEach(p => { map[p.id] = p.name })
    return map
  }, [allParties])

  // ── DERIVED STATE ────────────────────────────────
  const { pendingTxs, recentTxs, tiers } = useMemo(() => {
    if (!allTransactions) return { pendingTxs: [], recentTxs: [], tiers: { today: [], overdue: [], critical: [] } }

    const pending = allTransactions.filter(tx => (tx.status === 'pending' || tx.status === 'partial') && tx.balance_due > 0)
    const recent  = allTransactions.slice(0, 5)

    const todayTxs    = []
    const overdueTxs  = []
    const criticalTxs = []

    pending.forEach(tx => {
      const dueDate = new Date(tx.due_date || tx.date)
      const diffMs  = today - dueDate
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays < 0) return 
      if (diffDays === 0) todayTxs.push(tx)
      else if (diffDays < 30) overdueTxs.push(tx)
      else criticalTxs.push(tx)
    })

    return {
      pendingTxs: pending,
      recentTxs: recent,
      tiers: { today: todayTxs, overdue: overdueTxs, critical: criticalTxs }
    }
  }, [allTransactions, today])

  const totalOutstanding = useMemo(() => 
    pendingTxs.reduce((sum, tx) => sum + tx.balance_due, 0)
  , [pendingTxs])

  const actions = useMemo(() => [
    { label: 'New sale', icon: '📄', color: 'amber', id: 'sale', primary: true },
    { label: 'Payment', icon: '💰', color: 'teal', id: 'payment_in' },
    { label: 'Production', icon: '⚙️', color: 'purple', id: 'production', hidden: !isPluginEnabled('production') },
    { label: 'Expense', icon: '📋', color: 'red', id: 'expense' },
  ].filter(a => !a.hidden), [isPluginEnabled])

  const navItems = useMemo(() => [
    { label: 'Aging Report', icon: '📅', path: '/aging', color: 'amber' },
    { label: 'NPA Tracking', icon: '⚠️', path: '/npa', color: 'red' },
    { label: 'Deliveries', icon: '🚛', path: '/delivery', color: 'teal' },
    { label: 'Rate Cards', icon: '💰', path: '/ratecard', color: 'purple' },
    { label: 'Merge Queue', icon: '🔄', path: '/merge', color: 'amber' },
  ], [])

  const navAction = (type) => {
    haptic()
    navigate(`/transaction?type=${type}`)
  }

  return (
    <div style={s.root}>
      {/* Topbar */}
      <header style={s.topbar}>
        <div style={s.topbarLeft}>
          <div style={s.bizRow}>
            <div style={s.logoMark}>B</div>
            <h1 style={s.bizName}>{businessName}</h1>
          </div>
          <p style={s.topbarDate}>
            {today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={s.topbarRight}>
          <div style={s.userInfo}>
            <div style={s.userName}>{currentUser?.display_name || 'Admin'}</div>
            <div style={s.userRole}>{currentUser?.role || 'Owner'}</div>
          </div>
          <button style={s.lockBtn} onClick={() => { haptic(); logout() }} title="Lock Session">🔒</button>
        </div>
      </header>

      <div style={s.content}>
        {/* Metric Grid */}
        <div style={s.metricGrid}>
          <MetricCard label="Today's sales" value={summary?.total_sales} color="amber" subText="recorded today" />
          <MetricCard label="Collected" value={summary?.total_payments_in} color="teal" subText={`${formatMoney((summary?.total_sales ?? 0) - (summary?.total_payments_in ?? 0))} pending`} />
          <MetricCard label="Outstanding" value={totalOutstanding} color="red" subText={`${pendingTxs.length} customers owing`} />
          <MetricCard 
            label="Profit (est)" 
            value={summary?.gross_profit} 
            color="purple" 
            subText={summary?.total_sales > 0 
              ? `margin ${((summary.gross_profit / summary.total_sales) * 100).toFixed(0)}%` 
              : 'no sales today'} 
          />
        </div>

        {/* Quick Actions */}
        <section>
          <div style={s.sectionHeader}><h2 style={s.sectionTitle}>Quick Actions</h2></div>
          <div style={s.quickActions}>
            {actions.map(a => (
              <button key={a.id} style={{ ...s.qaBtn, ...(a.primary ? s.qaPrimary : {}) }} 
                onClick={() => navAction(a.id)}>
                <div style={{ ...s.qaIcon, background: `var(--${a.color}-dim)` }}>{a.icon}</div>
                <span style={s.qaLabel}>{a.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Navigation Shortcuts */}
        <section>
          <div style={s.sectionHeader}><h2 style={s.sectionTitle}>Management</h2></div>
          <div style={s.navShortcuts}>
            {navItems.map(n => (
              <button key={n.path} style={s.navShortcutBtn} onClick={() => { haptic(); navigate(n.path) }}>
                <span style={{ fontSize: '18px' }}>{n.icon}</span>
                <span style={s.nsLabel}>{n.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Dues + Recent */}
        <div style={s.twoCol}>
          {/* Outstanding Dues */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <h2 style={s.cardTitle}>Outstanding Dues</h2>
              <div style={s.viewToggle}>
                <button style={{ ...s.toggleBtn, ...(duesView === 'table' ? s.toggleActive : {}) }} onClick={() => setDuesView('table')}>Table</button>
                <button style={{ ...s.toggleBtn, ...(duesView === 'kanban' ? s.toggleActive : {}) }} onClick={() => setDuesView('kanban')}>Kanban</button>
              </div>
            </div>

            <div style={s.cardBody}>
              <div style={s.duesStrip}>
                <TierSummary count={tiers.today.length} label="Due Today" color="amber" icon="🟠" />
                <TierSummary count={tiers.overdue.length} label="Overdue" color="orange" icon="⚠️" />
                <TierSummary count={tiers.critical.length} label="Critical" color="red" icon="🚨" />
              </div>

              {duesView === 'table' ? (
                <div style={s.tableContainer}>
                  <table style={s.table}>
                    <thead>
                      <tr><th style={s.th}>Party</th><th style={s.th}>Amount</th><th style={s.th}>Status</th></tr>
                    </thead>
                    <tbody>
                      {pendingTxs.length === 0 && (
                        <tr><td colSpan="3"><EmptyState message="No outstanding dues" /></td></tr>
                      )}
                      {pendingTxs.map(tx => (
                        <tr key={tx.id} style={s.tr} onClick={() => navigate(`/parties`)}>
                          <td style={s.td}><div style={s.txParty}>{partyMap[tx.party_id] || tx.party_id.slice(0, 8) + '...'}</div></td>
                          <td style={s.td}><div style={s.amountCell}>{formatMoney(tx.balance_due)}</div></td>
                          <td style={s.td}><StatusPill status={tx.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={s.kanban}>
                  <KanbanCol title="Due Today" count={tiers.today.length} color="amber" items={tiers.today} />
                  <KanbanCol title="Overdue" count={tiers.overdue.length} color="orange" items={tiers.overdue} />
                  <KanbanCol title="Critical" count={tiers.critical.length} color="red" items={tiers.critical} />
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div style={s.card}>
            <div style={s.cardHeader}><h2 style={s.cardTitle}>Recent Transactions</h2></div>
            <div style={s.cardBody}>
              <div style={s.tableContainer}>
                <table style={s.table}>
                  <thead>
                    <tr><th style={s.th}>Type</th><th style={s.th}>Amount</th><th style={s.th}>Status</th></tr>
                  </thead>
                  <tbody>
                    {recentTxs.length === 0 && (
                      <tr><td colSpan="3"><EmptyState message="No recent activity" sub="Record a sale to see it here." /></td></tr>
                    )}
                    {recentTxs.map(tx => (
                      <tr key={tx.id} style={s.tr} onClick={() => navigate(`/transaction/${tx.id}`)}>
                        <td style={s.td}>
                          <div style={s.txTypeLabel}>{tx.tx_type}</div>
                          <div style={s.txTime}>{new Date(tx.date).toLocaleDateString()}</div>
                        </td>
                        <td style={{ ...s.td, color: tx.tx_type === 'sale' ? 'var(--teal)' : 'var(--red)' }}>
                          <div style={s.amountCell}>{formatMoney(tx.total)}</div>
                        </td>
                        <td style={s.td}><StatusPill status={tx.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TierSummary({ count, label, color, icon }) {
  return (
    <div style={{ ...s.tierCard, background: `var(--${color}-dim)`, borderColor: `var(--${color}-border)` }}>
      <span style={s.tierIcon}>{icon}</span>
      <div>
        <div style={{ ...s.tierCount, color: `var(--${color})` }}>{count}</div>
        <div style={s.tierLabel}>{label}</div>
      </div>
    </div>
  )
}

function KanbanCol({ title, count, color, items }) {
  return (
    <div style={s.kCol}>
      <div style={s.kHeader}>
        <span style={{ fontSize: '10px', color: `var(--${color})` }}>●</span> {title}
        <span style={s.kCount}>{count}</span>
      </div>
      <div style={s.kList}>
        {items.map(tx => (
          <div key={tx.id} style={s.kCard}>
            <div style={s.kName}>ID: {tx.id.slice(0, 8)}</div>
            <div style={s.kAmount}>{formatMoney(tx.balance_due)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  topbar: {
    padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', 
    position: 'sticky', top: 0, zIndex: 10,
  },
  topbarLeft: { display: 'flex', flexDirection: 'column', gap: '2px' },
  bizRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: {
    width: '32px', height: '32px', background: 'var(--grad-amber)', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 800, color: '#000',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
  },
  bizName: { fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em' },
  topbarDate: { fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)' },
  topbarRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  userInfo: { textAlign: 'right' },
  userName: { fontSize: '13px', fontWeight: 600, color: 'var(--text)' },
  userRole: { fontSize: '11px', color: 'var(--text3)' },
  lockBtn: {
    width: '36px', height: '36px', borderRadius: '12px', background: 'var(--glass-highlight)',
    border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s',
  },
  content: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' },

  metricGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' },
  
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em' },
  quickActions: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' },
  qaBtn: {
    background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: '24px',
    padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', 
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer',
  },
  qaPrimary: { border: '1px solid var(--amber-border)', background: 'var(--amber-dim)' },
  qaIcon: { width: '52px', height: '52px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', transition: 'transform 0.2s' },
  qaLabel: { fontSize: '13px', fontWeight: 700, color: 'var(--text)' },

  navShortcuts: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  navShortcutBtn: {
    background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: '16px',
    padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  nsLabel: { fontSize: '12px', fontWeight: 700, color: 'var(--text)' },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
  card: { 
    background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', 
    border: '1px solid var(--glass-border)', borderRadius: '28px', overflow: 'hidden',
    boxShadow: 'var(--glass-shadow)',
  },
  cardHeader: { padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' },
  cardTitle: { fontSize: '15px', fontWeight: 800, color: 'var(--text)' },
  cardBody: { padding: '24px' },

  viewToggle: { display: 'flex', background: 'var(--glass-highlight)', borderRadius: '12px', padding: '4px', border: '1px solid var(--glass-border)' },
  toggleBtn: { padding: '6px 14px', fontSize: '11px', borderRadius: '10px', color: 'var(--text3)', border: 'none', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
  toggleActive: { background: 'var(--bg)', color: 'var(--amber)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },

  duesStrip: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '24px' },
  tierCard: { border: '1px solid', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--glass-highlight)' },
  tierIcon: { fontSize: '20px' },
  tierCount: { fontSize: '22px', fontWeight: 800, fontFamily: 'var(--mono)', lineHeight: 1 },
  tierLabel: { fontSize: '10px', color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' },

  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '12px 0', fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, borderBottom: '1px solid var(--glass-border)' },
  tr: { borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s', cursor: 'pointer' },
  td: { padding: '16px 0' },
  txParty: { fontSize: '14px', fontWeight: 600 },
  amountCell: { fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 800 },

  kanban: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  kCol: { background: 'var(--glass-highlight)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--glass-border)' },
  kHeader: { padding: '12px 14px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)' },
  kCount: { background: 'var(--bg)', padding: '2px 8px', borderRadius: '8px', color: 'var(--text2)', fontSize: '10px', fontWeight: 800 },
  kList: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' },
  kCard: { background: 'var(--surface)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' },
  kName: { fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '8px' },
  kAmount: { fontSize: '15px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--amber)' },

  txTypeLabel: { fontSize: '13px', fontWeight: 800, textTransform: 'capitalize' },
  txTime: { fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'var(--mono)', fontWeight: 600 },
}
