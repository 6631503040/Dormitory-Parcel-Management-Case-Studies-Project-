# UAT datasets (Test Plan 5.3.1)

Starting data, labels and moderator cards for the UAT sessions on 4 November (S01-S10), the two
reserves (S11 Staff, S12 Resident) and the 3 November pilot. All data is synthetic: rooms and
Resident names come from the seeded directory.

Each session has rooms of its own (directory rooms with one Resident and no Parcels), so sessions
never share data and nothing has to be reset between them. Tracking Codes carry the session:
`TP69-S01-P01`.

| Session | Rooms | Starts with |
|---|---|---|
| Staff (S01-S05, S11, pilot) | A and B | A: P01-P03 Pending, B: Q01 Pending (put there by `seed`) |
| Resident (S06-S10, S12, pilot) | C | nothing; the moderator checks in N01-N02 during UAT08 and N03 during UAT10 |

`G…` codes (GP01, GN01, …) are for the existing method (the Google Forms/Sheets copy) only and
never enter the new system.

## Use

```bash
cd docs/03-test/uat-dataset
export UAT_USERNAME=admin UAT_PASSWORD=...     # a Staff account on the target; never commit it
# UAT_BASE_URL defaults to the Render deployment

node uat-dataset.mjs plan     # read-only: picks the rooms, writes plan.json (already committed)
node uat-dataset.mjs seed     # Check-In P01-P03 / Q01 for every Staff session (safe to re-run)
node uat-dataset.mjs status   # read-only: every row should say "ready" before its session
node uat-dataset.mjs print    # rebuilds out/ from plan.json (no network)
```

Run `seed` once before the pilot, then `status` before each session. Re-run `plan` only if
`status`/`seed` reports that a planned room has other Pending Parcels; it rewrites `plan.json`, so
reprint `out/` afterwards.

## Output (`out/`)

| File | Use |
|---|---|
| `labels.html` | Code 128 labels per session, printed at 100%: the Parcels already in the system (for Check-Out), the UAT01 scans, the UAT02 damaged label (barcode hatched, code readable), the Resident UAT08/UAT10 codes, and the existing-method codes |
| `cards.html` | One page per session for the moderator: rooms and Resident names, codes per task, the correct answers, before/after checks |
| `google-sheet/<session>-check-in.csv`, `-check-out.csv` | Rows to paste into the existing-method Sheet copy before that session (columns: ประทับเวลา, เลขห้อง, เลขพัสดุ) |

Test one printed label with the project scanner before the pilot.
