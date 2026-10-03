#!/usr/bin/env node
/**
 * Renders the real web app in headless Chromium against a MOCKED API and writes
 * screenshots. Two uses:
 *
 *   1. Regenerate the README images:   node scripts/capture-screenshots.mjs --out docs/images/website
 *   2. Visual regression for CSS work: node scripts/capture-screenshots.mjs --stable --out /tmp/before
 *                                      ... change CSS ...
 *                                      node scripts/capture-screenshots.mjs --stable --out /tmp/after
 *      then compare the two folders (scripts/compare-screenshots.mjs).
 *
 * Why this exists: the old one-off recapture script force-opened modals by adding a
 * CSS class, bypassing the real open functions, so screenshots showed "Loading..."
 * and empty iframes. This script drives the real UI (clicks the real buttons), so
 * what it captures is what a user sees.
 *
 * Requirements:  npm i puppeteer-core   and a Chromium:  CHROME_PATH=/path/to/chrome
 * Fonts / Chart.js are normally CDN-loaded; if FONT_DIR / CHARTJS_PATH are set they are
 * served locally instead (needed on machines without internet access).
 *
 * Options: --out <dir>  --stable (freeze animation + ambient layers, for pixel diffs)
 *          --only a,b   (shot names)  --dpr <n> (default 1.5)  --full (full-page shots)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const frontendDir = path.join(root, 'frontend');

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[i + 1]) : dflt; };
const OUT = path.resolve(opt('out', path.join(root, 'docs/images/website')));
const STABLE = args.includes('--stable');
const FULL = args.includes('--full');
const DPR = Number(opt('dpr', 1.5));
const ONLY = (opt('only', '') || '').split(',').filter(Boolean);
const EVAL = opt('eval', '');
const INIT = opt('init', '');   // debugging aid: JS run before any page script (on every new document)   // debugging aid: JS expression evaluated in the page after load, result printed
const CHROME = process.env.CHROME_PATH;
const FONT_DIR = process.env.FONT_DIR;          // dir containing the *.woff2 files (optional)
const CHARTJS = process.env.CHARTJS_PATH;       // path to chart.umd.js (optional)
if (!CHROME) { console.error('Set CHROME_PATH to a Chromium/Chrome executable.'); process.exit(1); }

// ---------------------------------------------------------------- mock data
const TODAY = new Date('2026-09-18T10:30:00+05:30');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(20260918);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Utilities', 'Health', 'Rent', 'Education', 'Travel', 'Subscriptions']
  .map((name, i) => ({ id: i + 1, name }));
const catId = (n) => CATEGORIES.find((c) => c.name === n).id;

const SPEND = {
  Food: [['Swiggy order', 240, 620], ['BigBasket groceries', 900, 2600], ['Cafe Coffee Day', 180, 420], ['Zomato dinner', 380, 980]],
  Transport: [['Uber ride', 120, 480], ['Metro recharge', 300, 600], ['Petrol', 800, 1900]],
  Shopping: [['Amazon purchase', 450, 3800], ['Myntra order', 900, 3200], ['Decathlon', 700, 2400]],
  Entertainment: [['BookMyShow tickets', 400, 900], ['Steam game', 500, 1800]],
  Utilities: [['Electricity bill', 1100, 2300], ['Broadband bill', 799, 999], ['Mobile recharge', 299, 749]],
  Health: [['Apollo Pharmacy', 220, 1400], ['Dental checkup', 800, 2200]],
  Education: [['Udemy course', 449, 1299], ['Technical books', 600, 2100]],
  Travel: [['IRCTC train ticket', 650, 2400], ['Hotel booking', 2800, 6200]],
};
const RECURRING = [
  { d: 'Rent', a: 18000, c: 'Rent', day: 1 },
  { d: 'Netflix subscription', a: 649, c: 'Subscriptions', day: 5 },
  { d: 'Spotify Premium', a: 119, c: 'Subscriptions', day: 9 },
  { d: 'Gym membership', a: 1500, c: 'Health', day: 3 },
];

const expenses = [];
let eid = 1;
const monthStarts = [];
for (let m = 3; m <= 8; m++) monthStarts.push(new Date(2026, m, 1)); // Apr..Sep
for (const ms of monthStarts) {
  const isCurrent = ms.getMonth() === TODAY.getMonth();
  const lastDay = isCurrent ? TODAY.getDate() : new Date(ms.getFullYear(), ms.getMonth() + 1, 0).getDate();
  for (const r of RECURRING) {
    if (r.day > lastDay) continue;
    const d = new Date(ms.getFullYear(), ms.getMonth(), r.day);
    expenses.push({ id: eid++, amount: r.a, description: r.d, expenseDate: iso(d), categoryId: catId(r.c), categoryName: r.c,
      frequency: 'MONTHLY', intervalDays: null, isRecurring: true, recurring: true,
      nextDueDate: iso(new Date(d.getFullYear(), d.getMonth() + 1, r.day)), createdAt: `${iso(d)}T09:00:00` });
  }
  const n = isCurrent ? 13 : 15;
  for (let i = 0; i < n; i++) {
    const cat = pick(Object.keys(SPEND));
    const [desc, lo, hi] = pick(SPEND[cat]);
    const day = 1 + Math.floor(rand() * lastDay);
    const d = new Date(ms.getFullYear(), ms.getMonth(), day);
    expenses.push({ id: eid++, amount: Math.round(lo + rand() * (hi - lo)), description: desc, expenseDate: iso(d),
      categoryId: catId(cat), categoryName: cat, frequency: null, intervalDays: null, isRecurring: false, recurring: false,
      createdAt: `${iso(d)}T${String(8 + Math.floor(rand() * 12)).padStart(2, '0')}:15:00` });
  }
}
expenses.sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));

const incomes = [];
let iid = 1;
for (const ms of monthStarts) {
  const d = new Date(ms.getFullYear(), ms.getMonth(), 1);
  incomes.push({ id: iid++, amount: 85000, source: 'Tech Corp Salary', description: 'Monthly remuneration', incomeDate: iso(d), isRecurring: true, recurring: true,
    frequency: 'MONTHLY', intervalDays: null, nextDueDate: iso(new Date(d.getFullYear(), d.getMonth() + 1, 1)), createdAt: `${iso(d)}T09:00:00` });
  if (ms.getMonth() % 2 === 0) incomes.push({ id: iid++, amount: 12000, source: 'Freelance design work', description: 'Landing page project', incomeDate: iso(new Date(ms.getFullYear(), ms.getMonth(), 14)), isRecurring: false, recurring: false, createdAt: `${iso(d)}T09:00:00` });
}
incomes.sort((a, b) => (a.incomeDate < b.incomeDate ? 1 : -1));

const monthSpent = (cat) => expenses.filter((e) => e.categoryName === cat && e.expenseDate.startsWith('2026-09')).reduce((s, e) => s + e.amount, 0);
const BUDGETS = [['Food', 8000], ['Transport', 4000], ['Shopping', 6000], ['Entertainment', 2500]];
const budgets = BUDGETS.map(([c, l], i) => ({ id: i + 1, categoryId: catId(c), limitAmount: l, limit: l, period: 'MONTHLY', intervalDays: null, startDate: null, endDate: null }));
const budgetStatus = BUDGETS.map(([c, l], i) => { const s = monthSpent(c); return { budgetId: i + 1, categoryId: catId(c), categoryName: c, limit: l, spent: s, percentage: Math.round((s / l) * 1000) / 10, period: 'MONTHLY', intervalDays: null, startDate: '2026-09-01', endDate: '2026-09-30' }; });
const goals = [
  { id: 1, name: 'Emergency Fund', targetAmount: 150000, currentAmount: 82000, targetDate: '2026-12-31', status: 'IN_PROGRESS', isRecurring: true, recurringAmount: 5000, frequency: 'MONTHLY', intervalDays: null, nextDueDate: '2026-10-01', endDate: null },
  { id: 2, name: 'Goa Trip', targetAmount: 60000, currentAmount: 21500, targetDate: '2027-03-15', status: 'IN_PROGRESS', isRecurring: false, recurringAmount: null, frequency: null, intervalDays: null, nextDueDate: null, endDate: null },
  { id: 3, name: 'New Laptop', targetAmount: 90000, currentAmount: 90000, targetDate: '2026-08-30', status: 'COMPLETED', isRecurring: false, recurringAmount: null, frequency: null, intervalDays: null, nextDueDate: null, endDate: null },
].map((g) => ({ ...g, progressPercentage: Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 1000) / 10) }));
const profile = { id: 1, name: 'Priya Raman', username: 'priya.raman', email: 'priya.raman@example.com', currency: 'INR', hasSecurityPin: true, enabled: true };

function route(method, p) {
  p = p.replace(/\?.*$/, '');
  if (/\/health$/.test(p)) return { status: 'UP', database: 'UP' };
  if (/\/users\/1$/.test(p)) return profile;
  if (/\/expenses\/recurring\/user\/1$/.test(p)) return expenses.filter((e) => e.isRecurring).filter((e) => e.expenseDate.startsWith('2026-09'));
  if (/\/expenses\/budget\/status\/user\/1$/.test(p)) return budgetStatus;
  if (/\/expenses\/budget\/user\/1$/.test(p)) return budgets;
  if (/\/expenses\/user\/1/.test(p)) return expenses;
  if (/\/incomes\/user\/1/.test(p)) return incomes;
  if (/\/categories/.test(p)) return CATEGORIES;
  if (/\/savings\/goals\/user\/1/.test(p)) return goals;
  return null;
}

// ---------------------------------------------------------------- static server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = u.startsWith('/__fonts/') && FONT_DIR ? path.join(FONT_DIR, path.basename(u)) : path.join(frontendDir, u === '/' ? 'index.html' : u);
  if (!file.startsWith(frontendDir) && !(FONT_DIR && file.startsWith(FONT_DIR))) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }).end(buf);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}`;

// ---------------------------------------------------------------- browser
const FONT_CSS = FONT_DIR ? `
@font-face{font-family:'Hanken Grotesk';font-weight:400;src:url(${BASE}/__fonts/hanken-grotesk-latin-400-normal.woff2)}
@font-face{font-family:'Hanken Grotesk';font-weight:500;src:url(${BASE}/__fonts/hanken-grotesk-latin-500-normal.woff2)}
@font-face{font-family:'Hanken Grotesk';font-weight:600;src:url(${BASE}/__fonts/hanken-grotesk-latin-600-normal.woff2)}
@font-face{font-family:'Hanken Grotesk';font-weight:700;src:url(${BASE}/__fonts/hanken-grotesk-latin-700-normal.woff2)}
@font-face{font-family:'Hanken Grotesk';font-weight:800;src:url(${BASE}/__fonts/hanken-grotesk-latin-800-normal.woff2)}
@font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(${BASE}/__fonts/ibm-plex-mono-latin-400-normal.woff2)}
@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(${BASE}/__fonts/ibm-plex-mono-latin-500-normal.woff2)}
@font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(${BASE}/__fonts/ibm-plex-mono-latin-600-normal.woff2)}
@font-face{font-family:'Fraunces';font-weight:300 700;src:url(${BASE}/__fonts/fraunces-latin-opsz-normal.woff2)}
` : '';

const STABLE_CSS = `
*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}
[data-reveal],.reveal,.is-hidden-until-revealed{opacity:1!important;transform:none!important;filter:none!important}
canvas#aurora-canvas,canvas.animated-bg,.ambient-layer,.grain-overlay,.mesh-wash,.dust-mote,.light-ray-sweep,.hero-orb{display:none!important}
`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none', '--force-color-profile=srgb'] });
const unknown = new Set();

async function newPage({ width = 1440, height = 900, theme = 'dark', auth = true, mobile = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: DPR, isMobile: mobile, hasTouch: mobile });
  await page.emulateTimezone('Asia/Kolkata');
  if (STABLE) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluateOnNewDocument((fixed, theme, auth) => {
    const RealDate = Date, start = RealDate.now();
    class MockDate extends RealDate {
      constructor(...a) { if (a.length === 0) super(fixed + (RealDate.now() - start)); else super(...a); }
      static now() { return fixed + (RealDate.now() - start); }
    }
    window.Date = MockDate;
    try {
      localStorage.setItem('theme', theme);
      if (auth) { localStorage.setItem('token', 'demo-token'); localStorage.setItem('userId', '1'); localStorage.setItem('userName', 'Priya Raman'); localStorage.setItem('userEmail', 'priya.raman@example.com'); localStorage.setItem('currency', 'INR'); localStorage.setItem('hasSeenHelp', 'true'); localStorage.setItem('helpGuideSeen', 'true'); }
    } catch (e) { /* ignore */ }
  }, TODAY.getTime(), theme, auth);
  if (INIT && INIT !== true) await page.evaluateOnNewDocument(INIT);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    const u = new URL(url);
    if (u.origin === BASE) return req.continue();
    if (/localhost:8080\/api/.test(url) || /hf\.space\/api/.test(url)) {
      const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors });
      const body = route(req.method(), u.pathname);
      if (body === null) { unknown.add(`${req.method()} ${u.pathname}`); return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: '[]' }); }
      return req.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    }
    if (u.hostname === 'fonts.googleapis.com') return req.respond({ status: 200, contentType: 'text/css', body: FONT_CSS });
    if (u.hostname === 'cdn.jsdelivr.net' && /chart\.js/.test(u.pathname) && CHARTJS) return req.respond({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(CHARTJS) });
    if (u.hostname === 'ipapi.co') return req.respond({ status: 200, contentType: 'text/plain', body: 'INR' });
    return req.abort();     // fonts.gstatic, Google sign-in, Tesseract, images: not needed
  });
  if (STABLE) page.on('domcontentloaded', () => page.addStyleTag({ content: STABLE_CSS }).catch(() => {}));
  page.on('pageerror', (e) => console.warn('  [pageerror]', e.message.split('\n')[0]));
  return page;
}

const settle = async (page, ms = 1800) => { await page.evaluate(() => document.fonts && document.fonts.ready); await new Promise((r) => setTimeout(r, ms)); };
async function scrollThrough(page) {
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
}
async function click(page, sel) { await page.waitForSelector(sel, { visible: true, timeout: 8000 }); await page.click(sel); await new Promise((r) => setTimeout(r, 700)); }

// ---------------------------------------------------------------- shots
const shots = [
  { name: 'auth-login', page: { auth: false }, url: '/index.html' },
  { name: 'auth-register', page: { auth: false }, url: '/register.html' },
  { name: 'forgot-password', page: { auth: false }, url: '/forgot-password.html' },
  { name: 'dashboard', url: '/dashboard.html', full: true, scroll: true },
  { name: 'dashboard-light', page: { theme: 'light' }, url: '/dashboard.html', full: true, scroll: true },
  { name: 'dashboard-mobile', page: { width: 390, height: 844, mobile: true }, url: '/dashboard.html', full: true, scroll: true },
  { name: 'add-expense', url: '/dashboard.html', act: (p) => click(p, '#openModalBtn') },
  { name: 'add-income', url: '/dashboard.html', act: (p) => click(p, '#openIncomeModalBtn') },
  { name: 'budgets', url: '/dashboard.html', act: (p) => click(p, '#addBudgetBtn') },
  { name: 'savings-goals', url: '/dashboard.html', act: (p) => click(p, '#addGoalBtn') },
  { name: 'report-period', url: '/dashboard.html', act: async (p) => { await p.evaluate(() => openMonthlyReportPeriodModal('view')); await new Promise((r) => setTimeout(r, 800)); } },
];

fs.mkdirSync(OUT, { recursive: true });
let failures = 0;
for (const s of shots) {
  if (ONLY.length && !ONLY.includes(s.name)) continue;
  const page = await newPage(s.page);
  try {
    await page.goto(BASE + s.url, { waitUntil: 'load', timeout: 30000 });
    await settle(page);
    if (s.scroll && !STABLE) await scrollThrough(page);
    if (s.act) await s.act(page);
    if (EVAL && EVAL !== true) console.log('eval ->', JSON.stringify(await page.evaluate(EVAL), null, 1));
    await settle(page, STABLE ? 400 : 1200);
    await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: !!(s.full && (FULL || STABLE || s.full)) });
    console.log('captured', s.name);
  } catch (e) { failures++; console.error('FAILED', s.name, '-', e.message.split('\n')[0]); }
  await page.close();
}
if (unknown.size) console.log('\nUnmocked API calls (answered with []):\n  ' + [...unknown].join('\n  '));
await browser.close(); server.close();
process.exit(failures ? 1 : 0);
