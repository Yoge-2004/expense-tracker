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
await browser.close();
server.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
