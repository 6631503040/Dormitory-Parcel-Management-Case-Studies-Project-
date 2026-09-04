# Design Spec — Dormitory Parcel Management System

> Version: 1.1 | Created: 2026-09-04 | Updated: 2026-09-04 | Status: LOCKED
>
> This file is the single source of truth for all design decisions.
> Do NOT change values here without updating all code that references them.
> All skills (/iterate, /ship, /qa) must conform to this spec.

---

## 1. Identity

### App Name
- **Display name:** Dormitory Parcel Management System
- **Short name (nav/header):** Parcel Desk
- **Package/bundle ID:** com.dormitory.parceldesk
- **Internal project name:** dormitory-parcel-management

### Terminology Lock

These terms are FINAL. Do not use synonyms, abbreviations, or alternatives
in code, UI, tests, or documentation.

| Concept | User-Facing Term | Internal Field Name | Notes |
|---------|-----------------|--------------------:|-------|
| Incoming package handled by the desk | Parcel | `parcel` | Never "package", "item", "box", "mail" |
| Recording a parcel's arrival | Check-In | `checkIn` / `checked_in_at` | Never "receive", "intake", "register", "log" |
| Handing a parcel to its resident | Check-Out | `checkOut` / `checked_out_at` | Never "release", "deliver", "hand-off", "dispatch" |
| Parcel awaiting collection | Pending | `status = 'pending'` | Never "in storage", "waiting", "unclaimed", "open" |
| Parcel collected by resident | Picked Up | `status = 'picked_up'` | Displayed "Picked Up"; never "completed", "done", "delivered", "closed" |
| Parcel past retention window | Archived | `status = 'archived'` | Soft state; records are never hard-deleted |
| One of the 10 dormitory buildings | Building | `building` | Codes `B1`–`B10`; never "block", "dorm", "hall". Reference data only — a room's building; not assigned to a parcel |
| Value encoded in the courier barcode | Tracking Code | `tracking_code` | Never "tracking number", "barcode", "AWB", "ref", "parcel ID" |
| Official list of who lives where | Resident Directory | `residents` | Never "student list", "tenant roster", "master list" |
| Person a parcel is for | Resident | `resident` | Never "student", "tenant", "customer", "user", "recipient" in code |
| Front-desk system user | Staff | `staff` | Never "operator"/"admin" in copy (those are role *values*), never "agent", "clerk" |
| Room's identifying label | Room Number | `room_number` | Always chosen from the directory; never a free-text input |
| Check out every pending parcel for a room in one action | Check Out All | `checkOutAll` / event `checked_out_bulk` | The bulk flow; distinct from single check-out |
| Check out one selected parcel | Check Out Selected | `checkOut` / event `checked_out` | Always available alongside Check Out All |
| Timestamped record of every check-in/check-out | Parcel History | `parcel_events` | Audit trail / chain of custody; never "log", "activity feed" |

---

## 2. Design Tokens

Design intent: the UI must read like the Google Sheets / Google Forms workflow
staff use today (Objective 3 + User Adoption Risk mitigation). Dense, light,
table-first, low-chrome. A Google-family blue is the primary; Sheets green is
reserved for check-in confirmation. No custom web fonts (load speed + familiar
system look). Tokens are theme-ready but only the light theme ships in v1.

### Color Palette

| Token Name | Hex | Usage |
|-----------|-----|-------|
| primary | #1A73E8 | Main action buttons, active nav item, links, focus ring |
| primaryVariant | #1857B8 | Pressed/hover state of primary |
| secondary | #188038 | Check-In confirm button, positive accents |
| secondaryVariant | #0F6B2E | Pressed/hover state of secondary |
| surface | #FFFFFF | Card backgrounds, table rows, input fields |
| background | #F8F9FA | Page/scaffold background, table header row |
| error | #D93025 | Error states, destructive actions, validation messages |
| onPrimary | #FFFFFF | Text/icons on primary color |
| onSecondary | #FFFFFF | Text/icons on secondary color |
| onSurface | #202124 | Text/icons on surface color |
| onBackground | #202124 | Text/icons on background color |
| onError | #FFFFFF | Text/icons on error color |
| success | #188038 | Success toasts, "Picked Up" status chip |
| warning | #F29900 | Warning states, "missing room number" flags |
| neutral100 | #E8EAED | Borders, dividers, table gridlines, disabled fills |
| neutral500 | #5F6368 | Secondary text, placeholder text, inactive icons |
| neutral900 | #202124 | Primary text, headings |

All colors MUST be referenced via theme tokens in code. Zero hardcoded hex values.
Implemented as CSS custom properties consumed by the Tailwind config
(`theme.extend.colors`), e.g. `bg-primary`, `text-onSurface`.

### Typography Scale

Base size 14px (spreadsheet-dense). Sizes in px, line height in px.

| Style Name | Font Family | Size | Weight | Line Height | Usage |
|-----------|-------------|------|--------|------------|-------|
| displayLarge | UI sans | 32 | 700 | 40 | Login screen title, empty-project hero |
| headlineMedium | UI sans | 24 | 600 | 32 | Screen titles ("Check-In", "Dashboard") |
| titleLarge | UI sans | 20 | 600 | 28 | Section headers within a screen |
| titleMedium | UI sans | 16 | 600 | 24 | Card titles, table group headers |
| bodyLarge | UI sans | 14 | 400 | 20 | Primary body text, table cell text, form values |
| bodyMedium | UI sans | 13 | 400 | 18 | Secondary text, helper text |
| labelLarge | UI sans | 14 | 500 | 20 | Button text, active nav label |
| labelSmall | UI sans | 12 | 400 | 16 | Captions, input hints, timestamps, chip text |
| mono | UI mono | 14 | 500 | 20 | Tracking codes, room numbers in tables |

- **UI sans:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- **UI mono:** `"Roboto Mono", "SF Mono", "Consolas", "Liberation Mono", monospace`

All text styles MUST be referenced via typography tokens (Tailwind text utilities
mapped in config, e.g. `text-bodyLarge`). Zero inline font sizes.

### Spacing Grid

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps, inline spacing, chip padding |
| sm | 8px | List/table cell internal padding, gap between related fields |
| md | 16px | Standard padding: card content, form field vertical rhythm |
| lg | 24px | Spacing between cards/sections/groups |
| xl | 32px | Major section breaks, screen content margins |
| xxl | 48px | Login screen vertical centering, empty-state padding |

### Border Radii

| Token | Value | Usage |
|-------|-------|-------|
| none | 0 | Table cells, full-width dividers, nav bar |
| sm | 4px | Chips, status badges, tags |
| md | 8px | Cards, buttons, inputs, dropdown menus |
| lg | 16px | Modals, confirmation dialogs |
| full | 9999px | Avatar/initials circle, count badges |

### Elevation / Shadows

| Token | Value | Usage |
|-------|-------|-------|
| none | `none` | Tables, nav bar, flat inline elements |
| low | `0 1px 2px rgba(0,0,0,0.08)` | Cards, sticky table header |
| medium | `0 2px 8px rgba(0,0,0,0.12)` | Dropdown/autocomplete menus, toasts |
| high | `0 8px 24px rgba(0,0,0,0.16)` | Modals, confirmation dialogs |

---

## 3. Screen Inventory

### Navigation Structure

Persistent **top navigation bar** (mirrors spreadsheet tabs — not a drawer, not
bottom tabs). Left side: primary destinations. Right side: signed-in staff name +
initials avatar + Sign Out. The active destination uses `primary` text + a 2px
`primary` bottom border. Desktop-first; the bar collapses to a single row of
icon+label items down to 768px.

Primary destinations, left to right: **Dashboard · Check-In · Check-Out · Search · Directory**

### Screen List

| Screen | Route/Path | Purpose | Key Components |
|--------|-----------|---------|----------------|
| Sign In | `/login` | Authenticate staff (username + password) | Centered card, username field, password field, Sign In button, inline error |
| Dashboard | `/` | Daily status overview | Date selector (defaults today), 3 stat cards (Checked In / Picked Up / Pending), recent check-ins table |
| Check-In | `/check-in` | Record an incoming parcel | Tracking Code scan/input, Room Number autocomplete (directory-validated), Check In Parcel button, running list of today's check-ins |
| Check-Out | `/check-out` | Hand parcels to a resident | Room Number search field, resident header, pending-parcels table with row checkboxes, Check Out All button, Check Out Selected button |
| Search & Lookup | `/search` | Find any parcel | Single search input (room number / tracking code / resident name), segmented result table, pagination, row → Parcel Detail |
| Parcel Detail | `/parcels/:trackingCode` | Inspect one parcel + its history | Parcel summary card, status chip, Parcel History timeline (staff + timestamp per event) |
| Directory | `/directory` | Read-only resident/room reference | Search/filter input, paginated table (Room, Building, Resident, Nickname), no edit actions in v1 |
| Not Found | `*` | Fallback for unknown routes | Message + link back to Dashboard |

Route paths are unique. All routes except `/login` require an authenticated staff session.

### Navigation Flow

```
                         [/login]
                            |
                     (successful sign in)
                            v
                       [Dashboard /]
        ______________/    |    \______________
       |            |      |      |            |
       v            v      v      v            v
 [Check-In]  [Check-Out] [Search] [Directory] (Sign Out -> /login)
     |            |         |
     |            |         v
     |            |   [Parcel Detail /parcels/:trackingCode]
     |            |         ^
     |            |_________/  (row click from Check-Out list)
     |
     v
 (Check In Parcel success -> stay on /check-in, prepend to today's list)

 Check-Out:  enter Room Number -> pending list ->
             "Check Out All"        -> confirm dialog -> success toast -> list clears
             "Check Out Selected"   -> success toast  -> checked rows leave list
```

---

## 4. Data Models

Store: **PostgreSQL**. Backend: **Go + Gin** (see §7 note re: proposal text).

### Collection/Table Names

| Entity | Table Name | Primary Key | Notes |
|--------|-----------|-------------|-------|
| Dormitory building | `buildings` | `id` | Seeded with B1–B10; reference data (a room's building) |
| Room | `rooms` | `id` | Belongs to a building; `(building_id, room_number)` unique |
| Resident (directory) | `residents` | `id` | Reference data; the official name↔room source of truth |
| Staff account | `staff` | `id` | Has a role for RBAC |
| Parcel | `parcels` | `id` | `tracking_code` is the unique natural/business key |
| Parcel history event | `parcel_events` | `id` | Append-only audit trail (chain of custody) |

### Field Naming Convention

- **DB column case:** `snake_case`. **API JSON case:** `camelCase` (serializer maps between them).
- **Timestamps:** `created_at`, `updated_at`, and event-specific (`checked_in_at`, …). Type `timestamptz`, always stored UTC, serialized as ISO 8601.
- **IDs:** internal PK `id` = `bigint GENERATED ALWAYS AS IDENTITY`. No UUIDs. `parcels.tracking_code` is the externally meaningful key.
- **Booleans:** prefix `is_` / `has_` (e.g. `is_active`). Serialized `isActive`.
- **Enums:** native PostgreSQL `ENUM` types; values are `lowercase_snake`.

### Enums

| Enum type | Values |
|-----------|--------|
| `staff_role` | `operator`, `admin` |
| `parcel_status` | `pending`, `picked_up`, `archived` |
| `parcel_event_type` | `checked_in`, `checked_out`, `checked_out_bulk`, `note_added` |

### Core Models

#### buildings
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | bigint | Y | identity | PK |
| code | text | Y | — | `B1`..`B10`; unique |
| name | text | Y | — | Human label, e.g. "Building 1" |
| created_at | timestamptz | Y | now() | |

#### rooms
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | bigint | Y | identity | PK |
| building_id | bigint | Y | — | FK → buildings.id |
| room_number | text | Y | — | e.g. "1042"; unique per building |
| created_at | timestamptz | Y | now() | |
| — | — | — | — | UNIQUE(building_id, room_number) |

#### residents
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | bigint | Y | identity | PK |
| room_id | bigint | Y | — | FK → rooms.id |
| full_name | text | Y | — | Official directory name (validation target) |
| nickname | text | N | null | Label/nickname aid for search fallback (nickname mismatch problem) |
| phone | text | N | null | Contact for pickup notice; PII — restricted |
| is_active | boolean | Y | true | Former residents kept for historical parcels |
| created_at | timestamptz | Y | now() | |
| updated_at | timestamptz | Y | now() | |

#### staff
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | bigint | Y | identity | PK |
| username | text | Y | — | Unique login handle |
| password_hash | text | Y | — | Argon2id or bcrypt, salted. Plaintext never stored/logged |
| full_name | text | Y | — | Shown in nav + audit trail |
| role | staff_role | Y | `operator` | RBAC; `admin` may access Directory management (post-v1) |
| is_active | boolean | Y | true | Disabled accounts cannot sign in |
| last_login_at | timestamptz | N | null | |
| created_at | timestamptz | Y | now() | |
| updated_at | timestamptz | Y | now() | |

#### parcels
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | bigint | Y | identity | PK |
| tracking_code | text | Y | — | Courier barcode value; UNIQUE |
| room_id | bigint | Y | — | FK → rooms.id; chosen from directory, never free-text |
| resident_id | bigint | N | null | FK → residents.id; set when a specific recipient is known |
| status | parcel_status | Y | `pending` | |
| note | text | N | null | Free-text note (e.g. "no room number on box") |
| checked_in_by | bigint | Y | — | FK → staff.id |
| checked_in_at | timestamptz | Y | now() | |
| checked_out_by | bigint | N | null | FK → staff.id |
| checked_out_at | timestamptz | N | null | |
| created_at | timestamptz | Y | now() | |
| updated_at | timestamptz | Y | now() | |

Indexes (Performance Risk — Med/High):
- `UNIQUE (tracking_code)`
- `INDEX (room_id, status)` — pending parcels per room (Check-Out)
- `INDEX (status, checked_in_at)` — Dashboard daily counts
- `INDEX (tracking_code text_pattern_ops)` — prefix search
- GIN trigram on `residents.full_name` and `residents.nickname` — name search
- All list endpoints are paginated; no unbounded result sets.

#### parcel_events
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| id | bigint | Y | identity | PK |
| parcel_id | bigint | Y | — | FK → parcels.id |
| event_type | parcel_event_type | Y | — | |
| staff_id | bigint | Y | — | FK → staff.id; who performed the action |
| occurred_at | timestamptz | Y | now() | |
| detail | jsonb | N | null | Note text for `note_added` |
| — | — | — | — | INDEX(parcel_id, occurred_at); append-only, no UPDATE/DELETE |

---

## 5. Copy & Microcopy

### Key UI Strings

| Context | String | Notes |
|---------|--------|-------|
| Empty state — Dashboard | "No parcels checked in yet for {date}." | Shown when the day's list is empty |
| Empty state — Check-Out | "No pending parcels for Room {roomNumber}." | After a room search returns nothing |
| Empty state — Search | "No parcels match "{query}". Try a room number, tracking code, or resident name." | |
| Empty state — Directory | "No residents match "{query}"." | |
| Error — generic | "Something went wrong. Please try again." | Fallback error message |
| Error — network | "Can't reach the server. Check your connection and try again." | No connection / timeout |
| Error — auth | "Your session has expired. Please sign in again." | 401 → redirect to /login |
| Error — sign in failed | "Incorrect username or password." | Do not reveal which field is wrong |
| Error — room not in directory | "Room "{value}" isn't in the resident directory. Pick a room from the list." | Blocks free-text room entry |
| Error — duplicate tracking code | "Tracking code {trackingCode} is already checked in for Room {roomNumber} ({checkedInAt})." | Prevents double check-in |
| Error — required field | "This field is required." | Inline under the field |
| Success — check-in | "Checked in — {trackingCode} → Room {roomNumber}." | Toast, `success` color |
| Success — check-out (single) | "Checked out 1 parcel for Room {roomNumber}." | Toast |
| Success — check-out (all) | "Checked out {count} parcels for Room {roomNumber}." | Toast |
| Confirm — check out all | "Check out all {count} pending parcels for Room {roomNumber}?" | Dialog title; buttons "Check Out All" / "Cancel" |
| CTA — primary (Check-In) | "Check In Parcel" | `secondary` (green) button |
| CTA — primary (Check-Out) | "Check Out All" | `primary` button |
| CTA — secondary (Check-Out) | "Check Out Selected" | Outlined button; disabled until ≥1 row checked |
| CTA — Sign In | "Sign In" | |
| Loading — generic | "Loading…" | |
| Loading — search | "Searching…" | |
| Hint — tracking code field | "Scan or type the tracking code" | |
| Hint — room number field | "Type a resident name or room number" | Autocomplete against directory |
| Badge — missing room | "No room number" | `warning` chip on Search/Detail |
| Status chip — pending | "Pending" | `neutral500` on `neutral100` |
| Status chip — picked up | "Picked Up" | `success` |
| Status chip — archived | "Archived" | `neutral500` |
| Nav — Sign Out | "Sign Out" | |

### String Storage Convention

All user-facing strings MUST live in:
- **`src/i18n/en.json`** (frontend), keyed by dot-path (e.g. `checkin.success`, `errors.roomNotFound`).

Backend returns stable machine `code` values (e.g. `ROOM_NOT_IN_DIRECTORY`); the
frontend maps codes → `en.json` messages. Zero hardcoded user-facing strings in
UI components or in Go handlers. English only in v1 (structure supports adding
`th.json` later — out of scope now).

---

## 6. Iconography & Assets

Icon set: **lucide-react** (MIT, tree-shakeable, Tailwind-friendly). One set only.

| Icon/Asset | Source | Usage |
|-----------|--------|-------|
| App icon | `package` glyph, white on `#1A73E8`, rounded-md | Favicon, login header, browser tab |
| Dashboard | `layout-dashboard` | Nav |
| Check-In | `scan-line` | Nav, Check-In screen title |
| Check-Out | `package-check` | Nav, Check-Out screen title |
| Search | `search` | Nav, search inputs |
| Directory | `book-user` | Nav |
| Sign Out | `log-out` | Nav (right side) |
| Success toast | `circle-check` | `success` color |
| Error / warning | `alert-triangle` | `error` / `warning` color |
| Building | `building-2` | Directory, Parcel Detail |
| Loading | `loader-circle` (spin) | Buttons, list placeholders |
| Row selected | `check` | Check-Out table checkboxes |
| History event | `history` | Parcel History timeline |

No raster image assets in v1 beyond the generated favicon/app icon. No
illustrations. Empty states are text-only per the spreadsheet-like aesthetic.

---

## 7. Platform-Specific Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| Backend framework | **Go + Gin** | All six `.claude/agents` definitions and the three-tier architecture spec name Go/Gin. Proposal §5.3 text says "Next.js" — treated as stale; see Migration Items. |
| Frontend | React.js + Tailwind CSS (Vite) | Proposal §5.3 + `frontend-react` agent. Vite chosen over Next.js — no SSR need for an internal tool; simplest conventional React setup. |
| Target platforms | Web app only | Mobile app is explicitly Out-of-Scope (proposal §4.2) |
| Min browser support | Last 2 versions of Chrome, Edge, Firefox, Safari | Staff use managed counter PCs; no legacy-IE requirement |
| Layout baseline | Desktop-first, 1280px design width; usable down to 768px | Staff work at counter workstations; tablet is the realistic small case, phones are not |
| Orientation lock | N/A (web) | — |
| Dark mode support | No (light only) in v1 | Bright counter environment; mirrors Google Sheets' light UI. Tokens are structured to allow a dark theme later without renaming. |
| Offline support | No | Check-in requires live directory validation; every action must reach the server-side audit trail |
| Auth method | Username + password (staff accounts), server session cookie over HTTPS | No public sign-up, no social, no anonymous. Passwords hashed + salted (Argon2id/bcrypt). |
| Access control | Role-based (`operator`, `admin`), enforced at the API layer | Proposal §8.1; frontend must not be the only gate |
| Transport | HTTPS assumed in front of the app; DB encryption at rest + in transit | Proposal §8.1 — deployment-layer config (devops-docker) |
| Data retention | Parcels move to `status = 'archived'` after a defined window post-pickup; never hard-deleted | Proposal §8.3 data-minimization; audit trail must survive |
| Deployment | Docker (docker-compose: frontend + backend + PostgreSQL) | Proposal §5.3. Fallback: direct hosting on Heroku / Vercel / Render (proposal Deployment Risk) |
| Timezone | Store UTC (`timestamptz`); display in dormitory local time (Asia/Bangkok) | Consistent audit timestamps, local readability |
| Localization | English only (v1); `en.json` structure ready for `th.json` | Not in scope now |

---

## 8. Migration Items

This is a greenfield project (no application code yet). Two existing-artifact
contradictions to resolve:

1. **Backend stack mismatch.** Proposal §5.3 "Technology Stack" lists
   `Backend: Next.js`, but `.claude/agents/backend-go.md`, `devops-docker.md`,
   `db-postgres.md`, and `qa-tester.md` all specify **Go + Gin**, and the
   three-tier description reads "React frontend / Go+Gin backend / PostgreSQL".
   → This spec LOCKS **Go + Gin**. Update the proposal's stack line at its next
   revision to remove the Next.js reference.

2. **README.md is a stub.** Current `README.md` is a UTF-16 file containing only a
   mangled title line (`Dormitory-Parcel-Management-Case-Studies-Project`).
   → Replace with a real README (project summary, stack, local dev via
   docker-compose, link to this spec).

No hardcoded colors, strings, spacing values, or field names exist to migrate yet.

---

## 9. Change Log

| Date | Section | Change | Reason |
|------|---------|--------|--------|
| 2026-09-04 | — | Initial spec created | Lock design decisions before implementation begins |
| 2026-09-04 | §1, §3, §4, §5, §6 | Removed Storage Location entirely: `storage_locations` table, `parcels.storage_location_id`, `parcels.is_oversized`, the Common Area / `COMMON` building code, the Oversized toggle & badge, the `location_changed` event type, and the Building select on Check-In. Check-In is now scan + directory-validated room only. `buildings` stays as reference data (a room's building). | Advisor/team decision — physical storage-location tracking is out of scope; parcels are set aside for pickup without a system-tracked location. See `docs/05-log/20260904-remove-storage-location.md` |
