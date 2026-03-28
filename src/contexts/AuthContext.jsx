// src/contexts/AuthContext.jsx
// Manages: session key lifecycle, login, logout, lock
// PIN verification → PBKDF2 verify → key derivation → setSessionKey
// Cleared on: logout, auto-lock timeout, wrong PIN lockout

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import {
  deriveKey,
  verifyPin,
  initSession,
  clearSessionKey,
} from '../helpers.js'
import { initDB, getDB } from '../db/index.js'

const AuthContext = createContext(null)

const DEFAULT_LOCK_MS = 5 * 60 * 1000   // 5 minutes

export function AuthProvider({ children }) {
  const [status, setStatus]               = useState('loading')
  // loading → onboarding → locked → unlocked

  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [lockedUntil, setLockedUntil]     = useState(null)
  const [currentUser, setCurrentUser]     = useState(null)

  const lockTimerRef = useRef(null)

  // ── INIT ────────────────────────────────────────
  useEffect(() => {
    async function check() {
      try {
        await initDB()
        const db     = getDB()
        const config = await db.config.findOne('main').exec()

        if (!config || !config.onboarded_at) {
          setStatus('onboarding')
        } else {
          setStatus('locked')
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('DB init failed:', err)
        setStatus('onboarding')
      }
    }
    check()
  }, [])

  // ── AUTO-LOCK ────────────────────────────────────
  const lock = useCallback(() => {
    clearSessionKey()
    setCurrentUser(null)
    setStatus('locked')
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
  }, [])

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    lockTimerRef.current = setTimeout(() => lock(), DEFAULT_LOCK_MS)
  }, [lock])

  useEffect(() => {
    if (status !== 'unlocked') return
    const events = ['mousemove', 'keydown', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetLockTimer, { passive: true }))
    resetLockTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetLockTimer))
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current)
    }
  }, [status, resetLockTimer])

  // ── LOGIN ────────────────────────────────────────
  async function login(pin) {
    // Lockout check
    if (lockedUntil && Date.now() < lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000)
      throw new Error(`Too many wrong attempts. Try again in ${secs}s.`)
    }

    try {
      const db     = getDB()
      const config = await db.config.findOne('main').exec()
      if (!config) throw new Error('No config found')

      // Find admin user
      const users = await db.users
        .find({ selector: { role: { $eq: 'admin' } } })
        .exec()
      if (!users.length) throw new Error('No admin user found')

      const user = users[0].toJSON()

      // Verify PIN against stored PBKDF2 hash
      const valid = await verifyPin(pin, user.pin_hash)
      if (!valid) throw new Error('Wrong PIN')

      // Derive session key from PIN + stored salt
      const key = await deriveKey(pin, config.encryption_salt)
      initSession(key)

      setCurrentUser(user)
      setWrongAttempts(0)
      setLockedUntil(null)
      setStatus('unlocked')

    } catch (err) {
      const next = wrongAttempts + 1
      setWrongAttempts(next)

      if (next >= 5) {
        setLockedUntil(Date.now() + 10 * 60 * 1000)
        setWrongAttempts(0)
        throw new Error('5 wrong attempts — locked for 10 minutes.')
      }

      throw new Error(
        err.message === 'Wrong PIN'
          ? `Wrong PIN. ${5 - next} attempt${5 - next === 1 ? '' : 's'} remaining.`
          : err.message
      )
    }
  }

  // ── LOCK ───────────────────────────────────────── (Moved up)

  function logout() { lock() }

  // ── COMPLETE ONBOARDING ──────────────────────────
  async function completeOnboarding(pin) {
    setStatus('locked')
    await login(pin)
  }

  const value = {
    status,
    currentUser,
    wrongAttempts,
    lockedUntil,
    login,
    lock,
    logout,
    completeOnboarding,
    isUnlocked: status === 'unlocked',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
