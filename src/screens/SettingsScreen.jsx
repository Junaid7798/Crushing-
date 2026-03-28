import { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useToast } from '../components/ui/Toast.jsx'
import { haptic, now } from '../helpers.js'

/**
 * SettingsScreen - Premium System Administration & Security.
 */
export default function SettingsScreen() {
  const { config, updateConfig } = useConfig()
  const { currentUser, lock } = useAuth()
  const { db } = useDB()
  const toast = useToast()

  const [formData, setFormData] = useState({
    business_name: config?.business_name || '',
    gstin: config?.gstin || '',
    address: config?.address || '',
    phone: config?.phone || '',
    email: config?.email || '',
    invoice_prefix: config?.invoice_prefix || 'INV',
    currency: config?.currency || '₹',
  })

  useEffect(() => {
    if (config) {
      setFormData({
        business_name: config.business_name || '',
        gstin: config.gstin || '',
        address: config.address || '',
        phone: config.phone || '',
        email: config.email || '',
        invoice_prefix: config.invoice_prefix || 'INV',
        currency: config.currency || '₹',
      })
    }
  }, [config])

  const [showPinModal, setShowPinModal] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const handleSaveConfig = async () => {
    haptic()
    try {
      await updateConfig(formData)
      setStatusMsg('Configuration synced to local storage.')
      setTimeout(() => setStatusMsg(''), 3000)
    } catch (err) { toast.addToast(err.message, 'error') }
  }

  const handleUpdatePin = async () => {
    haptic()
    if (newPin.length < 4 || newPin.length > 8) return toast.addToast('New PIN must be 4 to 8 digits.', 'error')
    try {
      const userDoc = await db.users.findOne(currentUser.id).exec()
      if (userDoc) {
        // SECURITY FIX: Hash PIN before storage (ECC-2.1 Security Audit)
        const { hashPin, verifyPin, deriveKey, initSession } = await import('../helpers.js')
        
        // S2: Verify current PIN
        const isValid = await verifyPin(currentPin, userDoc.pin_hash)
        if (!isValid) return toast.addToast('Current PIN is incorrect.', 'error')

        const hashed = await hashPin(newPin)
        await userDoc.patch({ 
            pin_hash: hashed,
            updated_at: now()
        })
        
        // B2: Re-derive session key
        const newKey = await deriveKey(newPin, config.encryption_salt)
        initSession(newKey)

        setStatusMsg('Security credentials updated.')
        setShowPinModal(false)
        setCurrentPin('')
        setNewPin('')
        setTimeout(() => setStatusMsg(''), 3000)
      }
    } catch (err) { toast.addToast(err.message, 'error') }
  }

  const exportData = async () => {
    haptic()
    try {
      // RxDB v15 removed exportJSON(), use manual collection export
      const collections = Object.keys(db.collections)
      const allData = {}
      for (const name of collections) {
        if (['users', 'audit_log', 'sync_log', 'conflict_log'].includes(name)) continue
        const docs = await db[name].find().exec()
        allData[name] = docs.map(d => {
            const data = d.toJSON()
            if (name === 'config' && data.encryption_salt) {
                delete data.encryption_salt
            }
            return data
        })
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `BusinessOS_Backup_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setStatusMsg('Secure backup generated successfully.')
      setTimeout(() => setStatusMsg(''), 3000)
    } catch (err) { toast.addToast('Export failed: ' + err.message, 'error') }
  }

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>System Control</h1>
          <p style={s.subTitle}>Manage Business Architecture & Security</p>
        </div>
        {statusMsg && <div style={s.statusPill}>✨ {statusMsg}</div>}
      </header>

      <div style={s.body}>
        {/* Business Identity */}
        <section style={s.section}>
          <div style={s.sectionHead}>🏢 Business Ecosystem Identity</div>
          <div style={s.card}>
            <div style={s.fieldRow}>
              <div style={s.field}><label style={s.label}>Enterprise Name</label><input style={s.input} placeholder="e.g. Stark Industries" value={formData.business_name} onChange={e => setFormData(p => ({ ...p, business_name: e.target.value }))} /></div>
              <div style={s.field}><label style={s.label}>GSTIN / Tax ID</label><input style={s.input} placeholder="Optional" value={formData.gstin} onChange={e => setFormData(p => ({ ...p, gstin: e.target.value }))} /></div>
            </div>
            <div style={s.field}><label style={s.label}>Corporate Address</label><textarea style={{ ...s.input, height: '100px', resize: 'none' }} value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} /></div>
            <div style={s.fieldRow}>
              <div style={s.field}><label style={s.label}>Primary Contact</label><input style={s.input} value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
              <div style={s.field}><label style={s.label}>Administrative Email</label><input style={s.input} value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <button style={s.saveBtn} onClick={handleSaveConfig}>Commit Configuration</button>
          </div>
        </section>

        {/* Display & Formatting */}
        <section style={s.section}>
          <div style={s.sectionHead}>🏷️ Localization & Asset Prefixes</div>
          <div style={s.card}>
            <div style={s.fieldRow}>
              <div style={s.field}><label style={s.label}>Invoice Namespace Prefix</label><input style={s.input} value={formData.invoice_prefix} onChange={e => setFormData(p => ({ ...p, invoice_prefix: e.target.value }))} /></div>
              <div style={s.field}><label style={s.label}>Primary Currency</label><input style={s.input} value={formData.currency} onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))} /></div>
            </div>
          </div>
        </section>

        {/* Security & Data Governance */}
        <section style={s.section}>
          <div style={s.sectionHead}>🔐 Governance & Core Protection</div>
          <div style={s.gridRow}>
            <div style={s.smallCard}>
               <h3 style={s.cardTitle}>Master PIN</h3>
               <p style={s.cardText}>Update the 4-digit security key used for local data encryption and session unlocking.</p>
               <button style={s.btnAlt} onClick={() => { haptic(); setShowPinModal(true) }}>Rotate Credentials</button>
            </div>
            <div style={s.smallCard}>
               <h3 style={s.cardTitle}>Data Sovereignty</h3>
               <p style={s.cardText}>Extract the full system state as a portable JSON ledger for off-site disaster recovery.</p>
                <button style={s.btnAlt} onClick={exportData}>Generate Secure Backup</button>
            </div>
            <div style={s.smallCard}>
               <h3 style={s.cardTitle}>Protocol Termination</h3>
               <p style={s.cardText}>Immediately destroy current session tokens and lock the interface for security.</p>
               <button style={{ ...s.btnAlt, color: 'var(--red)', borderColor: 'var(--red-border)' }} onClick={() => { haptic(); lock() }}>Lock Interface Now</button>
            </div>
          </div>
        </section>
        
        <div style={s.versionTag}>Business OS v2.0 Enterprise Release / Local First Architecture</div>
      </div>

      {showPinModal && (
        <div style={s.overlay} onClick={() => setShowPinModal(false)}>
           <div style={s.modal} onClick={e => e.stopPropagation()}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Reset Master Key</h2>
              <p style={{ ...s.subTitle, marginTop: '12px' }}>Define a new 4-digit sequence for terminal isolation.</p>
              <input 
                 autoFocus type="password" maxLength={8} style={{...s.pinInput, marginBottom: '16px'}} placeholder="Current PIN"
                 value={currentPin} onChange={e => setCurrentPin(e.target.value)} 
              />
              <input 
                 type="password" maxLength={8} style={{...s.pinInput, margin: '0 0 32px 0'}} placeholder="New PIN"
                 value={newPin} onChange={e => setNewPin(e.target.value)} 
                 onKeyDown={e => e.key === 'Enter' && handleUpdatePin()}
              />
              <div style={s.modalActions}>
                 <button style={s.saveBtn} onClick={handleUpdatePin}>Synchronize PIN</button>
                 <button style={s.cancelBtn} onClick={() => { haptic(); setShowPinModal(false) }}>Dismiss</button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: { padding: '32px 40px', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  title: { fontSize: '24px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 },
  statusPill: { padding: '8px 16px', background: 'var(--teal-dim)', border: '1px solid var(--teal-border)', color: 'var(--teal)', borderRadius: '12px', fontSize: '12px', fontWeight: 800, animation: 'fadeIn 0.4s ease' },

  body: { flex: 1, padding: '40px', overflowY: 'auto' },
  section: { marginBottom: '48px' },
  sectionHead: { fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text3)', marginBottom: '20px' },
  
  card: { background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderRadius: '32px', padding: '36px', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)' },
  fieldRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '24px' },
  field: { display: 'flex', flexDirection: 'column', gap: '10px' },
  label: { fontSize: '11px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  input: { width: '100%', padding: '18px', background: 'var(--surface2)', borderRadius: '16px', border: '1px solid var(--glass-border)', color: 'var(--text)', outline: 'none', fontSize: '15px', transition: 'border-color 0.2s', fontFamily: 'inherit' },
  
  saveBtn: { background: 'var(--grad-amber)', color: '#000', padding: '18px 36px', borderRadius: '18px', border: 'none', fontWeight: 900, fontSize: '15px', marginTop: '12px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)', transition: 'all 0.2s' },
  
  gridRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px' },
  smallCard: { background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderRadius: '32px', padding: '32px', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)' },
  cardTitle: { fontSize: '16px', fontWeight: 800, marginBottom: '12px', color: 'var(--text)' },
  cardText: { fontSize: '13px', color: 'var(--text3)', marginBottom: '32px', lineHeight: 1.6, fontWeight: 500 },
  btnAlt: { background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)', color: 'var(--text)', padding: '14px 24px', borderRadius: '14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', display: 'inline-block' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { width: '100%', maxWidth: '400px', background: 'var(--bg)', borderRadius: '40px', padding: '48px', textAlign: 'center', border: '1px solid var(--glass-border)', boxShadow: '0 40px 80px rgba(0,0,0,0.8)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  pinInput: { width: '100%', textAlign: 'center', fontSize: '42px', background: 'rgba(255,191,0,0.05)', border: '1px solid var(--amber-dim)', borderRadius: '24px', padding: '24px', margin: '32px 0', color: 'var(--amber)', letterSpacing: '16px', fontWeight: 900, outline: 'none', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.3)' },
  modalActions: { display: 'flex', flexDirection: 'column', gap: '16px' },
  cancelBtn: { padding: '14px', borderRadius: '14px', border: 'none', background: 'none', color: 'var(--text3)', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
  versionTag: { textAlign: 'center', marginTop: '80px', fontSize: '10px', color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.5 },
}
