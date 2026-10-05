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

`bg` is the light neutral workspace. `card` / `sidebar` are white surfaces; `border` separates fields and table rows; `text` and `textMuted` establish reading hierarchy. The dotted background and login's colored decorations were removed.

## Typography

Noto Sans Thai with system sans fallback is used for headings, labels, controls, and tabular data. `useFonts()` loads the Google Fonts stylesheet with `display=swap`; a single family replaces the display/body pairing and covers Thai explicitly. Font fetching still depends on the network, with usable system fallback.

Page headings are 28px/600, decreasing to 25px on mobile. Dialog titles are 17px/600. Body/table rows use 14px; controls 14–16px; metadata and table headers 12–13px. Tabular numerals align dates, counts, and tracking codes without a separate monospace face.

## Layout

Active entry: App.jsx → ParcelHubApp.jsx. The older ParcelHub.jsx is not the active visual authority.

Header and main content share a centered 1280px outer container, 40px horizontal padding on desktop, 24px below 1000px, and 20px below 640px. Header height is at least 76px; mobile uses a brand/account row and a separate navigation row. Main top padding is 40/32/28px at those sizes.

Dashboard actions sit beside its page heading on desktop and below it on mobile. Search spans the register width. Dashboard shows and searches Pending Parcels only; history is available through Archive. Dashboard shows four useful columns for Pending results; Archive retains status/checkout dates. On mobile it uses flat parcel rows with room/name, full tracking code and quantity, with dates/notes in native details. Archive retains its full table and named, keyboard-focusable horizontal scrolling region, including its 850px mobile minimum width. The page itself does not overflow horizontally.

Damage entries sit under a native disclosure. Archive uses inline stateful filters above search and history. Login is a 360px-wide form on a plain white surface. Native dialogs are at most 480px wide, constrained to available dynamic viewport height with internal scrolling.

Desktop (1440px), mobile (390px), and a 480px-high viewport were exercised in the browser. Physical touch, a real software keyboard, and assistive-technology behavior were not verified.

## Elevation & Depth

Main content uses a single border with no shadow. Shadows are reserved for transient overlays: notification panel `0 8px 32px rgb(32 33 36 / .16)`, banner `0 4px 18px rgb(32 33 36 / .12)`, native dialog `0 16px 60px rgb(32 33 36 / .2)`. Native dialog backdrops use `rgb(32 33 36 / .42)`. Native top-layer behavior handles modal stacking.

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

Native `<dialog>` provides modal focus containment. Escape closes it; focus returns to the opener. It scrolls within the viewport and initially focuses the first field. Check-Out has a persistent selected-parcel summary, including selections outside the current search, with a remove-selection action. Banner motion and color transitions respect reduced-motion preferences.

The 2026-10-06 hardening keeps this appearance while separating room lookup from complete-code scans, requiring room-scoped checkout confirmation, retaining intake drafts across modal closes, rejecting duplicate/incomplete entries, and reporting storage failures without overwriting saved data. Intake uses the existing mock room directory; timestamps render explicitly in Bangkok time; identity confirmation retains physical damage notes. These frontend guards do not implement production authentication, a real directory/API, or the full locked design-spec. No backend files were changed.

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

Tracking fields in Check-In and room-scoped Check-Out have an icon-only scanner button with the accessible name and tooltip “เตรียมสแกน”. It focuses the existing input and announces readiness to receive keyboard-style scanner input; it neither connects hardware nor opens a camera. Check-In first requires a room from the mock directory. The action has a 44px hit target and sits beside the input on desktop and mobile, retaining all existing validation and explicit save behavior.

### Concise modal guidance

Intake and checkout keep field labels, room identity/counts, condition notes, validation errors and confirmation copy visible. Per user request, all “วิธีใช้งาน” disclosures and their instruction content are removed from both forms. Tracking labels are short; the placeholder conveys Enter. Scanner preparation announces only “พร้อมรับรหัส”; input descriptions for assistive technology remain.

### Expanded damage note

Damage detail uses a neutral full-width table row, one small warning icon, a muted “หมายเหตุชำรุด” label and readable reason text. It has no nested pink card. In desktop tables the “ชำรุด” disclosure sits 12px after the tracking code, in the tracking column, so condition belongs to the parcel rather than the resident. The control retains a 44px hit area, adds a directional chevron and links to the expanded content. Existing note data and mobile native-detail presentation are preserved.

### Checkout action hierarchy

The room selector carries room identity; native checkbox rows and Select All make selection visible. A single anchored “นำออกที่เลือก” action leads; selecting every pending parcel triggers explicit room/count confirmation through that same action. For multi-page rooms, a collapsed selected-items disclosure preserves review/removal across pages. Validation and room-change guards are retained.

### Combined room lookup

Checkout uses one editable “ค้นหาและเลือกห้อง” combobox in place of separate search and select fields. Room number, resident name and tracking-code queries filter room options with pending counts. Mouse selection or Arrow keys/Enter chooses a room; Escape closes suggestions. Uncommitted typing does not change the active room and leaving the field restores its confirmed label. Changing room with selected parcels asks for confirmation, focuses that action and temporarily disables checkout controls; cancelling retains selections. The search container owns the single focus border.

### Revised room selection flow

Checkout separates choosing a room from handling its parcels within the same modal. The first state has only the search field. Nonblank queries reveal matching room rows with room number, resident and pending-record count; rooms without pending parcels are omitted. Clearing the query hides the results. Even a prefilled Dashboard query requires explicit pointer or keyboard confirmation before selecting a room. Rows are not preselected on arrival. Arrow keys highlight deliberately, Enter selects, and Tab reaches row buttons. After selection, a compact room/resident heading replaces the picker with a “เปลี่ยนห้อง” action and focus moves to the scanner input. Editing rooms hides the old parcel controls without discarding selection; candidate changes still use the existing explicit confirmation.

### Stable search geometry

The room-search dialog fits its label and input, without a reserved blank result region. Matching rooms or no-match feedback open in an anchored dropdown below the field only after a nonblank query. The dropdown sits outside normal layout so filtering keeps dialog height and input position unchanged. Its list scrolls within a maximum of min(216px, max(44px, 50dvh - 128px)), leaving space on short viewports. When changing rooms, “ใช้ห้องเดิม” sits beside the search label. The selected-room footer contains its selected count, any necessary confirmation/error, and the sole checkout action.

### Archive pagination

Archive displays at most 8 parcel records per page. A range label and numbered navigation sit above the table, with previous/next arrows, a clear active page and ellipses for large page counts. Search/filter changes reset to page one. Dashboard uses the same 8-record table pagination. Checkout uses the separately documented adaptive modal pagination.


## Checkout audit follow-up (2026-10-06)

Checkout now uses native checkbox rows with whole-row activation and a mixed-state Select All checkbox next to the list heading. One primary action remains in an anchored footer; choosing all parcels requires explicit room/count confirmation, whose safe cancellation receives focus and returns to the primary action. Failed writes keep selections and restore focus. Scanner errors are linked directly beneath the tracking field; save errors stay near the primary action.

The selected-room dialog reserves stable geometry for its record count/page capacity. Its header and footer are anchored; the content has the only vertical overflow region. Normal rows paginate at up to 8 on desktop viewports at least 1100px high, 4 at heights at least 820px, 3 at heights at least 700px, otherwise 2. Selection survives page and viewport changes; exact-code scans reveal the matching page. Each page reserves its row area, so a sparse last page does not resize the dialog. Long notes, expanded selection review and unusually short viewports may use the single content scroll region. Archive's 8-record pagination remains unchanged.


### Softer checkout tones

The user's 2026-10-06 feedback asks for less intense blue and black in the recently revised checkout modal. Local dialog tokens use primary `#3267BD`, hover `#2856A5`, text `#374151` and selected-row text `#40546F`; tracking-code weight is 500. This softens visual emphasis rather than rolling back the checkbox/pagination interaction. The existing global palette and all other screens retain their tokens. White-on-primary contrast is 5.51:1, normal text on white 10.31:1 and selected text on the existing pale blue surface 6.75:1.


### Dashboard table pagination

Dashboard's main parcel results and expanded damaged-parcel table each display at most 8 records per page, sharing Archive's numbered controls and range indicator above the table. Searching still filters the complete dataset and resets the main results to the first page; empty results keep the existing actionable feedback. Shared navigation names now reflect each table's accessible label. Existing colors and row typography remain unchanged.


### Dashboard audit follow-up — 2026-10-06

The heading and intake/checkout actions share a desktop row. Dashboard removes the duplicated total and default search feedback; its range indicator is the primary result count. Search is restricted to Pending Parcels regardless of query text. Per the user’s follow-up, the “รวมประวัติ” checkbox is removed; history search lives in Archive. The persistent label is “ค้นหาพัสดุรอรับ”. The Dashboard and damage tables omit repeated status and empty checkout-date columns; Archive retains them.

At widths ≤640px, Dashboard replaces the desktop table with an equivalent flat list. Each row shows room/name, the full tracking code and quantity; native details reveal received time, pending status and damage note. CSS hides the unused representation from the accessibility tree. Pagination still shows at most 8 records with its controls above the list; no horizontal swipe is needed to read the code. Long names, 256-character codes and long notes wrap.

Pagination reset is tied to the main query, not every parcel-array render. The damage table preserves its page during main search and clamps to the last valid page when records shrink. Damaged records are memoized and sorted with parseParcelDate, matching the Bangkok-time rendering convention. Multi-page desktop results reserve the normal 8-row table area so a sparse last page stays aligned; single-page searches and mobile rows use natural height. Root tokens and checkout-local softer colors remain unchanged.


### Dashboard Pending-only refinement — 2026-10-06

The user removed the Include History control as unnecessary. Dashboard now has a single persistent search label and no scope toggle; the toolbar no longer reserves a 44px control row. Its no-results message points to Archive for history. History remains searchable in Archive with all six columns and existing pagination.


### Compact table pagination — 2026-10-06

Dashboard, damaged-parcel tables and Archive share a compact pagination treatment: 13px page numbers, 16px arrows, no gap between 44px hit targets. The current page uses a 28px pale-blue mark with blue text and weight 500, replacing the heavy full-size filled button. Hover, disabled, keyboard outline and aria-current remain. Page size and navigation position are unchanged.


### Search-first checkout room selection — 2026-10-06

Per the user’s request, checkout no longer lists all pending rooms on arrival. Blank/whitespace input shows no options or no-match warning. Typing a room/name/tracking query reveals matching pending rooms; choosing a result by pointer or Arrow/Enter confirms the room. Dashboard-prefilled queries do not auto-select. aria-expanded/controls reflect the actual result list. Clearing search hides it. Room-change confirmation and selection preservation remain unchanged.
