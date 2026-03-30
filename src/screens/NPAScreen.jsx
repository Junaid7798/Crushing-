import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { useToast } from '../components/ui/Toast.jsx'
import { createRecord, updateRecord, formatMoney, haptic } from '../helpers.js'

const NPA_STATUSES = [
  { key: 'watchlist',  label: 'Watchlist',   color: 'amber' },
  { key: 'substandard',label: 'Substandard', color: 'orange' },
  { key: 'doubtful',   label: 'Doubtful',    color: 'red' },
  { key: 'loss',       label: 'Loss',        color: 'red' },
]

/**
 * NPAScreen — Non-Performing Asset management for admin.
 * Only admin can declare NPA. Owner-initiated only per Rule 11.
 */
export default function NPAScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()
  const toast = useToast()

  const [filter, setFilter] = useState('all')
  const [declareTarget, setDeclareTarget] = useState(null)
  const [writeOffTarget, setWriteOffTarget] = useState(null)

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

  const npaTxs = useMemo(() => {
    if (!transactions) return []
    let filtered = transactions.filter(tx => tx.npa_status && tx.npa_status !== 'active')
    if (filter !== 'all') filtered = filtered.filter(tx => tx.npa_status === filter)
    return filtered.sort((a, b) => (b.npa_declared_at || '').localeCompare(a.npa_declared_at || ''))
  }, [transactions, filter])

  const npaSummary = useMemo(() => {
    if (!transactions) return { total: 0, byStatus: {} }
    const npaAll = transactions.filter(tx => tx.npa_status && tx.npa_status !== 'active')
    const total = npaAll.reduce((s, tx) => s + (tx.write_off_amount || tx.balance_due || tx.total || 0), 0)
    const byStatus = {}
    NPA_STATUSES.forEach(st => {
      const items = npaAll.filter(tx => tx.npa_status === st.key)
      byStatus[st.key] = {
        count: items.length,
        total: items.reduce((s, tx) => s + (tx.write_off_amount || tx.balance_due || tx.total || 0), 0),
      }
    })
    return { total, byStatus }
  }, [transactions])

  const handleDeclare = async (status, reason) => {
    if (!declareTarget) return
    haptic()
    try {
      await updateRecord('transactions', declareTarget.id, {
        npa_status: status,
        npa_declared_at: new Date().toISOString(),
        npa_declared_by: currentUser.id,
        npa_reason: reason,
      }, { user_id: currentUser.id, note: `NPA declared as ${status}: ${reason}` })
      toast.addToast(`Marked as ${status}`, 'success')
      setDeclareTarget(null)
    } catch (err) {
      toast.addToast('Failed: ' + err.message, 'error')
    }
  }

  const handleWriteOff = async (amount, reason) => {
    if (!writeOffTarget) return
    haptic()
    try {
      await updateRecord('transactions', writeOffTarget.id, {
        npa_status: 'loss',
        write_off_amount: amount,
        status: 'written_off',
        npa_reason: reason || writeOffTarget.npa_reason,
      }, { user_id: currentUser.id, note: `Write-off: ₹${amount} — ${reason}` })
      toast.addToast(`Write-off recorded: ${formatMoney(amount)}`, 'success')
      setWriteOffTarget(null)
    } catch (err) {
      toast.addToast('Write-off failed: ' + err.message, 'error')
    }
  }

  const { result: eligibleTxs } = useRxQuery(
    db?.transactions.find({
      selector: {
        business_id: currentUser?.business_id,
        tx_type: 'sale',
        status: { $in: ['pending', 'partial'] },
        balance_due: { $gt: 0 },
      },
      sort: [{ date: 'desc' }],
      limit: 50,
    }),
    { live: true }
  )

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>NPA Management</h1>
          <p style={s.subTitle}>Non-Performing Asset Tracking</p>
        </div>
      </header>

      <div style={s.body}>
        {/* Summary Cards */}
        <div style={s.summaryGrid}>
          <div style={s.totalCard}>
            <div style={s.totalLabel}>Total NPA Amount</div>
            <div style={s.totalValue}>{formatMoney(npaSummary.total)}</div>
            <div style={s.totalSub}>{npaTxs.length} transactions flagged</div>
          </div>
          {NPA_STATUSES.map(st => {
            const info = npaSummary.byStatus[st.key] || { count: 0, total: 0 }
            return (
              <div key={st.key} style={{
                ...s.statusCard,
                borderLeft: `4px solid var(--${st.color})`,
              }}>
                <div style={{ ...s.scLabel, color: `var(--${st.color})` }}>{st.label}</div>
                <div style={s.scValue}>{formatMoney(info.total)}</div>
                <div style={s.scCount}>{info.count} txn{info.count !== 1 ? 's' : ''}</div>
              </div>
            )
          })}
        </div>

        {/* Filter + Eligible Transactions */}
        <div style={s.sectionHeader}>
          <h2 style={s.sectionTitle}>Flag a Transaction as NPA</h2>
        </div>
        <div style={s.eligibleList}>
          {(eligibleTxs || []).filter(tx => !tx.npa_status || tx.npa_status === 'active').map(tx => (
            <div key={tx.id} style={s.eligibleRow}>
              <div style={s.eligInfo}>
                <div style={s.eligParty}>{partyMap[tx.party_id]?.name || tx.party_id.slice(0, 8)}</div>
                <div style={s.eligMeta}>{tx.date} · Balance: {formatMoney(tx.balance_due)}</div>
              </div>
              <button style={s.declareBtn} onClick={() => { haptic(); setDeclareTarget(tx) }}>
                Declare NPA
              </button>
            </div>
          ))}
          {(!eligibleTxs || eligibleTxs.filter(tx => !tx.npa_status || tx.npa_status === 'active').length === 0) && (
            <div style={s.emptyState}>No eligible transactions for NPA declaration.</div>
          )}
        </div>

        {/* Existing NPA Transactions */}
        <div style={{ ...s.sectionHeader, marginTop: '40px' }}>
          <h2 style={s.sectionTitle}>Flagged NPA Transactions</h2>
          <div style={s.filterRow}>
            <button style={{ ...s.filterBtn, ...(filter === 'all' ? s.filterActive : {}) }}
              onClick={() => setFilter('all')}>All</button>
            {NPA_STATUSES.map(st => (
              <button key={st.key} style={{ ...s.filterBtn, ...(filter === st.key ? s.filterActive : {}) }}
                onClick={() => setFilter(st.key)}>{st.label}</button>
            ))}
          </div>
        </div>
        <div style={s.npaList}>
          {npaTxs.map(tx => (
            <div key={tx.id} style={s.npaRow}>
              <div style={s.npaLeft}>
                <div style={s.npaParty}>{partyMap[tx.party_id]?.name || 'Unknown'}</div>
                <div style={s.npaMeta}>
                  {tx.date} · Status: <span style={{ color: `var(--${NPA_STATUSES.find(s => s.key === tx.npa_status)?.color || 'red'})`, fontWeight: 800 }}>{tx.npa_status}</span>
                </div>
                {tx.npa_reason && <div style={s.npaReason}>Reason: {tx.npa_reason}</div>}
              </div>
              <div style={s.npaRight}>
                <div style={s.npaAmount}>{formatMoney(tx.write_off_amount || tx.balance_due || tx.total)}</div>
                {tx.npa_status !== 'loss' && (
                  <button style={s.writeOffBtn} onClick={() => { haptic(); setWriteOffTarget(tx) }}>
                    Write Off
                  </button>
                )}
              </div>
            </div>
          ))}
          {npaTxs.length === 0 && (
            <div style={s.emptyState}>No NPA transactions found for selected filter.</div>
          )}
        </div>
      </div>

      {/* Declare NPA Modal */}
      {declareTarget && (
        <DeclareNPAModal transaction={declareTarget} party={partyMap[declareTarget.party_id]}
          onClose={() => setDeclareTarget(null)} onDeclare={handleDeclare} />
      )}

      {/* Write Off Modal */}
      {writeOffTarget && (
        <WriteOffModal transaction={writeOffTarget} party={partyMap[writeOffTarget.party_id]}
          onClose={() => setWriteOffTarget(null)} onWriteOff={handleWriteOff} />
      )}
    </div>
  )
}

function DeclareNPAModal({ transaction, party, onClose, onDeclare }) {
  const [status, setStatus] = useState('watchlist')
  const [reason, setReason] = useState('')

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Declare NPA</h2>
          <p style={s.modalSub}>{party?.name} — {formatMoney(transaction.balance_due)} outstanding</p>
        </div>
        <div style={s.modalBody}>
          <div style={s.mField}>
            <label style={s.mLabel}>NPA Category</label>
            <div style={s.npaSelect}>
              {NPA_STATUSES.map(st => (
                <button key={st.key} style={{
                  ...s.npaOpt,
                  ...(status === st.key ? { background: `var(--${st.color}-dim)`, borderColor: `var(--${st.color})`, color: `var(--${st.color})` } : {}),
                }} onClick={() => setStatus(st.key)}>{st.label}</button>
              ))}
            </div>
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>Reason</label>
            <textarea style={{ ...s.mInput, height: '80px' }} placeholder="Why is this being declared NPA?"
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div style={s.warningBox}>
            This action is irreversible and will be logged in the audit trail.
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={s.declareConfirmBtn} onClick={() => onDeclare(status, reason)} disabled={!reason.trim()}>
            Confirm Declaration
          </button>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function WriteOffModal({ transaction, party, onClose, onWriteOff }) {
  const [amount, setAmount] = useState(transaction.balance_due || transaction.total || 0)
  const [reason, setReason] = useState(transaction.npa_reason || '')

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Write Off as Loss</h2>
          <p style={s.modalSub}>{party?.name} — Max: {formatMoney(transaction.balance_due || transaction.total)}</p>
        </div>
        <div style={s.modalBody}>
          <div style={s.mField}>
            <label style={s.mLabel}>Write-off Amount</label>
            <input type="number" style={{ ...s.mInput, fontSize: '24px', fontWeight: 800, fontFamily: 'var(--mono)', textAlign: 'center' }}
              value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>Reason for Write-off</label>
            <textarea style={{ ...s.mInput, height: '80px' }} value={reason}
              onChange={e => setReason(e.target.value)} />
          </div>
          <div style={s.warningBox}>
            This will move {formatMoney(amount)} to business loss. This action is PERMANENT.
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={{ ...s.declareConfirmBtn, background: 'var(--red)', color: '#fff' }}
            onClick={() => onWriteOff(amount, reason)}>
            Confirm Write-off
          </button>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
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
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  title: { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },
  body: { flex: 1, padding: '32px', overflowY: 'auto' },

  summaryGrid: { display: 'grid', gridTemplateColumns: '2fr repeat(4, 1fr)', gap: '16px', marginBottom: '40px' },
  totalCard: { background: 'var(--glass)', borderRadius: '24px', padding: '24px', border: '1px solid var(--glass-border)', gridColumn: 'span 1' },
  totalLabel: { fontSize: '11px', color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' },
  totalValue: { fontSize: '32px', fontWeight: 900, fontFamily: 'var(--mono)', color: 'var(--red)', marginTop: '8px', letterSpacing: '-0.04em' },
  totalSub: { fontSize: '12px', color: 'var(--text3)', marginTop: '8px' },
  statusCard: { background: 'var(--glass)', borderRadius: '20px', padding: '20px', border: '1px solid var(--glass-border)' },
  scLabel: { fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  scValue: { fontSize: '20px', fontWeight: 800, fontFamily: 'var(--mono)', marginTop: '8px' },
  scCount: { fontSize: '10px', color: 'var(--text3)', marginTop: '4px' },

  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  sectionTitle: { fontSize: '15px', fontWeight: 800, color: 'var(--text)' },
  filterRow: { display: 'flex', gap: '6px' },
  filterBtn: { padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text3)', fontSize: '11px', fontWeight: 700, cursor: 'pointer' },
  filterActive: { background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber-border)' },

  eligibleList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  eligibleRow: {
    background: 'var(--glass)', borderRadius: '16px', padding: '16px 20px',
    border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  eligInfo: {},
  eligParty: { fontSize: '14px', fontWeight: 700 },
  eligMeta: { fontSize: '11px', color: 'var(--text3)', marginTop: '4px' },
  declareBtn: {
    padding: '8px 16px', borderRadius: '10px', background: 'var(--red-dim)', color: 'var(--red)',
    border: '1px solid var(--red-border)', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
  },

  npaList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  npaRow: {
    background: 'var(--glass)', borderRadius: '16px', padding: '20px 24px',
    border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  npaLeft: {},
  nppaParty: { fontSize: '15px', fontWeight: 700 },
  npaParty: { fontSize: '15px', fontWeight: 700 },
  npaMeta: { fontSize: '11px', color: 'var(--text3)', marginTop: '4px' },
  npaReason: { fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontStyle: 'italic' },
  npaRight: { textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' },
  npaAmount: { fontSize: '18px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--red)' },
  writeOffBtn: {
    padding: '6px 14px', borderRadius: '8px', background: 'var(--red)', color: '#fff',
    border: 'none', fontSize: '11px', fontWeight: 800, cursor: 'pointer',
  },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' },
  modal: { width: '100%', maxWidth: '480px', background: 'var(--bg)', borderRadius: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.7)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  modalHeader: { padding: '28px 32px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-highlight)' },
  modalTitle: { fontSize: '20px', fontWeight: 800, color: 'var(--text)' },
  modalSub: { fontSize: '12px', color: 'var(--text3)', marginTop: '4px' },
  modalBody: { padding: '32px' },
  modalFooter: { padding: '20px 32px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  mField: { marginBottom: '24px' },
  mLabel: { display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' },
  mInput: { width: '100%', padding: '16px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '14px', outline: 'none' },
  npaSelect: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  npaOpt: { padding: '14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--glass)', color: 'var(--text2)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', textAlign: 'center' },
  warningBox: { padding: '14px', background: 'var(--red-dim)', border: '1px solid var(--red-border)', borderRadius: '12px', color: 'var(--red)', fontSize: '12px', fontWeight: 700 },
  declareConfirmBtn: { padding: '14px 28px', borderRadius: '14px', background: 'var(--amber)', color: '#000', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer' },
  cancelBtn: { padding: '14px 28px', borderRadius: '14px', background: 'transparent', color: 'var(--text3)', border: 'none', fontWeight: 700, fontSize: '14px', cursor: 'pointer' },
  emptyState: { padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '14px' },
}
