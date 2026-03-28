import { useState, useEffect, useRef } from 'react'

/**
 * useRxQuery - Hook to execute and subscribe to RxDB queries.
 * @param {import('rxdb').RxQuery} query - The RxDB query object.
 * @param {Object} options - Options for the hook.
 * @param {boolean} options.live - Whether to subscribe to updates. Defaults to true.
 * @param {boolean} options.isDoc - Whether the query is for a single document (findOne).
 */
export function useRxQuery(query, { live = true, isDoc = false } = {}) {
  const [result, setResult]   = useState(isDoc ? null : [])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const queryRef = useRef(query)

  // Only update ref when the query identity actually changes
  if (query !== queryRef.current) {
    queryRef.current = query
  }

  // Build a stable key from query properties without hitting circular refs.
  // RxDB queries expose mangoQuery / otherJsonSafe on the RxQuery prototype.
  let queryKey = 'null'
  if (query) {
    try {
      // RxDB stores the parsed query internally — grab safe properties only
      const mango = query.mangoQuery || {}
      queryKey = JSON.stringify({
        c: query.collection?.name ?? '',
        s: mango.selector ?? {},
        so: mango.sort ?? null,
        l: mango.limit ?? null,
      })
    } catch {
      // Fallback: use string coercion (no circular ref risk)
      queryKey = String(query)
    }
  }

  useEffect(() => {
    const currentQuery = queryRef.current
    if (!currentQuery) {
      setResult(isDoc ? null : [])
      setLoading(false)
      return
    }

    setLoading(true)

    if (!live) {
      currentQuery.exec()
        .then(res => {
          setResult(isDoc && Array.isArray(res) ? res[0] : res)
          setLoading(false)
        })
        .catch(err => {
          if (import.meta.env.DEV) console.error('RxDB Query execution failed:', err)
          setError(err)
          setLoading(false)
        })
      return
    }

    const sub = currentQuery.$.subscribe(res => {
      setResult(isDoc && Array.isArray(res) ? res[0] : res)
      setLoading(false)
    }, err => {
      if (import.meta.env.DEV) console.error('RxDB Query subscription failed:', err)
      setError(err)
      setLoading(false)
    })

    return () => sub.unsubscribe()
  }, [queryKey, live, isDoc])

  return { result, loading, error }
}
