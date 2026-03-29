import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { useToast } from '../components/ui/Toast.jsx'
import { createRecord, updateRecord, formatMoney, haptic, debounce, escapeRegex } from '../helpers.js'
import { getUnitInfo, formatQtyWithUnit } from '../config/units.js'

/**
 * RateCardScreen — Daily rate management for all items.
 * Supports per-day pricing, bulk copy, and rate change history.
 */
export default function RateCardScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()
  const toast = useToast()

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [editRates, setEditRates] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [historyItem, setHistoryItem] = useState(null)

  const updateQuery = useCallback(debounce(q => setDebouncedQuery(q), 300), [])
  useEffect(() => updateQuery(search), [search])

  const { result: items } = useRxQuery(
    db?.items.find({
      selector: {
        business_id: currentUser?.business_id,
        active: true,
        name: { $regex: escapeRegex(debouncedQuery), $options: 'i' }
      },
      sort: [{ name: 'asc' }]
    }),
    { live: true }
  )

  const { result: todayRates } = useRxQuery(
    db?.rate_cards.find({
      selector: {
        business_id: currentUser?.business_id,
        date: selectedDate
      }
    }),
    { live: true }
  )

  const rateMap = useMemo(() => {
    const map = {}
    if (todayRates) todayRates.forEach(r => { map[r.item_id] = r })
    return map
  }, [todayRates])

  const handleRateChange = (itemId, field, value) => {
    setEditRates(p => ({
      ...p,
      [itemId]: {
        ...p[itemId],
        [field]: parseFloat(value) || 0
      }
    }))
  }

  const getDisplayRate = (item, field) => {
    if (editRates[item.id]?.[field] !== undefined) return editRates[item.id][field]
    const rate = rateMap[item.id]
    if (rate) return rate[field] || 0
    return item[field === 'retail_rate' ? 'sell_price_retail' : field === 'wholesale_rate' ? 'sell_price_wholesale' : 'cost_price'] || 0
  }

  const hasChanges = (itemId) => {
    return editRates[itemId] !== undefined
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    haptic()
    try {
      const changedIds = Object.keys(editRates)
      for (const itemId of changedIds) {
        const existing = rateMap[itemId]
        const newRates = editRates[itemId]
        if (existing) {
          await updateRecord('rate_cards', existing.id, {
            retail_rate: newRates.retail_rate ?? existing.retail_rate,
            wholesale_rate: newRates.wholesale_rate ?? existing.wholesale_rate,
            cost_rate: newRates.cost_rate ?? existing.cost_rate,
            source: 'manual',
          }, { user_id: currentUser.id, note: 'Rate update' })
        } else {
          const item = items?.find(i => i.id === itemId)
          await createRecord('rate_cards', {
            item_id: itemId,
            date: selectedDate,
            retail_rate: newRates.retail_rate ?? item?.sell_price_retail ?? 0,
            wholesale_rate: newRates.wholesale_rate ?? item?.sell_price_wholesale ?? 0,
            cost_rate: newRates.cost_rate ?? item?.cost_price ?? 0,
            source: 'manual',
          }, { user_id: currentUser.id })
        }
      }
      setEditRates({})
      toast.addToast(`${changedIds.length} rate(s) saved for ${selectedDate}`, 'success')
    } catch (err) {
      toast.addToast('Save failed: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyFromYesterday = async () => {
    haptic()
    const yesterday = new Date(selectedDate)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    try {
      const yesterdayRates = await db.rate_cards.find({
        selector: { business_id: currentUser.business_id, date: yesterdayStr }
      }).exec()

      if (yesterdayRates.length === 0) {
        toast.addToast(`No rates found for ${yesterdayStr}`, 'warning')
        return
      }

      const newEditRates = {}
      yesterdayRates.forEach(r => {
        newEditRates[r.item_id] = {
          retail_rate: r.retail_rate,
          wholesale_rate: r.wholesale_rate,
          cost_rate: r.cost_rate,
        }
      })
      setEditRates(newEditRates)
      toast.addToast(`Copied ${yesterdayRates.length} rates from ${yesterdayStr}`, 'success')
    } catch (err) {
      toast.addToast('Copy failed: ' + err.message, 'error')
    }
  }

  const changedCount = Object.keys(editRates).length

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Daily Rate Card</h1>
          <p style={s.subTitle}>Set material prices per day</p>
        </div>
        <div style={s.headerRight}>
          {changedCount > 0 && (
            <button style={s.saveBtn} disabled={isSaving} onClick={handleSave}>
              {isSaving ? 'Saving...' : `Save ${changedCount} Change${changedCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </header>

      <div style={s.body}>
        {/* Date & Search Controls */}
        <div style={s.controls}>
          <div style={s.dateRow}>
            <label style={s.controlLabel}>Rate Date</label>
            <input type="date" style={s.dateInput} value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); setEditRates({}) }} />
            <button style={s.copyBtn} onClick={handleCopyFromYesterday}>
              Copy from Yesterday
            </button>
          </div>
          <div style={s.searchWrap}>
            <span style={{ opacity: 0.5 }}>🔍</span>
            <input style={s.search} placeholder="Search items..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Rate Table */}
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Item</th>
                <th style={s.th}>Unit</th>
                <th style={s.th}>Retail Rate</th>
                <th style={s.th}>Wholesale Rate</th>
                <th style={s.th}>Cost Rate</th>
                <th style={s.th}>Margin</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {items?.map(item => {
                const retail = getDisplayRate(item, 'retail_rate')
                const wholesale = getDisplayRate(item, 'wholesale_rate')
                const cost = getDisplayRate(item, 'cost_rate')
                const margin = retail > 0 ? ((retail - cost) / retail * 100) : 0
                const isChanged = hasChanges(item.id)
                const unitInfo = getUnitInfo(item.selling_unit || item.unit)

                return (
                  <tr key={item.id} style={{
                    ...s.tr,
                    background: isChanged ? 'var(--amber-dim)' : undefined,
                    borderLeft: isChanged ? '3px solid var(--amber)' : '3px solid transparent',
                  }}>
                    <td style={s.td}>
                      <div style={s.itemName}>{item.name}</div>
                      <div style={s.itemSub}>GST {item.gst_rate || 0}%</div>
                    </td>
                    <td style={s.td}>
                      <div style={s.unitLabel}>{unitInfo?.short || item.unit || 'pcs'}</div>
                    </td>
                    <td style={s.td}>
                      <input type="number" style={s.rateInput}
                        value={retail}
                        onChange={e => handleRateChange(item.id, 'retail_rate', e.target.value)} />
                    </td>
                    <td style={s.td}>
                      <input type="number" style={s.rateInput}
                        value={wholesale}
                        onChange={e => handleRateChange(item.id, 'wholesale_rate', e.target.value)} />
                    </td>
                    <td style={s.td}>
                      <input type="number" style={{ ...s.rateInput, color: 'var(--red)' }}
                        value={cost}
                        onChange={e => handleRateChange(item.id, 'cost_rate', e.target.value)} />
                    </td>
                    <td style={s.td}>
                      <div style={{
                        ...s.marginPill,
                        background: margin > 20 ? 'var(--teal-dim)' : margin > 5 ? 'var(--amber-dim)' : 'var(--red-dim)',
                        color: margin > 20 ? 'var(--teal)' : margin > 5 ? 'var(--amber)' : 'var(--red)',
                      }}>
                        {margin.toFixed(1)}%
                      </div>
                    </td>
                    <td style={s.td}>
                      <button style={s.historyBtn} onClick={() => { haptic(); setHistoryItem(item) }}>
                        📊
                      </button>
                    </td>
                  </tr>
                )
              })}
              {items?.length === 0 && (
                <tr><td colSpan="7" style={s.emptyCell}>No items found. Add items in Inventory first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyItem && (
        <RateHistoryModal item={historyItem} db={db} businessId={currentUser.business_id}
          onClose={() => setHistoryItem(null)} />
      )}
    </div>
  )
}

function RateHistoryModal({ item, db, businessId, onClose }) {
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  }, [])

  const { result: rates } = useRxQuery(
    db?.rate_cards.find({
      selector: {
        business_id: businessId,
        item_id: item.id,
        date: { $gte: thirtyDaysAgo }
      },
      sort: [{ date: 'asc' }]
    }),
    { live: true }
  )

  const maxRetail = useMemo(() => {
    if (!rates?.length) return 1
    return Math.max(...rates.map(r => r.retail_rate || 0), 1)
  }, [rates])

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Rate History: {item.name}</h2>
          <p style={s.modalSub}>Last 30 days</p>
        </div>
        <div style={{ ...s.modalBody, maxHeight: '50vh', overflowY: 'auto' }}>
          {/* Visual bar chart */}
          <div style={s.chartArea}>
            {rates?.map(r => {
              const height = ((r.retail_rate || 0) / maxRetail) * 120
              return (
                <div key={r.id} style={s.chartBar}>
                  <div style={s.barTooltip}>{formatMoney(r.retail_rate)}</div>
                  <div style={{ ...s.bar, height: `${height}px` }} />
                  <div style={s.barLabel}>{r.date.slice(5)}</div>
                </div>
              )
            })}
            {rates?.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
                No rate history found for this item.
              </div>
            )}
          </div>

          {/* Table */}
          {rates?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '24px' }}>
              <thead>
                <tr style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Retail</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Wholesale</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {[...rates].reverse().map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: '13px' }}>{r.date}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{formatMoney(r.retail_rate)}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{formatMoney(r.wholesale_rate)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--red)' }}>{formatMoney(r.cost_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onClose}>Close</button>
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
  headerRight: { display: 'flex', gap: '12px', alignItems: 'center' },
  title: { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },

  body: { flex: 1, padding: '32px', overflowY: 'auto' },

  controls: { marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  dateRow: { display: 'flex', alignItems: 'center', gap: '16px' },
  controlLabel: { fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' },
  dateInput: {
    padding: '12px 16px', borderRadius: '14px', background: 'var(--surface2)', border: '1px solid var(--glass-border)',
    color: 'var(--text)', fontSize: '14px', outline: 'none', fontFamily: 'var(--mono)',
  },
  copyBtn: {
    padding: '12px 20px', borderRadius: '14px', background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)',
    color: 'var(--text)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
  },
  searchWrap: {
    background: 'var(--glass)', borderRadius: '16px', padding: '14px 20px', border: '1px solid var(--glass-border)',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  search: { background: 'none', border: 'none', color: 'var(--text)', width: '100%', fontSize: '14px', outline: 'none' },

  saveBtn: {
    padding: '12px 24px', background: 'var(--grad-amber)', color: '#000', borderRadius: '14px',
    fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '13px',
    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)', transition: 'all 0.2s',
  },

  tableWrap: {
    background: 'var(--glass)', borderRadius: '24px', border: '1px solid var(--glass-border)',
    overflow: 'hidden', boxShadow: 'var(--glass-shadow)',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '16px 14px', fontSize: '10px', color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800,
    borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-highlight)',
    position: 'sticky', top: 0,
  },
  tr: { borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' },
  td: { padding: '14px', verticalAlign: 'middle' },
  itemName: { fontSize: '14px', fontWeight: 700, color: 'var(--text)' },
  itemSub: { fontSize: '10px', color: 'var(--text3)', marginTop: '2px', fontFamily: 'var(--mono)' },
  unitLabel: { fontSize: '12px', fontWeight: 700, color: 'var(--text2)', background: 'var(--glass-highlight)', padding: '4px 10px', borderRadius: '8px', display: 'inline-block' },

  rateInput: {
    width: '110px', padding: '10px 12px', borderRadius: '12px', background: 'var(--surface2)',
    border: '1px solid var(--glass-border)', color: 'var(--text)', fontSize: '14px',
    fontFamily: 'var(--mono)', fontWeight: 700, textAlign: 'right', outline: 'none',
  },

  marginPill: { padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, fontFamily: 'var(--mono)', textAlign: 'center' },
  historyBtn: {
    width: '36px', height: '36px', borderRadius: '10px', background: 'var(--glass-highlight)',
    border: '1px solid var(--glass-border)', cursor: 'pointer', fontSize: '14px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
  },
  emptyCell: { padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: '14px' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' },
  modal: { width: '100%', background: 'var(--bg)', borderRadius: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  modalHeader: { padding: '28px 32px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-highlight)' },
  modalTitle: { fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' },
  modalSub: { fontSize: '12px', color: 'var(--text3)', marginTop: '4px' },
  modalBody: { padding: '32px' },
  modalFooter: { padding: '20px 32px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' },
  cancelBtn: { padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'var(--glass-highlight)', color: 'var(--text)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' },

  chartArea: { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '160px', padding: '0 0 24px 0' },
  chartBar: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' },
  bar: { width: '100%', background: 'var(--amber)', borderRadius: '4px 4px 0 0', minHeight: '4px', transition: 'height 0.3s' },
  barTooltip: {
    position: 'absolute', top: '-24px', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--mono)',
    color: 'var(--amber)', whiteSpace: 'nowrap', opacity: 0, transition: 'opacity 0.2s',
  },
  barLabel: { fontSize: '8px', color: 'var(--text3)', marginTop: '4px', fontFamily: 'var(--mono)' },
}
