-- 0007 — A Parcel with no room can be checked out (team decision 2026-10-27).
--
-- 0002 forbade handing over an unmatched (roomless) Parcel: Staff had to assign a directory room
-- first. At the desk the Resident is standing there with the Parcel in hand, so that extra step only
-- delays the handover. A roomless Parcel may now go Pending -> Picked Up directly; it keeps its
-- unmatched_reason and note, and the checked_out event records who handed it over and when, so the
-- chain of custody is unchanged. A Parcel still never exists without a room *or* a reason
-- (parcels_room_or_reason stays), and the room is still never free text.

ALTER TABLE parcels DROP CONSTRAINT parcels_roomless_is_pending;
