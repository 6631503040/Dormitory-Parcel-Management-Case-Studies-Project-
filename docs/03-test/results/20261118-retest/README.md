# Tester retest (round 3) - 18 November 2026

Independent retest by the tester of the fixes in commit `c8dfddd` (PR #63,
[results/20261118-fix](../20261118-fix/README.md)), on `main` at **`8cd36d9`**. Everything was rebuilt and
run from scratch on an isolated stack; none of the developer's logs were reused.

## Result

| Defect | Test Plan case | Round 2 (16 Nov) | Round 3 (18 Nov) | Evidence |
|---|---|---|---|---|
| DEF-002 (Critical) | TC35 | Fail | **Pass**: mixed-room Check-Out refused, the other room's Parcel stays Pending | Playwright TC35, Go `TestDEF002CheckOutRejectsTwoRooms` |
| QA-08 (Critical) | - | Open | **Fixed – verified**: an OTP issued before a revoke can no longer register a device | Go `TestQA08OTPIssuedBeforeRevokeCannotRegister` |
| DEF-003 | TC43 | Fail | **Pass**: an outage shows an alert on the sign-in page | Playwright TC43 |
| DEF-001 | TC25 | Fail | **Pass**: problem queue is oldest first | Playwright TC25, Go `TestDEF001UnmatchedQueueOldestFirst` |
| DEF-004 | - | Open | **Fixed – verified**: Go 1.26.11; govulncheck reports 0 vulnerabilities called | govulncheck |

**TC01-TC64 now: 55 Pass / 0 Fail / 9 Blocked.** No Critical or High defect is open.

## Suites

| Suite | Result | Log |
|---|---|---|
| Go unit + integration, `-race`, real PostgreSQL | **57 / 57 pass**, 0 skip | [go-test-summary.txt](logs/go-test-summary.txt) |
| Vitest (client) | **161 / 161 pass** | - |
| Playwright: Chromium, Firefox, Pixel 7 (smoke, regression TC25/35/43, axe, keyboard) | **14 / 14 pass** | [playwright.json](logs/playwright.json), [playwright.log](logs/playwright.log) |
| govulncheck v1.9.0 | 0 vulnerabilities called (1 module-only, unchanged) | - |
| `go vet` | pass | - |

The first Playwright run failed the 3 "Resident page" smoke tests because the API was started without
Web Push keys (the page then says notifications are off). With keys from `cmd/vapidkeys` all 14 passed.
This was a setup mistake in the test stack, not a defect.

## Still open (rechecked on 8cd36d9)

| Item | Recheck |
|---|---|
| UAT-D01 | Still reproduces: clicking outside the Check-In dialog closes it and the typed Tracking Code is lost (no confirm shown). |
| DEF-005 | Still reproduces: `TRUNCATE parcel_events` and `TRUNCATE access_logs` succeed (run inside a rolled-back transaction). |
| TC60 | Still Blocked: the Staff menu has only หน้าหลัก and ประวัติ; no Directory page. |
| TC07-TC09, TC46, TC52, TC55 | Blocked until the real-device results (scanner, phones) are recorded. |
| TC47, TC56 | Blocked: Thai IME step and duplicate push delivery not yet testable. |

## Environment

PostgreSQL 16 (`postgres:16-alpine`, tmpfs) from `docker/docker-compose.test.yml`; Go 1.26.11 API on :18080
serving the built client; synthetic data from `cmd/seed -parcels 300 -reset`; throwaway Web Push keys.
This is a local build of `8cd36d9`, not the deployed Render site.
