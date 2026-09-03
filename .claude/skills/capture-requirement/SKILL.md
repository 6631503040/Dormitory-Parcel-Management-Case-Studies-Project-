---
name: "capture-requirement"
version: 1.0.0
category: build
platforms: [CLAUDE_CODE, CURSOR, CODEX_CLI]
description: "Turn an idea, request, or proposal paragraph into a written requirement — a spec file plus a backlog entry — for the Dormitory Parcel Management System. Triggers: capturing a new requirement, writing a user story, drafting SRS content, adding a backlog item."
---
Capture one requirement (or one small feature) as a spec file and a backlog entry.
Do NOT write application code. Ask the user only if the intent is genuinely ambiguous;
otherwise decide and note the assumption.

INPUT:
$ARGUMENTS

## Step 1 — Read the sources

- `Project Proposal_Dormitory Parcel Management System.docx` (binary: `unzip -p "<path>" word/document.xml | sed 's/<[^>]*>/ /g'`)
- `docs/02-design/design-spec.md` — §1 terminology (mandatory wording), §3 screens, §4 data models
- `docs/02-design/user_journey.md`
- `rule.md` — compliance obligations
- Existing `docs/01-requirements/01-spec/*.md` and `docs/01-requirements/backlog.md` — avoid duplicates, find the next ID

## Step 2 — Classify and scope

- Type: `FR-<n>` (functional) · `NFR-<n>` (performance / security / usability / retention) · `CON-<n>` (constraint)
- In the locked scope? (Check-In, Check-Out bulk+individual, Search & Lookup, Daily Dashboard, read-only Directory, audit trail)
  - Yes → continue.
  - No → still write the backlog entry, status `SCOPE-CREEP — needs advisor review`; stop before writing a full spec.

## Step 3 — Write the spec file

Path: `docs/01-requirements/01-spec/{YYYYMMDD}-{no}-{topic}.md`
(`{no}` = next unused number for today; `{topic}` = short-kebab). Use `_template.md` in that folder.

Contents:
- **ID + title**
- **User story:** "As a <staff operator | staff admin | resident>, I want <goal>, so that <reason>."
- **Description / context** — the problem from the proposal this addresses.
- **Acceptance criteria** — numbered Given / When / Then. Concrete and testable. Replace every vague word with a number or a defined behaviour.
- **Out of scope** — what this requirement explicitly does not cover.
- **Data touched** — tables/fields from design-spec.md §4.
- **Screens** — from design-spec.md §3.
- **Compliance** — if it touches resident personal data, a logged action, or an "I agree"/handover confirmation: name the `rule.md` clause (PDPA / Computer Crime Act §26 / Electronic Transactions Act §9/26/28) and state how the requirement satisfies it. Otherwise write "N/A — no personal data, no logged action, no confirmation."
- **Traceability** — proposal objective it serves.
- **Priority** — MoSCoW (Must / Should / Could / Won't-now) with a one-line reason.

## Step 4 — Add the backlog entry

Append a row to `docs/01-requirements/backlog.md` (keep the table's column order): ID, title, story (short), priority, status (`draft`), spec-file link, traceability.

## Step 5 — Verify

- Terminology matches design-spec.md §1 exactly (no "package", "student", "pickup" as a code term…).
- Every acceptance criterion is verifiable by QA without asking a question.
- Spec file and backlog entry agree.

## Output

- Spec file created: `<path>`
- Backlog entry added: `<ID> — <title>`
- Assumptions made: `<list or "none">`
- Scope-creep parked: `<yes/no>`
