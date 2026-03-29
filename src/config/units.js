// ─────────────────────────────────────────────
// units.js — Multi-Unit System for BusinessOS
// Supports weight, volume, count, packaging, length units
// with conversion factors for stone/retail trading.
// ─────────────────────────────────────────────

/**
 * Unit categories with their available units and conversion factors.
 * All factors are relative to the base unit within each category.
 */
export const UNIT_CATEGORIES = {
  weight: {
    label: 'Weight',
    icon: '⚖️',
    base_unit: 'kg',
    units: [
      { id: 'kg',     label: 'Kilograms',    short: 'kg',   factor: 1,      allowDecimal: true },
      { id: 'ton',    label: 'Metric Tons',  short: 'MT',   factor: 1000,   allowDecimal: true },
      { id: 'quintal',label: 'Quintals',     short: 'Qtl',  factor: 100,    allowDecimal: true },
      { id: 'g',      label: 'Grams',        short: 'g',    factor: 0.001,  allowDecimal: true },
    ],
  },
  volume: {
    label: 'Volume',
    icon: '📦',
    base_unit: 'cft',
    units: [
      { id: 'cft',    label: 'Cubic Feet',      short: 'CFT',  factor: 1,        allowDecimal: true },
      { id: 'cum',    label: 'Cubic Meters',    short: 'CUM',  factor: 35.3147,  allowDecimal: true },
      { id: 'brass',  label: 'Brass (Truck)',   short: 'Brass',factor: 100,      allowDecimal: true },
      { id: 'ltr',    label: 'Liters',          short: 'ltr',  factor: 0.03531,  allowDecimal: true },
    ],
  },
  count: {
    label: 'Count',
    icon: '🔢',
    base_unit: 'pcs',
    units: [
      { id: 'pcs',    label: 'Pieces',   short: 'pcs',  factor: 1,    allowDecimal: false },
      { id: 'dozen',  label: 'Dozen',    short: 'dz',   factor: 12,   allowDecimal: false },
      { id: 'gross',  label: 'Gross',    short: 'gr',   factor: 144,  allowDecimal: false },
      { id: 'hundred',label: 'Hundred',  short: '100',  factor: 100,  allowDecimal: false },
    ],
  },
  packaging: {
    label: 'Packaging',
    icon: '🧱',
    base_unit: 'bag',
    units: [
      { id: 'bag',    label: 'Bag (50kg)',  short: 'bag',  factor: 50,  allowDecimal: false },
      { id: 'sack',   label: 'Sack',        short: 'sack', factor: 1,   allowDecimal: false },
      { id: 'packet', label: 'Packet',      short: 'pkt',  factor: 1,   allowDecimal: false },
      { id: 'box',    label: 'Box',         short: 'box',  factor: 1,   allowDecimal: false },
      { id: 'roll',   label: 'Roll',        short: 'roll', factor: 1,   allowDecimal: false },
    ],
  },
  length: {
    label: 'Length',
    icon: '📏',
    base_unit: 'ft',
    units: [
      { id: 'ft',     label: 'Feet',    short: 'ft',  factor: 1,        allowDecimal: true },
      { id: 'm',      label: 'Meters',  short: 'm',   factor: 3.28084,  allowDecimal: true },
      { id: 'inch',   label: 'Inches',  short: 'in',  factor: 0.08333,  allowDecimal: true },
      { id: 'mm',     label: 'Millimeters', short: 'mm', factor: 0.00328, allowDecimal: true },
    ],
  },
}

/**
 * Default unit configuration per material type.
 * Used when creating new items to auto-configure unit settings.
 */
export const MATERIAL_DEFAULTS = {
  'Cement':         { category: 'packaging', default_unit: 'bag',    gst_rate: 28, selling_unit: 'bag' },
  'Steel Bar':      { category: 'weight',    default_unit: 'kg',     gst_rate: 18, selling_unit: 'kg'  },
  'Steel Rod':      { category: 'weight',    default_unit: 'kg',     gst_rate: 18, selling_unit: 'kg'  },
  'TMT Bar':        { category: 'weight',    default_unit: 'kg',     gst_rate: 18, selling_unit: 'kg'  },
  'Bricks':         { category: 'count',     default_unit: 'pcs',    gst_rate: 5,  selling_unit: 'pcs' },
  'AAC Blocks':     { category: 'count',     default_unit: 'pcs',    gst_rate: 12, selling_unit: 'pcs' },
  'Sand':           { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'River Sand':     { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Crushed Sand':   { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Gravel':         { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Crushed Stone':  { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Stone Dust':     { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Stone 10mm':     { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Stone 20mm':     { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Stone 50mm':     { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
  'Stone 75mm':     { category: 'volume',    default_unit: 'cft',    gst_rate: 5,  selling_unit: 'cft' },
}

/**
 * Common material name keywords for auto-detection.
 * Maps partial names to material defaults.
 */
export const MATERIAL_KEYWORDS = {
  'cement':   'Cement',
  'steel':    'Steel Bar',
  'tmt':      'TMT Bar',
  'rod':      'Steel Rod',
  'brick':    'Bricks',
  'block':    'AAC Blocks',
  'sand':     'Sand',
  'gravel':   'Gravel',
  'stone':    'Crushed Stone',
  'dust':     'Stone Dust',
}

// ── UNIT CONVERSION HELPERS ──────────────────

/**
 * Converts a quantity from one unit to another within the same category.
 * @param {number} qty - Quantity to convert
 * @param {string} fromUnit - Source unit ID
 * @param {string} toUnit - Target unit ID
 * @param {string} category - Unit category
 * @returns {number} Converted quantity
 */
export function convertUnit(qty, fromUnit, toUnit, category) {
  if (fromUnit === toUnit) return qty
  const cat = UNIT_CATEGORIES[category]
  if (!cat) throw new Error(`Unknown unit category: ${category}`)

  const from = cat.units.find(u => u.id === fromUnit)
  const to = cat.units.find(u => u.id === toUnit)
  if (!from || to) {
    if (!from) throw new Error(`Unknown unit: ${fromUnit}`)
    if (!to) throw new Error(`Unknown unit: ${toUnit}`)
  }

  // Convert to base unit, then to target unit
  const baseQty = qty * from.factor
  return baseQty / to.factor
}

/**
 * Gets the unit definition for a given unit ID.
 * @param {string} unitId
 * @returns {{ id, label, short, factor, allowDecimal, category } | null}
 */
export function getUnitInfo(unitId) {
  for (const [categoryKey, cat] of Object.entries(UNIT_CATEGORIES)) {
    const unit = cat.units.find(u => u.id === unitId)
    if (unit) return { ...unit, category: categoryKey }
  }
  return null
}

/**
 * Gets all units for a given category.
 * @param {string} categoryKey
 * @returns {Array} List of unit objects
 */
export function getUnitsForCategory(categoryKey) {
  return UNIT_CATEGORIES[categoryKey]?.units || []
}

/**
 * Auto-detects material defaults from item name.
 * @param {string} itemName
 * @returns {{ category, default_unit, gst_rate, selling_unit } | null}
 */
export function detectMaterialDefaults(itemName) {
  const lower = itemName.toLowerCase()
  for (const [keyword, materialKey] of Object.entries(MATERIAL_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return MATERIAL_DEFAULTS[materialKey] || null
    }
  }
  return null
}

/**
 * Checks if a unit allows decimal quantities.
 * @param {string} unitId
 * @returns {boolean}
 */
export function allowsDecimal(unitId) {
  const info = getUnitInfo(unitId)
  return info?.allowDecimal ?? true
}

/**
 * Formats a quantity with its unit label.
 * @param {number} qty
 * @param {string} unitId
 * @returns {string}
 */
export function formatQtyWithUnit(qty, unitId) {
  const info = getUnitInfo(unitId)
  if (!info) return `${qty} ${unitId}`
  const decimals = info.allowDecimal ? 2 : 0
  return `${qty.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${info.short}`
}

/**
 * Gets the list of all category options for dropdowns.
 * @returns {Array<{ value, label, icon }>}
 */
export function getCategoryOptions() {
  return Object.entries(UNIT_CATEGORIES).map(([key, cat]) => ({
    value: key,
    label: cat.label,
    icon: cat.icon,
  }))
}
