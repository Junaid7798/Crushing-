// ─────────────────────────────────────────────
// sync.js — BusinessOS Sync Packet Operations
// Build outgoing encrypted packets, import incoming,
// resolve conflicts.
// ─────────────────────────────────────────────

import { getDB } from '../db/index.js'
import { encryptRecord, decryptRecord } from './crypto.js'
import { uuid, now } from './crud.js'

// Whitelist of allowed entities for sync operations
const SYNC_ALLOWED_ENTITIES = new Set([
  'transactions', 'transaction_lines', 'payments', 'parties',
  'items', 'raw_materials', 'bom', 'production_runs',
  'expenses', 'documents', 'leads', 'stock_adjustments',
  'locations', 'users', 'config', 'daily_summary'
])

/**
 * Builds an encrypted sync packet containing all unsynced changes.
 * @returns {Promise<{iv: string, data: string}>} Encrypted packet
 */
export async function buildSyncPacket() {
  const db = getDB()
  const config = await db.config.findOne('main').exec()
  if (!config) throw new Error('Config not found')

  const unsynced = await db.sync_log
    .find({ selector: { synced: { $eq: false } } })
    .exec()

  const changes = []
  for (const log of unsynced) {
    if (!SYNC_ALLOWED_ENTITIES.has(log.entity)) continue

    const doc = await db[log.entity]?.findOne(log.entity_id).exec()
    const record = doc ? doc.toJSON() : null
    changes.push({
      entity: log.entity,
      id: log.entity_id,
      op: log.operation,
      data: record,
      ts: log.created_at,
    })
  }

  const packet = {
    packet_id: uuid(),
    device_id: config.device_id,
    business_id: config.business_id,
    created_at: now(),
    changes,
  }

  const encrypted = await encryptRecord(packet)

  const packetId = packet.packet_id
  for (const log of unsynced) {
    await log.patch({ synced: true, packet_id: packetId })
  }

  return encrypted
}

/**
 * Imports an encrypted sync packet, detecting conflicts.
 * @param {{iv: string, data: string}} encryptedBlob - The encrypted packet
 * @returns {Promise<object[]>} Array of detected conflicts
 */
export async function importSyncPacket(encryptedBlob) {
  const db = getDB()
  const packet = await decryptRecord(encryptedBlob)
  const config = await db.config.findOne('main').exec()
  if (!config) throw new Error('Config not found')

  if (packet.business_id !== config.business_id) {
    throw new Error('Packet is from a different business — rejected')
  }

  const conflicts = []

  for (const change of packet.changes) {
    if (!SYNC_ALLOWED_ENTITIES.has(change.entity)) {
      console.warn(`Sync: Blocked write to restricted entity "${change.entity}"`)
      continue
    }

    const collection = db[change.entity]
    if (!collection) continue

    const existingDoc = await collection.findOne(change.id).exec()
    const existing = existingDoc ? existingDoc.toJSON() : null

    if (!existing) {
      if (change.op === 'create' || change.op === 'update') {
        if (change.data) await collection.insert(change.data)
      }
      continue
    }

    if (change.op === 'update' && existing.updated_at !== change.data?.updated_at) {
      const conflict = {
        id: uuid(),
        entity: change.entity,
        entity_id: change.id,
        status: 'pending',
        version_a: {
          device_id: packet.device_id,
          data: change.data,
          edit_note: change.data?.edit_note ?? '',
          timestamp: change.data?.updated_at,
        },
        version_b: {
          device_id: config.device_id,
          data: existing,
          edit_note: existing.edit_note ?? '',
          timestamp: existing.updated_at,
        },
        resolved_version: null,
        resolved_data: null,
        resolved_by: null,
        resolved_note: null,
        resolved_at: null,
        business_id: config.business_id,
        created_at: now(),
      }

      await db.conflict_log.insert(conflict)
      conflicts.push(conflict)
      continue
    }

    if (change.op === 'delete') {
      await existingDoc.remove()
      continue
    }

    if (change.data) {
      const incomingNewer =
        new Date(change.data.updated_at) > new Date(existing.updated_at)
      if (incomingNewer) await existingDoc.patch(change.data)
    }
  }

  return conflicts
}

/**
 * Resolves a sync conflict by selecting a version or applying manual data.
 * @param {string} conflict_id - The conflict record ID
 * @param {{version: string, manual_data?: object, resolved_by?: string, note?: string}} opts
 */
export async function resolveConflict(conflict_id, { version, manual_data, resolved_by, note }) {
  const db = getDB()
  const conflictDoc = await db.conflict_log.findOne(conflict_id).exec()
  if (!conflictDoc) throw new Error('Conflict not found')

  const conflict = conflictDoc.toJSON()

  let finalData
  if (version === 'a') finalData = conflict.version_a.data
  else if (version === 'b') finalData = conflict.version_b.data
  else finalData = manual_data

  if (manual_data && version === 'manual') {
    const IMMUTABLE_FIELDS = ['id', 'business_id', 'created_at', 'created_by']
    finalData = Object.fromEntries(
      Object.entries(manual_data).filter(([k]) => !IMMUTABLE_FIELDS.includes(k))
    )
  }

  const entityCollection = db[conflict.entity]
  if (!entityCollection) throw new Error(`Unknown entity: ${conflict.entity}`)

  const entityDoc = await entityCollection.findOne(conflict.entity_id).exec()
  if (entityDoc) {
    await entityDoc.patch(finalData)
  } else {
    if (finalData) await entityCollection.insert(finalData)
  }

  await conflictDoc.patch({
    status: 'resolved',
    resolved_version: version,
    resolved_data: finalData,
    resolved_by: resolved_by ?? null,
    resolved_note: note ?? '',
    resolved_at: now(),
  })
}
