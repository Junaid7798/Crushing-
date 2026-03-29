import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useConfig } from '../hooks/useConfig.js'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { uuid, now, createRecord, updateRecord, formatMoney, haptic, debounce, escapeRegex } from '../helpers.js'
import { formatQtyWithUnit, allowsDecimal, getUnitInfo } from '../config/units.js'

/**
 * TransactionScreen - Premium multi-step transaction engine.
 */
export default function TransactionScreen() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialType = searchParams.get('type') || 'sale'

  const { currentUser } = useAuth()
  const { config } = useConfig()
  const { db } = useDB()

  const [step, setStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})
  
  const [formData, setFormData] = useState({
    tx_type: initialType,
    doc_type: 'Tax Invoice',
    location_id: '',
    date: new Date().toISOString().split('T')[0],
    sale_channel: 'retail',
    party_id: '',
    party_name: '',
    items: [],
    variable_fields: ['', '', '', '', ''],
    notes: '',
    amount_paid: 0,
    payment_method: 'Cash',
  })

  const [partySearch, setPartySearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [debouncedPartyQuery, setDebouncedPartyQuery] = useState('')
  const [debouncedItemQuery, setDebouncedItemQuery] = useState('')

  // ── DEBOUNCED SEARCH ─────────────────────────────
  const updatePartyQuery = useCallback(debounce(q => setDebouncedPartyQuery(q), 300), [])
  const updateItemQuery = useCallback(debounce(q => setDebouncedItemQuery(q), 300), [])

  useEffect(() => updatePartyQuery(partySearch), [partySearch])
  useEffect(() => updateItemQuery(itemSearch), [itemSearch])

  // ── DATA FETCHING ────────────────────────────────
  const { result: locations } = useRxQuery(
    db?.locations.find({ selector: { business_id: currentUser?.business_id, active: true } }),
    { live: true }
  )
  const { result: parties } = useRxQuery(
    db?.parties.find({
      selector: {
        business_id: currentUser?.business_id,
        $or: [
          { name: { $regex: escapeRegex(debouncedPartyQuery), $options: 'i' } },
          { phone: { $regex: escapeRegex(debouncedPartyQuery), $options: 'i' } }
        ]
      },
      limit: 10
    }),
    { live: true }
  )
  const { result: inventory } = useRxQuery(
    db?.items.find({
      selector: {
        business_id: currentUser?.business_id,
        name: { $regex: escapeRegex(debouncedItemQuery), $options: 'i' }
      },
      limit: 10
    }),
    { live: true }
  )

  // Fetch today's rate cards for dynamic pricing
  const { result: todayRates } = useRxQuery(
    db?.rate_cards?.find({
      selector: {
        business_id: currentUser?.business_id,
        date: formData.date
      }
    }),
    { live: true }
  )

  const rateMap = useMemo(() => {
    const map = {}
    if (todayRates) todayRates.forEach(r => { map[r.item_id] = r })
    return map
  }, [todayRates])

  // ── CALCULATIONS ─────────────────────────────────
  const txSubtotal = useMemo(() => formData.items.reduce((s, i) => s + i.total, 0), [formData.items])
  const txGstAmount = useMemo(() => {
    if (formData.doc_type === 'Cash Memo') return 0
    return formData.items.reduce((s, i) => s + (i.total * ((i.tax_percent || 0) / 100)), 0)
  }, [formData.items, formData.doc_type])
  const txTotal = useMemo(() => txSubtotal + txGstAmount, [txSubtotal, txGstAmount])
  const balanceDue = useMemo(() => txTotal - formData.amount_paid, [txTotal, formData.amount_paid])

  // ── HANDLERS ─────────────────────────────────────
  const next = () => {
    haptic()
    if (step === 2 && !formData.party_id) return setErrors({ party: 'Please select a party' })
    if (step === 3 && formData.items.length === 0) return setErrors({ items: 'Add at least one item' })
    setErrors({})
    if (step < 6) setStep(step + 1)
  }
  const back = () => {
    haptic()
    step > 1 ? setStep(step - 1) : navigate(-1)
  }

  const addItem = (item) => {
    haptic()
    const channel = formData.sale_channel
    // Look up today's rate from rate_cards first, fallback to item defaults
    const todayRate = rateMap[item.id]
    let rate
    if (todayRate) {
      rate = channel === 'retail' ? todayRate.retail_rate : todayRate.wholesale_rate
    } else {
      rate = channel === 'retail' ? item.sell_price_retail : item.sell_price_wholesale
    }
    const unit = item.selling_unit || item.unit || 'pcs'
    const isDecimal = item.allow_decimal_qty ?? allowsDecimal(unit)
    setFormData(p => ({
      ...p,
      items: [...p.items, { 
        id: uuid(), item_id: item.id, name: item.name, 
        qty: isDecimal ? 1 : 1, rate: rate || 0, 
        tax_percent: formData.doc_type === 'Tax Invoice' ? (item.gst_rate || 0) : 0,
        total: (rate || 0) * 1,
        unit,
        allow_decimal: isDecimal,
        rate_overridden: false,
        rate_date: todayRate ? formData.date : null,
      }]
    }))
    setItemSearch('')
    setErrors({})
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    haptic()

    const createdIds = { transaction: null, lines: [], payment: null, partyUpdated: false }
    let stockChanges = []  // Track stock changes for rollback

    try {
      const txId = uuid()
      const userId = currentUser.id

      // 0. PRE-VALIDATE STOCK
      if (formData.tx_type === 'sale') {
        for (const item of formData.items) {
          const itemDoc = await db.items.findOne(item.item_id).exec()
          if (!itemDoc) throw new Error(`Item ${item.name} not found`)
          const newStock = (itemDoc.stock_qty || 0) - item.qty
          if (newStock < 0) {
            throw new Error(`Insufficient stock for ${item.name}. Available: ${itemDoc.stock_qty || 0}, Requested: ${item.qty}`)
          }
        }
      }

      // 1. Transaction Header
      const txStatus = balanceDue <= 0 
        ? (txTotal > 0 ? 'paid' : 'completed') 
        : (formData.amount_paid > 0 ? 'partial' : 'pending')

      await createRecord('transactions', {
        id: txId,
        party_id: formData.party_id,
        tx_type: formData.tx_type,
        doc_type: formData.doc_type,
        date: formData.date,
        location_id: formData.location_id || (locations?.[0]?.id || null),
        subtotal: txSubtotal,
        gst_amount: txGstAmount,
        total: txTotal,
        paid_amount: formData.amount_paid,
        balance_due: balanceDue,
        payment_mode: formData.payment_method,
        payment_ref: '',
        status: txStatus,
        notes: formData.notes,
        sale_channel: formData.sale_channel,
        field_1_value: formData.variable_fields[0] || '',
        field_2_value: formData.variable_fields[1] || '',
        field_3_value: formData.variable_fields[2] || '',
        field_4_value: formData.variable_fields[3] || '',
        field_5_value: formData.variable_fields[4] || '',
      }, { user_id: userId })
      createdIds.transaction = txId

      // 2. Transaction Lines & Stock Updates
      for (const item of formData.items) {
        const itemDoc = await db.items.findOne(item.item_id).exec()
        const currentCost = itemDoc?.cost_price || 0

        const lineRecord = await createRecord('transaction_lines', {
          transaction_id: txId,
          item_id: item.item_id,
          item_name: item.name,
          qty: item.qty,
          unit: item.unit || 'pcs',
          unit_price: item.rate,
          line_total: item.total,
          gst_rate: formData.doc_type === 'Cash Memo' ? 0 : (item.tax_percent || 0),
          gst_amount: formData.doc_type === 'Cash Memo' ? 0 : (item.total * ((item.tax_percent || 0) / 100)),
          cost_price: currentCost,
          rate_override: item.rate_overridden || false,
          rate_date: item.rate_date || null,
        }, { user_id: userId })
        createdIds.lines.push(lineRecord.id)
        
        // Only deduct stock for sales (not payment_in, payment_out, or expense)
        if (itemDoc && formData.tx_type === 'sale') {
          const newStock = (itemDoc.stock_qty || 0) - item.qty
          if (newStock < 0) {
            throw new Error(`Insufficient stock for ${item.name}. Available: ${itemDoc.stock_qty || 0}, Requested: ${item.qty}`)
          }
          await updateRecord('items', item.item_id, { 
            stock_qty: newStock
          }, { user_id: userId, note: `Stock adjustment via ${txId}` })
          stockChanges.push({ item_id: item.item_id, delta: -item.qty })
        } else if (itemDoc && formData.tx_type === 'purchase') {
          // For purchases, add stock
          await updateRecord('items', item.item_id, { 
            stock_qty: (itemDoc.stock_qty || 0) + item.qty
          }, { user_id: userId, note: `Stock adjustment via ${txId}` })
          stockChanges.push({ item_id: item.item_id, delta: item.qty })
        }
      }

      // 3. Payment Record
      if (formData.amount_paid > 0) {
        const payRecord = await createRecord('payments', {
          transaction_id: txId,
          party_id: formData.party_id,
          amount: formData.amount_paid,
          mode: formData.payment_method,
          date: formData.date,
          reference: '',
          notes: 'Auto-payment via transaction wizard',
        }, { user_id: userId })
        createdIds.payment = payRecord.id
      }

      // 4. Update Party Balance
      const partyDoc = await db.parties.findOne(formData.party_id).exec()
      if (partyDoc) {
        const mod = formData.tx_type === 'sale' ? 1 : -1
        await updateRecord('parties', formData.party_id, { 
          balance: partyDoc.balance + (balanceDue * mod)
        }, { user_id: userId, note: `Balance update from ${txId}` })
        createdIds.partyUpdated = true
      }

      navigate(`/transaction/${txId}`)
    } catch (err) {
      console.error('Transaction save failed, attempting rollback:', err)

      // Rollback: reverse stock changes
      for (const change of stockChanges) {
        try {
          const itemDoc = await db.items.findOne(change.item_id).exec()
          if (itemDoc) {
            await itemDoc.patch({ stock_qty: itemDoc.stock_qty - change.delta })
          }
        } catch (rollbackErr) {
          console.error('Stock rollback failed for', change.item_id, rollbackErr)
        }
      }

      // Rollback: remove created payment
      if (createdIds.payment) {
        try {
          const payDoc = await db.payments.findOne(createdIds.payment).exec()
          if (payDoc) await payDoc.remove()
        } catch (rollbackErr) {
          console.error('Payment rollback failed:', rollbackErr)
        }
      }

      // Rollback: remove created transaction lines
      for (const lineId of createdIds.lines) {
        try {
          const lineDoc = await db.transaction_lines.findOne(lineId).exec()
          if (lineDoc) await lineDoc.remove()
        } catch (rollbackErr) {
          console.error('Line rollback failed for', lineId, rollbackErr)
        }
      }

      // Rollback: remove the transaction header
      if (createdIds.transaction) {
        try {
          const txDoc = await db.transactions.findOne(createdIds.transaction).exec()
          if (txDoc) await txDoc.remove()
        } catch (rollbackErr) {
          console.error('Transaction rollback failed:', rollbackErr)
        }
      }

      setErrors({ global: 'Transaction failed and was rolled back: ' + err.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <button style={s.backBtn} onClick={back}>←</button>
        <div style={s.headerTitle}>
          <div style={s.stepCount}>Step {step} of 6</div>
          <div style={s.stepName}>{getStepNames(step)}</div>
        </div>
        <div style={s.headerRight}>{formatMoney(txTotal)}</div>
      </header>

      {/* Content */}
      <div style={s.body}>
        {errors.global && <div style={s.errorBox}>{errors.global}</div>}
        
        {step === 1 && <Step1 formData={formData} setFormData={setFormData} locations={locations} />}
        {step === 2 && <Step2 partySearch={partySearch} setPartySearch={setPartySearch} parties={parties} formData={formData} setFormData={setFormData} setStep={setStep} error={errors.party} />}
        {step === 3 && <Step3 itemSearch={itemSearch} setItemSearch={setItemSearch} inventory={inventory} formData={formData} setFormData={setFormData} addItem={addItem} txTotal={txTotal} error={errors.items} />}
        {step === 4 && <Step4 config={config} formData={formData} setFormData={setFormData} />}
        {step === 5 && <Step5 formData={formData} setFormData={setFormData} txTotal={txTotal} />}
        {step === 6 && <Step6 formData={formData} txTotal={txTotal} balanceDue={balanceDue} isSaving={isSaving} onSave={handleSave} />}
      </div>

      {/* Footer */}
      {step < 6 && (
        <footer style={s.footer}>
          <button style={s.nextBtn} onClick={next}>Next Step →</button>
        </footer>
      )}
    </div>
  )
}

// ── STEPS ────────────────────────────────────────

const Step1 = ({ formData, setFormData, locations }) => (
  <div style={s.step}>
    <div style={s.label}>Transaction Type</div>
    <div style={s.typeGrid}>
      {['sale', 'purchase', 'expense', 'payment_in', 'payment_out'].map(t => (
        <button key={t} style={{ ...s.typeBtn, ...(formData.tx_type === t ? s.typeActive : {}) }} 
          onClick={() => { haptic(); setFormData(p => ({ ...p, tx_type: t })) }}>
          <div style={{ textTransform: 'capitalize' }}>{t.replace('_', ' ')}</div>
        </button>
      ))}
    </div>
    {formData.tx_type === 'sale' && (
      <div style={s.section}>
        <label style={s.label}>Invoice Type</label>
        <div style={s.toggle}>
          {['Tax Invoice', 'Cash Memo'].map(d => (
            <button key={d} style={{ ...s.toggleBtn, ...(formData.doc_type === d ? s.toggleActive : {}) }} 
              onClick={() => { 
                haptic()
                setFormData(p => {
                  // When switching to Cash Memo, zero out GST rates; restore them for Tax Invoice
                  const updatedItems = p.items.map(item => ({
                    ...item,
                    tax_percent: d === 'Cash Memo' ? 0 : (item._saved_tax_percent || item.tax_percent || 0),
                    _saved_tax_percent: d === 'Cash Memo' ? (item._saved_tax_percent || item.tax_percent || 0) : item.tax_percent,
                  }))
                  return { ...p, doc_type: d, items: updatedItems }
                })
              }}>{d}</button>
          ))}
        </div>
        <div style={s.gstHint}>
          {formData.doc_type === 'Cash Memo' 
            ? 'No GST will be calculated on this invoice' 
            : 'GST will be calculated per item rate'}
        </div>
      </div>
    )}
    <div style={s.row}>
      <div style={s.field}>
        <label style={s.label}>Location</label>
        <select style={s.select} value={formData.location_id} onChange={e => setFormData(p => ({ ...p, location_id: e.target.value }))}>
          <option value="">Warehouse</option>
          {locations?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div style={s.field}>
        <label style={s.label}>Channel</label>
        <select style={s.select} value={formData.sale_channel} onChange={e => setFormData(p => ({ ...p, sale_channel: e.target.value }))}>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
        </select>
      </div>
    </div>
    <div style={s.section}>
      <label style={s.label}>Transaction Date</label>
      <input type="date" style={s.input} value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
    </div>
  </div>
)

const Step2 = ({ partySearch, setPartySearch, parties, formData, setFormData, setStep, error }) => (
  <div style={s.step}>
    {error && <div style={s.fieldError}>{error}</div>}
    <input autoFocus style={s.searchInput} placeholder="Search party via name or phone..." value={partySearch} onChange={e => setPartySearch(e.target.value)} />
    <div style={s.resultsGrid}>
      {parties?.map(p => (
        <button key={p.id} style={{ ...s.resultCard, borderColor: formData.party_id === p.id ? 'var(--amber)' : 'var(--glass-border)' }} 
          onClick={() => { haptic(); setFormData(pvt => ({ ...pvt, party_id: p.id, party_name: p.name })); setPartySearch(p.name); setStep(3); }}>
          <div style={s.pName}>{p.name}</div>
          <div style={s.pPhone}>{p.phone || 'No phone'}</div>
          <div style={s.pBalance}>{formatMoney(p.balance)}</div>
        </button>
      ))}
      {parties?.length === 0 && partySearch.length > 2 && <div style={s.hint}>No matching parties found.</div>}
    </div>
  </div>
)

const Step3 = ({ itemSearch, setItemSearch, inventory, formData, setFormData, addItem, error }) => (
  <div style={s.step}>
    {error && <div style={s.fieldError}>{error}</div>}
    <input autoFocus style={s.searchInput} placeholder="Scan barcode or search items..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} />
    {itemSearch && (
      <div style={s.searchPop}>
        {inventory?.map(i => (
          <button key={i.id} style={s.itemResult} onClick={() => addItem(i)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span>{i.name}</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={s.itemUnit}>{i.selling_unit || i.unit || 'pcs'}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 800, color: 'var(--amber)' }}>
                  {formatMoney(formData.sale_channel === 'retail' ? i.sell_price_retail : i.sell_price_wholesale)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    )}
    <div style={s.itemList}>
      {formData.items.map((i, idx) => (
        <div key={i.id} style={s.itemRow}>
          <div style={{ flex: 1 }}>
             <div style={s.pName}>{i.name}</div>
             <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
               <span style={s.pPhone}>{formatMoney(i.rate)} / {i.unit || 'unit'}</span>
               {i.rate_overridden && <span style={s.overrideBadge}>Override</span>}
               {i.rate_date && !i.rate_overridden && <span style={s.rateDateBadge}>Rate: {i.rate_date}</span>}
             </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input 
                type="number" 
                step={i.allow_decimal ? '0.01' : '1'}
                style={s.qtyInput} 
                value={i.qty} 
                onChange={e => {
                  const val = i.allow_decimal ? (parseFloat(e.target.value) || 0) : (parseInt(e.target.value) || 0)
                  const list = formData.items.map(item => ({ ...item })); 
                  list[idx].qty = val; 
                  list[idx].total = list[idx].qty * list[idx].rate;
                  setFormData(p => ({ ...p, items: list }))
                }} 
              />
              <span style={s.qtyUnit}>{i.unit || 'pcs'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <input
                type="number"
                style={{ ...s.rateOverride, color: i.rate_overridden ? 'var(--amber)' : 'var(--text3)' }}
                value={i.rate}
                onChange={e => {
                  const list = formData.items.map(item => ({ ...item }))
                  list[idx].rate = parseFloat(e.target.value) || 0
                  list[idx].total = list[idx].qty * list[idx].rate
                  list[idx].rate_overridden = true
                  setFormData(p => ({ ...p, items: list }))
                }}
                title="Edit rate to override"
              />
              <div style={s.iTotal}>{formatMoney(i.total)}</div>
            </div>
            <button style={s.delBtn} onClick={() => {
              haptic();
              setFormData(p => ({ ...p, items: p.items.filter(it => it.id !== i.id) }))
            }}>×</button>
          </div>
        </div>
      ))}
    </div>
  </div>
)

const Step4 = ({ config, formData, setFormData }) => (
  <div style={s.step}>
    {config?.transaction_fields?.filter(f => f?.visible)?.map((f, i) => (
      <div key={f.index} style={s.section}>
        <label style={s.label}>{f.label}</label>
        <input style={s.input} value={formData.variable_fields[f.index - 1] || ''} onChange={e => {
          const v = [...formData.variable_fields]; v[f.index - 1] = e.target.value;
          setFormData(p => ({ ...p, variable_fields: v }))
        }} />
      </div>
    ))}
    <div style={s.section}>
      <label style={s.label}>Internal Notes / References</label>
      <textarea style={{ ...s.input, height: '100px' }} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}></textarea>
    </div>
  </div>
)

const Step5 = ({ formData, setFormData, txTotal }) => (
  <div style={s.step}>
    <div style={s.section}>
      <label style={s.label}>Settlement Amount (Total: {formatMoney(txTotal)})</label>
      <input type="number" style={{ ...s.input, fontSize: '32px', textAlign: 'center', fontWeight: 800, fontFamily: 'var(--mono)' }} 
        value={formData.amount_paid} onChange={e => setFormData(p => ({ ...p, amount_paid: parseFloat(e.target.value) || 0 }))} />
    </div>
    <div style={s.label}>Payment Method</div>
    <div style={s.typeGrid}>
      {['Cash', 'Bank', 'UPI', 'Cheque'].map(m => (
        <button key={m} style={{ ...s.typeBtn, ...(formData.payment_method === m ? s.typeActive : {}) }} 
          onClick={() => { haptic(); setFormData(p => ({ ...p, payment_method: m })) }}>{m}</button>
      ))}
    </div>
  </div>
)

const Step6 = ({ formData, txTotal, balanceDue, isSaving, onSave }) => (
  <div style={{ ...s.step, textAlign: 'center' }}>
    <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '32px', letterSpacing: '-0.02em' }}>Final Review</div>
    <div style={s.summaryItem}><span>Party:</span> <b>{formData.party_name}</b></div>
    <div style={s.summaryItem}><span>Transaction Type:</span> <b style={{ textTransform: 'capitalize' }}>{formData.tx_type}</b></div>
    <div style={s.summaryItem}><span>Total Items:</span> <b>{formData.items.length}</b></div>
    <div style={s.summaryItem}><span>Grand Total:</span> <b style={{ fontSize: '18px' }}>{formatMoney(txTotal)}</b></div>
    <div style={s.summaryItem}><span>Settled:</span> <b>{formatMoney(formData.amount_paid)}</b></div>
    <div style={s.summaryItem}><span>Balance Due:</span> <b style={{ color: 'var(--amber)', fontSize: '18px' }}>{formatMoney(balanceDue)}</b></div>
    
    <button style={{ ...s.nextBtn, marginTop: '48px' }} disabled={isSaving} onClick={onSave}>
      {isSaving ? 'Processing Securely...' : 'Generate Invoice & Sync'}
    </button>
  </div>
)

function getStepNames(step) {
  return ['General', 'Counterparty', 'Line Items', 'Custom Info', 'Settlement', 'Execution'][step - 1] || 'Done'
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: { padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { width: '42px', height: '42px', borderRadius: '14px', background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text)' },
  headerTitle: { textAlign: 'center' },
  stepCount: { fontSize: '10px', color: 'var(--amber)', fontFamily: 'var(--mono)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' },
  stepName: { fontSize: '16px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' },
  headerRight: { fontSize: '16px', fontWeight: 800, color: 'var(--teal)', fontFamily: 'var(--mono)' },

  body: { flex: 1, padding: '24px', overflowY: 'auto' },
  step: { animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  section: { marginBottom: '24px' },
  label: { display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.08em' },

  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '12px', marginBottom: '24px' },
  typeBtn: { padding: '18px 12px', borderRadius: '20px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text2)', transition: 'all 0.2s', cursor: 'pointer', fontSize: '12px', fontWeight: 700 },
  typeActive: { background: 'var(--amber-dim)', borderColor: 'var(--amber)', color: 'var(--amber)', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.2)' },

  toggle: { display: 'flex', background: 'var(--glass-highlight)', padding: '4px', borderRadius: '16px', border: '1px solid var(--glass-border)' },
  toggleBtn: { flex: 1, padding: '14px', borderRadius: '12px', fontSize: '13px', color: 'var(--text3)', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700 },
  toggleActive: { background: 'var(--bg)', color: 'var(--amber)', fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },

  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' },
  select: { width: '100%', padding: '16px', background: 'var(--surface2)', border: '1px solid var(--glass-border)', borderRadius: '16px', color: 'var(--text)', fontSize: '14px', outline: 'none' },
  input: { width: '100%', padding: '16px', background: 'var(--surface2)', border: '1px solid var(--glass-border)', borderRadius: '16px', color: 'var(--text)', fontSize: '14px', outline: 'none' },

  searchInput: { width: '100%', padding: '24px', borderRadius: '24px', border: '1px solid var(--glass-border)', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', fontSize: '16px', color: 'var(--text)', outline: 'none', boxShadow: 'var(--glass-shadow)' },
  resultsGrid: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' },
  resultCard: { padding: '20px', borderRadius: '20px', border: '1px solid var(--glass-border)', textAlign: 'left', background: 'var(--glass)', transition: 'all 0.2s', cursor: 'pointer' },
  pName: { fontWeight: 800, fontSize: '16px', color: 'var(--text)' },
  pPhone: { fontSize: '12px', color: 'var(--text3)', marginTop: '4px', fontWeight: 600 },
  pBalance: { fontSize: '15px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--amber)', marginTop: '10px' },

  searchPop: { background: 'var(--glass)', backdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)', borderRadius: '20px', marginTop: '12px', overflow: 'hidden', boxShadow: '0 15px 40px rgba(0,0,0,0.6)', zIndex: 100 },
  itemResult: { width: '100%', padding: '18px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
  itemList: { marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px' },
  itemRow: { padding: '20px', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  qtyInput: { width: '80px', padding: '10px', borderRadius: '12px', background: 'var(--surface3)', border: '1px solid var(--glass-border)', color: 'var(--text)', textAlign: 'center', fontSize: '15px', fontWeight: 800, fontFamily: 'var(--mono)' },
  qtyUnit: { fontSize: '9px', color: 'var(--text3)', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase' },
  rateOverride: { width: '100px', padding: '6px 8px', borderRadius: '8px', background: 'var(--surface3)', border: '1px solid var(--glass-border)', textAlign: 'right', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--mono)', outline: 'none' },
  iTotal: { width: '120px', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--mono)', fontSize: '16px', color: 'var(--text)' },
  delBtn: { width: '32px', height: '32px', borderRadius: '50%', background: 'var(--red-dim)', color: 'var(--red)', border: 'none', fontSize: '20px', cursor: 'pointer' },

  overrideBadge: { fontSize: '9px', fontWeight: 800, color: 'var(--amber)', background: 'var(--amber-dim)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--amber-border)', textTransform: 'uppercase' },
  rateDateBadge: { fontSize: '9px', fontWeight: 700, color: 'var(--teal)', background: 'var(--teal-dim)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--teal-border)' },
  itemUnit: { fontSize: '11px', fontWeight: 700, color: 'var(--text3)', background: 'var(--glass-highlight)', padding: '2px 8px', borderRadius: '6px' },
  gstHint: { fontSize: '11px', color: 'var(--text3)', marginTop: '8px', fontWeight: 600 },

  summaryItem: { display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderBottom: '1px solid var(--glass-border)', fontSize: '15px', color: 'var(--text2)' },
  footer: { padding: '24px', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderTop: '1px solid var(--glass-border)', position: 'sticky', bottom: 0 },
  nextBtn: { width: '100%', padding: '20px', background: 'var(--grad-amber)', color: '#000', borderRadius: '20px', fontSize: '16px', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)', transition: 'all 0.2s' },
  
  fieldError: { background: 'var(--red-dim)', color: 'var(--red)', padding: '12px 16px', borderRadius: '14px', fontSize: '13px', fontWeight: 700, marginBottom: '20px', border: '1px solid var(--red-border)' },
  errorBox: { background: 'var(--red-dim)', color: 'var(--red)', padding: '20px', borderRadius: '20px', fontSize: '14px', fontWeight: 800, marginBottom: '32px', border: '1px solid var(--red-border)' },
  hint: { fontSize: '13px', color: 'var(--text3)', textAlign: 'center', marginTop: '40px' },
}
