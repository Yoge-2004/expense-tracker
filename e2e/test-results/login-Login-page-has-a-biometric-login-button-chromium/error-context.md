# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login page >> has a biometric login button
- Location: tests/login.spec.ts:38:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#biometricLoginBtn')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" locator('#biometricLoginBtn') with timeout 10000ms
  - waiting for locator('#biometricLoginBtn')
    18 × locator resolved to <button type="button" id="biometricLoginBtn" class="btn-secondary btn-full touch-pressable">…</button>
       - unexpected value "hidden"

```

```yaml
- text: 💎">
- main:
  - img
  - text: ExpenseTracker PRO
  - button "Switch to Light Theme":
    - img
  - heading "Your money, fully in control." [level=1]
  - paragraph: Get clarity on every dollar you spend. Smart budgets, recurring trackers, and beautiful analytics — all in one place.
  - img
  - text: $2,480 Saved this month
  - img
  - text: 12 budgets Active & tracking
  - img
  - text: 6 subscriptions Auto-tracked
  - img
  - text: Smart analytics
  - img
  - text: Budget alerts
  - img
  - text: Recurring tracking
  - img
  - text: Cross-platform
  - img
  - text: Monthly Cashflow Telemetry Real-time burn rate & retention 94% on track Essentials 42% Savings 28% Invest 18% Leisure 12% ★ ★ ★ ★ ★ 5.0 · Verified Ledger
  - paragraph: "\"ExpenseTracker Pro caught redundant recurring subscriptions in my first week. Absolute game-changer for clarity.\""
  - text: ER Elena Rostova Staff Product Architect · 24-Month Member
  - img
  - text: Verified
  - img
  - text: AES-256 Vault •
  - img
  - text: Sub-ms Queries •
  - img
  - text: Zero 3rd-Party Trackers Secure Login
  - heading "Welcome back" [level=2]
  - paragraph: Sign in to your financial workspace
  - text: Username or Email Address
  - img
  - textbox "Username or Email Address":
    - /placeholder: Enter your username or email
  - text: Password
  - link "Forgot password?":
    - /url: forgot-password.html
  - img
  - textbox "Password":
    - /placeholder: ••••••••
  - button "Toggle password":
    - img
  - button "Sign In":
    - text: Sign In
    - img
  - text: or continue with
  - button "Continue with Google"
  - paragraph:
    - text: Don't have an account?
    - link "Create one free":
      - /url: register.html
- text: Connecting to the server… Waking up server...
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * Login & Authentication page E2E tests.
  5   |  *
  6   |  * Tests the login page (index.html) — the entry point to the application.
  7   |  * Covers: form rendering, input validation, OAuth button, biometric login,
  8   |  * theme toggle, navigation to register/forgot-password pages.
  9   |  */
  10  | test.describe('Login page', () => {
  11  | 
  12  |   test.beforeEach(async ({ page }) => {
  13  |     await page.goto('/index.html');
  14  |     await page.waitForSelector('#loginForm', { state: 'visible' });
  15  |   });
  16  | 
  17  |   test('renders the login form with email and password fields', async ({ page }) => {
  18  |     await expect(page.locator('#email')).toBeVisible();
  19  |     await expect(page.locator('#password')).toBeVisible();
  20  |     await expect(page.locator('#loginBtn')).toBeVisible();
  21  |   });
  22  | 
  23  |   test('email field accepts email input', async ({ page }) => {
  24  |     await page.locator('#email').fill('test@example.com');
  25  |     await expect(page.locator('#email')).toHaveValue('test@example.com');
  26  |   });
  27  | 
  28  |   test('password field masks input', async ({ page }) => {
  29  |     await page.locator('#password').fill('SecretPass123');
  30  |     const type = await page.locator('#password').getAttribute('type');
  31  |     expect(type).toBe('password');
  32  |   });
  33  | 
  34  |   test('has a Google OAuth login button', async ({ page }) => {
  35  |     await expect(page.locator('#googleOAuthBtn')).toBeVisible();
  36  |   });
  37  | 
  38  |   test('has a biometric login button', async ({ page }) => {
> 39  |     await expect(page.locator('#biometricLoginBtn')).toBeVisible();
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  40  |   });
  41  | 
  42  |   test('has a theme toggle button', async ({ page }) => {
  43  |     await expect(page.locator('#themeToggle')).toBeVisible();
  44  |   });
  45  | 
  46  |   test('theme toggle switches between light and dark', async ({ page }) => {
  47  |     const body = page.locator('body');
  48  |     const initialTheme = await body.getAttribute('data-theme');
  49  | 
  50  |     await page.locator('#themeToggle').click();
  51  |     await page.waitForTimeout(300);
  52  | 
  53  |     const newTheme = await body.getAttribute('data-theme');
  54  |     expect(newTheme).not.toBeNull();
  55  |     // The theme should have changed (or at least the toggle was clickable)
  56  |   });
  57  | 
  58  |   test('shows error for empty form submission', async ({ page }) => {
  59  |     await page.locator('#loginBtn').click();
  60  |     await page.waitForTimeout(2000);
  61  |     // Should stay on login page
  62  |     expect(page.url()).toContain('index.html');
  63  |   });
  64  | 
  65  |   test('shows error for invalid credentials', async ({ page }) => {
  66  |     await page.locator('#email').fill('nonexistent@test.com');
  67  |     await page.locator('#password').fill('WrongPassword123');
  68  |     await page.locator('#loginBtn').click();
  69  |     await page.waitForTimeout(3000);
  70  |     // Should stay on login page (not redirected to dashboard)
  71  |     expect(page.url()).toContain('index.html');
  72  |   });
  73  | 
  74  |   test('has a link to register page', async ({ page }) => {
  75  |     const registerLink = page.locator('a[href*="register"], a:has-text("Sign Up"), a:has-text("Register"), a:has-text("Create")');
  76  |     const count = await registerLink.count();
  77  |     if (count > 0) {
  78  |       await expect(registerLink.first()).toBeVisible();
  79  |     }
  80  |   });
  81  | 
  82  |   test('has a link to forgot password page', async ({ page }) => {
  83  |     const forgotLink = page.locator('a[href*="forgot"], a:has-text("Forgot")');
  84  |     const count = await forgotLink.count();
  85  |     if (count > 0) {
  86  |       await expect(forgotLink.first()).toBeVisible();
  87  |     }
  88  |   });
  89  | 
  90  |   test('hero section displays saved amount', async ({ page }) => {
  91  |     // The login page has a hero section with saved amount display
  92  |     await expect(page.locator('#heroSavedAmount')).toBeVisible();
  93  |   });
  94  | 
  95  |   test('hero section displays currency word', async ({ page }) => {
  96  |     await expect(page.locator('#heroCurrencyWord')).toBeVisible();
  97  |   });
  98  | 
  99  |   test('hero section has subline text', async ({ page }) => {
  100 |     await expect(page.locator('#heroSubline')).toBeVisible();
  101 |   });
  102 | });
  103 | 
  104 | test.describe('Registration page', () => {
  105 | 
  106 |   test.beforeEach(async ({ page }) => {
  107 |     await page.goto('/register.html');
  108 |     await page.waitForSelector('#registerForm', { state: 'visible' });
  109 |   });
  110 | 
  111 |   test('renders all required form fields', async ({ page }) => {
  112 |     await expect(page.locator('#reg-name')).toBeVisible();
  113 |     await expect(page.locator('#reg-username')).toBeVisible();
  114 |     await expect(page.locator('#reg-email')).toBeVisible();
  115 |     await expect(page.locator('#reg-password')).toBeVisible();
  116 |   });
  117 | 
  118 |   test('has a currency selector', async ({ page }) => {
  119 |     await expect(page.locator('#reg-currency')).toBeVisible();
  120 |   });
  121 | 
  122 |   test('has a security PIN field (optional)', async ({ page }) => {
  123 |     await expect(page.locator('#reg-security-pin')).toBeVisible();
  124 |   });
  125 | 
  126 |   test('has an OTP field group', async ({ page }) => {
  127 |     await expect(page.locator('#otpGroup')).toBeVisible();
  128 |   });
  129 | 
  130 |   test('has a send OTP button', async ({ page }) => {
  131 |     await expect(page.locator('#sendOtpBtn')).toBeVisible();
  132 |   });
  133 | 
  134 |   test('has a resend OTP button', async ({ page }) => {
  135 |     await expect(page.locator('#resendOtpBtn')).toBeVisible();
  136 |   });
  137 | 
  138 |   test('has a register button', async ({ page }) => {
  139 |     await expect(page.locator('#registerBtn')).toBeVisible();
```