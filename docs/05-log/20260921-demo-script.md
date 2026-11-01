> **Superseded 2026-09-22** — the frontend now calls the real backend API instead of
> localStorage; the LINE mock and the "reset demo data" button described below no longer exist.
> See `20260922-demo-script.md`.

# Demo script — MVP presentation (prototype, localStorage-only build — historical)

App: `docs/02-design/prototype/` — run `npm run dev`, open the printed URL.
Data is synthetic and lives in the browser's localStorage (per browser, per machine).

## Before presenting

1. Log in with any non-empty username/password (the username is recorded in the audit trail — use `somsri` or your own name).
2. Dashboard → **รีเซ็ตข้อมูล demo** (bottom of the page). This gives ~40 parcels with today's counts populated.
3. Do a dry run once, then reset again.

## Storyline (≈5 min) — one pain point per step

| # | Do | Say / show | Pain point it answers |
|---|---|---|---|
| 1 | Dashboard: point at the 3 cards, change the date | Received / Picked up / Pending for the day, replacing the sheet's manual tally | Slow, error-prone spreadsheet |
| 2 | **เข้า** → type a new code (e.g. `TH9990000001`) → Enter → type `101` → pick `101/2` | Room is chosen from the resident directory; the parcel is added the moment the room is picked. Note the "แจ้งเตือน LINE" hint on linked rooms | Room numbers swapped / free-typed |
| 3 | Same modal: type `999` in the room field | "ไม่พบห้องหรือชื่อนี้" — an invalid room cannot be saved | Wrong or invented room numbers |
| 4 | Scan an existing code again (copy one from the table) | Duplicate warning | Double entry |
| 5 | Tick **ระบุห้องไม่ได้** → pick a reason → add → **บันทึกพัสดุเข้าทั้งหมด** | Parcels with no/illegible room or nickname don't get a guessed room; they go to a queue with the reason | No room number, nicknames, handwriting |
| 6 | Dashboard: **พัสดุที่ระบุห้องไม่ได้** → **ระบุห้อง** on one → choose a room → confirm | Resolved by a person, from the directory, and logged | Same as above |
| 7 | **ออก** → type `101/2` → show **นำออกทั้งหมด** vs **นำออกที่เลือก** (tick one) | Both paths always available. "All" asks one confirmation; "Selected" doesn't | Slow pickup for multi-parcel residents |
| 8 | Click any row → **ประวัติพัสดุ** | Who checked in / notified / checked out, and when | Misdelivery disputes (chain of custody) |
| 9 | Dashboard → **โหลดข้อมูลทดสอบ 1,000 ชิ้น** → search a room or `TH` | ~1,000 parcels/day scale; lists are paged ("แสดงเพิ่ม"), search stays instant | Flash Sale peak load |

Talking points if asked:
- **LINE** is mocked (only rooms with a staff-confirmed link get a simulated notification, logged in the history). Real LINE API is the next phase.
- **No backend yet** — validation here is client-side; the real system re-validates on the Go API and enforces roles there.
- **OCR, courier API, mobile app** are out of scope by design.

## Not verified in a browser

Automated checks done: production build passes; every screen and modal renders without errors; the demo-data generator was checked (unique codes, valid rooms, no future timestamps, 1,000 parcels in ~13 ms). **Interactions (typing, keyboard navigation in the room dropdown, focus movement, Esc to close) have not been clicked through in a real browser** — run steps 2–8 once yourself before presenting.
