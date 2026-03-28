import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { useConfig } from '../hooks/useConfig.js'
import { useToast } from '../components/ui/Toast.jsx'
import { createRecord, updateRecord, formatMoney, haptic, debounce, now, escapeRegex } from '../helpers.js'

/**
 * InventoryScreen - Premium product & stock management.
 */
export default function InventoryScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()
  const { isPluginEnabled } = useConfig()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showWizard, setShowWizard] = useState(false)
  const [historyItem, setHistoryItem] = useState(null)
  const [adjustItem, setAdjustItem] = useState(null)

  // Debounced search
  const updateQuery = useCallback(debounce(q => setDebouncedQuery(q), 300), [])
  useEffect(() => updateQuery(search), [search])

  const { result: items } = useRxQuery(
    db?.items.find({
      selector: {
        business_id: currentUser?.business_id,
        $or: [
          { name: { $regex: escapeRegex(debouncedQuery), $options: 'i' } },
          { field_1_value: { $regex: escapeRegex(debouncedQuery), $options: 'i' } }
        ]
      },
      sort: [{ name: 'asc' }]
    }),
    { live: true }
  )

  const handleCreate = async (data) => {
    haptic()
    try {
      await createRecord('items', {
        ...data,
        stock_qty: data.opening_stock,
      }, { user_id: currentUser.id })
      setShowWizard(false)
    } catch (err) {
      toast.addToast('Failed to create item: ' + err.message, 'error')
    }
  }

  const handleAdjust = async (id, qtyChange, reason) => {
    haptic()
    try {
      const doc = await db.items.findOne(id).exec()
      if (doc) {
        await updateRecord('items', id, { 
          stock_qty: doc.stock_qty + qtyChange 
        }, { user_id: currentUser.id, note: reason })
        await createRecord('stock_adjustments', {
          item_id: id,
          qty_change: qtyChange,
          reason,
          date: now().split('T')[0],
        }, { user_id: currentUser.id })
      }
      setAdjustItem(null)
    } catch (err) {
      toast.addToast('Adjustment failed: ' + err.message, 'error')
    }
  }

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Inventory Control</h1>
          <p style={s.subTitle}>{items?.length || 0} Products tracked</p>
        </div>
        <button style={s.addBtn} onClick={() => { haptic(); setShowWizard(true) }}>⊕ Add New Product</button>
      </header>

      <div style={s.body}>
        <div style={s.filterRow}>
          <div style={s.searchWrap}>
            <span style={{ opacity: 0.5 }}>🔍</span>
            <input style={s.search} placeholder="Search name or HSN code..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div style={s.grid}>
          {items?.map(item => (
            <div key={item.id} style={{ ...s.card, borderLeft: `4px solid ${item.stock_qty <= (item.low_stock_alert || 0) ? 'var(--red)' : 'var(--teal)'}` }}>
              <div style={s.cardHeader}>
                <div style={s.itemName}>{item.name}</div>
                <div style={s.itemHsn}>HSN: {item.field_1_value || 'EXEMPT'}</div>
              </div>
              <div style={s.stockRow}>
                <div style={s.stockVal}>
                  <div style={{ ...s.stockValueText, color: item.stock_qty <= (item.low_stock_alert || 0) ? 'var(--red)' : 'var(--text)' }}>
                    {item.stock_qty}
                  </div>
                  <div style={s.stockUnit}>{item.unit} available</div>
                </div>
                <div style={s.cardActions}>
                  <button style={s.miniBtn} onClick={() => { haptic(); setHistoryItem(item) }}>📋 Log</button>
                  <button style={{ ...s.miniBtn, background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber-border)' }} 
                    onClick={() => { haptic(); setAdjustItem(item) }}>⚖️ Adjust</button>
                </div>
              </div>
            </div>
          ))}
          {items?.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>No products found.</div>}
        </div>
      </div>

      {showWizard && <ItemModal onClose={() => setShowWizard(false)} onSave={handleCreate} />}
      {adjustItem && <AdjustmentModal item={adjustItem} onClose={() => setAdjustItem(null)} onAdjust={handleAdjust} />}
      {historyItem && <HistoryModal item={historyItem} db={db} onClose={() => setHistoryItem(null)} />}
    </div>
  )
}

function AdjustmentModal({ item, onClose, onAdjust }) {
  const [val, setVal] = useState(0)
  const [reason, setReason] = useState('Correction')
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}><h2 style={s.modalTitle}>Adjust Stock: {item.name}</h2></div>
        <div style={s.modalBody}>
          <div style={s.mField}>
            <label style={s.mLabel}>Quantity Change</label>
            <input type="number" style={s.mInput} value={val} onChange={e => setVal(parseInt(e.target.value) || 0)} />
            <p style={s.hint}>Positive to add, negative to subtract.</p>
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>Reason for adjustment</label>
            <select style={s.mSelect} value={reason} onChange={e => setReason(e.target.value)}>
              <option value="Correction">Data Correction</option>
              <option value="Damaged">Waste / Damaged</option>
              <option value="Returned">Customer Return</option>
              <option value="Opening Stock">Opening Stock Adjustment</option>
            </select>
          </div>
          <div style={s.previewVal}>
            Resulting Stock: <b>{item.stock_qty + val} {item.unit}</b>
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={s.saveBtn} onClick={() => onAdjust(item.id, val, reason)}>Commit Adjustment</button>
        </div>
      </div>
    </div>
  )
}

function HistoryModal({ item, db, onClose }) {
  const { result: adjustments } = useRxQuery(db.stock_adjustments.find({ selector: { item_id: item.id }, sort: [{ created_at: 'desc' }] }), { live: true })
  const { result: txLines } = useRxQuery(db.transaction_lines.find({ selector: { item_id: item.id }, limit: 20 }), { live: true })

  const log = useMemo(() => {
    const combined = [
      ...(adjustments || []).map(a => ({ id: a.id, type: 'adjustment', qty: a.qty_change, reason: a.reason, date: a.created_at })),
      ...(txLines || []).map(l => ({ id: l.id, type: 'transaction', qty: -l.qty, reason: 'Business Operation', date: l.created_at || l.id }))
    ]
    return combined.sort((a,b) => b.date.localeCompare(a.date))
  }, [adjustments, txLines])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, width: '600px' }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}><h2 style={s.modalTitle}>Movement History: {item.name}</h2></div>
        <div style={{ ...s.modalBody, maxHeight: '50vh', overflowY: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 20px' }}>Date</th>
                <th style={{ padding: '16px' }}>Event</th>
                <th style={{ padding: '16px 20px', textAlign: 'right' }}>Δ Qty</th>
              </tr>
            </thead>
            <tbody>
              {log.map(entry => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--glass-border)', fontSize: '13px' }}>
                  <td style={{ padding: '16px 20px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{new Date(entry.date).toLocaleDateString()}</td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700 }}>{entry.reason}</div>
                    <div style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase' }}>{entry.type}</div>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', color: entry.qty > 0 ? 'var(--teal)' : 'var(--red)', fontWeight: 800, fontFamily: 'var(--mono)' }}>
                    {entry.qty > 0 ? '+' : ''}{entry.qty}
                  </td>
                </tr>
              ))}
              {log.length === 0 && <tr><td colSpan="3" style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>No history available.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ItemModal({ onClose, onSave }) {
  const [data, setData] = useState({ name: '', field_1_value: '', unit: 'pcs', sell_price_retail: 0, sell_price_wholesale: 0, opening_stock: 0, low_stock_alert: 5, active: true, item_type: 'product' })
  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}><h2 style={s.modalTitle}>Catalog New Product</h2></div>
        <div style={s.modalBody}>
          <div style={s.mField}>
            <label style={s.mLabel}>Product Title</label>
            <input autoFocus style={s.mInput} placeholder="e.g. Premium Cotton Fabric" value={data.name} onChange={e => setData(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>HSN Code</label>
            <input style={s.mInput} placeholder="8-digit code" value={data.field_1_value} onChange={e => setData(p => ({ ...p, field_1_value: e.target.value }))} />
          </div>
          <div style={s.row}>
            <div style={s.mField}><label style={s.mLabel}>Retail Unit Price</label><input type="number" style={s.mInput} value={data.sell_price_retail} onChange={e => setData(p => ({ ...p, sell_price_retail: parseFloat(e.target.value) || 0 }))} /></div>
            <div style={s.mField}><label style={s.mLabel}>Stock Unit</label><input style={s.mInput} value={data.unit} onChange={e => setData(p => ({ ...p, unit: e.target.value }))} /></div>
          </div>
          <div style={s.row}>
            <div style={s.mField}><label style={s.mLabel}>Opening Inventory</label><input type="number" style={s.mInput} value={data.opening_stock} onChange={e => setData(p => ({ ...p, opening_stock: parseInt(e.target.value) || 0 }))} /></div>
            <div style={s.mField}><label style={s.mLabel}>Low Stock Alert At</label><input type="number" style={s.mInput} value={data.low_stock_alert} onChange={e => setData(p => ({ ...p, low_stock_alert: parseInt(e.target.value) || 0 }))} /></div>
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={s.saveBtn} onClick={() => onSave(data)}>Save to Catalog</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: { padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 10 },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  title: { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },
  addBtn: { padding: '14px 28px', background: 'var(--grad-amber)', color: '#000', borderRadius: '16px', fontWeight: 800, border: 'none', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' },
  body: { flex: 1, padding: '32px', overflowY: 'auto' },
  filterRow: { marginBottom: '32px' },
  searchWrap: { background: 'var(--glass)', borderRadius: '20px', padding: '18px 24px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'var(--glass-shadow)' },
  search: { background: 'none', border: 'none', color: 'var(--text)', width: '100%', fontSize: '15px', outline: 'none' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' },
  card: { background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)', borderRadius: '28px', padding: '24px', position: 'relative', overflow: 'hidden', boxShadow: 'var(--glass-shadow)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' },
  cardHeader: { marginBottom: '20px' },
  itemName: { fontSize: '17px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' },
  itemHsn: { fontSize: '11px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'var(--mono)', fontWeight: 600 },
  stockRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--glass-highlight)', padding: '20px', borderRadius: '20px', border: '1px solid var(--glass-border)' },
  stockVal: { display: 'flex', flexDirection: 'column' },
  stockValueText: { fontSize: '28px', fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: '-0.05em' },
  stockUnit: { fontSize: '11px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' },
  cardActions: { display: 'flex', gap: '10px' },
  miniBtn: { padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },
  
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' },
  modal: { width: '100%', maxWidth: '500px', background: 'var(--bg)', borderRadius: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  modalHeader: { padding: '28px 32px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-highlight)' },
  modalTitle: { fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' },
  modalBody: { padding: '32px' },
  modalFooter: { padding: '24px 32px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' },
  mField: { marginBottom: '24px' },
  mLabel: { display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' },
  mInput: { width: '100%', padding: '16px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' },
  mSelect: { width: '100%', padding: '16px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '14px', outline: 'none' },
  saveBtn: { padding: '16px 32px', background: 'var(--grad-amber)', color: '#000', borderRadius: '16px', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  hint: { fontSize: '11px', color: 'var(--text3)', marginTop: '8px' },
  previewVal: { marginTop: '20px', padding: '16px', background: 'var(--amber-dim)', borderRadius: '14px', color: 'var(--amber)', fontSize: '14px', textAlign: 'center' },
}
