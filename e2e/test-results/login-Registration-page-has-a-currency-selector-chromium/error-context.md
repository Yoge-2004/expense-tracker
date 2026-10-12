# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Registration page >> has a currency selector
- Location: tests/login.spec.ts:118:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('#reg-currency')
Expected: visible
Received: hidden
Timeout:  10000ms

Call log:
  - Expect "toBeVisible" locator('#reg-currency') with timeout 10000ms
  - waiting for locator('#reg-currency')
    20 × locator resolved to <input value="USD" type="hidden" id="reg-currency"/>
       - unexpected value "hidden"

```

```yaml
- text: 💎">
- main:
  - img
  - text: ExpenseTracker PRO
  - link "Sign In":
    - /url: index.html
    - img
    - text: Sign In
  - button "Switch to Light Theme":
    - img
  - heading "Start your financial journey." [level=1]
  - paragraph: Join thousands of users who already track smarter, budget better, and save more every month.
  - img
  - text: Bank-grade security Your data is always encrypted
  - img
  - text: Smart analytics Category breakdowns & trends
  - img
  - text: Subscription tracking Never miss a recurring charge
  - img
  - text: Budget alerts Know before you overspend
  - img
  - text: Everything Included on Day 1 Instant zero-friction setup Free Forever
  - img
  - text: Predictive Overspend Prevention Dynamic warnings notify you before monthly budget limits are breached.
  - img
  - text: 160+ Dynamic Currencies & Multi-Ledgers Adapts seamlessly to your location with real-time exchange rates.
  - img
  - text: AI-Assisted Smart Categorization Automatically classifies transactions to detect leakages and recurring fees.
  - img
  - text: Audit-Ready 1-Click CSV & PDF Exports Download complete, pristine ledger statements anytime without lock-in. Unlimited Accounts Live FX Conversion Multi-Device Sync ★ ★ ★ ★ ★ 4.9 / 5.0 Rating 12,800+ Savers
  - paragraph: "\"Setup took less than 45 seconds. The real-time spending telemetry and automated leak detection helped our household save over $3,200 this quarter.\""
  - text: MK Marcus Kim Founder, StudioCraft · Verified Member
  - img
  - text: Verified
  - img
  - text: Instant Data Export •
  - img
  - text: 100% Private & Ad-Free Free to start
  - heading "Create your account" [level=2]
  - paragraph: Set up in under a minute
  - text: 1 Full Name
  - img
  - textbox "1 Full Name":
    - /placeholder: John Doe
  - text: 2 Username
  - img
  - textbox "2 Username":
    - /placeholder: johndoe_26
  - text: 3 Email Address
  - img
  - textbox "3 Email Address":
    - /placeholder: name@example.com
  - text: 4 Preferred Currency
  - img
  - combobox:
    - text: 🇺🇸 USD ($) — US Dollar
    - img
  - text: 5 Password
  - img
  - textbox "5 Password":
    - /placeholder: Min. 8 chars (A-z, 0-9, !@#)
  - button "Toggle password":
    - img
  - text: 6 6-Digit Security PIN (Optional) Zero-Email Recovery
  - img
  - textbox "6 6-Digit Security PIN (Optional)":
    - /placeholder: e.g. 123456 (6 digits)
  - button "Toggle PIN":
    - img
  - button "Create Account":
    - text: Create Account
    - img
  - text: or sign up with
  - button "Continue with Google"
  - paragraph:
    - text: Already have an account?
    - link "Sign In":
      - /url: index.html
- text: Connecting to the server… Waking up server...
```

# Test source

```ts
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
  39  |     await expect(page.locator('#biometricLoginBtn')).toBeVisible();
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
> 119 |     await expect(page.locator('#reg-currency')).toBeVisible();
      |                                                 ^ Error: expect(locator).toBeVisible() failed
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
  140 |   });
  141 | 
  142 |   test('has a Google OAuth button', async ({ page }) => {
  143 |     await expect(page.locator('#googleOAuthBtn')).toBeVisible();
  144 |   });
  145 | 
  146 |   test('has a step progress indicator with 6 dots', async ({ page }) => {
  147 |     await expect(page.locator('#stepBar')).toBeVisible();
  148 |     await expect(page.locator('#dot1')).toBeVisible();
  149 |     await expect(page.locator('#dot2')).toBeVisible();
  150 |     await expect(page.locator('#dot3')).toBeVisible();
  151 |     await expect(page.locator('#dot4')).toBeVisible();
  152 |     await expect(page.locator('#dot5')).toBeVisible();
  153 |     await expect(page.locator('#dot6')).toBeVisible();
  154 |   });
  155 | 
  156 |   test('has a theme toggle button', async ({ page }) => {
  157 |     await expect(page.locator('#themeToggle')).toBeVisible();
  158 |   });
  159 | 
  160 |   test('name field accepts text input', async ({ page }) => {
  161 |     await page.locator('#reg-name').fill('John Doe');
  162 |     await expect(page.locator('#reg-name')).toHaveValue('John Doe');
  163 |   });
  164 | 
  165 |   test('username field accepts alphanumeric input', async ({ page }) => {
  166 |     await page.locator('#reg-username').fill('johndoe123');
  167 |     await expect(page.locator('#reg-username')).toHaveValue('johndoe123');
  168 |   });
  169 | 
  170 |   test('email field accepts email format', async ({ page }) => {
  171 |     await page.locator('#reg-email').fill('john@test.com');
  172 |     await expect(page.locator('#reg-email')).toHaveValue('john@test.com');
  173 |   });
  174 | 
  175 |   test('password field masks input', async ({ page }) => {
  176 |     await page.locator('#reg-password').fill('SecurePass123');
  177 |     const type = await page.locator('#reg-password').getAttribute('type');
  178 |     expect(type).toBe('password');
  179 |   });
  180 | 
  181 |   test('security PIN field accepts only 6 digits', async ({ page }) => {
  182 |     await page.locator('#reg-security-pin').fill('123456');
  183 |     await expect(page.locator('#reg-security-pin')).toHaveValue('123456');
  184 |   });
  185 | });
  186 | 
  187 | test.describe('Forgot password page', () => {
  188 | 
  189 |   test.beforeEach(async ({ page }) => {
  190 |     await page.goto('/forgot-password.html');
  191 |     await page.waitForSelector('input', { state: 'visible' });
  192 |   });
  193 | 
  194 |   test('renders with email field', async ({ page }) => {
  195 |     const emailInput = page.locator('input[type="email"], input[name="email"], #email').first();
  196 |     await expect(emailInput).toBeVisible();
  197 |   });
  198 | 
  199 |   test('has a theme toggle button', async ({ page }) => {
  200 |     const themeToggle = page.locator('#themeToggle');
  201 |     if (await themeToggle.isVisible().catch(() => false)) {
  202 |       await expect(themeToggle).toBeVisible();
  203 |     }
  204 |   });
  205 | 
  206 |   test('has a submit/reset button', async ({ page }) => {
  207 |     const submitBtn = page.locator('button[type="submit"], input[type="submit"], .submit-btn, button:has-text("Reset"), button:has-text("Send")');
  208 |     const count = await submitBtn.count();
  209 |     expect(count).toBeGreaterThan(0);
  210 |   });
  211 | 
  212 |   test('has password strength meter segments', async ({ page }) => {
  213 |     // The forgot-password page has a strength meter with 4 segments
  214 |     const seg1 = page.locator('#seg1');
  215 |     if (await seg1.isVisible().catch(() => false)) {
  216 |       await expect(seg1).toBeVisible();
  217 |       await expect(page.locator('#seg2')).toBeVisible();
  218 |       await expect(page.locator('#seg3')).toBeVisible();
  219 |       await expect(page.locator('#seg4')).toBeVisible();
```