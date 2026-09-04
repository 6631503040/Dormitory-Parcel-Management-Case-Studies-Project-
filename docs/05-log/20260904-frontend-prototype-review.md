# Frontend Prototype Review — UX/UI Spike

**Date:** 2026-09-04
**Reviewer:** `frontend-react` agent
**Scope reviewed:** all files under `docs/02-design/pototype/`
**References:** `docs/02-design/design-spec.md` (LOCKED), `docs/02-design/user_journey.md`, `docs/01-requirements/backlog.md`, `CLAUDE.md`, `PROJECT_STRUCTURE.md`

---

## Summary

This is a visually finished prototype of a *different product* than the one the locked design
spec describes. It is a Thai-language, modal-driven "ParcelHub" with two nav destinations,
free-text room entry, no storage-location capture, no design tokens, no i18n layer, and
several out-of-scope features (notification bell, "longest-waiting" panel, damaged-parcel
flag, Line ID).

**It is not a sound base to build the client tier on as-is.** It is valuable as an
*interaction-design reference* for the scan-first check-in flow and the check-out selection
UX. The screen inventory, terminology, data shape, tokens, routing, and language all need to
be rebuilt against `docs/02-design/design-spec.md`.

**Recommendation:** treat it as a throwaway spike — keep the UX learnings, rebuild the four
screens on the locked spec.

Files reviewed (under `docs/02-design/pototype/`):
`index.html`, `package.json`, `vite.config.js`, `postcss.config.js`, `tailwind.config.js`,
`src/styles.css`, `src/main.jsx`, `src/App.jsx`, `src/components/ParcelHubApp.jsx`,
`src/components/ParcelHub.jsx`, `src/components/shared.jsx`, `src/components/TopNav.jsx`,
`src/components/Modals.jsx`, `src/components/DashboardPage.jsx`, `src/components/LoginPage.jsx`,
`src/components/ArchivePage.jsx`.

---

## Critical

### C1. Room Number is a free-text input at check-in
`src/components/Modals.jsx:231` (`<LabeledInput label="เลขห้อง" ... placeholder="เช่น 101/2" />`);
also `src/components/ParcelHub.jsx:662` and the room field in `src/components/TopNav.jsx:27`.

Violates the non-negotiable constraint (CLAUDE.md "Room number is never a free-text field"),
`FR-2`, design-spec §1 (Room Number row: "Always chosen from the directory; never a free-text
input"), and microcopy `errors.roomNotFound`. A `ROOM_DIRECTORY` map exists at
`src/components/shared.jsx:61` but is used only for display labels (`roomLabel`, `shared.jsx:71`),
never for validation or autocomplete.

**Fix:** replace with an autocomplete/combobox bound to the residents directory (hint copy
"Type a resident name or room number", §5). Block submit unless a directory row is selected;
submit `roomId`, not text. Re-validate server-side.

### C2. No storage-location / building assignment anywhere
`CheckInModal` (`src/components/Modals.jsx:159-279`) captures only tracking code + room + a
"damaged" toggle.

Violates `FR-3` and design-spec §3 (Check-In: "Building select (B1–B10 / Common), Storage
Location select, Oversized toggle"). Mis-shelving is one of the core problems the system must fix.

**Fix:** add a Building select (B1–B10 + Common Area) and a Storage Location select to
check-in; add an Oversized toggle that routes to Common Area.

### C3. All user-facing copy is hardcoded Thai; no i18n layer exists
Pervasive, e.g. `src/components/shared.jsx:83` ("รอรับ"), `src/components/Modals.jsx:113`
("สแกนพัสดุออก"), `src/components/DashboardPage.jsx:121` ("ค้นหาเลขห้อง"),
`src/components/LoginPage.jsx:33`.

Violates design-spec §5 "String Storage Convention" (all strings in `src/i18n/en.json`, keyed
by dot-path; backend returns machine `code`s the frontend maps) and §7 Localization ("English
only (v1)"). No `src/i18n/` directory exists.

**Fix:** create `src/i18n/en.json` with the §5 strings, replace every inline literal with a
lookup, switch UI to English using the locked terms.

### C4. Terminology lock broken throughout
- App name "ParcelHub" (`src/components/TopNav.jsx:83`, `LoginPage.jsx:32`) — spec short name is "Parcel Desk" (§1).
- "Archive" as a primary nav destination (`TopNav.jsx:87`) — not one of Dashboard · Check-In · Check-Out · Search · Directory (§3).
- Status values `"in"`/`"out"` (`shared.jsx:26`) instead of `pending`/`picked_up`/`archived` (§4).
- Status chip labels "รอรับ"/"นำออกแล้ว" instead of "Pending"/"Picked Up".
- Field `code` instead of Tracking Code; `receivedAt`/`exitedAt` instead of checked-in/checked-out.
- "Administrator" shown as the user (`TopNav.jsx:97`) — "admin" is a role value, never copy (§1 Staff row).

**Fix:** rename every concept to the §1 locked term in code, state, and UI.

### C5. Design tokens are not implemented; hardcoded hex and inline font sizes are pervasive
`tailwind.config.js:8` `theme.extend` is empty. Two conflicting palettes:
`src/components/shared.jsx:4-20` (`primary #4285F4`) vs the dead `src/components/ParcelHub.jsx:18-34`
(`primary #EA6C3D`, orange). Neither matches spec `primary #1A73E8` (§2). `warning` is set to
`#D93025` (`shared.jsx:18`), which is actually the spec's `error` value. Inline font size
`fontSize: 12.5` (`shared.jsx:148`). `src/styles.css:12` hardcodes `"DM Sans"` +
`background: #fffdf8`. `src/components/LoginPage.jsx:25-26,51` hardcode `#FBBC04`, `#34A853`, `#D64545`.

Violates design-spec §2 ("All colors MUST be referenced via theme tokens… Zero hardcoded hex",
"Zero inline font sizes") and CLAUDE.md Conventions.

**Fix:** map the §2 color, typography, spacing, radius, and shadow tokens into
`tailwind.config.js` `theme.extend` (as CSS custom properties) and use `bg-primary`,
`text-bodyLarge`, etc. Delete the `C` object and inline `style={{ color: ... }}`.

---

## High

### H1. No dedicated Check-In / Check-Out / Search / Directory screens, and no routing
Navigation is `useState("dashboard" | "archive")` (`src/components/ParcelHubApp.jsx:14`,
`TopNav.jsx:86-87`). Check-in and check-out are modals opened from Dashboard buttons
(`src/components/DashboardPage.jsx:109-116`). No `react-router` in `package.json:11-15`.

Violates design-spec §3 (8 routes, top-nav with five primary destinations mirroring
spreadsheet tabs) and Objective 3 (staff expect tab-like destinations, not dialogs).

**Fix:** add the five nav destinations; make Check-In and Check-Out full pages, each with its
own running/pending list; add Search, Directory, and Parcel Detail pages; add `react-router`.

### H2. Check-Out forces a confirm step on every check-out, including single items
`src/components/Modals.jsx:86-110` gates completion behind a `confirming` screen reached from
the "ดำเนินการต่อ" button (`Modals.jsx:152`).

Violates CLAUDE.md ("Don't add friction — extra confirm dialogs, multi-step modals — to
check-in/check-out") and design-spec §3 flow (confirm dialog only for "Check Out All";
"Check Out Selected" → straight to success toast).

**Fix:** remove the confirm step for selected/single check-out; keep one confirm dialog only
for Check Out All, using the §5 confirm copy.

### H3. "Check Out All" and "Check Out Selected" are not both visible at once
`src/components/Modals.jsx` exposes a single "Continue" button (`:152`) plus a small
"select all found" text link (`:127-131`).

Violates design-spec §3 (Check-Out key components: "Check Out All button, Check Out Selected
button") and §5 CTAs (primary "Check Out All"; outlined "Check Out Selected", disabled until
≥1 row checked). CLAUDE.md: "Both paths always available."

**Fix:** render both buttons side by side on the Check-Out screen at all times.

### H4. Search & Lookup assumes instant local filtering — no loading/pending states, no pagination
`src/components/DashboardPage.jsx:96-103`, `src/components/ArchivePage.jsx:41-48`, and
`src/components/Modals.jsx:42-46` all do synchronous `array.filter`.

Violates `NFR-1`/`NFR-2`, design-spec §3 (Search: "pagination"), §5 (`loading.search` =
"Searching…"), and CLAUDE.md ("avoid UI patterns that assume instant single-record responses;
add loading/pending states, paginate long result lists").

**Fix:** build Search against the paginated API with explicit pending / empty / error states
and a paged result table.

### H5. Dashboard does not meet FR-8
`src/components/DashboardPage.jsx:92-140` shows two action buttons, a room search box, a
table, and an out-of-scope "BottleneckPanel". There are no counts and no date selector.

Violates `FR-8` and design-spec §3 (Dashboard = "Date selector (defaults today), 3 stat cards
(Checked In / Picked Up / Pending), recent check-ins table").

**Fix:** replace with the three stat cards + date selector + recent check-ins table.

### H6. No audit-trail / Parcel History UI, and no staff attribution in the data
Parcel objects (`src/components/shared.jsx:26`) carry no `checkedInBy` / `checkedOutBy` /
events; there is no Parcel Detail screen.

Violates `FR-12`, `NFR-6` (rule.md — Computer Crime Act §26), and design-spec §3 (Parcel
Detail: "Parcel History timeline (staff + timestamp per event)").

**Fix:** add a Parcel Detail screen with a history timeline; ensure check-in/out calls carry
staff identity (server sets it) and that history is shown.

### H7. Web fonts fetched from Google CDN at runtime
`src/components/shared.jsx:236-245` injects a `<link>` to `fonts.googleapis.com`;
`src/styles.css:12` sets `font-family: "DM Sans"`. The dead `ParcelHub.jsx:37-47` loads Sora/Inter.

Violates design-spec §2 ("No custom web fonts (load speed + familiar system look)") and §7
(no external runtime dependency).

**Fix:** use the §2 system sans/mono stacks; delete `useFonts` and the `styles.css` font line.

### H8. No API/data layer; response shapes not coordinated with backend-go
All data is an in-memory mock (`src/components/shared.jsx:25`, `INITIAL_PARCELS`); there is no
`fetch` boundary anywhere.

Acceptable for a pure design mock, but CLAUDE.md requires coordinating API contracts with
backend-go rather than guessing shapes.

**Fix:** add a thin `src/api/` client that returns the spec's camelCase shapes (§4); agree the
check-in, check-out, search, and dashboard contracts with backend-go before wiring screens.

---

## Medium

### M1. Out-of-scope features present
- NotificationBell "parcels needing info confirmation" (`src/components/TopNav.jsx:37-72`)
- BottleneckPanel aging list (`src/components/shared.jsx:175-233`, used at `DashboardPage.jsx:136`)
- "damaged / ชำรุด" flag + free-text reason (`src/components/Modals.jsx:239-250`)
- "Line ID" field (`shared.jsx:26` `line`, editable at `TopNav.jsx:28`)
- per-parcel `qty` (`shared.jsx:26`, table column `shared.jsx:147`)

None are in the four locked features (CLAUDE.md Scope). "Line ID" is resident PII not in the
minimal data model — PDPA minimisation concern (`NFR-7`, rule.md). `qty` contradicts the data
model (`parcels.tracking_code` UNIQUE, one row per parcel, §4). "damaged" reinvents the spec's
`note` + "No room number" `warning` badge pattern (§5).

**Fix:** remove these; send any genuine need to the backlog scope-creep parking lot for
advisor review. For "no room number on the box", use `parcels.note` plus the `warning` "No
room number" badge (§5).

### M2. Modals are not accessible dialogs
`ModalShell` (`src/components/Modals.jsx:5-23`): no `role="dialog"`, no `aria-modal`, no focus
trap, no Escape-to-close, no focus restoration, title not linked via `aria-labelledby`.

Violates design-spec §8.4 (keyboard navigation).

**Fix:** implement a proper dialog (focus trap, Esc to close, `aria-labelledby`, return focus
to trigger) — within the locked stack.

### M3. Focus styles removed globally with no replacement
`outline-none` on nearly every input: `src/components/Modals.jsx:29`, `LoginPage.jsx:41,48`,
`DashboardPage.jsx:125`, `shared.jsx:125`, `TopNav.jsx:27`.

Violates §8.4 (keyboard navigation) and the §2 `primary` token's stated "focus ring" role.

**Fix:** add a visible `focus-visible` ring using the primary token; never strip `outline`
without a replacement.

### M4. Selection controls are non-semantic
Check-out row "checkboxes" and the damaged toggle are `<button>` + `<div>` with no
`role="checkbox"` / `aria-checked`: `src/components/Modals.jsx:136-148` and `Modals.jsx:239-244`.

Violates §8.4 and §3 (Check-Out "row checkboxes").

**Fix:** use real styled `<input type="checkbox">` or add correct ARIA state.

### M5. Icon-only buttons lack accessible names
Close "X" buttons at `src/components/Modals.jsx:15`, `shared.jsx:105`, `TopNav.jsx:58` have no
`aria-label`.

**Fix:** add `aria-label` from i18n.

### M6. Contrast risks
Colored text at `opacity: 0.75` on a tinted background in `SearchStatusBadge`
(`src/components/DashboardPage.jsx:26`); `textMuted` `#697586` used for 12px `labelSmall`-scale
text (`shared.jsx:5`, e.g. `shared.jsx:148`); dead file uses `#7A8091` (~4:1). Several inputs
rely on placeholder text for guidance.

Violates §8.4 (sufficient contrast).

**Fix:** use `neutral500 #5F6368` from tokens, remove opacity on text, verify ≥4.5:1, and use
real labels rather than placeholder-only.

### M7. Dead duplicate file `src/components/ParcelHub.jsx` (985 lines)
Unreferenced — `src/App.jsx:1` imports `ParcelHubApp`; `grep` finds no importer. It carries a
conflicting orange palette and different fonts from the live `shared.jsx`.

Maintenance hazard and a source of confusion for anyone building on this.

**Fix:** delete it; keep the split `components/` files.

### M8. Aesthetic drift from the "spreadsheet-like" mandate
Decorative dot-grid page background with gradient mask (`src/styles.css:17-26`); rotated
colored pill shapes on login (`src/components/LoginPage.jsx:25-26`); pill-shaped nav items
`rounded-full` (`TopNav.jsx:7`); `rounded-2xl`/`rounded-3xl` cards and oversized padding/type
(`px-7 py-4`, `text-2xl` search input at `DashboardPage.jsx:125`).

Violates design-spec §2 ("Dense, light, table-first, low-chrome"; radii cap at 16px for
modals, 8px for cards/buttons/inputs) and `NFR-3` / Objective 3 / User Adoption Risk.

**Fix:** flat, dense, table-first layout; radii per §2; remove decorative backgrounds and shapes.

---

## Low

- **L1. Toast/banner issues.** `src/components/ParcelHubApp.jsx:19-22` sets a `setTimeout` with
  no cleanup on unmount; `src/components/shared.jsx:96-110` `Banner` has no `role="status"` /
  `aria-live="polite"`. Fix: `useEffect` + `clearTimeout`; add a live region.
- **L2. Stale-closure effect in CheckOutModal.** `src/components/Modals.jsx:64-76` effect
  depends on `[scan]` but reads `pending`; the dead twin kept an `eslint-disable` for the same
  reason (`ParcelHub.jsx:497`). Fix: correct the deps or move scan-match handling into the
  keydown handler.
- **L3. Login ignores the entered username.** `src/components/ParcelHubApp.jsx:69`
  `onLogin={() => setAuthed(true)}` discards `onLogin(username.trim())` from `LoginPage.jsx:16`.
  No session/RBAC scaffold. Fix: pass the username through; stub a session object for later
  RBAC wiring (enforced server-side per CLAUDE.md).
- **L4. `autoFocus` passed as a prop on every render** via `LabeledInput`
  (`src/components/Modals.jsx:25-32`, used at `Modals.jsx:231`), plus multiple competing
  `autoFocus` inputs. React only honors it on mount. Fix: use a ref + `.focus()` on the
  intended field.
- **L5. Icon choices don't match §6.** Check-Out modal uses `ScanLine`
  (`src/components/Modals.jsx:113`); §6 assigns `scan-line` to Check-In and `package-check` to
  Check-Out. Align when building the real screens.
- **L6. Thai Buddhist-era date formatting.** `formatThaiDateTime` adds `+543` and uses Thai
  month abbreviations (`src/components/shared.jsx:37-41`). Spec: store UTC, display
  Asia/Bangkok, English, ISO-derived (§7). Fix: format in English with the Asia/Bangkok timezone.
- **L7. Tailwind default type scale used instead of token names.** `text-lg`, `text-xl`,
  `text-2xl` throughout. Once §2 typography tokens are mapped (`text-bodyLarge`,
  `text-headlineMedium`, …), switch to those.

---

## What's good / keep

- **Stack is correct and minimal.** `package.json` has only `react`, `react-dom`,
  `lucide-react` + Vite/Tailwind tooling — no stray libraries. Matches design-spec §7 and CLAUDE.md.
- **State management is appropriately simple.** Parcel state lifted to the root with plain
  `useState` + prop drilling (`src/components/ParcelHubApp.jsx`). Not over-engineered — right
  instinct for a staff ops tool.
- **Low-typing intent is present and worth carrying over.** Barcode-scan-first fields,
  Enter-to-add, continuous scanning without a per-item button (`Modals.jsx:203-205`), and
  "scan selects the matching row" in check-out (`Modals.jsx:64-84`).
- **Check-out already has the right raw ingredients:** individual row selection, a "select all
  found" bulk action, and narrowing by room (`Modals.jsx:42-46, 55-62, 136-149`). It just
  needs the spec's always-visible two-button layout and less confirm friction.
- **Duplicate-tracking-code guard at check-in** (`Modals.jsx:167-173`) checks both the pending
  batch and existing records — aligns with the §5 "duplicate tracking code" error.
- **`prefers-reduced-motion` is respected** for the fade animation (`ParcelHubApp.jsx:74-78`).
- **Empty states exist for every list** (`ParcelTable` `shared.jsx:131-139`, check-out list
  `Modals.jsx:135`, notifications).
- **`roomLabel` resolving room → resident name for display** (`shared.jsx:71-76`) is the right
  idea; it just needs to be fed by the directory API instead of a hardcoded map.
- **The split `components/` layout** (`TopNav`, `DashboardPage`, `Modals`, `shared`,
  `LoginPage`, `ArchivePage`) is a reasonable structure to keep once the dead `ParcelHub.jsx`
  monolith is deleted.
