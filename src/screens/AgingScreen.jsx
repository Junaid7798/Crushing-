import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { formatMoney, haptic } from '../helpers.js'
import { AGING_BUCKETS, calculateAging, getPartyAging, generateReminderMessage } from '../services/aging.js'

/**
 * AgingScreen — Payment aging report with overdue tracking.
 */
export default function AgingScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()
  const [selectedParty, setSelectedParty] = useState(null)
  const [view, setView] = useState('summary') // summary | parties

  const { result: transactions } = useRxQuery(
    db?.transactions.find({ selector: { business_id: currentUser?.business_id } }),
    { live: true }
  )
  const { result: parties } = useRxQuery(
    db?.parties.find({ selector: { business_id: currentUser?.business_id } }),
    { live: true }
  )

  const partyMap = useMemo(() => {
    const m = {}
    if (parties) parties.forEach(p => { m[p.id] = p })
    return m
  }, [parties])

  const aging = useMemo(() => {
    if (!transactions) return null
    return calculateAging(transactions)
  }, [transactions])

  if (!aging) return (
    <div style={s.loading}><div style={s.loadingText}>Computing aging data...</div></div>
  )

  if (selectedParty) {
    return <PartyAgingDetail partyId={selectedParty} party={partyMap[selectedParty]}
      transactions={transactions} onClose={() => setSelectedParty(null)} db={db} currentUser={currentUser} />
  }

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Payment Aging Report</h1>
          <p style={s.subTitle}>{aging.summary.total_parties} parties with outstanding dues</p>
        </div>
        <div style={s.headerRight}>
          <div style={s.viewToggle}>
            <button style={{ ...s.vtBtn, ...(view === 'summary' ? s.vtActive : {}) }}
              onClick={() => setView('summary')}>Buckets</button>
            <button style={{ ...s.vtBtn, ...(view === 'parties' ? s.vtActive : {}) }}
              onClick={() => setView('parties')}>By Party</button>
          </div>
        </div>
      </header>

      <div style={s.body}>
        {/* Grand Total */}
        <div style={s.grandTotal}>
          <div style={s.gtLabel}>Total Outstanding</div>
          <div style={s.gtValue}>{formatMoney(aging.summary.grand_total)}</div>
        </div>

        {view === 'summary' ? (
          /* Bucket Grid */
          <div style={s.bucketGrid}>
            {AGING_BUCKETS.map(b => {
              const info = aging.summary[b.key]
              return (
                <div key={b.key} style={{
                  ...s.bucketCard,
                  borderLeft: `4px solid var(--${b.color})`,
                }}>
                  <div style={s.bucketHeader}>
                    <span style={{ ...s.bucketLabel, color: `var(--${b.color})` }}>{b.label}</span>
                    <span style={s.bucketCount}>{info.count} txn{info.count !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ ...s.bucketAmount, color: `var(--${b.color})` }}>
                    {formatMoney(info.total)}
                  </div>
                  <div style={s.bucketBar}>
                    <div style={{
                      ...s.bucketBarFill,
                      width: `${aging.summary.grand_total > 0 ? (info.total / aging.summary.grand_total * 100) : 0}%`,
                      background: `var(--${b.color})`,
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Party List */
          <div style={s.partyList}>
            {aging.partyAging.map(p => (
              <div key={p.party_id} style={s.partyRow}
                onClick={() => { haptic(); setSelectedParty(p.party_id) }}>
                <div style={s.partyInfo}>
                  <div style={s.partyName}>{partyMap[p.party_id]?.name || 'Unknown'}</div>
                  <div style={s.partyMeta}>
                    {p.transaction_count} txn{p.transaction_count !== 1 ? 's' : ''} · Oldest: {p.oldest_due_days}d
                  </div>
                </div>
                <div style={s.partyBuckets}>
                  {p.bucket1 > 0 && <span style={{ ...s.miniBucket, background: 'var(--amber-dim)', color: 'var(--amber)' }}>1-30d: {formatMoney(p.bucket1)}</span>}
                  {p.bucket2 > 0 && <span style={{ ...s.miniBucket, background: 'var(--orange-dim, var(--amber-dim))', color: 'var(--orange, var(--amber))' }}>31-60d: {formatMoney(p.bucket2)}</span>}
                  {p.bucket3 > 0 && <span style={{ ...s.miniBucket, background: 'var(--red-dim)', color: 'var(--red)' }}>61-90d: {formatMoney(p.bucket3)}</span>}
                  {p.bucket4 > 0 && <span style={{ ...s.miniBucket, background: 'var(--red-dim)', color: 'var(--red)' }}>90+d: {formatMoney(p.bucket4)}</span>}
                </div>
                <div style={s.partyTotal}>{formatMoney(p.total_outstanding)}</div>
              </div>
            ))}
            {aging.partyAging.length === 0 && (
              <div style={s.emptyState}>No outstanding dues found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PartyAgingDetail({ partyId, party, transactions, onClose, db, currentUser }) {
  const today = new Date()
  const aging = useMemo(() => getPartyAging(transactions, partyId, today), [transactions, partyId])

  const handleSendReminder = () => {
    haptic()
    const msg = generateReminderMessage(
      party?.name || 'Customer', 'Our Business', aging.total, aging.oldestDays
    )
    const url = `https://wa.me/${party?.phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={onClose}>←</button>
          <div>
            <h1 style={s.title}>{party?.name || 'Unknown Party'}</h1>
            <p style={s.subTitle}>Aging Detail — {aging.oldestDays} days oldest overdue</p>
          </div>
        </div>
        <div style={s.headerRight}>
          <button style={s.remindBtn} onClick={handleSendReminder}>📤 Send Reminder</button>
        </div>
      </header>

      <div style={s.body}>
        {/* Bucket Summary */}
        <div style={s.detailBuckets}>
          {AGING_BUCKETS.map(b => (
            <div key={b.key} style={{
              ...s.detailBucket,
              background: aging[b.key] > 0 ? `var(--${b.color}-dim)` : 'var(--glass-highlight)',
              border: `1px solid ${aging[b.key] > 0 ? `var(--${b.color}-border)` : 'var(--glass-border)'}`,
            }}>
              <div style={s.dbLabel}>{b.label}</div>
              <div style={{ ...s.dbValue, color: aging[b.key] > 0 ? `var(--${b.color})` : 'var(--text3)' }}>
                {formatMoney(aging[b.key])}
              </div>
            </div>
          ))}
        </div>

        {/* Transaction List */}
        <div style={s.txTable}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={s.txTh}>
                <th style={s.txThCell}>Date</th>
                <th style={s.txThCell}>Due Date</th>
                <th style={s.txThCell}>Days Overdue</th>
                <th style={{ ...s.txThCell, textAlign: 'right' }}>Balance Due</th>
              </tr>
            </thead>
            <tbody>
              {aging.transactions.sort((a, b) => b.days_overdue - a.days_overdue).map(tx => (
                <tr key={tx.id} style={s.txTr}>
                  <td style={s.txTd}>{tx.date}</td>
                  <td style={s.txTd}>{tx.due_date || tx.date}</td>
                  <td style={s.txTd}>
                    <span style={{
                      ...s.overdueBadge,
                      background: tx.days_overdue > 90 ? 'var(--red-dim)' : tx.days_overdue > 30 ? 'var(--amber-dim)' : 'var(--teal-dim)',
                      color: tx.days_overdue > 90 ? 'var(--red)' : tx.days_overdue > 30 ? 'var(--amber)' : 'var(--teal)',
                    }}>{tx.days_overdue}d</span>
                  </td>
                  <td style={{ ...s.txTd, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 800 }}>
                    {formatMoney(tx.balance_due)}
                  </td>
                </tr>
              ))}
              {aging.transactions.length === 0 && (
                <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
                  No overdue transactions.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: {
    padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerLeft: { display: 'flex', gap: '16px', alignItems: 'center' },
  headerRight: { display: 'flex', gap: '12px', alignItems: 'center' },
  title: { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },

  body: { flex: 1, padding: '32px', overflowY: 'auto' },
  loading: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  loadingText: { fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--mono)' },

  viewToggle: { display: 'flex', background: 'var(--glass-highlight)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' },
  vtBtn: { padding: '8px 18px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  vtActive: { background: 'var(--bg)', color: 'var(--amber)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },

  backBtn: { width: '42px', height: '42px', borderRadius: '14px', background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)', color: '#fff', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  remindBtn: { padding: '10px 20px', borderRadius: '12px', background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--teal-border)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },

  grandTotal: {
    background: 'var(--glass)', borderRadius: '24px', padding: '28px 32px', marginBottom: '24px',
    border: '1px solid var(--glass-border)', textAlign: 'center',
  },
  gtLabel: { fontSize: '11px', color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' },
  gtValue: { fontSize: '36px', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--amber)', letterSpacing: '-0.04em', marginTop: '8px' },

  bucketGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' },
  bucketCard: {
    background: 'var(--glass)', borderRadius: '20px', padding: '20px',
    border: '1px solid var(--glass-border)',
  },
  bucketHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  bucketLabel: { fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  bucketCount: { fontSize: '10px', color: 'var(--text3)', fontWeight: 700 },
  bucketAmount: { fontSize: '24px', fontWeight: 900, fontFamily: 'var(--mono)', letterSpacing: '-0.03em' },
  bucketBar: { height: '4px', background: 'var(--glass-highlight)', borderRadius: '2px', marginTop: '12px', overflow: 'hidden' },
  bucketBarFill: { height: '100%', borderRadius: '2px', transition: 'width 0.5s ease' },

  partyList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  partyRow: {
    background: 'var(--glass)', borderRadius: '16px', padding: '20px 24px',
    border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '20px',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  partyInfo: { flex: 1, minWidth: 0 },
  partyName: { fontSize: '15px', fontWeight: 700, color: 'var(--text)' },
  partyMeta: { fontSize: '11px', color: 'var(--text3)', marginTop: '4px' },
  partyBuckets: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  miniBucket: { padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, fontFamily: 'var(--mono)' },
  partyTotal: { fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--amber)', minWidth: '100px', textAlign: 'right' },

  detailBuckets: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '32px' },
  detailBucket: { borderRadius: '16px', padding: '16px', textAlign: 'center' },
  dbLabel: { fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', color: 'var(--text3)' },
  dbValue: { fontSize: '18px', fontWeight: 800, fontFamily: 'var(--mono)' },

  txTable: { background: 'var(--glass)', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--glass-border)' },
  txTh: { background: 'var(--glass-highlight)', borderBottom: '1px solid var(--glass-border)' },
  txThCell: { padding: '14px 20px', fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, textAlign: 'left' },
  txTr: { borderBottom: '1px solid var(--glass-border)' },
  txTd: { padding: '14px 20px', fontSize: '13px' },
  overdueBadge: { padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, fontFamily: 'var(--mono)' },

  emptyState: { padding: '60px', textAlign: 'center', color: 'var(--text3)', gridColumn: '1/-1' },
}
