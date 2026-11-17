import { expect } from '@playwright/test';

export const PASSWORD = process.env.E2E_PASSWORD || 'parcel1234';

// Unique per run so tests can be repeated against the same database without collisions.
export const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e4)}`;

export async function loginUI(page, username = 'somsri') {
  await page.goto('/');
  await page.fill('#username', username);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await expect(page.getByRole('button', { name: 'รับพัสดุเข้า' })).toBeVisible();
}

// An API client with its own session cookie (the page's request context shares the browser's cookies).
export async function loginAPI(request, username = 'somsri') {
  const r = await request.post('/api/v1/auth/login', { data: { username, password: PASSWORD } });
  expect(r.status(), `login ${username}`).toBe(200);
}

export async function roomId(request, q) {
  const r = await request.get(`/api/v1/rooms/search?q=${encodeURIComponent(q)}`);
  expect(r.status()).toBe(200);
  const body = await r.json();
  const items = body.items || body;
  expect(items.length, `room ${q}`).toBeGreaterThan(0);
  return items[0].id;
}

export async function checkInAPI(request, trackingCode, body) {
  const r = await request.post('/api/v1/parcels', { data: { trackingCode, ...body } });
  expect(r.status(), `check-in ${trackingCode}: ${await r.text()}`).toBe(201);
  return r.json();
}
