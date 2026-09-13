import { test, expect } from '@playwright/test';

/**
 * High-value regressions that must exercise the actual dashboard DOM state,
 * not only CSS geometry.
 */
test.describe('Critical UI regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-critical-ui-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
      localStorage.setItem('userEmail', 'test@test.com');
      localStorage.setItem('theme', 'dark');
    });
    await page.goto('/dashboard.html');
    await page.waitForSelector('.top-bar', { state: 'visible', timeout: 5000 });
  });

  test('preserves the shared font import in the stylesheet contract', async ({ page }) => {
    const stylesheet = await page.evaluate(async () => fetch('/css/style.css').then(response => response.text()));

    expect(stylesheet).toContain('@import url');
    expect(stylesheet).toContain('fonts.googleapis.com');
    expect(stylesheet).toContain('Fraunces');
    expect(stylesheet).toContain('Hanken+Grotesk');
    expect(stylesheet).toContain('IBM+Plex+Mono');
  });

  test('opens and visibly renders the expense modal', async ({ page }) => {
    const modal = page.locator('#expenseModal');
    const dialog = modal.locator(':scope > .modal');

    await expect(modal).not.toHaveClass(/active/);
    await page.locator('#openModalBtn').click();
    await expect(modal).toHaveClass(/active/);
    await expect.poll(async () => dialog.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
    await expect.poll(async () => page.evaluate(() => document.body.classList.contains('modal-open'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/active/);
    await expect.poll(async () => page.evaluate(() => document.body.classList.contains('modal-open'))).toBe(false);
  });

  test('opens and visibly renders the income modal without inline handlers', async ({ page }) => {
    const trigger = page.locator('#openIncomeModalBtn');
    const modal = page.locator('#incomeModal');
    const dialog = modal.locator(':scope > .modal');

    await expect(trigger).toHaveAttribute('onclick', '');
    await page.locator('#openIncomeModalBtn').click();
    await expect(modal).toHaveClass(/active/);
    await expect.poll(async () => dialog.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);

    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/active/);
  });
});
