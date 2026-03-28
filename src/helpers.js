// ─────────────────────────────────────────────
// helpers.js — BusinessOS Utility Facade
// Re-exports from service modules for backward compatibility.
// UI utilities remain here; business logic in services/.
// ─────────────────────────────────────────────

// Crypto operations
export {
  deriveKey,
  initSession,
  clearSessionKey,
  hasSessionKey,
  hashPin,
  verifyPin,
  encryptRecord,
  decryptRecord,
  generateSalt,
} from './services/crypto.js'

// CRUD operations
export {
  uuid,
  now,
  createRecord,
  updateRecord,
  deleteRecord,
} from './services/crud.js'

// Financial calculations
export {
  recalculatePartyBalance,
  recalculateDailySummary,
} from './services/finance.js'

// Stock management
export {
  deductRawMaterialsForRun,
  addFinishedStock,
  deductFinishedStock,
} from './services/stock.js'

// Sync operations
export {
  buildSyncPacket,
  importSyncPacket,
  resolveConflict,
} from './services/sync.js'

// ─────────────────────────────────────────────
// UI HELPERS — remain in helpers.js
// ─────────────────────────────────────────────

/**
 * Formats a number as Indian Rupee (INR).
 * @param {number} val - The value to format
 * @returns {string} Formatted currency string
 */
export function formatMoney(val) {
  return '₹' + (val || 0).toLocaleString('en-IN')
}

/**
 * Returns consistent styling for transaction and payment statuses.
 * @param {string} status - The status string
 * @returns {{background: string, color: string}}
 */
export function getStatusStyle(status) {
  switch (status?.toLowerCase()) {
    case 'paid':
    case 'success':
    case 'active':
      return { background: 'var(--teal-dim)', color: 'var(--teal)' }
    case 'pending':
    case 'partial':
    case 'warning':
      return { background: 'var(--amber-dim)', color: 'var(--amber)' }
    case 'cancelled':
    case 'overdue':
    case 'critical':
      return { background: 'var(--red-dim)', color: 'var(--red)' }
    default:
      return { background: 'var(--surface2)', color: 'var(--text3)' }
  }
}

/**
 * Simple debounce for search inputs.
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), ms)
  }
}

/**
 * Escapes special characters for use in a regular expression.
 * @param {string} string - The string to escape
 * @returns {string}
 */
export function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Haptic feedback helper for mobile devices.
 */
export function haptic() {
  if ('vibrate' in navigator) navigator.vibrate(10)
}
