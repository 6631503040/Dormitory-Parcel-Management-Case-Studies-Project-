// Fixtures shaped exactly like the real API responses (backend/README.md "API contract" +
// backend/internal/store/parcels.go). Keep these in sync if either changes.

let seq = 0;
const nextId = () => ++seq;

export function makeStaff(overrides = {}) {
  return { id: 2, username: "somsri", fullName: "Somsri Rattanakul", role: "operator", ...overrides };
}

export function makeRoomHit(overrides = {}) {
  const id = overrides.id ?? nextId();
  return {
    id,
    roomNumber: "101",
    buildingCode: "1",
    residents: [{ id: nextId(), fullName: "สมชาย ใจดี", nickname: null }],
    ...overrides,
  };
}

export function makeParcel(overrides = {}) {
  const room = overrides.room === undefined ? { id: 1, roomNumber: "101", buildingCode: "1" } : overrides.room;
  return {
    id: nextId(),
    trackingCode: "TH0000000001",
    status: "pending",
    note: null,
    unmatchedReason: room ? null : "no_match",
    residentId: null,
    room,
    residents: room ? [{ id: 1, fullName: "สมชาย ใจดี", nickname: null }] : [],
    checkedInBy: { id: 2, fullName: "Somsri Rattanakul" },
    checkedInAt: "2026-09-22T02:00:00Z",
    checkedOutBy: null,
    checkedOutAt: null,
    ...overrides,
  };
}

export function makePage(items, overrides = {}) {
  return { items, page: 1, pageSize: 20, total: items.length, ...overrides };
}

export function makeParcelDetail(overrides = {}) {
  const parcel = makeParcel(overrides);
  return {
    ...parcel,
    events: overrides.events ?? [
      { id: nextId(), eventType: "checked_in", staff: parcel.checkedInBy, occurredAt: parcel.checkedInAt, detail: null },
    ],
  };
}

export function makeDashboard(overrides = {}) {
  return {
    date: "2026-09-22",
    checkedIn: 4,
    pickedUp: 1,
    pending: 3,
    unmatchedPending: 1,
    recentCheckIns: [],
    ...overrides,
  };
}

export function apiError(code, params = {}) {
  return { code, params };
}
