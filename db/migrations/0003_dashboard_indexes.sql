-- 0003 — Dashboard "Picked Up" and "received on day X" counts filter on the timestamp columns alone,
-- which the status-leading indexes from 0001 cannot serve. Additive; no existing index changes.

CREATE INDEX parcels_checked_in_at_idx ON parcels (checked_in_at);
CREATE INDEX parcels_checked_out_at_idx ON parcels (checked_out_at) WHERE checked_out_at IS NOT NULL;
