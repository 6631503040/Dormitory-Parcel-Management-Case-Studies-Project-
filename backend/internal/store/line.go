package store

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"dpms/backend/internal/apperr"
)

const (
	lineOTPDigits   = 6
	lineOTPTTL      = 5 * time.Minute
	lineOTPMaxTries = 5
	lineStatusLimit = 20 // enough for any realistic room; the reply is still bounded, never unbounded
)

// ResolvedRoom is the minimal room identity the LINE flow needs.
type ResolvedRoom struct {
	ID           int64
	RoomNumber   string
	BuildingCode string
}

// ResolveRoomExact matches a resident-typed room claim ("101" or the full building+floor+room
// number "3101") to exactly one directory room. This is the same "never trust free text" rule
// Check-In applies via a dropdown — here, enforced by requiring an unambiguous match instead,
// since a resident is typing in LINE.
func (s *Store) ResolveRoomExact(ctx context.Context, raw string) (*ResolvedRoom, error) {
	q := strings.TrimSpace(raw)
	if q == "" {
		return nil, apperr.New(apperr.RoomNotInDirectory, nil)
	}
	rows, err := s.pool.Query(ctx, `
SELECT r.id, r.room_number, b.code
FROM rooms r JOIN buildings b ON b.id = r.building_id
WHERE r.room_number = $1 OR (b.code || r.room_number) ILIKE $1
LIMIT 2`, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hits []ResolvedRoom
	for rows.Next() {
		var h ResolvedRoom
		if err := rows.Scan(&h.ID, &h.RoomNumber, &h.BuildingCode); err != nil {
			return nil, err
		}
		hits = append(hits, h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	switch len(hits) {
	case 0:
		return nil, apperr.New(apperr.RoomNotInDirectory, nil)
	case 1:
		return &hits[0], nil
	default:
		return nil, apperr.New(apperr.AmbiguousRoom, nil)
	}
}

// GenerateLineOTP creates a fresh single-use code claiming roomID for lineUserID. The code is
// held in plaintext for the few minutes it's valid — staff must be able to read it back to the
// resident in person (that hand-off is the actual identity check, US-11 step 3); it is never sent
// over LINE itself.
func (s *Store) GenerateLineOTP(ctx context.Context, lineUserID string, roomID int64) (code string, expiresAt time.Time, err error) {
	code, err = randomDigits(lineOTPDigits)
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt = time.Now().Add(lineOTPTTL)
	_, err = s.pool.Exec(ctx,
		`INSERT INTO line_otp_challenges (line_user_id, room_id, code, expires_at) VALUES ($1, $2, $3, $4)`,
		lineUserID, roomID, code, expiresAt)
	return code, expiresAt, err
}

func randomDigits(n int) (string, error) {
	digits := make([]byte, n)
	for i := range digits {
		v, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		digits[i] = byte('0') + byte(v.Int64())
	}
	return string(digits), nil
}

type LineOTPOutcome int

const (
	LineOTPExpiredOrNone LineOTPOutcome = iota
	LineOTPMismatch
	LineOTPLocked
	LineOTPMatched
)

type LineOTPResult struct {
	Outcome      LineOTPOutcome
	RoomID       int64
	RoomNumber   string
	BuildingCode string
}

// VerifyLineOTP checks code against the newest unconsumed, unexpired challenge lineUserID has
// open. A match links the LINE account to that room, superseding any earlier active link for the
// same account (a resident can only be linked to one room at a time; moving rooms re-links rather
// than getting stuck). Everything happens under one row lock so a valid code can't be consumed
// twice by a race, and repeated wrong guesses burn the challenge after lineOTPMaxTries.
func (s *Store) VerifyLineOTP(ctx context.Context, lineUserID, code string) (LineOTPResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return LineOTPResult{}, err
	}
	defer tx.Rollback(ctx)

	var (
		challengeID int64
		roomID      int64
		want        string
		attempts    int
	)
	err = tx.QueryRow(ctx, `
SELECT id, room_id, code, attempts
FROM line_otp_challenges
WHERE line_user_id = $1 AND consumed_at IS NULL AND expires_at > now()
ORDER BY created_at DESC LIMIT 1
FOR UPDATE`, lineUserID).Scan(&challengeID, &roomID, &want, &attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return LineOTPResult{Outcome: LineOTPExpiredOrNone}, nil
	}
	if err != nil {
		return LineOTPResult{}, err
	}

	if want != code {
		attempts++
		locked := attempts >= lineOTPMaxTries
		if locked {
			_, err = tx.Exec(ctx, `UPDATE line_otp_challenges SET attempts = $2, consumed_at = now() WHERE id = $1`, challengeID, attempts)
		} else {
			_, err = tx.Exec(ctx, `UPDATE line_otp_challenges SET attempts = $2 WHERE id = $1`, challengeID, attempts)
		}
		if err != nil {
			return LineOTPResult{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return LineOTPResult{}, err
		}
		if locked {
			return LineOTPResult{Outcome: LineOTPLocked}, nil
		}
		return LineOTPResult{Outcome: LineOTPMismatch}, nil
	}

	if _, err := tx.Exec(ctx, `UPDATE line_otp_challenges SET consumed_at = now() WHERE id = $1`, challengeID); err != nil {
		return LineOTPResult{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE line_links SET unlinked_at = now() WHERE line_user_id = $1 AND unlinked_at IS NULL`, lineUserID); err != nil {
		return LineOTPResult{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO line_links (line_user_id, room_id, consent_version) VALUES ($1, $2, 'v1')`, lineUserID, roomID); err != nil {
		return LineOTPResult{}, err
	}
	var roomNumber, buildingCode string
	if err := tx.QueryRow(ctx,
		`SELECT r.room_number, b.code FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE r.id = $1`, roomID).
		Scan(&roomNumber, &buildingCode); err != nil {
		return LineOTPResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return LineOTPResult{}, err
	}
	return LineOTPResult{Outcome: LineOTPMatched, RoomID: roomID, RoomNumber: roomNumber, BuildingCode: buildingCode}, nil
}

// LineLink is a LINE account's current room link.
type LineLink struct {
	LineUserID   string
	RoomID       int64
	RoomNumber   string
	BuildingCode string
	LinkedAt     time.Time
}

// ActiveLineLink returns (nil, nil) when lineUserID has no current link — the default state for
// most residents, not an error.
func (s *Store) ActiveLineLink(ctx context.Context, lineUserID string) (*LineLink, error) {
	var l LineLink
	err := s.pool.QueryRow(ctx, `
SELECT ll.line_user_id, ll.room_id, r.room_number, b.code, ll.linked_at
FROM line_links ll
JOIN rooms r ON r.id = ll.room_id
JOIN buildings b ON b.id = r.building_id
WHERE ll.line_user_id = $1 AND ll.unlinked_at IS NULL`, lineUserID).
		Scan(&l.LineUserID, &l.RoomID, &l.RoomNumber, &l.BuildingCode, &l.LinkedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

// PendingParcelItem is one row of a room's pending-parcel summary — a system reference and when it
// arrived. No courier identity, no other resident's name (US-10 minimal data).
type PendingParcelItem struct {
	TrackingCode string
	CheckedInAt  time.Time
}

// PendingParcelSummary is the minimal-data reply content for US-08/US-10: a count plus each
// pending parcel's system reference — no courier identity, no other resident's name.
type PendingParcelSummary struct {
	Count int64
	Items []PendingParcelItem
}

func (s *Store) PendingParcelSummary(ctx context.Context, roomID int64) (PendingParcelSummary, error) {
	var out PendingParcelSummary
	if err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM parcels WHERE room_id = $1 AND status = 'pending'`, roomID).Scan(&out.Count); err != nil {
		return out, err
	}
	if out.Count == 0 {
		return out, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT tracking_code, checked_in_at FROM parcels WHERE room_id = $1 AND status = 'pending' ORDER BY checked_in_at LIMIT $2`,
		roomID, lineStatusLimit)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var it PendingParcelItem
		if err := rows.Scan(&it.TrackingCode, &it.CheckedInAt); err != nil {
			return out, err
		}
		out.Items = append(out.Items, it)
	}
	return out, rows.Err()
}

// LineOTPView is what staff see when they look up a room's pending code to read it out loud.
type LineOTPView struct {
	Code         string    `json:"code"`
	ExpiresAt    time.Time `json:"expiresAt"`
	RoomID       int64     `json:"roomId"`
	RoomNumber   string    `json:"roomNumber"`
	BuildingCode string    `json:"buildingCode"`
}

// PendingLineOTP is how staff at the desk read a resident's OTP back to them in person — the
// code itself is never sent over LINE. The first staff member to view a given challenge is
// recorded (ties to LR-05); later views (by the same or another staff member) don't overwrite who
// actually issued it. Returns (nil, nil) when the room has no pending, unexpired challenge.
func (s *Store) PendingLineOTP(ctx context.Context, staffID, roomID int64) (*LineOTPView, error) {
	var v LineOTPView
	var challengeID int64
	err := s.pool.QueryRow(ctx, `
SELECT c.id, c.code, c.expires_at, r.id, r.room_number, b.code
FROM line_otp_challenges c
JOIN rooms r ON r.id = c.room_id
JOIN buildings b ON b.id = r.building_id
WHERE c.room_id = $1 AND c.consumed_at IS NULL AND c.expires_at > now()
ORDER BY c.created_at DESC LIMIT 1`, roomID).
		Scan(&challengeID, &v.Code, &v.ExpiresAt, &v.RoomID, &v.RoomNumber, &v.BuildingCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.pool.Exec(ctx,
		`UPDATE line_otp_challenges SET read_by_staff_id = $2, read_at = now() WHERE id = $1 AND read_at IS NULL`,
		challengeID, staffID); err != nil {
		return nil, err
	}
	return &v, nil
}
