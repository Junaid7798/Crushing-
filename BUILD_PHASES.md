# BUILD_PHASES.md — Business OS Build Plan
# Each phase = a logical milestone. Each chunk = one session's work.
# Check boxes as you complete them. Never skip ahead.

---

## HOW TO USE THIS FILE

Each chunk tells you:
- **WHAT** to build
- **WHY** it exists (the business logic behind it)
- **DECISION GUIDE** — which hooks/patterns/gotchas apply
- **SCOPE FOR IMPROVEMENT** — what you can make better if time allows
- **DONE WHEN** — clear completion criteria

Read the relevant HTML prototype BEFORE starting each chunk.
Update PROGRESS_TRACKER.md when a chunk is complete.

---

## PHASE 0 — FOUNDATION (✓ COMPLETE)

- [x] schema.js — 18 RxDB tables
- [x] helpers.js — Argon2id + CRUD wrappers + sync packet builder
- [x] AuthContext.jsx — PIN login, auto-lock, lockout
- [x] DBContext.jsx — DB access gated by auth
- [x] useRxQuery.js — reactive + one-shot query hooks
- [x] useConfig.js — live config + plugin toggle helper
- [x] LockScreen.jsx — PIN entry UI
- [x] OnboardingScreen.jsx — 4-step setup wizard
- [x] package.json, vite.config.js, index.html

**DO NOT TOUCH Phase 0 files unless a bug is found.**
If a bug is found, fix only the broken function. Do not refactor.

---

## PHASE 1 — DASHBOARD SCREEN
**Session estimate: 2 chunks**

### Chunk 1.1 — Metric Cards + Quick Actions
**Read first:** dashboard.html (top section — metrics + quick actions)

**WHAT:** Four metric cards (Today's Sales, Collected, Outstanding Dues, Gross Profit).
Quick action buttons (New Sale, Collect Payment, Production Run, Add Expense).

**DECISION GUIDE:**
- Use `useRxQuery` with `live: true` for all metric values — they must update when a new transaction is saved without a page refresh.
- Metric values come from `daily_summary` table for today's date — NOT from scanning all transactions. This table is pre-calculated by `recalculateDailySummary()` in helpers.js.
- If today's daily_summary row doesn't exist yet, show ₹0 — do not error.
- Quick actions are navigation buttons. They go to /transaction with a preset type query param (e.g. /transaction?type=sale).
- Count-up animation on metric numbers is a nice-to-have — implement only after data is wiring correctly.

**DONE WHEN:** Cards show live data from RxDB. Numbers update when a new transaction is added.

**SCOPE FOR IMPROVEMENT:**
- Sparkline charts under each metric (7-day trend from daily_summary)
- Tap-to-drill-down on each card to a filtered report view

---

### Chunk 1.2 — Outstanding Dues + Recent Transactions
**Read first:** dashboard.html (dues section + recent transactions section)

**WHAT:** Dues table with escalation tiers (due today / 1-29 days / 30+ days critical).
Kanban toggle. Recent transactions list (last 5).

**DECISION GUIDE:**
- Dues come from `transactions` table where `status IN ('pending', 'partial')`.
- Calculate days overdue: `Math.floor((today - due_date) / 86400000)`.
- Tier assignment: days=0 → 'today', 1-29 → 'overdue', 30+ → 'critical'.
- Kanban view is a client-side toggle — same data, different layout. No new query.
- Recent transactions: query `transactions` ordered by `created_at` descending, limit 5.
- WhatsApp remind button: opens `https://wa.me/{phone}?text={prewritten message}`. Phone comes from the linked party record.
- Never show NPA prompt here. NPA is owner-initiated from Party screen only.

**DONE WHEN:** Dues show correct tiers. Kanban toggle works. WhatsApp button opens correctly.

**SCOPE FOR IMPROVEMENT:**
- Swipe left on mobile dues rows for quick actions
- Filter dues by location (crusher / store 1 / store 2)

---

## PHASE 2 — TRANSACTION SCREEN
**Session estimate: 3 chunks**

### Chunk 2.1 — Step 1: Transaction Type + Document Type + Location
**Read first:** transaction.html (Step 1 section)

**WHAT:** 6 transaction type buttons (sale/purchase/expense/payment_in/payment_out/credit_note).
Document type selector (Tax Invoice vs Cash Memo) — shown only for Sale.
Location selector (All / Crusher / Store 1 / Store 2 / Custom).
Date field + channel (retail/wholesale).

**DECISION GUIDE:**
- Transaction type controls which steps appear. Store selection in state — do not put in URL.
- Cash Memo hides all GST fields throughout the entire form. Set a `isCashMemo` flag in local state at Step 1. Pass it down to all steps.
- Location affects item catalogue filtering in Step 3. Store `selectedLocation` in form state.
- Location names (Crusher, Store 1, Store 2) come from `config.modules` — not hardcoded. Read from `useConfig()`.
- Date defaults to today. Allow past dates (offline catch-up is a core feature).
- Retail vs wholesale affects which price auto-fills in Step 3. Store `channel` in form state.

**DONE WHEN:** Selecting type correctly shows/hides document type selector. Location filters are stored. State passes cleanly to next step.

**SCOPE FOR IMPROVEMENT:**
- Quick sale mode: skip to Step 3 directly for returning customers
- Remember last used location and channel per user session

---

### Chunk 2.2 — Step 2: Party + Steps 3+4: Items + Details
**Read first:** transaction.html (Party search, line items, variable fields sections)

**WHAT:**
Step 2: Party search with live debounced query. Balance shown per result.
Step 3: Multi-line item entry with catalogue search, auto-price fill, qty input.
Step 4: Variable fields from config + notes + edit reason field.

**DECISION GUIDE:**
- Party search: use `useRxQuery` with `live: false` triggered on input change (debounce 300ms). Query `parties` by name or phone using RxDB `$regex` selector.
- Duplicate phone detection: when adding NEW party inline, query parties by phone before saving. If found, show warning. Do NOT block — just warn.
- Item catalogue: filter by `location_id === null OR location_id === selectedLocation`. Items with `active: false` are hidden.
- Auto-price: if `channel === 'wholesale'` use `sell_price_wholesale`, else `sell_price_retail`. Both fields are on the item record.
- Line total = qty × unit_price (no GST in line — GST calculated at summary level).
- Variable fields: read labels from `config.transaction_fields`. Only show fields where `visible: true`. Never hardcode "Vehicle Number" etc.
- Edit reason field: required only when editing an existing transaction. On new transactions, leave empty.

**DONE WHEN:** Party search works live. Items auto-fill price. Variable fields show correct labels from config.

**SCOPE FOR IMPROVEMENT:**
- Barcode/QR scan to add items (V2 feature — leave a clearly marked TODO comment)
- Item search by HSN code or variable field value

---

### Chunk 2.3 — Step 5: Payment + Step 6: Review + Save
**Read first:** transaction.html (payment status section, review section, reminder modal)

**WHAT:**
Step 5: Mandatory payment status (Paid-Cash / Paid-UPI / Partial / Pending).
Conditional fields: UPI reference, partial amount, due date.
Step 6: Review all entered data. Save to RxDB. Trigger reminder modal if pending/partial.

**DECISION GUIDE:**
- Payment status is MANDATORY. The Continue button must be disabled until one is selected. This is non-negotiable per product rules.
- When saving, call `createRecord('transactions', data, { user_id })` from helpers.js. Never call db.transactions.insert() directly.
- After saving transaction, trigger these in order:
  1. `deductFinishedStock()` for each line item (if inventory plugin enabled)
  2. `recalculatePartyBalance()` for the party
  3. `recalculateDailySummary()` for today's date
  All three are in helpers.js.
- Reminder modal: fires automatically 700ms after successful save IF status is 'partial' or 'pending'. Cannot be dismissed with Escape key. Stores `reminder_date` on the transaction record via `updateRecord()`.
- For Cash Memo: hide GST rows throughout review. Show subtotal = total (no GST breakdown).
- GST calculation (Tax Invoice only): CGST = SGST = (line_total × gst_rate) / 2. Store both on transaction.

**DONE WHEN:** Transaction saves to RxDB. Stock updates. Party balance updates. Daily summary updates. Reminder modal fires for pending/partial.

**SCOPE FOR IMPROVEMENT:**
- Transaction templates: save current form as template, one-tap reuse
- Recurring transaction setup (V2 — leave TODO)

---

## PHASE 3 — PARTY SCREEN
**Session estimate: 2 chunks**

### Chunk 3.1 — Party List + Profile Header
**Read first:** party.html (list view + profile header section)

**WHAT:** Party list with search/filter. Party profile: name, contact, balance, credit limit.
Variable fields display. Balance shown prominently.

**DECISION GUIDE:**
- List uses `useRxQuery` with `live: true` on `parties` table, ordered by `balance` (most owing first as default).
- Filter by type (customer/vendor/both) is client-side on the already-fetched list — no new query.
- Balance color logic: negative (customer owes us) → amber. Positive (we owe them) → teal. Zero → text color.
- Credit limit warning: if `Math.abs(balance) > credit_limit`, show red warning on profile.
- Variable fields on profile: read from `config.party_fields`. Only render fields where `visible: true` AND the party has a value for that field.
- NPA badge: show if `party.npa === true`. Never show a "Mark as NPA" suggestion — only show if already marked.

**DONE WHEN:** Party list renders live. Profile shows correct balance with color. Variable fields show from config.

**SCOPE FOR IMPROVEMENT:**
- Map view of customer locations (V2 — leave TODO with Leaflet note)
- Party merge for duplicates

---

### Chunk 3.2 — Party Ledger + Payments + NPA
**Read first:** party.html (ledger section, payments section, NPA section)

**WHAT:** Transaction history per party (ledger view). Payment collection inline.
NPA marking — owner-initiated only.

**DECISION GUIDE:**
- Ledger query: `transactions` where `party_id === currentPartyId`, ordered by `date` descending. Use `useRxQuery` with `live: true`.
- Running balance column: calculate client-side by iterating ledger entries, not stored separately.
- Inline payment collection: opens a slide-up form. Calls `createRecord('payments', ...)`. Then calls `recalculatePartyBalance()` and `recalculateDailySummary()`.
- NPA section: only visible if `config.modules.npa === true`. Marking NPA requires: `npa_reason` (mandatory text), `npa_amount` (editable — partial NPA allowed). Uses `updateRecord()` with an audit note.
- NPA amount defaults to full outstanding balance but is editable. Owner may mark only part as NPA.
- After marking NPA, log to `audit_log` with operation: 'npa_mark'.

**DONE WHEN:** Ledger shows all transactions. Running balance is correct. NPA marking saves correctly with audit log entry.

**SCOPE FOR IMPROVEMENT:**
- Party statement PDF generation (calls @react-pdf/renderer)
- Payment trend chart (last 6 months)

---

## PHASE 4 — ITEMS SCREEN
**Session estimate: 1 chunk**

### Chunk 4.1 — Items Catalogue + BOM
**Read first:** items.html

**WHAT:** Item grid/list with stock bars. Stock levels. BOM editor per item (if production plugin enabled).

**DECISION GUIDE:**
- Items query: `items` where `active: true`, ordered by `name`. Use `useRxQuery` with `live: true`.
- Location filter: items with `location_id === null` show everywhere. Items with a specific `location_id` only show for that location's filter.
- Stock bar: calculate `(stock_qty / (low_stock_alert * 3)) * 100` — cap at 100%. Color: above 30% = teal, 10-30% = amber, below 10% = red.
- BOM editor: only shown if `config.modules.production === true`. Query `bom` where `item_id === currentItem.id`.
- Adding BOM lines: `createRecord('bom', ...)`. Editing: `updateRecord('bom', id, changes)`.
- Item deactivation: `updateRecord('items', id, { active: false })` — never delete.
- Dual pricing: always show both retail and wholesale prices. Edit both simultaneously.

**DONE WHEN:** Items show with correct stock indicators. BOM shows/hides based on plugin. Deactivation works.

**SCOPE FOR IMPROVEMENT:**
- Barcode label printing
- Bulk price update (percentage increase/decrease on a category)

---

## PHASE 5 — REPORTS SCREEN
**Session estimate: 2 chunks**

### Chunk 5.1 — P&L + Cashbook + Date Range
**Read first:** reports.html (P&L tab, Cashbook tab)

**WHAT:** P&L report (Revenue, COGS, Expenses, Gross Profit, Net Profit) for a date range.
Cashbook (daily cash in/out). Monthly trend bar chart.

**DECISION GUIDE:**
- ALL report data comes from `daily_summary` table for performance. Never scan all transactions to build a report.
- Date range query: `daily_summary` where `date >= startDate AND date <= endDate`.
- Aggregate by summing `total_sales`, `total_purchases`, `total_expenses`, `gross_profit`, `net_cash` across all rows in range.
- If `daily_summary` is missing for some dates (data not entered that day), those dates are just absent — do not error.
- COGS = sum of all `transaction_lines.qty * transaction_lines.cost_price` for sales in range. This is a heavier query — run it in a Web Worker if it takes > 200ms (leave TODO if not implementing now).
- Monthly bar chart data: last 6 months, one entry per month from `daily_summary`.
- Cash Memo tab: query `transactions` where `doc_type === 'cash_memo'` in the date range. Show separately from Tax Invoice revenue.

**DONE WHEN:** P&L shows correct numbers for selected date range. Cashbook lists daily entries.

**SCOPE FOR IMPROVEMENT:**
- Export to PDF (calls @react-pdf/renderer — leave TODO with function signature)
- Comparison mode: this period vs last period

---

### Chunk 5.2 — Dues Report + GST Summary
**Read first:** reports.html (Outstanding Dues tab, GST Summary tab)

**WHAT:** Full dues report with aging buckets. GST liability summary (Output GST, ITC, Net payable).

**DECISION GUIDE:**
- Dues query: `transactions` where `status IN ('pending', 'partial')`. Include party name via join (fetch party separately or use a Map for O(1) lookup).
- Aging buckets: 0 days, 1-30, 31-60, 61-90, 90+. Calculate from `due_date` to today.
- GST Summary: only show if `config.modules.gst === true`.
- Output GST: sum `gst_amount` from `transactions` where `tx_type === 'sale'` and `doc_type !== 'cash_memo'` in the date range.
- ITC (Input Tax Credit): sum `gst_amount` from `transactions` where `tx_type === 'purchase'` in the date range.
- Net payable = Output GST - ITC.
- Always show the CA disclaimer: "Export this summary and share with your CA for official filing. This is calculated from recorded transactions only."
- GSTR-1 / GSTR-3B export buttons: generate CSV with the right columns. GST filing format.

**DONE WHEN:** Dues show correct aging. GST numbers are accurate. CA disclaimer is always visible.

**SCOPE FOR IMPROVEMENT:**
- Income tax estimator (V2 — Proprietorship slab rates — leave TODO)
- Tally XML export (leave TODO with data structure comment)

---

## PHASE 6 — LEADS SCREEN
**Session estimate: 1 chunk**

### Chunk 6.1 — Leads Kanban + Convert to Party
**Read first:** leads.html

**WHAT:** Kanban pipeline (New/Quoted/Negotiating/Won/Lost). Add lead. Move between stages.
Convert won lead to party.

**DECISION GUIDE:**
- All leads: `useRxQuery` with `live: true` on `leads` table.
- Kanban columns are client-side grouping of the same data — not separate queries.
- Moving a lead to a new stage: `updateRecord('leads', id, { stage: newStage })`. Also append to `timeline` array: `[...lead.timeline, { text: 'Moved to X', time: new Date().toISOString() }]`.
- Follow-up alert: compare `lead.followup` to today's date client-side. Show alert badge count in nav.
- Won flow: `createRecord('parties', { name, phone, type: 'customer', ... })`. Then `updateRecord('leads', id, { stage: 'won', converted_party_id: newPartyId, converted_at: now() })`.
- Lost flow: `updateRecord('leads', id, { stage: 'lost', lost_reason: selectedReason })`. Reason is mandatory.
- Duplicate phone check: before converting won lead to party, check if phone already exists in parties table.

**DONE WHEN:** Kanban renders live. Stage moves save. Won lead creates party. Lost reason is saved.

**SCOPE FOR IMPROVEMENT:**
- Drag and drop between columns (use @dnd-kit — leave TODO with import note)
- Follow-up WhatsApp message templates

---

## PHASE 7 — SETTINGS SCREEN
**Session estimate: 2 chunks**

### Chunk 7.1 — Business Profile + Plugins + Variable Fields
**Read first:** settings.html (Business Profile, Plugins, Variable Fields sections)

**WHAT:** Edit business profile (writes to `config`). Toggle plugins with pros/cons shown.
Rename variable field labels per entity.

**DECISION GUIDE:**
- Config reads: `useConfig()` hook. Never query config directly in the component.
- Config writes: `updateRecord('config', 'main', changes, { user_id })`.
- Plugin toggle: show pros and cons BEFORE enabling. After enabling, show a confirmation. After disabling, show "Data is preserved — only the UI is hidden." Never delete data on disable.
- Disabling Production requires disabling Inventory check first (Production depends on Inventory).
- Variable field labels: edit in a local state copy first. Save all at once with a single `updateRecord`. Never save on each keystroke.
- Invoice prefix change: update `config.invoice_prefix`. Show live preview: `{prefix}-{FY}-{nextNumber}`.
- Unsaved changes: track dirty state. Show a save banner. Block navigation away with a confirm dialog if dirty.

**DONE WHEN:** Business profile saves correctly. Plugin toggles persist. VF label changes appear in forms immediately after save.

**SCOPE FOR IMPROVEMENT:**
- Import from Excel for parties/items (V2 — leave TODO with column mapper note)
- Tally XML export setup

---

### Chunk 7.2 — Users + Export + Security
**Read first:** settings.html (Users section, Export section, Security section)

**WHAT:** User management (add/edit/deactivate). Data exports. PIN change. Auto-lock settings.

**DECISION GUIDE:**
- Users only editable if `config.modules.multi_user === true`. Otherwise show a "Enable Multi-user plugin" prompt.
- Add user: `createRecord('users', { ...userData, pin_hash: await hashPin(pin), role, permissions })`. Use `hashPin()` from helpers.js.
- Deactivate user: `updateRecord('users', id, { active: false })`. Never delete.
- PIN change for logged-in user: verify current PIN with `verifyPin()`, then hash new PIN with `hashPin()`, then `updateRecord('users', id, { pin_hash: newHash })`.
- Export buttons: generate the data client-side, create a Blob, trigger download. CSV format: use `Array.join(',')` — no library needed for simple CSV.
- Encrypted backup: serialize full DB, encrypt with `encryptRecord()`, download as `.bos` file.
- Auto-lock setting: reads/writes `DEFAULT_LOCK_MS` equivalent stored in config (add a `lock_timeout_ms` field to config if not present).
- Audit log export: query all `audit_log` records, format as CSV.

**DONE WHEN:** Users can be added and deactivated. Exports download correctly. PIN change works.

**SCOPE FOR IMPROVEMENT:**
- QR code provisioning for new employees (offline onboarding — V2)
- Role permission matrix UI (granular toggle per permission per user)

---

## PHASE 8 — PRODUCTION SCREEN
**Session estimate: 2 chunks**

### Chunk 8.1 — Production Log + Raw Materials
**Read first:** production.html

**WHAT:** Production run log. Raw materials catalogue with stock levels.

**DECISION GUIDE:**
- Only accessible if `config.modules.production === true`. Gate at route level.
- Production runs: `useRxQuery` with `live: true` on `production_runs`, ordered by `date` descending.
- Raw materials: `useRxQuery` with `live: true` on `raw_materials`.
- Low stock calculation: `raw_material.stock_qty < raw_material.low_stock_alert`.
- Editing raw material: `updateRecord('raw_materials', id, changes)`.
- Raw material purchase: `createRecord('transactions', { tx_type: 'purchase', ...})` THEN `updateRecord('raw_materials', id, { stock_qty: old + qty, avg_cost: newWeightedAvg })`. Weighted avg formula: `(oldQty * oldCost + newQty * newCost) / (oldQty + newQty)`.

**DONE WHEN:** Production log shows. Raw materials show with correct stock. Stock updates on purchase.

---

### Chunk 8.2 — BOM Editor + Production Run Form
**Read first:** production.html (BOM editor, production run form)

**WHAT:** BOM editor (recipe per finished item). Log a production run (triggers auto-deduction).

**DECISION GUIDE:**
- BOM editor: CRUD on `bom` table. One item can have many BOM rows (one per raw material).
- Production run save sequence (ORDER MATTERS):
  1. `createRecord('production_runs', runData)` — saves the run with materials snapshot
  2. `deductRawMaterialsForRun(item_id, qty_produced)` from helpers.js — deducts from raw_materials
  3. `addFinishedStock(item_id, qty_produced, cost_per_unit)` from helpers.js — adds to items stock
  4. `recalculateDailySummary(date)` — updates today's summary
- Materials snapshot: at the time of saving, copy the current BOM into `production_runs.materials_used`. This is frozen — future BOM changes do not affect old runs.
- Cost per unit: `(sum of all raw material costs used) / qty_produced`. If labour_cost is entered, add it: `(material_cost + labour_cost) / qty_produced`.

**DONE WHEN:** BOM saves. Production run triggers correct stock deductions and additions. Daily summary updates.

---

## PHASE 9 — DELIVERY SCREEN
**Session estimate: 2 chunks**

### Chunk 9.1 — Dispatch (Admin Side)
**Read first:** delivery_confirmation_2.html (Admin tab)

**WHAT:** Create a delivery with up to 5 stops. Assign driver. Set GPS coordinates per stop. Set proof requirements.

**DECISION GUIDE:**
- Delivery is NOT a separate DB table in the current schema — it runs through `transactions` with a `tx_type` that has delivery data in `variable_fields`.
- GPS coordinates: use `navigator.geolocation.getCurrentPosition()` for "Use my location". Fall back to manual input.
- Reverse geocoding: use Nominatim API (`https://nominatim.openstreetmap.org/reverse`) — free, no API key.
- Dispatch creates a local state object that is passed to the driver's view. In a real sync scenario, this would travel in a sync packet.
- OSRM routing: `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson` — free, no API key.

**DONE WHEN:** Admin can create a dispatch with multiple stops, set GPS coordinates, and assign a driver.

---

### Chunk 9.2 — Driver Confirmation + Proof
**Read first:** delivery_confirmation_2.html (Driver tab, Proof tab)

**WHAT:** Driver live GPS. Photo capture. Geofence arrival detection. Delivery confirmation. Proof certificate generation.

**DECISION GUIDE:**
- Live GPS: `navigator.geolocation.watchPosition()` with `enableHighAccuracy: true`.
- Geofence: use `haversine()` distance calculation. Trigger arrival prompt at ≤ 100m.
- Photos: `<input type="file" accept="image/*" capture="environment">`. Validate: min 5KB, max 15MB, must be image type, brightness check.
- Brightness check: draw photo to canvas, sample pixel values, reject if average < 30 (too dark).
- Offline map tiles: Service Worker (map-sw.js already exists). Register in main.jsx.
- Proof link: serialize proof data to base64, embed in URL hash. No server needed.
- Proof PDF: generate with @react-pdf/renderer client-side.

**DONE WHEN:** GPS tracks driver. Photos validate. Geofence fires at 100m. Proof link generates correctly.

---

## PHASE 10 — CONFLICT SCREEN + PWA
**Session estimate: 1 chunk**

### Chunk 10.1 — Conflict Resolution + PWA Setup
**Read first:** conflict-inbox.html

**WHAT:** Conflict inbox showing pending sync conflicts. Side-by-side diff. Resolve by picking version or manual edit.
manifest.json. Service Worker registration.

**DECISION GUIDE:**
- Conflicts query: `conflict_log` where `status === 'pending'`. Use `useRxQuery` with `live: true`.
- Side-by-side diff: compare `version_a.data` vs `version_b.data` field by field. Highlight fields where `version_a.data[key] !== version_b.data[key]`.
- Resolution: call `resolveConflict(conflict_id, { version, manual_data, resolved_by, note })` from helpers.js. This is already implemented.
- Resolution note is MANDATORY. Block confirm button until note is entered.
- manifest.json: required fields: `name`, `short_name`, `start_url`, `display: "standalone"`, `background_color`, `theme_color`, `icons` (192px + 512px).
- Service Worker: register `map-sw.js` in `main.jsx` using `navigator.serviceWorker.register('/map-sw.js')`. Wrap in `if ('serviceWorker' in navigator)` check.

**DONE WHEN:** Conflict inbox shows pending conflicts. Resolution saves correctly. PWA installs from browser.

---

## POST-PHASE — V2 FEATURES (DO NOT BUILD YET)

Track these as TODO comments in code where relevant:
- Income tax estimator
- Duress PIN + decoy mode
- Data import (Excel/CSV column mapper)
- OCR document scanning
- Voice input on mobile
- Biometric login (WebAuthn)
- Hindi/Marathi UI
- Auto-lock (configurable timeout — partial in Phase 7)
- Inline list editing (Excel-style)
- Employee QR provisioning

---

*When a chunk is complete, put ✓ next to it and note the date in PROGRESS_TRACKER.md.*
*Never start a new chunk in the same session as a complex previous chunk.*
*One chunk per session is the right pace for quality.*
