package store

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"dpms/backend/internal/apperr"
)

type Resident struct {
	ID       int64   `json:"id"`
	FullName string  `json:"fullName"`
	Nickname *string `json:"nickname"`
}

type RoomRef struct {
	ID           int64  `json:"id"`
	RoomNumber   string `json:"roomNumber"`
	BuildingCode string `json:"buildingCode"`
}

type Parcel struct {
	ID              int64      `json:"id"`
	TrackingCode    string     `json:"trackingCode"`
	Status          string     `json:"status"`
	Note            *string    `json:"note"`
	UnmatchedReason *string    `json:"unmatchedReason"`
	ResidentID      *int64     `json:"residentId"`
	Room            *RoomRef   `json:"room"` // nil while the Parcel is unmatched
	Residents       []Resident `json:"residents"`
	CheckedInBy     StaffRef   `json:"checkedInBy"`
	CheckedInAt     time.Time  `json:"checkedInAt"`
	CheckedOutBy    *StaffRef  `json:"checkedOutBy"`
	CheckedOutAt    *time.Time `json:"checkedOutAt"`
}

type ParcelEvent struct {
	ID         int64           `json:"id"`
	EventType  string          `json:"eventType"`
	Staff      StaffRef        `json:"staff"`
	OccurredAt time.Time       `json:"occurredAt"`
	Detail     json.RawMessage `json:"detail"`
}

type ParcelDetail struct {
	Parcel
	Events []ParcelEvent `json:"events"`
}

// parcelSelect joins everything a Parcel response needs in one statement; the active residents of
// the room are aggregated in a lateral subquery so list endpoints have no N+1 queries.
const parcelSelect = `
SELECT p.id, p.tracking_code, p.status::text, p.note, p.unmatched_reason::text, p.resident_id,
       r.id, r.room_number, b.code,
       COALESCE(res.j, '[]'::jsonb),
       ci.id, ci.full_name, p.checked_in_at,
       co.id, co.full_name, p.checked_out_at
FROM parcels p
LEFT JOIN rooms r ON r.id = p.room_id
LEFT JOIN buildings b ON b.id = r.building_id
LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id', rs.id, 'fullName', rs.full_name, 'nickname', rs.nickname)
                     ORDER BY rs.full_name) AS j
    FROM residents rs WHERE rs.room_id = p.room_id AND rs.is_active
) res ON true
JOIN staff ci ON ci.id = p.checked_in_by
LEFT JOIN staff co ON co.id = p.checked_out_by`

func scanParcel(row scanner) (Parcel, error) {
	var (
		p                            Parcel
		roomID, coID                 *int64
		roomNumber, buildingCode, cn *string
		residentsJSON                []byte
	)
	err := row.Scan(&p.ID, &p.TrackingCode, &p.Status, &p.Note, &p.UnmatchedReason, &p.ResidentID,
		&roomID, &roomNumber, &buildingCode, &residentsJSON,
		&p.CheckedInBy.ID, &p.CheckedInBy.FullName, &p.CheckedInAt,
		&coID, &cn, &p.CheckedOutAt)
	if err != nil {
		return p, err
	}
	if roomID != nil {
		p.Room = &RoomRef{ID: *roomID, RoomNumber: *roomNumber, BuildingCode: *buildingCode}
	}
	if coID != nil {
		p.CheckedOutBy = &StaffRef{ID: *coID, FullName: *cn}
	}
	if err := json.Unmarshal(residentsJSON, &p.Residents); err != nil {
		return p, err
	}
	p.CheckedInAt = p.CheckedInAt.UTC()
	if p.CheckedOutAt != nil {
		t := p.CheckedOutAt.UTC()
		p.CheckedOutAt = &t
	}
	return p, nil
}

func parcelsByIDs(ctx context.Context, q querier, ids []int64) ([]Parcel, error) {
	rows, err := q.Query(ctx, parcelSelect+` WHERE p.id = ANY($1) ORDER BY p.checked_in_at DESC, p.id DESC`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Parcel, 0, len(ids))
	for rows.Next() {
		p, err := scanParcel(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func pgConstraint(err error, code, constraint string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == code && pgErr.ConstraintName == constraint
}

type CheckInInput struct {
	TrackingCode    string
	RoomID          *int64 // exactly one of RoomID / UnmatchedReason is set (validated by the API layer)
	ResidentID      *int64
	UnmatchedReason *string
	Note            *string
}

// CheckIn records a Parcel and its `checked_in` audit event in one transaction. The room is
// validated by the foreign key to the directory, so an unknown room can never be stored.
func (s *Store) CheckIn(ctx context.Context, staffID int64, in CheckInInput) (*Parcel, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if in.ResidentID != nil {
		ok := false
		if in.RoomID != nil {
			if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM residents WHERE id = $1 AND room_id = $2 AND is_active)`,
				*in.ResidentID, *in.RoomID).Scan(&ok); err != nil {
				return nil, err
			}
		}
		if !ok {
			return nil, apperr.New(apperr.ResidentNotInRoom, map[string]any{"residentId": *in.ResidentID})
		}
	}

	var id int64
	err = tx.QueryRow(ctx,
		`INSERT INTO parcels (tracking_code, room_id, resident_id, unmatched_reason, note, checked_in_by)
		 VALUES ($1, $2, $3, $4::text::unmatched_reason, $5, $6) RETURNING id`,
		in.TrackingCode, in.RoomID, in.ResidentID, in.UnmatchedReason, in.Note, staffID).Scan(&id)
	switch {
	case pgConstraint(err, "23505", "parcels_tracking_code_key"):
		_ = tx.Rollback(ctx)
		return nil, s.duplicateError(ctx, in.TrackingCode)
	case pgConstraint(err, "23503", "parcels_room_id_fkey"):
		return nil, apperr.New(apperr.RoomNotInDirectory, map[string]any{"roomId": in.RoomID})
	case err != nil:
		return nil, err
	}

	detail := map[string]any{}
	if in.RoomID != nil {
		detail["roomId"] = *in.RoomID
	}
	if in.UnmatchedReason != nil {
		detail["unmatchedReason"] = *in.UnmatchedReason
	}
	if err := insertEvent(ctx, tx, id, staffID, "checked_in", detail); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	parcels, err := parcelsByIDs(ctx, s.pool, []int64{id})
	if err != nil || len(parcels) == 0 {
		return nil, err
	}
	return &parcels[0], nil
}

// duplicateError tells Staff where the existing Parcel is ("already checked in for Room X at T").
func (s *Store) duplicateError(ctx context.Context, code string) error {
	var roomNumber, building *string
	var at time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT r.room_number, b.code, p.checked_in_at
		 FROM parcels p LEFT JOIN rooms r ON r.id = p.room_id LEFT JOIN buildings b ON b.id = r.building_id
		 WHERE p.tracking_code = $1`, code).Scan(&roomNumber, &building, &at)
	if err != nil {
		return apperr.New(apperr.DuplicateTrackingCode, map[string]any{"trackingCode": code})
	}
	params := map[string]any{"trackingCode": code, "checkedInAt": at.UTC()}
	if roomNumber != nil {
		params["roomNumber"] = *roomNumber
		params["buildingCode"] = *building
	}
	return apperr.New(apperr.DuplicateTrackingCode, params)
}

func insertEvent(ctx context.Context, q querier, parcelID, staffID int64, eventType string, detail map[string]any) error {
	var raw []byte
	if len(detail) > 0 {
		var err error
		if raw, err = json.Marshal(detail); err != nil {
			return err
		}
	}
	_, err := q.Exec(ctx,
		`INSERT INTO parcel_events (parcel_id, event_type, staff_id, detail) VALUES ($1, $2::text::parcel_event_type, $3, $4::jsonb)`,
		parcelID, eventType, staffID, raw)
	return err
}

func insertEvents(ctx context.Context, q querier, parcelIDs []int64, staffID int64, eventType string, detail map[string]any) error {
	var raw []byte
	if len(detail) > 0 {
		var err error
		if raw, err = json.Marshal(detail); err != nil {
			return err
		}
	}
	_, err := q.Exec(ctx,
		`INSERT INTO parcel_events (parcel_id, event_type, staff_id, detail)
		 SELECT unnest($1::bigint[]), $2::text::parcel_event_type, $3, $4::jsonb`,
		parcelIDs, eventType, staffID, raw)
	return err
}

// collectIDs drains the RETURNING rows of a check-out UPDATE. That UPDATE only touches rows that are
// still Pending, so two Staff checking out the same Parcel can never both succeed.
func collectIDs(rows pgx.Rows) (ids []int64, codes []string, err error) {
	defer rows.Close()
	for rows.Next() {
		var id int64
		var code string
		if err = rows.Scan(&id, &code); err != nil {
			return nil, nil, err
		}
		ids = append(ids, id)
		codes = append(codes, code)
	}
	return ids, codes, rows.Err()
}

// CheckOut hands over the listed Parcels ("Check Out Selected") all-or-nothing: if any code is
// unknown or no longer Pending, nothing changes and the error names the offending codes.
func (s *Store) CheckOut(ctx context.Context, staffID int64, codes []string) ([]Parcel, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	rows, err := tx.Query(ctx,
		`UPDATE parcels SET status = 'picked_up', checked_out_by = $1, checked_out_at = now(), updated_at = now()
		 WHERE tracking_code = ANY($2) AND status = 'pending' AND room_id IS NOT NULL
		 RETURNING id, tracking_code`, staffID, codes)
	if err != nil {
		return nil, err
	}
	ids, done, err := collectIDs(rows)
	if err != nil {
		return nil, err
	}

	if len(done) != len(codes) {
		doneSet := make(map[string]bool, len(done))
		for _, c := range done {
			doneSet[c] = true
		}
		var missing []string
		for _, c := range codes {
			if !doneSet[c] {
				missing = append(missing, c)
			}
		}
		existRows, err := tx.Query(ctx, `SELECT tracking_code FROM parcels WHERE tracking_code = ANY($1)`, missing)
		if err != nil {
			return nil, err
		}
		exists := map[string]bool{}
		for existRows.Next() {
			var c string
			if err := existRows.Scan(&c); err != nil {
				existRows.Close()
				return nil, err
			}
			exists[c] = true
		}
		existRows.Close()
		if err := existRows.Err(); err != nil {
			return nil, err
		}
		var notFound []string
		for _, c := range missing {
			if !exists[c] {
				notFound = append(notFound, c)
			}
		}
		if len(notFound) > 0 {
			return nil, apperr.New(apperr.ParcelNotFound, map[string]any{"trackingCodes": notFound})
		}
		return nil, apperr.New(apperr.ParcelNotPending, map[string]any{"trackingCodes": missing})
	}

	if err := insertEvents(ctx, tx, ids, staffID, "checked_out", nil); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return parcelsByIDs(ctx, s.pool, ids)
}

// CheckOutAll hands over every Pending Parcel of a room in one action. expected (optional) is the
// count Staff confirmed on screen; if Parcels arrived or left since, nothing changes.
func (s *Store) CheckOutAll(ctx context.Context, staffID, roomID int64, expected *int) ([]Parcel, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var roomExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM rooms WHERE id = $1)`, roomID).Scan(&roomExists); err != nil {
		return nil, err
	}
	if !roomExists {
		return nil, apperr.New(apperr.RoomNotInDirectory, map[string]any{"roomId": roomID})
	}

	rows, err := tx.Query(ctx,
		`UPDATE parcels SET status = 'picked_up', checked_out_by = $1, checked_out_at = now(), updated_at = now()
		 WHERE room_id = $2 AND status = 'pending' RETURNING id, tracking_code`, staffID, roomID)
	if err != nil {
		return nil, err
	}
	ids, _, err := collectIDs(rows)
	if err != nil {
		return nil, err
	}

	if expected != nil && len(ids) != *expected {
		return nil, apperr.New(apperr.PendingCountChanged, map[string]any{"expected": *expected, "actual": len(ids)})
	}
	if len(ids) == 0 {
		return nil, apperr.New(apperr.NoPendingParcels, map[string]any{"roomId": roomID})
	}

	if err := insertEvents(ctx, tx, ids, staffID, "checked_out_bulk", map[string]any{"roomId": roomID, "count": len(ids)}); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return parcelsByIDs(ctx, s.pool, ids)
}

// AssignRoom resolves an unmatched Parcel by attaching a directory room to it.
func (s *Store) AssignRoom(ctx context.Context, staffID int64, trackingCode string, roomID int64) (*Parcel, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var roomExists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM rooms WHERE id = $1)`, roomID).Scan(&roomExists); err != nil {
		return nil, err
	}
	if !roomExists {
		return nil, apperr.New(apperr.RoomNotInDirectory, map[string]any{"roomId": roomID})
	}

	var id int64
	err = tx.QueryRow(ctx,
		`UPDATE parcels SET room_id = $1, unmatched_reason = NULL, updated_at = now()
		 WHERE tracking_code = $2 AND room_id IS NULL AND status = 'pending' RETURNING id`, roomID, trackingCode).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		var exists bool
		if qerr := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM parcels WHERE tracking_code = $1)`, trackingCode).Scan(&exists); qerr != nil {
			return nil, qerr
		}
		if !exists {
			return nil, apperr.New(apperr.ParcelNotFound, map[string]any{"trackingCodes": []string{trackingCode}})
		}
		return nil, apperr.New(apperr.ParcelHasRoom, map[string]any{"trackingCode": trackingCode})
	}
	if err != nil {
		return nil, err
	}

	if err := insertEvent(ctx, tx, id, staffID, "room_assigned", map[string]any{"roomId": roomID}); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	parcels, err := parcelsByIDs(ctx, s.pool, []int64{id})
	if err != nil || len(parcels) == 0 {
		return nil, err
	}
	return &parcels[0], nil
}

// GetParcel returns one Parcel with its full chain of custody, oldest event first.
func (s *Store) GetParcel(ctx context.Context, trackingCode string) (*ParcelDetail, error) {
	p, err := scanParcel(s.pool.QueryRow(ctx, parcelSelect+` WHERE p.tracking_code = $1`, trackingCode))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.ParcelNotFound, map[string]any{"trackingCodes": []string{trackingCode}})
	}
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT e.id, e.event_type::text, st.id, st.full_name, e.occurred_at, e.detail
		 FROM parcel_events e JOIN staff st ON st.id = e.staff_id
		 WHERE e.parcel_id = $1 ORDER BY e.occurred_at, e.id`, p.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	d := &ParcelDetail{Parcel: p, Events: []ParcelEvent{}}
	for rows.Next() {
		var e ParcelEvent
		var detail []byte
		if err := rows.Scan(&e.ID, &e.EventType, &e.Staff.ID, &e.Staff.FullName, &e.OccurredAt, &detail); err != nil {
			return nil, err
		}
		e.OccurredAt = e.OccurredAt.UTC()
		if detail != nil {
			e.Detail = detail
		}
		d.Events = append(d.Events, e)
	}
	return d, rows.Err()
}

type ParcelFilter struct {
	Query           string // matches Tracking Code (prefix), Room Number (prefix), or Resident name/nickname
	Status          string
	RoomID          *int64
	Unmatched       *bool
	UnmatchedReason string
	From, To        *time.Time // checked-in window: From <= checked_in_at < To
	Page            int
	PageSize        int
}

// ListParcels powers Search & Lookup, the Check-Out room view, the unmatched queue and the
// Dashboard's recent list.
func (s *Store) ListParcels(ctx context.Context, f ParcelFilter) (Page[Parcel], error) {
	out := Page[Parcel]{Items: []Parcel{}, Page: f.Page, PageSize: f.PageSize}

	var b queryBuilder
	if q := strings.TrimSpace(f.Query); q != "" {
		codePrefix := b.arg(escapeLike(strings.ToUpper(q)) + "%") // tracking codes are stored upper-case
		roomPrefix := b.arg(escapeLike(q) + "%")
		nameLike := b.arg("%" + escapeLike(q) + "%")
		// A room's resident-facing number is building+room concatenated ("1101"), same as the
		// autocomplete in directory.go — matching room_number alone would never find anything once
		// building codes stopped being folded into it via a "B" prefix.
		b.where(`(p.tracking_code LIKE ` + codePrefix +
			` OR r.room_number ILIKE ` + roomPrefix +
			` OR (b.code || r.room_number) ILIKE ` + roomPrefix +
			` OR EXISTS (SELECT 1 FROM residents rs WHERE rs.room_id = p.room_id AND rs.is_active AND (rs.full_name ILIKE ` + nameLike +
			` OR rs.nickname ILIKE ` + nameLike + `)))`)
	}
	if f.Status != "" {
		b.where(`p.status = ` + b.arg(f.Status) + `::text::parcel_status`)
	}
	if f.RoomID != nil {
		b.where(`p.room_id = ` + b.arg(*f.RoomID))
	}
	if f.Unmatched != nil {
		if *f.Unmatched {
			b.where(`p.room_id IS NULL`)
		} else {
			b.where(`p.room_id IS NOT NULL`)
		}
	}
	if f.UnmatchedReason != "" {
		b.where(`p.unmatched_reason = ` + b.arg(f.UnmatchedReason) + `::text::unmatched_reason`)
	}
	if f.From != nil {
		b.where(`p.checked_in_at >= ` + b.arg(*f.From))
	}
	if f.To != nil {
		b.where(`p.checked_in_at < ` + b.arg(*f.To))
	}
	where := b.whereSQL()

	if err := s.pool.QueryRow(ctx,
		`SELECT count(*) FROM parcels p LEFT JOIN rooms r ON r.id = p.room_id LEFT JOIN buildings b ON b.id = r.building_id`+where,
		b.args...).Scan(&out.Total); err != nil {
		return out, err
	}
	if out.Total == 0 {
		return out, nil
	}

	limit, offset := b.arg(f.PageSize), b.arg((f.Page-1)*f.PageSize)
	rows, err := s.pool.Query(ctx, parcelSelect+where+` ORDER BY p.checked_in_at DESC, p.id DESC LIMIT `+limit+` OFFSET `+offset, b.args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		p, err := scanParcel(rows)
		if err != nil {
			return out, err
		}
		out.Items = append(out.Items, p)
	}
	return out, rows.Err()
}
