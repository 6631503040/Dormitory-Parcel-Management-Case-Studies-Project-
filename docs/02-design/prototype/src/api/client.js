// Thin fetch wrapper around the Go/Gin API (backend/README.md has the full contract).
// Every response is JSON; every error is {code, params} — never text — so the caller decides
// what to show. The session is an HttpOnly cookie; `credentials: "include"` sends it every time.

const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(code, params, status) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.params = params || {};
    this.status = status;
  }
}

// Set by ParcelHubApp so any request that comes back 401 can drop the app straight to the login
// screen, instead of every call site checking for it individually.
let onUnauthenticated = null;
export function setUnauthenticatedHandler(fn) {
  onUnauthenticated = fn;
}

function toQueryString(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    usp.set(key, value);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function request(path, { method = "GET", body, signal } = {}) {
  const init = { method, credentials: "include", signal };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(BASE + path, init);
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("NETWORK_ERROR", {}, 0);
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body (shouldn't happen on this API, but don't crash on it)
  }

  if (!res.ok) {
    if (res.status === 401) onUnauthenticated?.();
    throw new ApiError(data?.code || "INTERNAL_ERROR", data?.params, res.status);
  }
  return data;
}

export const api = {
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),

  searchRooms: (q, limit, signal) => request(`/rooms/search${toQueryString({ q, limit })}`, { signal }),

  checkIn: (input) => request("/parcels", { method: "POST", body: input }),
  listParcels: (params, signal) => request(`/parcels${toQueryString(params)}`, { signal }),
  getParcel: (trackingCode) => request(`/parcels/${encodeURIComponent(trackingCode)}`),
  checkOut: (trackingCodes) => request("/parcels/check-out", { method: "POST", body: { trackingCodes } }),
  checkOutAll: (roomId, expectedCount) =>
    request(`/rooms/${roomId}/check-out-all`, {
      method: "POST",
      body: expectedCount != null ? { expectedCount } : undefined,
    }),
  assignRoom: (trackingCode, roomId) =>
    request(`/parcels/${encodeURIComponent(trackingCode)}/room`, { method: "PATCH", body: { roomId } }),

  dashboard: (date, signal) => request(`/dashboard${toQueryString({ date })}`, { signal }),

  // The pending LINE OTP for a room (US-11 step 3): staff read this code out to the resident in
  // person. It is never sent over LINE itself.
  lineOtp: (roomId) => request(`/rooms/${roomId}/line-otp`),
};
