// ─────────────────────────────────────────────
// schema.js — BusinessOS
// Database: RxDB v15+ (replaces Dexie.js)
// ─────────────────────────────────────────────

// SHARED FIELD DEFINITIONS
const UUID_FIELD       = { type: 'string', maxLength: 36 }
const SHORT_STRING     = { type: 'string', maxLength: 100 }
const MEDIUM_STRING    = { type: 'string', maxLength: 500 }
const LONG_STRING      = { type: 'string' }
const DATE_STRING      = { type: 'string', maxLength: 10 }   // YYYY-MM-DD
const TIMESTAMP_STRING = { type: 'string', maxLength: 30 }   // ISO timestamp
const NUMBER_FIELD     = { type: 'number' }
const BOOLEAN_FIELD    = { type: 'boolean' }
const NULLABLE_UUID    = { type: ['string', 'null'], maxLength: 36 }
const NULLABLE_STRING  = { type: ['string', 'null'] }
const NULLABLE_NUMBER  = { type: ['number', 'null'] }

const VARIABLE_FIELDS = {
  field_1_value: MEDIUM_STRING,
  field_2_value: MEDIUM_STRING,
  field_3_value: MEDIUM_STRING,
  field_4_value: MEDIUM_STRING,
  field_5_value: MEDIUM_STRING,
}

const AUDIT_FIELDS = {
  created_at:  TIMESTAMP_STRING,
  created_by:  NULLABLE_UUID,
  updated_at:  TIMESTAMP_STRING,
  updated_by:  NULLABLE_UUID,
  edit_note:   MEDIUM_STRING,
}

// 1. CONFIG
export const configSchema = {
  version: 0,
  primaryKey: 'key',
  type: 'object',
  properties: {
    key:          { type: 'string', maxLength: 50 },  // always 'main'
    business_name: SHORT_STRING,
    gstin:         SHORT_STRING,
    address:       MEDIUM_STRING,
    phone:         SHORT_STRING,
    email:         SHORT_STRING,
    upi_id:        SHORT_STRING,
    invoice_prefix: { type: 'string', maxLength: 10 },
    template:      SHORT_STRING,
    currency:      { type: 'string', maxLength: 10 },
    modules: {
      type: 'object',
      properties: {
        inventory:    BOOLEAN_FIELD,
        raw_materials: BOOLEAN_FIELD,
        production:   BOOLEAN_FIELD,
        vendors:      BOOLEAN_FIELD,
        gst:          BOOLEAN_FIELD,
        npa:          BOOLEAN_FIELD,
        multi_user:   BOOLEAN_FIELD,
        device_sync:  BOOLEAN_FIELD,
        branded_pdf:  BOOLEAN_FIELD,
        cloud_backup: BOOLEAN_FIELD,
      }
    },
    party_fields:        { type: 'array', items: { type: 'object' } },
    item_fields:         { type: 'array', items: { type: 'object' } },
    transaction_fields:  { type: 'array', items: { type: 'object' } },
    raw_material_fields: { type: 'array', items: { type: 'object' } },
    bank_name:          SHORT_STRING,
    bank_account:       SHORT_STRING,
    bank_ifsc:          SHORT_STRING,
    bank_holder:        SHORT_STRING,
    device_id:      { type: 'string', maxLength: 36 },
    business_id:    { type: 'string', maxLength: 36 },
    encryption_salt: LONG_STRING,
    terms_and_conditions: LONG_STRING,
    thank_you_message:    MEDIUM_STRING,
    created_at:   TIMESTAMP_STRING,
    onboarded_at: TIMESTAMP_STRING,
  },
  required: ['key'],
}

// 2. USERS
export const usersSchema = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:           UUID_FIELD,
    username:     { type: 'string', maxLength: 100 },
    pin_hash:     LONG_STRING,
    role:         { type: 'string', maxLength: 20 },
    business_id:  UUID_FIELD,
    display_name: SHORT_STRING,
    permissions: {
      type: 'object',
      properties: {
        can_view_reports:      BOOLEAN_FIELD,
        can_view_financials:   BOOLEAN_FIELD,
        can_view_party_balances: BOOLEAN_FIELD,
        can_edit_transactions: BOOLEAN_FIELD,
        can_record_sales:      BOOLEAN_FIELD,
        can_collect_payments:  BOOLEAN_FIELD,
        can_delete:            BOOLEAN_FIELD,
        can_export:            BOOLEAN_FIELD,
        can_view_production:   BOOLEAN_FIELD,
        can_edit_items:        BOOLEAN_FIELD,
        can_edit_parties:      BOOLEAN_FIELD,
        can_view_gst:          BOOLEAN_FIELD,
        can_view_insights:     BOOLEAN_FIELD,
        can_manage_leads:      BOOLEAN_FIELD,
        can_record_expenses:   BOOLEAN_FIELD,
        can_manage_users:      BOOLEAN_FIELD,
      }
    },
    assigned_location_id: NULLABLE_UUID,
    push_status: { type: ['string', 'null'], maxLength: 20 },
    working_hours_start: { type: ['string', 'null'], maxLength: 5 },
    working_hours_end:   { type: ['string', 'null'], maxLength: 5 },
    active:     BOOLEAN_FIELD,
    created_at: TIMESTAMP_STRING,
    created_by: NULLABLE_UUID,
  },
  required: ['id', 'username', 'pin_hash', 'role', 'business_id'],
  indexes: ['business_id', 'role', 'username'],
}

// 3. LOCATIONS
export const locationsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    name:        SHORT_STRING,
    type:        { type: 'string', maxLength: 20 },
    address:     MEDIUM_STRING,
    phone:       SHORT_STRING,
    active:      BOOLEAN_FIELD,
    business_id: UUID_FIELD,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'name', 'type', 'business_id'],
  indexes: ['business_id', 'active', ['business_id', 'active']],
}

// 4. PARTIES
export const partiesSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:           UUID_FIELD,
    type:         { type: 'string', maxLength: 20 },
    name:         SHORT_STRING,
    phone:        { type: 'string', maxLength: 20 },
    email:        SHORT_STRING,
    address:      MEDIUM_STRING,
    balance:      NUMBER_FIELD,
    credit_limit: NUMBER_FIELD,
    npa:         BOOLEAN_FIELD,
    npa_amount:  NUMBER_FIELD,
    npa_reason:  MEDIUM_STRING,
    npa_date:    NULLABLE_STRING,
    business_id: UUID_FIELD,
    ...VARIABLE_FIELDS,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'type', 'name', 'business_id'],
  indexes: [
    'business_id', 'type', 'phone', 'balance', 'npa',
    ['type', 'business_id'], ['business_id', 'type'],
  ],
}

// 5. RAW MATERIALS
export const rawMaterialsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:               UUID_FIELD,
    name:             SHORT_STRING,
    unit:             { type: 'string', maxLength: 30 },
    stock_qty:        NUMBER_FIELD,
    avg_cost:         NUMBER_FIELD,
    low_stock_alert:  NUMBER_FIELD,
    business_id:      UUID_FIELD,
    ...VARIABLE_FIELDS,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'name', 'unit', 'business_id'],
  indexes: ['business_id', 'name'],
}

// 6. ITEMS
export const itemsSchema = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    name:        SHORT_STRING,
    item_type:   { type: 'string', maxLength: 20 },
    unit:        { type: 'string', maxLength: 30 },
    unit_category: { type: 'string', maxLength: 20 },
    selling_unit:  { type: 'string', maxLength: 30 },
    allow_decimal_qty: BOOLEAN_FIELD,
    stock_qty:   NUMBER_FIELD,
    cost_price:  NUMBER_FIELD,
    sell_price_retail:     NUMBER_FIELD,
    sell_price_wholesale:  NUMBER_FIELD,
    gst_rate:    NUMBER_FIELD,
    low_stock_alert: NUMBER_FIELD,
    active:      BOOLEAN_FIELD,
    location_id: NULLABLE_UUID,
    business_id: UUID_FIELD,
    ...VARIABLE_FIELDS,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'name', 'item_type', 'business_id'],
  indexes: [
    'business_id', 'name', 'item_type', 'active', 'location_id',
    ['business_id', 'active'], ['business_id', 'item_type'],
  ],
}

// 7. BILL OF MATERIALS (BOM)
export const bomSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:               UUID_FIELD,
    item_id:          UUID_FIELD,
    raw_material_id:  UUID_FIELD,
    qty_per_unit:     NUMBER_FIELD,
    unit:             { type: 'string', maxLength: 30 },
    business_id:      UUID_FIELD,
    created_at:       TIMESTAMP_STRING,
    created_by:       NULLABLE_UUID,
  },
  required: ['id', 'item_id', 'raw_material_id', 'qty_per_unit', 'business_id'],
  indexes: [
    'business_id', 'item_id', 'raw_material_id',
    ['item_id', 'business_id'],
  ],
}

// 8. PRODUCTION RUNS
export const productionRunsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:            UUID_FIELD,
    item_id:       UUID_FIELD,
    qty_produced:  NUMBER_FIELD,
    date:          DATE_STRING,
    cost_per_unit: NUMBER_FIELD,
    labour_cost:   NUMBER_FIELD,
    notes:         MEDIUM_STRING,
    business_id:   UUID_FIELD,
    materials_used: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          raw_material_id:   { type: 'string' },
          raw_material_name: { type: 'string' },
          qty:               { type: 'number' },
          unit_cost:         { type: 'number' },
        }
      }
    },
    ...VARIABLE_FIELDS,
    created_at:  TIMESTAMP_STRING,
    created_by:  NULLABLE_UUID,
    edit_note:   MEDIUM_STRING,
  },
  required: ['id', 'item_id', 'qty_produced', 'date', 'business_id'],
  indexes: [
    'business_id', 'item_id', 'date',
    ['item_id', 'date'], ['business_id', 'date'],
  ],
}

// 9. TRANSACTIONS
export const transactionsSchema = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:       UUID_FIELD,
    tx_type:  { type: 'string', maxLength: 20 },
    party_id:   UUID_FIELD,
    date:       DATE_STRING,
    due_date:   NULLABLE_STRING,
    doc_type:   { type: 'string', maxLength: 20 },
    status:     { type: 'string', maxLength: 20 },
    subtotal:     NUMBER_FIELD,
    gst_amount:   NUMBER_FIELD,
    total:        NUMBER_FIELD,
    paid_amount:  NUMBER_FIELD,
    balance_due:  NUMBER_FIELD,
    payment_mode: { type: 'string', maxLength: 20 },
    payment_ref:  MEDIUM_STRING,
    sale_channel: NULLABLE_STRING,
    notes:        MEDIUM_STRING,
    reminder_date: NULLABLE_STRING,
    reminder_type: NULLABLE_STRING,
    npa_status:    { type: ['string', 'null'], maxLength: 20 },
    npa_declared_at: NULLABLE_STRING,
    npa_declared_by: NULLABLE_UUID,
    npa_reason:      MEDIUM_STRING,
    write_off_amount: NUMBER_FIELD,
    location_id: NULLABLE_UUID,
    business_id: UUID_FIELD,
    ...VARIABLE_FIELDS,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'tx_type', 'party_id', 'date', 'status', 'total', 'business_id'],
  indexes: [
    'business_id', 'tx_type', 'party_id', 'date', 'status', 'npa_status',
    ['party_id', 'status'], ['tx_type', 'date'], ['business_id', 'date'], ['business_id', 'tx_type'],
  ],
}

// 10. TRANSACTION LINES
export const transactionLinesSchema = {
  version: 1,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:             UUID_FIELD,
    transaction_id: UUID_FIELD,
    item_id:        UUID_FIELD,
    item_name:      SHORT_STRING,
    qty:            NUMBER_FIELD,
    unit:           { type: 'string', maxLength: 30 },
    unit_price:     NUMBER_FIELD,
    discount:       NUMBER_FIELD,
    gst_rate:       NUMBER_FIELD,
    gst_amount:     NUMBER_FIELD,
    line_total:     NUMBER_FIELD,
    cost_price:     NUMBER_FIELD,
    rate_override:  BOOLEAN_FIELD,
    rate_date:      NULLABLE_STRING,
    business_id:    UUID_FIELD,
  },
  required: ['id', 'transaction_id', 'item_id', 'business_id'],
  indexes: [
    'business_id', 'transaction_id', 'item_id',
    ['transaction_id', 'business_id'],
  ],
}

// 11. PAYMENTS
export const paymentsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:             UUID_FIELD,
    transaction_id: UUID_FIELD,
    party_id:       UUID_FIELD,
    amount:         NUMBER_FIELD,
    date:           DATE_STRING,
    mode:           { type: 'string', maxLength: 20 },
    reference:      MEDIUM_STRING,
    notes:          MEDIUM_STRING,
    business_id:    UUID_FIELD,
    created_at:     TIMESTAMP_STRING,
    created_by:     NULLABLE_UUID,
  },
  required: ['id', 'transaction_id', 'party_id', 'amount', 'date', 'business_id'],
  indexes: [
    'business_id', 'transaction_id', 'party_id', 'date',
    ['party_id', 'business_id'], ['transaction_id', 'business_id'],
  ],
}

// 12. EXPENSES
export const expensesSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    category:    { type: 'string', maxLength: 50 },
    description: MEDIUM_STRING,
    amount:      NUMBER_FIELD,
    date:        DATE_STRING,
    paid_to:     SHORT_STRING,
    mode:        { type: 'string', maxLength: 20 },
    business_id: UUID_FIELD,
    created_at:  TIMESTAMP_STRING,
    created_by:  NULLABLE_UUID,
    edit_note:   MEDIUM_STRING,
  },
  required: ['id', 'category', 'amount', 'date', 'business_id'],
  indexes: [
    'business_id', 'category', 'date',
    ['category', 'date'], ['business_id', 'date'],
  ],
}

// 13. DOCUMENTS
export const documentsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:             UUID_FIELD,
    doc_type:       { type: 'string', maxLength: 30 },
    transaction_id: NULLABLE_UUID,
    party_id:       NULLABLE_UUID,
    doc_number:     { type: 'string', maxLength: 30 },
    date:           DATE_STRING,
    pdf_blob:       LONG_STRING,
    business_id:    UUID_FIELD,
    created_at:     TIMESTAMP_STRING,
    created_by:     NULLABLE_UUID,
  },
  required: ['id', 'doc_type', 'business_id'],
  indexes: [
    'business_id', 'doc_type', 'date', 'transaction_id', 'party_id',
    ['business_id', 'date'],
  ],
}

// 14. DAILY SUMMARY
export const dailySummarySchema = {
  version: 0,
  primaryKey: {
    key: 'id',
    fields: ['date', 'business_id'],
    separator: '|',
  },
  type: 'object',
  properties: {
    id:                  { type: 'string', maxLength: 70 },
    date:                DATE_STRING,
    total_sales:         NUMBER_FIELD,
    total_purchases:     NUMBER_FIELD,
    total_expenses:      NUMBER_FIELD,
    total_payments_in:   NUMBER_FIELD,
    total_payments_out:  NUMBER_FIELD,
    gross_profit:        NUMBER_FIELD,
    net_cash:            NUMBER_FIELD,
    units_produced:      NUMBER_FIELD,
    units_sold:          NUMBER_FIELD,
    business_id:         UUID_FIELD,
    recalculated_at:     TIMESTAMP_STRING,
  },
  required: ['date', 'business_id'],
  indexes: ['business_id', 'date', ['business_id', 'date']],
}

// 15. LEADS
export const leadsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    name:        SHORT_STRING,
    phone:       { type: 'string', maxLength: 20 },
    need:        MEDIUM_STRING,
    stage:       { type: 'string', maxLength: 20 },
    followup:    NULLABLE_STRING,
    source:      { type: 'string', maxLength: 30 },
    notes:       LONG_STRING,
    lost_reason: NULLABLE_STRING,
    converted_party_id: NULLABLE_UUID,
    converted_at:       NULLABLE_STRING,
    timeline: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text:      { type: 'string' },
          time:      { type: 'string' },
          timestamp: { type: 'string' },
        }
      }
    },
    business_id: UUID_FIELD,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'name', 'phone', 'stage', 'business_id'],
  indexes: [
    'business_id', 'stage', 'followup', 'source',
    ['business_id', 'stage'], ['stage', 'followup'],
  ],
}

// 16. SYNC LOG
export const syncLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    entity:      { type: 'string', maxLength: 50 },
    entity_id:   UUID_FIELD,
    operation:   { type: 'string', maxLength: 20 },
    device_id:   UUID_FIELD,
    synced:      BOOLEAN_FIELD,
    packet_id:   NULLABLE_UUID,
    business_id: UUID_FIELD,
    created_at:  TIMESTAMP_STRING,
  },
  required: ['id', 'entity', 'entity_id', 'operation', 'business_id'],
  indexes: ['business_id', 'synced', 'entity', 'entity_id', ['synced', 'business_id']],
}

// 17. CONFLICT LOG
export const conflictLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    entity:      { type: 'string', maxLength: 50 },
    entity_id:   UUID_FIELD,
    status:      { type: 'string', maxLength: 20 },
    version_a: {
      type: 'object',
      properties: {
        device_id:  { type: 'string' },
        data:       { type: 'object' },
        edit_note:  { type: 'string' },
        timestamp:  { type: 'string' },
      }
    },
    version_b: {
      type: 'object',
      properties: {
        device_id:  { type: 'string' },
        data:       { type: 'object' },
        edit_note:  { type: 'string' },
        timestamp:  { type: 'string' },
      }
    },
    resolved_version: NULLABLE_STRING,
    resolved_data:    { type: ['object', 'null'] },
    resolved_by:      NULLABLE_UUID,
    resolved_note:    MEDIUM_STRING,
    resolved_at:      NULLABLE_STRING,
    business_id:  UUID_FIELD,
    created_at:   TIMESTAMP_STRING,
  },
  required: ['id', 'entity', 'entity_id', 'status', 'business_id'],
  indexes: ['business_id', 'status', 'entity', 'entity_id', ['status', 'business_id'], ['entity', 'entity_id']],
}

// 18. AUDIT LOG
export const auditLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    entity:      { type: 'string', maxLength: 50 },
    entity_id:   UUID_FIELD,
    operation:   { type: 'string', maxLength: 30 },
    user_id:     NULLABLE_UUID,
    device_id:   UUID_FIELD,
    before:      { type: ['object', 'null'] },
    after:       { type: ['object', 'null'] },
    note:        MEDIUM_STRING,
    business_id: UUID_FIELD,
    created_at:  TIMESTAMP_STRING,
  },
  required: ['id', 'entity', 'entity_id', 'operation', 'business_id'],
  indexes: [
    'business_id', 'entity', 'entity_id', 'user_id', 'created_at',
    ['entity', 'entity_id'], ['business_id', 'created_at'],
  ],
}
// 19. STOCK ADJUSTMENTS
export const stockAdjustmentsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    item_id:     UUID_FIELD,
    qty_change:  NUMBER_FIELD,
    reason:      SHORT_STRING,
    date:        DATE_STRING,
    notes:       MEDIUM_STRING,
    business_id: UUID_FIELD,
    created_at:  TIMESTAMP_STRING,
    created_by:  NULLABLE_UUID,
  },
  required: ['id', 'item_id', 'qty_change', 'reason', 'business_id'],
  indexes: ['business_id', 'item_id', 'date'],
}

// 20. RATE CARDS — Daily pricing per item
export const rateCardsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:              UUID_FIELD,
    item_id:         UUID_FIELD,
    date:            DATE_STRING,
    retail_rate:     NUMBER_FIELD,
    wholesale_rate:  NUMBER_FIELD,
    cost_rate:       NUMBER_FIELD,
    source:          { type: 'string', maxLength: 20 },
    notes:           MEDIUM_STRING,
    business_id:     UUID_FIELD,
    created_at:      TIMESTAMP_STRING,
    created_by:      NULLABLE_UUID,
  },
  required: ['id', 'item_id', 'date', 'business_id'],
  indexes: [
    'business_id', 'item_id', 'date',
    ['item_id', 'date'], ['business_id', 'date'],
  ],
}

// 21. DELIVERIES
export const deliveriesSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:                UUID_FIELD,
    transaction_id:    UUID_FIELD,
    party_id:          UUID_FIELD,
    driver_id:         NULLABLE_UUID,
    vehicle_id:        NULLABLE_UUID,
    vehicle_number:    SHORT_STRING,
    delivery_address:  MEDIUM_STRING,
    delivery_lat:      NULLABLE_NUMBER,
    delivery_lng:      NULLABLE_NUMBER,
    scheduled_date:    DATE_STRING,
    scheduled_time:    { type: ['string', 'null'], maxLength: 10 },
    status:            { type: 'string', maxLength: 20 },
    proof_photos:      { type: 'array', items: { type: 'string' } },
    driver_notes:      MEDIUM_STRING,
    customer_signature: NULLABLE_STRING,
    distance_km:       NULLABLE_NUMBER,
    actual_arrival:    NULLABLE_STRING,
    completed_at:      NULLABLE_STRING,
    business_id:       UUID_FIELD,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'transaction_id', 'party_id', 'scheduled_date', 'status', 'business_id'],
  indexes: [
    'business_id', 'status', 'driver_id', 'party_id', 'scheduled_date',
    ['business_id', 'status'], ['driver_id', 'status'],
  ],
}

// 22. DRIVER LOCATIONS
export const driverLocationsSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:          UUID_FIELD,
    driver_id:   UUID_FIELD,
    delivery_id: NULLABLE_UUID,
    lat:         NUMBER_FIELD,
    lng:         NUMBER_FIELD,
    accuracy:    NULLABLE_NUMBER,
    speed:       NULLABLE_NUMBER,
    battery:     NULLABLE_NUMBER,
    timestamp:   TIMESTAMP_STRING,
    business_id: UUID_FIELD,
  },
  required: ['id', 'driver_id', 'lat', 'lng', 'timestamp', 'business_id'],
  indexes: ['business_id', 'driver_id', 'delivery_id', 'timestamp'],
}

// 23. VEHICLES
export const vehiclesSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:              UUID_FIELD,
    vehicle_number:  SHORT_STRING,
    vehicle_type:    { type: 'string', maxLength: 30 },
    capacity_kg:     NUMBER_FIELD,
    capacity_volume: NUMBER_FIELD,
    driver_id:       NULLABLE_UUID,
    active:          BOOLEAN_FIELD,
    business_id:     UUID_FIELD,
    ...AUDIT_FIELDS,
  },
  required: ['id', 'vehicle_number', 'vehicle_type', 'business_id'],
  indexes: ['business_id', 'active', 'driver_id'],
}

// 24. DATA PUSH QUEUE (Manager → Admin)
export const dataPushSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:            UUID_FIELD,
    manager_id:    UUID_FIELD,
    manager_name:  SHORT_STRING,
    status:        { type: 'string', maxLength: 20 },
    record_count:  NUMBER_FIELD,
    total_value:   NUMBER_FIELD,
    data_summary:  MEDIUM_STRING,
    rejected_reason: MEDIUM_STRING,
    resolved_by:   NULLABLE_UUID,
    resolved_at:   NULLABLE_STRING,
    business_id:   UUID_FIELD,
    created_at:    TIMESTAMP_STRING,
  },
  required: ['id', 'manager_id', 'status', 'business_id'],
  indexes: ['business_id', 'status', 'manager_id', ['business_id', 'status']],
}
