package store

import (
	"context"
	"crypto/rand"
	"math/big"
	"strings"
	"time"

	"dpms/backend/internal/apperr"
)

// pendingSummaryLimit bounds the Pending list a Resident sees — enough for any realistic room;
// the reply is still bounded, never unbounded.
const pendingSummaryLimit = 20

// ResolvedRoom is the minimal room identity a Resident's room claim resolves to.
type ResolvedRoom struct {
	ID           int64
	RoomNumber   string
	BuildingCode string
}

// ResolveRoomExact matches a resident-typed room claim ("101" or the full building+floor+room
// number "3101") to exactly one directory room. This is the same "never trust free text" rule
// Check-In applies via a dropdown — here, enforced by requiring an unambiguous match instead,
// since a Resident is typing into the PWA.
func (s *Store) ResolveRoomExact(ctx context.Context, raw string) (*ResolvedRoom, error) {
	q := strings.TrimSpace(raw)
	if q == "" {
		return nil, apperr.New(apperr.RoomNotInDirectory, nil)
	}
	rows, err := s.pool.Query(ctx, `
SELECT r.id, r.room_number, b.code
FROM rooms r JOIN buildings b ON b.id = r.building_id
WHERE r.room_number = $1 OR lower(b.code || r.room_number) = lower($1)
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

// PendingParcelItem is one row of a room's pending-parcel summary — a system reference and when it
// arrived. No courier identity, no other resident's name (US-10 minimal data).
type PendingParcelItem struct {
	TrackingCode string
	CheckedInAt  time.Time
}

// PendingParcelSummary is the minimal-data content of the Resident status view (US-25, US-10): a
// count plus each pending parcel's system reference — no courier identity, no other resident's name.
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
		roomID, pendingSummaryLimit)
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
