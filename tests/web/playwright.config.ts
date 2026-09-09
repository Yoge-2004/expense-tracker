import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.WEB_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'phone-landscape', use: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true } },
    { name: 'tablet', use: { ...devices['iPad (gen 9)'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-wide', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } } },
  ],
  webServer: process.env.WEB_BASE_URL ? undefined : {
    command: 'python3 -m http.server 4173 --directory ../../frontend',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
