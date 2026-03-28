import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useConfig } from '../hooks/useConfig.js'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { createRecord, updateRecord, formatMoney, haptic, debounce, now, escapeRegex, uuid } from '../helpers.js'

/**
 * PartiesScreen - High-end relationship & credit management.
 */
export default function PartiesScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()
  const { config } = useConfig()

  const [search, setSearch] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filter, setFilter] = useState('customer')
  const [activeParty, setActiveParty] = useState(null)
  const [showWizard, setShowWizard] = useState(false)
  const [error, setError] = useState('')

  // Debounced search
  const updateQuery = useCallback(debounce(q => setDebouncedQuery(q), 300), [])
  useEffect(() => updateQuery(search), [search])

  const { result: parties } = useRxQuery(
    db?.parties.find({
      selector: { 
        business_id: currentUser?.business_id, 
        type: filter, 
        $or: [
            { name: { $regex: escapeRegex(debouncedQuery), $options: 'i' } }, 
            { phone: { $regex: escapeRegex(debouncedQuery), $options: 'i' } }
        ] 
      },
      sort: [{ name: 'asc' }]
    }),
    { live: true }
  )

  const stats = useMemo(() => {
    if (!parties) return { receiving: 0, paying: 0 }
    return parties.reduce((acc, p) => {
      if (p.balance < 0) acc.receiving += Math.abs(p.balance)
      else acc.paying += p.balance
      return acc
    }, { receiving: 0, paying: 0 })
  }, [parties])

  const handleCreate = async (data) => {
    haptic()
    setError('')
    try {
      await createRecord('parties', {
        ...data,
        balance: data.opening_balance || 0,
        npa: false,
      }, { user_id: currentUser.id })
      setShowWizard(false)
    } catch (err) {
      console.error('Failed to register party:', err)
      setError('Failed to register party: ' + err.message)
    }
  }

  if (activeParty) return (
    <LedgerView 
      partyId={activeParty.id} 
      onClose={() => { haptic(); setActiveParty(null) }} 
      db={db} 
      currentUser={currentUser}
      businessName={config?.business_name || 'Business OS'}
    />
  )

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Relationship Directory</h1>
          <div style={s.statsStrip}>
            <div style={s.statBox}>
              <span style={s.statLabel}>Total Receivables</span>
              <span style={{ ...s.statVal, color: 'var(--teal)' }}>{formatMoney(stats.receiving)}</span>
            </div>
            <div style={s.statBox}>
              <span style={s.statLabel}>Total Payables</span>
              <span style={{ ...s.statVal, color: 'var(--red)' }}>{formatMoney(stats.paying)}</span>
            </div>
          </div>
        </div>
        <button style={s.addBtn} onClick={() => { haptic(); setShowWizard(true) }}>⊕ New Relationship</button>
      </header>

      {error && <div style={s.errorBanner}>{error}<button style={s.errorClose} onClick={() => setError('')}>×</button></div>}

      <div style={s.body}>
        <div style={s.filterBar}>
          <div style={s.searchWrap}>
            <span style={{ opacity: 0.5 }}>🔍</span>
            <input style={s.search} placeholder="Filter by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={s.toggle}>
            <button style={{ ...s.toggleBtn, ...(filter === 'customer' ? s.toggleActive : {}) }} 
              onClick={() => { haptic(); setFilter('customer') }}>Customers</button>
            <button style={{ ...s.toggleBtn, ...(filter === 'vendor' ? s.toggleActive : {}) }} 
              onClick={() => { haptic(); setFilter('vendor') }}>Suppliers</button>
          </div>
        </div>

        <div style={s.list}>
          {parties?.map(p => (
            <div key={p.id} style={{ ...s.partyCard, borderLeft: `4px solid ${p.balance < 0 ? 'var(--teal)' : (p.balance > 0 ? 'var(--red)' : 'var(--glass-border)')}` }} 
              onClick={() => { haptic(); setActiveParty(p) }}>
              {p.npa && <div style={s.npaBadge}>NPA RISK</div>}
              <div style={s.pTop}>
                <div style={s.pName}>{p.name}</div>
                <div style={{ ...s.pBal, color: p.balance < 0 ? 'var(--teal)' : 'var(--red)' }}>
                   {p.balance < 0 ? 'RECEIVABLE' : (p.balance > 0 ? 'PAYABLE' : 'SETTLED')}
                   <div style={s.pAmount}>{formatMoney(Math.abs(p.balance))}</div>
                </div>
              </div>
              <div style={s.pBottom}>
                <div style={s.pInfo}><span style={{ opacity: 0.5 }}>📱</span> {p.phone || 'No phone'}</div>
                {p.credit_limit > 0 && <div style={s.creditLimit}>Limit: {formatMoney(p.credit_limit)}</div>}
              </div>
            </div>
          ))}
          {parties?.length === 0 && <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)', gridColumn: '1/-1' }}>No results found for current filter.</div>}
        </div>
      </div>

      {showWizard && <PartyWizard onClose={() => setShowWizard(false)} onSave={handleCreate} initialType={filter} />}
    </div>
  )
}

function LedgerView({ partyId, onClose, db, currentUser, businessName }) {
  const { result: party } = useRxQuery(db.parties.findOne(partyId), { live: true, isDoc: true })
  const { result: txs } = useRxQuery(db.transactions.find({ selector: { party_id: partyId }, sort: [{ date: 'desc' }] }), { live: true })
  const { result: pays } = useRxQuery(db.payments.find({ selector: { party_id: partyId }, sort: [{ date: 'desc' }] }), { live: true })
  
  const [showPayModal, setShowPayModal] = useState(false)
  const [payError, setPayError] = useState('')

  const entries = useMemo(() => {
    const combined = [
      ...(txs || []).map(t => ({ id: t.id, date: t.date, label: `${t.tx_type.toUpperCase()} #${t.id.slice(0,6)}`, amount: t.total, type: 'tx' })),
      ...(pays || []).map(p => ({ id: p.id, date: p.date, label: `PAYMENT (${p.mode || 'CASH'})`, amount: p.amount, type: 'pay' }))
    ]
    return combined.sort((a,b) => b.date.localeCompare(a.date))
  }, [txs, pays])

  const handleRecordPayment = async (amount, method, notes) => {
    haptic()
    try {
      await createRecord('payments', {
        transaction_id: uuid(), // Generate valid UUID for MANUAL payments
        party_id: partyId,
        amount,
        mode: method, // Changed from payment_method to mode (schema field)
        date: now().split('T')[0],
        reference: '', // Added required schema field
        notes: notes || 'Manual ledger entry',
      }, { user_id: currentUser.id })
      
      // Balance impact: 
      // If Customer pays IN (receivable decreases), if Supplier pays OUT (payable decreases)
      const mod = party.type === 'customer' ? 1 : -1
      await updateRecord('parties', partyId, { 
        balance: party.balance + (amount * mod)
      }, { user_id: currentUser.id, note: notes || 'Manual ledger entry' })
      setShowPayModal(false)
    } catch (err) {
      console.error('Payment record failed:', err)
      setPayError('Payment record failed: ' + err.message)
    }
  }

  const toggleNPA = async () => {
    haptic()
    await updateRecord('parties', party.id, { 
        npa: !party.npa 
    }, { user_id: currentUser.id, note: `NPA status changed to ${!party.npa}` })
  }

  const shareStatement = () => {
    haptic()
    const isReceivable = party.balance < 0
    const absBal = formatMoney(Math.abs(party.balance))
    const message = `Hello ${party.name},\n\nThis is a financial status update from ${businessName}.\n\nYour current account balance is *${absBal}* (${isReceivable ? 'Receivable' : 'Payable'}).\n\nGenerated via Business OS Cloud.`
    const url = `https://wa.me/${party.phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!party) return null

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={onClose}>←</button>
          <div><h1 style={s.title}>{party.name}</h1><p style={s.subTitle}>Account Statement / Ledger</p></div>
        </div>
        <div style={s.headerRight}>
           <button style={s.shareBtn} onClick={shareStatement}>📤 WhatsApp Statement</button>
           <button style={{ ...s.npaBtn, background: party.npa ? 'var(--red-dim)' : 'var(--surface2)', borderColor: party.npa ? 'var(--red-border)' : 'var(--glass-border)', color: party.npa ? 'var(--red)' : 'var(--text)' }} onClick={toggleNPA}>
             {party.npa ? '⚠️ High Risk NPA' : 'Flag as NPA'}
           </button>
           <button style={s.addBtn} onClick={() => { haptic(); setShowPayModal(true) }}>Record Settlement</button>
        </div>
      </header>

      {payError && <div style={s.errorBanner}>{payError}<button style={s.errorClose} onClick={() => setPayError('')}>×</button></div>}

      <div style={s.body}>
        <div style={s.ledgerTableWrap}>
           <table style={s.ledgerTable}>
             <thead>
                <tr style={s.lThRow}>
                    <th style={s.lTh}>Transaction Date</th>
                    <th style={s.lTh}>Particulars</th>
                    <th style={{ ...s.lTh, textAlign: 'right' }}>DEBIT (IN)</th>
                    <th style={{ ...s.lTh, textAlign: 'right' }}>CREDIT (OUT)</th>
                </tr>
             </thead>
             <tbody>
               {entries.map(e => (
                 <tr key={e.id} style={s.lTr}>
                   <td style={{ ...s.lTd, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{new Date(e.date).toLocaleDateString()}</td>
                   <td style={{ ...s.lTd, fontWeight: 700 }}>{e.label}</td>
                   <td style={{ ...s.lTd, textAlign: 'right', color: 'var(--teal)', fontWeight: 800, fontFamily: 'var(--mono)' }}>{e.type === 'pay' ? formatMoney(e.amount) : ''}</td>
                   <td style={{ ...s.lTd, textAlign: 'right', color: 'var(--red)', fontWeight: 800, fontFamily: 'var(--mono)' }}>{e.type === 'tx' ? formatMoney(e.amount) : ''}</td>
                 </tr>
               ))}
               {entries.length === 0 && <tr><td colSpan="4" style={{ padding: '60px', textAlign: 'center', color: 'var(--text3)' }}>No transactions found for this party.</td></tr>}
             </tbody>
             <tfoot>
                <tr style={{ background: 'var(--glass-highlight)', fontWeight: 800 }}>
                    <td colSpan="2" style={{ ...s.lTd, textAlign: 'right', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}>Current Net Balance:</td>
                    <td colSpan="2" style={{ ...s.lTd, textAlign: 'right', fontSize: '18px', color: party.balance < 0 ? 'var(--teal)' : 'var(--red)' }}>
                        {formatMoney(Math.abs(party.balance))} {party.balance < 0 ? '(IN)' : '(OUT)'}
                    </td>
                </tr>
             </tfoot>
           </table>
        </div>
      </div>
      
      {showPayModal && <PaymentModal party={party} onClose={() => setShowPayModal(false)} onSave={handleRecordPayment} />}
    </div>
  )
}

function PaymentModal({ party, onClose, onSave }) {
  const [amount, setAmount] = useState(0)
  const [mode, setMode] = useState('Cash')
  const [notes, setNotes] = useState('')
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}><h2 style={s.modalTitle}>Settle Account: {party.name}</h2></div>
        <div style={s.modalBody}>
          <div style={s.mField}>
            <label style={s.mLabel}>Amount (RS)</label>
            <input autoFocus type="number" style={{ ...s.mInput, fontSize: '24px', fontWeight: 800, fontFamily: 'var(--mono)' }} 
                value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>Channel</label>
            <select style={s.mSelect} value={mode} onChange={e => setMode(e.target.value)}>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank Transfer</option>
                <option value="UPI">UPI / Digital</option>
                <option value="Adjustment">Balance Adjustment</option>
            </select>
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>Reference / Notes</label>
            <input style={s.mInput} placeholder="Optional" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <div style={s.modalFooter}>
            <button style={s.saveBtn} onClick={() => onSave(amount, mode, notes)}>Record Entry</button>
        </div>
      </div>
    </div>
  )
}

function PartyWizard({ onClose, onSave, initialType }) {
  const [data, setData] = useState({ name: '', phone: '', type: initialType, opening_balance: 0, credit_limit: 0 })
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}><h2 style={s.modalTitle}>Register New {data.type === 'customer' ? 'Customer' : 'Supplier'}</h2></div>
        <div style={s.modalBody}>
          <div style={s.mField}>
            <label style={s.mLabel}>Full Business/Personal Name</label>
            <input autoFocus style={s.mInput} placeholder="e.g. Acme Innovations" value={data.name} onChange={e => setData(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>Whatsapp / Mobile</label>
            <input style={s.mInput} placeholder="+91..." value={data.phone} onChange={e => setData(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div style={s.row}>
            <div style={s.mField}>
                <label style={s.mLabel}>Opening Bal</label>
                <input type="number" style={s.mInput} value={data.opening_balance} onChange={e => setData(p => ({ ...p, opening_balance: parseFloat(e.target.value) }))} />
                <p style={s.hint}>+ for Payable, - for Receivable</p>
            </div>
            <div style={s.mField}>
                <label style={s.mLabel}>Credit Limit</label>
                <input type="number" style={s.mInput} value={data.credit_limit} onChange={e => setData(p => ({ ...p, credit_limit: parseFloat(e.target.value) }))} />
            </div>
          </div>
        </div>
        <div style={s.modalFooter}>
            <button style={s.saveBtn} onClick={() => onSave(data)}>Save Relationship</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: { padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', zIndex: 10 },
  headerLeft: { display: 'flex', gap: '24px', alignItems: 'center' },
  headerRight: { display: 'flex', gap: '16px' },
  title: { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' },
  statsStrip: { display: 'flex', gap: '32px' },
  statBox: { display: 'flex', flexDirection: 'column', gap: '4px' },
  statLabel: { fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 },
  statVal: { fontSize: '18px', fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: '-0.03em' },
  addBtn: { padding: '14px 28px', background: 'var(--grad-amber)', color: '#000', borderRadius: '16px', fontWeight: 800, border: 'none', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' },
  shareBtn: { padding: '12px 20px', borderRadius: '14px', background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--teal-border)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  npaBtn: { padding: '12px 20px', borderRadius: '14px', border: '1px solid var(--glass-border)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' },

  body: { flex: 1, padding: '32px', overflowY: 'auto' },
  filterBar: { display: 'flex', justifyContent: 'space-between', marginBottom: '32px', gap: '24px' },
  searchWrap: { flex: 1, background: 'var(--glass)', borderRadius: '20px', padding: '18px 24px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--glass-shadow)' },
  search: { background: 'none', border: 'none', color: 'var(--text)', width: '100%', fontSize: '15px', outline: 'none' },
  toggle: { display: 'flex', background: 'var(--glass-highlight)', padding: '5px', borderRadius: '16px', border: '1px solid var(--glass-border)' },
  toggleBtn: { padding: '10px 24px', borderRadius: '12px', border: 'none', color: 'var(--text3)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'transparent', transition: 'all 0.2s' },
  toggleActive: { background: 'var(--bg)', color: 'var(--amber)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' },

  list: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' },
  partyCard: { background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: '28px', padding: '28px', cursor: 'pointer', position: 'relative', boxShadow: 'var(--glass-shadow)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' },
  npaBadge: { position: 'absolute', top: '16px', right: '16px', background: 'var(--red)', color: '#fff', fontSize: '10px', fontWeight: 900, padding: '5px 10px', borderRadius: '8px', letterSpacing: '0.05em' },
  pTop: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
  pName: { fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' },
  pBal: { textAlign: 'right', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
  pAmount: { fontSize: '20px', marginTop: '6px', fontFamily: 'var(--mono)', fontWeight: 800 },
  pBottom: { display: 'flex', justifyContent: 'space-between', color: 'var(--text2)', fontSize: '13px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' },
  pInfo: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 },
  creditLimit: { background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--text3)' },

  backBtn: { width: '48px', height: '48px', borderRadius: '16px', background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)', color: '#fff', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ledgerTableWrap: { background: 'var(--glass)', borderRadius: '32px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)', animation: 'fadeIn 0.5s ease both' },
  ledgerTable: { width: '100%', borderCollapse: 'collapse' },
  lTh: { padding: '20px 24px', background: 'rgba(255,255,255,0.04)', fontSize: '11px', color: 'var(--text3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 800 },
  lTr: { borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' },
  lTd: { padding: '22px 24px', fontSize: '14px' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' },
  modal: { width: '100%', maxWidth: '450px', background: 'var(--bg)', borderRadius: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.7)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  modalHeader: { padding: '32px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-highlight)' },
  modalTitle: { fontSize: '20px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' },
  modalBody: { padding: '32px' },
  mField: { marginBottom: '24px' },
  mLabel: { display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' },
  mInput: { width: '100%', padding: '16px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '15px', outline: 'none' },
  mSelect: { width: '100%', padding: '16px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '15px', outline: 'none' },
  modalFooter: { padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' },
  saveBtn: { padding: '16px 32px', background: 'var(--grad-amber)', color: '#000', borderRadius: '16px', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  hint: { fontSize: '11px', color: 'var(--text3)', marginTop: '8px', fontWeight: 600 },
}
