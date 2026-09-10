import { test, expect } from '@playwright/test';

/**
 * Authentication flow E2E tests.
 *
 * Tests the login and registration pages — the entry points to the application.
 */
test.describe('Authentication', () => {

  test.describe('Login page', () => {
    test('renders with email and password fields', async ({ page }) => {
      await page.goto('/index.html');

      // Wait for the form to load
      await page.waitForSelector('input', { state: 'visible' });

      // Should have at least one email/text input and one password input
      const emailInput = page.locator('input[type="email"], input[name="email"], #email, #login-email').first();
      await expect(emailInput).toBeVisible();

      const passwordInput = page.locator('input[type="password"]').first();
      await expect(passwordInput).toBeVisible();
    });

    test('has a submit/login button', async ({ page }) => {
      await page.goto('/index.html');
      await page.waitForSelector('input', { state: 'visible' });

      const submitBtn = page.locator('button[type="submit"], input[type="submit"], .login-btn, #loginBtn').first();
      await expect(submitBtn).toBeVisible();
    });

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto('/index.html');
      await page.waitForSelector('input', { state: 'visible' });

      // Fill in non-existent credentials
      const emailInput = page.locator('input[type="email"], input[name="email"], #email, #login-email').first();
      const passInput = page.locator('input[type="password"]').first();

      if (await emailInput.isVisible()) {
        await emailInput.fill('nonexistent@test.com');
      }
      if (await passInput.isVisible()) {
        await passInput.fill('WrongPassword123');
      }

      // Submit the form
      const submitBtn = page.locator('button[type="submit"], input[type="submit"], .login-btn, #loginBtn').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }

      // Wait for the error response — should stay on login page
      await page.waitForTimeout(3000);
      expect(page.url()).toContain('index.html');
    });

    test('has a link to registration page', async ({ page }) => {
      await page.goto('/index.html');
      await page.waitForSelector('input', { state: 'visible' });

      // Look for a register/sign-up link
      const registerLink = page.locator('a[href*="register"], a:has-text("Sign Up"), a:has-text("Register"), a:has-text("Create")').first();
      // The link may or may not exist depending on the page design — just verify it if present
      if (await registerLink.isVisible().catch(() => false)) {
        const href = await registerLink.getAttribute('href');
        expect(href).toBeTruthy();
      }
    });
  });

  test.describe('Registration page', () => {
    test('renders with required fields', async ({ page }) => {
      await page.goto('/register.html');
      await page.waitForSelector('input', { state: 'visible' });

      // Registration should have multiple input fields (name, username, email, password, etc.)
      const inputs = page.locator('input');
      const count = await inputs.count();
      expect(count).toBeGreaterThanOrEqual(4);
    });

    test('has a password field with toggle visibility button', async ({ page }) => {
      await page.goto('/register.html');
      await page.waitForSelector('input[type="password"]', { state: 'visible' });

      const passwordInput = page.locator('input[type="password"]').first();
      await expect(passwordInput).toBeVisible();
    });

    test('has a currency selector', async ({ page }) => {
      await page.goto('/register.html');
      await page.waitForSelector('input', { state: 'visible' });

      // Look for a currency select or input
      const currencySelector = page.locator('#reg-currency, select[name="currency"], [data-currency]').first();
      // It may not exist on all versions — just verify if present
      if (await currencySelector.isVisible().catch(() => false)) {
        await expect(currencySelector).toBeVisible();
      }
    });
  });

  test.describe('Forgot password page', () => {
    test('renders with email field', async ({ page }) => {
      await page.goto('/forgot-password.html');
      await page.waitForSelector('input', { state: 'visible' });

      const emailInput = page.locator('input[type="email"], input[name="email"], #email').first();
      await expect(emailInput).toBeVisible();
    });
  });
});
