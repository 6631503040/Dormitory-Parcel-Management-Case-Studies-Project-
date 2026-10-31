# 03-test — test phase

Instruments for running the Test Plan (`docs/Test-Plan.docx`, DPMS-TP-002). UAT results are
collected in Google Sheets, not in this repo — they hold participant data. System test results
(synthetic data only) are kept here.

| File | What it is |
|---|---|
| `results/20261028/` | First execution round of TC01-TC64 (build 4782b57, isolated test database): `results.json` (status, actual result, evidence per case — the source of the Test Plan's result cells), `load-result.txt` (TC64 load run), `shots/` (screenshots cited as evidence). 52 Pass / 3 Fail / 9 Blocked. |
| `uat-forms.gs` | Google Apps Script. Run `createAllForms` once in an Apps Script project (script.google.com) to create, in a Drive folder "Parcel Desk UAT": the Staff and Resident post-session questionnaires (SUS + TAM, Thai with the English item beside it — Test Plan 5.3.2 / Appendix A), the note-taker's task record (5.3.1), and the consent form. Responses go to a results spreadsheet whose "scores" sheets compute SUS (0-100) and TAM construct means per participant; consent goes to a separate spreadsheet because it holds real names. |

Conventions:
- Participants are identified only by ID (U01-U05 Staff, R01-R05 Residents, U06/R06 reserves, PILOT-*);
  real names appear only in the consent spreadsheet (Test Plan section 12).
- Exclude PILOT rows before reporting results.
- If a questionnaire item changes, change it in the Test Plan's Appendix A too, and re-run the script
  to create a fresh set (do not edit a form that already has responses).
