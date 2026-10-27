/* Service worker for the Resident PWA (/resident/). Receives Web Push messages from the DPMS
 * backend and shows them as notifications. The payload carries machine values only
 * ({type, room, newCount, pendingCount, url}); the Thai text is built here, because the backend
 * never sends user-facing strings (design-spec §5). */

const TOKEN_CACHE = "dpms-resident";
const TOKEN_KEY = "/resident/__device-token";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function describe(data) {
  const room = data.room || "";
  const fresh = Number(data.newCount) || 0;
  const total = Number(data.pendingCount) || fresh;
  const body =
    total > fresh
      ? `ห้อง ${room} มีพัสดุใหม่ ${fresh} ชิ้น (รอรับทั้งหมด ${total} ชิ้น) รับได้ที่เคาน์เตอร์พัสดุ`
      : `ห้อง ${room} มีพัสดุรอรับ ${fresh} ชิ้น รับได้ที่เคาน์เตอร์พัสดุ`;
  return { title: "พัสดุมาถึงแล้ว", body };
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  if (data.type !== "parcel_arrived") return;
  const { title, body } = describe(data);
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        tag: "dpms-parcel", // a newer notification replaces the older one instead of piling up
        renotify: true,
        icon: "/resident/icon-192.png",
        badge: "/resident/icon-192.png",
        lang: "th",
        data: { url: data.url || "/resident/" },
      }),
      // An open status page reloads its Pending list right away instead of waiting for its poll.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
        for (const w of wins) w.postMessage({ type: "parcel_arrived" });
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/resident/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin + "/resident/")) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// Browsers occasionally rotate a push subscription. Re-subscribe and tell the backend, using the
// device token the page left in Cache Storage (service workers have no localStorage).
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(TOKEN_CACHE);
      const hit = await cache.match(TOKEN_KEY);
      if (!hit) return;
      const token = await hit.text();
      const key = event.oldSubscription?.options?.applicationServerKey;
      const sub = event.newSubscription || (key && (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })));
      if (!sub) return;
      await fetch("/api/v1/resident/push/subscription", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });
    })()
  );
});
