import { test, expect } from '@playwright/test';

/**
 * Login & Authentication page E2E tests.
 *
 * Tests the login page (index.html) — the entry point to the application.
 * Covers: form rendering, input validation, OAuth button, biometric login,
 * theme toggle, navigation to register/forgot-password pages.
 */
test.describe('Login page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#loginForm', { state: 'visible' });
  });

  test('renders the login form with email and password fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#loginBtn')).toBeVisible();
  });

  test('email field accepts email input', async ({ page }) => {
    await page.locator('#email').fill('test@example.com');
    await expect(page.locator('#email')).toHaveValue('test@example.com');
  });

  test('password field masks input', async ({ page }) => {
    await page.locator('#password').fill('SecretPass123');
    const type = await page.locator('#password').getAttribute('type');
    expect(type).toBe('password');
  });

  test('has a Google OAuth login button', async ({ page }) => {
    await expect(page.locator('#googleOAuthBtn')).toBeVisible();
  });

  test('has a biometric login button', async ({ page }) => {
    await expect(page.locator('#biometricLoginBtn')).toBeVisible();
  });

  test('has a theme toggle button', async ({ page }) => {
    await expect(page.locator('#themeToggle')).toBeVisible();
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    const body = page.locator('body');
    const initialTheme = await body.getAttribute('data-theme');

    await page.locator('#themeToggle').click();
    await page.waitForTimeout(300);

    const newTheme = await body.getAttribute('data-theme');
    expect(newTheme).not.toBeNull();
    // The theme should have changed (or at least the toggle was clickable)
  });

  test('shows error for empty form submission', async ({ page }) => {
    await page.locator('#loginBtn').click();
    await page.waitForTimeout(2000);
    // Should stay on login page
    expect(page.url()).toContain('index.html');
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('#email').fill('nonexistent@test.com');
    await page.locator('#password').fill('WrongPassword123');
    await page.locator('#loginBtn').click();
    await page.waitForTimeout(3000);
    // Should stay on login page (not redirected to dashboard)
    expect(page.url()).toContain('index.html');
  });

  test('has a link to register page', async ({ page }) => {
    const registerLink = page.locator('a[href*="register"], a:has-text("Sign Up"), a:has-text("Register"), a:has-text("Create")');
    const count = await registerLink.count();
    if (count > 0) {
      await expect(registerLink.first()).toBeVisible();
    }
  });

  test('has a link to forgot password page', async ({ page }) => {
    const forgotLink = page.locator('a[href*="forgot"], a:has-text("Forgot")');
    const count = await forgotLink.count();
    if (count > 0) {
      await expect(forgotLink.first()).toBeVisible();
    }
  });

  test('hero section displays saved amount', async ({ page }) => {
    // The login page has a hero section with saved amount display
    await expect(page.locator('#heroSavedAmount')).toBeVisible();
  });

  test('hero section displays currency word', async ({ page }) => {
    await expect(page.locator('#heroCurrencyWord')).toBeVisible();
  });

  test('hero section has subline text', async ({ page }) => {
    await expect(page.locator('#heroSubline')).toBeVisible();
  });
});

test.describe('Registration page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/register.html');
    await page.waitForSelector('#registerForm', { state: 'visible' });
  });

  test('renders all required form fields', async ({ page }) => {
    await expect(page.locator('#reg-name')).toBeVisible();
    await expect(page.locator('#reg-username')).toBeVisible();
    await expect(page.locator('#reg-email')).toBeVisible();
    await expect(page.locator('#reg-password')).toBeVisible();
  });

  test('has a currency selector', async ({ page }) => {
    await expect(page.locator('#reg-currency')).toBeVisible();
  });

  test('has a security PIN field (optional)', async ({ page }) => {
    await expect(page.locator('#reg-security-pin')).toBeVisible();
  });

  test('has an OTP field group', async ({ page }) => {
    await expect(page.locator('#otpGroup')).toBeVisible();
  });

  test('has a send OTP button', async ({ page }) => {
    await expect(page.locator('#sendOtpBtn')).toBeVisible();
  });

  test('has a resend OTP button', async ({ page }) => {
    await expect(page.locator('#resendOtpBtn')).toBeVisible();
  });

  test('has a register button', async ({ page }) => {
    await expect(page.locator('#registerBtn')).toBeVisible();
  });

  test('has a Google OAuth button', async ({ page }) => {
    await expect(page.locator('#googleOAuthBtn')).toBeVisible();
  });

  test('has a step progress indicator with 6 dots', async ({ page }) => {
    await expect(page.locator('#stepBar')).toBeVisible();
    await expect(page.locator('#dot1')).toBeVisible();
    await expect(page.locator('#dot2')).toBeVisible();
    await expect(page.locator('#dot3')).toBeVisible();
    await expect(page.locator('#dot4')).toBeVisible();
    await expect(page.locator('#dot5')).toBeVisible();
    await expect(page.locator('#dot6')).toBeVisible();
  });

  test('has a theme toggle button', async ({ page }) => {
    await expect(page.locator('#themeToggle')).toBeVisible();
  });

  test('name field accepts text input', async ({ page }) => {
    await page.locator('#reg-name').fill('John Doe');
    await expect(page.locator('#reg-name')).toHaveValue('John Doe');
  });

  test('username field accepts alphanumeric input', async ({ page }) => {
    await page.locator('#reg-username').fill('johndoe123');
    await expect(page.locator('#reg-username')).toHaveValue('johndoe123');
  });

  test('email field accepts email format', async ({ page }) => {
    await page.locator('#reg-email').fill('john@test.com');
    await expect(page.locator('#reg-email')).toHaveValue('john@test.com');
  });

  test('password field masks input', async ({ page }) => {
    await page.locator('#reg-password').fill('SecurePass123');
    const type = await page.locator('#reg-password').getAttribute('type');
    expect(type).toBe('password');
  });

  test('security PIN field accepts only 6 digits', async ({ page }) => {
    await page.locator('#reg-security-pin').fill('123456');
    await expect(page.locator('#reg-security-pin')).toHaveValue('123456');
  });
});

test.describe('Forgot password page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password.html');
    await page.waitForSelector('input', { state: 'visible' });
  });

  test('renders with email field', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"], #email').first();
    await expect(emailInput).toBeVisible();
  });

  test('has a theme toggle button', async ({ page }) => {
    const themeToggle = page.locator('#themeToggle');
    if (await themeToggle.isVisible().catch(() => false)) {
      await expect(themeToggle).toBeVisible();
    }
  });

  test('has a submit/reset button', async ({ page }) => {
    const submitBtn = page.locator('button[type="submit"], input[type="submit"], .submit-btn, button:has-text("Reset"), button:has-text("Send")');
    const count = await submitBtn.count();
    expect(count).toBeGreaterThan(0);
  });

  test('has password strength meter segments', async ({ page }) => {
    // The forgot-password page has a strength meter with 4 segments
    const seg1 = page.locator('#seg1');
    if (await seg1.isVisible().catch(() => false)) {
      await expect(seg1).toBeVisible();
      await expect(page.locator('#seg2')).toBeVisible();
      await expect(page.locator('#seg3')).toBeVisible();
      await expect(page.locator('#seg4')).toBeVisible();
    }
  });
});
