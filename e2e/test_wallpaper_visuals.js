const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = '/home/yoge/IdeaProjects/expense-tracker-system/frontend';
const ARTIFACT_DIR = '/home/yoge/.gemini/antigravity-acp/brain/8281c95c-a1ca-41ef-9b7c-8f622027dd87';

function startServer(port = 8099) {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/dashboard.html';
    const filePath = path.join(FRONTEND_DIR, reqPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const types = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function run() {
  const server = await startServer(8099);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();

  // Mock API requests so dashboard loads populated data
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/users/1') || url.includes('/users/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, name: 'Alex Vance', email: 'alex@example.com', role: 'ROLE_USER' })
      });
    }
    if (url.includes('/expenses') || url.includes('/transactions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
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
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, categoryName: 'Food & Dining', limitAmount: 15000, spentAmount: 8200 },
          { id: 2, categoryName: 'Transportation', limitAmount: 5000, spentAmount: 2100 },
          { id: 3, categoryName: 'Software & Cloud', limitAmount: 10000, spentAmount: 7400 }
        ])
      });
    }
    if (url.includes('/subscriptions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 1, name: 'Netflix 4K', amount: 649, billingCycle: 'MONTHLY', categoryName: 'Entertainment', nextBillingDate: '2026-11-20' },
          { id: 2, name: 'Spotify Duo', amount: 149, billingCycle: 'MONTHLY', categoryName: 'Entertainment', nextBillingDate: '2026-11-25' }
        ])
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  // Set initial auth tokens
  await page.goto('http://localhost:8099/dashboard.html');
  await page.evaluate(() => {
    localStorage.setItem('token', 'mock-jwt-token-12345');
    localStorage.setItem('userId', '1');
    localStorage.setItem('userName', 'Alex Vance');
    localStorage.setItem('theme', 'dark');
  });

  await page.reload();
  await page.waitForTimeout(1000);

  // Take screenshot of default theme
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_test_default.png'), fullPage: false });

  // Now create a rich 3-color gradient wallpaper (Sunset / Horizon) and apply it via WebStudio or localStorage
  const sunsetWallpaperData = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const ctx = c.getContext('2d');
    // Vivid Sunset: deep blue-violet sky (#1E1B4B) -> fiery crimson/coral (#E11D48) -> radiant amber (#F59E0B) -> emerald coastline (#10B981)
    const g = ctx.createLinearGradient(0, 0, 400, 300);
    g.addColorStop(0, '#1E1B4B');
    g.addColorStop(0.35, '#E11D48');
    g.addColorStop(0.70, '#F59E0B');
    g.addColorStop(1, '#10B981');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg', 0.9);
  });

  // Open Web Studio and process wallpaper
  await page.evaluate(async (uri) => {
    if (window.WebStudio && window.WebStudio.cropAndExtractWallpaper) {
      await window.WebStudio.cropAndExtractWallpaper(uri);
    }
  }, sunsetWallpaperData);

  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_test_wallpaper_dark.png'), fullPage: false });

  // Analyze element colors across the dashboard
  const colorReport = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const vars = {
      primary: rootStyle.getPropertyValue('--primary').trim(),
      accent: rootStyle.getPropertyValue('--accent').trim(),
      highlight: rootStyle.getPropertyValue('--highlight').trim(),
      palette1: rootStyle.getPropertyValue('--palette-1').trim(),
      palette2: rootStyle.getPropertyValue('--palette-2').trim(),
      palette3: rootStyle.getPropertyValue('--palette-3').trim(),
      palette4: rootStyle.getPropertyValue('--palette-4').trim(),
      palette5: rootStyle.getPropertyValue('--palette-5').trim(),
      palette6: rootStyle.getPropertyValue('--palette-6').trim(),
      palette7: rootStyle.getPropertyValue('--palette-7').trim(),
      palette8: rootStyle.getPropertyValue('--palette-8').trim(),
      cardBg: rootStyle.getPropertyValue('--card-bg').trim(),
      border: rootStyle.getPropertyValue('--border').trim(),
      borderAccent: rootStyle.getPropertyValue('--border-accent').trim(),
    };

    // Collect computed colors of key UI components
    const elementsToInspect = [
      { name: 'TopBar Title / Brand', el: document.querySelector('.top-bar h1, .brand-text') },
      { name: 'Add Expense Button', el: document.querySelector('#addExpenseBtn, .add-expense-button') },
      { name: 'Web Studio Button', el: document.querySelector('#webStudioBtn') },
      { name: 'Inflow Metric Card', el: document.querySelector('#metricCardInflow') },
      { name: 'Outflow Metric Card', el: document.querySelector('#metricCardOutflow') },
      { name: 'Netflow Metric Card', el: document.querySelector('#metricCardNetflow') },
      { name: 'Savings Metric Card', el: document.querySelector('#metricCardSavings') },
      { name: 'Subs Metric Card', el: document.querySelector('#metricCardSubs') },
      { name: 'Money Flow Panel', el: document.querySelector('#moneyFlowPanel') },
      { name: 'Insights Panel', el: document.querySelector('#insightsPanel') },
      { name: 'First Budget Bar', el: document.querySelector('.budget-progress-bar, .progress-fill') },
      { name: 'Transaction Table Header', el: document.querySelector('#unifiedLedgerCard th') }
    ];

    const inspected = elementsToInspect.map(item => {
      if (!item.el) return { name: item.name, found: false };
      const cs = getComputedStyle(item.el);
      return {
        name: item.name,
        found: true,
        color: cs.color,
        background: cs.backgroundColor || cs.backgroundImage,
        borderColor: cs.borderColor,
        borderLeftColor: cs.borderLeftColor
      };
    });

    return { vars, inspected };
  });

  console.log('--- COLOR REPORT ---');
  console.log(JSON.stringify(colorReport, null, 2));

  // Also switch to light mode and take screenshot
  await page.evaluate(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    if (window.WebStudio && window.WebStudio.syncUiControls) {
      window.WebStudio.syncUiControls();
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'dashboard_test_wallpaper_light.png'), fullPage: false });

  await browser.close();
  server.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
