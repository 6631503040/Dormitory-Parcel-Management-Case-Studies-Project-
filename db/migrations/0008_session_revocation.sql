-- 0008 — Logout revokes the session server-side (QA-01, review 2026-11-01).
--
-- Session cookies are signed tokens that carry a random session ID (auth.Signer, format v2). Logout
-- records that ID here, and every authenticated request checks it, so a copy of the cookie taken
-- before logout stops working immediately instead of at expiry (default 8 h). Only the session that
-- logged out is revoked: the same Staff's other desks and other Staff are unaffected.
--
-- Rows are only needed until the token would have expired anyway; logout deletes expired rows, so
-- the table stays the size of the logouts of the last session TTL.

CREATE TABLE revoked_sessions (
    session_id text        PRIMARY KEY,
    staff_id   bigint      NOT NULL REFERENCES staff (id),
    revoked_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE INDEX revoked_sessions_expires_idx ON revoked_sessions (expires_at);
