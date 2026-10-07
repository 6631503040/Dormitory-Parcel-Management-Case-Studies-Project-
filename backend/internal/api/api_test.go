package api_test

// Integration tests against a real PostgreSQL. Set TEST_DATABASE_URL (e.g. the docker-compose db,
// see docker/README) to run them; without it they are skipped. Every test gets its own schema, so
// tests never see each other's rows and never touch real data.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
	_ "time/tzdata"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"dpms/backend/internal/api"
	"dpms/backend/internal/apperr"
	"dpms/backend/internal/auth"
	"dpms/backend/internal/db"
	"dpms/backend/internal/store"
)

const testPassword = "correct-horse-battery"

type env struct {
	t    *testing.T
	pool *pgxpool.Pool
	srv  *httptest.Server
	loc  *time.Location

	roomB1101, roomB1102, roomB2101 int64 // directory rooms
	residentB1101                   int64
}

func newEnv(t *testing.T) *env { return newEnvWithDeps(t, nil) }

// newEnvWithDeps is newEnv with a chance to override api.Deps fields (e.g. LINE settings) before
// the router is built — used by the LINE tests, which need a channel secret and a fake reply
// endpoint that plain feature tests have no reason to carry.
func newEnvWithDeps(t *testing.T, mutate func(*api.Deps)) *env {
	t.Helper()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping database integration tests")
	}
	gin.SetMode(gin.TestMode)
	ctx := context.Background()

	admin, err := pgxpool.New(ctx, base)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	schema := fmt.Sprintf("test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}

	u, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema+",public") // public keeps pg_trgm's operator classes visible
	u.RawQuery = q.Encode()

	pool, err := db.Connect(ctx, u.String(), 20)
	if err != nil {
		t.Fatalf("connect (schema): %v", err)
	}
	if err := db.Migrate(ctx, pool, "../../../db/migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	loc, _ := time.LoadLocation("Asia/Bangkok")
	e := &env{t: t, pool: pool, loc: loc}
	e.seedFixture()

	deps := api.Deps{
		Store:    store.New(pool),
		Signer:   auth.NewSigner([]byte(strings.Repeat("s", 32)), time.Hour),
		Location: loc,
		Ping:     pool.Ping,
	}
	if mutate != nil {
		mutate(&deps)
	}
	e.srv = httptest.NewServer(api.NewRouter(deps))

	t.Cleanup(func() {
		e.srv.Close()
		pool.Close()
		_, _ = admin.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`)
		admin.Close()
	})
	return e
}

func (e *env) exec(sql string, args ...any) {
	e.t.Helper()
	if _, err := e.pool.Exec(context.Background(), sql, args...); err != nil {
		e.t.Fatalf("exec %q: %v", sql, err)
	}
}

func (e *env) queryInt(sql string, args ...any) int64 {
	e.t.Helper()
	var n int64
	if err := e.pool.QueryRow(context.Background(), sql, args...).Scan(&n); err != nil {
		e.t.Fatalf("query %q: %v", sql, err)
	}
	return n
}

// seedFixture: two buildings, three rooms, residents that share the nickname "แนน" across rooms,
// and Staff accounts (two operators, one admin, one disabled account).
func (e *env) seedFixture() {
	hash, err := auth.HashPasswordCost(testPassword, 4) // min cost: keeps tests fast
	if err != nil {
		e.t.Fatal(err)
	}
	e.exec(`INSERT INTO staff (username, password_hash, full_name, role, is_active) VALUES
		('op1', $1, 'Operator One', 'operator', true),
		('op2', $1, 'Operator Two', 'operator', true),
		('boss', $1, 'Admin Boss', 'admin', true),
		('gone', $1, 'Former Staff', 'operator', false)`, hash)

	e.exec(`INSERT INTO buildings (code, name) VALUES ('1', 'Building 1'), ('2', 'Building 2')`)
	b1 := e.queryInt(`SELECT id FROM buildings WHERE code = '1'`)
	b2 := e.queryInt(`SELECT id FROM buildings WHERE code = '2'`)
	e.exec(`INSERT INTO rooms (building_id, room_number) VALUES ($1, '101'), ($1, '102'), ($2, '101')`, b1, b2)
	e.roomB1101 = e.queryInt(`SELECT id FROM rooms WHERE building_id = $1 AND room_number = '101'`, b1)
	e.roomB1102 = e.queryInt(`SELECT id FROM rooms WHERE building_id = $1 AND room_number = '102'`, b1)
	e.roomB2101 = e.queryInt(`SELECT id FROM rooms WHERE building_id = $1 AND room_number = '101'`, b2)

	e.exec(`INSERT INTO residents (room_id, full_name, nickname, phone) VALUES
		($1, 'สมชาย ใจดี', 'แนน', '0812345678'),
		($2, 'Warin Kittipong', 'แนน', NULL),
		($3, 'ณัฐพล สุขใจ', NULL, NULL)`, e.roomB1101, e.roomB1102, e.roomB2101)
	e.residentB1101 = e.queryInt(`SELECT id FROM residents WHERE full_name = 'สมชาย ใจดี'`)
}

// --- HTTP helpers ------------------------------------------------------------------------------

type client struct {
	t    *testing.T
	http *http.Client
	base string
}

type response struct {
	Status int
	Body   []byte
}

func (r response) decode(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.Body, v); err != nil {
		t.Fatalf("decode %q: %v", r.Body, err)
	}
}

func (r response) errCode(t *testing.T) apperr.Error {
	t.Helper()
	var e apperr.Error
	r.decode(t, &e)
	return e
}

func (e *env) anon() *client {
	jar, _ := cookiejar.New(nil)
	return &client{t: e.t, http: &http.Client{Jar: jar}, base: e.srv.URL}
}

func (e *env) login(username string) *client {
	e.t.Helper()
	c := e.anon()
	if r := c.post("/api/v1/auth/login", map[string]string{"username": username, "password": testPassword}); r.Status != 200 {
		e.t.Fatalf("login %s: %d %s", username, r.Status, r.Body)
	}
	return c
}

func (c *client) do(method, path, contentType string, body io.Reader) response {
	c.t.Helper()
	req, err := http.NewRequest(method, c.base+path, body)
	if err != nil {
		c.t.Fatal(err)
	}
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		c.t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return response{Status: resp.StatusCode, Body: b}
}

func (c *client) get(path string) response { return c.do(http.MethodGet, path, "", nil) }

func (c *client) send(method, path string, body any) response {
	c.t.Helper()
	var buf io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			c.t.Fatal(err)
		}
		buf = bytes.NewReader(b)
	}
	return c.do(method, path, "application/json", buf)
}

func (c *client) post(path string, body any) response  { return c.send(http.MethodPost, path, body) }
func (c *client) patch(path string, body any) response { return c.send(http.MethodPatch, path, body) }

func (c *client) checkIn(code string, roomID int64) store.Parcel {
	c.t.Helper()
	r := c.post("/api/v1/parcels", map[string]any{"trackingCode": code, "roomId": roomID})
	if r.Status != http.StatusCreated {
		c.t.Fatalf("check-in %s: %d %s", code, r.Status, r.Body)
	}
	var p store.Parcel
	r.decode(c.t, &p)
	return p
}

func (c *client) list(query string) store.Page[store.Parcel] {
	c.t.Helper()
	r := c.get("/api/v1/parcels?" + query)
	if r.Status != 200 {
		c.t.Fatalf("list %s: %d %s", query, r.Status, r.Body)
	}
	var p store.Page[store.Parcel]
	r.decode(c.t, &p)
	return p
}

func codes(ps []store.Parcel) []string {
	out := make([]string, len(ps))
	for i, p := range ps {
		out[i] = p.TrackingCode
	}
	return out
}

func wantCode(t *testing.T, r response, status int, code string) apperr.Error {
	t.Helper()
	if r.Status != status {
		t.Fatalf("status = %d, want %d (body %s)", r.Status, status, r.Body)
	}
	e := r.errCode(t)
	if e.Code != code {
		t.Fatalf("code = %q, want %q (body %s)", e.Code, code, r.Body)
	}
	return e
}

// --- tests -------------------------------------------------------------------------------------

func TestHealth(t *testing.T) {
	e := newEnv(t)
	if r := e.anon().get("/healthz"); r.Status != 200 {
		t.Fatalf("healthz = %d", r.Status)
	}
}

func TestAuthRequired(t *testing.T) {
	e := newEnv(t)
	c := e.anon()
	for _, path := range []string{"/api/v1/parcels", "/api/v1/dashboard", "/api/v1/directory", "/api/v1/rooms/search?q=1", "/api/v1/auth/me"} {
		wantCode(t, c.get(path), 401, apperr.Unauthenticated)
	}
	wantCode(t, c.post("/api/v1/parcels", map[string]any{"trackingCode": "X1", "roomId": 1}), 401, apperr.Unauthenticated)
}

func TestLoginAndAccessLog(t *testing.T) {
	e := newEnv(t)
	c := e.anon()
	login := func(u, p string) response {
		return c.post("/api/v1/auth/login", map[string]string{"username": u, "password": p})
	}

	// Wrong password, unknown user and disabled account are indistinguishable to the caller.
	bad := []response{login("op1", "wrong"), login("nobody", testPassword), login("gone", testPassword)}
	for _, r := range bad {
		wantCode(t, r, 401, apperr.InvalidCredentials)
	}
	if string(bad[0].Body) != string(bad[1].Body) || string(bad[1].Body) != string(bad[2].Body) {
		t.Errorf("failure responses differ, leaking which field was wrong: %s | %s | %s", bad[0].Body, bad[1].Body, bad[2].Body)
	}

	wantCode(t, login("", "x"), 400, apperr.ValidationError)

	r := login("op1", testPassword)
	if r.Status != 200 {
		t.Fatalf("login = %d %s", r.Status, r.Body)
	}
	if strings.Contains(string(r.Body), "password") {
		t.Errorf("login response mentions password: %s", r.Body)
	}
	var me struct{ Staff store.Staff }
	if r := c.get("/api/v1/auth/me"); r.Status != 200 {
		t.Fatalf("me = %d", r.Status)
	} else {
		r.decode(t, &me)
	}
	if me.Staff.Username != "op1" || me.Staff.Role != "operator" {
		t.Errorf("me = %+v", me.Staff)
	}

	// The session cookie is HttpOnly and SameSite=Lax.
	u, _ := url.Parse(e.srv.URL)
	var found bool
	resp, _ := http.Post(e.srv.URL+"/api/v1/auth/login", "application/json",
		strings.NewReader(fmt.Sprintf(`{"username":"op1","password":%q}`, testPassword)))
	for _, ck := range resp.Cookies() {
		if ck.Name == "dpms_session" {
			found = true
			if !ck.HttpOnly || ck.SameSite != http.SameSiteLaxMode {
				t.Errorf("cookie flags: HttpOnly=%v SameSite=%v", ck.HttpOnly, ck.SameSite)
			}
		}
	}
	resp.Body.Close()
	_ = u
	if !found {
		t.Error("no session cookie set")
	}

	// Logout ends the session.
	if r := c.post("/api/v1/auth/logout", nil); r.Status != 204 {
		t.Fatalf("logout = %d", r.Status)
	}
	wantCode(t, c.get("/api/v1/auth/me"), 401, apperr.Unauthenticated)

	// Computer Crime Act §26: every attempt is in access_logs, tied to the account when there is one.
	if n := e.queryInt(`SELECT count(*) FROM access_logs WHERE outcome = 'failed'`); n != 3 {
		t.Errorf("failed access_logs = %d, want 3", n)
	}
	if n := e.queryInt(`SELECT count(*) FROM access_logs WHERE outcome = 'success' AND staff_id IS NOT NULL`); n != 2 {
		t.Errorf("success access_logs = %d, want 2", n)
	}
	if n := e.queryInt(`SELECT count(*) FROM access_logs WHERE username = 'nobody' AND staff_id IS NULL`); n != 1 {
		t.Errorf("unknown-user access_logs = %d, want 1", n)
	}
	if n := e.queryInt(`SELECT count(*) FROM access_logs WHERE username = 'gone' AND staff_id IS NOT NULL`); n != 1 {
		t.Errorf("disabled-account access_logs = %d, want 1", n)
	}
}

func TestSessionCannotBeForgedOrOutliveAccount(t *testing.T) {
	e := newEnv(t)

	forged := e.anon()
	jar := forged.http.Jar
	u, _ := url.Parse(e.srv.URL)
	jar.SetCookies(u, []*http.Cookie{{Name: "dpms_session", Value: "v1.1.99999999999.deadbeef", Path: "/"}})
	wantCode(t, forged.get("/api/v1/auth/me"), 401, apperr.Unauthenticated)

	// Disabling an account cuts off its existing session immediately.
	c := e.login("op1")
	if r := c.get("/api/v1/auth/me"); r.Status != 200 {
		t.Fatalf("me = %d", r.Status)
	}
	e.exec(`UPDATE staff SET is_active = false WHERE username = 'op1'`)
	wantCode(t, c.get("/api/v1/auth/me"), 401, apperr.Unauthenticated)
}

func TestCheckInValidatesRoomAgainstDirectory(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")

	p := c.checkIn("th123456789", e.roomB1101) // lower-case scan is normalised
	if p.TrackingCode != "TH123456789" || p.Status != "pending" || p.Room == nil ||
		p.Room.RoomNumber != "101" || p.Room.BuildingCode != "1" || p.CheckedInBy.FullName != "Operator One" {
		t.Errorf("parcel = %+v", p)
	}
	if len(p.Residents) != 1 || p.Residents[0].FullName != "สมชาย ใจดี" {
		t.Errorf("residents = %+v", p.Residents)
	}

	// A room that is not in the directory is rejected — the FK, not the client, is the gate.
	wantCode(t, c.post("/api/v1/parcels", map[string]any{"trackingCode": "TH000000001", "roomId": 999999}), 422, apperr.RoomNotInDirectory)
	if n := e.queryInt(`SELECT count(*) FROM parcels WHERE tracking_code = 'TH000000001'`); n != 0 {
		t.Errorf("rejected parcel was stored")
	}

	// Duplicate Tracking Code: 409 that says where the existing Parcel is.
	dup := wantCode(t, c.post("/api/v1/parcels", map[string]any{"trackingCode": "TH123456789", "roomId": e.roomB1102}), 409, apperr.DuplicateTrackingCode)
	if dup.Params["roomNumber"] != "101" || dup.Params["buildingCode"] != "1" || dup.Params["checkedInAt"] == nil {
		t.Errorf("duplicate params = %v", dup.Params)
	}

	// The specific recipient must actually live in that room.
	wantCode(t, c.post("/api/v1/parcels", map[string]any{"trackingCode": "TH000000002", "roomId": e.roomB1102, "residentId": e.residentB1101}), 422, apperr.ResidentNotInRoom)
	ok := c.post("/api/v1/parcels", map[string]any{"trackingCode": "TH000000003", "roomId": e.roomB1101, "residentId": e.residentB1101})
	if ok.Status != 201 {
		t.Errorf("valid recipient: %d %s", ok.Status, ok.Body)
	}
}

func TestCheckInRequestValidation(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	room := e.roomB1101

	cases := []struct {
		name string
		body any
	}{
		{"no room and no reason", map[string]any{"trackingCode": "A1"}},
		{"room and reason", map[string]any{"trackingCode": "A1", "roomId": room, "unmatchedReason": "other"}},
		{"bad reason", map[string]any{"trackingCode": "A1", "unmatchedReason": "whatever"}},
		{"empty code", map[string]any{"trackingCode": "  ", "roomId": room}},
		{"code with space", map[string]any{"trackingCode": "AB CD", "roomId": room}},
		{"code too long", map[string]any{"trackingCode": strings.Repeat("A", 65), "roomId": room}},
		{"room id zero", map[string]any{"trackingCode": "A1", "roomId": 0}},
		{"room as text", map[string]any{"trackingCode": "A1", "roomId": "101"}}, // Room Number is never free text
		{"resident without room", map[string]any{"trackingCode": "A1", "unmatchedReason": "other", "residentId": 1}},
		{"unknown field", map[string]any{"trackingCode": "A1", "roomId": room, "status": "picked_up"}},
		{"note too long", map[string]any{"trackingCode": "A1", "roomId": room, "note": strings.Repeat("x", 501)}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			wantCode(t, c.post("/api/v1/parcels", tc.body), 400, apperr.ValidationError)
		})
	}
	if n := e.queryInt(`SELECT count(*) FROM parcels`); n != 0 {
		t.Errorf("%d parcels stored from invalid requests", n)
	}

	// Non-JSON bodies are refused (CSRF hardening).
	r := c.do(http.MethodPost, "/api/v1/parcels", "text/plain", strings.NewReader(`trackingCode=A1&roomId=1`))
	wantCode(t, r, 415, apperr.UnsupportedMediaType)
}

func TestUnmatchedParcelLifecycle(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")

	r := c.post("/api/v1/parcels", map[string]any{"trackingCode": "NOROOM1", "unmatchedReason": "ambiguous", "note": "  label says 'แนน'  "})
	if r.Status != 201 {
		t.Fatalf("check-in unmatched: %d %s", r.Status, r.Body)
	}
	var p store.Parcel
	r.decode(t, &p)
	if p.Room != nil || p.UnmatchedReason == nil || *p.UnmatchedReason != "ambiguous" || p.Note == nil || *p.Note != "label says 'แนน'" {
		t.Errorf("unmatched parcel = %+v", p)
	}
	if got := c.list("unmatched=true"); got.Total != 1 || len(got.Items) != 1 {
		t.Errorf("unmatched queue = %+v", got)
	}

	// It can't be handed over until it has a room.
	wantCode(t, c.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"NOROOM1"}}), 409, apperr.ParcelNotPending)

	// Resolve it: only a directory room is accepted.
	wantCode(t, c.patch("/api/v1/parcels/NOROOM1/room", map[string]any{"roomId": 424242}), 422, apperr.RoomNotInDirectory)
	wantCode(t, c.patch("/api/v1/parcels/NOROOM1/room", map[string]any{}), 400, apperr.ValidationError)
	wantCode(t, c.patch("/api/v1/parcels/NOPE/room", map[string]any{"roomId": e.roomB1101}), 404, apperr.ParcelNotFound)

	r = c.patch("/api/v1/parcels/noroom1/room", map[string]any{"roomId": e.roomB1102})
	if r.Status != 200 {
		t.Fatalf("assign: %d %s", r.Status, r.Body)
	}
	r.decode(t, &p)
	if p.Room == nil || p.Room.ID != e.roomB1102 || p.UnmatchedReason != nil {
		t.Errorf("after assign = %+v", p)
	}
	if got := c.list("unmatched=true"); got.Total != 0 {
		t.Errorf("unmatched queue not empty after assign: %+v", got)
	}
	wantCode(t, c.patch("/api/v1/parcels/NOROOM1/room", map[string]any{"roomId": e.roomB1101}), 409, apperr.ParcelHasRoom)

	// Now it can be checked out.
	if r := c.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"NOROOM1"}}); r.Status != 200 {
		t.Errorf("check-out after assign: %d %s", r.Status, r.Body)
	}

	// The whole story is in the audit trail.
	var detail store.ParcelDetail
	c.get("/api/v1/parcels/NOROOM1").decode(t, &detail)
	var types []string
	for _, ev := range detail.Events {
		types = append(types, ev.EventType)
	}
	if strings.Join(types, ",") != "checked_in,room_assigned,checked_out" {
		t.Errorf("events = %v", types)
	}
}

// TestUnmatchedReasonFilter: the unmatched queue's reason tabs (No match / No resident / Ambiguous /
// Other) need accurate per-reason counts, not just the total.
func TestUnmatchedReasonFilter(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	c.post("/api/v1/parcels", map[string]any{"trackingCode": "R1", "unmatchedReason": "no_match"})
	c.post("/api/v1/parcels", map[string]any{"trackingCode": "R2", "unmatchedReason": "no_match"})
	c.post("/api/v1/parcels", map[string]any{"trackingCode": "R3", "unmatchedReason": "ambiguous"})
	c.checkIn("R4", e.roomB1101) // has a room: must never show up in any unmatched-reason filter

	if got := c.list("unmatched=true&unmatchedReason=no_match"); got.Total != 2 || len(codes(got.Items)) != 2 {
		t.Errorf("no_match = %+v", got)
	}
	if got := c.list("unmatched=true&unmatchedReason=ambiguous"); got.Total != 1 || got.Items[0].TrackingCode != "R3" {
		t.Errorf("ambiguous = %+v", got)
	}
	if got := c.list("unmatched=true&unmatchedReason=other"); got.Total != 0 {
		t.Errorf("other = %+v, want empty", got)
	}
	if got := c.list("unmatched=true"); got.Total != 3 {
		t.Errorf("all unmatched = %+v, want 3", got)
	}
	wantCode(t, c.get("/api/v1/parcels?unmatchedReason=bogus"), 400, apperr.ValidationError)
}

func TestCheckOutSelectedIsAtomic(t *testing.T) {
	e := newEnv(t)
	in := e.login("op1")
	out := e.login("op2")

	in.checkIn("P1", e.roomB1101)
	in.checkIn("P2", e.roomB1101)
	in.checkIn("P3", e.roomB1101)

	r := out.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"p1", "P1"}}) // duplicates collapse
	if r.Status != 200 {
		t.Fatalf("check-out: %d %s", r.Status, r.Body)
	}
	var res struct {
		CheckedOutCount int
		Parcels         []store.Parcel
	}
	r.decode(t, &res)
	if res.CheckedOutCount != 1 || res.Parcels[0].Status != "picked_up" ||
		res.Parcels[0].CheckedOutBy == nil || res.Parcels[0].CheckedOutBy.FullName != "Operator Two" || res.Parcels[0].CheckedOutAt == nil {
		t.Errorf("result = %+v", res)
	}

	// Already picked up -> 409 naming the code; a mixed request changes nothing.
	e1 := wantCode(t, out.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"P2", "P1"}}), 409, apperr.ParcelNotPending)
	if fmt.Sprint(e1.Params["trackingCodes"]) != "[P1]" {
		t.Errorf("params = %v", e1.Params)
	}
	if got := out.list("status=pending&roomId=" + fmt.Sprint(e.roomB1101)); got.Total != 2 {
		t.Errorf("P2 must still be pending after a failed mixed request; pending = %d", got.Total)
	}

	wantCode(t, out.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"P2", "GHOST"}}), 404, apperr.ParcelNotFound)
	wantCode(t, out.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{}}), 400, apperr.ValidationError)
	if got := out.list("status=pending&roomId=" + fmt.Sprint(e.roomB1101)); got.Total != 2 {
		t.Errorf("pending = %d after failed requests, want 2", got.Total)
	}
}

func TestCheckOutAllForRoom(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	c.checkIn("A1", e.roomB1101)
	c.checkIn("A2", e.roomB1101)
	c.checkIn("A3", e.roomB1101)
	c.checkIn("B1", e.roomB2101) // same room number, different building: must be untouched
	path := fmt.Sprintf("/api/v1/rooms/%d/check-out-all", e.roomB1101)

	// Selected first (both paths stay available), then "all" for what is left.
	c.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"A1"}})

	// The confirm dialog said 3 but only 2 are left: nothing is changed.
	ec := wantCode(t, c.post(path, map[string]any{"expectedCount": 3}), 409, apperr.PendingCountChanged)
	if ec.Params["expected"] != float64(3) || ec.Params["actual"] != float64(2) {
		t.Errorf("params = %v", ec.Params)
	}
	if n := e.queryInt(`SELECT count(*) FROM parcels WHERE room_id = $1 AND status = 'pending'`, e.roomB1101); n != 2 {
		t.Fatalf("pending after rejected check-out-all = %d, want 2", n)
	}

	r := c.post(path, map[string]any{"expectedCount": 2})
	if r.Status != 200 {
		t.Fatalf("check-out-all: %d %s", r.Status, r.Body)
	}
	var res struct{ CheckedOutCount int }
	r.decode(t, &res)
	if res.CheckedOutCount != 2 {
		t.Errorf("count = %d", res.CheckedOutCount)
	}

	wantCode(t, c.post(path, nil), 404, apperr.NoPendingParcels)
	wantCode(t, c.post("/api/v1/rooms/987654/check-out-all", nil), 422, apperr.RoomNotInDirectory)
	wantCode(t, c.post("/api/v1/rooms/abc/check-out-all", nil), 400, apperr.ValidationError)

	if n := e.queryInt(`SELECT count(*) FROM parcels WHERE room_id = $1 AND status = 'pending'`, e.roomB2101); n != 1 {
		t.Errorf("other building's parcel was touched: pending = %d", n)
	}
	if n := e.queryInt(`SELECT count(*) FROM parcel_events WHERE event_type = 'checked_out_bulk'`); n != 2 {
		t.Errorf("bulk events = %d, want 2", n)
	}
}

func TestConcurrentCheckOutOnlyOneWins(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	c.checkIn("RACE1", e.roomB1101)

	clients := []*client{e.login("op1"), e.login("op2")}
	const attempts = 12
	var wg sync.WaitGroup
	statuses := make([]int, attempts)
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			statuses[i] = clients[i%2].post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"RACE1"}}).Status
		}(i)
	}
	wg.Wait()

	var ok, conflict int
	for _, s := range statuses {
		switch s {
		case 200:
			ok++
		case 409:
			conflict++
		}
	}
	if ok != 1 || conflict != attempts-1 {
		t.Errorf("200s = %d, 409s = %d (statuses %v); exactly one check-out must win", ok, conflict, statuses)
	}
	if n := e.queryInt(`SELECT count(*) FROM parcel_events WHERE event_type = 'checked_out'`); n != 1 {
		t.Errorf("checked_out events = %d, want exactly 1", n)
	}
}

func TestParcelDetailIsChainOfCustody(t *testing.T) {
	e := newEnv(t)
	in := e.login("op1")
	out := e.login("op2")

	in.checkIn("CHAIN1", e.roomB1101)
	out.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"CHAIN1"}})

	var d store.ParcelDetail
	r := in.get("/api/v1/parcels/chain1")
	if r.Status != 200 {
		t.Fatalf("detail: %d %s", r.Status, r.Body)
	}
	r.decode(t, &d)
	if len(d.Events) != 2 {
		t.Fatalf("events = %+v", d.Events)
	}
	if d.Events[0].EventType != "checked_in" || d.Events[0].Staff.FullName != "Operator One" ||
		d.Events[1].EventType != "checked_out" || d.Events[1].Staff.FullName != "Operator Two" ||
		d.Events[1].OccurredAt.Before(d.Events[0].OccurredAt) {
		t.Errorf("events = %+v", d.Events)
	}
	wantCode(t, in.get("/api/v1/parcels/NOSUCH"), 404, apperr.ParcelNotFound)
}

func TestSearchAndPagination(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	c.checkIn("TH100", e.roomB1101)
	c.checkIn("TH101", e.roomB1102)
	c.checkIn("SPX900", e.roomB2101)
	c.checkIn("SPX901", e.roomB2101)

	has := func(query string, want ...string) {
		t.Helper()
		got := codes(c.list(query).Items)
		if len(got) != len(want) {
			t.Errorf("%s -> %v, want %v", query, got, want)
			return
		}
		set := map[string]bool{}
		for _, g := range got {
			set[g] = true
		}
		for _, w := range want {
			if !set[w] {
				t.Errorf("%s -> %v, want %v", query, got, want)
			}
		}
	}

	has("q=th1", "TH100", "TH101")                     // tracking-code prefix, case-insensitive
	has("q=SPX9", "SPX900", "SPX901")                  // prefix
	has("q=" + url.QueryEscape("H100"))                // prefix only: no match on the middle
	has("q=101", "TH100", "SPX900", "SPX901")          // room number: B1-101 and B2-101
	has("q=1101", "TH100")                             // full building+room number ("1101" = building 1, room 101)
	has("q="+url.QueryEscape("สมชาย"), "TH100")        // resident name
	has("q="+url.QueryEscape("warin"), "TH101")        // name, case-insensitive
	has("q="+url.QueryEscape("แนน"), "TH100", "TH101") // nickname shared by two rooms
	has("q=%25")                                       // a literal % matches nothing; it is not a wildcard
	has("q=_")                                         // nor is _
	has("q=spx&status=picked_up")
	has("roomId="+fmt.Sprint(e.roomB2101), "SPX900", "SPX901")

	p := c.list("pageSize=3")
	if p.Total != 4 || len(p.Items) != 3 || p.Page != 1 || p.PageSize != 3 {
		t.Errorf("page 1 = %+v", p)
	}
	if p2 := c.list("pageSize=3&page=2"); len(p2.Items) != 1 || p2.Total != 4 {
		t.Errorf("page 2 = %+v", p2)
	}
	if p9 := c.list("pageSize=3&page=9"); len(p9.Items) != 0 || p9.Total != 4 {
		t.Errorf("page 9 = %+v", p9)
	}
	if empty := c.list("q=zzz"); empty.Items == nil {
		t.Error("empty result must serialise as [] not null")
	}

	// No unbounded result sets: out-of-range paging is refused.
	for _, q := range []string{"pageSize=101", "pageSize=0", "page=0", "page=x", "status=bogus", "roomId=abc", "unmatched=maybe", "from=yesterday", "q=" + strings.Repeat("a", 101)} {
		wantCode(t, c.get("/api/v1/parcels?"+q), 400, apperr.ValidationError)
	}
}

func TestRoomAutocompleteAndDirectory(t *testing.T) {
	e := newEnv(t)
	c := e.login("op2")

	type hits struct{ Items []store.RoomHit }
	rooms := func(q string) []store.RoomHit {
		t.Helper()
		r := c.get("/api/v1/rooms/search?q=" + url.QueryEscape(q))
		if r.Status != 200 {
			t.Fatalf("rooms/search %q: %d %s", q, r.Status, r.Body)
		}
		var h hits
		r.decode(t, &h)
		return h.Items
	}

	if got := rooms("101"); len(got) != 2 || got[0].RoomNumber != "101" {
		t.Errorf("101 -> %+v", got)
	}
	if got := rooms("110"); len(got) != 2 {
		t.Errorf("'110' -> %+v", got)
	}
	if got := rooms("แนน"); len(got) != 2 {
		t.Errorf("nickname -> %+v", got)
	}
	if got := rooms("ณัฐพล"); len(got) != 1 || got[0].BuildingCode != "2" || len(got[0].Residents) != 1 {
		t.Errorf("name -> %+v", got)
	}
	if got := rooms("nomatch"); len(got) != 0 {
		t.Errorf("no match -> %+v", got)
	}
	if got := rooms(""); len(got) != 0 {
		t.Errorf("empty -> %+v", got)
	}
	wantCode(t, c.get("/api/v1/rooms/search?q=1&limit=21"), 400, apperr.ValidationError)

	r := c.get("/api/v1/directory?q=" + url.QueryEscape("แนน"))
	var dir store.Page[store.DirectoryEntry]
	r.decode(t, &dir)
	if dir.Total != 2 || len(dir.Items) != 2 {
		t.Errorf("directory = %+v", dir)
	}
	// Phone numbers are PII and never leave the database.
	if strings.Contains(strings.ToLower(string(r.Body)), "phone") || strings.Contains(string(r.Body), "0812345678") {
		t.Errorf("directory leaks phone: %s", r.Body)
	}
	if all := c.get("/api/v1/directory?pageSize=2"); all.Status != 200 {
		t.Errorf("directory paging: %d", all.Status)
	}
}

func TestDashboardCounts(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	c.checkIn("D1", e.roomB1101)
	c.checkIn("D2", e.roomB1101)
	c.checkIn("D3", e.roomB1102)
	c.post("/api/v1/parcels", map[string]any{"trackingCode": "D4", "unmatchedReason": "no_match"})
	c.post("/api/v1/parcels/check-out", map[string]any{"trackingCodes": []string{"D1"}})

	get := func(query string) store.Dashboard {
		t.Helper()
		r := c.get("/api/v1/dashboard" + query)
		if r.Status != 200 {
			t.Fatalf("dashboard%s: %d %s", query, r.Status, r.Body)
		}
		var d store.Dashboard
		r.decode(t, &d)
		return d
	}

	today := time.Now().In(e.loc)
	d := get("")
	if d.Date != today.Format("2006-01-02") || d.CheckedIn != 4 || d.PickedUp != 1 || d.Pending != 3 || d.UnmatchedPending != 1 || len(d.RecentCheckIns) != 4 {
		t.Errorf("today = %+v", d)
	}
	if y := get("?date=" + today.AddDate(0, 0, -1).Format("2006-01-02")); y.CheckedIn != 0 || y.PickedUp != 0 || y.Pending != 0 {
		t.Errorf("yesterday = %+v", y)
	}
	// Tomorrow: nothing arrives, but what is still pending at the end of that day counts.
	if tm := get("?date=" + today.AddDate(0, 0, 1).Format("2006-01-02")); tm.CheckedIn != 0 || tm.Pending != 3 {
		t.Errorf("tomorrow = %+v", tm)
	}
	wantCode(t, c.get("/api/v1/dashboard?date=2026-13-45"), 400, apperr.ValidationError)
	wantCode(t, c.get("/api/v1/dashboard?date=today"), 400, apperr.ValidationError)
}

func TestRBACAdminOnlyAccessLogs(t *testing.T) {
	e := newEnv(t)
	op := e.login("op1")
	wantCode(t, op.get("/api/v1/admin/access-logs"), 403, apperr.Forbidden)

	boss := e.login("boss")
	r := boss.get("/api/v1/admin/access-logs?pageSize=2")
	if r.Status != 200 {
		t.Fatalf("admin access-logs: %d %s", r.Status, r.Body)
	}
	var logs store.Page[store.AccessLog]
	r.decode(t, &logs)
	if logs.Total < 2 || len(logs.Items) != 2 || logs.Items[0].Outcome != "success" {
		t.Errorf("logs = %+v", logs)
	}
	// Newest first, and no password material anywhere.
	if strings.Contains(string(r.Body), "assword") {
		t.Errorf("access log leaks password data: %s", r.Body)
	}
	wantCode(t, e.anon().get("/api/v1/admin/access-logs"), 401, apperr.Unauthenticated)
}

func TestDatabaseEnforcesInvariants(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	c.checkIn("INV1", e.roomB1101)
	staff := e.queryInt(`SELECT id FROM staff WHERE username = 'op1'`)

	mustFail := func(name, sql string, args ...any) {
		t.Helper()
		if _, err := e.pool.Exec(context.Background(), sql, args...); err == nil {
			t.Errorf("%s: statement succeeded, want it rejected", name)
		}
	}

	// Audit trail and access log are append-only.
	mustFail("update event", `UPDATE parcel_events SET staff_id = staff_id`)
	mustFail("delete event", `DELETE FROM parcel_events`)
	mustFail("update access log", `UPDATE access_logs SET username = 'x'`)
	mustFail("delete access log", `DELETE FROM access_logs`)

	// A Parcel is never roomless without a reason, roomless parcels are never handed over,
	// and picked-up parcels always record who and when.
	mustFail("no room no reason", `INSERT INTO parcels (tracking_code, checked_in_by) VALUES ('BAD1', $1)`, staff)
	mustFail("unknown room", `INSERT INTO parcels (tracking_code, room_id, checked_in_by) VALUES ('BAD2', 424242, $1)`, staff)
	mustFail("picked up without who/when", `UPDATE parcels SET status = 'picked_up' WHERE tracking_code = 'INV1'`)
	e.exec(`INSERT INTO parcels (tracking_code, unmatched_reason, checked_in_by) VALUES ('ROOMLESS', 'other', $1)`, staff)
	mustFail("roomless picked up", `UPDATE parcels SET status = 'picked_up', checked_out_by = $1, checked_out_at = now() WHERE tracking_code = 'ROOMLESS'`, staff)
	mustFail("duplicate code", `INSERT INTO parcels (tracking_code, room_id, checked_in_by) VALUES ('INV1', $1, $2)`, e.roomB1101, staff)
}
