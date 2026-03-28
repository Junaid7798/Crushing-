// src/screens/OnboardingScreen.jsx
// Shown when status === 'onboarding' (no config in DB yet).
// 4 steps: Template → Business → Fields → PIN
// Writes config + admin user to RxDB.
// Calls completeOnboarding(pin) → AuthContext logs in.

import { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { initDB, getDB } from '../db/index.js'
import { hashPin, generateSalt, uuid, now } from '../helpers.js'

// ─── TEMPLATES ───────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'production',
    icon: '⚙️',
    name: 'Production & Trading',
    desc: 'Crush, manufacture, or process goods and sell them.',
    plugins: ['gst', 'inventory', 'production', 'branded_pdf'],
    vfDefaults: {
      transactions: ['Vehicle number', 'Driver name', 'Site name', 'PO number', 'Delivery ref'],
      parties:      ['Contact person', 'GSTIN', 'Area / site', 'Remarks', 'Credit notes'],
      items:        ['HSN code', 'Unit weight', 'Supplier code', 'Shelf location', ''],
    },
  },
  {
    id: 'retail',
    icon: '🏪',
    name: 'Retail Store',
    desc: 'Walk-in customers, cash and UPI payments, stock management.',
    plugins: ['gst', 'inventory', 'branded_pdf'],
    vfDefaults: {
      transactions: ['Cashier', 'Discount reason', 'Customer ref', 'Return reason', ''],
      parties:      ['Contact person', 'GSTIN', 'Loyalty ID', 'Remarks', ''],
      items:        ['HSN code', 'Brand', 'Barcode', 'Shelf location', ''],
    },
  },
  {
    id: 'trading',
    icon: '📦',
    name: 'Wholesale Trading',
    desc: 'Buy from vendors, sell to businesses. Credit terms and dues.',
    plugins: ['gst', 'inventory', 'npa', 'branded_pdf'],
    vfDefaults: {
      transactions: ['PO number', 'Transport mode', 'Vehicle number', 'Broker name', ''],
      parties:      ['Contact person', 'GSTIN', 'Credit days', 'Area', 'Broker'],
      items:        ['HSN code', 'Brand', 'Supplier code', '', ''],
    },
  },
  {
    id: 'service',
    icon: '🔧',
    name: 'Service Business',
    desc: 'Bill for work done, track job cards, manage recurring clients.',
    plugins: ['gst', 'branded_pdf'],
    vfDefaults: {
      transactions: ['Job card no', 'Engineer name', 'Site address', 'Complaint ref', ''],
      parties:      ['Contact person', 'GSTIN', 'Site address', 'Remarks', ''],
      items:        ['HSN code', 'Service type', '', '', ''],
    },
  },
  {
    id: 'custom',
    icon: '⚡',
    name: 'Custom setup',
    desc: 'Start blank. Choose your own plugins and field labels.',
    plugins: [],
    vfDefaults: {
      transactions: ['', '', '', '', ''],
      parties:      ['', '', '', '', ''],
      items:        ['', '', '', '', ''],
    },
  },
]

const VF_ENTITIES = [
  { key: 'transactions', label: 'Transactions', hint: 'Appears on every invoice. e.g. vehicle no, driver, site, PO.' },
  { key: 'parties',      label: 'Parties',      hint: 'Appears on party profiles. e.g. contact person, GSTIN, area.' },
  { key: 'items',        label: 'Items',         hint: 'Appears on item cards. e.g. HSN code, brand, barcode.' },
]

const STEPS = ['Template', 'Business', 'Fields', 'PIN']

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth()

  // Wizard state
  const [step, setStep]             = useState(1)   // 1–4
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  // Step 1 — template
  const [template, setTemplate]     = useState(null)

  // Step 2 — business
  const [biz, setBiz]               = useState({
    name: '', phone: '', email: '', address: '',
    gstin: '', prefix: 'INV', upi: '',
  })

  // Step 3 — variable fields
  const [vfTab, setVfTab]           = useState('transactions')
  const [vf, setVf]                 = useState({
    transactions: ['', '', '', '', ''],
    parties:      ['', '', '', '', ''],
    items:        ['', '', '', '', ''],
  })

  // Step 4 — owner name + PIN
  const [ownerName, setOwnerName]   = useState('')
  const [pinPhase, setPinPhase]     = useState('create')   // 'create' | 'confirm'
  const [pin1, setPin1]             = useState('')
  const [pin2, setPin2]             = useState('')
  const [pinError, setPinError]     = useState('')

  // ── NAVIGATION ────────────────────────────────
  function next() {
    setError('')
    if (step === 1 && !template)           { setError('Pick a template to continue.'); return }
    if (step === 2 && biz.name.trim().length < 2) { setError('Business name is required.'); return }
    if (step === 2 && biz.phone.trim().length < 7) { setError('Phone number is required.'); return }
    if (step < 4) setStep(s => s + 1)
  }
  function back() { setError(''); setStep(s => s - 1) }

  // ── TEMPLATE SELECTION ────────────────────────
  function pickTemplate(t) {
    setTemplate(t)
    // Populate VF with template defaults
    setVf({
      transactions: [...t.vfDefaults.transactions],
      parties:      [...t.vfDefaults.parties],
      items:        [...t.vfDefaults.items],
    })
    // Auto-derive prefix from business name if already entered
    if (!biz.prefix || biz.prefix === 'INV') {
      const derived = biz.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 4)
      if (derived.length >= 2) setBiz(b => ({ ...b, prefix: derived }))
    }
  }

  // ── VF FIELD UPDATE ───────────────────────────
  const updateVf = useCallback((entity, idx, val) => {
    setVf(prev => {
      const next = [...prev[entity]]
      next[idx] = val
      return { ...prev, [entity]: next }
    })
  }, [])

  // ── PIN LOGIC ─────────────────────────────────
  function handlePinKey(digit) {
    if (loading) return
    setPinError('')
    if (pinPhase === 'create') {
      if (pin1.length >= 8) return
      setPin1(p => p + digit)
    } else {
      if (pin2.length >= 8) return
      const next = pin2 + digit
      setPin2(next)
      if (next.length === pin1.length) validatePins(next)
    }
  }

  function handlePinBack() {
    setPinError('')
    if (pinPhase === 'create') setPin1(p => p.slice(0, -1))
    else setPin2(p => p.slice(0, -1))
  }

  function validatePins(confirmValue) {
    if (confirmValue !== pin1) {
      setPinError("PINs don't match — try again")
      setTimeout(() => { setPin2(''); setPinPhase('create'); setPinError(''); setPin1('') }, 700)
    }
  }

  function goToConfirm() {
    if (pin1.length < 4) { setPinError('Minimum 4 digits'); return }
    
    // Check for weak PIN patterns
    const isSequential = '0123456789'.includes(pin1) || '9876543210'.includes(pin1)
    const isRepeating = /^(\d)\1+$/.test(pin1) // e.g., 1111, 2222
    if (isSequential || isRepeating) {
      setPinError('PIN is too simple — use a unique combination')
      return
    }
    
    setPinPhase('confirm')
    setPin2('')
    setPinError('')
  }

  // ── COMPLETE SETUP ────────────────────────────
  async function completeSetup() {
    if (pin2 !== pin1 || pin1.length < 4) { setPinError('PIN mismatch or too short'); return }
    if (ownerName.trim().length < 2)       { setPinError('Enter your name above'); return }
    setLoading(true)
    setError('')

    try {
      await initDB()
      const db          = getDB()
      const businessId  = uuid()
      const deviceId    = uuid()
      const salt        = generateSalt()
      const pinHash     = await hashPin(pin1)
      const tmpl        = template

      // ── Build plugin map ──────────────────────
      const modules = {
        inventory:    tmpl.plugins.includes('inventory'),
        raw_materials: tmpl.plugins.includes('production'),
        production:   tmpl.plugins.includes('production'),
        vendors:      false,
        gst:          tmpl.plugins.includes('gst'),
        npa:          tmpl.plugins.includes('npa'),
        multi_user:   false,
        device_sync:  false,
        branded_pdf:  tmpl.plugins.includes('branded_pdf'),
        cloud_backup: false,
      }

      // ── Build VF label arrays ─────────────────
      const makeVfLabels = (entity) =>
        vf[entity].map((label, i) => ({
          index:   i + 1,
          label:   label.trim() || null,
          visible: label.trim().length > 0,
        }))

      // ── Write config ──────────────────────────
      await db.config.insert({
        key:              'main',
        business_name:    biz.name.trim(),
        gstin:            biz.gstin.trim(),
        address:          biz.address.trim(),
        phone:            biz.phone.trim(),
        email:            biz.email.trim(),
        upi_id:           biz.upi.trim(),
        invoice_prefix:   (biz.prefix || 'INV').toUpperCase(),
        template:         tmpl.id,
        currency:         'INR',
        modules,
        party_fields:        makeVfLabels('parties'),
        item_fields:         makeVfLabels('items'),
        transaction_fields:  makeVfLabels('transactions'),
        raw_material_fields: [],
        bank_name:        '',
        bank_account:     '',
        bank_ifsc:        '',
        bank_holder:      '',
        device_id:        deviceId,
        business_id:      businessId,
        encryption_salt:  salt,
        terms_and_conditions: '',
        thank_you_message:    'Thank you for your business.',
        created_at:   now(),
        onboarded_at: now(),
      })

      // ── Write admin user ──────────────────────
      const adminId = uuid()
      await db.users.insert({
        id:           adminId,
        username:     ownerName.trim(),
        pin_hash:     pinHash,
        role:         'admin',
        business_id:  businessId,
        display_name: ownerName.trim(),
        permissions: {
          can_view_reports:        true,
          can_view_financials:     true,
          can_view_party_balances: true,
          can_edit_transactions:   true,
          can_record_sales:        true,
          can_collect_payments:    true,
          can_delete:              true,
          can_export:              true,
          can_view_production:     true,
          can_edit_items:          true,
          can_edit_parties:        true,
          can_view_gst:            true,
          can_view_insights:       true,
          can_manage_leads:        true,
          can_record_expenses:     true,
          can_manage_users:        true,
        },
        assigned_location_id: null,
        working_hours_start:  null,
        working_hours_end:    null,
        active:     true,
        created_at: now(),
        created_by: null,
      })

      // ── Done — log in ─────────────────────────
      await completeOnboarding(pin1)

    } catch (err) {
      setError(err.message || 'Setup failed — try again')
      setLoading(false)
    }
  }

  // ── RENDER ────────────────────────────────────
  return (
    <div style={s.root}>
      <div style={s.shell}>

        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logoMark}>B</div>
          <span style={s.logoName}>Business OS</span>
        </div>

        {/* Progress track */}
        <div style={s.track}>
          {STEPS.map((label, i) => {
            const n = i + 1
            const done   = n < step
            const active = n === step
            return (
              <div key={label} style={s.trackStep}>
                <div style={{
                  ...s.trackDot,
                  background:   done ? 'var(--teal)' : active ? 'var(--amber)' : 'var(--surface)',
                  borderColor:  done ? 'var(--teal)' : active ? 'var(--amber)' : 'var(--border2)',
                  color:        done || active ? '#0c0c0c' : 'var(--text2)',
                }}>
                  {done ? '✓' : n}
                </div>
                <span style={{
                  ...s.trackLabel,
                  color: done ? 'var(--teal)' : active ? 'var(--amber)' : 'var(--text3)',
                }}>
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div style={{
                    ...s.trackLine,
                    background: done ? 'var(--teal)' : 'var(--border2)',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div style={s.card}>

          {/* ── STEP 1: TEMPLATE ── */}
          {step === 1 && (
            <>
              <div style={s.stepNum}>STEP 1 OF 4</div>
              <div style={s.stepTitle}>What kind of business?</div>
              <div style={s.stepSub}>Sets up the right plugins and field labels. Change everything later in Settings.</div>
              <div style={s.templateGrid}>
                {TEMPLATES.map(t => (
                  <div
                    key={t.id}
                    style={{
                      ...s.templateCard,
                      borderColor:  template?.id === t.id ? 'var(--amber)' : 'var(--border2)',
                      background:   template?.id === t.id ? 'var(--amber-dim)' : 'var(--surface2)',
                    }}
                    onClick={() => pickTemplate(t)}
                  >
                    <div style={s.tIcon}>{t.icon}</div>
                    <div style={s.tName}>{t.name}</div>
                    <div style={s.tDesc}>{t.desc}</div>
                    {t.plugins.length > 0 && (
                      <div style={s.tTags}>
                        {t.plugins.slice(0, 3).map(p => (
                          <span key={p} style={{
                            ...s.tTag,
                            background:   template?.id === t.id ? 'rgba(232,160,32,0.15)' : 'var(--surface3)',
                            color:        template?.id === t.id ? 'var(--amber)' : 'var(--text2)',
                          }}>{p}</span>
                        ))}
                      </div>
                    )}
                    {template?.id === t.id && (
                      <div style={s.checkMark}>✓</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── STEP 2: BUSINESS ── */}
          {step === 2 && (
            <>
              <div style={s.stepNum}>STEP 2 OF 4</div>
              <div style={s.stepTitle}>Your business details</div>
              <div style={s.stepSub}>Appears on all invoices and documents. Update any time.</div>
              <Field label="Business name *">
                <input style={s.fi} value={biz.name} placeholder="e.g. Sharma Stone Works"
                  onChange={e => setBiz(b => ({ ...b, name: e.target.value }))}/>
              </Field>
              <div style={s.g2}>
                <Field label="Phone *">
                  <input style={s.fi} value={biz.phone} placeholder="+91 98765 43210"
                    onChange={e => setBiz(b => ({ ...b, phone: e.target.value }))}/>
                </Field>
                <Field label="Email (optional)">
                  <input style={s.fi} value={biz.email} placeholder="name@business.com"
                    onChange={e => setBiz(b => ({ ...b, email: e.target.value }))}/>
                </Field>
              </div>
              <Field label="Address (optional)">
                <input style={s.fi} value={biz.address} placeholder="City, State, PIN"
                  onChange={e => setBiz(b => ({ ...b, address: e.target.value }))}/>
              </Field>
              <div style={s.g2}>
                <Field label="GSTIN (optional)">
                  <input style={{ ...s.fi, fontFamily: 'var(--mono)' }}
                    value={biz.gstin} placeholder="27AADCS1234F1Z5" maxLength={15}
                    onChange={e => setBiz(b => ({ ...b, gstin: e.target.value.toUpperCase() }))}/>
                </Field>
                <Field label="Invoice prefix">
                  <input style={{ ...s.fi, fontFamily: 'var(--mono)' }}
                    value={biz.prefix} placeholder="INV" maxLength={6}
                    onChange={e => setBiz(b => ({ ...b, prefix: e.target.value.toUpperCase() }))}/>
                  <div style={s.hint}>Preview: <span style={{ color: 'var(--amber)', fontFamily: 'var(--mono)' }}>{(biz.prefix||'INV').toUpperCase()}-2526-001</span></div>
                </Field>
              </div>
              <Field label="UPI ID (optional)">
                <input style={{ ...s.fi, fontFamily: 'var(--mono)' }}
                  value={biz.upi} placeholder="yourname@upi"
                  onChange={e => setBiz(b => ({ ...b, upi: e.target.value }))}/>
                <div style={s.hint}>Auto-generates QR code on invoices</div>
              </Field>
            </>
          )}

          {/* ── STEP 3: VARIABLE FIELDS ── */}
          {step === 3 && (
            <>
              <div style={s.stepNum}>STEP 3 OF 4</div>
              <div style={s.stepTitle}>Customise your fields</div>
              <div style={s.stepSub}>5 flexible slots per record. Leave blank to hide. Rename any time in Settings.</div>

              {/* Entity tabs */}
              <div style={s.tabs}>
                {VF_ENTITIES.map(ent => (
                  <button key={ent.key} style={{
                    ...s.tab,
                    background: vfTab === ent.key ? 'var(--surface)' : 'transparent',
                    color:      vfTab === ent.key ? 'var(--amber)' : 'var(--text2)',
                  }} onClick={() => setVfTab(ent.key)}>
                    {ent.label}
                  </button>
                ))}
              </div>

              {/* Field rows */}
              <div style={s.vfContainer}>
                {VF_ENTITIES.filter(e => e.key === vfTab).map(ent => (
                  <div key={ent.key}>
                    <div style={s.vfHint}>{ent.hint}</div>
                    {vf[ent.key].map((val, i) => {
                      const suggested = template?.vfDefaults[ent.key]?.[i] || ''
                      return (
                        <div key={i} style={s.vfRow}>
                          <div style={s.vfNum}>{i + 1}</div>
                          <input
                            style={s.vfInput}
                            value={val}
                            placeholder={suggested ? `e.g. ${suggested}` : `Field ${i + 1} label (leave blank to hide)`}
                            onChange={e => updateVf(ent.key, i, e.target.value)}
                          />
                          <span style={s.vfPreview}>
                            {val.trim() ? val.toLowerCase().replace(/\s+/g, '_') : '(hidden)'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div style={s.vfNote}>
                💡 Suggested labels shown as placeholders — type your own or leave blank to hide.
              </div>
            </>
          )}

          {/* ── STEP 4: NAME + PIN ── */}
          {step === 4 && (
            <>
              <div style={s.stepNum}>STEP 4 OF 4</div>
              <div style={s.stepTitle}>
                {pinPhase === 'create' ? 'Create your login' : 'Confirm your PIN'}
              </div>
              <div style={s.stepSub}>
                {pinPhase === 'create'
                  ? 'Your PIN encrypts all business data. 4 to 8 digits. Cannot be reset if forgotten.'
                  : `Re-enter your ${pin1.length}-digit PIN to confirm.`}
              </div>

              {/* Owner name — only on create phase */}
              {pinPhase === 'create' && (
                <Field label="Your name *">
                  <input style={{ ...s.fi, fontSize: '15px', padding: '12px 14px' }}
                    value={ownerName}
                    placeholder="e.g. Rajesh Sharma"
                    onChange={e => setOwnerName(e.target.value)}
                  />
                  <div style={s.hint}>Appears on invoices as the business owner.</div>
                </Field>
              )}

              {/* Owner chip — once name locked in */}
              {pinPhase === 'confirm' && ownerName && (
                <div style={s.ownerChip}>
                  <div style={s.ownerAvatar}>
                    {ownerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{ownerName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text2)' }}>👑 Owner</div>
                  </div>
                  <button onClick={() => { setPinPhase('create'); setPin1(''); setPin2('') }}
                    style={s.changeBtn}>Change name</button>
                </div>
              )}

              {/* PIN dots */}
              <PinDots pin={pinPhase === 'create' ? pin1 : pin2} maxLen={pinPhase === 'confirm' ? pin1.length : 8} error={!!pinError} />

              {/* PIN strength bar — create phase only */}
              {pinPhase === 'create' && pin1.length > 0 && (
                <div style={s.strengthTrack}>
                  <div style={{
                    ...s.strengthFill,
                    width: `${pinStrengthPct(pin1)}%`,
                    background: pinStrengthPct(pin1) < 40 ? 'var(--red)' : pinStrengthPct(pin1) < 75 ? 'var(--amber)' : 'var(--teal)',
                  }} />
                </div>
              )}

              {/* Error */}
              {pinError && <div style={s.pinError}>{pinError}</div>}

              {/* PIN warning */}
              {pinPhase === 'create' && pin1.length >= 4 && (
                <div style={s.warningBox}>
                  ⚠️ <strong>Write this PIN down and keep it safe.</strong><br />
                  If you forget it, your data cannot be recovered. There is no backdoor.
                </div>
              )}

              {/* Keypad */}
              <div style={s.keypad}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                  <button
                    key={i}
                    style={{
                      ...s.key,
                      visibility: k === '' ? 'hidden' : 'visible',
                      color:      k === '⌫' ? 'var(--text2)' : 'var(--text)',
                    }}
                    onClick={() => k === '⌫' ? handlePinBack() : handlePinKey(k)}
                    disabled={loading}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Error */}
          {error && <div style={s.errorBox}>{error}</div>}

          {/* Footer buttons */}
          <div style={s.footer}>
            {step > 1 && (
              <button style={s.btnGhost} onClick={back} disabled={loading}>← Back</button>
            )}
            <div style={{ flex: 1 }} />

            {/* Step 4 has split flow */}
            {step < 4 && (
              <button style={s.btnPrimary} onClick={next}>Continue →</button>
            )}

            {step === 4 && pinPhase === 'create' && (
              <button style={{
                ...s.btnPrimary,
                opacity: (pin1.length >= 4 && ownerName.trim().length >= 2) ? 1 : 0.4,
                cursor:  (pin1.length >= 4 && ownerName.trim().length >= 2) ? 'pointer' : 'not-allowed',
              }}
                onClick={goToConfirm}
                disabled={pin1.length < 4 || ownerName.trim().length < 2}>
                Continue →
              </button>
            )}

            {step === 4 && pinPhase === 'confirm' && (
              <button style={{
                ...s.btnPrimary,
                opacity: (pin2 === pin1 && pin2.length >= 4 && !loading) ? 1 : 0.4,
                cursor:  (pin2 === pin1 && pin2.length >= 4 && !loading) ? 'pointer' : 'not-allowed',
              }}
                onClick={completeSetup}
                disabled={pin2 !== pin1 || pin2.length < 4 || loading}>
                {loading ? 'Setting up…' : 'Complete setup →'}
              </button>
            )}
          </div>
        </div>

        {/* Privacy badges */}
        <div style={s.badges}>
          {['🔒 AES-256', '📴 Offline', '🚫 No server', '👁 No tracking'].map(b => (
            <span key={b} style={s.badge}>{b}</span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  )
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{
        fontSize: '10px', fontWeight: 600, color: 'var(--text2)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        display: 'block', marginBottom: '5px',
      }}>{label}</label>
      {children}
    </div>
  )
}

function PinDots({ pin, maxLen, error }) {
  const count = Math.max(pin.length, Math.min(maxLen, 4))
  return (
    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '16px 0 8px' }}>
      {Array.from({ length: count }).map((_, i) => {
        const filled = i < pin.length
        return (
          <div key={i} style={{
            width: '50px', height: '50px', borderRadius: '10px',
            border: `2px solid ${error ? 'var(--red)' : filled ? 'var(--amber)' : 'var(--border2)'}`,
            background: error ? 'var(--red-dim)' : filled ? 'var(--amber-dim)' : 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 700, color: error ? 'var(--red)' : 'var(--amber)',
            fontFamily: 'var(--mono)', transition: 'all 0.15s',
            animation: error ? 'shake 0.3s ease' : 'none',
          }}>
            {filled ? '•' : ''}
          </div>
        )
      })}
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
    </div>
  )
}

function pinStrengthPct(pin) {
  let s = 0
  if (pin.length >= 4) s = 25
  if (pin.length >= 6) s = 50
  if (pin.length >= 7) s = 75
  if (pin.length >= 8) s = 100
  const unique = new Set(pin.split('')).size
  if (unique < 3) s = Math.max(10, s - 20)
  return s
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: '100vh', background: 'var(--bg)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '24px',
  },
  shell: { width: '100%', maxWidth: '680px' },

  // Logo
  logoRow: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '32px' },
  logoMark: {
    width: '42px', height: '42px', background: 'var(--grad-amber)', borderRadius: '12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: 800, color: '#000',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
  },
  logoName: { fontSize: '18px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', textTransform: 'uppercase' },

  // Progress track
  track: { display: 'flex', alignItems: 'flex-start', marginBottom: '32px', position: 'relative' },
  trackStep: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' },
  trackDot: {
    width: '32px', height: '32px', borderRadius: '12px', border: '1px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '12px', fontWeight: 800, fontFamily: 'var(--mono)',
    position: 'relative', zIndex: 1, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  trackLabel: { fontSize: '10px', marginTop: '8px', letterSpacing: '0.08em', fontWeight: 800, textTransform: 'uppercase', textAlign: 'center', transition: 'color 0.3s' },
  trackLine: {
    position: 'absolute', top: '16px', left: '50%', right: '-50%',
    height: '1px', zIndex: 0, transition: 'background 0.3s',
  },

  // Card
  card: {
    background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)',
    borderRadius: '32px', padding: '40px',
    boxShadow: 'var(--glass-shadow)',
    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
  },

  stepNum:   { fontSize: '11px', color: 'var(--amber)', fontFamily: 'var(--mono)', fontWeight: 800, letterSpacing: '0.15em', marginBottom: '10px' },
  stepTitle: { fontSize: '28px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: '10px' },
  stepSub:   { fontSize: '14px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '32px' },

  // Template grid
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },
  templateCard: {
    border: '1px solid', borderRadius: '24px', padding: '24px',
    cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative',
  },
  tIcon: { fontSize: '32px', marginBottom: '12px' },
  tName: { fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' },
  tDesc: { fontSize: '12px', color: 'var(--text3)', lineHeight: 1.6 },
  tTags: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '16px' },
  tTag:  { fontSize: '9px', padding: '4px 8px', borderRadius: '8px', fontFamily: 'var(--mono)', fontWeight: 700, textTransform: 'uppercase' },
  checkMark: {
    position: 'absolute', top: '20px', right: '20px',
    width: '24px', height: '24px', borderRadius: '50%',
    background: 'var(--amber)', color: '#000',
    fontSize: '12px', fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(245, 158, 11, 0.4)',
  },

  // Forms
  fi: {
    width: '100%', padding: '16px', background: 'var(--surface2)',
    border: '1px solid var(--glass-border)', borderRadius: '16px',
    color: 'var(--text)', fontSize: '14px', outline: 'none',
  },
  g2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
  hint: { fontSize: '11px', color: 'var(--text3)', marginTop: '6px' },

  // Variable fields
  tabs: {
    display: 'flex', gap: '4px', background: 'var(--glass-highlight)',
    borderRadius: '16px', padding: '4px', marginBottom: '20px', border: '1px solid var(--glass-border)',
  },
  tab: {
    flex: 1, padding: '12px', textAlign: 'center', borderRadius: '12px',
    cursor: 'pointer', fontSize: '12px', fontWeight: 700,
    border: 'none', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  vfContainer: { marginBottom: '20px' },
  vfHint: {
    fontSize: '12px', color: 'var(--text3)', marginBottom: '16px',
    padding: '16px', background: 'var(--glass-highlight)',
    border: '1px solid var(--glass-border)', borderRadius: '16px', lineHeight: 1.6,
  },
  vfRow: { display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--glass-border)' },
  vfNum: {
    width: '24px', height: '24px', borderRadius: '8px',
    background: 'var(--surface3)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '11px', fontWeight: 800,
    color: 'var(--text2)', fontFamily: 'var(--mono)', flexShrink: 0,
  },
  vfInput: {
    flex: 1, padding: '10px 14px', background: 'var(--surface2)',
    border: '1px solid var(--glass-border)', borderRadius: '12px',
    color: 'var(--text)', fontSize: '14px', outline: 'none',
  },
  vfPreview: { fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)', width: '100px', textAlign: 'right', flexShrink: 0 },
  vfNote: {
    fontSize: '12px', color: 'var(--amber)', padding: '12px 16px',
    background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
    borderRadius: '14px', fontWeight: 600,
  },

  // PIN
  ownerChip: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '16px', background: 'var(--glass-highlight)',
    border: '1px solid var(--glass-border)', borderRadius: '20px', marginBottom: '20px',
  },
  ownerAvatar: {
    width: '40px', height: '40px', borderRadius: '14px',
    background: 'var(--grad-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', fontWeight: 800, color: '#000', flexShrink: 0,
  },
  changeBtn: {
    marginLeft: 'auto', fontSize: '11px', color: 'var(--amber)',
    background: 'transparent', border: 'none', cursor: 'pointer',
    padding: '8px 12px', borderRadius: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  strengthTrack: { height: '4px', background: 'var(--surface3)', borderRadius: '4px', margin: '8px 0 16px', overflow: 'hidden' },
  strengthFill:  { height: '4px', borderRadius: '4px', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s' },
  pinError: { fontSize: '11px', color: 'var(--red)', textAlign: 'center', marginBottom: '12px', fontWeight: 700 },
  warningBox: {
    padding: '16px', background: 'var(--red-dim)',
    border: '1px solid var(--red-border)', borderRadius: '20px',
    fontSize: '12px', color: 'var(--text2)', lineHeight: 1.7, marginBottom: '24px',
  },
  keypad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxWidth: '300px', margin: '0 auto' },
  key: {
    padding: '18px', borderRadius: '16px', border: '1px solid var(--glass-border)',
    background: 'var(--glass-highlight)', fontSize: '20px', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'var(--mono)', transition: 'all 0.2s',
  },

  // Errors / footer
  errorBox: {
    marginTop: '20px', padding: '16px', background: 'var(--red-dim)',
    border: '1px solid var(--red-border)', borderRadius: '16px',
    fontSize: '13px', color: 'var(--red)', fontWeight: 600,
  },
  footer: { display: 'flex', alignItems: 'center', marginTop: '40px', gap: '12px' },
  btnGhost: {
    padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--glass-border)',
    background: 'transparent', color: 'var(--text2)', fontSize: '14px',
    fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
  },
  btnPrimary: {
    padding: '16px 32px', borderRadius: '16px', border: 'none',
    background: 'var(--grad-amber)', color: '#000', fontSize: '14px',
    fontWeight: 800, cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
  },

  // Badges
  badges: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '32px' },
  badge: {
    padding: '6px 14px', borderRadius: '24px', fontSize: '10px',
    background: 'var(--glass)', border: '1px solid var(--glass-border)',
    color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
  },
}
