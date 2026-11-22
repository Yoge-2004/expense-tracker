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

  test('renders legacy-login.html with zero horizontal overflow on QVGA (240x320) and handles login', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const headers = { 'content-type': 'application/json' };
      if (url.includes('/api/auth/login')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ token: 'retro-jwt-test', userId: 1, name: 'Retro User', currency: 'USD' })
        });
        return;
      }
      await route.fulfill({ status: 200, headers, body: '[]' });
    });

    await page.goto('/legacy-login.html');

    // Verify 0 horizontal overflow
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);

    // Verify form elements
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();
    await expect(page.locator('#btnSubmitLogin')).toBeVisible();

    // Fill credentials and submit
    await page.fill('#loginEmail', 'retro@example.com');
    await page.fill('#loginPassword', 'SecretPass123!');
    await page.click('#btnSubmitLogin');

    // Should redirect to legacy-mobile.html with stored credentials
    await page.waitForURL('**/legacy-mobile.html');
    expect(page.url()).toContain('legacy-mobile.html');
  });

  test('renders legacy-register.html with zero horizontal overflow on QVGA (240x320)', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const headers = { 'content-type': 'application/json' };
      if (url.includes('/api/auth/register')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ message: 'User registered successfully' })
        });
        return;
      }
      if (url.includes('/api/auth/login')) {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({ token: 'retro-jwt-reg', userId: 2, name: 'Retro New', currency: 'EUR' })
        });
        return;
      }
      await route.fulfill({ status: 200, headers, body: '[]' });
    });

    await page.goto('/legacy-register.html');

    // Verify 0 horizontal overflow
    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);

    // Verify input fields
    await expect(page.locator('#regName')).toBeVisible();
    await expect(page.locator('#regUsername')).toBeVisible();
    await expect(page.locator('#regEmail')).toBeVisible();
    await expect(page.locator('#regCurrency')).toBeVisible();
    await expect(page.locator('#regPassword')).toBeVisible();
    await expect(page.locator('#regPin')).toBeVisible();
    await expect(page.locator('#btnSubmitRegister')).toBeVisible();

    // Fill form and submit
    await page.fill('#regName', 'Retro New User');
    await page.fill('#regUsername', 'retronew');
    await page.fill('#regEmail', 'new@retro.org');
    await page.selectOption('#regCurrency', 'EUR');
    await page.fill('#regPassword', 'P@ssword123');
    await page.fill('#regPin', '123456');

    await page.click('#btnSubmitRegister');
    await page.waitForURL('**/legacy-mobile.html');
    expect(page.url()).toContain('legacy-mobile.html');
  });

  test('renders legacy-forgot-password.html with zero horizontal overflow on QVGA (240x320)', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.goto('/legacy-forgot-password.html');

    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);

    await expect(page.locator('#resetEmail')).toBeVisible();
    await expect(page.locator('#resetCode')).toBeVisible();
    await expect(page.locator('#resetNewPass')).toBeVisible();
    await expect(page.locator('#resetConfirmPass')).toBeVisible();
    await expect(page.locator('#btnSubmitReset')).toBeVisible();
  });

  test('supports Budgets, Goals, Reports tab switching and contextual softkeys', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // 1. Switch to Budgets
    await page.click('#tabBudgets');
    await expect(page.locator('#viewBudgets')).toBeVisible();
    await expect(page.locator('#viewTransactions')).toBeHidden();
    await expect(page.locator('#fpLsk')).toContainText('+ BUDGET [1]');

    // Open & close budget modal
    await page.click('#btnOpenBudgetModal');
    await expect(page.locator('#budgetModal')).toBeVisible();
    await expect(page.locator('#fpLsk')).toContainText('Cancel');
    await page.click('#btnCloseBudgetModal');
    await expect(page.locator('#budgetModal')).toBeHidden();

    // 2. Switch to Goals
    await page.click('#tabGoals');
    await expect(page.locator('#viewGoals')).toBeVisible();
    await expect(page.locator('#viewBudgets')).toBeHidden();
    await expect(page.locator('#fpLsk')).toContainText('+ GOAL [1]');

    // Open & close goal modal
    await page.click('#btnOpenGoalModal');
    await expect(page.locator('#goalModal')).toBeVisible();
    await page.click('#btnCloseGoalModal');
    await expect(page.locator('#goalModal')).toBeHidden();

    // 3. Switch to Reports
    await page.click('#tabReports');
    await expect(page.locator('#viewReports')).toBeVisible();
    await expect(page.locator('#viewGoals')).toBeHidden();
    await expect(page.locator('#fpLsk')).toContainText('CSV [1]');

    // 4. Switch back to Transactions
    await page.click('#tabOverview');
    await expect(page.locator('#viewTransactions')).toBeVisible();
    await expect(page.locator('#fpLsk')).toContainText('+ EXPENSE [1]');
  });

  test('supports editing an existing transaction and recalculating summary', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // Add initial expense
    await page.click('#btnOpenExpenseModal');
    await page.fill('#expDescription', 'Book Store');
    await page.fill('#expAmount', '100');
    await page.click('#btnSaveExpense');

    // Verify initial item exists
    const item = page.locator('#txListContainer', { hasText: 'Book Store' });
    await expect(item).toBeVisible();
    await expect(item).toContainText('100.00');

    // Click Edit button
    await item.locator('.tx-btn-edit').click();
    await expect(page.locator('#editTxModal')).toBeVisible();
    expect(await page.inputValue('#editTxAmount')).toBe('100');

    // Update amount to 250
    await page.fill('#editTxAmount', '250');
    await page.click('#btnSaveEditTx');
    await expect(page.locator('#editTxModal')).toBeHidden();

    // Verify updated amount in item and overview summary
    await expect(item).toContainText('250.00');
    await expect(page.locator('#totalExpenseVal')).toContainText('250.00');
  });

});

