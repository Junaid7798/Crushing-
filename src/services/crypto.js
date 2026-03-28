// ─────────────────────────────────────────────
// crypto.js — BusinessOS Crypto Module
// AES-256-GCM + PBKDF2-SHA256 via Web Crypto API
// ─────────────────────────────────────────────

let _sessionKey = null

/**
 * Derives an AES-256-GCM key from a password and salt using PBKDF2-SHA256.
 * @param {string} password - The password/PIN to derive from
 * @param {string} saltHex - Hex-encoded salt from config.encryption_salt
 * @returns {Promise<CryptoKey>} AES-GCM key for encrypt/decrypt
 */
export async function deriveKey(password, saltHex) {
  const salt = hexToBuffer(saltHex)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Initializes the in-memory session key for encryption operations.
 * @param {CryptoKey} key - The derived AES-GCM key
 */
export function initSession(key) {
  _sessionKey = key
}

/**
 * Clears the session key from memory (called on lock/logout).
 */
export function clearSessionKey() {
  _sessionKey = null
}

/**
 * Checks if a session key is currently active.
 * @returns {boolean}
 */
export function hasSessionKey() {
  return _sessionKey !== null
}

/**
 * Hashes a PIN for storage using PBKDF2-SHA256.
 * Format: pbkdf2$<iterations>$<salt_b64>$<hash_b64>
 * @param {string} pin - The PIN to hash
 * @returns {Promise<string>} Encoded hash string
 */
export async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hashBytes = new Uint8Array(derivedBits)
  const saltB64 = btoa(String.fromCharCode(...salt))
  const hashB64 = btoa(String.fromCharCode(...hashBytes))
  return `pbkdf2$600000$${saltB64}$${hashB64}`
}

/**
 * Verifies a PIN against a stored PBKDF2 hash using constant-time comparison.
 * @param {string} pin - The PIN to verify
 * @param {string} storedHash - The stored hash string
 * @returns {Promise<boolean>}
 */
export async function verifyPin(pin, storedHash) {
  try {
    const parts = storedHash.split('$')
    if (parts.length < 4 || parts[0] !== 'pbkdf2') return false

    const iterations = parseInt(parts[1], 10)
    const saltB64 = parts[2]
    const expectedB64 = parts[3]

    const saltPad = saltB64 + '='.repeat((4 - saltB64.length % 4) % 4)
    const saltBytes = Uint8Array.from(atob(saltPad), c => c.charCodeAt(0))

    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    )
    const hashBytes = new Uint8Array(derivedBits)
    const actualB64 = btoa(String.fromCharCode(...hashBytes))

    if (actualB64.length !== expectedB64.length) return false
    let result = 0
    for (let i = 0; i < actualB64.length; i++) {
      result |= actualB64.charCodeAt(i) ^ expectedB64.charCodeAt(i)
    }
    return result === 0
  } catch {
    return false
  }
}

/**
 * Encrypts a record object using AES-256-GCM.
 * @param {object} obj - The object to encrypt
 * @returns {Promise<{iv: string, data: string}>} Hex-encoded IV and ciphertext
 */
export async function encryptRecord(obj) {
  if (!_sessionKey) throw new Error('No session key — user not logged in')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(obj))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _sessionKey, encoded)
  return {
    iv: bufferToHex(iv),
    data: bufferToHex(cipher),
  }
}

/**
 * Decrypts an AES-256-GCM encrypted record.
 * @param {{iv: string, data: string}} encrypted - Hex-encoded IV and ciphertext
 * @returns {Promise<object>} The decrypted object
 */
export async function decryptRecord(encrypted) {
  if (!_sessionKey) throw new Error('No session key — user not logged in')
  const iv = hexToBuffer(encrypted.iv)
  const data = hexToBuffer(encrypted.data)
  const decoded = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _sessionKey, data)
  return JSON.parse(new TextDecoder().decode(decoded))
}

/**
 * Generates a random 32-byte hex-encoded salt.
 * @returns {string}
 */
export function generateSalt() {
  return bufferToHex(crypto.getRandomValues(new Uint8Array(32)))
}

// ── HEX HELPERS ───────────────────────────────

function bufferToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes.buffer
}
