# UAT round 1 — results (Test Plan DPMS-TP-002, sections 5.3.1 and 5.3.2)

Real users at Baansoi5 Dormitory, 2–5 November 2026: **5 Staff (U01–U05) and 5 Residents (R01–R05).**
Participants are identified only by code. Real names are only in the consent spreadsheet, which is
not in this repo.

## Files

| File | What it is |
|---|---|
| `Parcel Desk – UAT results (DPMS-TP-002).xlsx` | The results workbook (export of the Google Sheet the `../../uat-forms.gs` forms write to). Sheets: Task records, Staff responses, Resident responses, Staff scores, Resident scores. |
| `task-records.csv` | **Session logs**: one row per task attempt (participant, build, task, method, status, time, errors, observations, defect ID). |
| `staff-responses.csv`, `resident-responses.csv` | Raw SUS + TAM answers (1–5 Likert), one row per participant. |
| `analyze_uat.py` | Recomputes every number on this page from the workbook, independently of the sheet's formulas, and writes the CSVs and `summary.txt`. Run from the repo root: `python docs/03-test/results/20261102-uat/analyze_uat.py` (needs `openpyxl`). |
| `summary.txt` | Output of the script — the source of every number below. The workbook's "scores" sheets give the same SUS/TAM values. |

## Method

- **Tasks** (Test Plan 5.3.1). Staff: UAT01–UAT06. Residents: UAT07–UAT10. Each participant did each
  task with the **new system** and with the **existing method** (Google Forms/Sheets, or asking at the
  desk). A moderator timed each task and noted errors and observations by hand; the notes were typed
  into the Task records sheet.
- **Existing-method times**: U01 was timed on 2 Nov; U02–U05 and R01–R05 were timed in additional
  sessions on 4–5 Nov, after their new-system sessions.
- **Questionnaire** (Test Plan 5.3.2), filled in right after the session: SUS (10 items) and TAM —
  Perceived Usefulness (PU, 4 items), Perceived Ease of Use (PEOU, 4), Behavioural Intention (BI, 3).
  Thai, with the English item beside it.
- **Builds**: U01 and U02 used `7dc4587` (2 Nov, before fix `5da15cc`). Everyone else used `9344cff`.

## Results — SUS and TAM

| Group | n | SUS mean (SD) | SUS range | PU | PEOU | BI | TAM mean (SD) |
|---|---|---|---|---|---|---|---|
| Staff | 5 | **77.5** (10.6) | 67.5–92.5 | 4.60 | 4.45 | 4.33 | **4.46** (0.30) |
| Residents | 5 | **76.5** (10.7) | 57.5–82.5 | 4.80 | 4.50 | 4.33 | **4.54** (0.21) |

SUS benchmark: 68 = average usability (Sauro, J. 2011, *A Practical Guide to the System Usability
Scale*). Both groups are above average. TAM is on a 1–5 scale; every construct mean is above 4
("agree"). Per-participant scores are in `summary.txt`.

## Results — task time, existing method vs new system

Mean seconds (SD); n = 5 in every cell.

| Task | Backlog | Existing | New system | Change | Success (new) |
|---|---|---|---|---|---|
| UAT01 Scanner Check-In | US-01 | 23.6 (3.4) | 47.4 (23.1) | +101% (slower) | 5/5 |
| UAT02 Manual fallback + damage | US-02, US-06 | 22.4 (2.3) | 24.8 (3.3) | +11% | 5/5 |
| UAT03 Pending lookup | US-05 | 5.6 (1.5) | 9.2 (3.7) | +64% | 5/5 |
| UAT04 Selective Check-Out | US-13 | 24.8 (1.6) | 31.8 (15.5) | +28% | 5/5 |
| UAT05 Full-room Check-Out | US-12 | 47.6 (2.2) | 38.8 (20.8) | **−18%** | 5/5 |
| UAT06 Collection evidence (audit trail) | audit trail | 35.8 (4.4) | 3.6 (0.9) | **−90%** | 4/5 |
| UAT07 Resident registration | US-24 | no such step | 18.0 (3.5) | new capability | 5/5 |
| UAT08 Parcel arrival | US-23 | 11.2 (1.3) | 9.4 (2.7) | −16% | 5/5 |
| UAT09 Pickup update | US-10, US-25 | 29.0 (3.2) | 9.4 (7.6) | **−68%** | 5/5 |
| UAT10 Turn off notifications | US-24 (PDPA withdrawal) | no such step | 10.0 (7.6) | new capability | 5/5 |

Reading the numbers:
- **Slower in UAT01–UAT04.** Staff have used the spreadsheet every day for months and the new system
  for minutes. U01 and U02 also tested the 2 Nov build with two defects (UAT-D01, UAT-D03 below): all
  4 errors recorded on the new system happened on that build, and **0 errors on the fixed build
  (U03–U05)**. On the fixed build UAT01 took 33–35 s and UAT05 20–28 s.
- **Faster where the existing method means scrolling a sheet**: finding who collected a Parcel
  (UAT06), checking out a whole room (UAT05), and a Resident seeing that a Parcel was picked up (UAT09).
- **Accuracy is not shown by time.** The new system only accepts a Room Number from the Resident
  directory; the existing form accepts any text. That is covered by system test cases (TC06, TC49),
  not by UAT.

## How the results were computed

- SUS: odd items score (answer − 1), even items (5 − answer); sum × 2.5 → 0–100.
- TAM: mean of each construct's items; TAM = mean of PU, PEOU and BI.
- **Time 0 s means "no such step"**, not zero seconds, and is excluded from the means: the Residents'
  existing method has no registration (UAT07) and no notifications to turn off (UAT10).
- R05's new-system times for UAT07 (20 s) and UAT10 (22 s) were in the moderator's notes but were
  missed when the sheet was first filled in; they were added on 17 Nov from those notes.
- No significance test: with n = 5 per group the results are descriptive.

## Defects found (issue log)

| ID | Found in | Description | Severity | Fix | Retest |
|---|---|---|---|---|---|
| UAT-D01 | U01 UAT01 | Clicking outside the Check-In dialog closes it and loses the scanned/entered data | Medium | Open | — |
| UAT-D02 | U01 UAT02 | "พัสดุมีปัญหา" button hard to see | Low | No change | U02–U05 found it without help |
| UAT-D03 | U01, U02 UAT04–05 | Check-Out has no Room Number search; Staff expect to type the room | High | [`5da15cc`](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/5da15ccb67514cae56fe7f91f0caed7c947ab852) (2 Nov) | Pass — U03, U04, U05 did UAT04–05 with 0 errors |
| UAT-D04 | U02 UAT01 | A Room Number typed into the Tracking Code field was saved as a Parcel | Medium | Open | — |
| UAT-D05 | U02 UAT06 | History showed a Parcel with no room as not damaged; should show ชำรุด | High | [`5da15cc`](https://github.com/6631503040/Dormitory-Parcel-Management-Case-Studies-Project-/commit/5da15ccb67514cae56fe7f91f0caed7c947ab852) (2 Nov) | Pass — U03, U04, U05 UAT06 |
| UAT-D06 | U03 comment | Button text should be slightly larger | Low | Open | — |

Resident comment (R01): the status page should refresh itself — it already refreshes while open
(about every 30 s, TC53); the comment suggests the interval is not obvious to users.

## Limitations

- **Small sample**: 5 Staff and 5 Residents from one dormitory. Enough to find usability problems,
  not to generalise the time differences.
- **Two builds**: U01 and U02 tested before fix `5da15cc`, U03–U05 after it.
- **Learning effect**: months of spreadsheet use against minutes of new-system use.
- **Order**: existing-method times for U02–U05 and all Residents were collected after the
  new-system sessions, not interleaved with them. Errors were not recorded for the existing method.
- **Contradictory SUS answers**: U04 (SUS2 "too complex" = 5, SUS8 "cumbersome" = 5) and R02
  (SUS2 = 5) agree with negative items while scoring the positive items high, which suggests some
  negative items were misread. Answers are reported as given; they lower those SUS scores.
- **Open notes**: six rows in Task records still carry `[ต้องยืนยัน]` (mostly a Room Number that
  differs from the session plan). They do not change any time or status.
