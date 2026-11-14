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

  test('supports tabs filtering between All, Expenses, and Income', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 480 });
    await emptyApi(page);
    await page.goto('/legacy-mobile.html');

    // Click Expenses Tab
    await page.click('#tabExpenses');
    const filterValExp = await page.inputValue('#filterType');
    expect(filterValExp).toBe('EXPENSE');

    // Click Income Tab
    await page.click('#tabIncome');
    const filterValInc = await page.inputValue('#filterType');
    expect(filterValInc).toBe('INCOME');

    // Click Home Tab
    await page.click('#tabOverview');
    const filterValAll = await page.inputValue('#filterType');
    expect(filterValAll).toBe('ALL');
  });

});
