-- 0001_init.sql — schema exactly as locked in docs/02-design/design-spec.md §4.
-- Extensions beyond the spec live in later migrations (0002+), each with its reason.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE staff_role AS ENUM ('operator', 'admin');
CREATE TYPE parcel_status AS ENUM ('pending', 'picked_up', 'archived');
CREATE TYPE parcel_event_type AS ENUM ('checked_in', 'checked_out', 'checked_out_bulk', 'note_added');

CREATE TABLE buildings (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code       text        NOT NULL UNIQUE,
    name       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    building_id bigint      NOT NULL REFERENCES buildings (id),
    room_number text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (building_id, room_number)
);

-- The official directory: the name <-> room source of truth that Check-In validates against.
CREATE TABLE residents (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id    bigint      NOT NULL REFERENCES rooms (id),
    full_name  text        NOT NULL,
    nickname   text,
    phone      text,       -- PII: never returned by the directory API
    is_active  boolean     NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      text        NOT NULL UNIQUE,
    password_hash text        NOT NULL,  -- bcrypt (salted); plaintext is never stored or logged
    full_name     text        NOT NULL,
    role          staff_role  NOT NULL DEFAULT 'operator',
    is_active     boolean     NOT NULL DEFAULT true,
    last_login_at timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE parcels (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tracking_code  text          NOT NULL UNIQUE,
    room_id        bigint        NOT NULL REFERENCES rooms (id),  -- FK to the directory, never free text
    resident_id    bigint        REFERENCES residents (id),
    status         parcel_status NOT NULL DEFAULT 'pending',
    note           text,
    checked_in_by  bigint        NOT NULL REFERENCES staff (id),
    checked_in_at  timestamptz   NOT NULL DEFAULT now(),
    checked_out_by bigint        REFERENCES staff (id),
    checked_out_at timestamptz,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    -- A Parcel that has left Pending always records who handed it over and when.
    CONSTRAINT parcels_checkout_consistency CHECK (
        (status = 'pending' AND checked_out_by IS NULL AND checked_out_at IS NULL)
        OR (status <> 'pending' AND checked_out_by IS NOT NULL AND checked_out_at IS NOT NULL)
    )
);

-- Performance Risk (Med/High): the lookup paths named in the proposal.
CREATE INDEX parcels_room_status_idx ON parcels (room_id, status);          -- pending per room (Check-Out)
CREATE INDEX parcels_status_checked_in_idx ON parcels (status, checked_in_at); -- Dashboard counts
CREATE INDEX parcels_tracking_code_prefix_idx ON parcels (tracking_code text_pattern_ops); -- prefix search
CREATE INDEX residents_full_name_trgm_idx ON residents USING gin (full_name gin_trgm_ops);
CREATE INDEX residents_nickname_trgm_idx ON residents USING gin (nickname gin_trgm_ops);
CREATE INDEX residents_room_idx ON residents (room_id);

-- Append-only audit trail (chain of custody for misdelivery disputes).
CREATE TABLE parcel_events (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parcel_id   bigint            NOT NULL REFERENCES parcels (id),
    event_type  parcel_event_type NOT NULL,
    staff_id    bigint            NOT NULL REFERENCES staff (id),
    occurred_at timestamptz       NOT NULL DEFAULT now(),
    detail      jsonb
);

CREATE INDEX parcel_events_parcel_idx ON parcel_events (parcel_id, occurred_at);

CREATE FUNCTION forbid_modification() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION '% on % is not allowed: table is append-only', TG_OP, TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER parcel_events_append_only
    BEFORE UPDATE OR DELETE ON parcel_events
    FOR EACH ROW EXECUTE FUNCTION forbid_modification();
