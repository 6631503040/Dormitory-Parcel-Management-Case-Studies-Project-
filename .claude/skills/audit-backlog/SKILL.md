---
name: "audit-backlog"
version: 1.0.0
category: review
platforms: [CLAUDE_CODE, CURSOR, CODEX_CLI]
description: "Audit the product backlog for the Dormitory Parcel Management System — well-formedness, traceability, duplication, staleness, scope creep, and compliance coverage. Reports findings ranked by severity; does not invent requirements. Triggers: before a sprint review, or after the backlog changes a lot."
---
Audit `docs/01-requirements/backlog.md` and its spec files. Report problems.
Do NOT write new requirements. You may fix formatting/consistency in backlog.md;
flag anything substantive for a human.

INPUT (optional — a subset of items or an area to focus on):
$ARGUMENTS

## Read

- `docs/01-requirements/backlog.md`
- `docs/01-requirements/01-spec/*.md`
- `Project Proposal_Dormitory Parcel Management System.docx` (scope + objectives)
- `docs/02-design/design-spec.md` (§1 terminology, §3 screens, §4 data models)
- `rule.md` (PDPA / Computer Crime Act §26 / Electronic Transactions Act)

## Checks

**Well-formedness** — every item has ID, story, MoSCoW priority, status, spec link. Roles are only staff (operator/admin) or resident. Acceptance criteria live in the spec, are Given/When/Then, and contain no vague terms. Each item is INVEST-sized (flag epics posing as stories).

**Traceability** — every item → a proposal objective (flag orphans). Every item → ≥1 screen in design-spec.md §3. Every spec file ↔ a backlog entry, both directions (flag orphans). IDs unique, never reused; deprecated items marked not deleted.

**Hygiene** — duplicates / overlaps. Stale items (`in-progress` untouched > 2 sprints; `blocked` with no reason). Priority inflation (not everything is Must; Musts trace to a core objective). Terminology drift vs design-spec.md §1.

**Scope** — anything outside the locked scope (Check-In, Check-Out bulk+individual, Search, Dashboard, Directory, audit trail) must be status `SCOPE-CREEP — needs advisor review`, not active.

**Compliance coverage** — is there a backlog item for:
- PDPA handling of resident personal data (consent, purpose limit, access/correct/delete)?
- ≥90-day access/traffic log tied to a real user for every check-in/check-out (Computer Crime Act §26)?
- captured digital evidence for any "I agree" / parcel-handover confirmation (Electronic Transactions Act §9/26)?
Flag each missing one.

## Output

Write `docs/05-log/{YYYYMMDD}-backlog-audit.md` and summarise in chat:
- Counts — total items, by status, by priority.
- Findings, ranked: **BLOCKER** (traceability or compliance gap, active scope-creep) → **SHOULD-FIX** (hygiene, INVEST, priority inflation) → **NIT** (formatting, wording).
- Each finding: affected item ID(s), the problem, a suggested fix.
- Apply only formatting fixes; list substantive fixes as recommendations.
