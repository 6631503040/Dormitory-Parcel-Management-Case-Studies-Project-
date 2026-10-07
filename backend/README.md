# Backend — Go + Gin API

Application-server tier of the Dormitory Parcel Management System. PostgreSQL is the only store;
the schema lives in `../db/migrations/` and is applied automatically when the server starts.

## Run it

```bash
cd docker
cp .env.example .env                 # first time only; set POSTGRES_PASSWORD and SESSION_SECRET
docker compose up -d --build         # PostgreSQL + API on http://localhost:8080
docker compose exec backend /app/seed -parcels 1000 -reset   # synthetic demo data
# Git Bash on Windows rewrites "/app/seed" into a Windows path; prefix the line with MSYS_NO_PATHCONV=1 (PowerShell is fine as is)
```

Seeded logins (development only): `admin` (role admin), `somsri`, `prasert` (role operator),
password `parcel1234` (override with `SEED_PASSWORD`). `seed` refuses to run when `APP_ENV=production`.

Without Docker for the API itself: start only the database (`docker compose up -d db`), export
`DATABASE_URL`, `SESSION_SECRET` (≥ 32 chars) and `MIGRATIONS_DIR=../db/migrations`, then
`go run ./cmd/server`.

## Tests

```bash
export TEST_DATABASE_URL='postgres://dpms:<password>@127.0.0.1:5432/dpms?sslmode=disable'
go test ./...
```

Integration tests run against a real PostgreSQL, each in its own throw-away schema, so they never
touch real data. Without `TEST_DATABASE_URL` they are **skipped**, not passed — check the output.

## Configuration (environment)

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — (required) | `postgres://user:pass@host:5432/db?sslmode=…` — use `sslmode=require`+ in production (encryption in transit) |
| `SESSION_SECRET` | — (required) | ≥ 32 bytes; signs session cookies |
| `APP_ENV` | `development` | `production` requires `COOKIE_SECURE=true` |
| `COOKIE_SECURE` | `false` | `true` whenever served over HTTPS |
| `PORT` | `8080` | |
| `MIGRATIONS_DIR` | `../db/migrations` | `/app/migrations` in the image |
| `DB_MAX_CONNS` | `20` | |
| `SESSION_TTL_HOURS` | `8` | |
| `TRUSTED_PROXIES` | none | comma-separated; only these may set `X-Forwarded-For` (client IP in `access_logs`) |
| `LINE_CHANNEL_SECRET` | none | optional; verifies `X-Line-Signature` on `/line/webhook`. Empty → the route responds `LINE_NOT_CONFIGURED` |
| `LINE_CHANNEL_ACCESS_TOKEN` | none | optional; needed to send LINE reply messages (issued separately from the channel secret, same LINE console page) |

## API contract

Base path `/api/v1`. JSON in camelCase, timestamps ISO 8601 UTC. Session is an HttpOnly cookie
(`dpms_session`) set by login; every route except `/healthz`, `login`, `logout` needs it.
State-changing requests must send `Content-Type: application/json`. Every list is paginated:
`?page=1&pageSize=20` (pageSize 1–100) → `{items, page, pageSize, total}`.

| Method & path | Who | Purpose |
|---|---|---|
| `POST /auth/login` `{username,password}` | anyone | Start session → `{staff}`. Every attempt is logged |
| `POST /auth/logout` · `GET /auth/me` | — / signed in | End session · current Staff |
| `GET /rooms/search?q=&limit=` | signed in | Room Number autocomplete (room, `B1 10`, resident name or nickname) → `{items:[{id,roomNumber,buildingCode,residents}]}` |
| `GET /directory?q=` | signed in | Read-only directory, one row per Resident (no phone numbers) |
| `POST /parcels` `{trackingCode, roomId \| unmatchedReason, residentId?, note?}` | signed in | **Check-In**. `roomId` is a directory room id, never text |
| `GET /parcels?q=&status=&roomId=&unmatched=&unmatchedReason=&from=&to=` | signed in | **Search & Lookup** (`q`: tracking-code prefix, room-number prefix, resident name/nickname); also the Check-Out room view and the unmatched queue's reason tabs |
| `GET /parcels/:trackingCode` | signed in | Parcel + `events` (chain of custody: staff + timestamp) |
| `POST /parcels/check-out` `{trackingCodes:[…]}` | signed in | **Check Out Selected**, all-or-nothing |
| `POST /rooms/:roomId/check-out-all` `{expectedCount?}` | signed in | **Check Out All** for a room; `expectedCount` = number shown in the confirm dialog |
| `PATCH /parcels/:trackingCode/room` `{roomId}` | signed in | Resolve an unmatched Parcel |
| `GET /dashboard?date=YYYY-MM-DD` | signed in | `{checkedIn, pickedUp, pending, unmatchedPending, recentCheckIns}` for a day in Asia/Bangkok |
| `GET /admin/access-logs` | `admin` only | Login attempts (Computer Crime Act §26) |
| `GET /rooms/:roomId/line-otp` | signed in | Staff-facing: the room's pending LINE OTP, to read out loud at the desk. 404 `NO_PENDING_LINE_OTP` once it's used/expired |
| `POST /line/webhook` | LINE's servers (`X-Line-Signature`, not a session cookie) | US-08 "Check Parcel" button + US-11 OTP-linking conversation — see below |
| `GET /healthz` | anyone | Liveness + DB ping |

### LINE integration (Epic E3 — see `docs/01-requirements/product_backlog.md`)

A resident's LINE account is never trusted with a free-text room number any more than a Staff
member is — it goes through an unambiguous match (the full building+floor+room number, e.g.
`1101`, not just `101`) or is rejected, the
same principle as Check-In's room dropdown. The whole exchange is **pull**, not push: DPMS never
messages a resident on its own, and the OTP itself is never sent over LINE — only spoken by Staff
at the desk, which is the actual identity check (see `US-11` in the backlog for the full 4-step
flow, and `docs/05-log/20260922-demo-script.md` for a walkthrough).

1. Resident sends a room ("`1101`") to the dorm's official LINE account → webhook mints a 6-digit
   code, valid 5 minutes, held in **plaintext** in `line_otp_challenges` (deliberately — see below).
2. Resident goes to the parcel desk; Staff call `GET /rooms/:roomId/line-otp` and read the code out.
3. Resident types the code back into LINE → a match links the account (`line_links`), superseding
   any earlier room it was linked to; 5 wrong attempts burns the code (`LineOTPLocked`).
4. Resident taps the "Check Parcel" rich-menu button (postback data `action=check_parcel`, icon
   `backend/img/percel_icon.png`) any time afterward → reply is minimal-data only (US-10): building,
   room, pending count, and each pending Parcel's tracking code.

Rich-menu setup (mapping the icon to that postback action) is a one-time step in the LINE console
or Developers API — not something this backend does.

Tracking codes are normalised to upper-case (`th123` and `TH123` are the same Parcel).

### Errors

Every error is `{"code": "...", "params": {...}}` with no user-facing text — the frontend maps
`code` to a message (design-spec §5).

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `params.field` / `params.reason` say what is wrong |
| `UNAUTHENTICATED` / `INVALID_CREDENTIALS` | 401 | No/expired session · bad login (same answer for unknown user, wrong password, disabled account) |
| `FORBIDDEN` | 403 | Signed in but wrong role |
| `NOT_FOUND` / `PARCEL_NOT_FOUND` | 404 | `params.trackingCodes` for the latter |
| `NO_PENDING_PARCELS` | 404 | Check-out-all on a room with nothing pending |
| `DUPLICATE_TRACKING_CODE` | 409 | `params`: `roomNumber`, `buildingCode`, `checkedInAt` of the existing Parcel |
| `PARCEL_NOT_PENDING` | 409 | Already picked up (or unmatched); nothing was changed. `params.trackingCodes` |
| `PENDING_COUNT_CHANGED` | 409 | `expectedCount` ≠ actual (`params.expected`, `params.actual`); nothing was changed |
| `PARCEL_HAS_ROOM` | 409 | Assign-room on a Parcel that already has one |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Body is not `application/json` |
| `ROOM_NOT_IN_DIRECTORY` / `RESIDENT_NOT_IN_ROOM` | 422 | Room id not in the directory · recipient doesn't live there |
| `AMBIGUOUS_ROOM` | 422 | A LINE-typed room claim matched more than one room (e.g. `101` exists in two buildings) |
| `NO_PENDING_LINE_OTP` | 404 | No unexpired, unconsumed OTP for that room right now |
| `LINE_NOT_CONFIGURED` | 503 | `LINE_CHANNEL_SECRET` isn't set — the webhook is deliberately inert |
| `INTERNAL_ERROR` | 500 | Details are logged server-side only |

## Design notes

- **Room validation is a foreign key**, plus an API check. An unknown room can't be stored no matter
  what the client sends. A Parcel with no usable room is parked (`room_id` NULL + `unmatched_reason`)
  and can't be checked out until Staff pick a directory room.
- **Check-out is race-safe.** The `UPDATE` only touches rows still `pending`; when two Staff pick the
  same Parcel exactly one succeeds and the other gets `409 PARCEL_NOT_PENDING` (covered by a concurrency test).
- **Audit trail** rows are written in the same transaction as the change, and `parcel_events` /
  `access_logs` reject `UPDATE`/`DELETE` at the database level.
- **RBAC** is enforced in the API (`requireRole`); role and active status are re-read from the
  database on every request, so disabling an account takes effect immediately.
- **Logs never contain search terms** (the request logger drops the query string): searches carry
  resident names, which are personal data.
- **The LINE OTP is stored in plaintext**, on purpose, unlike passwords or session tokens: Staff
  must be able to read it back to a resident in person (that hand-off is the identity check, not
  the code itself). It's mitigated the way a short-lived secret should be — single-use, 5-minute
  expiry, 5-attempt lockout, and only reachable through an authenticated Staff endpoint — not by
  hashing something that has to be recovered in cleartext anyway.

## Known gaps (not done yet)

- **No login rate limiting / lockout.** Put a limiter in front (reverse proxy) or add one before go-live.
- **Sessions are stateless signed cookies** — logout clears the cookie but can't revoke a stolen one
  before it expires (default 8 h). A `sessions` table would allow server-side revocation.
- **`access_logs` records logins only**, not other API traffic; there is no retention job (nothing
  deletes rows, so the ≥ 90-day rule is met by keeping everything).
- **Parcel archiving** (`status = 'archived'`) exists in the schema but no job moves Parcels there.
- **Residents can't consent / access / correct their data through the app** (PDPA) — the directory is read-only.
- **TLS to the database** depends on `DATABASE_URL` (`sslmode`); the compose file uses `disable` for local dev only.
- Load testing at 1,024 parcels/day has not been run; only correctness tests exist.
