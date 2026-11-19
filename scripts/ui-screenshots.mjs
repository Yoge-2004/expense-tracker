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

// ---- Other pages: plain pages, then the signed-in dashboard and admin with a mocked API ----
const smallApi = async (route) => {
  const url = new URL(route.request().url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const p = url.pathname;
  if (p.includes('/admin/permissions') || p.endsWith('/permissions')) return json({ role: 'ROLE_ADMIN', canManageUsers: true, canViewAudit: true, canManageSystem: true });
  if (p.includes('/categories/user/')) return json([{ id: 1, name: 'Food & Dining' }, { id: 2, name: 'Transport' }]);
  if (p.includes('/expenses/user/') && !p.includes('/export')) return json([
    { id: 11, amount: 450.5, description: 'Lunch', expenseDate: '2026-11-17', categoryId: 1, categoryName: 'Food & Dining' },
    { id: 12, amount: 120, description: 'Metro', expenseDate: '2026-11-16', categoryId: 2, categoryName: 'Transport' }]);
  if (p.includes('/incomes/user/') && !p.includes('/export')) return json([{ id: 21, amount: 50000, source: 'Salary', incomeDate: '2026-11-01' }]);
  if (p.includes('/users/') || p.includes('/profile')) return json({ id: 7, name: 'Asha', email: 'asha@example.com', username: 'asha', currency: 'INR', role: 'ROLE_ADMIN' });
  if (p.includes('/user/') || p.endsWith('s')) return json([]);
  return json({});
};
async function audit(label, file, device, opts = {}) {
  const context = await browser.newContext({ ...device });
  if (opts.signedIn) {
    await context.addInitScript(() => {
      localStorage.setItem('token', 'test-token'); localStorage.setItem('userId', '7'); localStorage.setItem('userName', 'Asha');
      localStorage.setItem('userEmail', 'asha@example.com'); localStorage.setItem('userRole', 'ROLE_ADMIN'); localStorage.setItem('userCurrency', 'INR');
    });
    await context.route('**/api/**', smallApi);
  }
  const page = await context.newPage();
  const errors = []; const failed = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  page.on('requestfailed', (r) => failed.push(r.url().replace(base, '/').slice(0, 90)));
  await page.goto(base + file, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `${label}-top.png`) });
  await page.screenshot({ path: path.join(out, `${label}-full.png`), fullPage: true });
  const m = await page.evaluate(() => {
    const w = window.innerWidth;
    const wide = Array.from(document.querySelectorAll('body *')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > w + 2 && getComputedStyle(el).position !== 'fixed'; }).slice(0, 4).map((el) => (el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : el.tagName));
    const taps = Array.from(document.querySelectorAll('button, a, input, select')).filter((el) => { const r = el.getBoundingClientRect(); const v = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; return v && (r.height < 32 || r.width < 32) && !(el.tagName === 'INPUT' && ['checkbox', 'radio', 'hidden'].includes(el.type)); }).length;
    let smallest = 99; document.querySelectorAll('body *').forEach((el) => { if (el.childNodes.length && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) { const f = parseFloat(getComputedStyle(el).fontSize); if (f && f < smallest) smallest = f; } });
    const smallList = {};
    document.querySelectorAll('button, a, input, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0) || getComputedStyle(el).visibility === 'hidden') return;
      if (el.tagName === 'INPUT' && ['checkbox', 'radio', 'hidden'].includes(el.type)) return;
      if (r.height >= 32 && r.width >= 32) return;
      const key = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') + (el.id ? '#' + el.id : '');
      smallList[key] = smallList[key] || { count: 0, size: Math.round(r.width) + 'x' + Math.round(r.height) };
      smallList[key].count += 1;
    });
    const fixed = Array.from(document.querySelectorAll('body *')).filter((el) => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().width > 0).map((el) => { const r = el.getBoundingClientRect(); return (el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]) + ' ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); });
    return { smallTargets: Object.entries(smallList).sort((a, b) => b[1].count - a[1].count).slice(0, 14).map(([k, v]) => k + ' ' + v.size + ' x' + v.count), fixedElements: fixed.slice(0, 8), url: location.pathname, overflowX: document.documentElement.scrollWidth > w + 1, widest: wide, tapTargetsUnder32px: taps, smallestFontPx: smallest, textLength: document.body.innerText.trim().length, height: document.documentElement.scrollHeight };
  });
  report.push({ audit: label, errors: errors.slice(0, 6), errorCount: errors.length, failedRequests: failed.slice(0, 4), ...m });
  await context.close();
}
await audit('register-pixel7', 'register.html', devices['Pixel 7']);
await audit('forgot-pixel7', 'forgot-password.html', devices['Pixel 7']);
await audit('dashboard-pixel7', 'dashboard.html', devices['Pixel 7'], { signedIn: true });
await audit('dashboard-phone360', 'dashboard.html', { ...devices['Pixel 5'], viewport: { width: 360, height: 780 } }, { signedIn: true });
await audit('admin-pixel7', 'admin.html', devices['Pixel 7'], { signedIn: true });

await browser.close();
server.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
