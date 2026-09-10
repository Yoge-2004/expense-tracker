import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Expense Tracker E2E tests.
 *
 * Usage:
 *   cd e2e
 *   npm install
 *   npx playwright install chromium
 *   npm test                          # run all tests headless
 *   npm run test:headed               # run with visible browser
 *   npm run test:ui                   # run with Playwright UI mode
 *
 * Environment variables:
 *   BASE_URL  — the frontend URL (default: http://localhost:5500)
 *   API_URL   — the backend API URL (default: http://localhost:8080)
 *
 * The tests assume:
 *   - The backend is running on API_URL (default :8080)
 *   - The frontend is served on BASE_URL (default :5500 — use `python -m http.server 5500` in frontend/)
 *   - The demo user exists: demo@expensetracker.com / Demo1234!
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5500',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile-ui-regressions\.spec\.ts$/,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /(?:\.mobile\.spec|mobile-ui-regressions\.spec)\.ts$/,
    },
  ],
});
