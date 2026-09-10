import { test, expect } from '@playwright/test';

/**
 * Targeted regressions for UI behavior that is easy to break during CSS/animation work.
 * These tests intentionally validate structure and computed layout rather than visuals.
 */
test.describe('Targeted UI regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-ui-regression-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
      localStorage.setItem('userEmail', 'test@test.com');
      localStorage.setItem('theme', 'dark');
    });
    await page.goto('/dashboard.html');
    await page.waitForSelector('.top-bar', { state: 'visible', timeout: 5000 });
  });

  test('keeps form input icons visible and positioned inside their wrappers', async ({ page }) => {
    const icons = page.locator('.input-wrapper > .input-icon, .input-wrapper > svg.input-icon');
    expect(await icons.count()).toBeGreaterThan(0);

    const firstIcon = icons.first();
    await expect(firstIcon).toBeVisible();

    const position = await firstIcon.evaluate((element) => getComputedStyle(element).position);
    expect(position).toBe('absolute');
  });

  test('keeps subscription modal tabs attached and usable', async ({ page }) => {
    await expect(page.locator('#manageSubsBtn')).toBeAttached();
    await expect(page.locator('#subsTabExpensesBtn')).toBeAttached();
    await expect(page.locator('#subsTabIncomesBtn')).toBeAttached();

    await page.locator('#manageSubsBtn').click();
    await expect(page.locator('#subsTabExpensesBtn')).toBeVisible();
    await expect(page.locator('#subsTabIncomesBtn')).toBeVisible();

    await page.locator('#subsTabIncomesBtn').click();
    await expect(page.locator('#subsTabIncomesBtn')).toHaveClass(/active/);
    await page.locator('#subsTabExpensesBtn').click();
    await expect(page.locator('#subsTabExpensesBtn')).toHaveClass(/active/);
  });

  test('switches theme without losing the explicit theme state', async ({ page }) => {
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', 'dark');

    await page.locator('#themeToggle').click();
    await expect.poll(async () => root.getAttribute('data-theme')).toBe('light');

    await page.locator('#themeToggle').click();
    await expect.poll(async () => root.getAttribute('data-theme')).toBe('dark');
  });

  test('removes redundant income inline handlers while preserving the global API', async ({ page }) => {
    for (const selector of ['#openIncomeModalBtn', '#addIncomeTableBtn']) {
      await expect.poll(async () => page.locator(selector).getAttribute('onclick')).toBeNull();
    }

    await expect.poll(async () => page.evaluate(() => typeof window.openNewIncomeModal)).toBe('function');
  });
});
