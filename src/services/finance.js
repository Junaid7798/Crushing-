// ─────────────────────────────────────────────
// finance.js — BusinessOS Financial Calculations
// Balance recalculation and daily summaries.
// ─────────────────────────────────────────────

import { getDB } from '../db/index.js'
import { uuid, now } from './crud.js'

/**
 * Recalculates a party's balance from all transactions and payments.
 *
 * Convention:
 *   - Sales (customer owes us): negative balance = receivable
 *   - Purchases (we owe vendor): positive balance = payable
 *
 * @param {string} party_id - The party ID
 * @returns {Promise<number>} The calculated balance
 */
export async function recalculatePartyBalance(party_id) {
  const db = getDB()

  const transactions = await db.transactions
    .find({
      selector: {
        party_id: { $eq: party_id },
        status: { $ne: 'cancelled' },
      }
    })
    .exec()

  const payments = await db.payments
    .find({ selector: { party_id: { $eq: party_id } } })
    .exec()

  const totalSales = transactions
    .filter(t => t.tx_type === 'sale')
    .reduce((sum, t) => sum + t.total, 0)

  const totalPurchases = transactions
    .filter(t => t.tx_type === 'purchase')
    .reduce((sum, t) => sum + t.total, 0)

  const totalPaymentsIn = payments.reduce((sum, p) => sum + p.amount, 0)

  // Sales: customer owes us (negative balance = receivable)
  // Purchases: we owe vendor (positive balance = payable)
  const balance = -(totalSales - totalPaymentsIn) + totalPurchases

  const partyDoc = await db.parties.findOne(party_id).exec()
  if (partyDoc) await partyDoc.patch({ balance })

  return balance
}

/**
 * Recalculates the daily summary for a given date.
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Promise<object>} The summary object
 */
export async function recalculateDailySummary(date) {
  const db = getDB()
  const config = await db.config.findOne('main').exec()
  if (!config) throw new Error('Config not found')
  const biz = config.business_id

  const txns = await db.transactions
    .find({ selector: { date: { $eq: date }, business_id: { $eq: biz } } })
    .exec()

  const exps = await db.expenses
    .find({ selector: { date: { $eq: date }, business_id: { $eq: biz } } })
    .exec()

  const sales = txns.filter(t => t.tx_type === 'sale' && t.status !== 'cancelled')
  const purchases = txns.filter(t => t.tx_type === 'purchase' && t.status !== 'cancelled')
  const pmtsIn = txns.filter(t => t.tx_type === 'payment_in')
  const pmtsOut = txns.filter(t => t.tx_type === 'payment_out')

  const total_sales = sales.reduce((s, t) => s + t.total, 0)
  const total_purchases = purchases.reduce((s, t) => s + t.total, 0)
  const total_expenses = exps.reduce((s, e) => s + e.amount, 0)
  const total_payments_in = pmtsIn.reduce((s, t) => s + t.total, 0)
  const total_payments_out = pmtsOut.reduce((s, t) => s + t.total, 0)

  let cogs = 0
  if (sales.length > 0) {
    const saleIds = sales.map(s => s.id)
    const allLines = await db.transaction_lines
      .find({
        selector: {
          transaction_id: { $in: saleIds }
        }
      })
      .exec()

    cogs = allLines.reduce((sum, line) => sum + (line.qty * (line.cost_price || 0)), 0)
  }

  const summary = {
    date,
    total_sales,
    total_purchases,
    total_expenses,
    total_payments_in,
    total_payments_out,
    gross_profit: total_sales - cogs,
    net_cash: total_payments_in - total_payments_out - total_expenses,
    business_id: biz,
    recalculated_at: now(),
  }

  const compositeId = `${date}|${biz}`
  const existing = await db.daily_summary.findOne(compositeId).exec()

  if (existing) {
    await existing.patch(summary)
  } else {
    await db.daily_summary.insert({ id: compositeId, ...summary })
  }

  return summary
}
