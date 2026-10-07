# Project Structure

> The map of this repository. **Read this at the start of every session** to locate things.
> **Keep it current:** whenever you add, move, or remove a top-level folder or a `docs/`
> subfolder — or change what one is for — update this file in the same change. `CLAUDE.md`
> points here.

Last updated: 2026-09-22 (frontend wired to the API) | Phase: implementation started — Go API + PostgreSQL exist; the React client in `docs/02-design/prototype/` now calls that API (see its `src/api/`)

---

## Current layout

```
Case Studies Project/
├── CLAUDE.md                  # Project guide for Claude Code — constraints, stack, conventions, workflow
├── PROJECT_STRUCTURE.md       # This file — the repo map
├── README.md                  # Repo readme (stub — needs rewriting)
├── rule.md                    # Legal/compliance rules (PDPA, Computer Crime Act §26, Electronic Transactions Act)
├── Project Proposal_Dormitory Parcel Management System.docx   # Original proposal (source of truth for scope/goals/risks)
│
├── backend/                   # Go + Gin REST API (module `dpms/backend`) — see backend/README.md
│   ├── cmd/server/            #   API entrypoint (applies db/migrations on start)
│   ├── cmd/seed/              #   Synthetic data: directory, staff, ~1,000 parcels (dev only)
│   └── internal/              #   apperr (error codes) · config · db (pool + migrator) · auth · store (all SQL) · api (routes, handlers, integration tests)
├── db/
│   └── migrations/            # PostgreSQL schema, applied in filename order (0001 = design-spec §4; 0002+ = documented extensions)
├── docker/                    # docker-compose.yml (db + backend), backend.Dockerfile, .env.example (copy to .env, gitignored)
│
├── docs/                      # Numbered documentation, one folder per project phase/artifact
│   ├── 01-requirements/       # Milestone 1 — requirements & SRS
│   │   ├── backlog.md         #   Product backlog: one row per requirement (FR-*/NFR-*/CON-*) + scope-creep parking lot
│   │   └── 01-spec/           #   One detailed spec per requirement
│   │       ├── _template.md   #     Copy this for a new spec
│   │       ├── README.md      #     Naming: {YYYYMMDD}-{no}-{topic}.md
│   │       └── {YYYYMMDD}-{no}-{topic}.md   #  the specs themselves
│   ├── 02-design/             # Milestone 2 — design
│   │   ├── design-spec.md               #   LOCKED design decisions (identity, terminology, tokens, screens, data models, copy)
│   │   ├── user_journey.md              #   Staff check-in and resident pickup journeys
│   │   ├── company_charter.md           #   Course Week 1 deliverable — JOBAS Company charter
│   │   ├── product_backlog.md           #   Course Week 3→5 backlog (SDPMS naming) — see "Parallel doc set" note below
│   │   ├── feature-list.md              #   Course Week 4 deliverable — features grouped from product_backlog.md
│   │   ├── spec.md                      #   Requirements + design collapsed into one spec (SDPMS)
│   │   ├── rule.md                      #   SDPMS legal/compliance rules (parallel to root rule.md — see note)
│   │   ├── survey_interview_analysis.md #   Survey + interview findings (Thai) from 10 users + staff PDF
│   │   ├── diagram/                     #   Design diagrams (empty placeholder, not yet tracked)
│   │   └── prototype/                   #   React+Vite client — visually a prototype, but now calls the real backend API
│   │       ├── index.html, package.json, vite/tailwind/postcss/vitest configs
│   │       └── src/
│   │           ├── api/           #   client.js (fetch wrapper) + errorMessages.js (code → Thai text)
│   │           ├── constants/     #   unmatchedReasons.js (mirrors the DB enum)
│   │           ├── test/          #   Vitest setup, MSW server, fixtures shared by *.test.jsx files
│   │           └── components/    #   ParcelHubApp, Dashboard, Login, TopNav, Modals, Archive, RoomCombobox, UnmatchedQueue, ParcelHistoryModal, …
│   └── 05-log/                # Dated working log + meeting notes + audit reports
│       ├── README.md          #   Naming: {YYYYMMDD}-log.md, {YYYYMMDD}-backlog-audit.md, {YYYYMMDD}-{topic}.md
│       ├── {YYYYMMDD}-log.md
│       └── 20260904-frontend-prototype-review.md   #  review of the docs/02-design/prototype/ app
│
└── .claude/
    ├── agents/               # Specialist subagent definitions (see table below)
    └── skills/               # Installed skills — see "Skills" below
```

> **Parallel doc set (unresolved):** the `docs/02-design/*.md` files added via PR #4/#5
> (`company_charter.md`, `product_backlog.md`, `feature-list.md`, `spec.md`, `rule.md`,
> `survey_interview_analysis.md`) use different naming — "Smart Dormitory Parcel Management
> System (SDPMS)" / "JOBAS Company" — and partly duplicate the canonical docs
> (`docs/01-requirements/backlog.md`, root `rule.md`). Which set is authoritative has not
> been decided. Until it is, treat `CLAUDE.md` + `design-spec.md` + `docs/01-requirements/`
> + root `rule.md` as canonical and the `02-design/*.md` set as course-deliverable inputs.

`docs/` folders `03-*` and `04-*` are reserved by the course's numbering scheme and not
created yet. Add them when the corresponding phase starts and record them here.

Each `docs/` subfolder has a `README.md` describing what belongs there and its
conventions — read it before adding files.

---

## Planned layout (application code — add when scaffolding starts, Milestones 3–4)

**When you create one of these, move its row into "Current layout" and update the tree.**

| Folder | Purpose | Owning agent |
|--------|---------|--------------|
| `frontend/` | React.js + Tailwind CSS client, Vite (Client tier) | `frontend-react` |
| `db/seed/` | (not needed yet — seeding lives in `backend/cmd/seed`; move here only if SQL seeds are wanted) | `data-seeder` |
| `scripts/` | Dev/ops helper scripts (setup, load-test runners, data import) | `devops-docker` / `qa-tester` |

---

## Where does X go?

| If you're adding… | Put it in… |
|---|---|
| A requirement / user story (one-line index) | `docs/01-requirements/backlog.md` |
| The full spec for a requirement | `docs/01-requirements/01-spec/{YYYYMMDD}-{no}-{topic}.md` (from `_template.md`) |
| A feature request outside the locked scope | `docs/01-requirements/backlog.md` → scope-creep parking lot (status `SCOPE-CREEP`) |
| A wireframe, mockup, or UX flow diagram | `docs/02-design/` (diagrams → `docs/02-design/diagram/`) |
| Throwaway UI prototype code (not the real app) | `docs/02-design/prototype/` |
| A course deliverable doc (charter, survey analysis, etc.) | `docs/02-design/` — see "Parallel doc set" note |
| A design decision (color, term, screen, data model, copy) | `docs/02-design/design-spec.md` (LOCKED — update every reference too) |
| A daily working note / decision / blocker | `docs/05-log/{YYYYMMDD}-log.md` |
| Advisor meeting notes / sprint review | `docs/05-log/{YYYYMMDD}-{topic}.md` |
| A backlog audit report | `docs/05-log/{YYYYMMDD}-backlog-audit.md` (produced by `backlog-auditor`) |
| A project-wide rule Claude must always follow | `CLAUDE.md` |
| A legal/compliance rule for the system | `rule.md` |
| A new specialist subagent | `.claude/agents/<name>.md` |
| React components, pages, styles | `frontend/` *(once created)* |
| Go handlers, business logic, data access | `backend/internal/` (SQL only in `store/`) |
| A `CREATE TABLE` / `ALTER TABLE` migration | `db/migrations/` (new numbered file; never edit an applied one; log spec deviations in design-spec §9) |
| Synthetic test data | `backend/cmd/seed/` |
| A Dockerfile or compose change | `docker/` |

---

## Source-of-truth documents (read before making decisions)

1. `Project Proposal_Dormitory Parcel Management System.docx` (repo root) — scope, goals, risk plan, timeline, ethics. Binary; read with:
   `unzip -p "Project Proposal_Dormitory Parcel Management System.docx" word/document.xml | sed 's/<[^>]*>/ /g'`
2. `docs/02-design/design-spec.md` — LOCKED design/architecture decisions. Conform to it.
3. `docs/02-design/user_journey.md` — the two core user journeys.
4. `rule.md` — legal/compliance obligations (PDPA, Computer Crime Act §26, Electronic Transactions Act).
5. `docs/01-requirements/backlog.md` — what the system must do, and what's parked.

---

## Subagents (`.claude/agents/`)

| Agent | Domain |
|-------|--------|
| `requirement-writer` | Intent → `FR/NFR/CON` requirements, user stories, backlog entries (Milestone 1 / SRS) |
| `backlog-auditor` | Audit `backlog.md` for well-formedness, traceability, scope creep, compliance coverage |
| `frontend-react` | React + Tailwind staff UI; enforces the "looks like the spreadsheet" constraint |
| `backend-go` | Go/Gin API: check-in/out handlers, room validation, search, dashboard, RBAC, audit trail |
| `db-postgres` | Schema, migrations, indexing, query performance under peak load |
| `data-seeder` | Synthetic resident/parcel datasets mirroring real volume patterns |
| `qa-tester` | Unit/integration tests, load tests vs peak volume, UAT feedback |
| `devops-docker` | Dockerfiles, docker-compose, backup hosting plan |

## Skills (`.claude/skills/`)

| Skill | Use for |
|-------|---------|
| `capture-requirement` | Write one requirement — spec file + backlog entry (pairs with `requirement-writer`) |
| `audit-backlog` | Audit the backlog, report findings by severity (pairs with `backlog-auditor`) |
| `design-spec` | Regenerate/refresh `design-spec.md` |
| `code-review` | Review a diff/PR for correctness, security, performance, tests |
| `senior-backend` | Backend patterns/reference (Node/Express-oriented — code samples are off-stack vs Go/Gin) |
| `senior-frontend` | React/Next.js frontend patterns/reference |
