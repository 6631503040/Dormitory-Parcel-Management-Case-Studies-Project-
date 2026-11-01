---
name: ParcelHub prototype
description: "Recorded prototype appearance; design-spec.md remains the confirmed product and design authority."
colors:
  bg: "#F8F9FB"
  card: "#FFFFFF"
  sidebar: "#FFFFFF"
  border: "#DDE3EC"
  controlBorder: "#596579"
  text: "#202124"
  textMuted: "#596579"
  primary: "#1A56B8"
  primaryDark: "#1A56B8"
  primaryLight: "#E8F0FE"
  success: "#188038"
  successLight: "#E6F4EA"
  navyChip: "#E8F0FE"
  navy: "#1A56B8"
  warning: "#B42318"
  warningLight: "#FCE8E6"
typography:
  display:
    fontFamily: "'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "1.3"
  title:
    fontFamily: "'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "1.6"
  body:
    fontFamily: "'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.6"
  label:
    fontFamily: "'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "1.6"
  caption:
    fontFamily: "'Noto Sans Thai', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "1.6"
rounded:
  control: "6px"
  dialog: "10px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  full: "9999px"
spacing:
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-check-in:
    backgroundColor: "{colors.card}"
    textColor: "{colors.success}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  input-search:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 13px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "0"
  nav-active:
    textColor: "{colors.primary}"
    padding: "0"
  chip-pending:
    textColor: "{colors.primary}"
    padding: "0"
  chip-picked-up:
    textColor: "{colors.success}"
    padding: "0"
---
# Design System: ParcelHub prototype

## Overview

**Creative North Star: "เคาน์เตอร์พัสดุที่เป็นมิตร"**

The frontend was refined on 2026-10-05 in response to the user's request to reduce the AI-pattern appearance, on branch `codex/frontend-ux-ui-refresh`. This keeps the incumbent ParcelHub identity and parcel-counter workflow, while reducing decorative chrome and making the table the main work surface. The recorded metaphor remains “เคาน์เตอร์พัสดุที่เป็นมิตร”; this is refinement of that system rather than a new product concept.

Authority: PRODUCT.md and docs/02-design/design-spec.md continue to describe confirmed target scope. These tokens record the current frontend refinement; they do not change backend scope, naming requirements, or language requirements in the locked specification. Prototype naming, Thai copy, and Dashboard/Archive destinations remain known differences from that target.

**Key Characteristics:**
- Compact action controls and readable parcel rows.
- One shared Thai-capable type family, with a restrained size/weight hierarchy.
- Flat white table surfaces on a light neutral workspace.
- Text and icons express state; color is reserved for actions and semantic cues.
- Damage entries are progressively disclosed rather than duplicated on arrival.

## Colors

Runtime source: CSS custom properties in `docs/02-design/prototype/src/styles.css`. The `C` object in `shared.jsx` references those properties, so inline and class-based components share the same values. Frontmatter keeps the legacy palette key names for compatibility.

### Primary

`primary` / `primaryDark` / `navy` map to `--desk-primary`. The darker incumbent blue is used for Check-Out, active navigation, focus, and Pending text. Primary hover uses `--desk-primary-hover` (`#164A9D`). `primaryLight` / `navyChip` map to `--desk-primary-light` for selected rows and informational feedback.

### Secondary

`success` / `successLight` map to the green semantic pair used by Check-In and successful feedback. `warning` / `warningLight` map to the red semantic pair used by damage/error information. The warning foreground is darker for small-text contrast. This prototype's red warning semantics remain different from the locked specification's amber warning.

### Neutral

`bg` is the light neutral workspace. `card` / `sidebar` are white surfaces; `border` separates fields and table rows; `text` and `textMuted` establish reading hierarchy. The work surfaces retain the plain neutral background. Login keeps the same UI palette and uses one generated illustration of three matching minimal cartoon dormitories with subtle 3D depth in its separate powder-blue right panel; the image colors do not extend the global token palette.

## Typography

Noto Sans Thai with system sans fallback is used for headings, labels, controls, and tabular data. `useFonts()` loads the Google Fonts stylesheet with `display=swap`; a single family replaces the display/body pairing and covers Thai explicitly. Font fetching still depends on the network, with usable system fallback.

Work-surface page headings are 28px/600, decreasing to 25px on mobile. Login uses a scoped 32px/600 heading with 1.35 line height and -.025em tracking, decreasing to 28px below 760px; its supporting copy and field labels use 14px, inputs 16px and submit text 15px. Dialog titles are 17px/600. Body/table rows use 14px; controls 14–16px; metadata and table headers 12–13px. Tabular numerals align dates, counts, and tracking codes without a separate monospace face.

## Layout

Active entry: App.jsx → ParcelHubApp.jsx. The older ParcelHub.jsx is not the active visual authority.

Header and main content share a centered 1280px outer container, 40px horizontal padding on desktop, 24px below 1000px, and 20px below 640px. Header height is at least 76px; mobile uses a brand/account row and a separate navigation row. Main top padding is 40/32/28px at those sizes.

Dashboard actions sit beside its page heading on desktop and below it on mobile. Search spans the register width. Dashboard shows and searches Pending Parcels only; history is available through Archive. Dashboard shows five columns for Pending results, including Status; Archive also retains checkout dates. On mobile it uses flat parcel rows with room/name, visible status, full tracking code and quantity, with dates/notes in native details. Archive retains its full table and named, keyboard-focusable horizontal scrolling region, including its 850px mobile minimum width. The page itself does not overflow horizontally.

Damage entries sit under a native disclosure. Archive uses inline stateful filters above search and history. Native dialogs are at most 480px wide, constrained to available dynamic viewport height with internal scrolling.

Login follows the user's 2026-10-06 split-screen reference: a white form panel at left and a full-height powder-blue panel containing three staggered minimal cartoon dormitories at right. At desktop sizes the grid is `minmax(360px, 44%) 1fr`, yielding the approved 44/56 split where the minimum is inactive. The ParcelHub brand sits at upper left; the form is horizontally centered within its panel at a maximum width of 360px. The panel has 40px vertical/48px horizontal padding, becoming 32px at widths ≤1000px. Auto margins center the form vertically when space allows, with 48px top/78px bottom content padding. The right image uses centered object-fit: contain; the complete group of three matching buildings stays visible without edge cropping. Below 760px it is hidden; the panel uses 28px vertical/24px horizontal insets and the form uses 48px vertical padding. Both panel and page use minimum dynamic viewport height rather than fixed height, so a short viewport scrolls to the full form. This composition is Login-specific and does not change register or dialog layout.

Fresh scoped finish review returned **ship** for the current campus artwork, with no material fixes. The full group and minimal cartoon style were maintained on desktop/tablet; form behavior remains unchanged. Current evidence is `.impeccable/review/login-campus-desktop-20261006.jpg` (1440×900), `login-campus-tablet-20261006.jpg` (900×900), and `login-campus-mobile-20261006.jpg` (390×844). Retained `login-split-short-top-20261006.jpg` / `login-split-short-bottom-20261006.jpg` remain evidence for the unchanged mobile form at a 390×480 viewport (capture API reports 375×462 excluding scrollbars). The prototype build passed; the browser loaded the current image with the complete building group visible and no page overflow or console warnings. The scoped anti-pattern detector returned no findings, and raster provenance was verified. Physical touch, a real software keyboard and screen-reader behavior were not verified.

Desktop (1440px), mobile (390px), and a 480px-high viewport were exercised in the browser. Physical touch, a real software keyboard, and assistive-technology behavior were not verified.

## Elevation & Depth

Main content uses a single border with no shadow. Shadows are reserved for transient overlays: notification panel `0 8px 32px rgb(32 33 36 / .16)`, banner `0 4px 18px rgb(32 33 36 / .12)`, native dialog `0 16px 60px rgb(32 33 36 / .2)`. Native dialog backdrops use `rgb(32 33 36 / .42)`. Native top-layer behavior handles modal stacking.

### Transaction feedback

Successful transaction feedback uses a white toast with neutral 14px text, a small green success icon and a muted 44px close control. Preserve the actual operation, room and record count in one concise message; no extra heading, instructions or progress bar. Desktop placement is bottom-right with 24px insets and a 440px maximum width. Mobile uses 16px side/bottom insets, safe-area-aware offsets and natural wrapping, preserving the navigation area.

A persistent polite, atomic status region receives message updates without taking focus. The existing six-second timeout pauses while hovered or focused and resumes the remaining time on leaving; a notification id renews the lifetime even for identical successive messages. Timers are cleared when feedback disappears or unmounts. A visible 6px upward settling motion lasts 180ms; reduced motion shows a static notification. Failed transactions keep their existing inline error and prepared data, without generating success feedback.

## Shapes

Actions, fields, icon controls, and selected rows use 6px radii. The register and notification panel use 8px; native dialogs use 10px. Navigation and statuses use text/lines rather than pill backgrounds. Legacy radii remain in utility classes for draft-list fragments; they are not the default for new controls.

## Components

### Buttons

Check-Out uses a blue fill; Check-In uses a white bordered control with green text and a pale-green hover. Both are at least 44px high. Primary controls have hover/active/disabled treatments. Icon controls have 44px square hit areas and accessible names. Damage controls retain 44px hit targets while using underlined red text.

### Inputs / Fields

Interactive field boundaries use `--desk-control-border: #596579`; decorative dividers retain `--desk-border`. Invalid fields include an associated message and validation focuses the field that needs correction. Persistent labels are associated with inputs. Search containers use `:focus-within`; ordinary fields use `:focus`. Fields use a single contiguous 2px outline at -1px offset, joining the border rather than drawing a second detached ring. Invalid focused fields use the warning color and associated error text. Buttons and links retain their separated keyboard focus outlines. Query content no longer stands in for input focus. Record ranges and empty results are announced statuses, and Dashboard search includes a clear action. Its input spans the register width; a compact label/count row sits immediately above it, avoiding an empty half-width toolbar.

### Navigation

Dashboard and Archive retain their destinations. Active navigation uses an underline and `aria-current`. Archive filters use `aria-pressed`. Mobile logout retains an accessible name when its visible text is hidden.

### Statuses and tables

Pending uses a dot and blue text; Picked Up uses a check and green text. Tables have muted headers, medium-weight resident labels, consistent row dividers, hover feedback, captions, and column scope. Tables page in groups of 25, with visible totals and previous/next controls. Long codes and names wrap. Damage detail still expands within the table. The secondary damage list is initially collapsed to avoid duplicating records on arrival.

### Dialogs and feedback

Native `<dialog>` provides modal focus containment. Escape closes it; focus returns to the opener. It scrolls within the viewport and initially focuses the first field. Check-Out presents the verified scanned parcel before an explicit confirmation, with collapsed same-room checkbox additions; a fresh lookup replaces uncommitted selection. Banner motion and color transitions respect reduced-motion preferences.

Earlier 2026-10-06 hardening separated room lookup from complete-code scans; the scanner-first checkout policy below now supersedes that room-first composition. The retained guards include same-room checkout revalidation, intake drafts across modal closes, duplicate/incomplete-entry rejection and storage-failure feedback without overwriting saved data. Intake uses the existing mock room directory; timestamps render explicitly in Bangkok time; identity confirmation retains physical damage notes. These frontend guards do not implement production authentication, a real directory/API, or the full locked design-spec. No backend files were changed.

### Login

Login retains the ParcelHub mark, Thai labels and the existing demo sign-in callback. Its fields and full-width submit control are at least 50px high, with 6px control corners; fields use 12px vertical/14px horizontal padding. Password has 52px right padding and a 44px square reveal/hide button inset 3px from the top/right, with a state-specific accessible name. Persistent labels, native autocomplete, the shared focus border and associated alert text remain. Missing values focus the first invalid field; validation and callback errors retain entered values. A 24px minimum feedback region limits movement when errors appear.

The user rejected the earlier realistic architectural image as too AI-like. Current Login imagery uses matte, minimal cartoon geometry with only gentle 3D depth: three matching white three-storey dormitories arranged at staggered depths, sparse blue windows and rails, rounded shrubs and a simple shared courtyard/lawn on powder blue. The image-panel fallback is `#E6EFFA`, sampled from the illustration corner and local to Login. The decorative illustration is `docs/02-design/prototype/public/images/dormitory-login-campus.webp`, with adjacent `.webp.json` provenance and the exact built-in generator prompt recorded in `.impeccable/assets/dormitory-login-campus.json`. It is hidden from assistive technology and supplies no property or production claim. This imagery revision preserves the form, split layout and existing demo callback; it does not implement production authentication or alter the locked product authority.

## Do's and Don'ts

### Do:
- Do consult design-spec.md for product scope and distinguish the frontend prototype from the target implementation.
- Do prioritize room/name/tracking-code scanning and clear parcel actions.
- Do use the CSS properties and shared type family for active components.
- Do retain text/icons alongside semantic colors, visible focus, and native dialog behavior.
- Do keep table scrolling inside the register on small screens.

### Don't:
- Don't add decorative patterns, floating icon tiles, giant search fields, or repeated pill containers.
- Don't turn every section into a card or duplicate the damage table by default.
- Don't remove persistent labels or replace focus with query-value styling.
- Don't represent this UI refinement as a change to locked product requirements or implemented backend capability.

### Scanner preparation

Tracking fields in Check-In and scanner-first Check-Out have an icon-only scanner button with the accessible name and tooltip “เตรียมสแกน”. It focuses the existing input and announces readiness to receive keyboard-style scanner input; it neither connects hardware nor opens a camera. Check-In first requires a room from the mock directory. The action has a 44px hit target and sits beside the input on desktop and mobile, retaining all existing validation and explicit save behavior.

### Concise modal guidance

Intake and checkout keep field labels, room identity/counts, condition notes, validation errors and confirmation copy visible. Per user request, all “วิธีใช้งาน” disclosures and their instruction content are removed from both forms. Tracking labels are short; the placeholder conveys Enter. Scanner preparation announces only “พร้อมรับรหัส”; input descriptions for assistive technology remain.

### Expanded damage note

Damage detail uses a neutral full-width table row, one small warning icon, a muted “หมายเหตุชำรุด” label and readable reason text. It has no nested pink card. In desktop tables the “ชำรุด” disclosure sits 12px after the tracking code, in the tracking column, so condition belongs to the parcel rather than the resident. The control retains a 44px hit area, adds a directional chevron and links to the expanded content. Existing note data and mobile native-detail presentation are preserved.

### Scan-first checkout — 2026-10-06

The current user-pinned flow replaces room-first lookup: open “นำพัสดุออก” → scan or type the full tracking code → Enter or “ค้นหาพัสดุ” → inspect parcel details → explicitly confirm checkout. The initial dialog has only its labeled scanner input, the retained icon-only focus control and a manual lookup button. Dashboard search is not copied into this scanner. No room list, help disclosure or checkout action appears before a successful lookup.

The result identifies the parcel by code, status, room, recipient, quantity, Bangkok receipt time and any recorded damage reason. A successful lookup selects that parcel alone. Enter only resolves the code; it cannot commit checkout. Changing the code leaves the prior details visible for context but disables checkout and optional selection until the code is verified. An unsuccessful lookup removes the prior result and gives an associated inline error. Unknown, ambiguous and already-out codes are blocked; commit retains the existing same-room/stale-record revalidation and callback.

Optional “พัสดุอื่นของห้องนี้” is collapsed after a result. Native checkboxes select additional pending records from that room; Select All includes the scanned record. Normal additions paginate at 8/4/3/2 records depending on viewport height, with reserved 64px normal rows and selection preserved across pages. Selecting all multiple records uses explicit room/count confirmation with safe cancellation focus. A single record uses the ordinary explicit checkout action. A new lookup replaces the uncommitted selection rather than accumulating parcels across rooms.

Per the later user request, the dialog is centered vertically and horizontally using auto margins on desktop and mobile, with a maximum height of 100dvh minus 32px. Both the initial scanner and the result dialog remain centered; short screens retain 16px top/bottom clearance. The initial dialog is content-sized. Header/footer remain anchored when the result needs scrolling; content provides one overflow region for small screens, long notes or expanded additions. Busy state blocks repeat saves, save errors retain selection and focus returns to the action. Local checkout palette is preserved. Surface contract: `docs/02-design/checkout-scan-surface-brief.md`. The prior scanner-first flow received a fresh scoped **ship** review over six captures; the later centering change received targeted layout verification.

The scoped audit is `docs/02-design/checkout-scan-audit-2026-10-06.md`. Evidence is `.impeccable/review/checkout-scan-initial-desktop-20261006.jpg`, `checkout-scan-result-desktop-20261006.jpg`, `checkout-scan-bulk-desktop-20261006.jpg`, `checkout-scan-initial-mobile-20261006.jpg`, `checkout-scan-result-mobile-20261006.jpg` and `checkout-scan-short-mobile-20261006.jpg`. Requested viewports were 1440×900, 390×844 and 390×480; capture content measures 1425×891, 375×812 and 375×462 excluding browser chrome/scrollbars. Before the centering follow-up, the scanner stayed in place as desktop results appeared; optional-list pages 2 and 3 retained a 280px list and 788px dialog. Short mobile uses an anchored footer with one content scroller, without horizontal overflow; visible measured buttons were at least 44px. Build and 18 rule tests passed; the detector returned no findings. Synthetic callback failure/retry checks preserved selection and focus before successful confirmation, without saved-data, API or authentication transactions. Physical barcode hardware, physical touch, a real software keyboard and screen-reader audio were not verified.

### Archive pagination

Archive displays at most 8 parcel records per page. A range label and numbered navigation sit above the table, with previous/next arrows, a clear active page and ellipses for large page counts. Search/filter changes reset to page one. Dashboard uses the same 8-record table pagination. Checkout uses the separately documented adaptive modal pagination.


## Checkout audit follow-up (2026-10-06)

Earlier room-first audit findings and fixes remain historical evidence in `docs/02-design/checkout-modal-audit-2026-10-06.md`. The current scanner-first policy above supersedes that room-picker composition. Native checkbox semantics, linked errors, same-room validation, anchored footer, scoped palette and adaptive optional-list pagination remain.

### Softer checkout tones

The user's 2026-10-06 feedback asks for less intense blue and black in the recently revised checkout modal. Local dialog tokens use primary `#3267BD`, hover `#2856A5`, text `#374151` and selected-row text `#40546F`; tracking-code weight is 500. This softens visual emphasis rather than rolling back the checkbox/pagination interaction. The existing global palette and all other screens retain their tokens. White-on-primary contrast is 5.51:1, normal text on white 10.31:1 and selected text on the existing pale blue surface 6.75:1.


### Dashboard table pagination

Dashboard's main parcel results and expanded damaged-parcel table each display at most 8 records per page, sharing Archive's numbered controls and range indicator above the table. Searching still filters the complete dataset and resets the main results to the first page; empty results keep the existing actionable feedback. Shared navigation names now reflect each table's accessible label. Existing colors and row typography remain unchanged.


### Dashboard audit follow-up — 2026-10-06

The heading and intake/checkout actions share a desktop row. Dashboard removes the duplicated total and default search feedback; its range indicator is the primary result count. Search is restricted to Pending Parcels regardless of query text. Per the user’s follow-up, the “รวมประวัติ” checkbox is removed; history search lives in Archive. The persistent label is “ค้นหาพัสดุรอรับ”. The Dashboard and damage tables show Status and omit only the empty checkout-date column; Archive retains both.

At widths ≤640px, Dashboard replaces the desktop table with an equivalent flat list. Each row shows room/name, visible status, the full tracking code and quantity; native details reveal received time and damage note. CSS hides the unused representation from the accessibility tree. Pagination still shows at most 8 records with its controls above the list; no horizontal swipe is needed to read the code. Long names, 256-character codes and long notes wrap.

Pagination reset is tied to the main query, not every parcel-array render. The damage table preserves its page during main search and clamps to the last valid page when records shrink. Damaged records are memoized and sorted with parseParcelDate, matching the Bangkok-time rendering convention. Multi-page desktop results reserve the normal 8-row table area so a sparse last page stays aligned; single-page searches and mobile rows use natural height. Root tokens and checkout-local softer colors remain unchanged.


### Dashboard Pending-only refinement — 2026-10-06

The user removed the Include History control as unnecessary. Dashboard now has a single persistent search label and no scope toggle; the toolbar no longer reserves a 44px control row. Its no-results message points to Archive for history. History remains searchable in Archive with all six columns and existing pagination.


### Compact table pagination — 2026-10-06

Dashboard, damaged-parcel tables and Archive share a compact pagination treatment: 13px page numbers, 16px arrows, no gap between 44px hit targets. The current page uses a 28px pale-blue mark with blue text and weight 500, replacing the heavy full-size filled button. Hover, disabled, keyboard outline and aria-current remain. Page size and navigation position are unchanged.


### Superseded room-search iteration — 2026-10-06

The earlier search-first room selector was superseded by the user-requested scan-first checkout flow above. Checkout no longer renders a room combobox or room options.

### Intake condition and Dashboard status — 2026-10-06

Intake uses a native labeled checkbox for “พัสดุชำรุด”, with an 18px visible unchecked/checked box and a 44px-high clickable label. Selecting it reveals the existing required reason field; keyboard Space and busy-state disabling remain available. Dashboard and damaged-parcel results include Status as the fifth column, using the shared status treatment. Mobile shows status beside room identity without requiring expansion. Damage notes span all five columns; Archive keeps its six columns and table pagination remains 8 records per page.


### Centered checkout placement — 2026-10-06

The user requested viewport centering in place of the top anchor. Targeted verification measured dialog centers at (720, 450) in 1440×900 for both initial and result states, and (195, 422) in 390×844 for the initial state. At 390×480, the result remains within top16px/bottom464px with its footer reachable and content scrolling retained. Build passed; no console warnings/errors or layout detector findings. Current placement evidence: `.impeccable/review/checkout-centered-desktop-20261006.jpg` and `checkout-centered-mobile-20261006.jpg`. Lookup, confirmation and other frontend behavior were not changed.
