// ─────────────────────────────────────────────
// stock.js — BusinessOS Stock Management
// Raw material deduction, finished stock add/deduct.
// ─────────────────────────────────────────────

import { getDB } from '../db/index.js'
import { now } from './crud.js'

/**
 * Deducts raw materials from stock based on BOM for a production run.
 * @param {string} item_id - The finished item ID
 * @param {number} qty_produced - Quantity being produced
 */
export async function deductRawMaterialsForRun(item_id, qty_produced) {
  const db = getDB()
  const bomLines = await db.bom
    .find({ selector: { item_id: { $eq: item_id } } })
    .exec()

  for (const line of bomLines) {
    const rmDoc = await db.raw_materials.findOne(line.raw_material_id).exec()
    if (!rmDoc) continue
    const newQty = rmDoc.stock_qty - (line.qty_per_unit * qty_produced)
    await rmDoc.patch({ stock_qty: newQty, updated_at: now() })
  }
}

/**
 * Adds finished stock after production, recalculating weighted average cost.
 * @param {string} item_id - The item ID
 * @param {number} qty_produced - Quantity produced
 * @param {number} cost_per_unit - Cost per unit of the produced batch
 */
export async function addFinishedStock(item_id, qty_produced, cost_per_unit) {
  const db = getDB()
  const itemDoc = await db.items.findOne(item_id).exec()
  if (!itemDoc) throw new Error(`Item ${item_id} not found`)

  const oldQty = itemDoc.stock_qty ?? 0
  const oldCost = itemDoc.cost_price ?? 0
  const newQty = oldQty + qty_produced
  const newAvgCost = newQty > 0
    ? (oldQty * oldCost + qty_produced * cost_per_unit) / newQty
    : cost_per_unit

  await itemDoc.patch({
    stock_qty: newQty,
    cost_price: newAvgCost,
    updated_at: now(),
  })
}

/**
 * Deducts finished stock for a sale. Throws if insufficient stock.
 * @param {string} item_id - The item ID
 * @param {number} qty_sold - Quantity being sold
 */
export async function deductFinishedStock(item_id, qty_sold) {
  const db = getDB()
  const itemDoc = await db.items.findOne(item_id).exec()
  if (!itemDoc) throw new Error(`Item ${item_id} not found`)

  const newQty = (itemDoc.stock_qty ?? 0) - qty_sold
  if (newQty < 0) throw new Error(`Insufficient stock for ${itemDoc.name}`)
  await itemDoc.patch({ stock_qty: newQty, updated_at: now() })
}
