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

type Box = { x: number; y: number; width: number; height: number };

/** True when the boxes do not overlap and are at least `gap` px apart, side by side or stacked. */
const separated = (a: Box, b: Box, gap: number) =>
  a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x ||
  a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y;

/** Whether either record button label is clipped by its button. */
const labelsTruncated = (page: Page) => page.evaluate(() =>
  ['#openModalBtn > span', '#openIncomeModalBtn > span'].map((selector) => {
    const label = document.querySelector<HTMLElement>(selector)!;
    return label.scrollWidth > label.clientWidth;
  }));

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

    // Narrow phones stack the two controls full width so neither label is truncated.
    const first = boxes[0]!;
    const second = boxes[1]!;
    for (const box of [first, second]) {
      expect(box.x).toBeGreaterThanOrEqual(10);
      expect(box.x + box.width).toBeLessThanOrEqual(375 - 10);
      expect(box.width).toBeGreaterThan(120);
    }
    expect(separated(first, second, 6)).toBe(true);
    expect(await labelsTruncated(page)).toEqual([false, false]);

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
      };
    });
    expect(styles.expense).toBe('hidden');
    expect(styles.income).toBe('hidden');
    expect(styles.expenseAfter).toBe('none');
    expect(styles.incomeAfter).toBe('none');
  });

  test('keeps narrow mobile record controls inside the viewport and unclipped', async ({ page }) => {
    await page.setViewportSize({ width: 293, height: 261 });
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

    const expenseButton = page.locator('#openModalBtn');
    const incomeButton = page.locator('#openIncomeModalBtn');
    await incomeButton.scrollIntoViewIfNeeded();
    await expect(expenseButton).toBeInViewport();
    await expect(incomeButton).toBeInViewport();

    const viewport = { width: 293, height: 261 };
    const boxes = await Promise.all([expenseButton.boundingBox(), incomeButton.boundingBox()]);
    expect(boxes[0]).not.toBeNull();
    expect(boxes[1]).not.toBeNull();

    const expense = boxes[0]!;
    const income = boxes[1]!;
    for (const box of [expense, income]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(separated(expense, income, 6)).toBe(true);
    expect(await labelsTruncated(page)).toEqual([false, false]);
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
