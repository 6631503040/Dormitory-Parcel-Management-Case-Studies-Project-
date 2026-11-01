package store

import (
	"context"
	"encoding/csv"
	"errors"
	"io"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"dpms/backend/internal/apperr"
)

// Resident directory import (US-29). The CSV is the full list of current Residents:
//
//	room_number,full_name,phone
//	1101,วิภาวี อินทร์แก้ว,
//	1102,สมชาย เพชรรัตน์,0812345678
//
// room_number is building code + 3-digit room number ("1101" = building 1, room 101; "10205" =
// building 10, room 205). Residents are matched by full name: same name in the same room is
// unchanged, same name in another room is a move, an unknown name is added, and an active Resident
// missing from the file has moved out (deactivated, never deleted).

var ResidentCSVHeader = []string{"room_number", "full_name", "phone"}

// UTF8BOM marks a file as UTF-8 for Excel, which otherwise reads Thai text in the system code page.
const UTF8BOM = "\xef\xbb\xbf"

const maxImportListItems = 100 // per list in the summary; counts are always exact

var (
	roomNumberPattern = regexp.MustCompile(`^[0-9]{4,6}$`)
	phonePattern      = regexp.MustCompile(`^\+?[0-9]{9,15}$`)
	// A Thai number (mobile 0X-XXXX-XXXX, landline 0X-XXX-XXXX) that lost its leading 0 in Excel.
	excelStrippedPhone = regexp.MustCompile(`^[1-9][0-9]{7,8}$`)
)

type ImportRow struct {
	Line     int
	Building string
	Room     string
	FullName string
	Phone    string // "" = none
}

func (r ImportRow) key() string { return r.Building + r.Room }

type ImportIssue struct {
	Line   int    `json:"line"`
	Field  string `json:"field"`
	Reason string `json:"reason"`
}

type ResidentChange struct {
	FullName       string `json:"fullName"`
	RoomNumber     string `json:"roomNumber"`
	FromRoomNumber string `json:"fromRoomNumber,omitempty"`
	PendingParcels int    `json:"pendingParcels,omitempty"`
}

type ImportSummary struct {
	Rows          int              `json:"rows"`
	Unchanged     int              `json:"unchanged"`
	AddedCount    int              `json:"addedCount"`
	MovedCount    int              `json:"movedCount"`
	MovedOutCount int              `json:"movedOutCount"`
	NewRoomCount  int              `json:"newRoomCount"`
	ErrorCount    int              `json:"errorCount"`
	Added         []ResidentChange `json:"added"`
	Moved         []ResidentChange `json:"moved"`
	MovedOut      []ResidentChange `json:"movedOut"`
	NewRooms      []string         `json:"newRooms"`
	Errors        []ImportIssue    `json:"errors"`
}

func normalizeName(s string) string { return strings.Join(strings.Fields(s), " ") }

// ParseResidentCSV reads the upload. Every problem is reported with its line number rather than
// stopping at the first, so the Admin can fix the whole file in one pass.
func ParseResidentCSV(data string) ([]ImportRow, []ImportIssue) {
	if !utf8.ValidString(data) {
		return nil, []ImportIssue{{Line: 0, Field: "file", Reason: "not_utf8"}}
	}
	data = strings.TrimPrefix(data, UTF8BOM) // Excel's "CSV UTF-8" starts with one

	r := csv.NewReader(strings.NewReader(data))
	r.FieldsPerRecord = -1
	r.LazyQuotes = true
	r.TrimLeadingSpace = true

	var rows []ImportRow
	var issues []ImportIssue
	seen := map[string]int{}
	header := true
	for {
		rec, err := r.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		line, _ := r.FieldPos(0)
		if err != nil {
			issues = append(issues, ImportIssue{Line: line, Field: "row", Reason: "unreadable"})
			continue
		}
		if len(rec) == 1 && strings.TrimSpace(rec[0]) == "" {
			continue // blank line
		}
		if header {
			header = false
			if !isResidentHeader(rec) {
				return nil, []ImportIssue{{Line: line, Field: "header", Reason: "invalid_header"}}
			}
			continue
		}
		if len(rec) == 2 {
			rec = append(rec, "") // trailing phone column left off entirely
		}
		if len(rec) != len(ResidentCSVHeader) {
			issues = append(issues, ImportIssue{Line: line, Field: "row", Reason: "wrong_column_count"})
			continue
		}

		room := strings.TrimSpace(rec[0])
		name := normalizeName(rec[1])
		phone := strings.NewReplacer(" ", "", "-", "").Replace(strings.TrimSpace(rec[2]))
		if excelStrippedPhone.MatchString(phone) {
			phone = "0" + phone // Excel reads 0812345678 as a number and drops the leading 0
		}
		switch {
		case !roomNumberPattern.MatchString(room):
			issues = append(issues, ImportIssue{Line: line, Field: "room_number", Reason: "invalid_format"})
			continue
		case name == "":
			issues = append(issues, ImportIssue{Line: line, Field: "full_name", Reason: "required"})
			continue
		case utf8.RuneCountInString(name) > maxFullNameLen:
			issues = append(issues, ImportIssue{Line: line, Field: "full_name", Reason: "too_long"})
			continue
		case phone != "" && !phonePattern.MatchString(phone):
			issues = append(issues, ImportIssue{Line: line, Field: "phone", Reason: "invalid_format"})
			continue
		}
		row := ImportRow{Line: line, Building: room[:len(room)-3], Room: room[len(room)-3:], FullName: name, Phone: phone}
		dup := row.key() + "\x00" + name
		if _, ok := seen[dup]; ok {
			issues = append(issues, ImportIssue{Line: line, Field: "row", Reason: "duplicate"})
			continue
		}
		seen[dup] = line
		rows = append(rows, row)
	}
	if header {
		return nil, []ImportIssue{{Line: 0, Field: "file", Reason: "empty"}}
	}
	if len(rows) == 0 && len(issues) == 0 {
		issues = append(issues, ImportIssue{Line: 0, Field: "file", Reason: "no_rows"})
	}
	return rows, issues
}

func isResidentHeader(rec []string) bool {
	if len(rec) != len(ResidentCSVHeader) && len(rec) != len(ResidentCSVHeader)-1 {
		return false
	}
	for i, col := range rec {
		if strings.ReplaceAll(strings.ToLower(strings.TrimSpace(col)), " ", "_") != ResidentCSVHeader[i] {
			return false
		}
	}
	return true
}

type activeResident struct {
	id       int64
	name     string
	phone    *string
	roomKey  string
	pending  int
	consumed bool
}

type residentMove struct {
	id       int64
	roomKey  string
	phone    *string
	phoneSet bool
}

type importPlan struct {
	summary      ImportSummary
	newBuildings []string
	newRooms     []ImportRow // Building + Room of each room to create
	inserts      []ImportRow
	moves        []residentMove // also carries phone-only updates (roomKey == "")
	moveOuts     []int64
}

func phonePtr(p string) *string {
	if p == "" {
		return nil
	}
	return &p
}

func samePhone(a *string, b string) bool {
	if a == nil {
		return b == ""
	}
	return *a == b
}

// planImport works out every change against the current directory without writing anything.
func planImport(ctx context.Context, q querier, rows []ImportRow, issues []ImportIssue) (*importPlan, error) {
	p := &importPlan{}
	sum := &p.summary
	sum.Rows = len(rows) + len(issues)
	sum.Added, sum.Moved, sum.MovedOut, sum.NewRooms = []ResidentChange{}, []ResidentChange{}, []ResidentChange{}, []string{}
	sum.ErrorCount = len(issues)
	sum.Errors = issues
	if len(sum.Errors) > maxImportListItems {
		sum.Errors = sum.Errors[:maxImportListItems]
	}
	if sum.Errors == nil {
		sum.Errors = []ImportIssue{}
	}

	buildings := map[string]bool{}
	brows, err := q.Query(ctx, `SELECT code FROM buildings`)
	if err != nil {
		return nil, err
	}
	for brows.Next() {
		var code string
		if err := brows.Scan(&code); err != nil {
			brows.Close()
			return nil, err
		}
		buildings[code] = true
	}
	brows.Close()

	rooms := map[string]bool{}
	rrows, err := q.Query(ctx, `SELECT b.code || r.room_number FROM rooms r JOIN buildings b ON b.id = r.building_id`)
	if err != nil {
		return nil, err
	}
	for rrows.Next() {
		var key string
		if err := rrows.Scan(&key); err != nil {
			rrows.Close()
			return nil, err
		}
		rooms[key] = true
	}
	rrows.Close()

	var active []*activeResident
	byRoomName := map[string][]*activeResident{}
	byName := map[string][]*activeResident{}
	arows, err := q.Query(ctx, `
		SELECT rs.id, rs.full_name, rs.phone, b.code || r.room_number,
		       (SELECT count(*) FROM parcels p WHERE p.resident_id = rs.id AND p.status = 'pending')
		FROM residents rs JOIN rooms r ON r.id = rs.room_id JOIN buildings b ON b.id = r.building_id
		WHERE rs.is_active ORDER BY rs.id`)
	if err != nil {
		return nil, err
	}
	for arows.Next() {
		a := &activeResident{}
		if err := arows.Scan(&a.id, &a.name, &a.phone, &a.roomKey, &a.pending); err != nil {
			arows.Close()
			return nil, err
		}
		a.name = normalizeName(a.name)
		active = append(active, a)
		byRoomName[a.roomKey+"\x00"+a.name] = append(byRoomName[a.roomKey+"\x00"+a.name], a)
		byName[a.name] = append(byName[a.name], a)
	}
	arows.Close()
	if err := arows.Err(); err != nil {
		return nil, err
	}

	pick := func(list []*activeResident) *activeResident {
		for _, a := range list {
			if !a.consumed {
				return a
			}
		}
		return nil
	}

	// Pass 1: same name, same room — unchanged (phone may still be updated).
	var rest []ImportRow
	for _, row := range rows {
		if a := pick(byRoomName[row.key()+"\x00"+row.FullName]); a != nil {
			a.consumed = true
			sum.Unchanged++
			if !samePhone(a.phone, row.Phone) {
				p.moves = append(p.moves, residentMove{id: a.id, phone: phonePtr(row.Phone), phoneSet: true})
			}
			continue
		}
		rest = append(rest, row)
	}

	// Pass 2: same name in exactly one other room — a move. Anything else is a new Resident.
	addList := func(list *[]ResidentChange, c ResidentChange) {
		if len(*list) < maxImportListItems {
			*list = append(*list, c)
		}
	}
	for _, row := range rest {
		var candidates []*activeResident
		for _, a := range byName[row.FullName] {
			if !a.consumed {
				candidates = append(candidates, a)
			}
		}
		if len(candidates) == 1 {
			a := candidates[0]
			a.consumed = true
			sum.MovedCount++
			addList(&sum.Moved, ResidentChange{FullName: row.FullName, RoomNumber: row.key(), FromRoomNumber: a.roomKey, PendingParcels: a.pending})
			p.moves = append(p.moves, residentMove{id: a.id, roomKey: row.key(), phone: phonePtr(row.Phone), phoneSet: !samePhone(a.phone, row.Phone)})
		} else {
			sum.AddedCount++
			addList(&sum.Added, ResidentChange{FullName: row.FullName, RoomNumber: row.key()})
			p.inserts = append(p.inserts, row)
		}
		if !rooms[row.key()] {
			rooms[row.key()] = true
			sum.NewRoomCount++
			if len(sum.NewRooms) < maxImportListItems {
				sum.NewRooms = append(sum.NewRooms, row.key())
			}
			p.newRooms = append(p.newRooms, row)
			if !buildings[row.Building] {
				buildings[row.Building] = true
				p.newBuildings = append(p.newBuildings, row.Building)
			}
		}
	}

	for _, a := range active {
		if !a.consumed {
			sum.MovedOutCount++
			addList(&sum.MovedOut, ResidentChange{FullName: a.name, RoomNumber: a.roomKey, PendingParcels: a.pending})
			p.moveOuts = append(p.moveOuts, a.id)
		}
	}
	return p, nil
}

// PreviewResidentImport reports what an import would change, without changing anything.
func (s *Store) PreviewResidentImport(ctx context.Context, data string) (*ImportSummary, error) {
	rows, issues := ParseResidentCSV(data)
	p, err := planImport(ctx, s.pool, rows, issues)
	if err != nil {
		return nil, err
	}
	return &p.summary, nil
}

// ApplyResidentImport recomputes the plan inside one transaction and applies it, all or nothing.
// A file with any error is refused outright (RESIDENT_IMPORT_INVALID) — a half-applied directory
// would deactivate the Residents on the rejected lines.
func (s *Store) ApplyResidentImport(ctx context.Context, staffID int64, data string) (*ImportSummary, error) {
	rows, issues := ParseResidentCSV(data)
	if len(issues) > 0 {
		return nil, apperr.New(apperr.ResidentImportInvalid, map[string]any{"errorCount": len(issues)})
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Readers (Check-In, search) carry on; a second import waits for this one to finish.
	if _, err := tx.Exec(ctx, `LOCK TABLE residents IN EXCLUSIVE MODE`); err != nil {
		return nil, err
	}
	p, err := planImport(ctx, tx, rows, nil)
	if err != nil {
		return nil, err
	}

	for _, code := range p.newBuildings {
		if _, err := tx.Exec(ctx, `INSERT INTO buildings (code, name) VALUES ($1, 'Building ' || $1)`, code); err != nil {
			return nil, err
		}
	}
	for _, r := range p.newRooms {
		if _, err := tx.Exec(ctx,
			`INSERT INTO rooms (building_id, room_number) SELECT id, $2 FROM buildings WHERE code = $1`, r.Building, r.Room); err != nil {
			return nil, err
		}
	}

	const roomIDByKey = `(SELECT r.id FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE b.code || r.room_number = $1)`
	batch := &pgx.Batch{}
	for _, r := range p.inserts {
		batch.Queue(`INSERT INTO residents (room_id, full_name, phone) VALUES `+"("+roomIDByKey+", $2, $3)", r.key(), r.FullName, phonePtr(r.Phone))
	}
	for _, m := range p.moves {
		switch {
		case m.roomKey != "" && m.phoneSet:
			batch.Queue(`UPDATE residents SET room_id = `+roomIDByKey+`, phone = $3, updated_at = now() WHERE id = $2`, m.roomKey, m.id, m.phone)
		case m.roomKey != "":
			batch.Queue(`UPDATE residents SET room_id = `+roomIDByKey+`, updated_at = now() WHERE id = $2`, m.roomKey, m.id)
		default:
			batch.Queue(`UPDATE residents SET phone = $2, updated_at = now() WHERE id = $1`, m.id, m.phone)
		}
	}
	if len(p.moveOuts) > 0 {
		batch.Queue(`UPDATE residents SET is_active = false, updated_at = now() WHERE id = ANY($1)`, p.moveOuts)
	}
	sum := p.summary
	batch.Queue(`INSERT INTO resident_imports (staff_id, row_count, added, moved, moved_out, rooms_created) VALUES ($1, $2, $3, $4, $5, $6)`,
		staffID, sum.Rows, sum.AddedCount, sum.MovedCount, sum.MovedOutCount, sum.NewRoomCount)
	if err := tx.SendBatch(ctx, batch).Close(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &sum, nil
}

// ExportResidents writes the active directory in the import format, so an Admin can edit the
// current list in a spreadsheet and upload it back.
func (s *Store) ExportResidents(ctx context.Context, w io.Writer) error {
	rows, err := s.pool.Query(ctx, `
		SELECT b.code || r.room_number, rs.full_name, coalesce(rs.phone, '')
		FROM residents rs JOIN rooms r ON r.id = rs.room_id JOIN buildings b ON b.id = r.building_id
		WHERE rs.is_active
		ORDER BY length(b.code), b.code, r.room_number, rs.full_name`)
	if err != nil {
		return err
	}
	defer rows.Close()
	cw := csv.NewWriter(w)
	if err := cw.Write(ResidentCSVHeader); err != nil {
		return err
	}
	for rows.Next() {
		rec := make([]string, 3)
		if err := rows.Scan(&rec[0], &rec[1], &rec[2]); err != nil {
			return err
		}
		if err := cw.Write(rec); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	cw.Flush()
	return cw.Error()
}
