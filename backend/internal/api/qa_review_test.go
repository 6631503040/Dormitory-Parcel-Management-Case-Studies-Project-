package api_test

// Regression tests for the QA review of 1 November 2026 (docs/03-test/BUGS_AND_SECURITY_TODO_2026-11-01.md).
// Each test name carries the review item it closes.

import (
	"net/http"
	"net/url"
	"strconv"
	"testing"

	"dpms/backend/internal/apperr"
)

// QA-01: logging out revokes that session server-side, so a copy of the cookie taken before logout
// no longer works — while other sessions of the same and other Staff keep working.
func TestQA01LogoutRevokesCopiedSession(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	other := e.login("op1") // same account, second desk
	op2 := e.login("op2")

	u, _ := url.Parse(e.srv.URL)
	copied := e.anon()
	copied.http.Jar.SetCookies(u, c.http.Jar.Cookies(u))
	if r := copied.get("/api/v1/auth/me"); r.Status != 200 {
		t.Fatalf("copied cookie before logout = %d", r.Status)
	}

	if r := c.post("/api/v1/auth/logout", nil); r.Status != http.StatusNoContent {
		t.Fatalf("logout = %d %s", r.Status, r.Body)
	}
	wantCode(t, copied.get("/api/v1/auth/me"), 401, apperr.Unauthenticated)

	for name, s := range map[string]*client{"other op1 session": other, "op2": op2} {
		if r := s.get("/api/v1/auth/me"); r.Status != 200 {
			t.Errorf("%s after op1 logout = %d", name, r.Status)
		}
	}
	// Logging in again gives a fresh, working session.
	if r := e.login("op1").get("/api/v1/auth/me"); r.Status != 200 {
		t.Errorf("new session after logout = %d", r.Status)
	}
	// Logging out without a session (or twice) is harmless.
	if r := e.anon().post("/api/v1/auth/logout", nil); r.Status != http.StatusNoContent {
		t.Errorf("anonymous logout = %d", r.Status)
	}
}

// QA-02: repeated wrong passwords from one client are throttled with 429 + Retry-After, without
// locking the owner out from elsewhere and without counting successful logins.
func TestQA02LoginThrottlesRepeatedFailures(t *testing.T) {
	e := newEnv(t)
	attacker := e.anon()
	try := func(c *client, user, pw string) response {
		return c.post("/api/v1/auth/login", map[string]string{"username": user, "password": pw})
	}

	var last response
	limited := 0
	for i := 0; i < 25; i++ {
		last = try(attacker, "op1", "wrong-"+strconv.Itoa(i))
		if last.Status == http.StatusTooManyRequests {
			limited = i
			break
		}
		wantCode(t, last, 401, apperr.InvalidCredentials)
	}
	if last.Status != http.StatusTooManyRequests {
		t.Fatalf("25 wrong passwords, never throttled (last %d)", last.Status)
	}
	if limited > 10 {
		t.Errorf("throttled only after %d failures", limited)
	}
	wantCode(t, last, 429, apperr.TooManyLoginAttempts)
	// Even the right password is refused while throttled, so guessing can't continue.
	wantCode(t, try(attacker, "op1", testPassword), 429, apperr.TooManyLoginAttempts)

	// Every attempt is still logged, the throttled ones included (Computer Crime Act §26).
	if n := e.queryInt(`SELECT count(*) FROM access_logs WHERE username = 'op1' AND outcome = 'failed'`); n != int64(limited+2) {
		t.Errorf("failed access_logs = %d, want %d", n, limited+2)
	}

	// A different account from the same client is not affected by op1's counter.
	if r := try(attacker, "op2", testPassword); r.Status != 200 {
		t.Errorf("op2 login from the same client = %d %s", r.Status, r.Body)
	}
}

// QA-03: a Tracking Code that is accepted must be retrievable by the same code, so characters that
// change the meaning of a URL path are rejected at Check-In.
func TestQA03TrackingCodeMustBeRetrievable(t *testing.T) {
	e := newEnv(t)
	c := e.login("op1")
	for _, code := range []string{"REVIEW/SLASH", `BACK\SLASH`, "Q?1", "HASH#1", "PCT%2F", ".", ".."} {
		t.Run(code, func(t *testing.T) {
			wantCode(t, c.post("/api/v1/parcels", map[string]any{"trackingCode": code, "roomId": e.roomB1101}), 400, apperr.ValidationError)
		})
	}
	// Codes with other punctuation still work end to end.
	for _, code := range []string{"TH-123.456_A", "SPX+77", "A.B"} {
		p := c.checkIn(code, e.roomB1101)
		if r := c.get("/api/v1/parcels/" + url.PathEscape(p.TrackingCode)); r.Status != 200 {
			t.Errorf("GET %s = %d %s", p.TrackingCode, r.Status, r.Body)
		}
	}
}

// QA-04: an out-of-range page is a validation error, never a 500 from a negative OFFSET.
func TestQA04HugePageIsAValidationError(t *testing.T) {
	e := newEnv(t)
	op := e.login("op1")
	boss := e.login("boss")
	op.checkIn("PAGE1", e.roomB1101)

	for _, tc := range []struct {
		c    *client
		path string
	}{
		{op, "/api/v1/parcels"},
		{op, "/api/v1/directory"},
		{boss, "/api/v1/admin/access-logs"},
	} {
		for _, page := range []string{"9223372036854775807", "92233720368547758", "100001", "0", "-1"} {
			wantCode(t, tc.c.get(tc.path+"?page="+page+"&pageSize=100"), 400, apperr.ValidationError)
		}
		if r := tc.c.get(tc.path + "?page=100000&pageSize=100"); r.Status != 200 {
			t.Errorf("%s last allowed page = %d %s", tc.path, r.Status, r.Body)
		}
	}
}
