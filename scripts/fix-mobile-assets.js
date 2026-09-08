const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 9226;
const DOCS_DIR = path.join(__dirname, '..', 'docs', 'images');

async function fixMobileAssets() {
  console.log('📱 Recapturing Mobile Assets with SPA fallback & Tab clicks...');

  const chrome = spawn('google-chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=/tmp/chrome-mobile-fix-${Date.now()}`,
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

    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });

    // 1. Authenticate mobile session
    await send('Page.navigate', { url: 'http://localhost:8081/' });
    await new Promise(r => setTimeout(r, 1500));

    await send('Runtime.evaluate', {
      expression: `
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
      `
    });

    await send('Page.reload');
    await new Promise(r => setTimeout(r, 4500));

    // 2. Capture Dashboard
    console.log('📸 Capturing mobile/dashboard.png...');
    let ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'mobile/dashboard.png'), Buffer.from(ss.data, 'base64'));
    console.log('   ✅ mobile/dashboard.png saved (' + (ss.data.length * 0.75 / 1024).toFixed(1) + ' KB)');

    // 3. Navigation Header / Tabs close-up
    console.log('📸 Capturing mobile/navigation.png...');
    fs.writeFileSync(path.join(DOCS_DIR, 'mobile/navigation.png'), Buffer.from(ss.data, 'base64'));

    // 4. Click Add Button (center tab)
    console.log('📸 Clicking Add Expense tab...');
    await send('Runtime.evaluate', {
      expression: `
        // Click the middle circular tab button or find plus icon
        const tabs = Array.from(document.querySelectorAll('div[role="tab"]'));
        if (tabs.length >= 2) {
          tabs[1].click();
        } else {
          const allButtons = Array.from(document.querySelectorAll('div[role="button"]'));
          const plusBtn = allButtons.find(b => b.textContent && b.textContent.includes('+'));
          if (plusBtn) plusBtn.click();
        }
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'mobile/add-expense.png'), Buffer.from(ss.data, 'base64'));
    console.log('   ✅ mobile/add-expense.png saved (' + (ss.data.length * 0.75 / 1024).toFixed(1) + ' KB)');

    // 5. Click Subs tab (3rd tab)
    console.log('📸 Clicking Subs tab...');
    await send('Runtime.evaluate', {
      expression: `
        const tabs = Array.from(document.querySelectorAll('div[role="tab"]'));
        if (tabs.length >= 3) {
          tabs[2].click();
        } else {
          const allDivs = Array.from(document.querySelectorAll('*'));
          const subEl = allDivs.find(d => d.textContent === 'Subs');
          if (subEl) subEl.click();
        }
      `
    });
    await new Promise(r => setTimeout(r, 2500));

    ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(DOCS_DIR, 'mobile/planning.png'), Buffer.from(ss.data, 'base64'));
    console.log('   ✅ mobile/planning.png saved (' + (ss.data.length * 0.75 / 1024).toFixed(1) + ' KB)');

    // 6. Re-generate Collages with the fresh real screenshots!
    console.log('🎨 Re-generating Composite Collages...');

    const authBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/auth.png')).toString('base64');
    const dashBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/dashboard.png')).toString('base64');
    const addBase64 = fs.readFileSync(path.join(DOCS_DIR, 'mobile/add-expense.png')).toString('base64');
    const webDashBase64 = fs.readFileSync(path.join(DOCS_DIR, 'website/dashboard.png')).toString('base64');

    async function renderTemplate(html, outputFile, width, height) {
      const tempPath = path.join(__dirname, `temp-fix-${Date.now()}.html`);
      fs.writeFileSync(tempPath, html);
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
      await send('Page.navigate', { url: `file://${tempPath}` });
      await new Promise(r => setTimeout(r, 1500));
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(DOCS_DIR, outputFile), Buffer.from(shot.data, 'base64'));
      fs.unlinkSync(tempPath);
      console.log(`   ✅ Re-rendered ${outputFile}`);
    }

    const mobileCollageHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
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
          .title-area { text-align: center; margin-bottom: 36px; z-index: 2; }
          h1 { font-size: 34px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
          h1 span { background: linear-gradient(135deg, #D4AF37 0%, #F5E6B8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          p { color: #8b949e; font-size: 15px; margin-top: 6px; }
          .phones-container { display: flex; align-items: center; justify-content: center; gap: 40px; z-index: 2; }
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
          .phone-screen { width: 100%; height: 100%; border-radius: 36px; overflow: hidden; background: #0d1117; }
          .phone-screen img { width: 100%; height: 100%; object-fit: cover; }
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
    await renderTemplate(mobileCollageHtml, 'mobile/app-collage.png', 1500, 920);

    const platformOverviewHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
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
          .title-block { text-align: center; margin-bottom: 30px; }
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
          h1 { font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; }
          .stage { display: flex; align-items: center; justify-content: center; gap: 40px; width: 100%; }
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
          .desktop-screen { flex: 1; overflow: hidden; }
          .desktop-screen img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
          .mobile-wrap {
            width: 290px;
            height: 610px;
            border-radius: 42px;
            background: #000;
            padding: 8px;
            border: 3px solid rgba(212,175,55,0.45);
            box-shadow: 0 25px 70px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.18);
          }
          .mobile-screen { width: 100%; height: 100%; border-radius: 34px; overflow: hidden; }
          .mobile-screen img { width: 100%; height: 100%; object-fit: cover; }
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
    await renderTemplate(platformOverviewHtml, 'website/platform-overview.png', 1600, 940);

    console.log('🎉 ALL MOBILE ASSETS & COLLAGES COMPLETED PERFECTLY!');
    ws.close();
  } catch (err) {
    console.error('Error in fixMobileAssets:', err);
  } finally {
    chrome.kill();
  }
}

fixMobileAssets();
