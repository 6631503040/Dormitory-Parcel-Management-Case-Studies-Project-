# Unit and integration results — 2 November 2026

The "Developer / unit results" deliverable of Test Plan sections 5.1 and 13. Build `9344cff`
(origin/main after PR #44).

| Suite | Command | Result | Output |
|---|---|---|---|
| Frontend (Vitest + Testing Library + MSW, mocked network) | `cd docs/02-design/prototype && npx vitest run --reporter=verbose` | 16 files, **159 passed**, 0 failed | `frontend-vitest.txt` |
| Backend (Go) | `cd backend && go test -count=1 -v ./...` with `TEST_DATABASE_URL` set | 3 packages, **52 tests passed** (+23 subtests), 0 failed, **0 skipped** | `backend-go-test.txt` |

The backend ran against a throwaway PostgreSQL 16 container (`postgres:16-alpine`, deleted
afterwards), never the Render database. Each test creates its own schema and applies
`db/migrations`. Without `TEST_DATABASE_URL` the `internal/api` tests skip rather than pass, so
check the output for `SKIP` when re-running.

Test levels: `internal/auth` and `internal/push` are pure unit tests. `internal/api` holds
integration tests (HTTP API plus a real database). The frontend tests are component and unit tests
with the network mocked.

## Test cases marked "Unit" in section 5.4

The tests below cover the unit part of each case. The E2E or Integration part stays with the
TC01-TC64 round in `../20261028/`.

| TC | Covered by | Coverage |
|---|---|---|
| TC06 Room Number validation | Go `TestCheckInValidatesRoomAgainstDirectory` (unknown room is rejected 422), `TestCheckInRequestValidation/no_room_and_no_reason`, `/room_id_zero`, `/room_as_text`, `TestRoomAutocompleteAndDirectory`. Vitest `RoomCombobox > never accepts free text…`, `CheckInModal > shows the room-not-in-directory error…`, `ResidentApp > names the typed room when it is not in the directory` | Full |
| TC10 Tracking Code boundaries | Go `TestCheckInRequestValidation/empty_code`, `/code_with_space`, `/code_too_long`, `TestQA03TrackingCodeMustBeRetrievable/*`, `TestCheckInValidatesRoomAgainstDirectory` (lower case normalised). Vitest `errorMessage() > explains which characters a Tracking Code may not contain` | Partial: Thai and control characters, and the exact 64/65 lengths, are not tested separately |
| TC11 Duplicate codes | Go `TestCheckInValidatesRoomAgainstDirectory` (409 `DUPLICATE_TRACKING_CODE` naming the existing room). Vitest `CheckInModal > rejects local duplicate codes regardless of case…`, `> shows the duplicate-tracking-code error inline…`, `errorMessage() > names the existing parcel's room and time…` | Full |
| TC17 Problem detail and length | Go `TestCheckInRequestValidation/note_too_long`, `/room_and_reason`, `/bad_reason`. Vitest `CheckInModal > records a damaged matched parcel…`, `> submits a problem parcel with a fixed reason…`, `> omits the note field entirely when left blank` | Partial: no test for the 490/491-character form limit or HTML-like text |
| TC21 Room Number search | Go `TestSearchAndPagination` (`q=101`, `q=1101`). Vitest `ArchivePage > searches by tracking code / room / resident name` | Full |
| TC22 Name and Tracking Code search | Go `TestSearchAndPagination` (Thai name, nickname, case-insensitive name and code, prefix only, `%`/`_` taken literally) | Full |
| TC24 Dashboard pagination | Go `TestSearchAndPagination` (page bounds), `TestQA04HugePageIsAValidationError`. Vitest `DashboardPage > shows pending parcels with eight-item server pages…`, `ArchivePage > replaces eight-item pages…` | Full |
| TC25 Problem Parcels section | Go `TestUnmatchedParcelLifecycle`, `TestUnmatchedReasonFilter`, `TestCheckOutParcelWithoutRoom`. Vitest `UnmatchedQueue > *` (count, list, resolve with a directory room, paging) | Full |
| TC28 Codes ineligible for Check-Out | Go `TestCheckOutSelectedIsAtomic` (already picked up 409, unknown 404, empty 400, duplicates collapse, a mixed request changes nothing). Vitest `CheckOutModal > shows API not-found and picked-up errors…`, `> rejects duplicate, other-room and picked-up scans…` | Full |
| TC36 Archive filters and counts | Go `TestUnmatchedReasonFilter`, `TestSearchAndPagination` (`status=` filter). Vitest `ArchivePage > shows all parcels with per-tab counts`, `> filters to only picked-up parcels…`, `> filters to the unmatched queue…` | Full |
| TC37 Search with status filters | Go `TestSearchAndPagination` (`q=spx&status=picked_up`). Vitest `ArchivePage > searches by…`, `> shows the empty-state message…` | Full |
| TC39 Dates, times and status | Go `TestDashboardCounts` (Thailand day boundaries). Vitest `SummaryBoard > labels each period in Thai with Buddhist-era years` | Partial: the Archive display of a UTC time in Thailand time (18:05Z = 01:05 the next day) is not unit-tested |
| TC43 Service or database unavailable | Vitest `client > wraps a network failure as NETWORK_ERROR`, `DashboardPage > surfaces API failures`, `ArchivePage > shows an inline error when the list fails to load`, `CheckInModal > stops on a network error and retains every unconfirmed draft`, `CheckOutModal > keeps a failed selection for retry…` | Partial: covers the client side only. Stopping the database or API stays an E2E step |

Summary: 9 of the 13 cases are fully covered. TC10, TC17, TC39 and TC43 are partial, and their
remaining parts are listed above.
