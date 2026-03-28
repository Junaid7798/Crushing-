# CLAUDE.md — Business OS Master Context
# Load this file at the start of EVERY session. Do not skip.
# Last updated: 23 March 2026

---

## WHAT THIS PROJECT IS

Business OS is a 100% offline-first, encrypted business management app for Indian SMBs.
Reference client: Sharma Stone Works, Aurangabad — stone crushing + retail trading.
Structure: 1 crusher site + 2 trading stores. Owner: Rajesh Sharma (admin).

**Core promise:** No server. Ever. AES-256-GCM + PBKDF2-SHA256 encryption always on.
Everything runs on the device. Sync is manual encrypted packets only.

---

## STACK (LOCKED — DO NOT CHANGE)

```
Frontend:     React 18 + Vite 5
Desktop/Mobile: Tauri v2 (one wrapper → Mac, Windows, iOS, Android)
Database:     RxDB v15 (IndexedDB via Dexie adapter)
Encryption:   AES-256-GCM + PBKDF2-SHA256 (Web Crypto API)
PDF:          @react-pdf/renderer v3
Maps:         Leaflet + react-leaflet + OSRM (offline routing)
QR:           qrcode.js
Fonts:        Noto Sans + Noto Devanagari (bundled, never fetched)
```

---

## PROJECT STRUCTURE

```
business-os/
├── CLAUDE.md                  ← YOU ARE HERE (load every session)
├── BUILD_PHASES.md            ← What to build next, in order
├── CODING_PATTERNS.md         ← How to write code in this project
├── DEPENDENCIES.md            ← Every package, version, why, gotchas
├── MODEL_GUIDE.md             ← Sonnet vs Opus — when to switch
├── PROGRESS_TRACKER.md        ← Updated every session — current state
├── package.json
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css               ← All 5 themes + CSS variables
    ├── schema.js               ← RxDB schemas (18 tables) ✓ COMPLETE
    ├── helpers.js              ← Crypto + CRUD + sync ✓ COMPLETE
    ├── db/
    │   └── index.js            ← initDB / getDB ✓ COMPLETE
    ├── contexts/
    │   ├── AuthContext.jsx     ← PIN login, auto-lock ✓ COMPLETE
    │   └── DBContext.jsx       ← DB exposure when unlocked ✓ COMPLETE
    ├── hooks/
    │   ├── useRxQuery.js       ← Reactive + one-shot queries ✓ COMPLETE
    │   └── useConfig.js        ← Live config + plugin toggles ✓ COMPLETE
    └── screens/
        ├── OnboardingScreen.jsx  ✓ COMPLETE
        ├── LockScreen.jsx        ✓ COMPLETE
        ├── DashboardScreen.jsx   ← PLACEHOLDER — wire next
        ├── TransactionScreen.jsx ← PLACEHOLDER
        ├── PartyScreen.jsx       ← PLACEHOLDER
        ├── ItemsScreen.jsx       ← PLACEHOLDER
        ├── ReportsScreen.jsx     ← PLACEHOLDER
        ├── LeadsScreen.jsx       ← PLACEHOLDER
        ├── SettingsScreen.jsx    ← PLACEHOLDER
        ├── DeliveryScreen.jsx    ← PLACEHOLDER
        ├── ProductionScreen.jsx  ← PLACEHOLDER
        └── ConflictScreen.jsx    ← PLACEHOLDER
```

---

## DATABASE — 18 TABLES (ALL IN schema.js)

| Table | Key purpose |
|---|---|
| config | Single row 'main' — business settings, module toggles, VF labels |
| users | Login users, roles, permissions, PIN hash (PBKDF2-SHA256) |
| locations | 3 sites: crusher + 2 stores |
| parties | Customers + vendors unified. balance auto-updated. |
| raw_materials | Input materials for production |
| items | Finished products. location_id=null means universal. |
| bom | Bill of materials — recipe per item |
| production_runs | Batch production logs |
| transactions | All money movements — sale/purchase/expense/payment |
| transaction_lines | Line items within a transaction |
| payments | Partial/full payments against transactions |
| expenses | Non-vendor business expenses |
| documents | PDFs stored as base64 blobs |
| daily_summary | Pre-calculated P&L roll-ups (composite PK: date|business_id) |
| leads | CRM pipeline — new/quoted/negotiating/won/lost |
| sync_log | Tracks unsynced changes for packet export |
| conflict_log | Human-review queue for sync conflicts |
| audit_log | Immutable append-only change history |

---

## IMMUTABLE RULES — NEVER BREAK THESE

```
1. Never write to DB directly → always use CRUD wrappers in helpers.js
2. Encryption always on → no bypass, no plaintext mode
3. Variable field labels live in config → never hardcode field names in UI
4. Disable never deletes → toggling a plugin hides UI only, data stays
5. Conflict resolution always human → never auto-resolve silently
6. Decoy mode leaves no trace → no log entry, no indicator
7. Tax estimates always show CA disclaimer → never show as exact
8. Export is never blocked → sync state never prevents data export
9. Duplicate detection on party creation → phone checked in real time
10. Admin is NEVER location tracked → no prompt, no indicator, ever
11. NPA is owner-initiated only → system never suggests NPA
12. Payment status mandatory at transaction save → no bypass
13. Recovery options mandatory at onboarding → both phrase + contact
14. Reminder mandatory for Pending/Partial transactions → cannot skip
```

---

## SECURITY MODEL (ALWAYS IN MIND)

- PIN → PBKDF2-SHA256 (600k iterations) → AES-256-GCM key
- Key lives in memory only. Cleared on: lock, app close, wrong PIN lockout (5 attempts → 10 min)
- Session key: `setSessionKey()` / `clearSessionKey()` in helpers.js
- Wrong PIN lockout: 5 attempts → locked 10 minutes
- All records encrypted at rest. No plaintext in IndexedDB.

---

## KEY PATTERNS TO ALWAYS USE

**DB Read (reactive — updates UI automatically):**
Use `useRxQuery` hook. Never call db directly in components.

**DB Read (one-shot — for forms/lookups):**
Use `useRxQuery` with `live: false` option.

**DB Write:**
Always use `createRecord()`, `updateRecord()`, `deleteRecord()` from helpers.js.
Never call `db.collection.insert()` directly.

**Config/plugins:**
Use `useConfig()` hook. Never read config directly.

**Auth state:**
Use `useAuth()` hook from AuthContext. Never read auth state directly.

---

## HTML PROTOTYPES (REFERENCE ONLY — DO NOT COPY PASTE)

These are complete UI prototypes to understand the design and features.
When wiring a screen, READ the HTML prototype first to understand layout + logic.
Then implement it in React with live RxDB data. Do NOT copy HTML directly.

Files: dashboard.html, transaction.html, reports.html, leads.html,
       delivery_confirmation.html, proof-viewer.html, conflict-inbox.html,
       onboarding.html, settings.html

---

## CURRENT BLOCKERS (update in PROGRESS_TRACKER.md each session)

1. All screens except Onboarding + Lock are placeholder components
2. manifest.json missing → PWA install broken
3. map-sw.js not registered in main.jsx
4. Vite aliases (@db, @contexts, @screens) defined but actual imports use relative paths

---

## SESSION START CHECKLIST

Before writing any code each session:
1. Read PROGRESS_TRACKER.md to know exactly where we stopped
2. Read BUILD_PHASES.md to know what phase is active
3. Read CODING_PATTERNS.md for the pattern relevant to today's work
4. Check DEPENDENCIES.md if installing anything new
5. Check MODEL_GUIDE.md if complexity suggests switching to Opus

---

## REFERENCE CLIENT CONTEXT

Business: Sharma Stone Works, Aurangabad
Products produced: Crushed Stone 10/20/50/75mm, Crush Sand, Stone Dust
Products traded: River Sand, Gravel, Bricks, Steel (7 sizes), Cement (4 brands)
Staff: Rajesh Sharma (Owner/Admin), Raju Pawar (Driver), Santosh Kamble (Driver)
Invoice format: SSW-2526-001 (prefix-FY-sequence, resets April 1)
Language: English V1, Hindi V2

---

## ⚠️ CONTEXT WARNING RULE

When this conversation approaches token limit, Claude must output:
"⚠️ Context limit approaching. Update PROGRESS_TRACKER.md now before continuing."

---

*This file is the single source of truth for project context.*
*Any decision made in a session that changes architecture must be reflected here.*
