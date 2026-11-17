# Defect log — Parcel Desk (DPMS-TP-002)

One row per defect, linked to the Test Plan case (TC), UAT task or review item that found it.
Updated: **2026-11-18** — DEF-001…004 and QA-08 fixed (PR #63, [results/20261118-fix](results/20261118-fix/README.md)) and **retested by the tester on `8cd36d9`** ([results/20261118-retest](results/20261118-retest/README.md)); round 2 (2026-11-16) on build `9344cff`.

- **Severity** uses the Test Plan's definitions (section 6): **Critical** = wrong-room data or data loss; **High** = unusable core
  workflow or notification function without a workaround; **Medium** = defect with a workaround; **Low** = wording or
  presentation that does not affect data. **Priority** = order to fix (P1 first), set separately.
- Exit criteria require **zero unresolved Critical/High** defects.
- **Status**: `Open` · `Fixed – verified` (retested and passed) · `Fixed – not retested` · `Needs decision` · `Not verified`.
- IDs are never reused or renumbered. `QA-*` and `UAT-D*` keep the IDs used in earlier reports. Round 1 (Test Plan v1.7)
  called the first three `DF-01`…`DF-03`: **DF-01 = DEF-001, DF-02 = DEF-002, DF-03 = DEF-003**.
- A test that reproduces an open defect is listed in **Test**; when the defect is fixed, that test must pass.

| ID | Found by | Summary | Severity | Priority | Status | Test / evidence |
|---|---|---|---|---|---|---|
| DEF-002 | TC35 (round 1, round 2) | `POST /parcels/check-out` accepts Tracking Codes from **different rooms** in one request; the other room's Parcel becomes Picked Up | Critical (wrong-room handover) | P1 | Fixed – verified 2026-11-18 (tester retest on `8cd36d9`, [round 3](results/20261118-retest/README.md)) | `e2e/regression.spec.js` TC35; Go `TestDEF002CheckOutRejectsTwoRooms`; [results/20261118-fix](results/20261118-fix/README.md) |
| QA-08 | QA review 2026-11-02 | A Resident OTP issued before move-out / Staff revoke can still register a device afterwards, so a former Resident gets the new occupant's Parcel notifications | Critical (cross-room disclosure) | P1 | Fixed – verified 2026-11-18 (tester retest on `8cd36d9`, [round 3](results/20261118-retest/README.md)) | Go `TestQA08OTPIssuedBeforeRevokeCannotRegister`; [results/20261118-fix](results/20261118-fix/README.md) |
| DEF-004 | govulncheck 2026-11-16 | **GO-2026-6859**: HTTP/1 server can panic (MaxBytesReader header race in `net/http`); reachable via `ExportResidents` | Medium | P2 | Fixed – verified 2026-11-18 (tester retest on `8cd36d9`, [round 3](results/20261118-retest/README.md)) | `logs/govulncheck.json`; [results/20261118-fix](results/20261118-fix/README.md) |
| DEF-003 | TC43 (round 1, round 2) | Server/DB outage on reload is shown as the **sign-in page with no error**; first `/auth/me` call swallows non-401 errors (`ParcelHubApp.jsx` `.catch(() => {})`) | Medium | P2 | Fixed – verified 2026-11-18 (tester retest on `8cd36d9`, [round 3](results/20261118-retest/README.md)) | `e2e/regression.spec.js` TC43; Vitest `ParcelHubApp.test.jsx` DEF-003; [results/20261118-fix](results/20261118-fix/README.md) |
| UAT-D01 | UAT01 (U01) | Clicking outside the Check-In dialog closes it and **loses the typed Tracking Code** | Medium | P2 | Open — reproduced 2026-11-16 and again 2026-11-18 on `8cd36d9` | Round-2 probe: dialog closed, field empty on reopen |
| DEF-001 | TC25 (round 1, round 2) | Problem queue (Parcels without a room) is **newest first**; US-06 requires oldest first | Low (order only, data correct) | P3 | Fixed – verified 2026-11-18 (tester retest on `8cd36d9`, [round 3](results/20261118-retest/README.md)) | `e2e/regression.spec.js` TC25; Go `TestDEF001UnmatchedQueueOldestFirst`; [results/20261118-fix](results/20261118-fix/README.md) |
| DEF-005 | Compliance check 2026-11-16 | `TRUNCATE` bypasses the append-only triggers on `parcel_events` and `access_logs` (row triggers do not fire on TRUNCATE); the app's DB role owns the tables | Low | P3 | Open — reproduced again 2026-11-18 on `8cd36d9`; fix: `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger, or an app role without TRUNCATE | Rolled-back probe: `TRUNCATE TABLE` succeeded |
| UAT-D04 | UAT01 (U02) | A Room Number typed into the Tracking Code field is accepted as a Tracking Code (`10201` → 201) | Low | P3 | Needs decision — is a warning wanted when a code equals a Room Number? | Round-2 API probe: 201 |
| UAT-D02 | UAT02 (U01) | The "พัสดุมีปัญหา" (problem Parcel) checkbox is hard to see | Low | P3 | Open — not retested (corrected 2026-11-17: this ID is on the task records) | UAT task record S01 |
| UAT-D06 | UAT06 (U03) | Suggestion: larger button text | Low | P4 | Open — backlog candidate | UAT task record S03 |
| UAT-D03 | UAT04 (U01, U02) | Check-Out had no Room Number search | Medium | P2 | Fixed – verified 2026-11-16 (commit `5da15cc`) | Round-2 probe: `1101` lists the room's Pending Parcels |
| UAT-D05 | UAT06 (U02) | A problem Parcel without a room showed "ไม่มีปัญหา" instead of "ชำรุด" | Medium | P2 | Fixed – verified 2026-11-16 (commit `5da15cc`) | History list row and history dialog show "ชำรุด: ไม่มีเลขห้อง …"; `results/20261116/shots/UAT-D05-retest.png` |
| OPS-01 | QA review 2026-11-01 (QA-02) | `TRUSTED_PROXIES=10.0.0.0/8` not set on Render: login limiter and `access_logs.ip_address` see only the proxy IP | Medium | P2 | Not verified — needs Render dashboard access | — |
| QA-01 … QA-07 | QA review 2026-11-01 | Session revocation, login rate limit, slash in codes, huge page, slow typing, npm and Go advisories | — | — | Fixed – verified 2026-11-02; Go suite re-run 2026-11-16 passes | `backend/internal/api/qa_review_test.go` |

## How to close a defect

1. Fix on a branch; the test in the **Test** column must fail before the fix and pass after it.
2. For `DEF-001`…`DEF-003`, remove the ID from `KNOWN_OPEN` in `docs/02-design/prototype/e2e/regression.spec.js`
   (otherwise Playwright reports the now-passing test as an unexpected pass).
3. For `DEF-004`, remove `continue-on-error` from the `vulns` job in `.github/workflows/ci.yml`.
4. Set **Status** to `Fixed – verified`, with the date and build of the retest.
