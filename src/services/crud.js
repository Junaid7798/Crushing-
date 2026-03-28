// ─────────────────────────────────────────────
// crud.js — BusinessOS CRUD Operations
// All create/update/delete goes through these wrappers.
// Handles: id, timestamps, sync log, audit log.
// ─────────────────────────────────────────────

import { getDB } from '../db/index.js'

// ── TIMESTAMP + UUID ──────────────────────────

/**
 * Generates a cryptographically random UUID v4.
 * @returns {string}
 */
export function uuid() {
  return crypto.randomUUID()
}

/**
 * Returns current ISO timestamp.
 * @returns {string}
 */
export function now() {
  return new Date().toISOString()
}

// ── SYNC LOG ──────────────────────────────────

/**
 * Records a sync log entry for packet export tracking.
 */
async function logSync(entity, entity_id, operation, config) {
  const db = getDB()
  const cfg = config || await db.config.findOne('main').exec()
  if (!cfg) throw new Error('Config not found — DB not initialised')

  await db.sync_log.insert({
    id: uuid(),
    entity,
    entity_id,
    operation,
    device_id: cfg.device_id,
    synced: false,
    packet_id: null,
    business_id: cfg.business_id,
    created_at: now(),
  })
}

// ── AUDIT LOG ─────────────────────────────────

/**
 * Records an immutable audit log entry.
 */
async function logAudit({ entity, entity_id, operation, user_id, before, after, note }, config) {
  const db = getDB()
  const cfg = config || await db.config.findOne('main').exec()
  if (!cfg) throw new Error('Config not found — DB not initialised')

  await db.audit_log.insert({
    id: uuid(),
    entity,
    entity_id,
    operation,
    user_id: user_id ?? null,
    device_id: cfg.device_id,
    before: before ?? null,
    after: after ?? null,
    note: note ?? '',
    business_id: cfg.business_id,
    created_at: now(),
  })
}

// ── PERMISSION CHECK ──────────────────────────

const PERMISSION_MAP = {
  'create:transactions': 'can_record_sales',
  'create:transaction_lines': 'can_record_sales',
  'create:payments': 'can_collect_payments',
  'create:expenses': 'can_record_expenses',
  'create:items': 'can_edit_items',
  'create:parties': 'can_edit_parties',
  'create:leads': 'can_manage_leads',
  'update:transactions': 'can_edit_transactions',
  'update:items': 'can_edit_items',
  'update:parties': 'can_edit_parties',
  'update:leads': 'can_manage_leads',
  'delete': 'can_delete',
}

/**
 * Enforces role-based access control for CRUD operations.
 */
async function checkPermission(operation, table, user_id) {
  if (!user_id) return
  const key = PERMISSION_MAP[`${operation}:${table}`] || PERMISSION_MAP[operation]
  if (!key) return

  const db = getDB()
  const userDoc = await db.users.findOne(user_id).exec()
  if (!userDoc) throw new Error('User not found for permission check')

  const user = userDoc.toJSON()
  if (user.role === 'admin') return

  const permissions = user.permissions || {}
  if (permissions[key] === false) {
    throw new Error(`Permission denied: ${operation} on ${table}`)
  }
}

// ── CRUD WRAPPERS ─────────────────────────────

/**
 * Creates a new record with audit trail.
 * @param {string} table - Collection name
 * @param {object} data - Record data
 * @param {{user_id?: string, note?: string}} opts
 * @returns {Promise<object>} The created record
 */
export async function createRecord(table, data, { user_id, note = '' } = {}) {
  const db = getDB()
  const config = await db.config.findOne('main').exec()
  if (!config) throw new Error('Config not found — DB not initialised')

  await checkPermission('create', table, user_id)

  const record = {
    ...data,
    id: data.id ?? uuid(),
    business_id: config.business_id,
    created_at: now(),
    created_by: user_id ?? null,
    updated_at: now(),
    updated_by: user_id ?? null,
    edit_note: note,
  }

  await db[table].insert(record)
  await logSync(table, record.id, 'create', config)
  await logAudit({
    entity: table,
    entity_id: record.id,
    operation: 'create',
    user_id,
    before: null,
    after: record,
    note,
  }, config)

  return record
}

/**
 * Updates an existing record with audit trail.
 * @param {string} table - Collection name
 * @param {string} id - Record ID
 * @param {object} changes - Fields to update
 * @param {{user_id?: string, note?: string}} opts
 * @returns {Promise<object>} The updated record
 */
export async function updateRecord(table, id, changes, { user_id, note = '' } = {}) {
  const db = getDB()

  await checkPermission('update', table, user_id)

  const doc = await db[table].findOne(id).exec()
  if (!doc) throw new Error(`Record ${id} not found in ${table}`)

  const before = doc.toJSON()
  const after = {
    ...before,
    ...changes,
    updated_at: now(),
    updated_by: user_id ?? null,
    edit_note: note,
  }

  await doc.patch({
    ...changes,
    updated_at: after.updated_at,
    updated_by: after.updated_by,
    edit_note: after.edit_note,
  })

  await logSync(table, id, 'update')
  await logAudit({
    entity: table,
    entity_id: id,
    operation: 'update',
    user_id,
    before,
    after,
    note,
  })

  return after
}

/**
 * Deletes a record with audit trail.
 * @param {string} table - Collection name
 * @param {string} id - Record ID
 * @param {{user_id?: string, note?: string}} opts
 */
export async function deleteRecord(table, id, { user_id, note = '' } = {}) {
  const db = getDB()

  await checkPermission('delete', table, user_id)

  const doc = await db[table].findOne(id).exec()
  if (!doc) throw new Error(`Record ${id} not found in ${table}`)

  const before = doc.toJSON()
  await doc.remove()

  await logSync(table, id, 'delete')
  await logAudit({
    entity: table,
    entity_id: id,
    operation: 'delete',
    user_id,
    before,
    after: null,
    note,
  })
}
