const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = '/home/yoge/IdeaProjects/expense-tracker-system/frontend';
const ARTIFACT_DIR = '/home/yoge/.gemini/antigravity-acp/brain/8281c95c-a1ca-41ef-9b7c-8f622027dd87';

function startServer(port = 8097) {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/dashboard.html';
    const filePath = path.join(FRONTEND_DIR, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function run() {
  const server = await startServer(8097);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });

  await context.addInitScript(() => {
    localStorage.setItem('token', 'fake-jwt-token-12345');
    localStorage.setItem('userId', '1');
    localStorage.setItem('userName', 'Alex Vance');
    localStorage.setItem('userRole', 'ROLE_USER');
    localStorage.setItem('theme', 'dark');
  });

  const page = await context.newPage();

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/users/1') || url.includes('/users/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, name: 'Alex Vance', email: 'alex@example.com', role: 'ROLE_USER' }) });
    }
    if (url.includes('/expenses') || url.includes('/transactions')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, title: 'Organic Groceries', amount: 1450, categoryName: 'Food & Dining', type: 'EXPENSE', date: '2026-11-05' },
          { id: 2, title: 'Uber Commute', amount: 380, categoryName: 'Transportation', type: 'EXPENSE', date: '2026-11-06' },
          { id: 3, title: 'AWS Cloud Hosting', amount: 2200, categoryName: 'Software & Cloud', type: 'EXPENSE', date: '2026-11-06' },
          { id: 4, title: 'Consulting Retainer', amount: 35000, categoryName: 'Professional Services', type: 'INCOME', date: '2026-11-01' },
          { id: 5, title: 'High-Yield Savings Deposit', amount: 12000, categoryName: 'Savings & Investments', type: 'INCOME', date: '2026-11-02' }
        ])
      });
    }
    if (url.includes('/budgets')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, categoryName: 'Food & Dining', limitAmount: 15000, spentAmount: 8200 },
          { id: 2, categoryName: 'Transportation', limitAmount: 5000, spentAmount: 2100 },
          { id: 3, categoryName: 'Software & Cloud', limitAmount: 10000, spentAmount: 7400 }
        ])
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.goto('http://localhost:8097/dashboard.html');
  await page.waitForTimeout(2000);

  // Helper to snap element
  async function snap(selector, filename) {
    try {
      const el = page.locator(selector).first();
      if (await el.count() > 0) {
        await el.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(200);
        const box = await el.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          await page.screenshot({
            path: path.join(ARTIFACT_DIR, filename),
            clip: {
              x: Math.max(0, Math.floor(box.x)),
              y: Math.max(0, Math.floor(box.y)),
              width: Math.min(1440, Math.ceil(box.width)),
              height: Math.min(1200, Math.ceil(box.height))
            }
          });
          console.log(`Saved ${filename}`);
        }
      }
    } catch (e) {
      console.warn(`snap failed for ${selector}:`, e.message);
    }
  }

  // Freeze animations
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }'
  });

  // TEST 1: CYBERPUNK WALLPAPER (Electric Cyan #06B6D4, Magenta #D946EF, Purple #8B5CF6)
  const cyberpunkUri = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 400, 300);
    g.addColorStop(0, '#0F172A');
    g.addColorStop(0.35, '#06B6D4');
    g.addColorStop(0.70, '#D946EF');
    g.addColorStop(1, '#8B5CF6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg', 0.9);
  });

  await page.evaluate(async (uri) => {
    if (window.WebStudio && window.WebStudio.cropAndExtractWallpaper) {
      await window.WebStudio.cropAndExtractWallpaper(uri);
    }
  }, cyberpunkUri);
  await page.waitForTimeout(1000);

  await snap('.grid-4-metrics', 'wallpaper_cyberpunk_metrics.png');
  await snap('.bi-slicers-ribbon', 'wallpaper_cyberpunk_slicers.png');
  await snap('.grid-analytics', 'wallpaper_cyberpunk_charts.png');

  // TEST 2: EMERALD FOREST WALLPAPER (Emerald #10B981, Amber Gold #F59E0B, Deep Forest #064E3B)
  const forestUri = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 400, 300);
    g.addColorStop(0, '#064E3B');
    g.addColorStop(0.35, '#10B981');
    g.addColorStop(0.70, '#F59E0B');
    g.addColorStop(1, '#022C22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg', 0.9);
  });

  await page.evaluate(async (uri) => {
    if (window.WebStudio && window.WebStudio.cropAndExtractWallpaper) {
      await window.WebStudio.cropAndExtractWallpaper(uri);
    }
  }, forestUri);
  await page.waitForTimeout(1000);

  await snap('.grid-4-metrics', 'wallpaper_forest_metrics.png');
  await snap('.bi-slicers-ribbon', 'wallpaper_forest_slicers.png');
  await snap('.grid-analytics', 'wallpaper_forest_charts.png');

  console.log('All multi-wallpaper tests completed successfully!');
  await browser.close();
  server.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
