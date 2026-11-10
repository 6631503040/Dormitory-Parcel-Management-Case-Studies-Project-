-- 0006 — Edit a checked-in Parcel (US-26). Staff can correct a Pending Parcel's Tracking Code, Room
-- Number or note after Check-In; every edit appends an `edited` event whose detail holds each changed
-- field's before/after value, so the original record stays reconstructable (chain of custody).

-- New value is only used by application code after this migration commits.
ALTER TYPE parcel_event_type ADD VALUE 'edited';
