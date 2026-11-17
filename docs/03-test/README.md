# 03-test — test phase

Instruments for running the Test Plan (`docs/Test-Plan.docx`, DPMS-TP-002). UAT results are
collected in Google Sheets and exported to `results/20261102-uat/` with participant codes only (real
names stay in the consent spreadsheet, which is not in this repo). System test results (synthetic
data only) are kept here too.

| File | What it is |
|---|---|
| `results/20261028/` | First execution round of TC01-TC64 (build 4782b57, isolated test database): `results.json` (status, actual result, evidence per case — the source of the Test Plan's result cells), `load-result.txt` (TC64 load run), `shots/` (screenshots cited as evidence). 52 Pass / 3 Fail / 9 Blocked. |
| `results/20261102-uat/` | UAT round 1 with real users (5 Staff U01–U05, 5 Residents R01–R05): session logs, SUS + TAM responses, `analyze_uat.py` that recomputes every result, and `README.md` with SUS/TAM results, existing-method vs new-system task times, the UAT issue log and limitations. |
| `results/20261102-unit/` | Unit and integration suites on build 9344cff: Vitest 159 passed, Go 52 passed (0 skipped, against a throwaway PostgreSQL). `README.md` maps the 13 test cases marked "Unit" in Test Plan 5.4 to the tests that cover them: 9 full, 4 partial. |
| `results/20261116/` | Regression round 2 (build 9344cff): `TEST-SUMMARY.md` (summary of every test type, exit criteria, what was not tested), `results.json` (the 12 round-1 Fail/Blocked cases re-run), `logs/` (Go, Vitest, Playwright, coverage, govulncheck, npm audit, spike and soak load). Per-case results for all rounds: `Test-Result-Report.docx`. |
| `results/20261118-fix/` | Fixes for DEF-001…DEF-004 and QA-08 (branch `fix/defects-20261118`): what changed, the regression test per defect (failed before, passes after), and logs — Go 57/57, Vitest 161/161, Playwright Chromium 10/10, govulncheck 0 called. Developer retest; tester retest after deploy pending. |
| `Test-Result-Report.docx` | DPMS-TR-001: result of every case TC01-TC64 per round, real-device runs still to be recorded, automated regression, UAT before/after and SUS/TAM, defects. |
| `defects.md` | Defect log: one row per defect with severity (Test Plan definitions), priority, status and the test that reproduces it. |
| `tools/load_profile.py` | Spike (5 -> 50 -> 5 sessions) and soak (10 sessions, N minutes) load profiles, standard library only. Isolated stack only. |
| `uat-dataset/` | UAT starting data (5.3.1): `uat-dataset.mjs` picks each session's own rooms on the target (`plan.json`), checks in the Staff sessions' starting Parcels (`seed`), reports readiness (`status`), and prints Code 128 labels, moderator cards and the existing-method Sheet rows (`out/`). See its README. |
| `uat-forms.gs` | Google Apps Script. Run `createAllForms` once in an Apps Script project (script.google.com) to create, in a Drive folder "Parcel Desk UAT": the Staff and Resident post-session questionnaires (SUS + TAM, Thai with the English item beside it — Test Plan 5.3.2 / Appendix A), the note-taker's task record (5.3.1), and the consent form. Responses go to a results spreadsheet whose "scores" sheets compute SUS (0-100) and TAM construct means per participant; consent goes to a separate spreadsheet because it holds real names. |

Conventions:
- Participants are identified only by ID (U01-U05 Staff, R01-R05 Residents, U06/R06 reserves, PILOT-*);
  real names appear only in the consent spreadsheet (Test Plan section 12).
- Exclude PILOT rows before reporting results.
- If a questionnaire item changes, change it in the Test Plan's Appendix A too, and re-run the script
  to create a fresh set (do not edit a form that already has responses).

## Automated suites added on 2026-11-16

- `backend/internal/api/rbac_matrix_test.go`: every protected API route against every caller type.
- `docs/02-design/prototype/e2e/`: Playwright smoke, regression (open defects marked `test.fail`) and axe accessibility tests.
  Run against an isolated stack: `docker compose -f docker/docker-compose.test.yml -p dpms-test up -d --wait`, seed and start the
  API with `WEB_DIR` on :18080, then `npm run test:e2e` in `docs/02-design/prototype`.
- `npm run test:coverage`: Vitest with the coverage floor in `vite.config.js`.
