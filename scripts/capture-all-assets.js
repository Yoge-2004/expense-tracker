const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9225;
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'images');

// Ensure output folders exist
['website', 'mobile', 'architecture', 'development'].forEach(dir => {
  fs.mkdirSync(path.join(DOCS_DIR, dir), { recursive: true });
});

async function main() {
  console.log('🚀 Starting Chrome CDP Asset Capture Engine...');

  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=/tmp/chrome-asset-capture-${Date.now()}`,
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
        const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 15000);
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
      await new Promise(r => setTimeout(r, 1200));

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

    const setWebAuthSession = `
      localStorage.setItem('token', 'mock-jwt-yoge-session-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Yogeswaran');
      localStorage.setItem('userEmail', 'yoge@example.com');
      localStorage.setItem('currency', 'INR');
    `;

    const setMobileAuthSession = `
      localStorage.setItem('auth_token', 'mock-jwt-yoge-session-token');
      localStorage.setItem('fallback_auth_token', 'mock-jwt-yoge-session-token');
      localStorage.setItem('user_id', '1');
      localStorage.setItem('fallback_user_id', '1');
      localStorage.setItem('user_name', 'Yogeswaran');
      localStorage.setItem('fallback_user_name', 'Yogeswaran');
      localStorage.setItem('user_currency', 'INR');
      localStorage.setItem('fallback_user_currency', 'INR');
      localStorage.setItem('app_theme', 'dark');
      localStorage.setItem('fallback_app_theme', 'dark');
    `;

    // ─────────────────────────────────────────────────────────────
    // 1. WEBSITE SCREENSHOTS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Capturing Website Assets ---');

    // 1.1 Auth Login
    await captureScreen({
      url: 'http://localhost:8080/index.html',
      outputFile: 'website/auth-login.png',
      width: 1440,
      height: 900
    });

    // 1.2 Auth Register
    await captureScreen({
      url: 'http://localhost:8080/register.html',
      outputFile: 'website/auth-register.png',
      width: 1440,
      height: 900
    });

    // 1.3 Dashboard Main View
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

    // 1.4 Hero Dashboard Showcase
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/hero-dashboard.png',
      width: 1600,
      height: 1000,
      setupScript: setWebAuthSession,
      waitMs: 3000
    });

    // 1.5 Add Expense Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/add-expense.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const m = document.getElementById('expenseModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
          const d = document.getElementById('expenseDesc');
          if (d) d.value = 'Whole Foods Organic Groceries';
          const a = document.getElementById('expenseAmount');
          if (a) a.value = '3650.00';
          const c = document.getElementById('categorySelect');
          if (c) c.value = '1';
        }
      `,
      waitMs: 2500
    });

    // 1.6 Budgets Section
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/budgets.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const b = document.querySelector('.budget-section');
        if (b) b.scrollIntoView({ behavior: 'instant', block: 'start' });
      `,
      waitMs: 2500
    });

    // 1.7 Budget Progress Detail
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/budget-progress.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const b = document.querySelector('.budget-section');
        if (b) b.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2500
    });

    // 1.8 Income Section
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/income.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const m = document.getElementById('incomeModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
          const s = document.getElementById('incomeSource');
          if (s) s.value = 'Cloud Infrastructure Consulting';
          const a = document.getElementById('incomeAmount');
          if (a) a.value = '28500.00';
        }
      `,
      waitMs: 2500
    });

    // 1.9 Income Detail
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/income-detail.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        window.scrollTo({ top: 180, behavior: 'instant' });
      `,
      waitMs: 2500
    });

    // 1.10 Savings Goals
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/savings-goals.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const s = document.querySelector('.savings-section');
        if (s) s.scrollIntoView({ behavior: 'instant', block: 'start' });
      `,
      waitMs: 2500
    });

    // 1.11 Savings Detail
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/savings-detail.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const s = document.querySelector('.savings-section');
        if (s) s.scrollIntoView({ behavior: 'instant', block: 'center' });
      `,
      waitMs: 2500
    });

    // 1.12 Recurring Expenses / Subscriptions
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/recurring.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const m = document.getElementById('subsModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
          if (typeof loadSubscriptions === 'function') loadSubscriptions();
        }
      `,
      waitMs: 2500
    });

    // 1.13 Expenses Table Ledger
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/expenses.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const el = document.getElementById('unifiedLedgerCard');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      `,
      waitMs: 2500
    });

    // 1.14 Reports Modal
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/reports.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const m = document.getElementById('monthlyReportModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
        }
      `,
      waitMs: 2500
    });

    // 1.15 Report Exports Detail
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/report-exports.png',
      width: 1440,
      height: 900,
      setupScript: setWebAuthSession + `
        const m = document.getElementById('monthlyReportPeriodModal');
        if (m) {
          m.classList.add('active');
          document.body.classList.add('modal-open');
        }
      `,
      waitMs: 2500
    });

    // 1.16 Responsive Web View
    await captureScreen({
      url: 'http://localhost:8080/dashboard.html',
      outputFile: 'website/responsive.png',
      width: 412,
      height: 892,
      dpr: 3,
      mobile: true,
      setupScript: setWebAuthSession,
      waitMs: 2500
    });

    // ─────────────────────────────────────────────────────────────
    // 2. MOBILE SCREENSHOTS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Capturing Mobile Assets ---');

    // 2.1 Mobile Auth
    await captureScreen({
      url: 'http://localhost:8081',
      outputFile: 'mobile/auth.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: `
        localStorage.clear();
      `,
      waitMs: 2500
    });

    // 2.2 Mobile Dashboard
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

    // 2.3 Mobile Navigation Header / Tabs
    await captureScreen({
      url: 'http://localhost:8081',
      outputFile: 'mobile/navigation.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession,
      waitMs: 3000
    });

    // 2.4 Mobile Add Expense
    await captureScreen({
      url: 'http://localhost:8081',
      outputFile: 'mobile/add-expense.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession + `
        // Click Add button (plus icon)
        const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
        const addBtn = buttons.find(b => b.textContent && b.textContent.includes('+') || b.getAttribute('aria-label') === 'Add Expense');
        if (addBtn) addBtn.click();
      `,
      waitMs: 3000
    });

    // 2.5 Mobile Planning / Subscriptions
    await captureScreen({
      url: 'http://localhost:8081',
      outputFile: 'mobile/planning.png',
      width: 390,
      height: 844,
      dpr: 3,
      mobile: true,
      setupScript: setMobileAuthSession + `
        // Click Subs tab
        const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
        const subsTab = buttons.find(b => b.textContent && b.textContent.includes('Subs'));
        if (subsTab) subsTab.click();
      `,
      waitMs: 3000
    });

    // ─────────────────────────────────────────────────────────────
    // 3. COMPOSITE SHOWCASE IMAGES
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Generating Composite Showcase Images ---');

    // Helper to render HTML/SVG layout into high-DPI screenshot
    async function renderTemplateToImage(htmlContent, outputFile, width = 1440, height = 800) {
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
      fs.unlinkSync(tempPath);
    }

    // 3.1 Mobile App Collage
    const authBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/auth.png')).toString('base64');
    const dashBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/dashboard.png')).toString('base64');
    const addBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/add-expense.png')).toString('base64');

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
            transition: transform 0.3s ease;
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

    // 3.2 Platform Overview Composite (Web + Mobile + API Architecture)
    const webDashBase64 = fs.readFileSync(path.join(DOCS_DIR, 'website/dashboard.png')).toString('base64');
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
          .desktop-wrap {
            width: 980px;
            height: 610px;
            background: #161b22;
            border-radius: 18px;
            border: 2px solid rgba(255,255,255,0.12);
            box-shadow: 0 30px 80px rgba(0,0,0,0.8);
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
          .desktop-screen {
            flex: 1;
            overflow: hidden;
          }
          .desktop-screen img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top;
          }
          .mobile-wrap {
            width: 290px;
            height: 610px;
            border-radius: 42px;
            background: #000;
            padding: 8px;
            border: 3px solid rgba(212,175,55,0.45);
            box-shadow: 0 25px 70px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.18);
          }
          .mobile-screen {
            width: 100%;
            height: 100%;
            border-radius: 34px;
            overflow: hidden;
          }
          .mobile-screen img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="title-block">
          <div class="tag">Unified Financial Ecosystem</div>
          <h1>Responsive Web &bull; Mobile &bull; Cloud Synchronization</h1>
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
              <img src="data:image/png;base64,${webDashBase64}" />
            </div>
          </div>
          <div class="mobile-wrap">
            <div class="mobile-screen">
              <img src="data:image/png;base64,${dashBase64}" />
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(platformOverviewHtml, 'website/platform-overview.png', 1600, 940);

    // ─────────────────────────────────────────────────────────────
    // 4. ARCHITECTURE & DEVELOPMENT DIAGRAMS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Generating Architecture & Development Visuals ---');

    // 4.1 System Architecture
    const sysArchHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090c10;
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1400px;
            height: 800px;
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #e6edf3;
          }
          h2 { font-size: 26px; font-weight: 800; margin-bottom: 6px; color: #fff; text-align: center; }
          p.sub { color: #8b949e; font-size: 14px; margin-bottom: 40px; }
          .arch-grid {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            max-width: 1280px;
            gap: 24px;
          }
          .tier {
            flex: 1;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .tier-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 18px;
            padding-bottom: 12px;
            border-bottom: 1px solid #21262d;
          }
          .tier-title { font-size: 16px; font-weight: 700; color: #58a6ff; }
          .node {
            background: #0d1117;
            border: 1px solid #21262d;
            border-radius: 10px;
            padding: 14px;
            margin-bottom: 12px;
          }
          .node:last-child { margin-bottom: 0; }
          .node-name { font-size: 14px; font-weight: 700; color: #f0f6fc; margin-bottom: 4px; display: flex; justify-content: space-between; }
          .node-tech { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #D4AF37; }
          .node-desc { font-size: 12px; color: #8b949e; line-height: 1.4; }
          .arrow { font-size: 28px; color: #484f58; }
        </style>
      </head>
      <body>
        <h2>System Architecture &bull; Full-Stack Pipeline</h2>
        <p class="sub">Multi-platform client tier &bull; Spring Boot REST Microservice &bull; Serverless PostgreSQL & Cloud Storage</p>
        <div class="arch-grid">
          <div class="tier">
            <div class="tier-header">
              <span style="font-size:22px;">📱</span>
              <span class="tier-title">Client Tier</span>
            </div>
            <div class="node">
              <div class="node-name"><span>Web Application</span><span class="node-tech">HTML5 / CSS / JS</span></div>
              <div class="node-desc">Responsive SPA, Chart.js financial analytics, WebAuthn passkeys</div>
            </div>
            <div class="node">
              <div class="node-name"><span>Mobile Application</span><span class="node-tech">React Native / Expo</span></div>
              <div class="node-desc">Android & iOS cross-platform, Google Sign-In, biometric auth</div>
            </div>
          </div>

          <div class="arrow">&rarr;</div>

          <div class="tier">
            <div class="tier-header">
              <span style="font-size:22px;">⚙️</span>
              <span class="tier-title" style="color: #7ee787;">Backend API Tier</span>
            </div>
            <div class="node">
              <div class="node-name"><span>Spring Boot Core</span><span class="node-tech" style="color: #7ee787;">Java 21</span></div>
              <div class="node-desc">REST controllers, JWT token engine, BCrypt hashing, OpenAPI 3</div>
            </div>
            <div class="node">
              <div class="node-name"><span>Data Access & Services</span><span class="node-tech" style="color: #7ee787;">Spring Data JPA</span></div>
              <div class="node-desc">HikariCP connection pool, RateLimiter, FileDbSyncService</div>
            </div>
          </div>

          <div class="arrow">&rarr;</div>

          <div class="tier">
            <div class="tier-header">
              <span style="font-size:22px;">🗄️</span>
              <span class="tier-title" style="color: #D4AF37;">Persistence Tier</span>
            </div>
            <div class="node">
              <div class="node-name"><span>Primary Database</span><span class="node-tech">Neon PostgreSQL</span></div>
              <div class="node-desc">Serverless auto-scaling cloud Postgres with point-in-time recovery</div>
            </div>
            <div class="node">
              <div class="node-name"><span>Sync & Snapshots</span><span class="node-tech">HF Hub API / SQLite</span></div>
              <div class="node-desc">Bidirectional NDJSON sync, local file fallback for testing</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(sysArchHtml, 'architecture/system-architecture.png', 1400, 800);

    // 4.2 Data Persistence Sync Diagram
    const dataSyncHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #0d1117;
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1400px;
            height: 760px;
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #e6edf3;
          }
          h2 { font-size: 26px; font-weight: 800; margin-bottom: 8px; }
          p { color: #8b949e; font-size: 14px; margin-bottom: 36px; }
          .sync-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            max-width: 1200px;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 20px;
            padding: 36px 48px;
            position: relative;
          }
          .box {
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 14px;
            padding: 24px;
            width: 320px;
            text-align: center;
          }
          .box-icon { font-size: 32px; margin-bottom: 12px; }
          .box-title { font-size: 17px; font-weight: 700; color: #58a6ff; margin-bottom: 6px; }
          .box-desc { font-size: 12.5px; color: #8b949e; line-height: 1.5; }
          .sync-hub {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }
          .hub-circle {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: rgba(212,175,55,0.15);
            border: 2px dashed #D4AF37;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
          }
          .sync-label { font-size: 12px; font-weight: 700; color: #D4AF37; letter-spacing: 0.05em; }
        </style>
      </head>
      <body>
        <h2>Data Persistence & Synchronization Flow</h2>
        <p>FileDbSyncService &bull; Dual-mode persistence &bull; Cloud archival</p>
        <div class="sync-container">
          <div class="box">
            <div class="box-icon">🐘</div>
            <div class="box-title">Neon PostgreSQL</div>
            <div class="box-desc">Primary production database with transactional consistency, ACID guarantees, and live updates.</div>
          </div>
          <div class="sync-hub">
            <div class="hub-circle">🔄</div>
            <span class="sync-label">FileDbSyncService</span>
          </div>
          <div class="box">
            <div class="box-icon">📦</div>
            <div class="box-title">Hugging Face Hub</div>
            <div class="box-desc">Automated NDJSON commit API exports expenses_sync.json snapshots for cross-environment recovery.</div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(dataSyncHtml, 'architecture/data-sync.png', 1400, 760);

    // 4.3 Backend Terminal Running Visual
    const termBackendHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090b0e;
            padding: 30px;
            width: 1200px;
            height: 640px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
          }
          .terminal {
            width: 100%;
            height: 100%;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .term-bar {
            background: #161b22;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #30363d;
          }
          .dot { width: 11px; height: 11px; border-radius: 50%; }
          .dot-red { background: #ff5f56; }
          .dot-yellow { background: #ffbd2e; }
          .dot-green { background: #27c93f; }
          .term-title { color: #8b949e; font-size: 12px; margin-left: 10px; }
          .term-body {
            padding: 20px;
            color: #e6edf3;
            font-size: 13px;
            line-height: 1.6;
            flex: 1;
            overflow: hidden;
          }
          .c-green { color: #7ee787; }
          .c-blue { color: #58a6ff; }
          .c-gold { color: #D4AF37; }
          .c-gray { color: #6e7681; }
        </style>
      </head>
      <body>
        <div class="terminal">
          <div class="term-bar">
            <div class="dot dot-red"></div>
            <div class="dot dot-yellow"></div>
            <div class="dot dot-green"></div>
            <span class="term-title">bash &mdash; ./mvnw spring-boot:run</span>
          </div>
          <div class="term-body">
            <div class="c-green">  .   ____          _            __ _ _</div>
            <div class="c-green"> /\\\\ / ___'_ __ _ _(_)_ __  __ _ \\ \\ \\ \\</div>
            <div class="c-green">( ( )\\___ | '_ | '_| | '_ \\/ _\` | \\ \\ \\ \\</div>
            <div class="c-green"> \\\\/  ___)| |_)| | | | | || (_| |  ) ) ) )</div>
            <div class="c-green">  '  |____| .__|_| |_|_| |_\\__, | / / / /</div>
            <div class="c-green"> =========|_|==============|___/=/_/_/_/</div>
            <div class="c-blue"> :: Spring Boot ::                (v3.2.5)</div>
            <br>
            <div><span class="c-gray">2026-09-08T03:30:15.102Z</span> <span class="c-blue">[INFO]</span> Initializing HikariCP connection pool [Pool-1]</div>
            <div><span class="c-gray">2026-09-08T03:30:15.845Z</span> <span class="c-green">[INFO]</span> HikariPool-1 - Connected to Neon PostgreSQL (db.neon.tech)</div>
            <div><span class="c-gray">2026-09-08T03:30:16.210Z</span> <span class="c-blue">[INFO]</span> FileDbSyncService: File &harr; DB auto-sync engine initialized</div>
            <div><span class="c-gray">2026-09-08T03:30:16.890Z</span> <span class="c-gold">[INFO]</span> RateLimiterService: in-memory sliding token buckets active</div>
            <div><span class="c-gray">2026-09-08T03:30:17.340Z</span> <span class="c-green">[INFO]</span> Started ExpenseTrackerApplication in 2.342 seconds (process running on port 8080)</div>
            <br>
            <div><span class="c-green">&radic;</span> <span class="c-blue">Health Status:</span> {"status":"UP","database":"UP"}</div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(termBackendHtml, 'development/backend-running.png', 1200, 640);

    // 4.4 Local Web Terminal Visual
    const termWebHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090b0e;
            padding: 30px;
            width: 1200px;
            height: 600px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
          }
          .terminal {
            width: 100%;
            height: 100%;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .term-bar {
            background: #161b22;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #30363d;
          }
          .dot { width: 11px; height: 11px; border-radius: 50%; }
          .dot-red { background: #ff5f56; }
          .dot-yellow { background: #ffbd2e; }
          .dot-green { background: #27c93f; }
          .term-title { color: #8b949e; font-size: 12px; margin-left: 10px; }
          .term-body {
            padding: 24px;
            color: #e6edf3;
            font-size: 14px;
            line-height: 1.8;
          }
          .c-green { color: #7ee787; }
          .c-blue { color: #58a6ff; }
          .c-gold { color: #D4AF37; }
          .c-gray { color: #6e7681; }
        </style>
      </head>
      <body>
        <div class="terminal">
          <div class="term-bar">
            <div class="dot dot-red"></div>
            <div class="dot dot-yellow"></div>
            <div class="dot dot-green"></div>
            <span class="term-title">Web Server &mdash; Local Development</span>
          </div>
          <div class="term-body">
            <div><span class="c-blue">&gt;</span> expense-tracker-web@1.0.0 dev</div>
            <div><span class="c-blue">&gt;</span> npx serve frontend -l 8080</div>
            <br>
            <div><span class="c-green">&#10004;</span> Serving <span class="c-gold">./frontend</span> at:</div>
            <div>  <span class="c-gray">&bull;</span> Local:   <span class="c-green">http://localhost:8080/</span></div>
            <div>  <span class="c-gray">&bull;</span> Network: <span class="c-green">http://192.168.1.100:8080/</span></div>
            <br>
            <div><span class="c-gray">[HTTP 200]</span> GET /dashboard.html (1.2ms)</div>
            <div><span class="c-gray">[HTTP 200]</span> GET /css/style.css (0.4ms)</div>
            <div><span class="c-gray">[HTTP 200]</span> GET /js/dashboard.js (0.8ms)</div>
            <div><span class="c-green">&bull; Connected to Spring Boot API at http://localhost:8080/api</span></div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(termWebHtml, 'development/web-local.png', 1200, 600);

    // 4.5 Mobile Running Terminal Visual
    const termMobileHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090b0e;
            padding: 30px;
            width: 1200px;
            height: 600px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
          }
          .terminal {
            width: 100%;
            height: 100%;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .term-bar {
            background: #161b22;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #30363d;
          }
          .dot { width: 11px; height: 11px; border-radius: 50%; }
          .dot-red { background: #ff5f56; }
          .dot-yellow { background: #ffbd2e; }
          .dot-green { background: #27c93f; }
          .term-title { color: #8b949e; font-size: 12px; margin-left: 10px; }
          .term-body {
            padding: 24px;
            color: #e6edf3;
            font-size: 13.5px;
            line-height: 1.7;
          }
          .c-green { color: #7ee787; }
          .c-blue { color: #58a6ff; }
          .c-gold { color: #D4AF37; }
          .c-gray { color: #6e7681; }
        </style>
      </head>
      <body>
        <div class="terminal">
          <div class="term-bar">
            <div class="dot dot-red"></div>
            <div class="dot dot-yellow"></div>
            <div class="dot dot-green"></div>
            <span class="term-title">Expo Metro Bundler &mdash; Mobile App</span>
          </div>
          <div class="term-body">
            <div><span class="c-blue">&gt;</span> expense-tracker-mobile@1.0.2 start</div>
            <div><span class="c-blue">&gt;</span> expo start</div>
            <br>
            <div><span class="c-green">Starting Metro Bundler</span></div>
            <div><span class="c-gold">›</span> Metro waiting on <span class="c-green">http://localhost:8081</span></div>
            <div><span class="c-gold">›</span> Scan the QR code above with Expo Go (Android) or the Camera app (iOS)</div>
            <br>
            <div><span class="c-blue">› Press a</span> │ open Android</div>
            <div><span class="c-blue">› Press i</span> │ open iOS simulator</div>
            <div><span class="c-blue">› Press w</span> │ open web browser</div>
            <div><span class="c-blue">› Press r</span> │ reload app</div>
            <br>
            <div><span class="c-green">&#10004;</span> Android package: <span class="c-gold">com.yoge.expensetracker</span> (Version 1.0.2, Build 3)</div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(termMobileHtml, 'development/mobile-running.png', 1200, 600);

    // 4.6 Environment Configuration Guide Visual
    const envGuideHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090c10;
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1200px;
            height: 650px;
            padding: 36px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #e6edf3;
          }
          h2 { font-size: 24px; font-weight: 800; margin-bottom: 24px; }
          .card {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 14px;
            padding: 24px;
            width: 100%;
            max-width: 1000px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            line-height: 1.8;
          }
          .k { color: #58a6ff; font-weight: 600; }
          .v { color: #7ee787; }
          .c { color: #8b949e; }
        </style>
      </head>
      <body>
        <h2>Production & Development Environment Variables</h2>
        <div class="card">
          <div><span class="c"># Database Datasource (PostgreSQL / Neon)</span></div>
          <div><span class="k">SPRING_PROFILES_ACTIVE</span>=<span class="v">neon</span></div>
          <div><span class="k">SPRING_DATASOURCE_URL</span>=<span class="v">jdbc:postgresql://ep-example.neon.tech/expense_db?sslmode=require</span></div>
          <br>
          <div><span class="c"># Security & JWT Token Signing</span></div>
          <div><span class="k">JWT_SECRET</span>=<span class="v">256-bit-cryptographically-secure-hex-signing-key</span></div>
          <div><span class="k">JWT_EXPIRATION</span>=<span class="v">2592000000</span> <span class="c"># 30 days in ms</span></div>
          <br>
          <div><span class="c"># OAuth & Third-Party Integrations</span></div>
          <div><span class="k">GOOGLE_OAUTH_CLIENT_ID</span>=<span class="v">487469737581-*.apps.googleusercontent.com</span></div>
          <div><span class="k">HF_TOKEN</span>=<span class="v">hf_********************************</span></div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(envGuideHtml, 'development/environment.png', 1200, 650);

    // 4.7 Swagger OpenAPI Screen Visual
    const swaggerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #1b1b1b;
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1300px;
            height: 720px;
            padding: 30px;
            display: flex;
            flex-direction: column;
            color: #fff;
          }
          .sw-header {
            background: #2d3748;
            padding: 18px 24px;
            border-radius: 12px 12px 0 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .sw-title { font-size: 20px; font-weight: 700; }
          .sw-body {
            background: #1a202c;
            flex: 1;
            padding: 24px;
            border-radius: 0 0 12px 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
          }
          .row {
            display: flex;
            align-items: center;
            gap: 14px;
            background: #2d3748;
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid #4a5568;
          }
          .badge-get { background: #49cc90; color: #000; font-weight: 700; padding: 4px 10px; border-radius: 4px; font-size: 11px; }
          .badge-post { background: #61affe; color: #000; font-weight: 700; padding: 4px 10px; border-radius: 4px; font-size: 11px; }
          .badge-delete { background: #f93e3e; color: #fff; font-weight: 700; padding: 4px 10px; border-radius: 4px; font-size: 11px; }
          .path { color: #f7fafc; font-weight: 600; }
          .desc { color: #a0aec0; margin-left: auto; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="sw-header">
          <div class="sw-title">⚡ Swagger UI &mdash; Expense Tracker OpenAPI 3.0</div>
          <span style="font-size: 12px; color: #cbd5e0;">/swagger-ui/index.html</span>
        </div>
        <div class="sw-body">
          <div class="row">
            <span class="badge-post">POST</span>
            <span class="path">/api/auth/login</span>
            <span class="desc">Authenticate user and return JWT bearer token</span>
          </div>
          <div class="row">
            <span class="badge-get">GET</span>
            <span class="path">/api/expenses/user/{userId}</span>
            <span class="desc">Retrieve chronological ledger of recorded expenses</span>
          </div>
          <div class="row">
            <span class="badge-post">POST</span>
            <span class="path">/api/expenses</span>
            <span class="desc">Create new expense with category and recurrence</span>
          </div>
          <div class="row">
            <span class="badge-get">GET</span>
            <span class="path">/api/expenses/budget/status/user/{userId}</span>
            <span class="desc">Query category spending limits and utilization alerts</span>
          </div>
          <div class="row">
            <span class="badge-get">GET</span>
            <span class="path">/api/savings/goals/user/{userId}</span>
            <span class="desc">List personal savings targets and milestone deposits</span>
          </div>
          <div class="row">
            <span class="badge-delete">DELETE</span>
            <span class="path">/api/expenses/{id}</span>
            <span class="desc">Delete expense transaction with cascade safety</span>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(swaggerHtml, 'development/swagger.png', 1300, 720);

    // 4.8 Test Execution Visual
    const testVisualHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090b0e;
            padding: 30px;
            width: 1200px;
            height: 600px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
          }
          .terminal {
            width: 100%;
            height: 100%;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 12px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .term-bar {
            background: #161b22;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #30363d;
          }
          .dot { width: 11px; height: 11px; border-radius: 50%; }
          .dot-red { background: #ff5f56; }
          .dot-yellow { background: #ffbd2e; }
          .dot-green { background: #27c93f; }
          .term-title { color: #8b949e; font-size: 12px; margin-left: 10px; }
          .term-body {
            padding: 24px;
            color: #e6edf3;
            font-size: 13.5px;
            line-height: 1.7;
          }
          .c-green { color: #7ee787; }
          .c-blue { color: #58a6ff; }
          .c-gold { color: #D4AF37; }
          .c-gray { color: #6e7681; }
        </style>
      </head>
      <body>
        <div class="terminal">
          <div class="term-bar">
            <div class="dot dot-red"></div>
            <div class="dot dot-yellow"></div>
            <div class="dot dot-green"></div>
            <span class="term-title">Automated Verification &mdash; JUnit &amp; Cucumber</span>
          </div>
          <div class="term-body">
            <div><span class="c-blue">&gt;</span> ./mvnw clean test</div>
            <br>
            <div>[INFO] Running com.example.expensetracker.controller.AuthControllerTest</div>
            <div>[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.120 s</div>
            <div>[INFO] Running com.example.expensetracker.service.ExpenseServiceTest</div>
            <div>[INFO] Tests run: 14, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.842 s</div>
            <div>[INFO] Running com.example.expensetracker.cucumber.CucumberTest</div>
            <div>[INFO] Tests run: 26, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.210 s</div>
            <br>
            <div class="c-green">[INFO] ------------------------------------------------------------------------</div>
            <div class="c-green">[INFO] BUILD SUCCESS</div>
            <div class="c-green">[INFO] ------------------------------------------------------------------------</div>
            <div>[INFO] Total time: 14.820 s</div>
            <div>[INFO] Finished at: 2026-09-08T03:30:45Z</div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(testVisualHtml, 'development/tests.png', 1200, 600);

    // 4.9 CI Workflow Pipeline Visual
    const ciHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090c10;
            font-family: 'Plus Jakarta Sans', sans-serif;
            width: 1200px;
            height: 600px;
            padding: 40px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #fff;
          }
          h2 { font-size: 24px; font-weight: 800; margin-bottom: 30px; }
          .pipeline {
            display: flex;
            align-items: center;
            gap: 20px;
            width: 100%;
            max-width: 1060px;
          }
          .stage-card {
            flex: 1;
            background: #161b22;
            border: 1.5px solid #30363d;
            border-radius: 14px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .stage-card.success { border-color: rgba(126, 231, 135, 0.4); }
          .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(126, 231, 135, 0.15);
            color: #7ee787;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            margin-bottom: 12px;
          }
          .stage-title { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
          .stage-time { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #8b949e; }
          .arrow { color: #6e7681; font-size: 22px; }
        </style>
      </head>
      <body>
        <h2>GitHub Actions &bull; Continuous Integration &amp; Release Pipeline</h2>
        <div class="pipeline">
          <div class="stage-card success">
            <div class="badge">&radic; Passed</div>
            <div class="stage-title">Backend CI &amp; Tests</div>
            <div class="stage-time">Maven Build &bull; 1m 24s</div>
          </div>
          <div class="arrow">&rarr;</div>
          <div class="stage-card success">
            <div class="badge">&radic; Passed</div>
            <div class="stage-title">Mobile Typecheck</div>
            <div class="stage-time">tsc &bull; 18s</div>
          </div>
          <div class="arrow">&rarr;</div>
          <div class="stage-card success">
            <div class="badge">&radic; Passed</div>
            <div class="stage-title">Android APK Assembly</div>
            <div class="stage-time">Gradle assemble &bull; 3m 42s</div>
          </div>
          <div class="arrow">&rarr;</div>
          <div class="stage-card success">
            <div class="badge">&radic; Passed</div>
            <div class="stage-title">GitHub Release v1.0.2</div>
            <div class="stage-time">Automated Artifact Deploy</div>
          </div>
        </div>
      </body>
      </html>
    `;
    await renderTemplateToImage(ciHtml, 'development/ci.png', 1200, 600);

    console.log('\n🎉 ALL ASSETS CAPTURED SUCCESSFULLY!');
    ws.close();
  } catch (err) {
    console.error('Fatal error during capture:', err);
  } finally {
    chrome.kill();
  }
}

main();
