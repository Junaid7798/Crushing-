# CODING_PATTERNS.md — How Code Is Written In This Project
# Read the relevant section BEFORE writing any component.
# These are not suggestions. They are the project's coding contract.

---

## CORE PHILOSOPHY

This project is **data-first, not component-first.**
Always ask: "Where does this data come from?" before writing any JSX.
The UI is just a view over RxDB. Get the data layer right first.

Think in three layers:
1. **Data** — what RxDB query gets me this?
2. **Logic** — what calculations happen on that data?
3. **Display** — how does the result render?

Write them in that order. Never mix all three in one blob.

---

## PATTERN 1 — READING DATA (Reactive)

Use this when the UI must update automatically when data changes.
Example: transaction list, party balance, stock levels, dues table.

```
// CORRECT — reactive, auto-updates
const { data: transactions, loading } = useRxQuery(
  () => db.transactions.find({
    selector: { party_id: { $eq: partyId }, status: { $ne: 'cancelled' } },
    sort: [{ created_at: 'desc' }],
    limit: 50
  }),
  [partyId]  // re-runs when partyId changes
)

// WRONG — direct db call in component
const [txns, setTxns] = useState([])
useEffect(() => { db.transactions.find(...).exec().then(setTxns) }, [])
// This does NOT react to new data — user must refresh manually
```

**Improvement opportunity:** Add pagination. Replace `limit: 50` with a `loadMore` pattern.

---

## PATTERN 2 — READING DATA (One-shot)

Use this for search results, dropdowns, lookups in forms.
These do NOT need to auto-update — they run once when triggered.

```
// CORRECT — one-shot for search
const searchParties = async (query) => {
  const db = getDB()
  return db.parties.find({
    selector: {
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query } }
      ],
      active: { $eq: true }
    },
    limit: 20
  }).exec()
}

// WRONG — using reactive hook for search
// Reactive hooks re-run on every change. Search should run on demand only.
```

**Improvement opportunity:** Add debounce wrapper (300ms) around search calls.

---

## PATTERN 3 — WRITING DATA

ALWAYS use helpers.js wrappers. NEVER call db methods directly.

```
// CORRECT
import { createRecord, updateRecord, deleteRecord } from '../helpers.js'

const saveTransaction = async () => {
  const saved = await createRecord('transactions', {
    tx_type: 'sale',
    party_id: selectedParty.id,
    // ... other fields
  }, { user_id: currentUser.id })
  // createRecord handles: id generation, timestamps, sync log, audit log
}

// WRONG
await db.transactions.insert({ id: uuid(), ...data })
// This bypasses sync log + audit log — data will never sync to other devices
```

**Why this matters:** `createRecord` writes three things atomically: the record itself,
a sync_log entry (for packet export), and an audit_log entry (immutable history).
Skip the wrapper and you break sync and audit.

---

## PATTERN 4 — READING CONFIG

```
// CORRECT — always use the hook
const { config, isPluginEnabled } = useConfig()

const gstEnabled = isPluginEnabled('gst')
const vfLabels = config?.transaction_fields ?? []

// WRONG — direct query
const config = await db.config.findOne('main').exec()
// Works once, but doesn't react to config changes (e.g. admin renames a field)
```

---

## PATTERN 5 — AUTH + PERMISSIONS

```
// CORRECT
const { currentUser, isUnlocked } = useAuth()

// Check permission before rendering sensitive UI
if (!currentUser?.permissions?.can_view_reports) return <AccessDenied />

// WRONG
// Hiding a button is NOT a permission check.
// Permissions must gate the data query, not just the UI element.
```

---

## PATTERN 6 — COMPONENT STRUCTURE

Every screen component follows this structure. Do not deviate.

```jsx
// ScreenName.jsx
import { useState, useCallback } from 'react'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { useConfig } from '../hooks/useConfig.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { createRecord, updateRecord } from '../helpers.js'

export default function ScreenName() {
  // 1. HOOKS (data, config, auth)
  const { currentUser } = useAuth()
  const { config, isPluginEnabled } = useConfig()
  const { data, loading, error } = useRxQuery(...)

  // 2. LOCAL STATE (UI-only state — not persisted)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  // 3. DERIVED VALUES (computed from data + state)
  const filtered = data?.filter(item => ...)

  // 4. HANDLERS (user actions)
  const handleSave = useCallback(async () => { ... }, [deps])

  // 5. EARLY RETURNS (loading, error, permission denied)
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />

  // 6. RENDER
  return (
    <div style={s.container}>
      ...
    </div>
  )
}

// 7. STYLES (at bottom — inline style objects using CSS variables)
const s = {
  container: { background: 'var(--bg)', ... },
}
```

---

## PATTERN 7 — STYLING

This project uses inline style objects with CSS variables. No CSS modules, no Tailwind.

```jsx
// CORRECT — use CSS variables from index.css
const s = {
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '16px',
  },
  valuePositive: { color: 'var(--teal)', fontFamily: 'var(--mono)' },
  valueNegative: { color: 'var(--red)',  fontFamily: 'var(--mono)' },
}

// WRONG — hardcoded colors
const s = { card: { background: '#161616', border: '1px solid rgba(255,255,255,0.07)' } }
// If the user switches theme, hardcoded values won't change. Use CSS variables.
```

**CSS variable reference (from index.css):**
```
--bg, --surface, --surface2, --surface3 → background layers (darkest to lightest)
--border, --border2, --border3         → border opacity levels
--text, --text2, --text3               → text opacity levels
--amber, --amber-dim, --amber-border   → primary accent (changes with user theme)
--teal, --teal-dim, --teal-border      → success/positive
--red, --red-dim, --red-border         → error/danger/negative
--purple, --purple-dim, --purple-border → secondary accent
--font                                  → system font stack
--mono                                  → monospace font stack
```

---

## PATTERN 8 — MONEY FORMATTING

```
// CORRECT — Indian lakh/crore format
const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
// ₹1,00,000 (not ₹100,000)

// CORRECT — for display with decimals
const fmtDec = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 })

// WRONG
const fmt = (n) => `₹${n.toLocaleString()}` // Uses browser default — wrong in India
```

---

## PATTERN 9 — DATE HANDLING

```
// CORRECT — always store as ISO string
import { now } from '../helpers.js'
const createdAt = now() // returns new Date().toISOString()

// CORRECT — display in Indian format
const display = new Date(dateStr).toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric'
})
// Output: 23 Mar 2026

// CORRECT — date-only string for queries (YYYY-MM-DD)
const today = new Date().toISOString().split('T')[0]

// WRONG — Date objects in RxDB
// RxDB stores strings. Never store Date objects. Always convert to ISO string.
```

---

## PATTERN 10 — ERROR HANDLING

```
// CORRECT — wrap all DB operations
const handleSave = async () => {
  setLoading(true)
  setError('')
  try {
    await createRecord('transactions', data, { user_id: currentUser.id })
    // success — navigate or show confirmation
  } catch (err) {
    setError(err.message || 'Save failed — try again')
  } finally {
    setLoading(false)
  }
}

// WRONG — fire and forget
createRecord('transactions', data).then(navigate('/'))
// If this fails silently, user loses their work with no feedback
```

---

## COMMON MISTAKES — DO NOT DO THESE

**1. Querying inside render:**
```
// WRONG — runs on every render
return <div>{db.parties.findOne(id).exec().then(...)}</div>
```

**2. Mutating RxDB documents directly:**
```
// WRONG
const doc = await db.parties.findOne(id).exec()
doc.balance = 500  // This does NOT persist
```

**3. Using array index as key in lists:**
```
// WRONG — causes bugs when list reorders
{items.map((item, i) => <div key={i}>...)}

// CORRECT — use the record's unique id
{items.map(item => <div key={item.id}>...)}
```

**4. Forgetting to clean up subscriptions:**
```
// useRxQuery handles this internally — DO use useRxQuery
// If you write a manual subscription, ALWAYS return cleanup:
useEffect(() => {
  const sub = query.$.subscribe(...)
  return () => sub.unsubscribe()  // ← must have this
}, [])
```

**5. Hardcoding field labels:**
```
// WRONG — this field may be renamed by the user in Settings
<label>Vehicle Number</label>

// CORRECT — read from config
const label = config?.transaction_fields?.find(f => f.index === 1)?.label ?? 'Field 1'
<label>{label}</label>
```

---

## PERFORMANCE RULES

- All lists must have a `limit` in the RxDB query. Start with 50. Add pagination.
- Use `React.memo()` on any list item component that renders more than 3 elements.
- Never run a report query on every render. Run it once when date range changes.
- Images (delivery photos) must be compressed before storing as base64. Max 800px width.
- Use `useCallback` on all event handlers passed to child components.

---

## SCOPE FOR IMPROVEMENT MARKERS

When you see something that could be better but is not blocking, add this comment:
```
// TODO(V2): [what could be improved] — [why it's deferred]
// Example: TODO(V2): Add Web Worker for heavy CSV export — currently runs on main thread
```

When you intentionally leave a V2 feature placeholder:
```
// TODO(V2-FEATURE): Barcode scan to add items — needs @tauri-apps/plugin-camera
// TODO(V2-FEATURE): Voice input on notes — Web Speech API, works offline on Android
```

These comments are first-class documentation. They tell the next developer
exactly what's missing and why it was left for later.

---

*This file should be read at the start of any session involving new component work.*
*If you find a pattern that should be here, add it at the bottom.*
