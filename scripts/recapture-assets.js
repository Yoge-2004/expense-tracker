const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9235;
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'images');

// Complete mock financial data
const mockExpenses = [
  { id: 1, description: "Whole Foods Organic Groceries", amount: 3450.00, expenseDate: "2026-09-24", categoryId: 1, categoryName: "Food & Dining", isRecurring: false },
  { id: 2, description: "High-Speed Fiber Internet & 5G", amount: 1899.00, expenseDate: "2026-09-22", categoryId: 6, categoryName: "Utilities & Services", isRecurring: true },
  { id: 3, description: "Metro Transit & Ride Commute", amount: 640.00, expenseDate: "2026-09-21", categoryId: 2, categoryName: "Transportation", isRecurring: false },
  { id: 4, description: "Mechanical Keyboard & Workspace Hub", amount: 8200.00, expenseDate: "2026-09-19", categoryId: 3, categoryName: "Shopping & Retail", isRecurring: false },
  { id: 5, description: "Weekend Artisanal Coffee & Dining", amount: 1250.00, expenseDate: "2026-09-18", categoryId: 1, categoryName: "Food & Dining", isRecurring: false },
  { id: 6, description: "Cloud Infrastructure & Domain VPS", amount: 2400.00, expenseDate: "2026-09-15", categoryId: 6, categoryName: "Utilities & Services", isRecurring: true },
  { id: 7, description: "Annual Health Checkup & Dental Clinic", amount: 4500.00, expenseDate: "2026-09-12", categoryId: 5, categoryName: "Healthcare & Medical", isRecurring: false },
  { id: 8, description: "Streaming Entertainment & Hi-Fi Audio", amount: 999.00, expenseDate: "2026-09-10", categoryId: 4, categoryName: "Entertainment & Recreation", isRecurring: true }
];

const mockBudgets = [
  { budgetId: 1, categoryId: 1, categoryName: "Food & Dining", limit: 15000.00, spent: 4700.00, percentage: 31.3, status: "NORMAL" },
  { budgetId: 2, categoryId: 3, categoryName: "Shopping & Retail", limit: 12000.00, spent: 8200.00, percentage: 68.3, status: "WARNING" },
  { budgetId: 3, categoryId: 6, categoryName: "Utilities & Services", limit: 8000.00, spent: 4299.00, percentage: 53.7, status: "NORMAL" },
  { budgetId: 4, categoryId: 2, categoryName: "Transportation", limit: 5000.00, spent: 640.00, percentage: 12.8, status: "NORMAL" }
];

const mockCategories = [
  { id: 1, name: "Food & Dining", emoji: "🍔" },
  { id: 2, name: "Transportation", emoji: "🚗" },
  { id: 3, name: "Shopping & Retail", emoji: "🛍️" },
  { id: 4, name: "Entertainment & Recreation", emoji: "🎬" },
  { id: 5, name: "Healthcare & Medical", emoji: "💊" },
  { id: 6, name: "Utilities & Services", emoji: "💡" },
  { id: 7, name: "Financial Services", emoji: "💳" }
];

const mockIncomes = [
  { id: 1, source: "Principal Engineering Salary", amount: 165000.00, incomeDate: "2026-09-01", isRecurring: true, frequency: "MONTHLY" },
  { id: 2, source: "Cloud Architecture Consulting", amount: 28500.00, incomeDate: "2026-09-15", isRecurring: false }
];

const mockSavings = [
  { id: 1, name: "Emergency Wealth Reserve", targetAmount: 250000.00, currentAmount: 185000.00, targetDate: "2027-01-01", status: "ACTIVE" },
  { id: 2, name: "Next-Gen AI Workstation", targetAmount: 150000.00, currentAmount: 95000.00, targetDate: "2026-12-31", status: "ACTIVE" }
];

const mockSubscriptions = [
  { id: 1, description: "High-Speed Fiber Internet & 5G", amount: 1899.00, frequency: "MONTHLY", intervalDays: 30 },
  { id: 2, description: "Cloud Infrastructure & Domain VPS", amount: 2400.00, frequency: "MONTHLY", intervalDays: 30 },
  { id: 3, description: "Streaming Entertainment & Hi-Fi Audio", amount: 999.00, frequency: "MONTHLY", intervalDays: 30 }
];

function createStaticServer(directory, port) {
  const server = http.createServer((req, res) => {
    let safePath = path.normalize(decodeURI(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '') safePath = '/index.html';
    const filePath = path.join(directory, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ttf': 'font/ttf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2'
      };

      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE'
      });

      fs.createReadStream(filePath).pipe(res);
    });
  });

  server.listen(port);
  return server;
}

async function run() {
  console.log('🚀 Starting Clean Recapture Engine for Modernized Web & Mobile Assets...');

  const webServer = createStaticServer(path.join(__dirname, '..', 'frontend'), 8080);
  const mobileServer = createStaticServer(path.join(__dirname, '..', 'mobile', 'dist'), 8081);
  console.log('✅ Web static server running on port 8080');
  console.log('✅ Mobile static server running on port 8081');

  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=/tmp/chrome-recapture-${Date.now()}`,
    '--no-sandbox',
    '--disable-gpu',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  try {
    const targetRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
    const target = await targetRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let idCounter = 1;
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = idCounter++;
        const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 25000);
        const handler = (e) => {
          const resp = JSON.parse(e.data);
          if (resp.id === msgId) {
            clearTimeout(timeout);
            ws.removeEventListener('message', handler);
            if (resp.error) reject(new Error(resp.error.message));
            else resolve(resp.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    async function captureScreen({ url, outputFile, width = 1440, height = 900, dpr = 2, mobile = false, setupScript, waitMs = 2500, clip }) {
      console.log(`📸 Capturing: ${outputFile}...`);

      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile
      });

      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 1500));

      if (setupScript) {
        await send('Runtime.evaluate', { expression: setupScript });
        await new Promise(r => setTimeout(r, 800));
      }

      await new Promise(r => setTimeout(r, waitMs));

      const screenshotParams = { format: 'png' };
      if (clip) {
        screenshotParams.clip = { ...clip, scale: 1 };
      }

      const ss = await send('Page.captureScreenshot', screenshotParams);
      const absPath = path.join(DOCS_DIR, outputFile);
      fs.writeFileSync(absPath, Buffer.from(ss.data, 'base64'));
      console.log(`   ✅ Saved: ${outputFile} (${(ss.data.length * 0.75 / 1024).toFixed(1)} KB)`);
    }

    const payloadString = JSON.stringify({
      expenses: mockExpenses,
      budgets: mockBudgets,
      categories: mockCategories,
      subscriptions: mockSubscriptions,
      incomes: mockIncomes,
      savingsGoals: mockSavings
    });

    // ─────────────────────────────────────────────────────────────
    // 1. MOBILE SUITE (ZERO CORS / ZERO ERROR / NATIVE FEEL)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 1. Capturing Mobile Suite ---');

    const mobilePreload = `
      const data = ${payloadString};
      localStorage.setItem('auth_token', 'mock-jwt-token');
      localStorage.setItem('fallback_auth_token', 'mock-jwt-token');
      localStorage.setItem('user_id', '1');
      localStorage.setItem('fallback_user_id', '1');
      localStorage.setItem('user_name', 'Yogeswaran');
      localStorage.setItem('fallback_user_name', 'Yogeswaran');
      localStorage.setItem('user_currency', 'INR');
      localStorage.setItem('fallback_user_currency', 'INR');
      localStorage.setItem('app_theme', 'dark');
      localStorage.setItem('fallback_app_theme', 'dark');

      localStorage.setItem('expense_cache_v4_1', JSON.stringify({
        savedAt: Date.now(),
        expenses: data.expenses,
        budgets: data.budgets,
        categories: data.categories,
        subscriptions: data.subscriptions,
        incomes: data.incomes,
        savingsGoals: data.savingsGoals
      }));

      // Override fetch to ensure smooth online responses
      const origFetch = window.fetch;
      window.fetch = async (url, opts) => {
        const u = String(url);
        let res = [];
        if (u.includes('/budget/status')) res = data.budgets;
        else if (u.includes('/categories')) res = data.categories;
        else if (u.includes('/expenses/recurring')) res = data.subscriptions;
        else if (u.includes('/incomes')) res = data.incomes;
        else if (u.includes('/savings/goals')) res = data.savingsGoals;
        else if (u.includes('/expenses/user')) res = data.expenses;
        else if (u.includes('/users/') || u.includes('/profile')) res = { id: 1, name: 'Yogeswaran', currency: 'INR' };

        return new Response(JSON.stringify(res), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };
    `;

    const mobileScriptId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: mobilePreload })).identifier;

    // 1.1 Mobile Dashboard
    await captureScreen({
      url: 'http://localhost:8081/',
      outputFile: 'mobile/dashboard.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      waitMs: 3500
    });

    // 1.2 Mobile Navigation
    await captureScreen({
      url: 'http://localhost:8081/',
      outputFile: 'mobile/navigation.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      waitMs: 1000
    });

    // 1.3 Mobile Landscape
    await captureScreen({
      url: 'http://localhost:8081/',
      outputFile: 'mobile/landscape.png',
      width: 844,
      height: 390,
      dpr: 3,
      mobile: true,
      waitMs: 2500
    });

    // 1.4 Mobile Add Expense Tab
    await captureScreen({
      url: 'http://localhost:8081/',
      outputFile: 'mobile/add-expense.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: `
        const tabs = Array.from(document.querySelectorAll('div[role="tab"]'));
        if (tabs.length >= 2) tabs[1].click();
      `,
      waitMs: 2500
    });

    // 1.5 Mobile Planning / Subs Tab
    await captureScreen({
      url: 'http://localhost:8081/',
      outputFile: 'mobile/planning.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: `
        const tabs = Array.from(document.querySelectorAll('div[role="tab"]'));
        if (tabs.length >= 3) tabs[2].click();
      `,
      waitMs: 2500
    });

    // Remove mobile preload script
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: mobileScriptId });

    // ─────────────────────────────────────────────────────────────
    // 2. WEBSITE SUITE (MODERNIZED UI WITH SMART INTELLIGENCE)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 2. Capturing Modernized Website Suite ---');

    const webPreload = `
      const data = ${payloadString};
      localStorage.setItem('token', 'mock-jwt-yoge-session-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Yogeswaran');
      localStorage.setItem('userEmail', 'yoge@example.com');
      localStorage.setItem('currency', 'INR');
      localStorage.setItem('app_theme', 'dark');

      localStorage.setItem('expenseCache_1', JSON.stringify({
        v: 1,
        savedAt: Date.now(),
        expenses: data.expenses,
        categories: data.categories
      }));

      // Override apiRequest
      window.apiRequest = async (endpoint, options) => {
        const ep = String(endpoint);
        if (ep.includes('/expenses/user/')) return data.expenses;
        if (ep.includes('/expenses/budget/status/user/')) return data.budgets;
        if (ep.includes('/categories/global')) return data.categories.slice(0, 4);
        if (ep.includes('/categories/user/')) return data.categories.slice(4);
        if (ep.includes('/expenses/recurring/user/')) return data.subscriptions;
        if (ep.includes('/incomes/user/')) return data.incomes;
        if (ep.includes('/savings/goals/user/')) return data.savingsGoals;
        if (ep.includes('/users/')) return { id: 1, name: 'Yogeswaran', email: 'yoge@example.com', currency: 'INR' };
        return [];
      };

      // Also override window.fetch
      const origFetch = window.fetch;
      window.fetch = async (url, opts) => {
        const u = String(url);
        let res = [];
        if (u.includes('/budget/status')) res = data.budgets;
        else if (u.includes('/categories/global')) res = data.categories.slice(0, 4);
        else if (u.includes('/categories/user')) res = data.categories.slice(4);
        else if (u.includes('/expenses/recurring')) res = data.subscriptions;
        else if (u.includes('/incomes')) res = data.incomes;
        else if (u.includes('/savings/goals')) res = data.savingsGoals;
        else if (u.includes('/expenses/user')) res = data.expenses;
        else if (u.includes('/users/') || u.includes('/profile')) res = { id: 1, name: 'Yogeswaran', email: 'yoge@example.com', currency: 'INR' };
        else if (u.includes('/health')) res = { status: 'UP' };

        return new Response(JSON.stringify(res), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };
    `;

    const webScriptId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: webPreload })).identifier;

    // 2.1 Full Web Dashboard
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/dashboard.png',
      width: 1440,
      height: 900,
      waitMs: 3500
    });

    // 2.2 Hero Dashboard
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/hero-dashboard.png',
      width: 1600,
      height: 1000,
      waitMs: 3000
    });

    // 2.3 Add Expense Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/add-expense.png',
      width: 1440,
      height: 900,
      setupScript: `
        const m = document.getElementById('expenseModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
          const d = document.getElementById('expenseDesc');
          if (d) d.value = 'Whole Foods Organic Groceries';
          const a = document.getElementById('expenseAmount');
          if (a) a.value = '3450.00';
          const c = document.getElementById('categorySelect');
          if (c) c.value = '1';
        }
      `,
      waitMs: 2000
    });

    // 2.4 Budgets Section
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/budgets.png',
      width: 1440,
      height: 900,
      setupScript: `
        const b = document.querySelector('.budget-section');
        if (b) b.scrollIntoView({ behavior: 'instant', block: 'start' });
      `,
      waitMs: 2000
    });

    // 2.5 Budget Progress
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/budget-progress.png',
      width: 1440,
      height: 900,
      setupScript: `
        const b = document.querySelector('.budget-section');
        if (b) b.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 2.6 Income Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/income.png',
      width: 1440,
      height: 900,
      setupScript: `
        const m = document.getElementById('incomeModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
          const s = document.getElementById('incomeSource');
          if (s) s.value = 'Cloud Architecture Consulting';
          const a = document.getElementById('incomeAmount');
          if (a) a.value = '28500.00';
        }
      `,
      waitMs: 2000
    });

    // 2.7 Income Detail
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/income-detail.png',
      width: 1440,
      height: 900,
      setupScript: `
        window.scrollTo({ top: 220, behavior: 'instant' });
      `,
      waitMs: 2000
    });

    // 2.8 Savings Goals Section
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/savings-goals.png',
      width: 1440,
      height: 900,
      setupScript: `
        const s = document.querySelector('.savings-section');
        if (s) s.scrollIntoView({ behavior: 'instant', block: 'start' });
      `,
      waitMs: 2000
    });

    // 2.9 Savings Detail
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/savings-detail.png',
      width: 1440,
      height: 900,
      setupScript: `
        const s = document.querySelector('.savings-section');
        if (s) s.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 2.10 Recurring Streams Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/recurring.png',
      width: 1440,
      height: 900,
      setupScript: `
        const m = document.getElementById('subsModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
        }
      `,
      waitMs: 2000
    });

    // 2.11 Reports Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/reports.png',
      width: 1440,
      height: 900,
      setupScript: `
        const m = document.getElementById('monthlyReportModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
        }
      `,
      waitMs: 2000
    });

    // 2.12 Report Exports Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/report-exports.png',
      width: 1440,
      height: 900,
      setupScript: `
        const m = document.getElementById('monthlyReportPeriodModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
        }
      `,
      waitMs: 2000
    });

    // 2.13 Responsive Mobile Web View
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/responsive.png',
      width: 412,
      height: 892,
      dpr: 3,
      mobile: true,
      waitMs: 3000
    });

    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: webScriptId });

    // ─────────────────────────────────────────────────────────────
    // 3. COMPOSITE SHOWCASES
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- 3. Rendering Composite Showcases ---');

    async function renderTemplateToImage(htmlContent, outputFile, width = 1500, height = 920) {
      const tempPath = path.join(__dirname, `temp-${Date.now()}.html`);
      fs.writeFileSync(tempPath, htmlContent);
      await captureScreen({
        url: `file://${tempPath}`,
        outputFile,
        width,
        height,
        dpr: 2,
        waitMs: 1500
      });
      try { fs.unlinkSync(tempPath); } catch(e) {}
    }

    const authBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/auth.png')).toString('base64');
    const dashBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/dashboard.png')).toString('base64');
    const addBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/add-expense.png')).toString('base64');
    const webDashBase64 = fs.readFileSync(path.join(DOCS_DIR, 'website/dashboard.png')).toString('base64');

    // 3.1 Mobile App Collage
    const mobileCollageHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: linear-gradient(135deg, #07090c 0%, #0d1219 50%, #111722 100%);
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1500px;
            height: 920px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
          }
          .glow {
            position: absolute;
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(199,154,62,0.18) 0%, transparent 70%);
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
          }
          .title-area {
            text-align: center;
            margin-bottom: 36px;
            z-index: 2;
          }
          h1 {
            font-size: 34px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.02em;
          }
          h1 span {
            background: linear-gradient(135deg, #D4AF37 0%, #F5E6B8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p {
            color: #8b949e;
            font-size: 15px;
            margin-top: 6px;
          }
          .phones-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 40px;
            z-index: 2;
          }
          .phone-frame {
            width: 320px;
            height: 692px;
            border-radius: 46px;
            background: #000;
            padding: 10px;
            border: 3px solid rgba(255,255,255,0.15);
            box-shadow: 0 30px 70px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05);
            position: relative;
            overflow: hidden;
          }
          .phone-frame.featured {
            transform: scale(1.06);
            border: 3.5px solid rgba(212,175,55,0.6);
            box-shadow: 0 35px 80px rgba(0,0,0,0.9), 0 0 40px rgba(212,175,55,0.25);
            z-index: 3;
          }
          .phone-screen {
            width: 100%;
            height: 100%;
            border-radius: 36px;
            overflow: hidden;
            background: #0d1117;
          }
          .phone-screen img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="glow"></div>
        <div class="title-area">
          <h1>Mobile Experience &bull; <span>Native iOS & Android</span></h1>
          <p>Expo &bull; React Native &bull; Biometrics &bull; Real-time Cloud Synchronization</p>
        </div>
        <div class="phones-container">
          <div class="phone-frame">
            <div class="phone-screen"><img src="data:image/png;base64,${authBase64}" /></div>
          </div>
          <div class="phone-frame featured">
            <div class="phone-screen"><img src="data:image/png;base64,${dashBase64}" /></div>
          </div>
          <div class="phone-frame">
            <div class="phone-screen"><img src="data:image/png;base64,${addBase64}" /></div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(mobileCollageHtml, 'mobile/app-collage.png', 1500, 920);

    // 3.2 Platform Overview
    const platformOverviewHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: linear-gradient(135deg, #080a0e 0%, #0e131a 100%);
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1600px;
            height: 940px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            position: relative;
            overflow: hidden;
          }
          .title-block {
            text-align: center;
            margin-bottom: 30px;
          }
          .tag {
            display: inline-block;
            background: rgba(212,175,55,0.15);
            color: #D4AF37;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 999px;
            border: 1px solid rgba(212,175,55,0.3);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 8px;
          }
          h1 {
            font-size: 32px;
            font-weight: 800;
            color: #ffffff;
            letter-spacing: -0.02em;
          }
          .stage {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 40px;
            width: 100%;
          }
          .browser-mockup {
            width: 960px;
            height: 600px;
            border-radius: 12px;
            background: #161b22;
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 30px 60px rgba(0,0,0,0.7);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .browser-header {
            height: 38px;
            background: #0d1117;
            display: flex;
            align-items: center;
            padding: 0 16px;
            gap: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .browser-dots {
            display: flex;
            gap: 6px;
          }
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
          }
          .dot.red { background: #ff5f56; }
          .dot.yellow { background: #ffbd2e; }
          .dot.green { background: #27c93f; }
          .browser-bar {
            flex: 1;
            height: 24px;
            background: #161b22;
            border-radius: 6px;
            display: flex;
            align-items: center;
            padding: 0 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: #8b949e;
          }
          .browser-content {
            flex: 1;
            overflow: hidden;
          }
          .browser-content img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top;
          }
          .phone-mockup {
            width: 270px;
            height: 560px;
            border-radius: 40px;
            background: #000;
            padding: 8px;
            border: 3px solid rgba(212,175,55,0.5);
            box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.2);
            overflow: hidden;
          }
          .phone-content {
            width: 100%;
            height: 100%;
            border-radius: 32px;
            overflow: hidden;
          }
          .phone-content img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="title-block">
          <div class="tag">Cross-Platform Synchronized Ecosystem</div>
          <h1>One Unified Ledger &bull; Desktop, Tablet & Mobile</h1>
        </div>
        <div class="stage">
          <div class="browser-mockup">
            <div class="browser-header">
              <div class="browser-dots">
                <div class="dot red"></div>
                <div class="dot yellow"></div>
                <div class="dot green"></div>
              </div>
              <div class="browser-bar">https://cozy-narwhal-3099ad.netlify.app/dashboard.html</div>
            </div>
            <div class="browser-content">
              <img src="data:image/png;base64,${webDashBase64}" />
            </div>
          </div>
          <div class="phone-mockup">
            <div class="phone-content">
              <img src="data:image/png;base64,${dashBase64}" />
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(platformOverviewHtml, 'website/platform-overview.png', 1600, 940);

    console.log('\n🎉 Recapture and composite generation fully completed!');
  } finally {
    try { chrome.kill(); } catch(e) {}
    try { webServer.close(); } catch(e) {}
    try { mobileServer.close(); } catch(e) {}
  }
}

run().catch(err => {
  console.error('❌ Recapture script failed:', err);
  process.exit(1);
});
