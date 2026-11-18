#!/usr/bin/env node
/**
 * Renders key pages in a real mobile browser and writes screenshots plus a small JSON report.
 * Used by .github/workflows/ui-screenshots.yml so that how the site LOOKS can be checked, not only how it behaves.
 *
 *   node scripts/ui-screenshots.mjs <frontend-dir> <out-dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium, devices } = createRequire(path.join(root, 'e2e', 'package.json'))('@playwright/test');
const frontend = path.resolve(process.argv[2] || 'frontend');
const out = path.resolve(process.argv[3] || 'shots');
fs.mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(frontend, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+$/, '/index.html'));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(req.url.startsWith('/api/') ? 503 : 404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(5600, resolve));
const base = 'http://127.0.0.1:5600/';

const targets = [
  { name: 'pixel7', device: devices['Pixel 7'] },
  { name: 'phone360', device: { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } } },
  { name: 'landscape', device: { ...devices['Pixel 7'], viewport: { width: 915, height: 412 } } },
];
const pages = ['index.html', 'legacy-mobile.html'];
const browser = await chromium.launch();
const report = [];
for (const target of targets) {
  const context = await browser.newContext({ ...target.device });
  for (const file of pages) {
    const page = await context.newPage();
    await page.goto(base + file, { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const slug = `${path.basename(file, '.html')}-${target.name}`;
    await page.screenshot({ path: path.join(out, `${slug}-top.png`) });
    await page.screenshot({ path: path.join(out, `${slug}-full.png`), fullPage: true });
    const info = await page.evaluate(() => {
      const bar = document.querySelector('.feature-phone-softkeys');
      const shown = !!bar && getComputedStyle(bar).display !== 'none' && bar.offsetHeight > 0;
      return {
        innerWidth: window.innerWidth, screenWidth: window.screen.width,
        softkeyBarVisible: shown,
        htmlFontSize: getComputedStyle(document.documentElement).fontSize,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        textLength: document.body.innerText.trim().length,
      };
    });
    report.push({ page: file, device: target.name, ...info });
    await page.close();
  }
  await context.close();
}
// ---- Legacy page: sign in and show the account's data, with the API mocked ----
const fakeApi = async (route) => {
  const url = new URL(route.request().url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.pathname.endsWith('/auth/login')) return json({ token: 'test-token', userId: 7, name: 'Asha', email: 'asha@example.com' });
  if (url.pathname.includes('/categories/user/')) return json([{ id: 1, name: 'Food & Dining' }, { id: 2, name: 'Transport' }]);
  if (url.pathname.includes('/expenses/user/')) return json([
    { id: 11, amount: 450.5, description: 'Lunch <b>bold</b>', expenseDate: '2026-11-17', categoryId: 1, categoryName: 'Food & Dining' },
    { id: 12, amount: 120, description: 'Metro', expenseDate: '2026-11-16', categoryId: 2, categoryName: 'Transport' },
  ]);
  if (url.pathname.includes('/incomes/user/')) return json([{ id: 21, amount: 50000, source: 'Salary', incomeDate: '2026-11-01', kind: 'SALARY' }]);
  return json({ status: 'UP' });
};
{
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  await context.route('**/api/**', fakeApi);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.dismiss());
  await page.goto(base + 'legacy-mobile.html', { waitUntil: 'load' });
  await page.click('#btnAccount');
  await page.screenshot({ path: path.join(out, 'legacy-login-pixel7.png') });
  await page.fill('#loginEmail', 'asha@example.com');
  await page.fill('#loginPassword', 'secret');
  await page.click('#btnSubmitLogin');
  await page.waitForSelector('.tx-item');
  await page.screenshot({ path: path.join(out, 'legacy-signedin-pixel7.png') });
  const result = await page.evaluate(() => ({
    accountText: document.getElementById('accountText').innerText,
    rows: document.querySelectorAll('.tx-item').length,
    net: document.getElementById('netBalanceVal').innerText,
    htmlInjected: document.querySelectorAll('.tx-title b').length,
    firstTitle: document.querySelector('.tx-title').innerText,
    expenseCategories: Array.from(document.querySelectorAll('#expCategory option')).map((o) => o.value + ':' + o.text),
    storedRecords: window.localStorage.getItem('et_mobile_records_v1'),
  }));
  report.push({ page: 'legacy-mobile.html', scenario: 'signed-in (mocked API)', pageErrors: errors, ...result });
  await context.close();
}

await browser.close();
server.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
