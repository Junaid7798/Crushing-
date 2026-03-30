import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { useToast } from '../components/ui/Toast.jsx'
import { createRecord, updateRecord, formatMoney, haptic, uuid } from '../helpers.js'

const DELIVERY_STATUSES = [
  { key: 'assigned',  label: 'Assigned',  color: 'amber', icon: '📋' },
  { key: 'en_route',  label: 'En Route',  color: 'teal',  icon: '🚛' },
  { key: 'arrived',   label: 'Arrived',   color: 'teal',  icon: '📍' },
  { key: 'delivered', label: 'Delivered', color: 'teal',  icon: '✅' },
  { key: 'failed',    label: 'Failed',    color: 'red',   icon: '❌' },
]

/**
 * DeliveryScreen — Delivery management with driver assignment and status tracking.
 */
export default function DeliveryScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()
  const toast = useToast()

  const [view, setView] = useState('kanban') // kanban | list
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState(null)

  const { result: deliveries } = useRxQuery(
    db?.deliveries.find({
      selector: { business_id: currentUser?.business_id },
      sort: [{ scheduled_date: 'desc' }]
    }),
    { live: true }
  )
  const { result: parties } = useRxQuery(
    db?.parties.find({ selector: { business_id: currentUser?.business_id } }),
    { live: true }
  )
  const { result: users } = useRxQuery(
    db?.users.find({ selector: { business_id: currentUser?.business_id, role: 'driver' } }),
    { live: true }
  )
  const { result: vehicles } = useRxQuery(
    db?.vehicles.find({ selector: { business_id: currentUser?.business_id, active: true } }),
    { live: true }
  )

  const partyMap = useMemo(() => {
    const m = {}
    if (parties) parties.forEach(p => { m[p.id] = p })
    return m
  }, [parties])

  const driverMap = useMemo(() => {
    const m = {}
    if (users) users.forEach(u => { m[u.id] = u })
    return m
  }, [users])

  const groupedByStatus = useMemo(() => {
    const groups = {}
    DELIVERY_STATUSES.forEach(s => { groups[s.key] = [] })
    if (deliveries) deliveries.forEach(d => {
      if (groups[d.status]) groups[d.status].push(d)
    })
    return groups
  }, [deliveries])

  const handleStatusChange = async (deliveryId, newStatus) => {
    haptic()
    try {
      const updates = { status: newStatus }
      if (newStatus === 'delivered') updates.completed_at = new Date().toISOString()
      if (newStatus === 'arrived') updates.actual_arrival = new Date().toISOString()
      await updateRecord('deliveries', deliveryId, updates,
        { user_id: currentUser.id, note: `Status → ${newStatus}` })
      toast.addToast(`Delivery ${newStatus}`, 'success')
    } catch (err) {
      toast.addToast('Update failed: ' + err.message, 'error')
    }
  }

  const handleCreateDelivery = async (data) => {
    haptic()
    try {
      await createRecord('deliveries', {
        transaction_id: data.transaction_id || uuid(),
        party_id: data.party_id,
        driver_id: data.driver_id || null,
        vehicle_id: data.vehicle_id || null,
        vehicle_number: data.vehicle_number || '',
        delivery_address: data.delivery_address || partyMap[data.party_id]?.address || '',
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time || null,
        status: 'assigned',
        proof_photos: [],
      }, { user_id: currentUser.id })
      setShowCreate(false)
      toast.addToast('Delivery created', 'success')
    } catch (err) {
      toast.addToast('Failed: ' + err.message, 'error')
    }
  }

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Delivery Management</h1>
          <p style={s.subTitle}>{deliveries?.length || 0} deliveries tracked</p>
        </div>
        <div style={s.headerRight}>
          <div style={s.viewToggle}>
            <button style={{ ...s.vtBtn, ...(view === 'kanban' ? s.vtActive : {}) }}
              onClick={() => setView('kanban')}>Board</button>
            <button style={{ ...s.vtBtn, ...(view === 'list' ? s.vtActive : {}) }}
              onClick={() => setView('list')}>List</button>
          </div>
          <button style={s.addBtn} onClick={() => { haptic(); setShowCreate(true) }}>+ New Delivery</button>
        </div>
      </header>

      <div style={s.body}>
        {view === 'kanban' ? (
          <div style={s.kanban}>
            {DELIVERY_STATUSES.map(status => (
              <div key={status.key} style={s.kCol}>
                <div style={s.kHeader}>
                  <span style={{ color: `var(--${status.color})` }}>{status.icon}</span>
                  <span style={s.kTitle}>{status.label}</span>
                  <span style={s.kCount}>{groupedByStatus[status.key].length}</span>
                </div>
                <div style={s.kList}>
                  {groupedByStatus[status.key].map(d => (
                    <div key={d.id} style={s.kCard} onClick={() => { haptic(); setSelectedDelivery(d) }}>
                      <div style={s.kParty}>{partyMap[d.party_id]?.name || 'Unknown'}</div>
                      <div style={s.kMeta}>{d.scheduled_date} {d.scheduled_time || ''}</div>
                      {d.driver_id && <div style={s.kDriver}>Driver: {driverMap[d.driver_id]?.display_name || 'Assigned'}</div>}
                      <div style={s.kActions}>
                        {status.key === 'assigned' && (
                          <button style={s.kBtn} onClick={e => { e.stopPropagation(); handleStatusChange(d.id, 'en_route') }}>Start</button>
                        )}
                        {status.key === 'en_route' && (
                          <>
                            <button style={s.kBtn} onClick={e => { e.stopPropagation(); handleStatusChange(d.id, 'arrived') }}>Arrived</button>
                            <button style={{ ...s.kBtn, color: 'var(--red)' }} onClick={e => { e.stopPropagation(); handleStatusChange(d.id, 'failed') }}>Failed</button>
                          </>
                        )}
                        {status.key === 'arrived' && (
                          <button style={s.kBtn} onClick={e => { e.stopPropagation(); handleStatusChange(d.id, 'delivered') }}>Confirm</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={s.listView}>
            {(deliveries || []).map(d => (
              <div key={d.id} style={s.listRow} onClick={() => { haptic(); setSelectedDelivery(d) }}>
                <div style={s.listInfo}>
                  <div style={s.listParty}>{partyMap[d.party_id]?.name || 'Unknown'}</div>
                  <div style={s.listMeta}>{d.scheduled_date} · {d.delivery_address?.slice(0, 40) || 'No address'}</div>
                </div>
                <div style={s.listDriver}>{d.driver_id ? (driverMap[d.driver_id]?.display_name || 'Driver') : 'Unassigned'}</div>
                <div style={{
                  ...s.listStatus,
                  background: `var(--${DELIVERY_STATUSES.find(st => st.key === d.status)?.color || 'amber'}-dim)`,
                  color: `var(--${DELIVERY_STATUSES.find(st => st.key === d.status)?.color || 'amber'})`,
                }}>{d.status}</div>
              </div>
            ))}
            {(!deliveries || deliveries.length === 0) && (
              <div style={s.emptyState}>No deliveries yet. Create one to get started.</div>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateDeliveryModal parties={parties || []} drivers={users || []} vehicles={vehicles || []}
          onClose={() => setShowCreate(false)} onSave={handleCreateDelivery} />
      )}

      {selectedDelivery && (
        <DeliveryDetailModal delivery={selectedDelivery} party={partyMap[selectedDelivery.party_id]}
          driver={driverMap[selectedDelivery.driver_id]} db={db} currentUser={currentUser}
          onClose={() => setSelectedDelivery(null)} onStatusChange={handleStatusChange} />
      )}
    </div>
  )
}

function CreateDeliveryModal({ parties, drivers, vehicles, onClose, onSave }) {
  const [data, setData] = useState({
    party_id: '', driver_id: '', vehicle_id: '', vehicle_number: '',
    delivery_address: '', scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '',
  })

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}><h2 style={s.modalTitle}>New Delivery</h2></div>
        <div style={s.modalBody}>
          <div style={s.mField}>
            <label style={s.mLabel}>Customer</label>
            <select style={s.mSelect} value={data.party_id}
              onChange={e => {
                const p = parties.find(pp => pp.id === e.target.value)
                setData(d => ({ ...d, party_id: e.target.value, delivery_address: p?.address || '' }))
              }}>
              <option value="">Select customer...</option>
              {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={s.row}>
            <div style={s.mField}>
              <label style={s.mLabel}>Driver</label>
              <select style={s.mSelect} value={data.driver_id}
                onChange={e => setData(d => ({ ...d, driver_id: e.target.value }))}>
                <option value="">Assign later...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.display_name || d.username}</option>)}
              </select>
            </div>
            <div style={s.mField}>
              <label style={s.mLabel}>Vehicle</label>
              <select style={s.mSelect} value={data.vehicle_id}
                onChange={e => {
                  const v = vehicles.find(vv => vv.id === e.target.value)
                  setData(d => ({ ...d, vehicle_id: e.target.value, vehicle_number: v?.vehicle_number || '' }))
                }}>
                <option value="">Select vehicle...</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} ({v.vehicle_type})</option>)}
              </select>
            </div>
          </div>
          <div style={s.mField}>
            <label style={s.mLabel}>Delivery Address</label>
            <textarea style={{ ...s.mInput, height: '80px' }} value={data.delivery_address}
              onChange={e => setData(d => ({ ...d, delivery_address: e.target.value }))} />
          </div>
          <div style={s.row}>
            <div style={s.mField}>
              <label style={s.mLabel}>Scheduled Date</label>
              <input type="date" style={s.mInput} value={data.scheduled_date}
                onChange={e => setData(d => ({ ...d, scheduled_date: e.target.value }))} />
            </div>
            <div style={s.mField}>
              <label style={s.mLabel}>Time Window</label>
              <input style={s.mInput} placeholder="e.g. 10AM-12PM" value={data.scheduled_time}
                onChange={e => setData(d => ({ ...d, scheduled_time: e.target.value }))} />
            </div>
          </div>
        </div>
        <div style={s.modalFooter}>
          <button style={s.saveBtn} onClick={() => onSave(data)} disabled={!data.party_id}>Create Delivery</button>
        </div>
      </div>
    </div>
  )
}

function DeliveryDetailModal({ delivery, party, driver, db, currentUser, onClose, onStatusChange }) {
  const [notes, setNotes] = useState(delivery.driver_notes || '')

  const handleAddNote = async () => {
    haptic()
    try {
      await updateRecord('deliveries', delivery.id, { driver_notes: notes },
        { user_id: currentUser.id, note: 'Driver note updated' })
    } catch (err) { /* silent */ }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Delivery Detail</h2>
          <p style={s.modalSub}>{party?.name || 'Unknown'} — {delivery.scheduled_date}</p>
        </div>
        <div style={s.modalBody}>
          <div style={s.detailRow}><span style={s.detailLabel}>Status</span><span style={s.detailVal}>{delivery.status}</span></div>
          <div style={s.detailRow}><span style={s.detailLabel}>Address</span><span style={s.detailVal}>{delivery.delivery_address || 'Not set'}</span></div>
          <div style={s.detailRow}><span style={s.detailLabel}>Driver</span><span style={s.detailVal}>{driver?.display_name || 'Unassigned'}</span></div>
          <div style={s.detailRow}><span style={s.detailLabel}>Vehicle</span><span style={s.detailVal}>{delivery.vehicle_number || 'N/A'}</span></div>
          {delivery.actual_arrival && <div style={s.detailRow}><span style={s.detailLabel}>Arrived</span><span style={s.detailVal}>{new Date(delivery.actual_arrival).toLocaleString()}</span></div>}
          {delivery.completed_at && <div style={s.detailRow}><span style={s.detailLabel}>Completed</span><span style={s.detailVal}>{new Date(delivery.completed_at).toLocaleString()}</span></div>}

          <div style={{ ...s.mField, marginTop: '20px' }}>
            <label style={s.mLabel}>Driver Notes</label>
            <textarea style={{ ...s.mInput, height: '60px' }} value={notes}
              onChange={e => setNotes(e.target.value)} onBlur={handleAddNote} />
          </div>

          {/* Status action buttons */}
          <div style={s.statusActions}>
            {delivery.status === 'assigned' && (
              <button style={s.actionBtn} onClick={() => onStatusChange(delivery.id, 'en_route')}>Start Delivery</button>
            )}
            {delivery.status === 'en_route' && (
              <>
                <button style={s.actionBtn} onClick={() => onStatusChange(delivery.id, 'arrived')}>Mark Arrived</button>
                <button style={{ ...s.actionBtn, background: 'var(--red-dim)', color: 'var(--red)' }} onClick={() => onStatusChange(delivery.id, 'failed')}>Failed</button>
              </>
            )}
            {delivery.status === 'arrived' && (
              <button style={s.actionBtn} onClick={() => onStatusChange(delivery.id, 'delivered')}>Confirm Delivery</button>
            )}
            {delivery.status === 'failed' && (
              <button style={s.actionBtn} onClick={() => onStatusChange(delivery.id, 'assigned')}>Reassign</button>
            )}
          </div>
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

  addBtn: { padding: '12px 24px', background: 'var(--grad-amber)', color: '#000', borderRadius: '14px', fontWeight: 800, border: 'none', fontSize: '13px', cursor: 'pointer' },
  viewToggle: { display: 'flex', background: 'var(--glass-highlight)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' },
  vtBtn: { padding: '8px 18px', borderRadius: '10px', border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  vtActive: { background: 'var(--bg)', color: 'var(--amber)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },

  kanban: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', minWidth: '900px' },
  kCol: { background: 'var(--glass-highlight)', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--glass-border)' },
  kHeader: { padding: '16px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--glass-border)' },
  kTitle: { fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 },
  kCount: { background: 'var(--bg)', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, color: 'var(--text3)' },
  kList: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '100px' },
  kCard: {
    background: 'var(--surface)', padding: '14px', borderRadius: '14px', border: '1px solid var(--glass-border)',
    cursor: 'pointer', transition: 'all 0.2s',
  },
  kParty: { fontSize: '13px', fontWeight: 700 },
  kMeta: { fontSize: '10px', color: 'var(--text3)', marginTop: '4px' },
  kDriver: { fontSize: '10px', color: 'var(--teal)', marginTop: '4px', fontWeight: 700 },
  kActions: { display: 'flex', gap: '6px', marginTop: '10px' },
  kBtn: { padding: '6px 12px', borderRadius: '8px', background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', color: 'var(--text)' },

  listView: { display: 'flex', flexDirection: 'column', gap: '8px' },
  listRow: { background: 'var(--glass)', borderRadius: '16px', padding: '16px 20px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer' },
  listInfo: { flex: 1 },
  listParty: { fontSize: '14px', fontWeight: 700 },
  listMeta: { fontSize: '11px', color: 'var(--text3)', marginTop: '2px' },
  listDriver: { fontSize: '12px', color: 'var(--teal)', fontWeight: 600 },
  listStatus: { padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' },
  modal: { width: '100%', maxWidth: '480px', background: 'var(--bg)', borderRadius: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.7)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  modalHeader: { padding: '28px 32px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-highlight)' },
  modalTitle: { fontSize: '20px', fontWeight: 800, color: 'var(--text)' },
  modalSub: { fontSize: '12px', color: 'var(--text3)', marginTop: '4px' },
  modalBody: { padding: '32px' },
  modalFooter: { padding: '20px 32px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' },
  mField: { marginBottom: '20px' },
  mLabel: { display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' },
  mInput: { width: '100%', padding: '14px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '14px', outline: 'none' },
  mSelect: { width: '100%', padding: '14px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '14px', outline: 'none' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  saveBtn: { padding: '14px 28px', background: 'var(--grad-amber)', color: '#000', borderRadius: '14px', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '14px' },
  cancelBtn: { padding: '14px 28px', borderRadius: '14px', background: 'transparent', color: 'var(--text3)', border: 'none', fontWeight: 700, cursor: 'pointer' },

  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--glass-border)' },
  detailLabel: { fontSize: '12px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' },
  detailVal: { fontSize: '13px', fontWeight: 600 },
  statusActions: { display: 'flex', gap: '10px', marginTop: '20px' },
  actionBtn: { padding: '12px 20px', borderRadius: '12px', background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--teal-border)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' },

  emptyState: { padding: '60px', textAlign: 'center', color: 'var(--text3)', gridColumn: '1/-1' },
}
