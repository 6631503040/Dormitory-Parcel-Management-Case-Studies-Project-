package store

import (
	"context"
	"encoding/json"
	"strings"
	"time"
)

// RoomHit is one autocomplete suggestion for the Room Number field: a directory room plus who lives there.
type RoomHit struct {
	ID           int64      `json:"id"`
	RoomNumber   string     `json:"roomNumber"`
	BuildingCode string     `json:"buildingCode"`
	Residents    []Resident `json:"residents"`
}

// SearchRooms backs the Room Number autocomplete. It matches a room-number prefix, a full
// building+room prefix ("3101" = building 3, floor 1, room 01 — no separator, no "B"), or any part
// of a resident's name or nickname. Exact room-number matches sort first.
func (s *Store) SearchRooms(ctx context.Context, query string, limit int) ([]RoomHit, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return []RoomHit{}, nil
	}
	prefix := escapeLike(q) + "%"
	contains := "%" + escapeLike(q) + "%"

	rows, err := s.pool.Query(ctx, `
SELECT r.id, r.room_number, b.code,
       COALESCE(jsonb_agg(jsonb_build_object('id', rs.id, 'fullName', rs.full_name, 'nickname', rs.nickname)
                          ORDER BY rs.full_name) FILTER (WHERE rs.id IS NOT NULL), '[]'::jsonb)
FROM rooms r
JOIN buildings b ON b.id = r.building_id
LEFT JOIN residents rs ON rs.room_id = r.id AND rs.is_active
WHERE r.room_number ILIKE $1
   OR (b.code || r.room_number) ILIKE $1
   OR EXISTS (SELECT 1 FROM residents m WHERE m.room_id = r.id AND m.is_active
              AND (m.full_name ILIKE $2 OR m.nickname ILIKE $2))
GROUP BY r.id, b.code
ORDER BY (lower(r.room_number) = lower($3)) DESC, b.code, r.room_number
LIMIT $4`, prefix, contains, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hits := []RoomHit{}
	for rows.Next() {
		var h RoomHit
		var residentsJSON []byte
		if err := rows.Scan(&h.ID, &h.RoomNumber, &h.BuildingCode, &residentsJSON); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(residentsJSON, &h.Residents); err != nil {
			return nil, err
		}
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

// DirectoryEntry is one row of the read-only Directory screen. Phone is PII and is never selected.
type DirectoryEntry struct {
	ResidentID   int64   `json:"residentId"`
	FullName     string  `json:"fullName"`
	Nickname     *string `json:"nickname"`
	RoomID       int64   `json:"roomId"`
	RoomNumber   string  `json:"roomNumber"`
	BuildingCode string  `json:"buildingCode"`
}

func (s *Store) ListDirectory(ctx context.Context, query string, page, pageSize int) (Page[DirectoryEntry], error) {
	out := Page[DirectoryEntry]{Items: []DirectoryEntry{}, Page: page, PageSize: pageSize}

	var b queryBuilder
	b.where(`rs.is_active`)
	if q := strings.TrimSpace(query); q != "" {
		prefix := b.arg(escapeLike(q) + "%")
		contains := b.arg("%" + escapeLike(q) + "%")
		b.where(`(r.room_number ILIKE ` + prefix + ` OR rs.full_name ILIKE ` + contains + ` OR rs.nickname ILIKE ` + contains + `)`)
	}
	where := b.whereSQL()
	from := ` FROM residents rs JOIN rooms r ON r.id = rs.room_id JOIN buildings b ON b.id = r.building_id`

	if err := s.pool.QueryRow(ctx, `SELECT count(*)`+from+where, b.args...).Scan(&out.Total); err != nil {
		return out, err
	}
	if out.Total == 0 {
		return out, nil
	}

	limit, offset := b.arg(pageSize), b.arg((page-1)*pageSize)
	rows, err := s.pool.Query(ctx,
		`SELECT rs.id, rs.full_name, rs.nickname, r.id, r.room_number, b.code`+from+where+
			` ORDER BY b.code, r.room_number, rs.full_name, rs.id LIMIT `+limit+` OFFSET `+offset, b.args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var e DirectoryEntry
		if err := rows.Scan(&e.ResidentID, &e.FullName, &e.Nickname, &e.RoomID, &e.RoomNumber, &e.BuildingCode); err != nil {
			return out, err
		}
		out.Items = append(out.Items, e)
	}
	return out, rows.Err()
}

type Dashboard struct {
	Date             string   `json:"date"`
	CheckedIn        int64    `json:"checkedIn"`
	PickedUp         int64    `json:"pickedUp"`
	Pending          int64    `json:"pending"`
	UnmatchedPending int64    `json:"unmatchedPending"`
	RecentCheckIns   []Parcel `json:"recentCheckIns"`
}

// Dashboard counts one calendar day [dayStart, dayEnd): Parcels checked in, Parcels picked up, and
// Parcels still Pending at the end of that day (checked in before it ended and not yet handed over).
func (s *Store) Dashboard(ctx context.Context, date string, dayStart, dayEnd time.Time, recentLimit int) (*Dashboard, error) {
	d := &Dashboard{Date: date}
	err := s.pool.QueryRow(ctx, `
SELECT
  (SELECT count(*) FROM parcels WHERE checked_in_at >= $1 AND checked_in_at < $2),
  (SELECT count(*) FROM parcels WHERE checked_out_at >= $1 AND checked_out_at < $2),
  (SELECT count(*) FROM parcels WHERE status = 'pending' AND checked_in_at < $2)
    + (SELECT count(*) FROM parcels WHERE checked_out_at >= $2 AND checked_in_at < $2),
  (SELECT count(*) FROM parcels WHERE room_id IS NULL AND status = 'pending')`,
		dayStart, dayEnd).Scan(&d.CheckedIn, &d.PickedUp, &d.Pending, &d.UnmatchedPending)
	if err != nil {
		return nil, err
	}

	recent, err := s.ListParcels(ctx, ParcelFilter{From: &dayStart, To: &dayEnd, Page: 1, PageSize: recentLimit})
	if err != nil {
		return nil, err
	}
	d.RecentCheckIns = recent.Items
	return d, nil
}
