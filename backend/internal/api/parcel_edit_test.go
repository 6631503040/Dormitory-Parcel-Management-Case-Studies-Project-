package api_test

import (
	"encoding/json"
	"testing"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/store"
)

// TestEditParcel: Staff can correct a Pending Parcel's Tracking Code, room and note after Check-In
// (US-26); every change is kept in the audit trail with its before/after value.
func TestEditParcel(t *testing.T) {
	e := newEnv(t)
	op1 := e.login("op1")
	op2 := e.login("op2")

	op1.checkIn("TYPO1", e.roomB1101)
	op1.checkIn("TAKEN1", e.roomB1101)

	// Only a directory room, a well-formed code and a bounded note are accepted.
	wantCode(t, op2.patch("/api/v1/parcels/TYPO1", map[string]any{"roomId": 424242}), 422, apperr.RoomNotInDirectory)
	wantCode(t, op2.patch("/api/v1/parcels/TYPO1", map[string]any{"roomId": 0}), 400, apperr.ValidationError)
	wantCode(t, op2.patch("/api/v1/parcels/TYPO1", map[string]any{"trackingCode": "   "}), 400, apperr.ValidationError)
	long := make([]rune, 501)
	for i := range long {
		long[i] = 'ก'
	}
	wantCode(t, op2.patch("/api/v1/parcels/TYPO1", map[string]any{"note": string(long)}), 400, apperr.ValidationError)
	wantCode(t, op2.patch("/api/v1/parcels/NOPE", map[string]any{"note": "x"}), 404, apperr.ParcelNotFound)
	// A code that already belongs to another Parcel is a duplicate, never a merge.
	wantCode(t, op2.patch("/api/v1/parcels/TYPO1", map[string]any{"trackingCode": "taken1"}), 409, apperr.DuplicateTrackingCode)

	r := op2.patch("/api/v1/parcels/typo1", map[string]any{"trackingCode": " fixed1 ", "roomId": e.roomB1102, "note": "  ชำรุด: กล่องบุบ  "})
	if r.Status != 200 {
		t.Fatalf("edit: %d %s", r.Status, r.Body)
	}
	var p store.Parcel
	r.decode(t, &p)
	if p.TrackingCode != "FIXED1" || p.Room == nil || p.Room.ID != e.roomB1102 || p.Note == nil || *p.Note != "ชำรุด: กล่องบุบ" {
		t.Errorf("after edit = %+v", p)
	}
	if p.CheckedInBy.FullName != "Operator One" {
		t.Errorf("edit must not rewrite who checked it in: %+v", p.CheckedInBy)
	}
	wantCode(t, op2.get("/api/v1/parcels/TYPO1"), 404, apperr.ParcelNotFound)

	// Clearing the note, and a no-op edit, which records nothing.
	if r := op2.patch("/api/v1/parcels/FIXED1", map[string]any{"note": ""}); r.Status != 200 {
		t.Fatalf("clear note: %d %s", r.Status, r.Body)
	}
	if r := op2.patch("/api/v1/parcels/FIXED1", map[string]any{"roomId": e.roomB1102}); r.Status != 200 {
		t.Fatalf("no-op edit: %d %s", r.Status, r.Body)
	}

	var detail store.ParcelDetail
	op2.get("/api/v1/parcels/FIXED1").decode(t, &detail)
	if detail.Note != nil {
		t.Errorf("note not cleared: %q", *detail.Note)
	}
	if len(detail.Events) != 3 || detail.Events[0].EventType != "checked_in" || detail.Events[1].EventType != "edited" || detail.Events[2].EventType != "edited" {
		t.Fatalf("events = %+v", detail.Events)
	}
	if detail.Events[1].Staff.FullName != "Operator Two" {
		t.Errorf("edit actor = %+v", detail.Events[1].Staff)
	}
	var first struct {
		Changes struct {
			TrackingCode struct{ From, To string } `json:"trackingCode"`
			Room         struct {
				From struct{ Label string } `json:"from"`
				To   struct{ Label string } `json:"to"`
			} `json:"room"`
			Note struct{ From, To *string } `json:"note"`
		} `json:"changes"`
	}
	if err := json.Unmarshal(detail.Events[1].Detail, &first); err != nil {
		t.Fatal(err)
	}
	ch := first.Changes
	if ch.TrackingCode.From != "TYPO1" || ch.TrackingCode.To != "FIXED1" || ch.Room.From.Label != "1101" || ch.Room.To.Label != "1102" ||
		ch.Note.From != nil || ch.Note.To == nil || *ch.Note.To != "ชำรุด: กล่องบุบ" {
		t.Errorf("edit detail = %s", detail.Events[1].Detail)
	}

	// The Parcel now shows up under its new room only.
	if got := op2.list("q=1102"); got.Total != 1 || got.Items[0].TrackingCode != "FIXED1" {
		t.Errorf("new room search = %+v", got)
	}

	// Picked Up Parcels are handover evidence: no edits.
	if r := op2.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"FIXED1"}}); r.Status != 200 {
		t.Fatalf("check-out: %d %s", r.Status, r.Body)
	}
	wantCode(t, op2.patch("/api/v1/parcels/FIXED1", map[string]any{"note": "late"}), 409, apperr.ParcelNotPending)

	// Unmatched Parcels are resolved through Assign Room, not edit.
	if r := op1.post("/api/v1/parcels", map[string]any{"trackingCode": "NOROOM2", "unmatchedReason": "other"}); r.Status != 201 {
		t.Fatalf("unmatched check-in: %d %s", r.Status, r.Body)
	}
	wantCode(t, op1.patch("/api/v1/parcels/NOROOM2", map[string]any{"roomId": e.roomB1101}), 409, apperr.ParcelNotPending)
}

// TestEditParcelRoomDropsRecipientFromOldRoom: a recipient chosen at Check-In lives in the old room,
// so moving the Parcel must not keep pointing at them.
func TestEditParcelRoomDropsRecipientFromOldRoom(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	r := c.post("/api/v1/parcels", map[string]any{"trackingCode": "WHO1", "roomId": e.roomB1101, "residentId": e.residentB1101})
	if r.Status != 201 {
		t.Fatalf("check-in: %d %s", r.Status, r.Body)
	}
	if r := c.patch("/api/v1/parcels/WHO1", map[string]any{"note": "kept"}); r.Status != 200 {
		t.Fatalf("note edit: %d %s", r.Status, r.Body)
	}
	if got := e.queryInt(`SELECT count(*) FROM parcels WHERE tracking_code = 'WHO1' AND resident_id IS NOT NULL`); got != 1 {
		t.Errorf("recipient dropped by a note-only edit")
	}
	if r := c.patch("/api/v1/parcels/WHO1", map[string]any{"roomId": e.roomB2101}); r.Status != 200 {
		t.Fatalf("room edit: %d %s", r.Status, r.Body)
	}
	if got := e.queryInt(`SELECT count(*) FROM parcels WHERE tracking_code = 'WHO1' AND resident_id IS NULL`); got != 1 {
		t.Errorf("recipient from the old room still attached")
	}
}
