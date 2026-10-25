package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"dpms/backend/internal/apperr"
)

// Web Push registration (US-24) and delivery outbox (US-23). See migration 0005.
const (
	residentOTPDigits        = 6
	residentOTPTTL           = 5 * time.Minute
	residentOTPMaxTries      = 5
	residentOTPMaxOpen       = 3 // open challenges per room at once — stops one person flooding the desk's list
	pushSubscriptionLifetime = 180 * 24 * time.Hour
	residentStatusLimit      = 20

	// DefaultPushBatchWindow is how long a room's first new Parcel waits for siblings before the
	// notification goes out. Long enough to merge a courier's drop of several Parcels, short enough
	// that the Resident still hears about it before they'd walk down to check.
	DefaultPushBatchWindow = 60 * time.Second
)

// randomToken returns a 256-bit URL-safe secret and the SHA-256 that is stored in its place.
func randomToken() (token string, hash []byte, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", nil, err
	}
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, hashToken(token), nil
}

func hashToken(token string) []byte {
	h := sha256.Sum256([]byte(token))
	return h[:]
}

// --- registration ------------------------------------------------------------------------------

// ResidentOTPClaim is what the Resident's browser gets back after claiming a room. The code itself
// is NOT in it — only Staff can see the code (that is the identity check).
type ResidentOTPClaim struct {
	ClaimToken   string    `json:"claimToken"`
	ExpiresAt    time.Time `json:"expiresAt"`
	RoomNumber   string    `json:"roomNumber"`
	BuildingCode string    `json:"buildingCode"`
}

// CreateResidentOTP opens a registration challenge for room, recording the consent version the
// Resident accepted before any code was issued (LR-01/LR-05).
func (s *Store) CreateResidentOTP(ctx context.Context, room *ResolvedRoom, consentVersion string) (*ResidentOTPClaim, error) {
	var open int
	if err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM resident_otp_challenges WHERE room_id = $1 AND consumed_at IS NULL AND expires_at > now()`,
		room.ID).Scan(&open); err != nil {
		return nil, err
	}
	if open >= residentOTPMaxOpen {
		return nil, apperr.New(apperr.TooManyOTPRequests, map[string]any{"retryAfterSeconds": int(residentOTPTTL.Seconds())})
	}
	code, err := randomDigits(residentOTPDigits)
	if err != nil {
		return nil, err
	}
	token, hash, err := randomToken()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(residentOTPTTL).UTC()
	if _, err := s.pool.Exec(ctx,
		`INSERT INTO resident_otp_challenges (room_id, claim_token_hash, code, consent_version, expires_at) VALUES ($1, $2, $3, $4, $5)`,
		room.ID, hash, code, consentVersion, expiresAt); err != nil {
		return nil, err
	}
	return &ResidentOTPClaim{ClaimToken: token, ExpiresAt: expiresAt, RoomNumber: room.RoomNumber, BuildingCode: room.BuildingCode}, nil
}

// ResidentOTPView is what Staff see at the desk to read out loud.
type ResidentOTPView struct {
	Code         string    `json:"code"`
	ExpiresAt    time.Time `json:"expiresAt"`
	RoomID       int64     `json:"roomId"`
	RoomNumber   string    `json:"roomNumber"`
	BuildingCode string    `json:"buildingCode"`
}

// PendingResidentOTP returns the room's newest open challenge and records which Staff member read
// it (the first reader is kept — that is who issued it). (nil, nil) when there is none.
func (s *Store) PendingResidentOTP(ctx context.Context, staffID, roomID int64) (*ResidentOTPView, error) {
	var v ResidentOTPView
	var id int64
	err := s.pool.QueryRow(ctx, `
SELECT c.id, c.code, c.expires_at, r.id, r.room_number, b.code
FROM resident_otp_challenges c
JOIN rooms r ON r.id = c.room_id
JOIN buildings b ON b.id = r.building_id
WHERE c.room_id = $1 AND c.consumed_at IS NULL AND c.expires_at > now()
ORDER BY c.created_at DESC LIMIT 1`, roomID).Scan(&id, &v.Code, &v.ExpiresAt, &v.RoomID, &v.RoomNumber, &v.BuildingCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.pool.Exec(ctx,
		`UPDATE resident_otp_challenges SET read_by_staff_id = $2, read_at = now() WHERE id = $1 AND read_at IS NULL`,
		id, staffID); err != nil {
		return nil, err
	}
	v.ExpiresAt = v.ExpiresAt.UTC()
	return &v, nil
}

// PushSubscriptionInput is a browser PushSubscription, already validated by the API layer.
type PushSubscriptionInput struct {
	Endpoint string
	P256dh   string
	Auth     string
}

// ResidentDevice is a registered browser as seen through its bearer token.
type ResidentDevice struct {
	SubscriptionID int64     `json:"-"`
	RoomID         int64     `json:"-"`
	RoomNumber     string    `json:"roomNumber"`
	BuildingCode   string    `json:"buildingCode"`
	ExpiresAt      time.Time `json:"expiresAt"`
}

// ResidentRegistration is the result of a successful OTP verification.
type ResidentRegistration struct {
	DeviceToken string         `json:"deviceToken"`
	Device      ResidentDevice `json:"device"`
}

// VerifyResidentOTP checks code against the challenge behind claimToken and, on a match, registers
// the browser's push subscription for that room. The whole thing runs under a row lock so a code
// can't be redeemed twice; wrong guesses burn the challenge after residentOTPMaxTries. A code that
// no Staff member has looked at yet is treated as wrong: matching it would mean it was guessed,
// not handed over in person.
func (s *Store) VerifyResidentOTP(ctx context.Context, claimToken, code string, sub PushSubscriptionInput) (*ResidentRegistration, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		id, roomID    int64
		want, consent string
		attempts      int
		expired       bool
		consumed      bool
		readBy        *int64
	)
	err = tx.QueryRow(ctx, `
SELECT id, room_id, code, consent_version, attempts, expires_at <= now(), consumed_at IS NOT NULL, read_by_staff_id
FROM resident_otp_challenges WHERE claim_token_hash = $1 FOR UPDATE`, hashToken(claimToken)).
		Scan(&id, &roomID, &want, &consent, &attempts, &expired, &consumed, &readBy)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && (expired || consumed)) {
		return nil, apperr.New(apperr.OTPExpired, nil)
	}
	if err != nil {
		return nil, err
	}

	if code != want || readBy == nil {
		attempts++
		left := residentOTPMaxTries - attempts
		if left <= 0 {
			_, err = tx.Exec(ctx, `UPDATE resident_otp_challenges SET attempts = $2, consumed_at = now() WHERE id = $1`, id, attempts)
		} else {
			_, err = tx.Exec(ctx, `UPDATE resident_otp_challenges SET attempts = $2 WHERE id = $1`, id, attempts)
		}
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		if left <= 0 {
			return nil, apperr.New(apperr.OTPExpired, map[string]any{"reason": "locked"})
		}
		return nil, apperr.New(apperr.OTPInvalid, map[string]any{"attemptsLeft": left})
	}

	if _, err := tx.Exec(ctx, `UPDATE resident_otp_challenges SET consumed_at = now() WHERE id = $1`, id); err != nil {
		return nil, err
	}
	// The same browser registering again (new room, or just re-doing it) supersedes its old row.
	if _, err := tx.Exec(ctx,
		`UPDATE push_subscriptions SET unsubscribed_at = now(), unsubscribed_reason = 'replaced'
		 WHERE endpoint = $1 AND unsubscribed_at IS NULL`, sub.Endpoint); err != nil {
		return nil, err
	}
	token, hash, err := randomToken()
	if err != nil {
		return nil, err
	}
	out := &ResidentRegistration{DeviceToken: token}
	d := &out.Device
	if err := tx.QueryRow(ctx, `
INSERT INTO push_subscriptions (room_id, endpoint, p256dh, auth, device_token_hash, consent_version, otp_challenge_id, issued_by_staff_id, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(secs => $9))
RETURNING id, room_id, expires_at`,
		roomID, sub.Endpoint, sub.P256dh, sub.Auth, hash, consent, id, *readBy, pushSubscriptionLifetime.Seconds()).
		Scan(&d.SubscriptionID, &d.RoomID, &d.ExpiresAt); err != nil {
		return nil, err
	}
	if err := tx.QueryRow(ctx,
		`SELECT r.room_number, b.code FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE r.id = $1`, roomID).
		Scan(&d.RoomNumber, &d.BuildingCode); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	d.ExpiresAt = d.ExpiresAt.UTC()
	return out, nil
}

// ResidentDeviceByToken resolves a PWA bearer token to its active, unexpired registration.
// (nil, nil) when the token is unknown, unsubscribed or expired.
func (s *Store) ResidentDeviceByToken(ctx context.Context, token string) (*ResidentDevice, error) {
	var d ResidentDevice
	err := s.pool.QueryRow(ctx, `
SELECT ps.id, ps.room_id, r.room_number, b.code, ps.expires_at
FROM push_subscriptions ps
JOIN rooms r ON r.id = ps.room_id
JOIN buildings b ON b.id = r.building_id
WHERE ps.device_token_hash = $1 AND ps.unsubscribed_at IS NULL AND ps.expires_at > now()`, hashToken(token)).
		Scan(&d.SubscriptionID, &d.RoomID, &d.RoomNumber, &d.BuildingCode, &d.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	d.ExpiresAt = d.ExpiresAt.UTC()
	return &d, nil
}

// UpdatePushEndpoint replaces a registration's browser subscription — browsers rotate them
// (pushsubscriptionchange), and the PWA re-sends the current one every time it opens.
func (s *Store) UpdatePushEndpoint(ctx context.Context, subscriptionID int64, sub PushSubscriptionInput) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx,
		`UPDATE push_subscriptions SET unsubscribed_at = now(), unsubscribed_reason = 'replaced'
		 WHERE endpoint = $1 AND id <> $2 AND unsubscribed_at IS NULL`, sub.Endpoint, subscriptionID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE push_subscriptions SET endpoint = $2, p256dh = $3, auth = $4 WHERE id = $1 AND unsubscribed_at IS NULL`,
		subscriptionID, sub.Endpoint, sub.P256dh, sub.Auth); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Unsubscribe ends one registration (the Resident turning notifications off, or the push service
// reporting it gone). Queued notifications for it are cancelled.
func (s *Store) Unsubscribe(ctx context.Context, subscriptionID int64, reason string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if _, err := tx.Exec(ctx,
		`UPDATE push_subscriptions SET unsubscribed_at = now(), unsubscribed_reason = $2::text::push_unsubscribe_reason
		 WHERE id = $1 AND unsubscribed_at IS NULL`, subscriptionID, reason); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE push_notifications SET status = 'cancelled' WHERE subscription_id = $1 AND status = 'queued'`, subscriptionID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// RoomPushSubscriptionCount is how many devices currently get a room's notifications.
func (s *Store) RoomPushSubscriptionCount(ctx context.Context, roomID int64) (int64, error) {
	var n int64
	err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM push_subscriptions WHERE room_id = $1 AND unsubscribed_at IS NULL AND expires_at > now()`, roomID).Scan(&n)
	return n, err
}

// RevokeRoomPushSubscriptions lets Staff cut off every device registered to a room (a Resident
// moved out, or asked at the desk). Records which Staff member did it.
func (s *Store) RevokeRoomPushSubscriptions(ctx context.Context, staffID, roomID int64) (int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM rooms WHERE id = $1)`, roomID).Scan(&exists); err != nil {
		return 0, err
	}
	if !exists {
		return 0, apperr.New(apperr.RoomNotInDirectory, map[string]any{"roomId": roomID})
	}
	tag, err := tx.Exec(ctx,
		`UPDATE push_subscriptions SET unsubscribed_at = now(), unsubscribed_reason = 'staff', unsubscribed_by_staff_id = $2
		 WHERE room_id = $1 AND unsubscribed_at IS NULL`, roomID, staffID)
	if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE push_notifications n SET status = 'cancelled'
		 FROM push_subscriptions s WHERE s.id = n.subscription_id AND s.room_id = $1 AND n.status = 'queued'`, roomID); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ResidentParcelStatus is the PWA's pull view (US-25): same minimal data as US-10.
type ResidentParcelStatus struct {
	Device       ResidentDevice      `json:"device"`
	PendingCount int64               `json:"pendingCount"`
	Pending      []ResidentParcelRow `json:"pending"`
}

type ResidentParcelRow struct {
	TrackingCode string    `json:"trackingCode"`
	CheckedInAt  time.Time `json:"checkedInAt"`
}

func (s *Store) ResidentParcelStatus(ctx context.Context, d *ResidentDevice) (*ResidentParcelStatus, error) {
	sum, err := s.PendingParcelSummary(ctx, d.RoomID)
	if err != nil {
		return nil, err
	}
	out := &ResidentParcelStatus{Device: *d, PendingCount: sum.Count, Pending: []ResidentParcelRow{}}
	for i, it := range sum.Items {
		if i >= residentStatusLimit {
			break
		}
		out.Pending = append(out.Pending, ResidentParcelRow{TrackingCode: it.TrackingCode, CheckedInAt: it.CheckedInAt.UTC()})
	}
	return out, nil
}

// --- outbox ------------------------------------------------------------------------------------

// enqueuePush queues (or merges into the open batch of) a notification for every active
// subscription of roomID. It runs inside the Check-In / Assign-Room transaction, so a Parcel and
// its notification are committed together or not at all — and it does no network I/O, so a push
// service outage can never slow down or fail a Check-In (ET-04).
func enqueuePush(ctx context.Context, q querier, roomID, parcelID int64, window time.Duration) error {
	_, err := q.Exec(ctx, `
INSERT INTO push_notifications (subscription_id, room_id, parcel_ids, next_attempt_at)
SELECT s.id, s.room_id, ARRAY[$2::bigint], now() + make_interval(secs => $3)
FROM push_subscriptions s
WHERE s.room_id = $1 AND s.unsubscribed_at IS NULL AND s.expires_at > now()
ON CONFLICT (subscription_id) WHERE status = 'queued' AND attempts = 0
DO UPDATE SET parcel_ids = push_notifications.parcel_ids || EXCLUDED.parcel_ids`,
		roomID, parcelID, window.Seconds())
	return err
}

// PushJob is one claimed notification, with everything the worker needs to send it.
type PushJob struct {
	ID             int64
	SubscriptionID int64
	RoomID         int64
	RoomNumber     string
	BuildingCode   string
	Attempts       int // including this one
	Endpoint       string
	P256dh         string
	Auth           string
	NewPending     int64 // Parcels in this batch that are still Pending (0 -> already picked up, skip)
	TotalPending   int64 // all Pending Parcels of the room right now
}

// ClaimDuePushes leases up to limit due notifications: their next_attempt_at is pushed out by
// lease and attempts is incremented, so a crashed worker's jobs come back on their own and two
// workers never send the same row (FOR UPDATE SKIP LOCKED).
func (s *Store) ClaimDuePushes(ctx context.Context, limit int, lease time.Duration) ([]PushJob, error) {
	rows, err := s.pool.Query(ctx, `
WITH due AS (
    SELECT n.id FROM push_notifications n
    WHERE n.status = 'queued' AND n.next_attempt_at <= now()
    ORDER BY n.next_attempt_at
    LIMIT $1
    FOR UPDATE SKIP LOCKED
), claimed AS (
    UPDATE push_notifications n
    SET attempts = n.attempts + 1, next_attempt_at = now() + make_interval(secs => $2)
    FROM due WHERE n.id = due.id
    RETURNING n.id, n.subscription_id, n.room_id, n.parcel_ids, n.attempts
)
SELECT c.id, c.subscription_id, c.room_id, r.room_number, b.code, c.attempts,
       s.endpoint, s.p256dh, s.auth,
       (SELECT count(*) FROM parcels p WHERE p.id = ANY(c.parcel_ids) AND p.status = 'pending' AND p.room_id = c.room_id),
       (SELECT count(*) FROM parcels p WHERE p.room_id = c.room_id AND p.status = 'pending'),
       s.unsubscribed_at IS NULL AND s.expires_at > now()
FROM claimed c
JOIN push_subscriptions s ON s.id = c.subscription_id
JOIN rooms r ON r.id = c.room_id
JOIN buildings b ON b.id = r.building_id`, limit, lease.Seconds())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var jobs []PushJob
	var inactive []int64
	for rows.Next() {
		var j PushJob
		var active bool
		if err := rows.Scan(&j.ID, &j.SubscriptionID, &j.RoomID, &j.RoomNumber, &j.BuildingCode, &j.Attempts,
			&j.Endpoint, &j.P256dh, &j.Auth, &j.NewPending, &j.TotalPending, &active); err != nil {
			return nil, err
		}
		if !active {
			inactive = append(inactive, j.ID)
			continue
		}
		jobs = append(jobs, j)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	for _, id := range inactive {
		if err := s.FinishPush(ctx, id, PushCancelled, 0, ""); err != nil {
			return nil, err
		}
	}
	return jobs, nil
}

// Push outcomes the worker reports back.
const (
	PushSent      = "sent"
	PushFailed    = "failed"
	PushCancelled = "cancelled"
)

// FinishPush records a final outcome for a claimed notification.
func (s *Store) FinishPush(ctx context.Context, id int64, status string, httpStatus int, errText string) error {
	_, err := s.pool.Exec(ctx, `
UPDATE push_notifications
SET status = $2::text::push_notification_status,
    sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
    last_http_status = NULLIF($3, 0), last_error = NULLIF($4, '')
WHERE id = $1`, id, status, httpStatus, errText)
	if err != nil || status != PushSent {
		return err
	}
	_, err = s.pool.Exec(ctx, `
UPDATE push_subscriptions s SET last_success_at = now()
FROM push_notifications n WHERE n.id = $1 AND s.id = n.subscription_id`, id)
	return err
}

// RetryPush leaves a claimed notification queued and schedules its next attempt.
func (s *Store) RetryPush(ctx context.Context, id int64, at time.Time, httpStatus int, errText string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE push_notifications SET next_attempt_at = $2, last_http_status = NULLIF($3, 0), last_error = NULLIF($4, '') WHERE id = $1`,
		id, at, httpStatus, errText)
	return err
}
