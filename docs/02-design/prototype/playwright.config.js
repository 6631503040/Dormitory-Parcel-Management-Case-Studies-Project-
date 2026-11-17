import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against a running stack (Go API serving the built client, isolated database).
// They never start the stack themselves and must never point at the dev or production database.
//
//   docker compose -f docker/docker-compose.test.yml -p dpms-test up -d      (repo root)
//   # seed + run the API with WEB_DIR=docs/02-design/prototype/dist on :18080 — see docs/03-test/README.md
//   E2E_BASE_URL=http://localhost:18080 npm run test:e2e
//
// Seeded logins (cmd/seed, development only): admin / somsri — password E2E_PASSWORD or "parcel1234".
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.E2E_JSON || 'e2e-results/results.json' }]],
  outputDir: 'e2e-results/artifacts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:18080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /regression|a11y/ },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] }, testMatch: /smoke/ },
  ],
});
