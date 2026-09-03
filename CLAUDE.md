# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Read first, every session

- **`PROJECT_STRUCTURE.md`** — the repo map. Read it to find where anything lives before searching.
  When you add, move, or remove a top-level folder (or change what one is for), update
  `PROJECT_STRUCTURE.md` in the same change.

## What this project is

The **Dormitory Parcel Management System** — a web application that replaces a dormitory
front desk's Google Forms + Google Sheets parcel workflow. It is a Software Engineering
Seminar project (team of 3, Agile Scrum, 2-week sprints, ~20-week timeline).

The dormitory handles ~418 incoming + ~418 outgoing parcels/day, surging to **~1,024
parcels/day during Flash Sale periods**. The current spreadsheet workflow is slow under
load and error-prone: parcels arrive with no room number, names on labels are nicknames
that don't match official records, handwriting is unreadable, parcels get mis-shelved,
and room numbers get swapped so parcels reach the wrong resident.

The system centralizes parcel records in PostgreSQL, **validates room numbers against the
official resident directory at entry** (no free-text room numbers), tracks physical
storage location, and stays fast under peak load — **while keeping a UI that closely
mirrors the existing spreadsheet**, so staff need almost no retraining.

## Status

**Pre-implementation.** No application code exists yet (Milestones 1–2: analysis, SRS,
UX/UI design). Repo layout is documented in `PROJECT_STRUCTURE.md`. The authoritative
documents are:

- `Project Proposal_Dormitory Parcel Management System.docx` (repo root) — full proposal (scope, goals, risks, timeline, ethics)
- `docs/02-design/design-spec.md` — **LOCKED** design decisions: identity, terminology, design tokens, screen inventory, data models, microcopy. Conform to it; do not change values in it without updating everything that references them.
- `docs/02-design/user_journey.md` — staff check-in and resident pickup journeys
- `docs/01-requirements/backlog.md` — the product backlog (one row per requirement); detail in `docs/01-requirements/01-spec/`
- `rule.md` — legal/compliance rules (PDPA, Computer Crime Act §26, Electronic Transactions Act) the system must satisfy

## Tech stack (locked — see docs/02-design/design-spec.md §7)

| Tier | Choice |
|------|--------|
| Frontend | React.js + Tailwind CSS, built with Vite |
| Backend | **Go + Gin** (the proposal's §5.3 text says "Next.js" — treat as stale; all agents and the architecture spec say Go/Gin) |
| Database | PostgreSQL |
| Deployment | Docker / docker-compose (3-tier). Fallback: Heroku / Vercel / Render |

Three-tier architecture: React client → Go/Gin API (business logic, room-number validation,
barcode handling) → PostgreSQL. Keep the stack small — do not add frameworks/libraries
beyond this set without flagging it (Technical Risk mitigation).

## Scope — strict

**In scope (4 features only):**
1. **Parcel Check-In** — scan tracking barcode, select+validate room number against the directory, assign storage location (building 1–10 or Common Area, plus shelf/bin)
2. **Parcel Check-Out** — search by room number, view all pending parcels; check out ALL in one action OR select individual items. Both paths always available.
3. **Search & Lookup** — by room number, tracking code, or resident name; fast under concurrent load
4. **Daily Status Dashboard** — counts of received / picked up / pending for the day

Plus: read-only Resident/Room Directory reference, and an audit trail on every check-in/check-out.

**Out of scope:** handwriting OCR, mobile app (web only), direct courier API integration.
New feature requests go through advisor review — flag them as scope creep, don't just build them.

## Non-negotiable constraints

- **Room number is never a free-text field.** Always autocomplete/dropdown validated against `residents` (FK, not text). Re-validate server-side; never trust the client.
- **Audit trail:** every check-in and check-out logs staff ID + timestamp (chain of custody for misdelivery disputes). Append-only.
- **RBAC enforced at the API layer** (roles `operator`, `admin`) — the frontend is not the gate.
- **Security:** passwords hashed + salted; HTTPS assumed in front of the app; PostgreSQL encryption at rest + in transit.
- **Performance (Med likelihood / High impact risk):** indexes on room number and tracking code; paginate every list endpoint (no unbounded result sets); design for load testing up to 1,024 parcels/day.
- **UX:** mirror the Google Sheets/Forms layout. Low-typing workflow (barcode scan + dropdowns over free text), sufficient color contrast, keyboard navigation. Don't add friction (extra confirm dialogs, multi-step modals) to check-in/check-out.
- **Data retention:** parcels are archived (status change), never hard-deleted.
- **Legal/compliance (`rule.md`):** PDPA — consent, purpose limitation, minimisation, and resident access/correct/delete for personal data. Computer Crime Act §26 — retain access/traffic logs ≥ 90 days, each tied to a real user. Electronic Transactions Act §9/26 — capture reliable digital evidence whenever a user confirms an action ("I agree", parcel handover).

## Conventions (from docs/02-design/design-spec.md)

- **Terminology is locked** — see docs/02-design/design-spec.md §1. Use exactly: Parcel, Check-In, Check-Out, Pending, Picked Up, Tracking Code, Room Number, Resident, Staff, Storage Location, Common Area. No synonyms in code, UI, tests, or docs.
- **DB columns:** `snake_case`. **API JSON:** `camelCase`. Timestamps `timestamptz`, UTC, ISO 8601. PKs `bigint` identity; `parcels.tracking_code` is the business key. Booleans `is_`/`has_`. Enums = native PG enums, `lowercase_snake` values.
- **Colors/spacing/typography:** reference design tokens only — zero hardcoded hex or inline font sizes. Tailwind config maps the tokens.
- **User-facing strings:** live in `src/i18n/en.json` (frontend); backend returns stable machine `code` values the frontend maps to messages. Zero hardcoded UI strings.
- **Icons:** lucide-react, one set only.

## Data model (see docs/02-design/design-spec.md §4 for full field lists)

Tables: `buildings`, `rooms`, `residents` (the official directory), `staff`,
`storage_locations`, `parcels`, `parcel_events` (audit trail).
Enums: `staff_role`, `parcel_status` (`pending` / `picked_up` / `archived`),
`parcel_event_type`.

## Requirements & backlog workflow

Current phase. All requirements work lives under `docs/01-requirements/`:

- `backlog.md` — product backlog, one row per requirement (`FR-*`, `NFR-*`, `CON-*`). Never renumber an ID; deprecate instead.
- `01-spec/{YYYYMMDD}-{no}-{topic}.md` — one detailed spec per requirement (story, Given/When/Then acceptance criteria, data, screens, compliance, traceability). Use `01-spec/_template.md`.
- Scope gate: anything outside Check-In / Check-Out / Search / Dashboard / Directory / audit trail goes to the backlog's **scope-creep parking lot**, not into an active requirement.
- Every requirement touching resident data, a logged action, or an "I agree"/handover confirmation must cite the `rule.md` clause it satisfies.

Use `requirement-writer` / `/capture-requirement` to add requirements, and
`backlog-auditor` / `/audit-backlog` to check backlog health (writes a report to `docs/05-log/`).

Working notes and dated artifacts go in `docs/05-log/{YYYYMMDD}-log.md`.

## Sub-agents

Specialist agents in `.claude/agents/` — invoke the matching one for its domain:

| Agent | Domain |
|-------|--------|
| `requirement-writer` | Turn intent into `FR/NFR/CON` requirements + user stories + backlog entries (Milestone 1 / SRS) |
| `backlog-auditor` | Audit `backlog.md` for well-formedness, traceability, scope creep, compliance coverage |
| `frontend-react` | React + Tailwind staff UI; enforces the "looks like the spreadsheet" constraint |
| `backend-go` | Go/Gin API: check-in/out handlers, room validation, search, dashboard, RBAC, audit |
| `db-postgres` | Schema, migrations, indexing, query performance |
| `data-seeder` | Synthetic resident/parcel datasets (no production data available — a stated Data Risk) |
| `qa-tester` | Unit/integration tests, load tests vs peak volume, UAT feedback structuring |
| `devops-docker` | Dockerfiles, docker-compose, backup hosting plan |

## Commands

No build/test/lint commands yet — scaffolding hasn't started. Add them here once the
frontend (`npm` / Vite) and backend (`go`) projects exist, and move the corresponding
folders from "planned" to "current" in `PROJECT_STRUCTURE.md`.

The `.docx` proposal is binary; read its text with:
`unzip -p "Project Proposal_Dormitory Parcel Management System.docx" word/document.xml | sed 's/<[^>]*>/ /g'`
