import { test, expect } from '@playwright/test';
import { loginAPI, loginUI, roomId, checkInAPI, uid } from './helpers';

// Regression round 2 (2026-11-16) for the three Test Plan cases that failed in round 1 (build 4782b57).
// Each test states the expected behaviour from the Test Plan. While a defect is open its test is
// marked test.fail() (an expected failure keeps CI green and documents the defect); once the fix lands
// the test passes "unexpectedly", Playwright reports that as a failure, and the marker must be removed.
const KNOWN_OPEN = new Set([]); // docs/03-test/defects.md
const openDefect = (id) => test.fail(KNOWN_OPEN.has(id), `${id} is open — see docs/03-test/defects.md`);

test('TC25 / DEF-001: problem queue lists the oldest Parcel without a room first (US-06)', async ({ request }) => {
  openDefect('DEF-001');
  await loginAPI(request);
  const older = uid('TC25-OLD');
  const newer = uid('TC25-NEW');
  await checkInAPI(request, older, { unmatchedReason: 'no_match' });
  await new Promise((r) => setTimeout(r, 1100));
  await checkInAPI(request, newer, { unmatchedReason: 'no_match' });

  // The same request the dashboard's UnmatchedQueue makes (status=pending&unmatched=true).
  const page = await (await request.get('/api/v1/parcels?status=pending&unmatched=true&pageSize=100')).json();
  const codes = page.items.map((p) => p.trackingCode);
  expect(codes.indexOf(older), `order: ${codes.slice(0, 5).join(', ')}`).toBeLessThan(codes.indexOf(newer));
});

test('TC35 / DEF-002: Check Out Selected rejects Tracking Codes from different rooms', async ({ request }) => {
  openDefect('DEF-002');
  await loginAPI(request);
  const roomA = await roomId(request, '1101');
  const roomB = await roomId(request, '1102');
  const a = uid('TC35-A');
  const b = uid('TC35-B');
  await checkInAPI(request, a, { roomId: roomA });
  await checkInAPI(request, b, { roomId: roomB });

  const r = await request.post('/api/v1/parcels/check-out', { data: { trackingCodes: [a, b] } });
  const statusB = (await (await request.get(`/api/v1/parcels/${b}`)).json()).status;
  expect.soft(r.status(), 'mixed-room request must be rejected').toBeGreaterThanOrEqual(400);
  expect(statusB, "room B's Parcel must stay Pending").toBe('pending');
});

test('TC43 / DEF-003: a server outage is not shown as being signed out', async ({ page }) => {
  openDefect('DEF-003');
  await loginUI(page);
  // Simulates the database being down on reload: /auth/me answers 503 instead of 200/401.
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL' }) }),
  );
  await page.reload();
  await page.waitForLoadState('networkidle');
  const onSignIn = await page.locator('#username').isVisible();
  const hasAlert = await page.getByRole('alert').count();
  expect(onSignIn && hasAlert === 0, 'outage looks like a signed-out session (sign-in page, no error)').toBe(false);
});
