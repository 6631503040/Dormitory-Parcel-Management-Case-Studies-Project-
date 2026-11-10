-- 0005 — Web Push notifications for Residents (Epic E3 revision 2026-10-21: US-23, US-24, US-25),
-- replacing the LINE pull-based status check (US-08/US-11, now deprecated). Additive only: the LINE
-- tables from 0004 stay in place (records are never hard-deleted) but nothing new writes to them.
--
-- Flow: a Resident claims a room from the PWA -> resident_otp_challenges; Staff read the code out
-- at the desk; the Resident types it back together with their browser's PushSubscription ->
-- push_subscriptions. Check-In then queues one push_notifications row per active subscription of
-- the room (inside the Check-In transaction), and a background worker delivers it.

CREATE TYPE push_notification_status AS ENUM ('queued', 'sent', 'failed', 'cancelled');
CREATE TYPE push_unsubscribe_reason AS ENUM ('resident', 'staff', 'gone', 'replaced');

-- The OTP is plaintext for the same reason as line_otp_challenges (0004): Staff must read it out
-- loud. The claim token — the only handle the Resident's browser holds — is stored as a SHA-256
-- hash, so a database read alone can't be used to complete someone else's registration.
CREATE TABLE resident_otp_challenges (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id          bigint      NOT NULL REFERENCES rooms (id),
    claim_token_hash bytea       NOT NULL UNIQUE,
    code             text        NOT NULL,
    consent_version  text        NOT NULL,  -- exact consent text version shown before the code was issued (LR-01/LR-05)
    attempts         int         NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz NOT NULL,
    consumed_at      timestamptz,
    read_by_staff_id bigint      REFERENCES staff (id),  -- the Staff member who read the code out (identity check)
    read_at          timestamptz
);

CREATE INDEX resident_otp_pending_room_idx ON resident_otp_challenges (room_id, created_at DESC) WHERE consumed_at IS NULL;

-- One row per registered browser/device. A subscription is tied to a room, not to a named
-- Resident (minimisation: no name, phone or student ID is collected), and expires on its own so a
-- Resident who moves out doesn't keep receiving that room's notifications indefinitely.
CREATE TABLE push_subscriptions (
    id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id                  bigint      NOT NULL REFERENCES rooms (id),
    endpoint                 text        NOT NULL,
    p256dh                   text        NOT NULL,
    auth                     text        NOT NULL,
    device_token_hash        bytea       NOT NULL UNIQUE,  -- SHA-256 of the bearer token the PWA keeps
    consent_version          text        NOT NULL,
    otp_challenge_id         bigint      NOT NULL REFERENCES resident_otp_challenges (id),
    issued_by_staff_id       bigint      NOT NULL REFERENCES staff (id),
    verified_at              timestamptz NOT NULL DEFAULT now(),
    expires_at               timestamptz NOT NULL,
    last_success_at          timestamptz,
    unsubscribed_at          timestamptz,
    unsubscribed_reason      push_unsubscribe_reason,
    unsubscribed_by_staff_id bigint      REFERENCES staff (id),
    CONSTRAINT push_subscriptions_unsubscribe_consistency CHECK (
        (unsubscribed_at IS NULL AND unsubscribed_reason IS NULL)
        OR (unsubscribed_at IS NOT NULL AND unsubscribed_reason IS NOT NULL)
    )
);

-- A browser endpoint belongs to at most one active registration; re-registering supersedes it.
CREATE UNIQUE INDEX push_subscriptions_active_endpoint_idx ON push_subscriptions (endpoint) WHERE unsubscribed_at IS NULL;
CREATE INDEX push_subscriptions_active_room_idx ON push_subscriptions (room_id) WHERE unsubscribed_at IS NULL;

-- Transactional outbox. Parcels checked in for the same room within the batch window are merged
-- into the one still-unclaimed row (attempts = 0) for each subscription, so a Flash Sale burst of
-- five Parcels for one room is one notification, not five. Once the worker claims a row (attempts
-- >= 1) a later Check-In opens a new row instead of mutating one that is mid-delivery.
CREATE TABLE push_notifications (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subscription_id bigint                   NOT NULL REFERENCES push_subscriptions (id),
    room_id         bigint                   NOT NULL REFERENCES rooms (id),
    parcel_ids      bigint[]                 NOT NULL,
    status          push_notification_status NOT NULL DEFAULT 'queued',
    attempts        int                      NOT NULL DEFAULT 0,
    next_attempt_at timestamptz              NOT NULL,
    created_at      timestamptz              NOT NULL DEFAULT now(),
    sent_at         timestamptz,
    last_http_status int,
    last_error      text
);

CREATE UNIQUE INDEX push_notifications_open_batch_idx ON push_notifications (subscription_id) WHERE status = 'queued' AND attempts = 0;
CREATE INDEX push_notifications_due_idx ON push_notifications (next_attempt_at) WHERE status = 'queued';
