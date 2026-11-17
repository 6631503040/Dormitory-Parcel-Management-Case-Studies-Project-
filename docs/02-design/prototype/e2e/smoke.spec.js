import { test, expect } from '@playwright/test';
import { loginUI, uid } from './helpers';

// Smoke flow (Test Summary 2026-11-16, item 4): sign in → Check-In through the UI →
// the Parcel is Pending → Check-Out through the UI → Picked Up with a two-event audit trail.
test('Staff can sign in, Check-In and Check-Out a Parcel', async ({ page }) => {
  const code = uid('E2E');
  await loginUI(page);

  await page.getByRole('button', { name: 'รับพัสดุเข้า' }).click();
  const checkIn = page.getByRole('dialog', { name: 'บันทึกพัสดุเข้า' });
  await checkIn.getByRole('textbox', { name: 'เลขพัสดุ' }).fill(code);
  await checkIn.getByRole('combobox').fill('1101');
  await page.getByRole('option', { name: /^1101/ }).first().click();
  await checkIn.getByRole('button', { name: 'บันทึก' }).click();
  await expect(checkIn.getByRole('status')).toContainText('บันทึกเข้าสู่ระบบสำเร็จ 1 รายการ');
  await checkIn.getByRole('button', { name: 'เสร็จสิ้น' }).click();
  await expect(checkIn).toBeHidden();

  let r = await page.request.get(`/api/v1/parcels/${code}`);
  expect(r.status()).toBe(200);
  expect((await r.json()).status).toBe('pending');

  await page.getByRole('button', { name: 'นำพัสดุออก' }).click();
  const checkOut = page.getByRole('dialog', { name: 'นำพัสดุออก' });
  const field = checkOut.getByRole('textbox', { name: 'เลขพัสดุ / เลขห้อง' });
  await field.fill(code);
  await field.press('Enter');
  await checkOut.getByRole('button', { name: /^ยืนยัน|^นำออก/ }).last().click();

  await expect.poll(async () => (await (await page.request.get(`/api/v1/parcels/${code}`)).json()).status).toBe('picked_up');
  const detail = await (await page.request.get(`/api/v1/parcels/${code}`)).json();
  const events = (detail.events || []).map((e) => e.eventType || e.type);
  expect(events).toEqual(expect.arrayContaining(['checked_in', 'checked_out']));
});

test('Resident page loads and asks for a room', async ({ page }) => {
  await page.goto('/resident/');
  await expect(page.getByRole('heading', { name: /ลงทะเบียนรับการแจ้งเตือนพัสดุ/ })).toBeVisible();
});
