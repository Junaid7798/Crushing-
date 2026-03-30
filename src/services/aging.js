// ─────────────────────────────────────────────
// aging.js — Payment Aging & Overdue Tracking
// ─────────────────────────────────────────────

/**
 * Aging bucket definitions (days overdue).
 */
export const AGING_BUCKETS = [
  { key: 'current',  label: 'Current',     min: -9999, max: 0,   color: 'teal' },
  { key: 'bucket1',  label: '1-30 Days',   min: 1,     max: 30,  color: 'amber' },
  { key: 'bucket2',  label: '31-60 Days',  min: 31,    max: 60,  color: 'orange' },
  { key: 'bucket3',  label: '61-90 Days',  min: 61,    max: 90,  color: 'red' },
  { key: 'bucket4',  label: '90+ Days',    min: 91,    max: 9999,color: 'red' },
]

/**
 * Calculates aging buckets for a list of pending transactions.
 * @param {Array} transactions - All transactions for the business
 * @param {Date} referenceDate - The date to calculate against (defaults to now)
 * @returns {{ buckets: Object, partyAging: Array, summary: Object }}
 */
export function calculateAging(transactions, referenceDate = new Date()) {
  const today = referenceDate
  const pending = transactions.filter(
    tx => (tx.status === 'pending' || tx.status === 'partial') && tx.balance_due > 0
  )

  const buckets = { current: [], bucket1: [], bucket2: [], bucket3: [], bucket4: [] }
  const partyMap = {}

  pending.forEach(tx => {
    const dueDate = new Date(tx.due_date || tx.date)
    const diffDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))

    let bucketKey
    if (diffDays <= 0) bucketKey = 'current'
    else if (diffDays <= 30) bucketKey = 'bucket1'
    else if (diffDays <= 60) bucketKey = 'bucket2'
    else if (diffDays <= 90) bucketKey = 'bucket3'
    else bucketKey = 'bucket4'

    buckets[bucketKey].push({ ...tx, days_overdue: diffDays })

    // Per-party aggregation
    if (!partyMap[tx.party_id]) {
      partyMap[tx.party_id] = {
        party_id: tx.party_id,
        current: 0, bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0,
        total_outstanding: 0,
        oldest_due_days: 0,
        transaction_count: 0,
      }
    }
    const p = partyMap[tx.party_id]
    p[bucketKey] += tx.balance_due
    p.total_outstanding += tx.balance_due
    p.transaction_count++
    if (diffDays > p.oldest_due_days) p.oldest_due_days = diffDays
  })

  const partyAging = Object.values(partyMap).sort((a, b) => b.total_outstanding - a.total_outstanding)

  const summary = {}
  let grandTotal = 0
  AGING_BUCKETS.forEach(b => {
    const total = buckets[b.key].reduce((s, tx) => s + tx.balance_due, 0)
    summary[b.key] = { count: buckets[b.key].length, total }
    grandTotal += total
  })
  summary.grand_total = grandTotal
  summary.total_parties = partyAging.length

  return { buckets, partyAging, summary }
}

/**
 * Gets aging for a specific party.
 * @param {Array} transactions - All transactions
 * @param {string} partyId
 * @param {Date} referenceDate
 * @returns {{ buckets: Object, total: number, oldestDays: number }}
 */
export function getPartyAging(transactions, partyId, referenceDate = new Date()) {
  const today = referenceDate
  const pending = transactions.filter(
    tx => tx.party_id === partyId && (tx.status === 'pending' || tx.status === 'partial') && tx.balance_due > 0
  )

  const result = { current: 0, bucket1: 0, bucket2: 0, bucket3: 0, bucket4: 0, transactions: [] }
  let oldestDays = 0

  pending.forEach(tx => {
    const dueDate = new Date(tx.due_date || tx.date)
    const diffDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) result.current += tx.balance_due
    else if (diffDays <= 30) result.bucket1 += tx.balance_due
    else if (diffDays <= 60) result.bucket2 += tx.balance_due
    else if (diffDays <= 90) result.bucket3 += tx.balance_due
    else result.bucket4 += tx.balance_due

    if (diffDays > oldestDays) oldestDays = diffDays
    result.transactions.push({ ...tx, days_overdue: diffDays })
  })

  result.total = result.current + result.bucket1 + result.bucket2 + result.bucket3 + result.bucket4
  result.oldestDays = oldestDays
  return result
}

/**
 * Generates a WhatsApp reminder message for overdue transactions.
 */
export function generateReminderMessage(partyName, businessName, totalDue, oldestDays) {
  return `Hello ${partyName},\n\nThis is a payment reminder from *${businessName}*.\n\nYour outstanding balance is *₹${totalDue.toLocaleString('en-IN')}* (overdue by ${oldestDays} days).\n\nPlease arrange payment at your earliest convenience.\n\nThank you.`
}

/**
 * Calculates internal credit score (0-100) based on payment history.
 */
export function calculateCreditScore(transactions, payments, partyId) {
  const partyTxs = transactions.filter(tx => tx.party_id === partyId)
  const partyPays = payments.filter(p => p.party_id === partyId)

  if (partyTxs.length === 0) return { score: 50, grade: 'C', reason: 'No history' }

  const totalTxValue = partyTxs.reduce((s, t) => s + t.total, 0)
  const totalPaid = partyPays.reduce((s, p) => s + p.amount, 0)
  const paidRatio = totalTxValue > 0 ? totalPaid / totalTxValue : 0

  const overdueCount = partyTxs.filter(t => {
    if (t.status === 'paid' || t.status === 'completed') return false
    const due = new Date(t.due_date || t.date)
    return new Date() > due
  }).length

  const overduePenalty = Math.min(overdueCount * 10, 40)
  const baseScore = Math.round(paidRatio * 100)
  const score = Math.max(0, Math.min(100, baseScore - overduePenalty))

  let grade, reason
  if (score >= 80) { grade = 'A'; reason = 'Excellent payer' }
  else if (score >= 60) { grade = 'B'; reason = 'Good, minor delays' }
  else if (score >= 40) { grade = 'C'; reason = 'Average, some overdue' }
  else if (score >= 20) { grade = 'D'; reason = 'Poor, frequent delays' }
  else { grade = 'F'; reason = 'High risk — consider NPA' }

  return { score, grade, reason }
}
