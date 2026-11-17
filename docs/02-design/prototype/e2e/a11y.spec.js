import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginUI } from './helpers';

// Automated accessibility scan (WCAG 2.1 A + AA rules in axe-core). axe finds roughly a third of
// WCAG issues; the manual checklist in the Test Summary covers the rest (keyboard, IME, zoom).
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page, label) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map((v) => `${v.impact} ${v.id} (${v.nodes.length}): ${v.help}`);
  test.info().annotations.push({ type: 'axe', description: `${label}: ${summary.length ? summary.join(' | ') : 'no violations'}` });
  await test.info().attach(`axe-${label}.json`, { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });
  return result.violations;
}

test('login page has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/');
  const v = await scan(page, 'login');
  expect(v.filter((x) => ['serious', 'critical'].includes(x.impact))).toEqual([]);
});

test('dashboard has no serious or critical axe violations', async ({ page }) => {
  await loginUI(page);
  const v = await scan(page, 'dashboard');
  expect(v.filter((x) => ['serious', 'critical'].includes(x.impact))).toEqual([]);
});

test('Check-In dialog has no serious or critical axe violations', async ({ page }) => {
  await loginUI(page);
  await page.getByRole('button', { name: 'รับพัสดุเข้า' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const v = await scan(page, 'check-in-dialog');
  expect(v.filter((x) => ['serious', 'critical'].includes(x.impact))).toEqual([]);
});

test('Resident page has no serious or critical axe violations', async ({ page }) => {
  await page.goto('/resident/');
  await expect(page.getByRole('heading').first()).toBeVisible();
  const v = await scan(page, 'resident');
  expect(v.filter((x) => ['serious', 'critical'].includes(x.impact))).toEqual([]);
});

test('Check-In dialog is keyboard-operable (TC47 steps 1-2)', async ({ page }) => {
  await loginUI(page);
  const open = page.getByRole('button', { name: 'รับพัสดุเข้า' });
  await open.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox', { name: 'เลขพัสดุ' })).toBeFocused();
  // A native modal <dialog> lets Tab pass to the browser's own UI (activeElement = <body>) before
  // wrapping back; that is expected. Focus must never reach page content behind the dialog.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const where = await dialog.evaluate((d) => {
      const a = document.activeElement;
      return a === document.body || d.contains(a) ? 'ok' : `${a.tagName} ${a.getAttribute('aria-label') || a.textContent.trim().slice(0, 30)}`;
    });
    expect(where, `Tab ${i + 1} reached content behind the dialog`).toBe('ok');
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});
