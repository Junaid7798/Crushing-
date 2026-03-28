import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'

// Schemas
import {
  configSchema,
  usersSchema,
  locationsSchema,
  partiesSchema,
  rawMaterialsSchema,
  itemsSchema,
  bomSchema,
  productionRunsSchema,
  transactionsSchema,
  transactionLinesSchema,
  paymentsSchema,
  expensesSchema,
  documentsSchema,
  dailySummarySchema,
  leadsSchema,
  syncLogSchema,
  conflictLogSchema,
  auditLogSchema,
  stockAdjustmentsSchema,
} from './schema.js'

// Guard against double plugin registration in HMR environments
if (!globalThis.__rxdbPluginsAdded) {
  globalThis.__rxdbPluginsAdded = true
  addRxPlugin(RxDBQueryBuilderPlugin)
  addRxPlugin(RxDBMigrationSchemaPlugin)
  addRxPlugin(RxDBUpdatePlugin)
}

let _db = null

export async function initDB() {
  if (_db) return _db

  _db = await createRxDatabase({
    name: 'BusinessOS',
    storage: getRxStorageDexie(),
    multiInstance: false,
    ignoreDuplicate: false,
  })

  await _db.addCollections({
    config:            { schema: configSchema },
    users:             { schema: usersSchema },
    locations:         { schema: locationsSchema },
    parties:           { schema: partiesSchema },
    raw_materials:     { schema: rawMaterialsSchema },
    items:             { schema: itemsSchema },
    bom:               { schema: bomSchema },
    production_runs:   { schema: productionRunsSchema },
    transactions:      { schema: transactionsSchema },
    transaction_lines: { schema: transactionLinesSchema },
    payments:          { schema: paymentsSchema },
    expenses:          { schema: expensesSchema },
    documents:         { schema: documentsSchema },
    daily_summary:     { schema: dailySummarySchema },
    leads:             { schema: leadsSchema },
    sync_log:          { schema: syncLogSchema },
    conflict_log:      { schema: conflictLogSchema },
    audit_log:         { schema: auditLogSchema },
    stock_adjustments: { schema: stockAdjustmentsSchema },
  })

  return _db
}

export function getDB() {
  if (!_db) throw new Error('Database not initialised. Call initDB() first.')
  return _db
}

export default { initDB, getDB }
