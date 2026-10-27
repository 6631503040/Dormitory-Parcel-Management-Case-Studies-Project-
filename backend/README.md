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
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | none | optional; Web Push key pair (`go run ./cmd/vapidkeys`, or `/app/vapidkeys` in the image). Empty → resident routes answer `PUSH_NOT_CONFIGURED` and no push worker runs |
| `VAPID_SUBJECT` | none | required with the keys: `mailto:` or `https://` contact for push-service operators |
| `PUSH_BATCH_WINDOW_SECONDS` | `60` | Parcels for one room checked in within this window go out as one notification |

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
| `PATCH /parcels/:trackingCode` `{trackingCode?, roomId?, note?}` | signed in | **Edit** a Pending Parcel that has a room (US-26). Omitted fields stay; `note: ""` clears it. Appends an `edited` event with each change's before/after. 409 `PARCEL_NOT_PENDING` for Picked Up / unmatched, 409 `DUPLICATE_TRACKING_CODE`, 422 `ROOM_NOT_IN_DIRECTORY`. A room change notifies the new room |
| `PATCH /parcels/:trackingCode/room` `{roomId}` | signed in | Resolve an unmatched Parcel |
| `GET /dashboard?date=YYYY-MM-DD&period=day\|week\|month` | signed in | `{date, period, from, to, checkedIn, pickedUp, pending, unmatchedPending, recentCheckIns}` for the day / week (Mon–Sun) / calendar month containing `date`, in Asia/Bangkok (`period` defaults to `day`; `to` is inclusive). `checkedIn`/`pickedUp` count within the period; `pending` is what was still waiting at its end; `unmatchedPending` is a current count |
| `GET /admin/access-logs` | `admin` only | Login attempts (Computer Crime Act §26) |
| `GET /healthz` | anyone | Liveness + DB ping |
| `GET /resident/push/config` | anyone | Web Push: `{vapidPublicKey, consentVersion}` |
| `POST /resident/otp` `{roomNumber, consentVersion, consentAccepted}` | anyone | US-24 step 1: claim a room → `{claimToken, expiresAt, roomNumber, buildingCode}` (no code) |
| `POST /resident/otp/verify` `{claimToken, code, subscription}` | anyone | US-24 step 4: register this browser → `{deviceToken, device}` |
| `GET /resident/me` | device `Bearer` token | US-25: the room's Pending Parcels |
| `PUT` / `DELETE /resident/push/subscription` | device `Bearer` token | Replace a rotated browser subscription · turn notifications off |
| `GET /rooms/:roomId/resident-otp` | signed in | US-24 step 3: the code Staff read out loud. 404 `NO_PENDING_RESIDENT_OTP` |
| `GET` / `DELETE /rooms/:roomId/push-subscriptions` | signed in | Devices registered to a room `{activeCount}` · revoke them all `{revokedCount}` |

### Resident page + Web Push notifications (Epic E3, revised 2026-10-21 — replaces LINE)

Full design: `docs/02-design/web-push-notification.md`. In short: a Resident opens `/resident/` (a
separate PWA page — no Staff account, no password), registers their phone with a code Staff read out
at the desk (the in-person hand-off is the identity check), and from then on:

- **sees whether anything has arrived** — the page lists the room's Pending Parcels (`GET /resident/me`)
  and keeps itself current while open: it reloads when a push arrives, when the app returns to the
  foreground, and every 30 s (which also catches Check-Out — no push is sent for a pickup);
- **gets a phone notification on Check-In** — Check-In writes a `push_notifications` outbox row
  **inside its own transaction** and a background worker (`internal/notify`) sends it — batched per
  room, skipped if already picked up, retried with backoff, dropped when the browser reports the
  subscription gone. Encryption (RFC 8291) and VAPID (RFC 8292) are implemented with the Go standard
  library in `internal/push`; push endpoints are restricted to the real browser push services (SSRF guard).

A resident-typed room is never trusted as free text: it must match exactly one directory room (the
full building+floor+room number, e.g. `3101`, not just `101`) or it is rejected (`AMBIGUOUS_ROOM` /
`ROOM_NOT_IN_DIRECTORY`).

The old LINE integration (webhook, rich-menu "Check Parcel" button, LINE OTP linking) was removed from
the code on 2026-10-27. Migration `0004_line_integration.sql` stays — applied migrations are never
edited — so the `line_links` / `line_otp_challenges` tables still exist, unused.

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
| `PARCEL_NOT_PENDING` | 409 | Already picked up; nothing was changed. Also returned by Edit for an unmatched Parcel (use Assign Room). `params.trackingCodes` |
| `PENDING_COUNT_CHANGED` | 409 | `expectedCount` ≠ actual (`params.expected`, `params.actual`); nothing was changed |
| `PARCEL_HAS_ROOM` | 409 | Assign-room on a Parcel that already has one |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Body is not `application/json` |
| `ROOM_NOT_IN_DIRECTORY` / `RESIDENT_NOT_IN_ROOM` | 422 | Room id not in the directory · recipient doesn't live there |
| `AMBIGUOUS_ROOM` | 422 | A resident-typed room claim matched more than one room (e.g. `101` exists in two buildings) |
| `PUSH_NOT_CONFIGURED` | 503 | No VAPID keys — resident push routes are deliberately inert |
| `NO_PENDING_RESIDENT_OTP` | 404 | No open registration request for that room right now |
| `OTP_INVALID` | 422 | Wrong code, or a code no Staff member has looked up yet (`params.attemptsLeft`) |
| `OTP_EXPIRED` | 410 | Expired, already used, or burnt after 5 wrong tries (`params.reason = "locked"`) |
| `TOO_MANY_OTP_REQUESTS` | 429 | The room already has 3 open registration requests |
| `INTERNAL_ERROR` | 500 | Details are logged server-side only |

## Design notes

- **Room validation is a foreign key**, plus an API check. An unknown room can't be stored no matter
  what the client sends. A Parcel with no usable room is parked (`room_id` NULL + `unmatched_reason`)
  until Staff pick a directory room — or hand it over directly: since migration 0007 a roomless
  Parcel can be checked out as is, keeping its reason and note, with the `checked_out` event as the
  record of who handed it over and when.
- **Check-out is race-safe.** The `UPDATE` only touches rows still `pending`; when two Staff pick the
  same Parcel exactly one succeeds and the other gets `409 PARCEL_NOT_PENDING` (covered by a concurrency test).
- **Audit trail** rows are written in the same transaction as the change, and `parcel_events` /
  `access_logs` reject `UPDATE`/`DELETE` at the database level.
- **RBAC** is enforced in the API (`requireRole`); role and active status are re-read from the
  database on every request, so disabling an account takes effect immediately.
- **Logs never contain search terms** (the request logger drops the query string): searches carry
  resident names, which are personal data.
- **The Resident registration OTP is stored in plaintext**, on purpose, unlike passwords or session
  tokens (the claim and device tokens are stored only as SHA-256): Staff must be able to read it back
  to a resident in person (that hand-off is the identity check, not
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
