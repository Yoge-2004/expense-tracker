import base from './playwright.config';
import { defineConfig } from '@playwright/test';
export default defineConfig({
  ...base,
  retries: 0,
  workers: 4,
  fullyParallel: true,
  reporter: [['list'], ['json', { outputFile: process.env.PW_JSON || '/tmp/pw.json' }]],
  projects: (base.projects || []).map((p: any) => ({
    ...p,
    use: { ...p.use, video: 'off', trace: 'off', screenshot: 'off', launchOptions: { executablePath: '/tmp/chromium', args: ['--no-sandbox', '--disable-gpu'], chromiumSandbox: false } },
  })),
});
