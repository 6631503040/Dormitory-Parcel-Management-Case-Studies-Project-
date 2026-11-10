-- 0010 — Resident directory import (US-29). An Admin uploads a CSV of everyone currently living in
-- the dormitory; the API adds new Residents, moves those whose room changed and deactivates those no
-- longer listed (is_active = false — never deleted, Parcel history keeps pointing at them).
-- Each applied import is recorded here: who ran it, when, and what it changed. Append-only.

CREATE TABLE resident_imports (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id      bigint      NOT NULL REFERENCES staff (id),
    row_count     integer     NOT NULL,
    added         integer     NOT NULL,
    moved         integer     NOT NULL,
    moved_out     integer     NOT NULL,
    rooms_created integer     NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
