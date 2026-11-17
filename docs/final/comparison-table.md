# Comparison table — before (Google Forms/Sheets) vs after (DPMS)

**Before** = the dormitory's existing workflow: a Google Form to log each Parcel into a Google Sheet,
and Residents asking at the desk. **After** = DPMS, live at
<https://dormitory-parcel-management-case-studies.onrender.com/>.

Every number links to the file it comes from. Abbreviations: UAT = user acceptance test with real
users (5 Staff U01–U05, 5 Residents R01–R05); TC = system test case on synthetic data; n = number of
participants. Times are means in seconds.

## Must Have tasks

| Item | Before | After | Change | Measured with | Evidence |
|---|---|---|---|---|---|
| US-01 Check-In by barcode scan (UAT01) | 23.6 s | 47.4 s | +101% (slower) | UAT, timed by moderator, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) · [session logs](../03-test/results/20261102-uat/task-records.csv) |
| US-01 Room Number validated against the directory | Room Numbers missing, unclear or swapped on labels and in the Sheet (charter, interviews) | Unknown room cannot be saved (Save disabled; API answers `422 ROOM_NOT_IN_DIRECTORY`) | Wrong-room entries blocked at Check-In | TC06, TC49 (Pass); Go test `TestCheckInValidatesRoomAgainstDirectory` (Pass) | [results.json](../03-test/results/20261028/results.json) · [unit results](../03-test/results/20261102-unit/README.md) · [interview pains](../02-design/survey_interview_analysis.md) · [charter](../02-design/company_charter.md) |
| US-02 Manual entry fallback + damaged Parcel (UAT02) | 22.4 s | 24.8 s | +11% | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-05 Search Pending Parcels by room/name (UAT03) | 5.6 s | 9.2 s | +64% | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-06 Parcels with no room (review queue) | No list in the form workflow (not measured) | Separate "พัสดุไม่ทราบห้อง" list; a room can be assigned later | New capability | TC62 Pass; TC25 Fail (list ordered newest first, story says oldest first) | [results.json](../03-test/results/20261028/results.json) |
| US-10 / US-25 Resident sees a Parcel was picked up (UAT09) | 29.0 s | 9.4 s | **−68%** | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-12 Check out a whole room (UAT05) | 47.6 s | 38.8 s | **−18%** | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-13 Check out selected Parcels (UAT04) | 24.8 s | 31.8 s | +28% | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-15 Room-mismatch double-check at Check-Out | No check | Not measured | — | No test case was run for this story | [product_backlog.md](../01-requirements/product_backlog.md) |
| US-16 Daily Status Dashboard counts | No dashboard (not measured) | Received / Picked Up / Pending per day, week, month; equal to database counts | Not timed | TC59 Pass | [results.json](../03-test/results/20261028/results.json) |
| US-23 Resident learns a Parcel has arrived (UAT08) | 11.2 s (ask at the desk / check the Sheet) | 9.4 s (Web Push notification) | −16% | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-24 Resident registers a phone with a desk OTP (UAT07) | No such step | 18.0 s | New capability | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-24 Resident turns notifications off — PDPA withdrawal (UAT10) | No such step | 10.0 s | New capability | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| US-26 Correct a checked-in Parcel | Edit the Sheet (not measured) | Edit keeps history: "ห้อง: 1101/2 → 1090" with Staff name and time | Correction is traceable | TC14 Pass | [results.json](../03-test/results/20261028/results.json) |
| US-27 Read-only Resident Directory page — *re-prioritised to Won't Have this release (18 Nov)* | — | API only (`GET /api/v1/directory`); **page not built**. Room autocomplete shows each room's Residents during Check-In/Check-Out | — | TC60 Blocked; TC06 Pass (autocomplete) | [results.json](../03-test/results/20261028/results.json) · [product_backlog.md](../01-requirements/product_backlog.md) |
| US-28 Admin registers Staff accounts | — | Each Staff member has an account created by an Admin | New capability | Go test `TestAdminRegistersStaff` (Pass) | [unit results](../03-test/results/20261102-unit/README.md) |
| US-29 Update the Resident directory from CSV | — | Upload CSV → preview → apply; moved-out Residents deactivated | New capability | Go tests `TestResidentImportPreviewThenApply`, `TestResidentImportRejectsBadFile` (Pass) | [unit results](../03-test/results/20261102-unit/README.md) |

## Quality, compliance and satisfaction

| Item | Before | After | Change | Measured with | Evidence |
|---|---|---|---|---|---|
| Find who collected a Parcel — chain of custody (UAT06) | 35.8 s | 3.6 s | **−90%** | UAT, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) |
| Audit trail on Check-In / edit / Check-Out | Not measured | Every action logged with Staff and time, append-only | New capability | TC41, TC61 Pass | [results.json](../03-test/results/20261028/results.json) |
| Errors made by Staff in UAT tasks | Not recorded for the existing method | 4 errors on the 2 Nov build (U01, U02); **0 on the fixed build** (U03–U05) | — | UAT error counts | [session logs](../03-test/results/20261102-uat/task-records.csv) |
| Peak load: 1,024 Check-Ins + 1,024 Check-Outs (Flash Sale day) | Staff report the Sheet "slows to a crawl" at peak (not timed) | Check-In p95 47 ms, Check-Out p95 41 ms, search p95 126 ms, **0 errors**, 0 records lost | Not comparable (no baseline number) | TC64 load test on 31,024 Parcels | [load-result.txt](../03-test/results/20261028/load-result.txt) · [charter](../02-design/company_charter.md) · [results.json](../03-test/results/20261028/results.json) |
| Role-based access (RBAC) | Not measured | Operator gets `403` on Admin data | New control | TC63 Pass; Go test `TestRBACAdminOnlyAccessLogs` | [results.json](../03-test/results/20261028/results.json) |
| Usability — SUS (0–100), Staff | Not measured | 77.5 (SD 10.6) | Above 68 benchmark | SUS questionnaire, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) · [responses](../03-test/results/20261102-uat/staff-responses.csv) |
| Usability — SUS (0–100), Residents | Not measured | 76.5 (SD 10.7) | Above 68 benchmark | SUS questionnaire, n=5 | [UAT results](../03-test/results/20261102-uat/README.md) · [responses](../03-test/results/20261102-uat/resident-responses.csv) |
| Acceptance — TAM (1–5), Staff / Residents | Not measured | 4.46 / 4.54 | — | TAM questionnaire (PU, PEOU, BI), n=5 each | [UAT results](../03-test/results/20261102-uat/README.md) |

## AI

| Item | Before | After | Change | Measured with | Evidence |
|---|---|---|---|---|---|
| AI feature in the product (label OCR / room suggestion, US-03) | None | **None** — US-03 is Should Have and was not built; search is plain-text matching | No change | Backlog review | [ai-logic.md](ai-logic.md) · [product_backlog.md](../01-requirements/product_backlog.md) |
| AI-assisted development | — | 13 of 52 non-merge commits on `main` carry a `Co-Authored-By: Claude` trailer; 8 project agents and 7 skills in `.claude/` | No before value | `git log` count on 18 Nov 2026 | [ai-logic.md](ai-logic.md) |

## What the table shows

- **Better**: chain of custody (−90%), whole-room Check-Out (−18%), Resident pickup status (−68%),
  arrival notification (−16%), wrong Room Numbers blocked at entry, a full audit trail, and fast,
  error-free handling of a Flash Sale day's volume. SUS is above average for both groups.
- **Worse**: single-Parcel Check-In, search and selective Check-Out are slower in first use. Most of
  the gap comes from the first two sessions on a build with two defects; both were fixed in
  `5da15cc`, and the fixed build had 0 errors.
- **Not delivered**: the Directory page (US-27, moved to Won't Have this release on 18 Nov) and the
  room-mismatch check (US-15) have no measurement. There is no AI feature in the product.
