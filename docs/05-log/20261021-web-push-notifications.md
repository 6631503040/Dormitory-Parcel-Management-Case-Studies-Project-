# 2026-10-21 — Resident notifications: LINE → PWA / Web Push

## Decision

- The team stops using LINE for Resident communication. Epic E3 is revised: Residents now **receive a
  push notification on Check-In** through a PWA (`/resident/`) using standard Web Push, instead of
  pulling status from a LINE chatbot.
- Identity check stays the same: a 6-digit code that only Staff can see, read out in person at the desk.
- Backlog: `US-08`, `US-11` deprecated → `US-23` (push on Check-In), `US-24` (desk-OTP device
  registration), `US-25` (status page). `LR-01/03/05`, `ET-04` wording updated to match.
- Design: `docs/02-design/web-push-notification.md`.

## Built

- `db/migrations/0005_web_push_notifications.sql` — `resident_otp_challenges`, `push_subscriptions`,
  `push_notifications` (transactional outbox). Additive; LINE tables untouched.
- Backend: `internal/push` (RFC 8291 encryption + RFC 8292 VAPID, Go stdlib only, RFC test vector
  passes), `internal/notify` (outbox worker: batching, retry/backoff, gone-subscription cleanup),
  `internal/store/push.go`, `internal/api/push_handlers.go`, `cmd/vapidkeys`. Check-In and Assign-Room
  enqueue inside their own transactions. Config: `VAPID_*`, `PUSH_BATCH_WINDOW_SECONDS`.
- Frontend: Resident PWA (`resident/index.html`, `src/resident/*`, `public/resident/{sw.js,manifest,icons}`);
  Staff modal `ResidentOtpModal.jsx` (bell icon in the top bar) replaces the LINE OTP modal in the UI.
- Tests: Go unit + integration (10 new push integration tests), Vitest (11 new). All green.

## Action items

- [ ] **Advisor sign-off** — E3 changes from pull to push (scope gate in `CLAUDE.md`).
- [ ] Generate VAPID keys for the demo machine (`docker compose run --rm backend /app/vapidkeys`) → `docker/.env`.
- [ ] Real-device test over HTTPS (cloudflared tunnel): one Android phone, one iPhone added to Home Screen.
- [ ] Print a QR code to `https://<host>/resident/` for the parcel desk.
- [ ] After sign-off: remove the unused LINE code (`internal/line`, `/line/webhook`, `LineOtpModal.jsx`).
