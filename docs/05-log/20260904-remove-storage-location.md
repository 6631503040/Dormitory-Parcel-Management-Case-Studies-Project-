# Decision — Remove Storage Location from scope

**Date:** 2026-09-04
**Type:** Scope reduction (design-spec change — spec is LOCKED)
**Decided by:** Advisor / team (relayed by Sadayu / Petch)
**Applied by:** Claude Code

---

## Decision

Physical **storage-location tracking is cancelled**. The system no longer records
*where* a parcel is put after check-in. Check-In becomes: **scan the Tracking Code +
select a directory-validated Room Number**, then save. Staff set the parcel aside for
pickup without the system tracking a shelf/bin, building, or area.

### Removed

| Thing | Where it lived |
|---|---|
| `storage_locations` table | design-spec §4 |
| `parcels.storage_location_id` FK | design-spec §4 |
| `parcels.is_oversized` boolean | design-spec §4 |
| **Common Area** term + `COMMON` building code | design-spec §1, §4 |
| **Storage Location** term | design-spec §1 |
| Oversized toggle (Check-In) + Oversized badge/chip | design-spec §3, §5, §6 |
| Building select on Check-In | design-spec §3 |
| Storage Location field on Parcel Detail | design-spec §3 |
| `location_changed` value in `parcel_event_type` enum | design-spec §4 |
| `map-pin` (Storage location) icon | design-spec §6 |
| Check-in success toast `{buildingCode} {storageLabel}` fields | design-spec §5 |
| User-journey steps "Select the storage location" / "Place the parcel in storage" | user_journey.md |

### Kept

- **`buildings`** table and the **Building** term — still reference data: every room
  belongs to a building, and the Directory shows it. Buildings are just no longer
  assigned to a parcel.
- `parcels.note` free-text field — unchanged (e.g. "no room number on box").
- The `warning` color token — still used for the "No room number" flag.

## Rationale

Storage-location tracking added extra selection friction to the highest-frequency action
(check-in) and a table + FK + enum value + three UI fields to maintain, for a mis-shelving
problem the team judged the system can only weakly mitigate. Room validation at intake —
the actual #1 pain (identification failures) — is untouched.

## Files changed

- `docs/02-design/design-spec.md` — version bumped 1.0 → 1.1; §9 change-log entry added
- `docs/02-design/user_journey.md` — check-in journey shortened to 5 steps
- `docs/02-design/spec.md` — dropped the "Parcel storage tracking" scope bullet; removed "shelve" from the core-workflow line
- `docs/02-design/company_charter.md` — dropped "tracks shelf location"; removed "shelve" from the one-line workflow *(note: charter is marked "Submitted" — this edits a submitted deliverable to keep the repo consistent)*
- `CLAUDE.md` — scope feature 1, locked-terminology list, data-model table list, intro paragraph
- `.claude/agents/` — `backend-go.md`, `db-postgres.md`, `frontend-react.md`, `data-seeder.md`, `qa-tester.md`
- `docs/05-log/20260904-frontend-prototype-review.md` — finding **C2** marked superseded (not deleted)

## Follow-ups / open items

- **Parallel doc set** (`docs/02-design/spec.md`, `company_charter.md`, `feature-list.md`,
  `product_backlog.md`) uses SDPMS / JOBAS naming and different scope (LINE, OCR, unmatched
  queue). Storage refs there are now removed, but which doc set is canonical is still undecided.
- `docs/01-requirements/backlog.md` and `01-spec/` were deleted in commit `4e3ff0b`; the
  prototype review still cites `FR-2` / `FR-3`. Reconcile separately.
- No application code exists yet, so there is nothing to migrate — the removal is
  documentation-only at this stage.
