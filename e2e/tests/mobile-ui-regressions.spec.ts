import { test, expect, type Page } from '@playwright/test';

const emptyApi = async (page: Page) => {
  await page.route('**/api/**', async route => {
    const url = route.request().url();
    const headers = { 'content-type': 'application/json; charset=utf-8' };

    if (url.includes('/api/webauthn/')) {
      await route.continue();
      return;
    }

    await route.fulfill({ status: 200, headers, body: '[]' });
  });
};

test.describe('Mobile dashboard regressions', () => {
  test('keeps Record Expense and Record Income controls separated and fully visible', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'ui-regression-test-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Mobile User');
      localStorage.setItem('userEmail', 'mobile@example.com');
    });

    await emptyApi(page);
    await page.goto('/dashboard.html');
    await expect(page.locator('.top-bar')).toBeVisible();

    const expense = page.locator('#openModalBtn');
    const income = page.locator('#openIncomeModalBtn');
    await expect(expense).toBeVisible();
    await expect(income).toBeVisible();

    const boxes = await Promise.all([expense.boundingBox(), income.boundingBox()]);
    expect(boxes[0]).not.toBeNull();
    expect(boxes[1]).not.toBeNull();

    const first = boxes[0]!;
    const second = boxes[1]!;
    expect(first.x).toBeGreaterThanOrEqual(10);
    expect(second.x + second.width).toBeLessThanOrEqual(375 - 10);
    expect(first.x + first.width).toBeLessThanOrEqual(second.x + 1);
    expect(second.x - (first.x + first.width)).toBeGreaterThanOrEqual(8);
    expect(first.width).toBeGreaterThan(120);
    expect(second.width).toBeGreaterThan(120);

    const styles = await page.evaluate(() => {
      const expenseEl = document.querySelector('#openModalBtn')!;
      const incomeEl = document.querySelector('#openIncomeModalBtn')!;
      const expenseStyle = getComputedStyle(expenseEl, '::after');
      const incomeStyle = getComputedStyle(incomeEl, '::after');
      return {
        expense: getComputedStyle(expenseEl).overflow,
        income: getComputedStyle(incomeEl).overflow,
        expenseAfter: expenseStyle.display,
        incomeAfter: incomeStyle.display,
        actionPaddingLeft: getComputedStyle(document.querySelector('.top-bar-actions')!).paddingLeft,
        actionPaddingRight: getComputedStyle(document.querySelector('.top-bar-actions')!).paddingRight,
      };
    });
    expect(styles.expense).toBe('hidden');
    expect(styles.income).toBe('hidden');
    expect(styles.expenseAfter).toBe('none');
    expect(styles.incomeAfter).toBe('none');
    expect(parseFloat(styles.actionPaddingLeft)).toBeGreaterThanOrEqual(10);
    expect(parseFloat(styles.actionPaddingRight)).toBeGreaterThanOrEqual(10);
  });

  test('keeps narrow mobile record controls inside the viewport after scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 293, height: 199 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'narrow-mobile-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Narrow Mobile');
      localStorage.setItem('userEmail', 'narrow@example.com');
    });

    await emptyApi(page);
    await page.goto('/dashboard.html');
    await expect(page.locator('.top-bar')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 240));

    const viewport = { width: 293, height: 199 };
    const boxes = await Promise.all([
      page.locator('#openModalBtn').boundingBox(),
      page.locator('#openIncomeModalBtn').boundingBox(),
    ]);
    expect(boxes[0]).not.toBeNull();
    expect(boxes[1]).not.toBeNull();

    for (const box of boxes) {
      const rect = box!;
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
    }

    const header = await page.locator('.top-bar').boundingBox();
    expect(header).not.toBeNull();
    expect(header!.y).toBeGreaterThanOrEqual(0);
  });

  test('does not reload the dashboard spontaneously after initial navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'refresh-regression-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Refresh Test');
      localStorage.setItem('userEmail', 'refresh@example.com');
    });

    await emptyApi(page);
    let mainFrameNavigations = 0;
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) mainFrameNavigations += 1;
    });

    await page.goto('/dashboard.html');
    mainFrameNavigations = 0;
    await page.waitForTimeout(5000);

    expect(mainFrameNavigations).toBe(0);
    expect(page.url()).toContain('dashboard.html');
  });

  test('keeps ledger stream controls horizontally accessible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'ledger-regression-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Ledger Test');
    });

    await emptyApi(page);
    await page.goto('/dashboard.html');

    const tabs = page.locator('#ledgerStreamTabs, .ledger-stream-tabs').first();
    await expect(tabs).toBeVisible();

    const metrics = await tabs.evaluate(el => {
      const style = getComputedStyle(el);
      return {
        overflowX: style.overflowX,
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        children: Array.from(el.children).map(child => ({
          width: (child as HTMLElement).getBoundingClientRect().width
        }))
      };
    });

    expect(metrics.overflowX).toBe('auto');
    expect(metrics.children.length).toBeGreaterThan(0);
    expect(metrics.children.every(child => child.width > 0)).toBe(true);
    expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
  });
});