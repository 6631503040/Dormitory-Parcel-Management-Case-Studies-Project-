# Demo script — MVP presentation (frontend wired to the real API)

> Supersedes `20260921-demo-script.md`. That version assumed the prototype's localStorage-only
> build (mocked LINE, a client-side "reset demo data" button). The frontend now calls the real
> Go/Gin API + PostgreSQL — those specific steps (LINE mock, reset button) no longer exist.

## Before presenting

1. Start the stack (see `backend/README.md`):
   ```bash
   cd docker && docker compose up -d --build
   ```
2. Reset to a clean 1,000-parcel dataset:
   ```bash
   cd docker && MSYS_NO_PATHCONV=1 docker compose exec backend /app/seed -parcels 1000 -reset
   ```
   (Drop `MSYS_NO_PATHCONV=1` outside Git Bash on Windows.)
3. Start the frontend: `cd docs/02-design/prototype && npm run dev`, open `http://localhost:5173`.
4. Log in as `somsri` / `parcel1234` (or `prasert` / `parcel1234`; `admin` / `parcel1234` for the admin-only access-log route).
5. Do a dry run once. To reset again before the real presentation, repeat step 2.

## Storyline (≈5 min) — one pain point per step

| # | Do | Say / show | Pain point it answers |
|---|---|---|---|
| 1 | Dashboard: point at the 3 cards, change the date | Received / Picked up / Pending for the day, replacing the sheet's manual tally | Slow, error-prone spreadsheet |
| 2 | **เข้า** → type a new code (e.g. `TH9990000001`) → pick a room from the dropdown | The parcel saves the instant a room is picked — no separate save step. The room came from `GET /rooms/search`, validated server-side against the directory | Room numbers swapped / free-typed |
| 3 | Same modal: type a room query that matches nothing (e.g. `zzz`) | "ไม่พบห้องหรือชื่อนี้ในรายชื่อผู้พัก" — there is no way to save an invalid room | Wrong or invented room numbers |
| 4 | Scan an existing code again (copy one from the table) | Duplicate-tracking-code error naming the existing room and time | Double entry |
| 5 | Tick **ระบุห้องไม่ได้** → pick a reason → บันทึก | Parcels with no/illegible room or nickname don't get a guessed room; they're parked with a reason | No room number, nicknames, handwriting |
| 6 | Dashboard: **พัสดุที่ระบุห้องไม่ได้** → **ระบุห้อง** on one → choose a room → confirm | Resolved by a person, from the directory, and logged (`room_assigned` event) | Same as above |
| 7 | **ออก** → type a room number → show **นำออกทั้งหมด** vs **นำออกที่เลือก** (tick one) | Both paths always available. "All" asks one confirmation naming the room + count; "Selected" doesn't | Slow pickup for multi-parcel residents |
| 8 | Click any row → **ประวัติพัสดุ** | Who checked in / checked out, and when — read straight from `parcel_events` | Misdelivery disputes (chain of custody) |
| 9 | Dashboard search box → type `TH` or a room number | Search hits the seeded 1,000-parcel dataset; results are paginated ("แสดงเพิ่ม"), never an unbounded list | Flash Sale peak load (~1,024 parcels/day) |

Talking points if asked:
- **No LINE integration.** The earlier localStorage prototype had a mocked LINE notification; that was cut when the app moved to the real backend (out of the 4 locked features — see CLAUDE.md scope).
- **Validation is server-side**, not just client-side: the room dropdown suggests options, but the API re-checks the room against the directory (a foreign key) on every check-in/assign — even a hand-crafted request can't save an unknown room.
- **Two staff checking out the same parcel** only lets one succeed (concurrency-safe update) — can demo by opening two browser tabs if asked.
- **OCR, courier API, mobile app** are out of scope by design.

## What's verified vs. not

**Automated / verified:** backend `go test ./...` (17 tests incl. concurrency and mutation-checked invariants) against real PostgreSQL; frontend `npm test` (81 Vitest tests, mocked network) covering every screen/modal including error paths; a manual end-to-end pass through the Vite proxy (login → search → check-in → check-out → dashboard → logout → 401) with `curl` against the live Docker backend.

**Not verified:** a real click-through in an actual browser window (all of the above used curl or RTL's simulated DOM, not a rendered browser). Run steps 2–9 yourself once before presenting. Load testing at the full 1,024 parcels/day has not been run — only correctness tests exist (see `backend/README.md` "Known gaps").
