-- 0004 — LINE parcel-status check (US-08) and OTP-verified LINE linking (US-11), per
-- product_backlog.md Epic E3 (2026-09-22 revision: pull-based status check + in-person OTP
-- hand-off, not push notifications). Additive only; no existing table changes.

-- A LINE account links to at most one room at a time; re-linking (room change) supersedes the
-- old row instead of erroring, so unlinked_at IS NULL identifies the current active link.
CREATE TABLE line_links (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    line_user_id         text NOT NULL,
    room_id              bigint NOT NULL REFERENCES rooms (id),
    consent_version      text NOT NULL,
    linked_at            timestamptz NOT NULL DEFAULT now(),
    unlinked_at          timestamptz,
    unlinked_by_staff_id bigint REFERENCES staff (id)
);

CREATE UNIQUE INDEX line_links_active_user_idx ON line_links (line_user_id) WHERE unlinked_at IS NULL;
CREATE INDEX line_links_active_room_idx ON line_links (room_id) WHERE unlinked_at IS NULL;

-- The OTP itself is kept in plaintext, deliberately: staff must be able to read it back to the
-- resident in person (that in-person hand-off is the actual identity check, US-11 step 3), and it
-- is single-use, expires in minutes, and only reachable through an authenticated staff endpoint.
CREATE TABLE line_otp_challenges (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    line_user_id     text NOT NULL,
    room_id          bigint NOT NULL REFERENCES rooms (id),
    code             text NOT NULL,
    attempts         int NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    consumed_at      timestamptz,
    read_by_staff_id bigint REFERENCES staff (id),
    read_at          timestamptz
);

CREATE INDEX line_otp_pending_room_idx ON line_otp_challenges (room_id, created_at DESC) WHERE consumed_at IS NULL;
CREATE INDEX line_otp_pending_user_idx ON line_otp_challenges (line_user_id, created_at DESC) WHERE consumed_at IS NULL;
