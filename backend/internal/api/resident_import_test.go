package api_test

import (
	"strings"
	"testing"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/store"
)

// Fixture directory: 1101 สมชาย ใจดี (0812345678), 1102 Warin Kittipong, 2101 ณัฐพล สุขใจ.
const importCSV = store.UTF8BOM + "room_number,full_name,phone\n" +
	"1101,สมชาย ใจดี,081-234-5678\n" + // unchanged (phone formatting ignored)
	"1101,Warin  Kittipong,\n" + // moved from 1102; extra space ignored
	"1103,New Person,899999999\n" + // added, in a room that doesn't exist yet; Excel dropped the phone's leading 0
	"10205,Tenth Building,\n" // building 10, room 205: both created
// ณัฐพล สุขใจ is missing: moved out.

func TestResidentImportPreviewThenApply(t *testing.T) {
	e := newEnv(t)
	boss := e.login("boss")
	nattapon := e.queryInt(`SELECT id FROM residents WHERE full_name = 'ณัฐพล สุขใจ'`)
	if r := boss.post("/api/v1/parcels", map[string]any{"trackingCode": "MOVEOUT1", "roomId": e.roomB2101, "residentId": nattapon}); r.Status != 201 {
		t.Fatalf("check-in: %d %s", r.Status, r.Body)
	}

	r := boss.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": importCSV})
	if r.Status != 200 {
		t.Fatalf("preview: %d %s", r.Status, r.Body)
	}
	var pre store.ImportSummary
	r.decode(t, &pre)
	if pre.Rows != 4 || pre.Unchanged != 1 || pre.MovedCount != 1 || pre.AddedCount != 2 || pre.MovedOutCount != 1 || pre.NewRoomCount != 2 || pre.ErrorCount != 0 {
		t.Fatalf("preview summary = %+v", pre)
	}
	if m := pre.Moved[0]; m.FullName != "Warin Kittipong" || m.FromRoomNumber != "1102" || m.RoomNumber != "1101" {
		t.Errorf("moved = %+v", m)
	}
	if o := pre.MovedOut[0]; o.FullName != "ณัฐพล สุขใจ" || o.RoomNumber != "2101" || o.PendingParcels != 1 {
		t.Errorf("moved out = %+v (want the pending Parcel flagged)", o)
	}
	if strings.Contains(string(r.Body), "0899999999") {
		t.Errorf("preview echoes phone numbers: %s", r.Body)
	}
	// Preview writes nothing.
	if n := e.queryInt(`SELECT count(*) FROM residents WHERE NOT is_active`); n != 0 {
		t.Fatalf("preview changed the directory")
	}

	r = boss.post("/api/v1/admin/residents/import", map[string]string{"csv": importCSV})
	if r.Status != 200 {
		t.Fatalf("apply: %d %s", r.Status, r.Body)
	}

	if got := e.queryInt(`SELECT room_id FROM residents WHERE full_name = 'Warin Kittipong'`); got != e.roomB1101 {
		t.Errorf("Warin room = %d, want %d", got, e.roomB1101)
	}
	if n := e.queryInt(`SELECT count(*) FROM residents WHERE id = $1 AND NOT is_active`, nattapon); n != 1 {
		t.Errorf("moved-out resident still active (or deleted)")
	}
	if n := e.queryInt(`SELECT count(*) FROM residents rs JOIN rooms r ON r.id = rs.room_id JOIN buildings b ON b.id = r.building_id
		WHERE rs.full_name = 'Tenth Building' AND b.code = '10' AND r.room_number = '205' AND rs.is_active`); n != 1 {
		t.Errorf("building 10 room 205 resident not created")
	}
	if n := e.queryInt(`SELECT count(*) FROM residents WHERE full_name = 'New Person' AND phone = '0899999999'`); n != 1 {
		t.Errorf("new resident not created with phone")
	}
	// The pending Parcel still points at the deactivated Resident: history is intact.
	if n := e.queryInt(`SELECT count(*) FROM parcels WHERE tracking_code = 'MOVEOUT1' AND resident_id = $1`, nattapon); n != 1 {
		t.Errorf("parcel lost its resident")
	}
	bossID := e.queryInt(`SELECT id FROM staff WHERE username = 'boss'`)
	if n := e.queryInt(`SELECT count(*) FROM resident_imports WHERE staff_id = $1 AND added = 2 AND moved = 1 AND moved_out = 1 AND rooms_created = 2`, bossID); n != 1 {
		t.Errorf("import not recorded in resident_imports")
	}

	// Uploading the same file again changes nothing.
	r = boss.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": importCSV})
	var again store.ImportSummary
	r.decode(t, &again)
	if again.Unchanged != 4 || again.AddedCount+again.MovedCount+again.MovedOutCount+again.NewRoomCount != 0 {
		t.Errorf("re-import summary = %+v, want all unchanged", again)
	}
}

// Push registrations belong to a room, so every room someone leaves loses them: the leaver's phone
// must not keep seeing the next occupant's Parcels.
func TestResidentImportRevokesPushInVacatedRooms(t *testing.T) {
	e := newPushEnv(t)
	stay := e.register("1101", e.roomB1101, "/sub/stay")
	movedFrom := e.register("1102", e.roomB1102, "/sub/moved")
	movedOut := e.register("2101", e.roomB2101, "/sub/out")

	// Warin moves 1102 → 1101; ณัฐพล (2101) moves out; สมชาย stays in 1101.
	csv := "room_number,full_name,phone\n1101,สมชาย ใจดี,0812345678\n1101,Warin Kittipong,\n"
	boss := e.login("boss")
	var pre store.ImportSummary
	boss.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": csv}).decode(t, &pre)
	if pre.PushDevicesRevoked != 2 {
		t.Fatalf("preview pushDevicesRevoked = %d, want 2", pre.PushDevicesRevoked)
	}
	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions WHERE unsubscribed_at IS NOT NULL`); n != 0 {
		t.Fatalf("preview revoked subscriptions")
	}

	e.login("op1").checkIn("TH-QUEUED", e.roomB2101) // queued for the leaver's phone
	if r := boss.post("/api/v1/admin/residents/import", map[string]string{"csv": csv}); r.Status != 200 {
		t.Fatalf("apply: %d %s", r.Status, r.Body)
	}

	for _, tok := range []string{movedFrom, movedOut} {
		wantCode(t, e.bearer("GET", "/api/v1/resident/me", tok, nil), 401, apperr.Unauthenticated)
	}
	if r := e.bearer("GET", "/api/v1/resident/me", stay, nil); r.Status != 200 {
		t.Errorf("device in an unvacated room was revoked: %d", r.Status)
	}
	bossID := e.queryInt(`SELECT id FROM staff WHERE username = 'boss'`)
	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions WHERE unsubscribed_reason = 'staff' AND unsubscribed_by_staff_id = $1`, bossID); n != 2 {
		t.Errorf("revocations attributed to the importing Admin = %d, want 2", n)
	}
	if n := e.runWorker(); n != 0 || len(e.fake.messages()) != 0 {
		t.Errorf("queued notification for a vacated room was still sent")
	}
}

func TestResidentImportRejectsBadFile(t *testing.T) {
	e := newEnv(t)
	boss := e.login("boss")

	bad := "room_number,full_name,phone\n" +
		"1101,สมชาย ใจดี,\n" +
		"11,Short Room,\n" + // line 3: room_number
		"1102,,\n" + // line 4: full_name
		"1102,Warin Kittipong,abc\n" + // line 5: phone
		"1101,สมชาย ใจดี,\n" // line 6: duplicate
	r := boss.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": bad})
	var sum store.ImportSummary
	r.decode(t, &sum)
	want := []store.ImportIssue{{Line: 3, Field: "room_number", Reason: "invalid_format"}, {Line: 4, Field: "full_name", Reason: "required"},
		{Line: 5, Field: "phone", Reason: "invalid_format"}, {Line: 6, Field: "row", Reason: "duplicate"}}
	if sum.ErrorCount != len(want) {
		t.Fatalf("errors = %+v", sum.Errors)
	}
	for i, w := range want {
		if sum.Errors[i] != w {
			t.Errorf("error %d = %+v, want %+v", i, sum.Errors[i], w)
		}
	}

	// A file with errors is never applied, not even partly.
	wantCode(t, boss.post("/api/v1/admin/residents/import", map[string]string{"csv": bad}), 422, apperr.ResidentImportInvalid)
	if n := e.queryInt(`SELECT count(*) FROM residents WHERE NOT is_active`); n != 0 {
		t.Errorf("rejected file deactivated residents")
	}

	r = boss.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": "room,name\n1101,x\n"})
	r.decode(t, &sum)
	if sum.ErrorCount != 1 || sum.Errors[0].Reason != "invalid_header" {
		t.Errorf("bad header = %+v", sum.Errors)
	}
	r = boss.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": ""})
	r.decode(t, &sum)
	if sum.ErrorCount != 1 || sum.Errors[0].Reason != "empty" {
		t.Errorf("empty file = %+v", sum.Errors)
	}
}

func TestResidentExportRoundTrips(t *testing.T) {
	e := newEnv(t)
	boss := e.login("boss")
	r := boss.get("/api/v1/admin/residents/export")
	if r.Status != 200 {
		t.Fatalf("export: %d %s", r.Status, r.Body)
	}
	body := string(r.Body)
	if !strings.HasPrefix(body, store.UTF8BOM+"room_number,full_name,phone\n") || !strings.Contains(body, "1101,สมชาย ใจดี,0812345678\n") {
		t.Errorf("export = %q", body)
	}
	// Uploading the export back is a no-op.
	pr := boss.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": body})
	var sum store.ImportSummary
	pr.decode(t, &sum)
	if sum.Unchanged != 3 || sum.AddedCount+sum.MovedCount+sum.MovedOutCount+sum.ErrorCount != 0 {
		t.Errorf("round trip = %+v", sum)
	}
}

func TestOnlyAdminManagesResidents(t *testing.T) {
	e := newEnv(t)
	op := e.login("op1")
	wantCode(t, op.get("/api/v1/admin/residents/export"), 403, apperr.Forbidden)
	wantCode(t, op.post("/api/v1/admin/residents/import/preview", map[string]string{"csv": importCSV}), 403, apperr.Forbidden)
	wantCode(t, op.post("/api/v1/admin/residents/import", map[string]string{"csv": importCSV}), 403, apperr.Forbidden)
	if n := e.queryInt(`SELECT count(*) FROM residents WHERE NOT is_active`); n != 0 {
		t.Errorf("operator changed the directory")
	}
}
