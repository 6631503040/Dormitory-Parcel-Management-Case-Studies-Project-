package api_test

import (
	"fmt"
	"net/http"
	"testing"

	"dpms/backend/internal/apperr"
)

// RBAC matrix (Test Summary 2026-11-16, item 5): every protected route × every caller type.
// The frontend is not the gate (CLAUDE.md), so this checks the API alone:
//   - no session            → 401 on every Staff, Admin and Resident-device route
//   - operator session      → 403 on every Admin route, never 401/403 on Staff routes
//   - admin session         → never 401/403 on Staff or Admin routes
//   - Staff cookie only     → 401 on Resident-device routes (needs a device bearer token)
//   - bogus device token    → 401 on Resident-device routes
//
// "Never 401/403" is the only claim for allowed callers: a 400/404/409 there is a validation
// result of the empty request, not an authorization decision. When a protected route is added to
// router.go, add it to rbacRoutes too.

type route struct {
	method, path string
	group        string // "staff", "admin", "device"
}

func rbacRoutes(e *env) []route {
	room := fmt.Sprint(e.roomB1101)
	return []route{
		{http.MethodGet, "/api/v1/auth/me", "staff"},
		{http.MethodGet, "/api/v1/rooms/search?q=101", "staff"},
		{http.MethodGet, "/api/v1/directory", "staff"},
		{http.MethodPost, "/api/v1/parcels", "staff"},
		{http.MethodGet, "/api/v1/parcels", "staff"},
		{http.MethodPost, "/api/v1/parcels/check-out", "staff"},
		{http.MethodGet, "/api/v1/parcels/RBAC-NONE", "staff"},
		{http.MethodPatch, "/api/v1/parcels/RBAC-NONE", "staff"},
		{http.MethodPatch, "/api/v1/parcels/RBAC-NONE/room", "staff"},
		{http.MethodPost, "/api/v1/rooms/" + room + "/check-out-all", "staff"},
		{http.MethodGet, "/api/v1/rooms/" + room + "/resident-otp", "staff"},
		{http.MethodGet, "/api/v1/rooms/" + room + "/push-subscriptions", "staff"},
		{http.MethodDelete, "/api/v1/rooms/" + room + "/push-subscriptions", "staff"},
		{http.MethodGet, "/api/v1/dashboard", "staff"},

		{http.MethodGet, "/api/v1/admin/access-logs", "admin"},
		{http.MethodGet, "/api/v1/admin/staff", "admin"},
		{http.MethodPost, "/api/v1/admin/staff", "admin"},
		{http.MethodGet, "/api/v1/admin/residents/export", "admin"},
		{http.MethodPost, "/api/v1/admin/residents/import/preview", "admin"},
		{http.MethodPost, "/api/v1/admin/residents/import", "admin"},

		{http.MethodGet, "/api/v1/resident/me", "device"},
		{http.MethodPut, "/api/v1/resident/push/subscription", "device"},
		{http.MethodDelete, "/api/v1/resident/push/subscription", "device"},
	}
}

func (c *client) call(rt route, bearer string) response {
	c.t.Helper()
	req, err := http.NewRequest(rt.method, c.base+rt.path, nil)
	if err != nil {
		c.t.Fatal(err)
	}
	if rt.method != http.MethodGet && rt.method != http.MethodDelete {
		req.Header.Set("Content-Type", "application/json")
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		c.t.Fatalf("%s %s: %v", rt.method, rt.path, err)
	}
	defer resp.Body.Close()
	return response{Status: resp.StatusCode}
}

func TestRBACMatrix(t *testing.T) {
	e := newEnv(t)
	anon := e.anon()
	op := e.login("op1")
	boss := e.login("boss")

	for _, rt := range rbacRoutes(e) {
		name := rt.method + " " + rt.path
		t.Run(name, func(t *testing.T) {
			if got := anon.call(rt, "").Status; got != http.StatusUnauthorized {
				t.Errorf("no session: %d, want 401", got)
			}
			switch rt.group {
			case "staff":
				if got := op.call(rt, "").Status; got == 401 || got == 403 {
					t.Errorf("operator: %d, want allowed", got)
				}
				if got := boss.call(rt, "").Status; got == 401 || got == 403 {
					t.Errorf("admin: %d, want allowed", got)
				}
			case "admin":
				if got := op.call(rt, "").Status; got != http.StatusForbidden {
					t.Errorf("operator: %d, want 403", got)
				}
				if got := boss.call(rt, "").Status; got == 401 || got == 403 {
					t.Errorf("admin: %d, want allowed", got)
				}
			case "device":
				if got := boss.call(rt, "").Status; got != http.StatusUnauthorized {
					t.Errorf("Staff cookie without device token: %d, want 401", got)
				}
				if got := anon.call(rt, "not-a-real-device-token").Status; got != http.StatusUnauthorized {
					t.Errorf("bogus device token: %d, want 401", got)
				}
			}
		})
	}
}

// A disabled Staff account must not sign in, and an operator must not reach Admin data by
// changing the role in the request body.
func TestRBACCannotEscalate(t *testing.T) {
	e := newEnv(t)
	r := e.anon().post("/api/v1/auth/login", map[string]string{"username": "gone", "password": testPassword})
	if r.Status != http.StatusUnauthorized {
		t.Errorf("disabled account login: %d, want 401", r.Status)
	}
	op := e.login("op1")
	r = op.post("/api/v1/admin/staff", map[string]string{
		"username": "sneaky", "password": "long-enough-password", "fullName": "Sneaky", "role": "admin",
	})
	wantCode(t, r, http.StatusForbidden, apperr.Forbidden)
	if n := e.queryInt(`SELECT count(*) FROM staff WHERE username = 'sneaky'`); n != 0 {
		t.Errorf("operator created a Staff account (%d rows)", n)
	}
}
