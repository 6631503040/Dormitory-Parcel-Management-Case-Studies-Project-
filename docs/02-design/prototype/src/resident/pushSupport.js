// Thin wrapper over the browser's Service Worker + Push + Notification APIs, so ResidentApp stays
// testable (tests mock this module; jsdom has none of these APIs).

const SW_URL = "/resident/sw.js";
const SW_SCOPE = "/resident/";
const TOKEN_CACHE = "dpms-resident";
const TOKEN_KEY = "/resident/__device-token";

export class PushPermissionError extends Error {
  constructor(state) {
    super(`notification permission ${state}`);
    this.name = "PushPermissionError";
    this.state = state; // "denied" | "default"
  }
}

export function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

// "ok" | "ios_install" (iPhone/iPad: Web Push only works once added to the Home Screen, iOS 16.4+)
// | "insecure" (needs HTTPS, or localhost) | "unsupported"
export function pushSupport() {
  if (!window.isSecureContext) return "insecure";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ok) return "ok";
  if (isIOS() && !isStandalone()) return "ios_install";
  return "unsupported";
}

// "granted" | "denied" | "default", read without prompting; "default" when push is unsupported.
export function notificationPermission() {
  return pushSupport() === "ok" ? Notification.permission : "default";
}

export async function registerServiceWorker() {
  await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  return navigator.serviceWorker.ready;
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(a, b) {
  if (!a || !b || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  return x.every((v, i) => v === y[i]);
}

// Asks for notification permission (must run inside a user gesture on Safari) and returns this
// browser's PushSubscription as plain JSON: {endpoint, expirationTime, keys: {p256dh, auth}}.
export async function subscribe(vapidPublicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushPermissionError(permission);
  const reg = await registerServiceWorker();
  const key = urlBase64ToUint8Array(vapidPublicKey);
  let sub = await reg.pushManager.getSubscription();
  // A subscription made for a different server key can't receive our messages; replace it.
  if (sub && !sameKey(sub.options?.applicationServerKey, key.buffer)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub.toJSON();
}

// The current subscription, if notifications are still allowed and one exists (no prompt).
export async function currentSubscription() {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return null;
  const reg = await registerServiceWorker();
  const sub = await reg.pushManager.getSubscription();
  return sub ? sub.toJSON() : null;
}

// A local notification shown straight from this device (no server round trip), so the Resident
// can see at the counter that the phone really buzzes. Resolves false when it could not be shown.
export async function showTestNotification(body) {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!reg) return false;
  await reg.showNotification("แจ้งเตือนพัสดุ", {
    body,
    tag: "dpms-test",
    icon: "/resident/icon-192.png",
    badge: "/resident/icon-192.png",
    data: { url: SW_SCOPE },
  });
  return true;
}

export async function unsubscribeBrowser() {
  if (pushSupport() !== "ok") return;
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}

// The service worker has no localStorage; it reads the device token from Cache Storage when the
// browser rotates the push subscription (pushsubscriptionchange) so delivery keeps working.
export async function shareTokenWithWorker(token) {
  if (!("caches" in window)) return;
  try {
    const cache = await caches.open(TOKEN_CACHE);
    if (token) await cache.put(TOKEN_KEY, new Response(token));
    else await cache.delete(TOKEN_KEY);
  } catch {
    // best effort: the page re-syncs the subscription on every open anyway
  }
}
