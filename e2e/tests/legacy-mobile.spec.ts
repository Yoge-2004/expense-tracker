import { test, expect, type Page } from '@playwright/test';

const emptyApi = async (page: Page) => {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const headers = { 'content-type': 'application/json; charset=utf-8' };

    if (url.includes('/api/health')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ status: 'UP', database: 'UP' }) });
      return;
    }
    if (url.includes('/api/auth/config')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ googleClientId: '' }) });
      return;
    }
    await route.fulfill({ status: 200, headers, body: '[]' });
  });
};

const IPHONE_OS_1_UA = 'Mozilla/5.0 (iPhone; U; CPU iPhone OS 1_0 like Mac OS X; en-us) AppleWebKit/420.4 (KHTML, like Gecko) Version/3.0 Mobile/1A543a Safari/419.3';
const ANDROID_1_UA = 'Mozilla/5.0 (Linux; U; Android 1.0; en-us; dream) AppleWebKit/525.10+ (KHTML, like Gecko) Version/3.0.4 Mobile Safari/523.12.2';

test.describe('Legacy & Retro Mobile Support (Android 1.0 & iOS 1.0)', () => {

  test('renders legacy-mobile.html on iPhone OS 1.0 (320x480) with zero horizontal overflow', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: IPHONE_OS_1_UA,
      viewport: { width: 320, height: 480 }
    });
    const page = await context.newPage();
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // Verify 0 horizontal overflow
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);

    // Verify Apple Web App metadata
    const appleCapable = await page.getAttribute('meta[name="apple-mobile-web-app-capable"]', 'content');
    expect(appleCapable).toBe('yes');

    // Verify Device badge detected
    const badge = await page.textContent('#deviceBadge');
    expect(badge).toContain('iOS 1.0');
    await context.close();
  });

  test('renders legacy-mobile.html on Android 1.0 HTC Dream (320x480) with zero horizontal overflow', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent: ANDROID_1_UA,
      viewport: { width: 320, height: 480 }
    });
    const page = await context.newPage();
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);

    const badge = await page.textContent('#deviceBadge');
    expect(badge).toContain('Android 1.0');
    await context.close();
  });

  test('auto-redirects legacy iOS 1.0 browsers from index.html to legacy-mobile.html', async ({ browser }) => {
    // Create new context with iOS 1.0 User-Agent
    const context = await browser.newContext({
      userAgent: IPHONE_OS_1_UA,
      viewport: { width: 320, height: 480 }
    });
    const page = await context.newPage();
    await emptyApi(page);

    await page.goto('/index.html');
    await page.waitForURL('**/legacy-mobile.html');

    expect(page.url()).toContain('legacy-mobile.html');
    await context.close();
  });

  test('interactively creates new expense and updates balance', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // Click + Expense
    await page.click('#btnOpenExpenseModal');
    await expect(page.locator('#expenseModal')).toBeVisible();

    // Fill form
    await page.fill('#expDescription', 'Coffee Break');
    await page.fill('#expAmount', '150');
    await page.selectOption('#expCategory', 'Food & Dining');

    // Save
    await page.click('#btnSaveExpense');
    await expect(page.locator('#expenseModal')).toBeHidden();

    // Verify transaction appears in DOM
    const txItem = page.locator('#txListContainer', { hasText: 'Coffee Break' });
    await expect(txItem).toBeVisible();
    await expect(txItem).toContainText('150.00');
  });

  test('detects and badges rich spectrum of legacy mobile OS platforms', async ({ page }) => {
    await page.goto('/legacy-mobile.html');

    const platforms = [
      { ua: 'Mozilla/5.0 (SymbianOS/9.4; Series60/5.0 Nokia5800d-1/21.0.025; Profile/MIDP-2.1 Configuration/CLDC-1.1 ) AppleWebKit/525 (KHTML, like Gecko) Safari/525', expected: 'Symbian' },
      { ua: 'BlackBerry9700/5.0.0.862 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/120', expected: 'BlackBerry' },
      { ua: 'Mozilla/5.0 (compatible; MSIE 9.0; Windows Phone OS 7.5; Trident/5.0; IEMobile/9.0; NOKIA; Lumia 800)', expected: 'Windows Phone' },
      { ua: 'Mozilla/5.0 (webOS/1.4.0; U; en-US) AppleWebKit/532.2 (KHTML, like Gecko) Mobile/1.0 Safari/532.2 Pre/1.0', expected: 'Palm webOS' },
      { ua: 'Mozilla/5.0 (SAMSUNG; SAMSUNG-GT-S8500/S8500XXJF4; U; Bada/1.0; en-us) AppleWebKit/533.1 (KHTML, like Gecko) Dolfin/2.0 Mobile WVGA', expected: 'Bada' },
      { ua: 'Mozilla/5.0 (Mobile; LYF/F220B/LYF-F220B-000-01-38-030918; Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5', expected: 'KaiOS' },
      { ua: 'MAUI / WAP Browser / MediaTek / MTK6261', expected: 'MAUI' },
      { ua: 'Mozilla/4.0 (BREW 3.1.5; U; en-us; Kyocera; LX400; NetFront/3.5.1/AMB)', expected: 'BREW' },
      { ua: 'Opera/9.80 (J2ME/MIDP; Opera Mini/9.80 (S60; SymbOS; Opera Mobi/23.348; U; en) Presto/2.5.25 Version/10.00', expected: 'Opera Mini' },
      { ua: 'Mozilla/5.0 (PlayStation Portable; 2.00)', expected: 'PlayStation Portable' },
      { ua: 'Mozilla/5.0 (Linux; U; Android 2.3.6; en-us; Nexus S Build/GRK39F) AppleWebKit/533.1', expected: 'Android 2.x' },
      { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 5_1_1 like Mac OS X) AppleWebKit/534.46', expected: 'iOS 5' }
    ];

    for (const item of platforms) {
      const res = await page.evaluate((testUa) => {
        return (window as any).ExpenseTrackerMobile.detectPlatform(testUa);
      }, item.ua);
      expect(res).toContain(item.expected);
    }
  });

  test('auto-redirects Symbian, BlackBerry, and Windows Phone from index.html to legacy-mobile.html', async ({ browser }) => {
    const legacyUas = [
      'Mozilla/5.0 (SymbianOS/9.4; Series60/5.0 Nokia5800d-1/21.0.025; Profile/MIDP-2.1) AppleWebKit/525',
      'BlackBerry9700/5.0.0.862 Profile/MIDP-2.1 Configuration/CLDC-1.1 VendorID/120',
      'Mozilla/5.0 (compatible; MSIE 9.0; Windows Phone OS 7.5; Trident/5.0; IEMobile/9.0; NOKIA; Lumia 800)'
    ];

    for (const testUa of legacyUas) {
      const context = await browser.newContext({
        userAgent: testUa,
        viewport: { width: 320, height: 480 }
      });
      const page = await context.newPage();
      await emptyApi(page);

      await page.goto('/index.html');
      await page.waitForURL('**/legacy-mobile.html');
      expect(page.url()).toContain('legacy-mobile.html');
      await context.close();
    }
  });

  test('renders feature phone softkey bar and keypad quick guide with 0 horizontal overflow at 240x320 QVGA', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // Verify 0 horizontal overflow at 240x320
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);

    // Verify softkey bar exists
    const softkeyBar = page.locator('#fpSoftkeyBar');
    await expect(softkeyBar).toBeVisible();

    const lsk = page.locator('#fpLsk');
    const csk = page.locator('#fpCsk');
    const rsk = page.locator('#fpRsk');
    await expect(lsk).toContainText('EXPENSE');
    await expect(csk).toContainText('SELECT');
    await expect(rsk).toContainText('INCOME');

    // Verify keypad quick guide strip exists
    const keypadStrip = page.locator('#keypadStrip');
    await expect(keypadStrip).toBeVisible();
    await expect(keypadStrip).toContainText('[1] +Exp');
  });

  test('supports D-Pad navigation and spatial focus on legacy-mobile.html', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // Press ArrowDown to initiate spatial focus
    await page.keyboard.press('ArrowDown');
    const focusedCount = await page.locator('.fp-focused').count();
    expect(focusedCount).toBeGreaterThanOrEqual(1);

    // Press ArrowDown again to move focus
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.fp-focused')).toBeVisible();
  });

  test('supports T9 physical keypad shortcuts (1 for Expense, 2 for Income, Escape to cancel)', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // Press key 1 to open Expense modal
    await page.keyboard.press('1');
    await expect(page.locator('#expenseModal')).toBeVisible();

    // Verify softkeys updated contextually
    await expect(page.locator('#fpLsk')).toContainText('Cancel');
    await expect(page.locator('#fpCsk')).toContainText('SAVE');

    // Press Escape to cancel modal
    await page.keyboard.press('Escape');
    await expect(page.locator('#expenseModal')).toBeHidden();

    // Press key 2 to open Income modal
    await page.keyboard.press('2');
    await expect(page.locator('#incomeModal')).toBeVisible();

    // Click LSK to cancel modal
    await page.click('#fpLsk');
    await expect(page.locator('#incomeModal')).toBeHidden();

    // Press key 4 to filter by expenses
    await page.keyboard.press('4');
    expect(await page.inputValue('#filterType')).toBe('EXPENSE');

    // Press key 3 to filter by all
    await page.keyboard.press('3');
    expect(await page.inputValue('#filterType')).toBe('ALL');
  });

});
