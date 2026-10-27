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

// `token` is the Resident PWA's device bearer token (resident routes have no session cookie).
async function request(path, { method = "GET", body, signal, token } = {}) {
  const init = { method, credentials: "include", signal, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (token) init.headers.Authorization = `Bearer ${token}`;

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
    if (res.status === 401 && !token) onUnauthenticated?.();
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
  // Correct a Pending Parcel after Check-In (US-26): send only the fields that changed; note "" clears it.
  updateParcel: (trackingCode, changes) =>
    request(`/parcels/${encodeURIComponent(trackingCode)}`, { method: "PATCH", body: changes }),
  assignRoom: (trackingCode, roomId) =>
    request(`/parcels/${encodeURIComponent(trackingCode)}/room`, { method: "PATCH", body: { roomId } }),

  // period: "day" | "week" (Mon–Sun) | "month" — the one that contains `date`.
  dashboard: ({ date, period } = {}, signal) => request(`/dashboard${toQueryString({ date, period })}`, { signal }),

  // Web Push registration (US-24 step 3): the room's pending code, read out loud at the desk. The
  // Resident's PWA never receives it — that in-person hand-off is the identity check.
  residentOtp: (roomId) => request(`/rooms/${roomId}/resident-otp`),
  roomPushSubscriptions: (roomId) => request(`/rooms/${roomId}/push-subscriptions`),
  revokeRoomPushSubscriptions: (roomId) => request(`/rooms/${roomId}/push-subscriptions`, { method: "DELETE" }),
};

// Resident PWA (/resident/). No Staff session: register with a desk OTP, then use the device token.
export const residentApi = {
  pushConfig: () => request("/resident/push/config"),
  claimRoom: (roomNumber, consentVersion) =>
    request("/resident/otp", { method: "POST", body: { roomNumber, consentVersion, consentAccepted: true } }),
  verify: (claimToken, code, subscription) =>
    request("/resident/otp/verify", { method: "POST", body: { claimToken, code, subscription } }),
  status: (token) => request("/resident/me", { token }),
  updateSubscription: (token, subscription) =>
    request("/resident/push/subscription", { method: "PUT", body: subscription, token }),
  unsubscribe: (token) => request("/resident/push/subscription", { method: "DELETE", token }),
};
