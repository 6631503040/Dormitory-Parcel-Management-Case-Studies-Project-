-- 0002 — two additions on top of design-spec §4. Both are recorded in design-spec's change log.
--
-- 1. Unmatched Parcels. A Parcel can arrive with no usable room (missing, illegible, nickname that
--    matches nobody). Instead of guessing a room, it is stored with room_id NULL and a reason, and
--    waits in a queue until Staff pick a room from the directory. Origin: product_backlog US-06.
-- 2. access_logs. Computer Crime Act §26 (rule.md): every login attempt, success or fail, is logged
--    with actor, timestamp and outcome, and kept >= 90 days.

CREATE TYPE unmatched_reason AS ENUM ('no_match', 'no_resident', 'ambiguous', 'other');

ALTER TABLE parcels ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE parcels ADD COLUMN unmatched_reason unmatched_reason;

-- A Parcel either has a room, or is explicitly parked with a reason (never both missing).
ALTER TABLE parcels ADD CONSTRAINT parcels_room_or_reason
    CHECK (room_id IS NOT NULL OR unmatched_reason IS NOT NULL);
-- Only Pending Parcels can be roomless: nothing can be handed over without a room.
ALTER TABLE parcels ADD CONSTRAINT parcels_roomless_is_pending
    CHECK (room_id IS NOT NULL OR status = 'pending');

CREATE INDEX parcels_unmatched_idx ON parcels (checked_in_at) WHERE room_id IS NULL AND status = 'pending';

-- New value is only used by application code after this migration commits.
ALTER TYPE parcel_event_type ADD VALUE 'room_assigned';

CREATE TYPE access_outcome AS ENUM ('success', 'failed');

CREATE TABLE access_logs (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id    bigint         REFERENCES staff (id),  -- NULL when the username matched no account
    username    text           NOT NULL,               -- as typed (capped), so failed attempts stay traceable
    outcome     access_outcome NOT NULL,
    ip_address  text,
    occurred_at timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX access_logs_occurred_idx ON access_logs (occurred_at DESC);

CREATE TRIGGER access_logs_append_only
    BEFORE UPDATE OR DELETE ON access_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_modification();
