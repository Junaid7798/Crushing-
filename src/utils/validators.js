// ─────────────────────────────────────────────
// validators.js — BusinessOS Shared Validation
// ─────────────────────────────────────────────

/**
 * Validates party data before creation/update.
 * @param {object} data - Party data
 * @returns {{valid: boolean, errors: object}}
 */
export function validatePartyData(data) {
  const errors = {}
  if (!data.name?.trim()) errors.name = 'Name is required'
  if (data.phone && !/^\+?[\d\s-]{6,15}$/.test(data.phone)) {
    errors.phone = 'Invalid phone number'
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Invalid email address'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates item data before creation/update.
 * @param {object} data - Item data
 * @returns {{valid: boolean, errors: object}}
 */
export function validateItemData(data) {
  const errors = {}
  if (!data.name?.trim()) errors.name = 'Product name is required'
  if (data.sell_price_retail < 0) errors.sell_price_retail = 'Price cannot be negative'
  if (data.sell_price_wholesale < 0) errors.sell_price_wholesale = 'Price cannot be negative'
  if (data.opening_stock < 0) errors.opening_stock = 'Stock cannot be negative'
  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates transaction data before save.
 * @param {object} data - Transaction form data
 * @returns {{valid: boolean, errors: object}}
 */
export function validateTransactionData(data) {
  const errors = {}
  if (!data.party_id) errors.party_id = 'Please select a party'
  if (!data.items || data.items.length === 0) errors.items = 'Add at least one item'
  if (data.amount_paid < 0) errors.amount_paid = 'Payment cannot be negative'
  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates PIN format (4-8 digits).
 * @param {string} pin - The PIN to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePIN(pin) {
  if (!pin) return { valid: false, error: 'PIN is required' }
  if (pin.length < 4 || pin.length > 8) return { valid: false, error: 'PIN must be 4 to 8 digits' }
  if (!/^\d+$/.test(pin)) return { valid: false, error: 'PIN must contain only digits' }
  return { valid: true }
}

/**
 * Validates payment amount.
 * @param {number} amount - The payment amount
 * @param {number} [maxAmount] - Optional max allowed amount
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePayment(amount, maxAmount) {
  if (isNaN(amount) || amount <= 0) return { valid: false, error: 'Amount must be greater than zero' }
  if (maxAmount !== undefined && amount > maxAmount) {
    return { valid: false, error: `Amount cannot exceed ${maxAmount}` }
  }
  return { valid: true }
}
