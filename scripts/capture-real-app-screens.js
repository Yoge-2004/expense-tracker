const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9222;
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'images');

const setWebAuthSession = `
  localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-session-token');
  localStorage.setItem('userId', '1');
  localStorage.setItem('userName', 'Yogeswaran');
  localStorage.setItem('userEmail', 'yoge@example.com');
  localStorage.setItem('userCurrency', 'INR');
  localStorage.setItem('theme', 'dark');
`;

const setMobileAuthSession = `
  localStorage.setItem('auth_token', 'mock-jwt-token');
  localStorage.setItem('fallback_auth_token', 'mock-jwt-token');
  localStorage.setItem('user_id', '1');
  localStorage.setItem('fallback_user_id', '1');
  localStorage.setItem('user_name', 'Yogeswaran');
  localStorage.setItem('fallback_user_name', 'Yogeswaran');
  localStorage.setItem('user_currency', 'INR');
  localStorage.setItem('fallback_user_currency', 'INR');
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('fallback_theme', 'dark');
`;

async function captureRealScreens() {
  console.log('🚀 Launching Headless Chrome via CDP...');
  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=/tmp/chrome-real-captures-${Date.now()}`,
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
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
      return new Promise((resolve) => {
        const msgId = idCounter++;
        const handler = (e) => {
          const resp = JSON.parse(e.data);
          if (resp.id === msgId) {
            ws.removeEventListener('message', handler);
            resolve(resp.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');

    async function captureScreen({ url, outputFile, width = 1440, height = 900, dpr = 2, mobile = false, setupScript, waitMs = 2000 }) {
      console.log(`📸 Capturing ${outputFile} from ${url} (${width}x${height} @ ${dpr}x)...`);
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: dpr,
        mobile
      });

      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 1200));

      if (setupScript) {
        await send('Runtime.evaluate', { expression: setupScript });
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        await new Promise(r => setTimeout(r, waitMs));
      }

      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const dest = path.join(DOCS_DIR, outputFile);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(shot.data, 'base64'));
      console.log(`✅ Saved ${outputFile} (${Math.round(shot.data.length * 0.75 / 1024)} KB)`);
    }

    // ─────────────────────────────────────────────────────────────
    // 1. REAL WEBSITE CAPTURES (PORT 8080)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Capturing Real Website Pages ---');

    // 1.1 Web Login Screen
    await captureScreen({
      url: 'http://localhost:8080/index.html',
      outputFile: 'website/auth-login.png',
      width: 1440,
      height: 900,
      waitMs: 1500
    });

    // 1.2 Web Register Screen
    await captureScreen({
      url: 'http://localhost:8080/register.html',
      outputFile: 'website/auth-register.png',
      width: 1440,
      height: 900,
      waitMs: 1500
    });

    // 1.3 Web Main Dashboard
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/dashboard.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        window.location.reload();
      `,
      waitMs: 3000
    });

    // 1.4 Web Hero Dashboard (High-res 1600x960)
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/hero-dashboard.png',
      width: 1600,
      height: 960,
      setupScript: setWebAuthSession,
      waitMs: 2500
    });

    // 1.5 Add Expense Modal Open
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/add-expense.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const btn = document.getElementById('addExpenseBtn');
        if (btn) btn.click();
        setTimeout(() => {
          const desc = document.getElementById('expenseDesc');
          if (desc) desc.value = 'Cult.fit Pro Fitness Annual Pass';
          const amt = document.getElementById('expenseAmount');
          if (amt) amt.value = '14500.00';
          const cat = document.getElementById('categorySelect');
          if (cat && cat.options.length > 2) cat.selectedIndex = 2;
        }, 500);
      `,
      waitMs: 3000
    });

    // 1.6 Expenses Table View
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/expenses.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const el = document.getElementById('expenseTableBody') || document.querySelector('.table-responsive');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 1.7 Budgets Overview
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/budgets.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const b = document.querySelector('.budget-section') || document.getElementById('budgetCards');
        if (b) b.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 1.8 Budget Progress / Manage Categories Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/budget-progress.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const btn = document.getElementById('manageCategoriesBtn');
        if (btn) btn.click();
      `,
      waitMs: 2500
    });

    // 1.9 Add Income Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/income.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const btn = document.getElementById('addIncomeBtn');
        if (btn) btn.click();
        setTimeout(() => {
          const src = document.getElementById('incomeSource');
          if (src) src.value = 'Lead Software Architect Monthly Salary';
          const amt = document.getElementById('incomeAmount');
          if (amt) amt.value = '95000.00';
        }, 500);
      `,
      waitMs: 2500
    });

    // 1.10 Income Detail Table
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/income-detail.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const t = document.getElementById('incomeTableBody') || document.querySelector('.income-section');
        if (t) t.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 1.11 Savings Goals Section
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/savings-goals.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const s = document.querySelector('.savings-section') || document.getElementById('savingsGoalCards');
        if (s) s.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 1.12 Add Savings Goal Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/savings-detail.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const btn = document.getElementById('addSavingsGoalBtn');
        if (btn) btn.click();
        setTimeout(() => {
          const name = document.getElementById('savingsGoalName');
          if (name) name.value = 'MacBook Pro M3 Max Workstation';
          const target = document.getElementById('savingsGoalTarget');
          if (target) target.value = '250000.00';
          const curr = document.getElementById('savingsGoalCurrent');
          if (curr) curr.value = '185000.00';
        }, 500);
      `,
      waitMs: 2500
    });

    // 1.13 Recurring Commitments Section
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/recurring.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const r = document.getElementById('recurringList') || document.querySelector('.recurring-section');
        if (r) r.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 1.14 Reports & Visual Analytics
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/reports.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const c = document.getElementById('expenseChart') || document.querySelector('.chart-card');
        if (c) c.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2000
    });

    // 1.15 Export Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/report-exports.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const btn = document.getElementById('exportBtn') || document.getElementById('openExportModalBtn');
        if (btn) btn.click();
      `,
      waitMs: 2500
    });

    // 1.16 Responsive Tablet / Mobile Web View
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/responsive.png',
      width: 768,
      height: 1024,
      dpr: 2,
      setupScript: setWebAuthSession + `
        window.location.reload();
      `,
      waitMs: 3000
    });

    // ─────────────────────────────────────────────────────────────
    // 2. REAL MOBILE APP CAPTURES (PORT 8081)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Capturing Real Mobile App Screens ---');

    // 2.1 Mobile Auth / Login Screen
    await captureScreen({
      url: 'http://localhost:8081/login',
      outputFile: 'mobile/auth.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      waitMs: 3000
    });

    // 2.2 Mobile Main Dashboard
    await captureScreen({
      url: 'http://localhost:8081',
      outputFile: 'mobile/dashboard.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession + `
        window.location.reload();
      `,
      waitMs: 4000
    });

    // 2.3 Mobile Add / Edit Expense (Notice: single '+' on Add New!)
    await captureScreen({
      url: 'http://localhost:8081/(tabs)/add-expense?editId=101&editType=expense&editDescription=Luxury%20Apartment%20Rent&editAmount=24000&editCategoryId=2&editDate=2026-09-01',
      outputFile: 'mobile/add-expense.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession,
      waitMs: 3500
    });

    // 2.4 Mobile Subscriptions / Planning Tab
    await captureScreen({
      url: 'http://localhost:8081/(tabs)/subscriptions',
      outputFile: 'mobile/planning.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession,
      waitMs: 3500
    });

    // 2.5 Mobile Profile & Settings Screen (Security PIN, Currency, Theme)
    await captureScreen({
      url: 'http://localhost:8081/(tabs)/profile',
      outputFile: 'mobile/navigation.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession,
      waitMs: 3500
    });

    // 2.6 Mobile Landscape Mode (Demonstrating Full Landscape Responsiveness!)
    await captureScreen({
      url: 'http://localhost:8081',
      outputFile: 'mobile/landscape.png',
      width: 844,
      height: 390,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession,
      waitMs: 3500
    });

    // ─────────────────────────────────────────────────────────────
    // 3. SHOWCASE COMPOSITES (AUTHENTIC SIDE-BY-SIDE APP SCREENS)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Generating Side-by-Side Real App Showcases ---');

    // Read real captured assets as base64
    const realMobileAuthB64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/auth.png')).toString('base64');
    const realMobileDashB64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/dashboard.png')).toString('base64');
    const realMobileAddB64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/add-expense.png')).toString('base64');
    const realWebDashB64 = fs.readFileSync(path.join(DOCS_DIR, 'website/dashboard.png')).toString('base64');

    // 3.1 Mobile App Showcase (Side-by-side real app screens)
    const mobileShowcaseHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #080a0e;
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1400px;
            height: 860px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
          }
          .title-box { text-align: center; margin-bottom: 24px; }
          h1 { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
          h1 span { color: #D4AF37; }
          p { color: #8b949e; font-size: 14px; margin-top: 4px; }
          .screens-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 36px;
            width: 100%;
          }
          .screen-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }
          .screen-label {
            font-size: 12.5px;
            font-weight: 700;
            color: #8b949e;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .screen-frame {
            width: 320px;
            height: 692px;
            border-radius: 40px;
            background: #000;
            border: 3px solid rgba(255,255,255,0.18);
            box-shadow: 0 20px 50px rgba(0,0,0,0.85);
            overflow: hidden;
          }
          .screen-frame.highlight {
            border: 3.5px solid rgba(212,175,55,0.7);
            box-shadow: 0 25px 60px rgba(0,0,0,0.95), 0 0 30px rgba(212,175,55,0.2);
            transform: scale(1.04);
          }
          .screen-frame img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="title-box">
          <h1>Native Mobile App &bull; <span>React Native & Expo</span></h1>
          <p>Real-time transaction tracking, biometric authentication, and dual-mode financial planning</p>
        </div>
        <div class="screens-row">
          <div class="screen-card">
            <span class="screen-label">1. Biometric Sign-In</span>
            <div class="screen-frame">
              <img src="data:image/png;base64,${realMobileAuthB64}" />
            </div>
          </div>
          <div class="screen-card">
            <span class="screen-label" style="color: #D4AF37;">2. Active Cashflow Ledger</span>
            <div class="screen-frame highlight">
              <img src="data:image/png;base64,${realMobileDashB64}" />
            </div>
          </div>
          <div class="screen-card">
            <span class="screen-label">3. Edit Transaction</span>
            <div class="screen-frame">
              <img src="data:image/png;base64,${realMobileAddB64}" />
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const tempMobileShowcase = path.join(__dirname, 'temp-mobile-showcase.html');
    fs.writeFileSync(tempMobileShowcase, mobileShowcaseHtml);
    await captureScreen({
      url: `file://${tempMobileShowcase}`,
      outputFile: 'mobile/app-collage.png',
      width: 1400,
      height: 860,
      dpr: 2,
      waitMs: 1500
    });
    fs.unlinkSync(tempMobileShowcase);

    // 3.2 Unified Platform Overview (Real Desktop + Real Mobile)
    const platformOverviewHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #080a0e;
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1560px;
            height: 900px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 30px;
          }
          .title-area { text-align: center; margin-bottom: 24px; }
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
          h1 { font-size: 30px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
          .stage { display: flex; align-items: center; justify-content: center; gap: 36px; width: 100%; }
          .desktop-wrap {
            width: 1040px;
            height: 650px;
            background: #161b22;
            border-radius: 16px;
            border: 2px solid rgba(255,255,255,0.12);
            box-shadow: 0 25px 70px rgba(0,0,0,0.85);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .mac-topbar {
            background: #11141a;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 7px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .dot { width: 10px; height: 10px; border-radius: 50%; }
          .dot-red { background: #ff5f56; }
          .dot-yellow { background: #ffbd2e; }
          .dot-green { background: #27c93f; }
          .mac-url {
            margin: 0 auto;
            background: rgba(255,255,255,0.06);
            padding: 3px 20px;
            border-radius: 6px;
            font-size: 11px;
            color: #8b949e;
            font-family: 'JetBrains Mono', monospace;
          }
          .desktop-screen { flex: 1; overflow: hidden; }
          .desktop-screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
          .mobile-wrap {
            width: 295px;
            height: 650px;
            border-radius: 42px;
            background: #000;
            padding: 6px;
            border: 3px solid rgba(212,175,55,0.5);
            box-shadow: 0 25px 70px rgba(0,0,0,0.85), 0 0 25px rgba(212,175,55,0.18);
          }
          .mobile-screen { width: 100%; height: 100%; border-radius: 36px; overflow: hidden; }
          .mobile-screen img { width: 100%; height: 100%; object-fit: cover; }
        </style>
      </head>
      <body>
        <div class="title-area">
          <div class="tag">Unified Financial Ecosystem</div>
          <h1>Cross-Platform Web &bull; Mobile &bull; Cloud Synchronization</h1>
        </div>
        <div class="stage">
          <div class="desktop-wrap">
            <div class="mac-topbar">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
              <div class="mac-url">https://expensetracker.pro/dashboard</div>
            </div>
            <div class="desktop-screen">
              <img src="data:image/png;base64,${realWebDashB64}" />
            </div>
          </div>
          <div class="mobile-wrap">
            <div class="mobile-screen">
              <img src="data:image/png;base64,${realMobileDashB64}" />
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const tempPlatformOverview = path.join(__dirname, 'temp-platform-overview.html');
    fs.writeFileSync(tempPlatformOverview, platformOverviewHtml);
    await captureScreen({
      url: `file://${tempPlatformOverview}`,
      outputFile: 'website/platform-overview.png',
      width: 1560,
      height: 900,
      dpr: 2,
      waitMs: 1500
    });
    fs.unlinkSync(tempPlatformOverview);

    ws.close();
    console.log('\n🎉 ALL REAL APP SCREENS CAPTURED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error during real screen capture:', err);
  } finally {
    chrome.kill();
  }
}

captureRealScreens();
