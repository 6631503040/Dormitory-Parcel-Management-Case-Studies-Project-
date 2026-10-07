# Frontend audit — 5 October 2026

## Implementation integrity verdict: FAIL

The active frontend has a consistent parcel-counter visual system, but two verified behaviors undermine its product meaning: any nonempty room is accepted at Check-In, and confirming a LINE match clears physical damage information. These need correction before the demo becomes an operational frontend.

This is an audit of `prototype/src/App.jsx → ParcelHubApp.jsx`, including Dashboard, Archive, navigation, and dialogs. Login was inspected in source. No frontend code was changed and no parcel transaction was saved during testing. Existing product/design documents are evidence for intended scope, not new instructions or proof of implementation.

## Audit health score

| Dimension | Score | Key finding |
|---|---:|---|
| Accessibility | 1/4 | Removed input focus, disconnected labels, incomplete dialog semantics |
| Performance | 3/4 | Small production bundle; rendering/storage scale remains untested |
| Responsive design | 2/4 | Breakpoints exist; short viewports clip dialogs and several controls are small |
| Theming | 3/4 | Shared palette mostly used; a few literals and no switchable theme |
| Implementation integrity | 1/4 | Room validation and damage/LINE state conflate distinct product concepts |
| **Total** | **10/20** | **Acceptable — significant work needed** |

These are rubric-based audit judgments, not WCAG certification or measured production performance. A light-only interface is not itself a defect; dark mode is not an established requirement.

**14 findings: P0 0 · P1 8 · P2 6 · P3 0.** No universal task blocker was demonstrated. The short-viewport problem has a workaround by restoring a taller viewport, so it is P1 rather than P0.

## Evidence and limits

- Reviewed the supplied desktop screenshot against the active React implementation.
- Inspected the running localhost page through the Codex in-app browser, including search and Check-In. Search for `101/2` returned the expected sample parcel.
- Entered unsaved room `9999` and tracking code `AUDIT-UNSAVED-001`: the Save button became enabled. Escape did not dismiss the dialog. Closed the draft afterward.
- Emulated browser viewports at 390×844, 390×600, and 390×480. With the damage-reason field expanded, the dialog measured 578px tall; at 480px height its top was −49px and bottom 529px. These are viewport/layout checks, not physical-device or synthesized-touch tests. Software keyboard, text scaling, and touch gestures remain untested.
- `npm run build --prefix docs/02-design/prototype` passed. Output: JS 179.40kB / 55.77kB gzip; CSS 13.42kB / 3.55kB gzip. This does not measure LCP, INP, layout shift, or high-volume behavior.
- Bundled Impeccable detector returned two font warnings. The Inter warning belongs to inactive `ParcelHub.jsx`, so it does not apply to this rendered page. Space Grotesk is part of the recorded incumbent design; its popularity is not a technical failure. Neither warning is counted in the findings.
- Contrast ratios below were calculated from the actual sRGB palette values using WCAG relative luminance.

## P1 — fix before release

### 1. Room validation can be bypassed

**Location:** `prototype/src/components/Modals.jsx:143`, `:207`; `ParcelHubApp.jsx:92`.
**Category:** Implementation integrity.

`canAdd` checks only nonempty strings. Room `9999`, absent from `ROOM_DIRECTORY`, enables Save. This permits records against nonexistent rooms and defeats identification safeguards. Use directory-backed room selection, block unresolved values, and revalidate at the API boundary when that exists. The locked spec explicitly requires this behavior. **Suggested command:** `$impeccable harden`.

### 2. LINE confirmation erases damage status and reason

**Location:** `TopNav.jsx:14`, `:42`; `ParcelHubApp.jsx:115`.
**Category:** Implementation integrity.

Notifications treat damaged parcels with LINE IDs as identity mismatches. The confirmation handler sets `damaged: false` and `damageReason: ""` without checking the kind of problem. Thus a physically damaged parcel can lose its warning through an unrelated identity confirmation. Separate physical damage from identity/notification state, preserve history, and show only the appropriate confirmation action. This is source-confirmed; the audit did not execute this mutation. **Suggested command:** `$impeccable harden`.

### 3. Inputs have no visible focus treatment

**Location:** `DashboardPage.jsx:96`; `shared.jsx:125`; `Modals.jsx:29`, `:90`, `:221`; `LoginPage.jsx:41`, `:48`.
**Category:** Accessibility — WCAG 2.4.7.

Repeated `outline-none` removes the input indicator without a replacement. The Dashboard border changes with query content, not focus, so an empty focused field gives no equivalent feedback. Staff using Tab or scanners cannot reliably see the active field. Add consistent `:focus-visible` and wrapper `:focus-within` states. **Suggested command:** `$impeccable harden`.

### 4. Form labels and icon-only controls lack accessible associations/names

**Location:** `Modals.jsx:25`, `:87`, `:221`; `LoginPage.jsx:38`; `DashboardPage.jsx:92`; `TopNav.jsx:61`, `:102`; `shared.jsx:105`.
**Category:** Accessibility — WCAG 1.3.1 / 4.1.2.

Visible labels sit beside inputs without `htmlFor`/`id` or label wrapping. Search and damage-reason fields rely on placeholders. Close/remove buttons have no accessible name; mobile hides the logout text and leaves that control unnamed. Associate persistent labels and add precise names to icon-only actions. Use contextual names when removing a parcel draft. **Suggested command:** `$impeccable harden`.

### 5. Dialog semantics and keyboard lifecycle are incomplete

**Location:** `Modals.jsx:5–22`.
**Category:** Accessibility — WCAG 1.3.1 / 2.4.3 / 4.1.2; WAI-ARIA modal-dialog pattern.

The shell lacks a dialog role, accessible title association, modal state, focus containment/restoration, and Escape handling. Autofocus alone does not stop Tab from reaching background controls. Escape was exercised and the dialog remained open. Use a native dialog or tested accessible dialog primitive and restore focus to its opener. **Suggested command:** `$impeccable harden`.

### 6. Small colored text fails contrast requirements

**Location:** `shared.jsx:11`, `:115`; `TopNav.jsx:7`, `:33`; `LoginPage.jsx:52`; `ArchivePage.jsx:16`; `DashboardPage.jsx:50`.
**Category:** Accessibility — WCAG 1.4.3.

White on primary blue `#4285F4` is **3.56:1**, below the 4.5:1 threshold for normal text used by navigation and modal/login buttons. Blue eyebrow text on `#FFFDF8` is **3.51:1**. Warning red on warning-light is **4.05:1**, also insufficient for small warning copy. Choose darker foreground/button tokens for these roles. The large bold Dashboard action label is not counted as a failing normal-text case. **Suggested command:** `$impeccable colorize`.

### 7. Short viewports clip dialog controls

**Location:** `Modals.jsx:7–19`.
**Category:** Responsive design.

The fixed centered shell has no viewport-based max height or scrollable overall content. With the damage field expanded at 390×480, the title/close region and bottom action extend outside the viewport. This is especially relevant to reduced available height; a real software keyboard was not tested. Constrain height using dynamic viewport units and make the content scroll while keeping essential controls reachable. **Suggested command:** `$impeccable adapt`.

### 8. Check-Out can retain invisible selections across searches

**Location:** `Modals.jsx:41–60`, `:108`, `:130`.
**Category:** Implementation integrity.

Selections persist independently of the filtered list. Selecting one room, searching another, then selecting all matches can confirm parcels from both rooms although only the current matches are visible. The count alone does not identify recipients. Preserve scanner batch support if desired, but show a persistent selected-parcel/recipient summary and confirm exactly those items. This risk is source-confirmed, not transaction-tested. **Suggested command:** `$impeccable harden`.

## P2 — next pass

### 9. Displayed resident names and name search use different data

**Location:** `ParcelHubApp.jsx:98`; `shared.jsx:71`; `DashboardPage.jsx:72`; `ArchivePage.jsx:44`; `Modals.jsx:43`.
**Category:** Implementation integrity.

New parcels store `name: "-"`, while `roomLabel` displays a directory-derived resident name. Name search examines `p.name`, so staff may see a name that cannot find the newly checked-in parcel. Resolve the same directory data for display and search. **Suggested command:** `$impeccable harden`.

### 10. Counts mix parcel rows with physical quantities

**Location:** `DashboardPage.jsx:98`; `Modals.jsx:130`; `ParcelHubApp.jsx:88`; `shared.jsx:28`.
**Category:** Implementation integrity.

Sample room `203/1` has `qty: 2`, but search status counts its row as one “ชิ้น.” Check-Out counts selected rows in the same way. Define whether one record always represents one parcel; enforce that invariant or sum quantities wherever copy says pieces. Distinguish record counts from piece counts. **Suggested command:** `$impeccable clarify`.

### 11. Dynamic states and language are not exposed consistently

**Location:** `shared.jsx:96`; `DashboardPage.jsx:24`; `TopNav.jsx:7`, `:46`; `ArchivePage.jsx:18`; `Modals.jsx:114`, `:212`; `prototype/index.html:2`.
**Category:** Accessibility — WCAG 3.1.1 / 4.1.2 / 4.1.3.

Success banners/search feedback lack live-region semantics; active navigation, filters, and custom selection controls lack programmatic states. Current Thai-dominant content is declared `lang="en"`, which can cause incorrect screen-reader pronunciation. Expose current/expanded/selected states, use native checkboxes where suitable, announce meaningful status updates, and align document language with actual content. The language decision should respect the project's confirmed scope. **Suggested command:** `$impeccable harden`.

### 12. Several touch targets are small

**Location:** `shared.jsx:161`; `Modals.jsx:15`, `:238`; `TopNav.jsx:61`.
**Category:** Responsive design.

Measured mobile damage badge: approximately **33×28px**; modal close: **26×26px**. These are below the audit's 44×44px touch recommendation and easy to miss in busy counter use. Increase hit areas without enlarging the visual icon unnecessarily. Below 44px does not automatically mean WCAG 2.5.8 failure, whose minimum and spacing exceptions differ. **Suggested command:** `$impeccable adapt`.

### 13. Time display depends on the device timezone

**Location:** `shared.jsx:25–40`; `ParcelHubApp.jsx:82`, `:93`.
**Category:** Implementation integrity.

New timestamps are UTC, but display uses device-local getters; sample timestamps have no offset. Changing the device timezone can change displayed history times. Use explicit Asia/Bangkok formatting and consistent offset-bearing timestamps. **Suggested command:** `$impeccable harden`.

### 14. Data growth has no bounded rendering/storage strategy

**Location:** `shared.jsx:155`; `ArchivePage.jsx:41`; `ParcelHubApp.jsx:61`; `shared.jsx:252`.
**Category:** Performance.

Tables render all matching records; every parcel change serializes the entire array into localStorage. Large history will increase work and may reach storage quota; the storage write has no failure handling. Fonts are discovered after the first render. No high-volume slowdown was measured, so this is a source-level scaling risk. Add pagination/API-backed history for the operational app, handle storage failures for the demo, and make font loading discoverable earlier if measurements justify it. **Suggested command:** `$impeccable optimize`.

## Scope gaps, separate from defects

The locked design specification describes daily statistics/date selection, Directory, Parcel Detail/History, explicit Check-Out All/Selected, English v1 strings, and navigation routes. This prototype instead has two state-switched destinations, Thai inline copy, and extra damage/LINE flows. Treat these as known coverage/direction gaps for planning; do not mistake them for completed target features. Demo login accepts any nonempty credentials and uses a localStorage flag; that is not evidence of server authentication or authorization. No backend/security audit was performed, and the score does not penalize the absence of a backend in a frontend demo.

## Patterns and positives

The dominant gaps are shared infrastructure: field semantics/focus, dialog behavior, and overloaded parcel state. Fixing those centrally will improve several screens together. The shared palette is mostly consistent; residual literal colors appear in login decoration/errors and global CSS. No theme toggle exists, so theme-switch behavior was not tested.

Keep the existing clear primary actions, semantic tables and main/navigation landmarks, text alongside status colors, shared color constants, empty results states, duplicate tracking-code checks, selective/bulk-selection foundations, responsive stacking, and reduced-motion alternative for banner animation. The production bundle is modest and the build passed. Existing table overflow wrappers are appropriate for wide data tables; horizontal table scrolling alone is not a responsiveness defect.

## Recommended order

1. **P1 — `$impeccable harden`:** directory validation, separate damage/identity state, accessible fields/dialogs, visible selected-parcel summary.
2. **P1 — `$impeccable colorize`:** correct the verified text contrast failures using shared role tokens.
3. **P1/P2 — `$impeccable adapt`:** viewport-safe dialogs and larger touch hit areas; verify real keyboard/touch behavior afterward.
4. **P2 — `$impeccable clarify`:** choose row/piece count semantics and consistent operational labels.
5. **P2 — `$impeccable optimize`:** measure representative data volume, then bound table rendering and persistence work.
6. **Final step — `$impeccable polish`:** align spacing, hierarchy, and remaining interaction details after behavior is corrected.

Run these individually, together, or in the preferred order. Re-run `$impeccable audit` after fixes to reassess the score.
