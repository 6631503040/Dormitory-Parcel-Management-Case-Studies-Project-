// Package store holds every SQL statement. Handlers never touch the database directly.
package store

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ pool *pgxpool.Pool }

func New(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// querier is satisfied by both *pgxpool.Pool and pgx.Tx.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type scanner interface{ Scan(dest ...any) error }

// Page is the envelope every list endpoint returns; there are no unbounded result sets.
type Page[T any] struct {
	Items    []T   `json:"items"`
	Page     int   `json:"page"`
	PageSize int   `json:"pageSize"`
	Total    int64 `json:"total"`
}

type StaffRef struct {
	ID       int64  `json:"id"`
	FullName string `json:"fullName"`
}

type Staff struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	FullName string `json:"fullName"`
	Role     string `json:"role"`
}

// StaffAccount is the login-side view of a staff row (never serialised).
type StaffAccount struct {
	Staff
	PasswordHash string
	IsActive     bool
}

const staffColumns = `id, username, full_name, role::text, password_hash, is_active`

func scanStaff(row scanner) (*StaffAccount, error) {
	var a StaffAccount
	err := row.Scan(&a.ID, &a.Username, &a.FullName, &a.Role, &a.PasswordHash, &a.IsActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &a, err
}

// StaffByUsername returns (nil, nil) when no account has that username.
func (s *Store) StaffByUsername(ctx context.Context, username string) (*StaffAccount, error) {
	return scanStaff(s.pool.QueryRow(ctx, `SELECT `+staffColumns+` FROM staff WHERE username = $1`, username))
}

func (s *Store) StaffByID(ctx context.Context, id int64) (*StaffAccount, error) {
	return scanStaff(s.pool.QueryRow(ctx, `SELECT `+staffColumns+` FROM staff WHERE id = $1`, id))
}

func (s *Store) TouchLastLogin(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `UPDATE staff SET last_login_at = now(), updated_at = now() WHERE id = $1`, id)
	return err
}

// RecordAccess appends one login attempt to access_logs (Computer Crime Act §26).
func (s *Store) RecordAccess(ctx context.Context, staffID *int64, username, outcome, ip string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO access_logs (staff_id, username, outcome, ip_address) VALUES ($1, $2, $3::text::access_outcome, NULLIF($4, ''))`,
		staffID, username, outcome, ip)
	return err
}

type AccessLog struct {
	ID         int64     `json:"id"`
	StaffID    *int64    `json:"staffId"`
	Username   string    `json:"username"`
	Outcome    string    `json:"outcome"`
	IPAddress  *string   `json:"ipAddress"`
	OccurredAt time.Time `json:"occurredAt"`
}

func (s *Store) ListAccessLogs(ctx context.Context, page, pageSize int) (Page[AccessLog], error) {
	out := Page[AccessLog]{Items: []AccessLog{}, Page: page, PageSize: pageSize}
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM access_logs`).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := s.pool.Query(ctx,
		`SELECT id, staff_id, username, outcome::text, ip_address, occurred_at
		 FROM access_logs ORDER BY occurred_at DESC, id DESC LIMIT $1 OFFSET $2`, pageSize, (page-1)*pageSize)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var l AccessLog
		if err := rows.Scan(&l.ID, &l.StaffID, &l.Username, &l.Outcome, &l.IPAddress, &l.OccurredAt); err != nil {
			return out, err
		}
		l.OccurredAt = l.OccurredAt.UTC()
		out.Items = append(out.Items, l)
	}
	return out, rows.Err()
}

// queryBuilder collects positional arguments for dynamically assembled WHERE clauses.
type queryBuilder struct {
	conds []string
	args  []any
}

func (b *queryBuilder) arg(v any) string {
	b.args = append(b.args, v)
	return "$" + strconv.Itoa(len(b.args))
}

func (b *queryBuilder) where(cond string) { b.conds = append(b.conds, cond) }

func (b *queryBuilder) whereSQL() string {
	if len(b.conds) == 0 {
		return ""
	}
	return " WHERE " + strings.Join(b.conds, " AND ")
}

// escapeLike neutralises LIKE wildcards in user input so "50%" or "a_b" match literally.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
