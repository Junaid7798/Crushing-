import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext.jsx'
import { initDB, getDB } from '../db/index.js'

const DBContext = createContext(null)

export function DBProvider({ children }) {
  const { isUnlocked } = useAuth()
  const [db, setDb]           = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isUnlocked) {
      setDb(null)
      setLoading(false)
      return
    }

    async function setup() {
      try {
        const _db = await initDB()
        setDb(_db)
      } catch (err) {
        if (import.meta.env.DEV) console.error('DB setup failed:', err)
      } finally {
        setLoading(false)
      }
    }
    setup()
  }, [isUnlocked])

  return (
    <DBContext.Provider value={{ db, loading }}>
      {children}
    </DBContext.Provider>
  )
}

export function useDB() {
  const ctx = useContext(DBContext)
  if (!ctx) throw new Error('useDB must be used inside DBProvider')
  return ctx
}
