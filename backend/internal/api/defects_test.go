package api_test

// Regression tests for defects in docs/03-test/defects.md. Each test name carries the defect ID it
// closes; each one failed on build 9344cff and passes after the fix.

import (
	"net/http"
	"strconv"
	"strings"
	"testing"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/store"
)

// DEF-002 (TC35): one Check Out Selected request hands over one room's Parcels. A request that mixes
// two rooms is refused as a whole, so room B's Parcel is never handed over by a request for room A.
func TestDEF002CheckOutRejectsTwoRooms(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	c.checkIn("ROOM-A1", e.roomB1101)
	c.checkIn("ROOM-A2", e.roomB1101)
	c.checkIn("ROOM-B1", e.roomB1102)

	wantCode(t, c.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"ROOM-A1", "ROOM-B1"}}),
		http.StatusConflict, apperr.MixedRooms)
	for _, code := range []string{"ROOM-A1", "ROOM-B1"} {
		var p store.Parcel
		c.get("/api/v1/parcels/" + code).decode(t, &p)
		if p.Status != "pending" {
			t.Errorf("%s = %s after a refused mixed-room request, want pending", code, p.Status)
		}
	}
	if n := e.queryInt(`SELECT count(*) FROM parcel_events WHERE event_type = 'checked_out'`); n != 0 {
		t.Errorf("checked_out events = %d, want 0", n)
	}

	// The same room in one request still works.
	if r := c.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"ROOM-A1", "ROOM-A2"}}); r.Status != 200 {
		t.Fatalf("same-room check-out: %d %s", r.Status, r.Body)
	}
}

// DEF-001 (TC25): the queue of Pending Parcels without a room is worked oldest first (US-06). Other
// lists stay newest first.
func TestDEF001UnmatchedQueueOldestFirst(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	for _, code := range []string{"OLDEST", "MIDDLE", "NEWEST"} {
		if r := c.post("/api/v1/parcels", map[string]any{"trackingCode": code, "unmatchedReason": "no_match"}); r.Status != 201 {
			t.Fatalf("check-in %s: %d %s", code, r.Status, r.Body)
		}
	}
	// Spread the Check-In times so the order does not depend on the id tie-break.
	e.exec(`UPDATE parcels SET checked_in_at = now() - interval '3 hours' WHERE tracking_code = 'OLDEST'`)
	e.exec(`UPDATE parcels SET checked_in_at = now() - interval '2 hours' WHERE tracking_code = 'MIDDLE'`)

	if got := codes(c.list("status=pending&unmatched=true").Items); strings.Join(got, ",") != "OLDEST,MIDDLE,NEWEST" {
		t.Errorf("unmatched queue = %v, want oldest first", got)
	}
	if got := codes(c.list("unmatched=true").Items); strings.Join(got, ",") != "NEWEST,MIDDLE,OLDEST" {
		t.Errorf("history list = %v, want newest first", got)
	}
}

// QA-08: a registration code issued before Staff revoke a room's devices, or before the room is
// vacated by a directory import, can no longer register a device afterwards.
func TestQA08OTPIssuedBeforeRevokeCannotRegister(t *testing.T) {
	e := newPushEnv(t)

	// claim opens a code for room and has Staff read it, as at the desk; it returns the claim token
	// and the code, not yet redeemed.
	claim := func(room string, roomID int64) (string, string) {
		t.Helper()
		var c map[string]any
		if r := e.anon().post("/api/v1/resident/otp", claimBody(room)); r.Status != http.StatusCreated {
			t.Fatalf("claim: %d %s", r.Status, r.Body)
		} else {
			r.decode(t, &c)
		}
		var otp store.ResidentOTPView
		e.login("op1").get("/api/v1/rooms/" + strconv.FormatInt(roomID, 10) + "/resident-otp").decode(t, &otp)
		return c["claimToken"].(string), otp.Code
	}
	verify := func(token, code, endpoint string) response {
		return e.anon().post("/api/v1/resident/otp/verify", map[string]any{
			"claimToken": token, "code": code, "subscription": e.fake.subscription(endpoint),
		})
	}

	// Staff revoke at the desk.
	token, code := claim("1101", e.roomB1101)
	staff := e.login("op1")
	if r := staff.send(http.MethodDelete, "/api/v1/rooms/"+strconv.FormatInt(e.roomB1101, 10)+"/push-subscriptions", nil); r.Status != 200 {
		t.Fatalf("revoke: %d %s", r.Status, r.Body)
	}
	wantCode(t, verify(token, code, "/sub/after-revoke"), http.StatusGone, apperr.OTPExpired)

	// Directory import that moves the room's Resident out (2101 is not in the file).
	token, code = claim("2101", e.roomB2101)
	csv := "room_number,full_name,phone\n1101,สมชาย ใจดี,0812345678\n1102,Warin Kittipong,\n"
	if r := e.login("boss").post("/api/v1/admin/residents/import", map[string]string{"csv": csv}); r.Status != 200 {
		t.Fatalf("import: %d %s", r.Status, r.Body)
	}
	wantCode(t, verify(token, code, "/sub/after-move-out"), http.StatusGone, apperr.OTPExpired)

	if n := e.queryInt(`SELECT count(*) FROM push_subscriptions WHERE unsubscribed_at IS NULL`); n != 0 {
		t.Errorf("active registrations = %d, want 0", n)
	}
	// A new code issued after the revoke still works: the room is not blocked, only the old code.
	e.register("1101", e.roomB1101, "/sub/new-after-revoke")
}
