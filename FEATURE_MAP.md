# Business OS — Complete Feature Map
**Date:** 22 March 2026  
**Status:** Research complete. Pre-build reference document.

---

## How to read this document

Every feature is tagged:

- **[V1-CORE]** — Ships in Version 1. Always on. No toggle.
- **[V1-PLUGIN]** — Ships in Version 1. Off by default. User enables with pros/cons shown.
- **[V2]** — Version 2. Depends on V1 being stable first.
- **[V3]** — Version 3. Advanced or complex. Needs real user feedback before building.
- **[FUTURE]** — On the radar. Not committed to any version yet.

---

## Guiding principle

Tally is built for accountants. Zoho is built for the cloud. Vyapar is built for shopkeepers.  
**This is built for the business owner who wants to run everything from one screen, offline, privately.**

The UX ceiling is: a low-tech field staff member can record a sale without training.  
The power floor is: an owner gets P&L, dues, stock, and insights in one dashboard.

---

## MODULE 1 — PARTIES (Customers & Vendors)

### V1 Core
| Feature | Detail |
|---|---|
| Unified party table | Customer and vendor in one place. `type` field distinguishes. |
| Party profile | Name, phone, address, email, variable fields (5 slots, user-labelled) |
| Balance tracker | Live running balance per party. Auto-updated on every transaction. |
| Credit limit | Set max credit per customer. Warn when exceeded. |
| Transaction history | Every sale, payment, purchase tied to this party in one view. |
| Search + filter | By name, phone, type, balance, area |
| Quick add | Add party from transaction screen without leaving the flow |
| Notes field | Freeform notes on the party record |

### V1 Plugin — NPA Tracking
| Feature | Detail |
|---|---|
| Mark as NPA | Flag a party as non-performing |
| Partial NPA | Mark only a portion of balance as NPA (editable amount) |
| NPA reason | Required text field when marking |
| NPA date | Auto-recorded |
| Recovery log | Record partial recoveries against NPA amount |
| NPA dashboard | Total NPA amount across all parties |
| Exclude from reports | NPA amounts optionally excluded from receivables |

### V2
| Feature | Detail |
|---|---|
| Party tags / groups | Group by area, category, channel |
| Credit scoring | Simple score based on payment history and delays |
| Duplicate detection | Warn if same phone number added twice |
| Party merge | Merge two duplicate records cleanly |
| Import from Excel | Bulk upload party list from spreadsheet |
| Communication log | Log calls, meetings, WhatsApp messages against party |

### V3
| Feature | Detail |
|---|---|
| Party photo | Attach photo (useful for field staff) |
| Map view | Plot customer locations on a map |
| Relationship graph | Show who referred whom |

---

## MODULE 2 — ITEMS (Products & Services)

### V1 Core
| Feature | Detail |
|---|---|
| Item catalogue | Name, unit, cost price, sell price, variable fields (5 slots) |
| Item type | `produced` (has BOM) or `traded` (bought and sold) |
| Dual pricing | Retail price and wholesale price per item |
| Active/inactive toggle | Hide discontinued items without deleting |
| Quick search | Search by name or variable field value |

### V1 Plugin — GST Engine
| Feature | Detail |
|---|---|
| GST rate per item | 0%, 5%, 12%, 18%, 28% slab |
| HSN code per item | Stored in variable field or dedicated field |
| Auto CGST/SGST split | 50/50 for intrastate |
| IGST for interstate | Toggle per transaction based on buyer state |
| GST-inclusive pricing | Option to show MRP inclusive or exclusive |

### V1 Plugin — Inventory
| Feature | Detail |
|---|---|
| Stock quantity | Live count per item |
| Auto deduct on sale | Sale recorded → stock goes down automatically |
| Low stock alert | Set threshold per item. Alert on dashboard. |
| Stock value report | Total value of current inventory at cost price |
| Manual stock adjustment | Correct discrepancies with reason logged |

### V2
| Feature | Detail |
|---|---|
| Item categories | Group items by type |
| Item photo | Attach image |
| Barcode / QR | Generate and scan barcode per item |
| Price history | Track how sell price changed over time |
| Item bundles | Sell two items as a package at a combined price |
| Import from Excel | Bulk upload item list |
| Unit conversion | e.g. buy in kg, sell in grams |

### V3
| Feature | Detail |
|---|---|
| Price tiers | Customer-specific pricing |
| Demand forecasting | Simple: "you usually run out of X in 12 days at this rate" |
| Expiry tracking | For perishable goods |

---

## MODULE 3 — TRANSACTIONS

### V1 Core
| Feature | Detail |
|---|---|
| Transaction types | Sale, purchase, expense, payment in, payment out |
| Multi-line invoice | Multiple items per transaction |
| Sale channels | Retail or wholesale — different price applied automatically |
| Payment modes | Cash, bank transfer, UPI, cheque, credit |
| Credit sale | Record a sale and mark it as pending/partial/paid |
| Partial payments | Multiple payments against one transaction |
| Balance due | Auto-calculated and shown per transaction |
| Edit with reason | Any edit requires a note (used in conflict resolution) |
| Cancel transaction | Cancel with reason. Never deleted. Audit preserved. |
| Variable fields | 5 user-labelled slots (e.g. vehicle no, driver, site, PO number) |
| Date override | Allow past-date entry for offline catch-up |

### V1 Plugin — GST Billing
| Feature | Detail |
|---|---|
| GST invoice format | CGST + SGST breakdown per line item |
| GSTIN on invoice | Buyer GSTIN captured and printed |
| GST summary | Total CGST, SGST, IGST per invoice |
| Tax invoice vs bill of supply | Auto-select based on buyer GST status |

### V2
| Feature | Detail |
|---|---|
| Recurring transactions | Set a transaction to repeat weekly/monthly |
| Transaction templates | Save a common sale as a template. One tap to reuse. |
| Bulk transactions | Multiple sales in one entry (e.g. end of day counter) |
| Return / credit note | Record goods returned by customer |
| Advance payment | Record payment before goods are delivered |
| Transaction attachments | Photo of delivery receipt or physical bill |
| Transaction search | Filter by party, date range, amount, status, item |
| Transaction export | Export filtered list to Excel/CSV |

### V3
| Feature | Detail |
|---|---|
| E-way bill | Auto-generate for eligible transactions (India GST) |
| E-invoice (IRN) | Generate IRN for eligible businesses |
| Multi-currency | For businesses with import/export |

---

## MODULE 4 — PRODUCTION

### V1 Plugin — Production Module
*Requires Inventory plugin to be enabled first.*

| Feature | Detail |
|---|---|
| Raw material catalogue | Separate from finished items. Name, unit, stock, avg cost. |
| Raw material purchase | Record vendor purchase → stock goes up automatically |
| Bill of materials (BOM) | Recipe per finished product. Which raw materials, how much. |
| Production run | Log a batch: what was made, how many units, date |
| Auto raw material deduction | BOM × qty produced = materials consumed. Auto deducted. |
| Auto finished stock addition | Qty produced added to item stock automatically |
| Cost per unit calculation | Sum of materials used / qty produced = cost per unit. Auto. |
| Labour cost per run | Optional flat amount. Added to cost calculation. |
| Materials snapshot | At time of production run, exact materials used are saved. Audit-safe even if BOM changes later. |
| Production log | All runs, by item, by date |

### V2
| Feature | Detail |
|---|---|
| Yield tracking | Expected vs actual yield per run |
| Production planning | "To produce X units tomorrow, you need Y of material A" |
| Wastage tracking | Record material lost in production |
| Shift tracking | Morning / evening shift per run |
| Multi-stage production | Item goes through multiple production steps |

### V3
| Feature | Detail |
|---|---|
| Production cost trend | How cost per unit changes over time |
| Material substitution | If material A is low, use material B instead |
| Quality grades | Mark production run as grade A / B / C |

---

## MODULE 5 — DOCUMENTS & PDF

### V1 Core
| Feature | Detail |
|---|---|
| Basic invoice | Clean PDF with business name, date, items, total, party |
| Basic receipt | Payment acknowledgement |
| Delivery note | Items dispatched, quantities, party |
| Sequential numbering | INV-2024-001, auto-incremented, no gaps |
| Share via WhatsApp | One tap to share PDF as document |
| Save locally | All PDFs stored in local DB as blobs |
| Indian date format | DD/MM/YYYY throughout |
| Currency format | Indian format (₹1,00,000 not ₹100,000) |

### V1 Plugin — Branded PDF
| Feature | Detail |
|---|---|
| Business logo | Upload once, appears on all documents |
| Letterhead | Custom header with address, phone, GSTIN |
| Custom templates | Choose from 3-4 invoice layouts |
| Custom footer | Bank details, T&C, thank you message |
| Watermark | ORIGINAL / DUPLICATE / CANCELLED |
| Colour theme | Match business brand colour |

### V1 Plugin — GST Invoice (under GST Engine)
| Feature | Detail |
|---|---|
| GST-compliant format | GSTIN, HSN, CGST, SGST, IGST columns |
| Tax summary box | As required by GST rules |
| Amount in words | Required on tax invoices |

### V2
| Feature | Detail |
|---|---|
| Quotation / estimate | Send before converting to invoice |
| Proforma invoice | Pre-invoice for advance payment |
| Purchase order | Generate PO to send to vendor |
| Statement of account | Full transaction history for a party, one PDF |
| E-mail PDF | Send directly from app via email |
| Bulk PDF | Generate invoices for multiple parties at once |
| Custom fields on PDF | Add variable field data to invoice layout |

### V3
| Feature | Detail |
|---|---|
| Digital signature | Owner signature on invoice |
| QR code on invoice | For payment via UPI |
| E-invoice (IRN) | Government-mandated for large businesses |

---

## MODULE 6 — FINANCIAL REPORTS & DASHBOARD

### V1 Core
| Feature | Detail |
|---|---|
| Owner dashboard | Single screen: today's sales, cash in hand, pending dues, low stock alerts |
| Daily cash position | Cash in + cash out + net for today |
| Daily P&L | Revenue - COGS - expenses = gross profit for the day |
| Outstanding dues | Total amount pending. List by customer. Oldest first. |
| Party ledger | Full debit/credit history per party |
| Expense summary | By category, by date range |
| Payment collection report | What was collected today / this week / this month |

### V1 Core — Date range reports
| Feature | Detail |
|---|---|
| Weekly summary | Sales, collection, expenses for the week |
| Monthly P&L | Revenue, COGS, expenses, gross profit for the month |
| Quarterly P&L | Q1/Q2/Q3/Q4 comparison |
| Yearly summary | Full year overview |
| Custom date range | Any from-to date |

### V2
| Feature | Detail |
|---|---|
| Gross profit by item | Which product makes the most profit |
| Sales by channel | Retail vs wholesale breakdown |
| Top customers | By revenue, by volume, by payment reliability |
| Slow-moving items | Products with low sales velocity |
| Cash flow forecast | Simple: "at this rate, cash runs out in X days" |
| Expense trend | Month-on-month expense comparison |
| Collection efficiency | % of dues collected within 30/60/90 days |
| GST liability report | GSTR-1 and GSTR-3B ready summary |

### V3
| Feature | Detail |
|---|---|
| Break-even calculator | How many units to sell to cover fixed costs |
| Profitability by customer | Which customers are most profitable net of discounts |
| Seasonal trends | Month-by-month comparison across years |
| Budget vs actual | Set a budget. Track against it. |

---

## MODULE 7 — LEADS & SALES PIPELINE (CRM layer)

### V2 Plugin — Leads & Pipeline
| Feature | Detail |
|---|---|
| Lead capture | Add a lead: name, phone, what they need, source |
| Lead source tracking | Walk-in, referral, call, WhatsApp, field visit |
| Pipeline stages | New → Contacted → Quoted → Negotiating → Won/Lost |
| Follow-up reminder | Set a date. App reminds. |
| Quotation from lead | Generate quotation directly from lead card |
| Convert to customer | One tap: lead becomes a party when deal is won |
| Won/lost reason | Required field when closing a lead |
| Lead dashboard | How many leads, at which stage, conversion rate |
| Lost lead analysis | Why are leads being lost |

### V3
| Feature | Detail |
|---|---|
| Lead assignment | Assign to a specific employee |
| Follow-up log | Log every interaction with timestamps |
| Lead scoring | Simple score based on engagement and deal size |
| Referral tracking | Who referred this lead |

---

## MODULE 8 — DATA IMPORT & EXTRACTION

### V2 Plugin — Data Import
*This is the feature the client specifically asked about — importing from existing systems.*

| Feature | Detail |
|---|---|
| Excel import — parties | Upload .xlsx with customer/vendor list. Map columns. |
| Excel import — items | Upload item catalogue from spreadsheet |
| Excel import — transactions | Upload historical sales data |
| CSV import | Same as Excel, for CSV files |
| Column mapper | User maps "Customer Name" in their file to "name" in the app |
| Duplicate detection | Warn if importing a record that already exists |
| Import preview | Show first 10 rows before committing |
| Import log | What was imported, when, by whom |

### V2 Plugin — OCR Document Scanning
*Extract data from photos and PDFs of existing bills/invoices.*

| Feature | Detail |
|---|---|
| Photo scan | Take photo of a physical invoice/bill |
| PDF scan | Upload a PDF bill from vendor |
| Auto-extract fields | Vendor name, date, amount, items (using device OCR) |
| Review before save | Extracted data shown for confirmation before saving |
| Attach original | Original image stored alongside the created transaction |
| Expense from receipt | Scan a cash receipt → expense created automatically |
| Purchase from bill | Scan vendor bill → purchase transaction created |

**Note on OCR approach:** For local-first, offline architecture, we use on-device OCR (Tesseract.js or ML Kit) for basic extraction. For higher accuracy on complex documents, an optional cloud OCR call (Mindee or similar) can be made when internet is available. User chooses. Data is never stored on their server — only the extracted text is used.

### V3
| Feature | Detail |
|---|---|
| WhatsApp bill import | Forward a bill photo from WhatsApp → auto-extracted |
| Email bill import | Connect email → bills auto-scanned as they arrive |
| Bank statement import | Upload bank statement → match to transactions |
| Tally data import | Import ledger data from Tally export format |
| Historical data migration | Guided wizard to bring in all data from previous system |

---

## MODULE 9 — MULTI-USER & ROLES

### V1 Plugin — Multi-User
| Feature | Detail |
|---|---|
| User roles | Admin, Partner, Employee |
| Per-user PIN login | Local PIN, no internet needed |
| Role permissions | Admin sets exactly what each role can see/do |
| Permission matrix | View reports / edit transactions / delete / view financials / export / manage users |
| Action attribution | Every record shows who created/edited it |
| User activity log | What each user did and when |

**Warning shown before enabling:** "Once multiple users have created data, this plugin cannot be cleanly disabled. All data will remain attributed to individual users."

### V2
| Feature | Detail |
|---|---|
| Employee-wise sales report | How many sales each employee recorded |
| Access time limits | Employee login only during business hours |
| Approval workflow | Employee creates transaction → admin approves before finalising |
| Field staff mode | Simplified UI for low-tech users. Only sale entry and payment collection. |

### FUTURE — Multi-branch
| Feature | Detail |
|---|---|
| Branch management | Multiple locations, each with own inventory |
| Inter-branch transfer | Move stock from branch A to branch B |
| Consolidated reports | View all branches together or individually |
| Branch-wise P&L | Separate profitability per location |

---

## MODULE 10 — SYNC & DEVICES

### V1 Plugin — Device Sync
| Feature | Detail |
|---|---|
| Sync packet export | One tap: "Send today's changes". Creates encrypted JSON file. |
| Share via WhatsApp | Send packet as document attachment |
| Share via email/USB | Same packet, any channel |
| Import packet | Admin taps "Import". Selects file. Merge runs. |
| Conflict detection | If same record edited on two devices, flagged for review |
| Conflict UI | Show both versions side by side with edit reasons |
| Conflict resolution | Admin picks Version A, Version B, or manually edits |
| Conflict log | Every resolution saved with who decided and why |
| Sync status | Which records are synced, which are pending |

### V1 Plugin — Cloud Backup (optional)
| Feature | Detail |
|---|---|
| Google Drive backup | Encrypted backup of full local DB |
| Backup frequency | Daily / weekly / manual |
| Restore from backup | Pull backup from Drive and restore locally |
| Encrypted only | Backup is AES-256 encrypted before upload. Google cannot read it. |
| No sync, only backup | This is not real-time sync. It is a safety net. |

### FUTURE — Real-time sync
| Feature | Detail |
|---|---|
| WebSocket sync | When two devices on same WiFi, sync in real time |
| LAN sync | No internet needed. Local network only. |
| Bluetooth sync | Very short range, ultra-private |

---

## MODULE 11 — SECURITY & PRIVACY

### Always On (not a plugin, never a toggle)
| Feature | Detail |
|---|---|
| AES-256-GCM encryption | All records encrypted at rest in IndexedDB |
| PBKDF2 key derivation | 200,000 iterations. Key never stored. |
| Session key | In-memory only. Cleared on logout or app close. |
| Audit log | Immutable. Every create/update/delete logged with before+after. |
| Sync log | Tracks what has been sent, what hasn't |
| No server | Zero cloud dependency for core operation |
| No telemetry | App sends nothing to any server |
| No ads | No advertising, no tracking |

### V2
| Feature | Detail |
|---|---|
| Auto lock | App locks after X minutes of inactivity (default: 5 min) |
| Wrong PIN lockout | 5 wrong attempts → locked for 10 minutes |
| Export audit log | Download full audit trail as CSV |
| Data wipe | Emergency: wipe all local data with one confirmation |
| Duress PIN | A second PIN that triggers hidden mode when entered under pressure |
| Decoy mode | Duress PIN shows a clean minimal version of the app — same UI, limited or empty data. Real encrypted data stays invisible and intact. Used if someone demands to see the app. |

**Decoy mode rules:**
- Decoy data is a separate encrypted partition — real data is never shown
- Owner can optionally pre-populate decoy with plausible-looking but non-sensitive records
- Switching back to real mode requires the actual business PIN
- Decoy mode leaves no trace — no log entry, no indicator in UI

### V3
| Feature | Detail |
|---|---|
| Biometric login | Fingerprint / face ID instead of PIN |
| Two-device key backup | Split key across two devices for recovery |
| Panic wipe | Hold a physical button combo for 3 seconds → immediate data wipe |

---

## MODULE 12 — BUSINESS INSIGHTS (Smart layer)

### V2 — Basic Insights
These are simple calculations shown as cards on dashboard. No AI needed. Pure math.

| Insight | Logic |
|---|---|
| "Your best selling item this month" | Item with highest units sold |
| "Customer who owes the most" | Highest balance_due |
| "You haven't billed [customer] in 30 days" | Last transaction date check |
| "Stock of [item] will last ~X days" | Current stock ÷ average daily sales |
| "Your profit margin this month is X%" | (Revenue - COGS) / Revenue |
| "Compared to last month, sales are up/down X%" | Simple month-on-month comparison |
| "Most delayed payments come from [area]" | Group dues by variable field 3 (area) |

### V3 — Deeper Insights
| Insight | Logic |
|---|---|
| Seasonal patterns | "Sales of [item] always spike in [month]" |
| Payment behaviour | "This customer always pays late by 15 days" |
| Production efficiency | "Your cost per unit went up 8% this quarter" |
| Customer retention | "3 customers who bought regularly have gone quiet" |
| Best hours | "70% of your retail sales happen between 10am–1pm" |

---

## MODULE 15 — TAX AWARENESS

*Not tax filing. Not legal advice. Awareness only — so the owner knows what's coming before it arrives.*

### V1 Plugin — GST Liability (sits inside GST Engine)
| Feature | Detail |
|---|---|
| Output GST tracker | Total GST collected on all sales this month. CGST + SGST split. |
| Input tax credit (ITC) | Total GST paid on purchases. Offset against output GST. |
| Net GST payable | Output GST minus ITC. Exact figure. Updated daily. |
| Monthly GST card | Dashboard card: CGST collected, SGST collected, ITC available, net payable |
| Filing deadline reminder | "GSTR-3B due in X days" shown when net payable > 0 |
| GSTR-1 summary | Sales-side GST summary by rate slab — ready to hand to CA |
| GSTR-3B summary | Consolidated monthly GST position — ready to hand to CA |

**Note:** This calculates liability from recorded transactions. Accuracy depends on all transactions being entered. Partial entry = partial estimate.

### V2 Plugin — Income Tax Estimator
| Feature | Detail |
|---|---|
| Business structure setup | User sets: Proprietorship / Pvt Ltd / Partnership / LLP. One-time. |
| Net profit calculation | Revenue minus expenses minus COGS — pulled from app data |
| Tax slab application | Correct regime applied based on business structure |
| Estimated tax range | Shows a min-max range. Never a single "exact" figure. |
| Quarterly estimate card | Updated every quarter. Shown on dashboard. |
| Year-to-date position | Running estimate for the full financial year |
| CA disclaimer | Always shown: "Consult your CA. Deductions and depreciation not included." |

**Supported structures and rates (FY 2025-26):**
| Structure | Rate applied |
|---|---|
| Proprietorship | Individual slab rates (new regime): 0% / 5% / 10% / 15% / 20% / 30% |
| Private Limited | Flat 22% + 10% surcharge + 4% cess (new regime) |
| Partnership / LLP | Flat 30% + 4% cess |

**What it does NOT do:**
- Does not account for depreciation
- Does not account for Section 80 deductions
- Does not file anything
- Does not connect to any government portal
- Is not a substitute for a CA

### V3
| Feature | Detail |
|---|---|
| Advance tax reminder | "Advance tax instalment due by 15 Sept — estimated ₹X" |
| TDS tracker | Track TDS deducted / collected if applicable |
| Tax saved tracker | "You've recorded ₹X in business expenses this year — estimated tax saving: ₹Y" |

---

## MODULE 16 — DATA PORTABILITY (Export / Import / Sync)

**Core principle: data always belongs to the user. Export any table, any time, any format. No paywalls. No limits. No permission required.**

---

### V1 Core — Export
| Feature | Detail |
|---|---|
| CSV export | Export any table: parties, items, transactions, payments, expenses. One tap. |
| JSON export | Full structured export with all relationships intact. Any developer or CRM can read it. |
| Encrypted full DB backup | Entire database as AES-256 encrypted JSON blob. Decryptable only with business password. |
| Document version history | Every PDF ever generated stored locally. Re-print any old invoice exactly as it was. |
| Data health report pre-export | Before export: flags incomplete records — no phone, no cost price, untagged transactions. Fix first or export anyway. |

### V1 Plugin — Device Sync
| Feature | Detail |
|---|---|
| Delta sync packets | Only changes since last sync. Not full DB. Typically 10–50KB per day. |
| Sequence numbering | Every packet numbered. Out-of-order packets held until missing ones arrive. No corruption. |
| Business ID verification | Packet rejected if business_id doesn't match. No cross-contamination between businesses. |
| AES-256 encrypted packets | Encrypted before leaving device. Safe on any channel — WhatsApp, email, USB. |
| Conflict detection + resolution | Same record edited on two devices → human review. Both versions shown with reasons. |
| Export always available | Pending conflicts never block data export. |

### V2 — Import
| Feature | Detail |
|---|---|
| CSV / Excel column mapper | Upload file → drag their column to your field → preview 10 rows → validate → import. |
| Duplicate detection on import | Warn if record already exists before committing. |
| Import preview | Show first 10 rows before any data is written. User confirms. |
| Import log | What was imported, when, by whom. Reversible within 24 hours. |
| Vyapar import | Parse Vyapar CSV export format. Map to local schema automatically. |
| Zoho Books import | Parse Zoho CSV export. Auto-map common fields. |
| Tally XML import | Parse Tally XML / CSV export. Ledger and transaction history. |
| Backup restore | Encrypted JSON backup → decrypt with password → full restore. No mapping needed. |

### V2 — Export additions
| Feature | Detail |
|---|---|
| Tally XML export | Export transactions in Tally-compatible XML. CA imports directly. Zero re-entry. |
| PDF ledger / statement | Full party ledger as formatted PDF. Share on WhatsApp with one tap. |
| Audit log CSV | Full immutable audit trail exported for CA or legal review. |
| Filtered export | Export by date range, party, item, transaction type. Not always full dump. |
| GSTR-1 summary export | Sales-side GST data formatted for CA filing. CSV. |
| GSTR-3B summary export | Consolidated monthly GST position. CSV. |

### V3
| Feature | Detail |
|---|---|
| Bank statement import | Upload bank statement CSV → match transactions automatically → flag unmatched. |
| Historical migration wizard | Guided multi-step wizard for bringing in years of data from old system. |
| Universal import API | Any app that exports JSON can be mapped and imported. Schema-agnostic mapper. |

---

**Sync strategy — 5 rules**

1. **Delta only** — changes since last sync, never full DB
2. **Sequence numbered** — packet 5 waits for packet 4 if it arrives first
3. **Business ID verified** — wrong business ID = immediate reject, no merge
4. **Conflicts surface, never auto-resolve** — human always decides
5. **Export never blocked** — sync state never prevents data export

**Supported export formats summary**

| Format | Audience | Version |
|---|---|---|
| CSV | Owner, CA, Excel | V1 |
| JSON | Developer, any CRM | V1 |
| Encrypted JSON backup | Device migration, safety net | V1 |
| Tally XML | CA, accountant | V2 |
| PDF reports / ledger | Anyone | V2 |
| GSTR-1 / GSTR-3B CSV | CA filing | V2 |

---

## MODULE 13 — PLATFORM & DISTRIBUTION

### V1
| Feature | Detail |
|---|---|
| Web / PWA | Runs in browser. Installable on any device. |
| Android (.apk) | Via CapacitorJS. Works offline. |
| Desktop (.exe / .dmg) | Via Tauri. Lightweight, no Electron bloat. |
| Single codebase | React + Vite builds to all three |
| Offline first | Full functionality with zero internet |
| No account required | Runs immediately. No signup. No email. |
| One-time setup | Business name, password, template. Done. |

### V2
| Feature | Detail |
|---|---|
| Auto-update | App checks for updates and installs silently |
| Data migration wizard | Move data from one device to another cleanly |
| Multi-language UI | Hindi, Marathi, Telugu, Tamil (regional language support) |
| iOS (.ipa) | Apple App Store distribution |

---

## MODULE 14 — FIRST-RUN & ONBOARDING

### V1 Core
| Feature | Detail |
|---|---|
| Template picker | Retail / Service / Trading / Production / Custom |
| Module selector | Which plugins to enable on day one |
| Variable field labeller | Rename the 5 slots per entity to match their business |
| Sample data | Optional: load demo data to explore before going live |
| Business profile setup | Name, address, phone, GSTIN (optional) |
| First user setup | Admin PIN creation |
| Tutorial cards | Inline tips on first use of each screen |

---

## What competitors do that this does NOT do (intentional gaps)

| Gap | Reason |
|---|---|
| Bank account integration | Requires internet. Privacy risk. Not in scope. |
| GST portal direct filing | Requires government API. Future consideration only. |
| Payroll | Complex compliance layer. Separate product. |
| E-commerce integration | Out of scope for V1-V3 |
| Customer-facing portal | Out of scope |
| AI chatbot | Distraction. Data stays local. |
| Real-time cloud sync | By design. Sync packets are the model. |

---

## V1 Complete Feature List (summary)

### Tech stack (revised)
- **React + Vite** — single codebase
- **RxDB** — replaces Dexie.js. Reactive queries, built-in replication, conflict handling
- **Tauri v2** — replaces Tauri + CapacitorJS. One wrapper for Mac, Windows, iOS, Android
- **Web Workers** — background CSV/Excel import processing, no UI freeze
- **Argon2id + PBKDF2** — key derivation, GPU-resistant

### Always On
- Party management (customers + vendors) + **duplicate phone detection on creation**
- Item catalogue
- Transactions (sale, purchase, expense, payment)
- **Quick sale mode** — 2-tap flow for returning users (party + items + confirm)
- Multi-line invoices
- Basic PDF (invoice, receipt, delivery note)
- **Tally XML export** — moved from V2, CA switching trigger
- Daily P&L
- Outstanding dues dashboard + **Kanban dues view toggle**
- **Data health score** — completeness metric on dashboard
- Audit log + sync log
- AES-256 encryption at rest
- Offline-first, no server
- CSV + JSON export — all tables
- Encrypted full DB backup
- Document version history
- Data health report pre-export
- **Basic leads pipeline** — 4-field card (name, phone, need, follow-up), convert to party on win

### V1 Plugins (off by default, user enables)
1. **GST engine** — Tax slabs, CGST/SGST, compliant invoices + GST liability tracker
2. **Inventory** — Stock tracking, low stock alerts
3. **Production** — BOM, production runs, raw materials *(requires Inventory)*
4. **Multi-user** — Roles, permissions, per-user login + **field staff simplified mode**
5. **NPA tracking** — Write-off, partial NPA, recovery log
6. **Device sync** — Encrypted packets via WhatsApp/USB
7. **Branded PDF** — Logo, letterhead, custom templates
8. **Cloud backup** — Google Drive, encrypted only

### V2 Additions
- **Income tax estimator** — Estimated tax range per quarter, CA disclaimer
- **Duress PIN + decoy mode** — Second PIN shows empty app, no trace
- **Auto lock + PIN lockout** — Inactivity lock, brute force protection
- **Basic insights** — 7 smart dashboard cards, pure math, no AI
- **Leads pipeline full** — stages, follow-up, quotation, CRM pipeline
- **Data import** — Excel/CSV column mapper, bulk import
- **OCR scanning** — Photo/PDF → auto-extracted transaction
- **Inline list editing** — click any cell in party/transaction list to edit in place
- **Voice input mobile** — Web Speech API, offline Android, note dictation
- **i18n support** — Hindi, Marathi (English ships in V1)

---

## Build order (phased — revised after research)

| Phase | What ships | Why this order |
|---|---|---|
| Phase 1 | Core app + quick sale + duplicate detection + basic leads + Tally export + CSV/JSON + encrypted backup | Usable day 1. Three switching triggers included. |
| Phase 2 | GST plugin + GST liability tracker + Inventory plugin | Most needed by reference client |
| Phase 3 | Production plugin — BOM, runs, raw materials | Reference client is production business |
| Phase 4 | Multi-user + field staff mode + Device sync | Coordination + privacy features |
| Phase 5 | NPA + Branded PDF + Cloud backup | Polish and completeness |
| Phase 6 | Income tax estimator + Auto lock + Duress PIN + Decoy mode | Full security and tax awareness |
| Phase 7 | Column mapper import + Vyapar/Zoho import | Onboard existing businesses |
| Phase 8 | Full leads pipeline + OCR scanning | Full CRM + document extraction |
| Phase 9 | Inline editing + voice input + data health score | UX polish from research |
| Phase 10 | Insights + Advanced reports + Break-even + What-if | After 6 months of real data |
| Phase 11 | Hindi/Marathi UI + iOS distribution + Multi-branch | Scale and reach |

---

## Open questions (still unresolved)

1. What is the exact product list for the reference client? (BOM validation)
2. Is labour cost per production run, or a separate expense category?
3. Does the client need vehicle/trip tracking as first-class or just variable fields?
4. Single site or multiple godowns?
5. What invoice numbering format does the client currently use?
6. Which languages should V2 UI support first?
7. Will field staff have smartphones or use owner's device only?

---

## MODULE 17 — THEMES

### V1 Core (always on, not a plugin)
| Feature | Detail |
|---|---|
| 5 preset themes | Dark amber (default), Light clean, Dark blue, Dark red, Light green |
| Custom accent colour | Owner sets one brand colour. Replaces amber across entire app. |
| Zero-flash loading | Theme loaded from config before PIN screen. No colour flash on open. |
| Font size control | Small / Medium / Large. Body text only. |
| WCAG AA compliance | All themes validated at 4.5:1 contrast ratio minimum. |
| Print-safe | PDF always white background. App theme never affects printed output. |

---

## MODULE 18 — MOBILE UI

### V1 Core
| Feature | Detail |
|---|---|
| Bottom tab bar | 5 tabs: Home, Transactions, Parties, Reports, More |
| FAB | New sale. 56px. Always visible above tabs. |
| 48px touch targets | All interactive elements. Transparent hit areas on small icons. |
| Swipe left on list | WhatsApp, Edit, Delete quick actions |
| Pull to refresh | All list screens |
| Slide-up sheets | Quick forms: payment, add party, expense |
| Long press multi-select | Bulk export or delete |
| Voice input on notes | Web Speech API. Offline Android. Free. |
| Sticky confirm button | Always above keyboard. Never buried. |
| PWA install banner | First browser visit. One tap. No APK. |
| Offline indicator | Subtle top bar. Never blocks interaction. |
| Native share sheet | PDF + sync packets. WhatsApp first. |

### V2
| Feature | Detail |
|---|---|
| Camera integration | Scan bill (OCR) or business card via Tauri v2 camera plugin |
| Auto-advance forms | Select option → advance after 300ms |

---

## MODULE 19 — ADAPTIVE DESIGN

### Always On
| Feature | Detail |
|---|---|
| Three device tiers | Mobile < 640px, Tablet 640–1024px, Desktop > 1024px |
| Capability detection | navigator.deviceMemory + hardwareConcurrency + connection + screen size |
| Stored tier | Low / Mid / High saved in config. User can override. |
| Animations off on low-end | Instant transitions. No slideIn, no fadeUp, no count-up. |
| Simple charts on low-end | Canvas bar chart instead of Recharts interactive |
| OCR disabled on low-end | Too slow to process images reliably |
| Manual refresh on low-end | No live RxDB reactive subscriptions — tap to refresh |
| PDF preview skip on low-end | Generate and share directly — no preview step |
| Virtual list always on | All long lists use windowed rendering regardless of device |

### Desktop-only features
| Feature | Detail |
|---|---|
| Full 220px sidebar | Labels + icons |
| Right-panel detail | List stays visible. Detail opens right. |
| Keyboard shortcuts | S = sale, P = payment, E = expense, / = search |
| Bulk select + actions | Multi-row select, bulk export or delete |
| Inline list editing | Click cell → edit → Tab to next. Excel behaviour. |
| Density toggle | Compact / comfortable row height |
| Multi-column reports | Side-by-side month comparison |
| Sortable column headers | Click to sort any table column |

---

## MODULE 20 — PDF GENERATION

### V1 Core
| Feature | Detail |
|---|---|
| Engine | @react-pdf/renderer — JSX, client-side, no server |
| Tax invoice | GSTIN, HSN per line, CGST/SGST, amount in words, GST summary box |
| Simple receipt | Non-GST. Thermal size option (58mm / 80mm). |
| Delivery challan | DC number, vehicle, driver, items, site, signature line |
| Party statement | Opening balance, all transactions, running balance, closing balance |
| Payment receipt | Amount in words, against invoice, mode, reference, balance remaining |
| Sequential numbering | INV-2026-001. No gaps. FY resets. Custom prefix in config. |
| Bundled fonts | Noto Sans + Noto Sans Devanagari. Hindi offline. Never fetched. |
| Indian currency format | ₹1,00,000 lakh format. Auto everywhere. |
| DD/MM/YYYY dates | Throughout all PDFs. |
| PDF blob storage | Every PDF stored in RxDB documents table. Re-printable forever. |
| Version-locked PDFs | Editing transaction does not change old PDFs. |
| UPI QR on invoice | If UPI ID in config → auto-generated QR embedded. qrcode.js, offline. |
| Watermarks | ORIGINAL / DUPLICATE / CANCELLED — auto-applied. |
| Thermal printer | 58mm / 80mm compact template. Print via Tauri native print. |
| Share flow | Generate → Preview (high-end) or skip → Share sheet → WhatsApp as document |

### V1 Plugin — Branded PDF
| Feature | Detail |
|---|---|
| Business logo | Upload once, appears on all documents |
| Letterhead | Custom header with address, phone, GSTIN |
| Custom colour header | Match business brand colour |
| Custom footer | Bank details, T&C, thank you message |
| Template choice | 3 layouts to choose from |

### V2
| Feature | Detail |
|---|---|
| Quotation | QT number, valid until, items + pricing, terms, convert to invoice |
| Purchase order | PO to vendor — items, expected qty, delivery date |
| Email PDF directly | Send from app via email |
| Bulk PDF | Generate invoices for multiple parties at once |
| Digital signature | Owner signature on invoice |

---

## MODULE 21 — DELIVERY CONFIRMATION SYSTEM

### V1 Core — Admin dispatch
| Feature | Detail |
|---|---|
| Multi-stop dispatch | Up to 5 delivery stops per trip, numbered pins on map |
| Destination pinning | Address input + lat/lng + Use my location + reverse geocode |
| Proof requirements | Admin selects: goods photo / receipt photo / vehicle photo / signature — all optional |
| Driver assignment | Shows availability status per driver |
| Trip summary | All stops, driver, pin status shown before dispatch |

### V1 Core — Driver confirmation
| Feature | Detail |
|---|---|
| Live GPS tracking | watchPosition, continuous updates, pulsing blue dot |
| OSRM road routing | Actual road path, not straight line. Free, no API key. |
| Turn-by-turn navigation | Direction icon, street name, distance to next turn, voice callout |
| Geofence arrival | Auto-prompt at 100m from destination. No manual tap needed. |
| Multi-stop progress | Progress bar, stop counter, route resets per stop |
| Photo capture | Camera-only, 3 slots, type-labelled |
| Photo quality validation | Min 5KB, max 15MB, image type only, brightness check |
| Customer signature | Canvas, finger-drawn, brightness validated before accepting |
| Status messages | 6 quick-tap + custom → WhatsApp to admin with GPS |
| Offline indicator | Teal/red bar. Never blocks interaction. |

### V1 Core — Proof
| Feature | Detail |
|---|---|
| Proof card | Photo, GPS, timestamp, driver, signature, address |
| PDF proof certificate | Customisable sections: customer, items, GPS, photos, audit, signature |
| WhatsApp share | Pre-built message with all details + Google Maps link |
| Customer proof link | Base64 URL hash — no server, no hosting required |
| Delivery history | Log, stats (today/week/total), top customers, by driver |

### V1 Core — Offline
| Feature | Detail |
|---|---|
| Offline map tiles | Service Worker caches viewed tiles. Pre-cache button for delivery area. |
| Placeholder tiles | Transparent 1px PNG for uncached areas — no broken tiles |
| GPS offline | Works without internet. Maps are the only internet-dependent part. |

---

## DELIVERY SYSTEM — 10 IMPROVEMENTS — ALL COMPLETE

| # | Improvement | Status |
|---|---|---|
| 1 | OSRM real road routing | ✓ |
| 2 | Geofence arrival detection | ✓ |
| 3 | Multi-stop trips | ✓ |
| 4 | PDF proof certificate | ✓ |
| 5 | Offline map tiles | ✓ |
| 6 | Customer shareable proof link | ✓ |
| 7 | Driver status messages | ✓ |
| 8 | Delivery history + analytics | ✓ |
| 9 | Customer signature capture | ✓ |
| 10 | Photo quality validation | ✓ |

**Total external cost: ₹0**
