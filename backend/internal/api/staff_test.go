package api_test

import (
	"strings"
	"testing"

	"dpms/backend/internal/apperr"
	"dpms/backend/internal/store"
)

func TestAdminRegistersStaff(t *testing.T) {
	e := newEnv(t)
	boss := e.login("boss")

	r := boss.post("/api/v1/admin/staff", map[string]string{
		"username": "  New.Op ", "fullName": " สมศรี ใจดี ", "password": "longenough1", "role": "operator",
	})
	if r.Status != 201 {
		t.Fatalf("create: %d %s", r.Status, r.Body)
	}
	var created struct{ Staff store.Staff }
	r.decode(t, &created)
	if created.Staff.Username != "new.op" || created.Staff.FullName != "สมศรี ใจดี" || created.Staff.Role != "operator" {
		t.Errorf("created = %+v", created.Staff)
	}
	if strings.Contains(string(r.Body), "assword") {
		t.Errorf("response leaks password data: %s", r.Body)
	}

	// Recorded who registered it, and the new account can log in with the chosen password.
	bossID := e.queryInt(`SELECT id FROM staff WHERE username = 'boss'`)
	if got := e.queryInt(`SELECT created_by FROM staff WHERE username = 'new.op'`); got != bossID {
		t.Errorf("created_by = %d, want %d", got, bossID)
	}
	if r := e.anon().post("/api/v1/auth/login", map[string]string{"username": "new.op", "password": "longenough1"}); r.Status != 200 {
		t.Errorf("new account login: %d %s", r.Status, r.Body)
	}

	// An Admin can register another Admin.
	if r := boss.post("/api/v1/admin/staff", map[string]string{
		"username": "boss2", "fullName": "Second Admin", "password": "longenough2", "role": "admin",
	}); r.Status != 201 {
		t.Errorf("create admin: %d %s", r.Status, r.Body)
	}

	wantCode(t, boss.post("/api/v1/admin/staff", map[string]string{
		"username": "op1", "fullName": "Dup", "password": "longenough1", "role": "operator",
	}), 409, apperr.UsernameTaken)

	var page store.Page[store.StaffListItem]
	lr := boss.get("/api/v1/admin/staff?pageSize=2")
	if lr.Status != 200 {
		t.Fatalf("list: %d %s", lr.Status, lr.Body)
	}
	lr.decode(t, &page)
	if page.Total != 6 || len(page.Items) != 2 || page.Items[0].Username != "boss2" {
		t.Errorf("list = %+v", page)
	}
	if strings.Contains(string(lr.Body), "assword") {
		t.Errorf("list leaks password data: %s", lr.Body)
	}
}

func TestRegisterStaffValidation(t *testing.T) {
	e := newEnv(t)
	boss := e.login("boss")
	cases := []struct {
		name, field string
		body        map[string]string
	}{
		{"missing username", "username", map[string]string{"username": " ", "fullName": "A", "password": "longenough1", "role": "operator"}},
		{"bad username", "username", map[string]string{"username": "a b", "fullName": "A", "password": "longenough1", "role": "operator"}},
		{"missing name", "fullName", map[string]string{"username": "abc", "fullName": " ", "password": "longenough1", "role": "operator"}},
		{"short password", "password", map[string]string{"username": "abc", "fullName": "A", "password": "short", "role": "operator"}},
		{"bad role", "role", map[string]string{"username": "abc", "fullName": "A", "password": "longenough1", "role": "superuser"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := wantCode(t, boss.post("/api/v1/admin/staff", tc.body), 400, apperr.ValidationError)
			if got.Params["field"] != tc.field {
				t.Errorf("field = %v, want %s", got.Params["field"], tc.field)
			}
		})
	}
}

func TestOnlyAdminRegistersStaff(t *testing.T) {
	e := newEnv(t)
	body := map[string]string{"username": "sneaky", "fullName": "Sneaky", "password": "longenough1", "role": "admin"}
	wantCode(t, e.login("op1").post("/api/v1/admin/staff", body), 403, apperr.Forbidden)
	wantCode(t, e.login("op1").get("/api/v1/admin/staff"), 403, apperr.Forbidden)
	wantCode(t, e.anon().post("/api/v1/admin/staff", body), 401, apperr.Unauthenticated)
	if n := e.queryInt(`SELECT count(*) FROM staff WHERE username = 'sneaky'`); n != 0 {
		t.Errorf("non-admin created an account")
	}
}
