# Defect fixes and automated retest — 18 November 2026

Branch `fix/defects-20261118` (from `main` at `bae8ad1`). Fixes the defects below from
[defects.md](../../defects.md). Each fix has a regression test that **failed on the code before the
fix and passes after it** — the rule in defects.md, "How to close a defect".

| Defect | Severity | Fix | Regression test | Before fix | After fix |
|---|---|---|---|---|---|
| DEF-002 (TC35) | Critical | `Store.CheckOut` locks the requested Parcels and refuses the whole request with `409 MIXED_ROOMS` if they belong to more than one room. A Parcel with no room may still go with one room's Parcels (unchanged, `TestCheckOutParcelWithoutRoom`). | Go `TestDEF002CheckOutRejectsTwoRooms`; Playwright `regression.spec.js` TC35 | `200`, room B's Parcel `picked_up` | `409 MIXED_ROOMS`, both Parcels stay Pending |
| QA-08 | Critical | Revoking a room's devices (desk) and vacating a room (directory import) now also expire every unused registration code of that room. | Go `TestQA08OTPIssuedBeforeRevokeCannotRegister` | `201`, device registered | `410 OTP_EXPIRED`; a new code still works |
| DEF-004 | Medium | `backend/go.mod`: Go 1.26.10 → **1.26.11** (CI reads the version from go.mod; Dockerfiles use `golang:1.26-alpine`). | `govulncheck ./...` | GO-2026-6859 reachable | **0** vulnerabilities called |
| DEF-003 (TC43) | Medium | On start, only a `401` means "not signed in". Any other failure shows an alert on the sign-in page: server error → "ระบบขัดข้องชั่วคราว…", no network → "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้…". | Vitest `ParcelHubApp.test.jsx` (2 tests "DEF-003"); Playwright TC43 | sign-in page, no message | sign-in page with `role="alert"` message |
| DEF-001 (TC25) | Low | The queue of Pending Parcels without a room (`status=pending&unmatched=true`) is sorted oldest first; every other list stays newest first. | Go `TestDEF001UnmatchedQueueOldestFirst`; Playwright TC25 | newest first | oldest first |

## Results

| Suite | Result | Log |
|---|---|---|
| Go unit + integration (PostgreSQL 16, throwaway container) | **57 / 57 pass**, 0 fail, 0 skip (54 before + 3 new) | [go-test.log](logs/go-test.log) |
| govulncheck | 0 vulnerabilities called by the code | [govulncheck.log](logs/govulncheck.log) |
| Vitest (client) | **161 / 161 pass** (159 before + 2 new) | [vitest.log](logs/vitest.log) |
| Playwright E2E, Chromium (smoke, regression TC25/TC35/TC43, axe accessibility) | **10 / 10 pass** | [playwright.json](logs/playwright.json) |

`KNOWN_OPEN` in `docs/02-design/prototype/e2e/regression.spec.js` is now empty, so Playwright fails if
any of the three defects comes back.

## Environment

Local stack, never the Render database: PostgreSQL 16 (`postgres:16-alpine`) in a throwaway Docker
container; the Go API (Go 1.26.11) on :18080 serving the built client; synthetic data from
`cmd/seed -parcels 50 -reset`; throwaway Web Push keys from `cmd/vapidkeys`. Playwright Chromium
headless shell 159.

## Not covered by this retest

- Firefox and Pixel 7 projects were not re-run (the regression suite runs on Chromium only).
- This is an automated retest by the developer. The tester should re-run TC25, TC35 and TC43 on the
  deployed build and record round 3 in the Test-Result-Report.
- Still open: UAT-D01 and UAT-D04 (need a decision), DEF-005, UAT-D02, UAT-D06, OPS-01.
