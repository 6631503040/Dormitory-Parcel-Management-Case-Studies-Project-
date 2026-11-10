package store

import (
	"context"
	"regexp"
	"time"
	"unicode/utf8"

	"dpms/backend/internal/apperr"
)

const (
	minPasswordLen = 8
	maxPasswordLen = 72 // bcrypt's input limit, in bytes
	maxFullNameLen = 100
	RoleOperator   = "operator"
	RoleAdmin      = "admin"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9._-]{3,32}$`)

// ValidateNewStaff checks a registration before it is hashed and stored. Shared by the API and
// cmd/createadmin so both enforce the same rules. Inputs are expected already trimmed.
func ValidateNewStaff(username, fullName, password, role string) *apperr.Error {
	switch {
	case username == "":
		return apperr.Validation("username", "required")
	case !usernamePattern.MatchString(username):
		return apperr.Validation("username", "invalid_format")
	case fullName == "":
		return apperr.Validation("fullName", "required")
	case utf8.RuneCountInString(fullName) > maxFullNameLen:
		return apperr.Validation("fullName", "too_long")
	case len(password) < minPasswordLen:
		return apperr.Validation("password", "too_short")
	case len(password) > maxPasswordLen:
		return apperr.Validation("password", "too_long")
	case role != RoleOperator && role != RoleAdmin:
		return apperr.Validation("role", "invalid")
	}
	return nil
}

type NewStaff struct {
	Username     string
	PasswordHash string
	FullName     string
	Role         string
	CreatedBy    *int64 // the Admin who registered the account; nil for the first Admin (cmd/createadmin)
}

// CreateStaff inserts an account. A taken username comes back as USERNAME_TAKEN.
func (s *Store) CreateStaff(ctx context.Context, in NewStaff) (*Staff, error) {
	var st Staff
	err := s.pool.QueryRow(ctx,
		`INSERT INTO staff (username, password_hash, full_name, role, created_by)
		 VALUES ($1, $2, $3, $4::text::staff_role, $5)
		 RETURNING id, username, full_name, role::text`,
		in.Username, in.PasswordHash, in.FullName, in.Role, in.CreatedBy).Scan(&st.ID, &st.Username, &st.FullName, &st.Role)
	if pgConstraint(err, "23505", "staff_username_key") {
		return nil, apperr.New(apperr.UsernameTaken, map[string]any{"username": in.Username})
	}
	if err != nil {
		return nil, err
	}
	return &st, nil
}

type StaffListItem struct {
	Staff
	IsActive    bool       `json:"isActive"`
	LastLoginAt *time.Time `json:"lastLoginAt"`
	CreatedAt   time.Time  `json:"createdAt"`
}

func (s *Store) ListStaff(ctx context.Context, page, pageSize int) (Page[StaffListItem], error) {
	out := Page[StaffListItem]{Items: []StaffListItem{}, Page: page, PageSize: pageSize}
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM staff`).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, username, full_name, role::text, is_active, last_login_at, created_at
		 FROM staff ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`, pageSize, (page-1)*pageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var it StaffListItem
		if err := rows.Scan(&it.ID, &it.Username, &it.FullName, &it.Role, &it.IsActive, &it.LastLoginAt, &it.CreatedAt); err != nil {
			return out, err
		}
		if it.LastLoginAt != nil {
			t := it.LastLoginAt.UTC()
			it.LastLoginAt = &t
		}
		it.CreatedAt = it.CreatedAt.UTC()
		out.Items = append(out.Items, it)
	}
	return out, rows.Err()
}
