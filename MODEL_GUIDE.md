# MODEL_GUIDE.md — Which Model To Use and When
# Check this file before starting a session that involves complex logic.
# The wrong model choice wastes context or produces shallow output.

---

## QUICK DECISION RULE

**Default to Sonnet 4.6** for most sessions.
**Switch to Opus 4.6** only when the task fits the criteria below.

---

## SONNET 4.6 — USE FOR

**Model string:** `claude-sonnet-4-6`

Use Sonnet for these task types:

| Task type | Why Sonnet is right |
|---|---|
| Wiring a screen to RxDB (following an existing pattern) | Pattern is established — execution task |
| Writing CRUD operations using helpers.js wrappers | Straightforward application of existing functions |
| Building a form with validation | Standard UI work |
| Styling components with CSS variables | Design-to-code translation |
| Writing one-shot RxDB queries | Low complexity |
| Debugging a specific error message | Targeted, scoped problem |
| Updating PROGRESS_TRACKER.md | Documentation task |
| Building any Phase 1-4 chunks | Well-defined scope |
| Generating test data / seed data | Mechanical task |

**How to prompt Sonnet effectively:**
- Be specific about which file to edit and what function to write
- Reference the pattern: "Follow CODING_PATTERNS.md Pattern 3"
- Give the RxDB schema field names explicitly — do not make Sonnet guess them
- One chunk at a time — never ask for two chunks in one prompt

---

## OPUS 4.6 — USE FOR

**Model string:** `claude-opus-4-6`

Switch to Opus when the task requires deep reasoning, not just execution:

| Task type | Why Opus is needed |
|---|---|
| Designing the sync conflict resolution algorithm | Multi-step logic, edge cases |
| Architecting the PDF generation system (invoice + delivery proof) | Complex layout logic + @react-pdf quirks |
| Building the offline map tile + OSRM routing integration | Multiple APIs, fallback chains, Service Worker interaction |
| Production run save sequence (BOM deduction + stock addition) | Order-dependent multi-table operation with rollback logic |
| GST calculation logic (CGST/SGST/IGST split across line items) | Financial calculation correctness is critical |
| Designing the Web Worker for CSV export or PDF generation | Worker communication patterns + data serialization |
| Building the encrypted backup/restore flow | Security-sensitive, multi-step, must be correct |
| Any task that requires reasoning about the security model | Encryption is never wrong — Opus for crypto-adjacent work |
| Writing the data import column mapper (V2) | Schema inference + fuzzy matching |
| Debugging a subtle RxDB subscription memory leak | Root cause analysis |

**How to prompt Opus effectively:**
- Start with: "This is a complex task. Think through the approach before writing code."
- Provide the full context: which tables are involved, what the sequence must be, what the failure modes are
- Ask for the reasoning first: "Explain your approach, then write the code"
- Opus can handle longer prompts — give it more context, not less

---

## VERSION TRACKING TABLE

Every time a significant file is modified, log it here.
This tells you exactly which version of a file works with which model output.

| File | Version | Modified | Model used | Notes |
|---|---|---|---|---|
| schema.js | 1.0 | 23 Mar 2026 | Sonnet 4.6 | Migrated from Dexie to RxDB v15. Added leads + locations tables. |
| helpers.js | 1.0 | 23 Mar 2026 | Sonnet 4.6 | Migrated PBKDF2 to Argon2id. Fixed all RxDB query syntax. |
| AuthContext.jsx | 1.0 | 23 Mar 2026 | Sonnet 4.6 | PIN login, auto-lock, lockout wired to real verifyPin(). |
| OnboardingScreen.jsx | 1.0 | 23 Mar 2026 | Sonnet 4.6 | 4-step wizard writing to RxDB. |
| LockScreen.jsx | 1.0 | 23 Mar 2026 | Sonnet 4.6 | PIN entry wired to AuthContext.login(). |

*Add new rows here every time a file is created or significantly changed.*
*"Significantly changed" means: new function added, query changed, logic changed.*
*Formatting/styling changes do not need a version bump.*

---

## MODEL SWITCHING PROTOCOL

When switching from Sonnet to Opus mid-project:

1. Complete the current chunk fully before switching. Do not switch mid-chunk.
2. Start the Opus session with: "Load CLAUDE.md. We are switching to Opus for [reason]."
3. After the Opus task is complete, switch back to Sonnet for the next execution task.
4. Log in VERSION TRACKING TABLE: which files Opus touched and why.

When switching back from Opus to Sonnet:

1. Ensure Opus output is committed (saved, tested).
2. Start the Sonnet session with: "Load CLAUDE.md. Opus completed [task]. Continuing with Sonnet."
3. Sonnet picks up execution from the next chunk in BUILD_PHASES.md.

---

## IF YOU ARE UNSURE WHICH MODEL TO USE

Answer these questions:
1. Is the logic for this task already defined in CODING_PATTERNS.md? → Sonnet
2. Does this task involve financial calculations, encryption, or sync logic? → Opus
3. Could this task break data integrity if done wrong? → Opus
4. Is this "write code that follows the pattern" or "figure out the right pattern"? → Sonnet / Opus

When genuinely unsure, use Opus. The cost difference is worth the correctness.

---

## CONTEXT WINDOW MANAGEMENT

**Sonnet context:** ~200K tokens. Comfortable for one chunk at a time.
**Opus context:** ~200K tokens. Use for complex single-task sessions only.

When context is running low (Claude warns you), immediately:
1. Update PROGRESS_TRACKER.md with exactly where you stopped
2. Note any decisions made in this session
3. Note the next exact step to resume from
4. Start a new session with a fresh context

**Do NOT try to finish a complex task when context is low.**
Partial work with wrong decisions is worse than stopping cleanly.

---

*Update the Version Tracking Table every session.*
*It is the single source of truth for what version of each file is current.*
