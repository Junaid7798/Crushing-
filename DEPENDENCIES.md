# DEPENDENCIES.md — Every Package In This Project
# Install ALL Phase 1 dependencies on day one.
# Never install a Phase 2+ dependency until you reach that phase.
# Versions are locked — do not upgrade without testing encryption + RxDB.

---

## INSTALL ORDER

### Day One — Install Everything (prevents version conflicts later)

```bash
cd business-os
npm install
```

The `package.json` already has everything. This section explains WHY each exists
and what will break if you upgrade it without care.

---

## CORE RUNTIME DEPENDENCIES

### react @ ^18.3.1
**Why:** UI framework. Hooks-based. No class components in this project.
**Gotcha:** RxDB reactive queries integrate with React through custom hooks (useRxQuery).
If you upgrade React to 19, test all hooks carefully — concurrent mode changes may affect subscription cleanup.
**Scope for improvement:** React 19 adds better async handling — migrate in V2 when stable.

### react-dom @ ^18.3.1
**Why:** Renders React to the DOM. Always matches react version exactly.

### react-router-dom @ ^6.24.0
**Why:** Client-side routing. Screens are lazy-loaded routes.
**Key routes:** `/` (dashboard), `/transaction`, `/party/:id`, `/items`, `/reports`, `/leads`, `/settings`, `/delivery`, `/production`, `/conflicts`
**Gotcha:** App.jsx uses React.lazy() for all screens. If you add a new screen, add it to App.jsx with lazy() first. Never import screens directly at the top level.

---

## DATABASE

### rxdb @ ^15.25.0
**Why:** Reactive database over IndexedDB. Built-in conflict handling, reactive queries, replication protocol.
**CRITICAL — do not upgrade without reading:** RxDB v15 uses a different storage adapter API than v14. The schema.js file is written for v15. Upgrading to v16+ will break storage initialization.
**Gotcha 1:** All indexed string fields MUST have `maxLength` in the schema. Without it, RxDB throws a cryptic error on initialization.
**Gotcha 2:** `multiInstance: false` in createRxDatabase is intentional. We use manual sync packets, not RxDB's built-in replication.
**Gotcha 3:** Composite primary key in `daily_summary` uses the syntax `{ key: 'id', fields: ['date', 'business_id'], separator: '|' }`. This is v15-specific.
**Scope for improvement:** RxDB Premium (rxdb-premium) unlocks faster storage adapters. Already in package.json — wire it up in V2.

### rxdb-premium @ ^15.25.0
**Why:** Premium storage adapters for faster performance on mobile. Currently not wired — added for future use.
**How to activate (V2):** Replace `getRxStorageDexie()` with `getRxStorageIndexedDB()` from rxdb-premium. Requires a license key.

---

## ENCRYPTION

### PBKDF2-SHA256 (Web Crypto API — no package needed)
**Why:** Native browser key derivation. No WASM, no external dependencies. OWASP 2023 recommended.
**Parameters:** 600,000 iterations, SHA-256, 32-byte output (AES-256 key material).
**Usage:** `deriveKey()` for encryption key, `hashPin()` / `verifyPin()` for PIN auth.
**No config needed:** Runs entirely on `crypto.subtle` — available in all modern browsers and Tauri.

---

## PDF GENERATION

### @react-pdf/renderer @ ^3.4.4
**Why:** Generates PDFs client-side using JSX. No server required.
**How it works:** Define PDF layout using `<Document>`, `<Page>`, `<View>`, `<Text>` components from this library. Call `pdf(<MyDocument />).toBlob()` to get a PDF Blob.
**Gotcha 1:** Normal HTML/CSS does not work inside react-pdf components. It has its own styling system using `StyleSheet.create()`.
**Gotcha 2:** Fonts must be registered before use. Noto Sans and Noto Devanagari must be bundled as static assets and registered with `Font.register()`.
**Gotcha 3:** PDF generation can be slow (1-3 seconds for complex invoices). Run it in a Web Worker for production. For now, run on main thread with a loading state.
**Scope for improvement:** PDF generation Web Worker (V2 — leave TODO in PDF generation code).

---

## MAPS + ROUTING

### leaflet @ ^1.9.4
**Why:** Offline-capable map rendering. Used for delivery tracking.
**Gotcha:** Leaflet requires its CSS to be imported: `import 'leaflet/dist/leaflet.css'`. Without this, the map renders with broken tile positioning.
**Gotcha 2:** Leaflet marker icons break in Vite. Fix:
```js
import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })
```
Add this fix once in the delivery screen file.

### react-leaflet @ ^4.2.1
**Why:** React wrapper for Leaflet. Use `<MapContainer>`, `<TileLayer>`, `<Marker>`, `<Polyline>`.
**Scope for improvement:** OSRM routing is currently called directly. In V2, abstract into a `useRouting()` hook.

---

## UTILITIES

### qrcode @ ^1.5.4
**Why:** Generates UPI QR codes for invoices. Runs entirely offline.
**How to use:**
```js
import QRCode from 'qrcode'
const qrDataUrl = await QRCode.toDataURL('upi://pay?pa=name@upi&pn=BusinessName')
// Embed qrDataUrl as <img src={qrDataUrl} /> or in react-pdf as <Image src={qrDataUrl} />
```

### date-fns @ ^3.6.0
**Why:** Date manipulation without heavy moment.js.
**Key functions used:** `format`, `parseISO`, `differenceInDays`, `startOfMonth`, `endOfMonth`, `eachDayOfInterval`.
**Scope for improvement:** date-fns supports locale — add Hindi locale for V2.

### uuid @ ^10.0.0
**Why:** UUID generation. Already available via `crypto.randomUUID()` in the helpers.js `uuid()` wrapper. This package is a fallback for environments where `crypto.randomUUID` is not available.
**Note:** In practice, `crypto.randomUUID()` works in all Tauri v2 targets. This package may be removable in V2.

---

## DEV DEPENDENCIES

### vite @ ^5.3.4
**Why:** Build tool. Fast HMR in dev. Code splitting for production.
**Key config already set:**
- `server.port: 1420, strictPort: true` — Tauri expects this exact port
- `build.target: ['es2022', 'chrome100', 'safari15']` — modern targets for Tauri v2
**Scope for improvement:** Add bundle analyzer in V2 to identify code splitting opportunities.

### @vitejs/plugin-react @ ^4.3.1
**Why:** Enables React JSX transform and Fast Refresh in Vite.

### @tauri-apps/cli @ ^2.0.0
**Why:** Tauri v2 build tooling. Used to compile to .exe, .dmg, .apk, .ipa.
**Note:** Tauri Rust backend is not set up yet — this is the next major step after the React app is complete.
**Scope for improvement:** Tauri plugins needed in V2: camera (for OCR scanning), biometric (WebAuthn on mobile), push notifications (for reminders).

---

## EXTERNAL SERVICES (ALL FREE, NO API KEY)

These are called at runtime but are NOT npm packages:

| Service | URL | Used for | Offline fallback |
|---|---|---|---|
| OpenStreetMap tiles | `tile.openstreetmap.org` | Map display | Cached by map-sw.js |
| Nominatim | `nominatim.openstreetmap.org` | Reverse geocoding (address from GPS) | Manual address input |
| OSRM | `router.project-osrm.org` | Road routing (delivery paths) | Straight-line distance |
| WhatsApp | `wa.me/{phone}?text={msg}` | Share proofs, send reminders | Copy to clipboard |

**Important:** The app works 100% offline. These services enhance features but are never required.
If any service fails, the feature degrades gracefully (manual input, no routing, no map tiles in uncached areas).

---

## DEPENDENCY RISK REGISTER

These are the packages most likely to cause problems:

| Package | Risk | Mitigation |
|---|---|---|
| rxdb | Major version upgrades break storage API | Lock to 15.x, test in isolation before upgrading |
| @react-pdf/renderer | Font rendering inconsistent across platforms | Test PDF output on Android + iOS before release |
| leaflet | Icon bug in Vite (known issue) | Fix documented above — apply once, do not change |

---

## ADDING A NEW DEPENDENCY — CHECKLIST

Before `npm install {package}`:
1. Can this be done with a native Web API instead? (Prefer native)
2. Does it work offline? (Mandatory)
3. Does it work in Tauri's WebView (not full Chrome)? (Test on Android WebView)
4. Is the bundle size acceptable? (Check with `npm ls {package}` first)
5. Does it conflict with RxDB's RxJS dependency? (RxDB uses RxJS internally)
6. Add it to this file with why/gotchas before committing.

---

*Package versions are locked to what is tested and working.*
*Do not run `npm update` without a deliberate decision to do so.*
