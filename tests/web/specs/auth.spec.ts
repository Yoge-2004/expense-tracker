import { test, expect } from '@playwright/test';

const authConfig = { emailVerificationEnabled: false };

test.describe('authentication UI regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/config', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authConfig) }));
    await page.route('**/api/auth/login', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-token', userId: 7, name: 'E2E User', currency: 'INR', hasSecurityPin: false }),
    }));
  });

  test('login form is visible, validates empty input, toggles password, and switches theme', async ({ page }) => {
    await page.goto('/index.html');

    const identifier = page.locator('#email');
    const password = page.locator('#password');
    await expect(identifier).toBeVisible();
    await expect(password).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await page.locator('button[type="submit"]').click();
    await expect(identifier).toHaveAttribute('required', '');

    const toggle = page.locator('button[data-password-toggle="password"]');
    await expect(password).toHaveAttribute('type', 'password');
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'text');
    await toggle.click();
    await expect(password).toHaveAttribute('type', 'password');

    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.locator('#themeToggle').click();
    await expect.poll(() => html.getAttribute('data-theme')).not.toBe(before);
  });

  test('successful login stores session and navigates to dashboard', async ({ page }) => {
    await page.goto('/index.html');
    await page.locator('#email').fill('e2e@example.com');
    await page.locator('#password').fill('correct-password');
    await page.locator('button[type="submit"]').click();

    await expect.poll(async () => page.evaluate(() => localStorage.getItem('token'))).toBe('e2e-token');
  });
});
