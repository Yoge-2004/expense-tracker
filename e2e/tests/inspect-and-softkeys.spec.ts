import { test, expect } from '@playwright/test';

test.describe('Inspect Mode Scrolling & Feature Phone Softkey Theme Engine', () => {

  test('Inspect mode touch dragging scrolls smoothly on dashboard without locking', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Tester');
      localStorage.setItem('currentUser', JSON.stringify({ id: 1, role: 'USER' }));
    });

    await page.goto('/dashboard.html');
    await page.waitForLoadState('domcontentloaded');

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 200, y: 700 }]
    });
    for (let i = 1; i <= 10; i++) {
      const y = 700 - 40 * i;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 200, y }]
      });
      await new Promise(r => setTimeout(r, 15));
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100);
  });

  test('Bottom bar is hidden on modern smartphones (iPhone / Android) and only softkeys show on feature phones', async ({ page }) => {
    // 1. Modern Smartphone Viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('currentUser', JSON.stringify({ id: 1, role: 'USER' }));
    });

    await page.goto('/dashboard.html');
    await page.waitForLoadState('domcontentloaded');

    const modernBarVisible = await page.evaluate(() => {
      const mobNav = document.querySelector('.mobile-bottom-nav');
      const softkeys = document.querySelector('.feature-phone-softkeys');
      const mobVisible = mobNav ? getComputedStyle(mobNav).display !== 'none' : false;
      const softVisible = softkeys ? getComputedStyle(softkeys).display !== 'none' : false;
      return mobVisible || softVisible;
    });
    expect(modernBarVisible).toBe(false);

    // 2. Feature Phone (QVGA 240x320) on legacy-mobile.html
    await page.setViewportSize({ width: 240, height: 320 });
    await page.goto('/legacy-mobile.html');
    await page.waitForLoadState('domcontentloaded');

    const fpBarVisible = await page.evaluate(() => {
      const bar = document.querySelector('.fp-softkey-bar');
      return bar ? getComputedStyle(bar).display !== 'none' : false;
    });
    expect(fpBarVisible).toBe(true);
  });

  test('Feature phone softkey bar seamlessly adapts to light and dark themes', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-jwt-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('currentUser', JSON.stringify({ id: 1, role: 'USER' }));
      localStorage.setItem('theme', 'dark');
    });

    await page.goto('/legacy-mobile.html');
    await page.waitForLoadState('domcontentloaded');

    // Dark Mode check
    const darkBg = await page.evaluate(() => {
      const bar = document.querySelector('.fp-softkey-bar');
      return bar ? getComputedStyle(bar).backgroundColor : null;
    });
    expect(darkBg).toBe('rgb(14, 16, 12)');

    // Switch to Light Mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });

    const lightBg = await page.evaluate(() => {
      const bar = document.querySelector('.fp-softkey-bar');
      return bar ? getComputedStyle(bar).backgroundColor : null;
    });
    expect(lightBg).toBe('rgb(255, 255, 255)');
  });

});
