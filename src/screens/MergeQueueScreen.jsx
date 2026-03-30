import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { useToast } from '../components/ui/Toast.jsx'
import { createRecord, updateRecord, formatMoney, haptic } from '../helpers.js'

/**
 * MergeQueueScreen — Admin view of manager data submissions.
 * Managers create transactions/parties that need admin approval before merging.
 */
export default function MergeQueueScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()
  const toast = useToast()

  const [selectedPush, setSelectedPush] = useState(null)
  const [filter, setFilter] = useState('pending')

  const { result: pushes } = useRxQuery(
    db?.data_push.find({
      selector: {
        business_id: currentUser?.business_id,
        ...(filter !== 'all' ? { status: filter } : {}),
      },
      sort: [{ created_at: 'desc' }]
    }),
    { live: true }
  )

  const { result: users } = useRxQuery(
    db?.users.find({ selector: { business_id: currentUser?.business_id } }),
    { live: true }
  )

  const userMap = useMemo(() => {
    const m = {}
    if (users) users.forEach(u => { m[u.id] = u })
    return m
  }, [users])

  const handleMerge = async (push) => {
    haptic()
    try {
      await updateRecord('data_push', push.id, {
        status: 'merged',
        resolved_by: currentUser.id,
        resolved_at: new Date().toISOString(),
      }, { user_id: currentUser.id, note: `Merged ${push.record_count} records` })
      toast.addToast(`${push.record_count} records merged successfully`, 'success')
      setSelectedPush(null)
    } catch (err) {
      toast.addToast('Merge failed: ' + err.message, 'error')
    }
  }

  const handleReject = async (push, reason) => {
    haptic()
    try {
      await updateRecord('data_push', push.id, {
        status: 'rejected',
        rejected_reason: reason,
        resolved_by: currentUser.id,
        resolved_at: new Date().toISOString(),
      }, { user_id: currentUser.id, note: `Rejected: ${reason}` })
      toast.addToast('Submission rejected', 'success')
      setSelectedPush(null)
    } catch (err) {
      toast.addToast('Reject failed: ' + err.message, 'error')
    }
  }

  const handlePushToAdmin = async () => {
    haptic()
    try {
      // Find all transactions/parties created by this manager that haven't been pushed
      const myTxs = await db.transactions.find({
        selector: { created_by: currentUser.id }
      }).exec()
      const myParties = await db.parties.find({
        selector: { created_by: currentUser.id }
      }).exec()

      const txCount = myTxs.length
      const partyCount = myParties.length
      const totalValue = myTxs.reduce((s, t) => s + (t.total || 0), 0)

      await createRecord('data_push', {
        manager_id: currentUser.id,
        manager_name: currentUser.display_name || currentUser.username,
        status: 'pending',
        record_count: txCount + partyCount,
        total_value: totalValue,
        data_summary: `${txCount} transactions, ${partyCount} parties — Total: ${formatMoney(totalValue)}`,
      }, { user_id: currentUser.id })

      toast.addToast(`${txCount + partyCount} records pushed to admin queue`, 'success')
    } catch (err) {
      toast.addToast('Push failed: ' + err.message, 'error')
    }
  }

  const isAdmin = currentUser?.role === 'admin'

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>{isAdmin ? 'Merge Queue' : 'Push to Admin'}</h1>
          <p style={s.subTitle}>
            {isAdmin ? 'Review and merge manager submissions' : 'Push your data for admin review'}
          </p>
        </div>
        <div style={s.headerRight}>
          {!isAdmin && (
            <button style={s.pushBtn} onClick={handlePushToAdmin}>📤 Push My Data</button>
          )}
        </div>
      </header>

      <div style={s.body}>
        {isAdmin && (
          <div style={s.filterBar}>
            {['pending', 'merged', 'rejected', 'all'].map(f => (
              <button key={f} style={{ ...s.filterBtn, ...(filter === f ? s.filterActive : {}) }}
                onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div style={s.pushList}>
          {(pushes || []).map(push => (
            <div key={push.id} style={s.pushCard} onClick={() => { haptic(); setSelectedPush(push) }}>
              <div style={s.pushTop}>
                <div style={s.pushManager}>
                  <span style={s.pushAvatar}>{(push.manager_name || '?')[0]}</span>
                  <div>
                    <div style={s.pushName}>{push.manager_name || 'Manager'}</div>
                    <div style={s.pushDate}>{new Date(push.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
                <div style={{
                  ...s.pushStatus,
                  background: push.status === 'pending' ? 'var(--amber-dim)' : push.status === 'merged' ? 'var(--teal-dim)' : 'var(--red-dim)',
                  color: push.status === 'pending' ? 'var(--amber)' : push.status === 'merged' ? 'var(--teal)' : 'var(--red)',
                }}>{push.status}</div>
              </div>
              <div style={s.pushSummary}>{push.data_summary}</div>
              <div style={s.pushBottom}>
                <span style={s.pushRecords}>{push.record_count} records</span>
                <span style={s.pushValue}>{formatMoney(push.total_value)}</span>
              </div>
              {isAdmin && push.status === 'pending' && (
                <div style={s.pushActions}>
                  <button style={s.mergeBtn} onClick={e => { e.stopPropagation(); handleMerge(push) }}>Merge</button>
                  <button style={s.rejectBtn} onClick={e => { e.stopPropagation(); handleReject(push, 'Rejected by admin') }}>Reject</button>
                </div>
              )}
            </div>
          ))}
          {(!pushes || pushes.length === 0) && (
            <div style={s.emptyState}>
              {isAdmin ? 'No submissions in queue.' : 'No data pushed yet. Create transactions and push them here.'}
            </div>
          )}
        </div>
      </div>

      {selectedPush && (
        <PushDetailModal push={selectedPush} userMap={userMap} isAdmin={isAdmin}
          onMerge={() => handleMerge(selectedPush)}
          onReject={(reason) => handleReject(selectedPush, reason)}
          onClose={() => setSelectedPush(null)} />
      )}
    </div>
  )
}

function PushDetailModal({ push, userMap, isAdmin, onMerge, onReject, onClose }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <h2 style={s.modalTitle}>Submission Detail</h2>
          <p style={s.modalSub}>{push.manager_name} — {new Date(push.created_at).toLocaleString()}</p>
        </div>
        <div style={s.modalBody}>
          <div style={s.detailRow}>
            <span style={s.detailLabel}>Status</span>
            <span style={s.detailVal}>{push.status}</span>
          </div>
          <div style={s.detailRow}>
            <span style={s.detailLabel}>Records</span>
            <span style={s.detailVal}>{push.record_count}</span>
          </div>
          <div style={s.detailRow}>
            <span style={s.detailLabel}>Total Value</span>
            <span style={s.detailVal}>{formatMoney(push.total_value)}</span>
          </div>
          <div style={s.detailRow}>
            <span style={s.detailLabel}>Summary</span>
            <span style={s.detailVal}>{push.data_summary}</span>
          </div>
          {push.rejected_reason && (
            <div style={s.detailRow}>
              <span style={s.detailLabel}>Rejection Reason</span>
              <span style={{ ...s.detailVal, color: 'var(--red)' }}>{push.rejected_reason}</span>
            </div>
          )}

          {isAdmin && push.status === 'pending' && (
            <div style={s.modalActions}>
              {!showReject ? (
                <>
                  <button style={s.mergeFullBtn} onClick={onMerge}>Merge All Records</button>
                  <button style={s.rejectFullBtn} onClick={() => setShowReject(true)}>Reject Submission</button>
                </>
              ) : (
                <>
                  <div style={s.mField}>
                    <label style={s.mLabel}>Rejection Reason</label>
                    <textarea style={{ ...s.mInput, height: '60px' }} value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)} placeholder="Why is this being rejected?" />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={s.rejectFullBtn} onClick={() => onReject(rejectReason)} disabled={!rejectReason.trim()}>
                      Confirm Reject
                    </button>
                    <button style={s.cancelBtn} onClick={() => setShowReject(false)}>Cancel</button>
                  </div>
                </>
              )}
            </div>
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
  headerRight: {},
  title: { fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },
  body: { flex: 1, padding: '32px', overflowY: 'auto' },

  pushBtn: { padding: '12px 24px', background: 'var(--grad-amber)', color: '#000', borderRadius: '14px', fontWeight: 800, border: 'none', fontSize: '13px', cursor: 'pointer' },

  filterBar: { display: 'flex', gap: '8px', marginBottom: '24px' },
  filterBtn: { padding: '8px 18px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text3)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  filterActive: { background: 'var(--amber-dim)', color: 'var(--amber)', borderColor: 'var(--amber-border)' },

  pushList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  pushCard: {
    background: 'var(--glass)', borderRadius: '20px', padding: '20px 24px',
    border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'all 0.2s',
  },
  pushTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  pushManager: { display: 'flex', gap: '12px', alignItems: 'center' },
  pushAvatar: {
    width: '36px', height: '36px', borderRadius: '10px', background: 'var(--amber-dim)', color: 'var(--amber)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800,
  },
  pushName: { fontSize: '14px', fontWeight: 700 },
  pushDate: { fontSize: '10px', color: 'var(--text3)' },
  pushStatus: { padding: '4px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' },
  pushSummary: { fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' },
  pushBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pushRecords: { fontSize: '12px', color: 'var(--text3)', fontWeight: 700 },
  pushValue: { fontSize: '16px', fontWeight: 800, fontFamily: 'var(--mono)', color: 'var(--amber)' },
  pushActions: { display: 'flex', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--glass-border)' },
  mergeBtn: { padding: '8px 18px', borderRadius: '10px', background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid var(--teal-border)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' },
  rejectBtn: { padding: '8px 18px', borderRadius: '10px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red-border)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' },
  modal: { width: '100%', maxWidth: '480px', background: 'var(--bg)', borderRadius: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.7)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' },
  modalHeader: { padding: '28px 32px', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-highlight)' },
  modalTitle: { fontSize: '20px', fontWeight: 800, color: 'var(--text)' },
  modalSub: { fontSize: '12px', color: 'var(--text3)', marginTop: '4px' },
  modalBody: { padding: '32px' },
  modalFooter: { padding: '20px 32px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--glass-border)' },
  detailLabel: { fontSize: '12px', color: 'var(--text3)', fontWeight: 700 },
  detailVal: { fontSize: '13px', fontWeight: 600 },
  modalActions: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' },
  mergeFullBtn: { padding: '14px', borderRadius: '14px', background: 'var(--teal)', color: '#000', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer' },
  rejectFullBtn: { padding: '14px', borderRadius: '14px', background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid var(--red-border)', fontWeight: 800, fontSize: '14px', cursor: 'pointer' },
  cancelBtn: { padding: '14px', borderRadius: '14px', background: 'transparent', color: 'var(--text3)', border: 'none', fontWeight: 700, cursor: 'pointer' },
  mField: { marginBottom: '16px' },
  mLabel: { display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', marginBottom: '8px', textTransform: 'uppercase' },
  mInput: { width: '100%', padding: '14px', borderRadius: '14px', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--glass-border)', fontSize: '14px', outline: 'none' },

  emptyState: { padding: '60px', textAlign: 'center', color: 'var(--text3)' },
}
