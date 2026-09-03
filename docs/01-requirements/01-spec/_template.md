<!-- Copy this file to {YYYYMMDD}-{no}-{topic}.md and fill in. Delete these comments. -->

# {FR-n | NFR-n | CON-n} — {Short title}

- **Status:** draft <!-- draft | ready | in-progress | done | deprecated | SCOPE-CREEP — needs advisor review -->
- **Priority:** {Must | Should | Could | Won't-now} — {one-line reason}
- **Backlog entry:** {ID} in ../backlog.md
- **Author / date:** {name} / {YYYY-MM-DD}

## User story

As a {staff operator | staff admin | resident}, I want {goal}, so that {reason}.

## Description / context

{The problem from the proposal this addresses. 2–4 sentences.}

## Acceptance criteria

1. **Given** {precondition} **when** {action} **then** {observable, testable result}.
2. **Given** … **when** … **then** …
<!-- Replace every vague word ("fast", "easy") with a number or a defined behaviour. -->

## Out of scope

- {What this requirement explicitly does not cover.}

## Data touched

- Tables/fields from design-spec.md §4: {e.g. parcels(status, room_id), parcel_events}

## Screens

- design-spec.md §3: {e.g. Check-In `/check-in`}

## Compliance (rule.md)

<!-- If it touches resident personal data, a logged action, or an "I agree"/handover
confirmation, name the clause and how this requirement satisfies it. Otherwise: -->
N/A — no personal data, no logged action, no confirmation.

## Traceability

- Proposal objective: {which objective / section this serves}
