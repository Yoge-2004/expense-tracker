# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: expenses.spec.ts >> Report period >> can click change report period button
- Location: tests/expenses.spec.ts:327:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#changeReportPeriodBtn')
    - locator resolved to <button type="button" id="changeReportPeriodBtn" title="Select another Month / Year" class="btn-icon btn-text-icon change-period-btn touch-pressable">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <section class="grid-4-metrics animate-cascade delay-2">…</section> from <main class="dashboard-container">…</main> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <section class="grid-4-metrics animate-cascade delay-2">…</section> from <main class="dashboard-container">…</main> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    3 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <section class="grid-4-metrics animate-cascade delay-2">…</section> from <main class="dashboard-container">…</main> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - main [ref=f1e2]:
    - generic [ref=f1e3]:
      - generic [ref=f1e4]:
        - generic [ref=f1e5]:
          - heading "ExpenseTracker PRO" [level=1] [ref=f1e6]:
            - text: ExpenseTracker
            - generic [ref=f1e7]: PRO
          - generic "System Connected" [ref=f1e8]
        - paragraph [ref=f1e9]: Welcome back, Test User
      - generic [ref=f1e10]:
        - generic [ref=f1e11]:
          - textbox "Search expenses and incomes" [ref=f1e15]:
            - /placeholder: Search expenses & incomes (Press / or Ctrl+K)...
          - generic [ref=f1e16]: Ctrl K
        - button "Record Expense" [ref=f1e17] [cursor=pointer]
        - button "Record Income" [ref=f1e20] [cursor=pointer]
        - generic [ref=f1e23]:
          - button "Switch to Light Theme" [ref=f1e24]
          - button "Open User Guide and Help" [ref=f1e35]
        - button "Account menu" [ref=f1e39]:
          - generic [ref=f1e40]: T
          - menu "Account menu":
            - generic:
              - generic: PREFERRED CURRENCY
              - paragraph: Changes the symbol shown — amounts aren't converted between currencies.
              - generic:
                - combobox:
                  - generic: 🇮🇳 INR (₹)
            - link "Edit Profile Name":
              - /url: "#"
            - link "View Monthly Report":
              - /url: "#"
            - link "Export Monthly Summary":
              - /url: "#"
            - link "Subscriptions":
              - /url: "#"
            - link "Security PIN":
              - /url: "#"
            - link "Real-Time Debit Alerts":
              - /url: "#"
            - link "Biometrics (Touch/Face ID)":
              - /url: "#"
            - link "User Guide & Help":
              - /url: "#"
            - link "ℹ️ About ExpenseTracker":
              - /url: "#"
            - link "Logout":
              - /url: "#"
            - link "Delete Account":
              - /url: "#"
    - generic [ref=f1e41]:
      - generic [ref=f1e42]:
        - generic [ref=f1e43]:
          - generic [ref=f1e44]: Total Inflow
          - generic [ref=f1e45]: Offline
        - generic [ref=f1e46]: Unavailable
      - generic [ref=f1e51]:
        - generic [ref=f1e52]:
          - generic [ref=f1e53]: Total Outflow
          - generic [ref=f1e54]: Offline
        - generic [ref=f1e55]: Unavailable
      - generic [ref=f1e60]:
        - generic [ref=f1e61]:
          - generic [ref=f1e62]: Net Cash Flow
          - generic [ref=f1e63]: Offline
        - generic [ref=f1e64]: Unavailable
        - generic [ref=f1e66]: "Burn:"
      - generic [ref=f1e70]:
        - generic [ref=f1e71]:
          - generic [ref=f1e72]: Savings Rate
          - generic [ref=f1e73]: Offline
        - generic [ref=f1e74]: Unavailable
      - generic [ref=f1e79]:
        - generic [ref=f1e80]:
          - generic [ref=f1e81]: Subscriptions
          - generic [ref=f1e82]: Offline
        - generic [ref=f1e83]: Unavailable
        - link "Manage Subscriptions →" [ref=f1e86]:
          - /url: "#"
    - generic [ref=f1e88]:
      - generic [ref=f1e89]:
        - generic [ref=f1e90]: SMART INTELLIGENCE
        - heading "Financial Pulse & Insights" [level=2] [ref=f1e94]
      - generic [ref=f1e95]: 100% Budget Health
    - generic [ref=f1e102]:
      - generic [ref=f1e104]:
        - generic [ref=f1e105]:
          - text: Category Breakdown
          - heading "Outflow Distribution" [level=3] [ref=f1e106]
        - generic [ref=f1e107]: All Time
      - generic [ref=f1e111]:
        - generic [ref=f1e112]:
          - text: Cashflow Velocity
          - heading "Spending History & Trend" [level=3] [ref=f1e113]
        - generic [ref=f1e114]: Up to 90 days
      - generic [ref=f1e118]:
        - generic [ref=f1e119]:
          - text: Spend Composition
          - heading "Recurring vs. One-Time" [level=3] [ref=f1e120]
        - generic [ref=f1e121]: All Time
      - generic [ref=f1e125]:
        - generic [ref=f1e126]:
          - text: Spending Habits
          - heading "By Day of Week" [level=3] [ref=f1e127]
        - generic [ref=f1e128]: All Time
      - generic [ref=f1e132]:
        - generic [ref=f1e133]:
          - text: Budget Governance
          - heading "Budget vs. Actual" [level=3] [ref=f1e134]
        - generic [ref=f1e135]: This period
    - generic [ref=f1e139]:
      - generic [ref=f1e140]:
        - text: Budget Governance
        - heading "Monthly Category Limits" [level=3] [ref=f1e141]
      - button "New Budget" [ref=f1e142]
    - generic [ref=f1e149]:
      - generic [ref=f1e150]:
        - generic [ref=f1e151]:
          - text: Wealth Accumulation
          - heading "Savings Goals & Milestones" [level=3] [ref=f1e152]
        - button "New Goal" [ref=f1e153]
      - generic [ref=f1e157]:
        - generic [ref=f1e158]: ⚠️
        - paragraph [ref=f1e159]: Server Connection Failed
        - generic [ref=f1e160]: Could not reach the server to load your savings goals.
        - button "Retry Connection" [ref=f1e161]
    - generic [ref=f1e163]:
      - generic [ref=f1e164]:
        - generic [ref=f1e165]:
          - text: Audit Trail & Cash Flow
          - heading "Transactions & Inflows Ledger" [level=2] [ref=f1e166]
        - generic [ref=f1e167]:
          - button "Import (.csv/.xlsx)" [ref=f1e168]:
            - text: Import
            - generic [ref=f1e172]: (.csv/.xlsx)
          - button "Excel" [ref=f1e173]
          - button "Executive Report" [ref=f1e177]
          - button "Statement" [ref=f1e180]
          - button "CSV" [ref=f1e185]
          - button "JSON" [ref=f1e186]
          - button "PDF" [ref=f1e187]
          - button "Show advanced filters" [ref=f1e188]
          - button "Inflow" [ref=f1e191]
          - button "Record Expense" [ref=f1e194]
      - generic [ref=f1e197]:
        - button "All Activity 0" [ref=f1e198]:
          - generic [ref=f1e199]: All Activity
          - generic [ref=f1e200]: "0"
        - button "Outflows 0" [ref=f1e201]:
          - generic [ref=f1e202]: Outflows
          - generic [ref=f1e203]: "0"
        - button "Inflows 0" [ref=f1e204]:
          - generic [ref=f1e205]: Inflows
          - generic [ref=f1e206]: "0"
      - button "All Transactions" [ref=f1e209]
      - generic:
        - generic:
          - generic:
            - generic: From
            - textbox "Start Date"
          - generic:
            - generic: To
            - textbox "End Date"
        - generic:
          - button "All Dates"
          - button "Today"
          - button "This Month"
          - button "Last 30 Days"
        - combobox:
          - option "All Months" [selected]
          - option "January"
          - option "February"
          - option "March"
          - option "April"
          - option "May"
          - option "June"
          - option "July"
          - option "August"
          - option "September"
          - option "October"
          - option "November"
          - option "December"
        - generic:
          - button "All Months"
        - combobox:
          - option "All Years" [selected]
        - generic:
          - button "All Years"
        - combobox:
          - option "All Categories" [selected]
        - generic:
          - button "All Categories"
        - combobox:
          - option "Newest First" [selected]
          - option "Oldest First"
          - option "High to Low"
          - option "Low to High"
        - generic:
          - button "Newest First"
        - button "Reset"
      - generic:
        - generic:
          - generic:
            - generic: From
            - textbox "Start Date"
          - generic:
            - generic: To
            - textbox "End Date"
        - combobox "Filter by Cadence":
          - option "All Frequencies" [selected]
          - option "Daily (Wages)"
          - option "Weekly (Wages)"
          - option "Monthly (Salary)"
          - option "Yearly"
          - option "Custom"
        - generic:
          - button "All Frequencies"
        - combobox "Sort Incomes":
          - option "Newest First" [selected]
          - option "Oldest First"
          - option "Highest Amount"
          - option "Lowest Amount"
        - generic:
          - button "Newest First"
        - button "Reset"
      - generic [ref=f1e210]:
        - generic [ref=f1e211]:
          - generic [ref=f1e212]:
            - generic [ref=f1e213]: Outflows (Expenses)
            - generic [ref=f1e214]: 0 items
          - generic [ref=f1e216]:
            - generic [ref=f1e217]: ⚠️
            - generic [ref=f1e218]: Server Connection Failed
            - generic [ref=f1e219]: Could not reach the server to load your transactions.
            - button "Retry Connection" [ref=f1e220]
        - generic [ref=f1e221]:
          - generic [ref=f1e222]:
            - generic [ref=f1e223]: Inflows (Earnings)
            - generic [ref=f1e224]: 0 items
          - generic [ref=f1e226]:
            - generic [ref=f1e227]: ⚠️
            - generic [ref=f1e228]: Server Connection Failed
            - generic [ref=f1e229]: Could not reach the server to load your income records.
            - button "Retry Connection" [ref=f1e230]
  - generic:
    - dialog "Record Expense ⚡ AI Ready":
      - generic:
        - generic:
          - heading "Record Expense ⚡ AI Ready" [level=3]:
            - text: Record Expense
            - generic "AI auto-categorization active": ⚡ AI Ready
        - button "Close": ×
      - generic:
        - generic:
          - generic "Click or drop a receipt image to auto-fill details":
            - generic:
              - generic: Scan Receipt / Bill (Tesseract OCR)
              - generic: Drop receipt or photo to auto-extract amount & merchant
            - button "Scan"
        - generic:
          - generic:
            - generic: Description
            - generic: ✨ Smart Assist
          - generic:
            - textbox "Description":
              - /placeholder: e.g. Uber ride home, AWS Cloud, Whole Foods
        - generic:
          - generic: Amount (₹)
          - spinbutton "0.00"
        - generic:
          - generic: Date
          - textbox
        - generic:
          - generic: Category
          - generic:
            - combobox
            - generic:
              - button "Select..."
            - button "Add custom category"
            - button "Manage categories"
        - generic:
          - generic:
            - generic: Make Recurring Subscription
            - checkbox "Make Recurring Subscription"
        - button "Save Expense"
  - generic:
    - dialog "Configure Budget":
      - generic:
        - heading "Configure Budget" [level=3]
        - button "Close": ×
      - generic:
        - generic:
          - generic: Category
          - combobox
          - generic:
            - button "Select..."
        - generic:
          - generic: Monthly Limit Amount (₹)
          - spinbutton "0.00"
        - generic:
          - generic: Period
          - combobox:
            - option "Monthly" [selected]
            - option "Weekly"
            - option "Yearly"
            - option "Custom Interval (Days)"
          - generic:
            - button "Monthly"
        - button "Save Budget"
  - generic:
    - dialog "Security PIN":
      - generic:
        - heading "Security PIN" [level=3]
        - button "Close": ×
      - paragraph:
        - text: Your 6-digit numeric Security PIN enables
        - strong: instant account recovery
        - text: without requiring email OTP.
      - generic:
        - generic:
          - generic: New 6-Digit PIN
          - textbox "••••••"
        - generic:
          - generic: Confirm 6-Digit PIN
          - textbox "••••••"
        - button "Save Security PIN"
  - generic:
    - dialog "Recurring Cashflow & Subscriptions":
      - generic:
        - generic:
          - heading "Recurring Cashflow & Subscriptions" [level=3]
          - paragraph: Active subscriptions and recurring income streams that renew automatically
        - button "Close": ×
      - generic:
        - button "Outflows (Subscriptions)"
        - button "Inflows (Recurring Income)"
        - button "Chits & Recurring Savings"
  - generic:
    - dialog "Manage Categories":
      - generic:
        - heading "Manage Categories" [level=3]
        - button "Close": ×
      - generic:
        - paragraph: Create custom categories or delete your personal ones. Built-in system categories are permanent.
  - generic:
    - dialog "Edit Subscription":
      - generic:
        - generic:
          - heading "Edit Subscription" [level=3]
        - button "Close": ×
      - generic:
        - generic:
          - generic: Description
          - textbox "e.g. Netflix Premium"
        - generic:
          - generic: Amount (₹)
          - spinbutton "0.00"
        - generic:
          - generic: Category
          - combobox
          - generic:
            - button "Select..."
        - generic:
          - generic: Billing Cadence
          - combobox:
            - option "Monthly" [selected]
            - option "Weekly"
            - option "Daily"
            - option "Yearly"
            - option "Custom Interval (Days)"
          - generic:
            - button "Monthly"
        - generic:
          - generic: Next Billing Date
          - textbox
          - generic: Leave as-is to advance automatically based on cadence.
        - button "Save Changes"
  - generic:
    - dialog "Record Income":
      - generic:
        - generic:
          - heading "Record Income" [level=3]
        - button "Close": ×
      - generic:
        - generic:
          - generic: Source / Payor
          - textbox "e.g. Primary Salary, Client Retainer"
        - generic:
          - generic: Amount (₹)
          - spinbutton "0.00"
        - generic:
          - generic: Date Received
          - textbox
        - generic:
          - generic: Description (Optional)
          - textbox "e.g. Direct deposit from employer"
        - generic:
          - generic:
            - generic: Recurring Income Stream
            - checkbox "Recurring Income Stream"
        - button "Save Income"
  - generic:
    - dialog "Create Savings Goal":
      - generic:
        - heading "Create Savings Goal" [level=3]
        - button "Close": ×
      - generic:
        - generic:
          - generic: Goal Name
          - textbox "e.g. Emergency Fund, New Laptop"
        - generic:
          - generic: Target Amount (₹)
          - spinbutton "0.00"
        - generic:
          - generic: Initial Saved Amount (₹)
          - spinbutton "0.00"
        - generic:
          - generic: Target Completion Date (Optional)
          - textbox
        - generic:
          - generic:
            - generic: Recurring Contribution (Chit / RD / SIP)
            - checkbox "Recurring Contribution (Chit / RD / SIP)"
        - button "Save Goal"
  - generic:
    - dialog "Add Contribution":
      - generic:
        - heading "Add Contribution" [level=3]
        - button "Close": ×
      - generic:
        - generic:
          - generic: Contribution Amount (₹)
          - spinbutton "0.00" [active]
        - button "Add Deposit"
  - generic:
    - dialog "Financial Summary & Statement":
      - generic:
        - generic:
          - generic:
            - heading "Financial Summary & Statement" [level=3]
            - paragraph:
              - text: "Account inception:"
              - strong: Loading...
        - button "Close": ×
      - generic:
        - generic: ACTIVE YEARS
        - generic: SELECT MONTH
        - generic:
          - generic:
            - text: "Report Period:"
            - strong: August 2026
        - generic:
          - generic:
            - button "View Financial Statement"
            - button "Need to download files? Switch to Export Options"
  - generic:
    - dialog "Monthly Financial Performance Report":
      - generic:
        - generic:
          - heading "Monthly Financial Performance Report" [level=3]
        - button "Close": ×
      - generic:
        - generic:
          - generic:
            - generic: Executive Statement
            - generic: •
            - strong: August 2026
          - button "Change Period"
        - generic:
          - button "Print"
          - button "Download"
          - button "Email Report"
      - iframe [ref=f1e231]
  - generic:
    - dialog "Edit Profile Name":
      - generic:
        - generic:
          - heading "Edit Profile Name" [level=3]
        - button "Close": ×
      - generic:
        - generic:
          - generic: Display Name
          - textbox "Display Name":
            - /placeholder: Enter your display name
        - generic:
          - button "Cancel"
          - button "Save Changes"
  - generic:
    - dialog "Delete Account Permanently":
      - generic:
        - heading "Delete Account Permanently" [level=3]
      - paragraph:
        - text: This action is destructive and permanent. Enter your password and type
        - strong: DELETE
        - text: below to confirm.
      - generic:
        - generic: Current Password
        - textbox "Current Password":
          - /placeholder: Enter your current password
      - generic:
        - generic: Confirmation
        - textbox "Confirmation":
          - /placeholder: Type DELETE to confirm
      - generic:
        - button "Cancel"
        - button "Delete Account"
  - dialog "ExpenseTracker User Guide":
    - dialog "ExpenseTracker User Guide":
      - generic:
        - generic:
          - generic:
            - heading "ExpenseTracker User Guide" [level=2]
            - text: Quick tour to mastering your financial ledger
        - button "Close user guide": ×
      - generic:
        - generic:
          - generic:
            - generic: 🚀
            - generic: 1. Dashboard & Cash Flow Matrix
          - generic:
            - text: "The top 4 metric cards summarize your overall financial health:"
            - list:
              - listitem:
                - strong: Total Inflow
                - text: ": All incoming salary, freelance payouts, and investment returns."
              - listitem:
                - strong: Total Outflow
                - text: ": All expenses and recurring subscription charges."
              - listitem:
                - strong: Net Cash Flow
                - text: ": Your real-time surplus or deficit (Inflow minus Outflow). Positive is colored green, negative is red."
              - listitem:
                - strong: Savings Rate
                - text: ": The percentage of your inflow preserved rather than spent."
        - generic:
          - generic:
            - generic: 💸
            - generic: 2. Inflows, Expenses & Subscriptions
          - generic:
            - text: "Log transactions individually or mark them recurring:"
            - list:
              - listitem:
                - strong: Add Expense
                - text: ": Click \"+ Add Expense\" or press Ctrl+K. Select category, amount, and date."
              - listitem:
                - strong: Add Income
                - text: ": Click \"+ Add Income\" to record salary, bonuses, or gifts."
              - listitem:
                - strong: Recurring Subscriptions
                - text: ": Check \"Recurring\" on any expense to manage it automatically under Subscriptions."
              - listitem:
                - strong: Switch Streams
                - text: ": Click \"Expenses\" or \"Incomes\" toggle tabs above the main transaction table."
        - generic:
          - generic:
            - generic: 📷
            - generic: 3. Smart Receipt & Bill OCR
          - generic:
            - text: "Save time typing manual bills with on-device Optical Character Recognition:"
            - list:
              - listitem:
                - text: Click "+ Add Expense" and look at the
                - strong: Smart Receipt Scanner
                - text: box at the top.
              - listitem: Drop an image or tap "Scan Receipt / Bill" to choose a photo or use your camera.
              - listitem:
                - text: Tesseract.js runs
                - strong: 100% locally in your browser
                - text: . Your financial photos are never uploaded to any third-party server.
              - listitem: The amount, date, store merchant, and suggested category will automatically populate into the form!
        - generic:
          - generic:
            - generic: 🎯
            - generic: 4. Envelopes & Savings Goals
          - generic:
            - text: "Plan your future and stop lifestyle creep:"
            - list:
              - listitem:
                - strong: Budgets
                - text: ": Set monthly spending caps per category (Food, Utilities, Entertainment). Visual progress bars warn you when exceeding 80% or 100%."
              - listitem:
                - strong: Savings Goals
                - text: ": Create target funds (Emergency Fund, Vacation, New Car) and deposit money with a single click."
        - generic:
          - generic:
            - generic: 📊
            - generic: 5. Executive Reports & Excel Export
          - generic:
            - text: "Get institutional-grade financial statements:"
            - list:
              - listitem:
                - strong: Executive Report (Excel)
                - text: ": Multi-sheet workbook with AutoFilter, Freeze Panes, and live"
                - code: =SUM
                - text: formulas.
              - listitem:
                - strong: Statement (PDF)
                - text: ": Clean, audit-ready financial statement with net flows and category breakdowns."
              - listitem:
                - strong: Import Spreadsheets
                - text: ": Re-import your Excel or CSV ledgers anytime to restore backups."
        - generic:
          - generic:
            - generic: ⚡
            - generic: 6. Power Shortcuts
          - generic:
            - text: "Navigate effortlessly with keyboard hotkeys:"
            - list:
              - listitem: "Ctrl + K or Cmd + K: Open Spotlight Command Palette to trigger any action instantly."
              - listitem: "/: Instantly jump to and focus table search."
              - listitem: "Esc: Dismiss any active dialog, palette, or menu."
      - generic:
        - button "Got It!"
  - dialog "About ExpenseTracker":
    - dialog "About ExpenseTracker":
      - generic:
        - heading "About ExpenseTracker" [level=2]
        - button "Close about dialog": ×
      - generic:
        - generic: Executive Edition • v1.4.0
        - generic: ExpenseTracker System
        - paragraph: An executive-grade, privacy-first personal wealth management system designed for complete financial clarity and offline resilience.
      - generic:
        - generic:
          - generic: 100% Private Ledger
          - generic: No financial profiling or third-party trackers. Receipts are processed client-side via WebAssembly OCR without sending photos to cloud APIs.
        - generic:
          - generic: Executive Spreadsheets
          - generic: Native Apache POI Excel workbooks featuring automated formulas, freeze panes, multi-sheet ledgers, and institutional formatting.
        - generic:
          - generic: Instant Responsiveness
          - generic: Built with vanilla performance-optimized JavaScript and modern CSS tokens, delivering sub-16ms theme toggling and fluid animations.
        - generic:
          - generic: Unified Ecosystem
          - generic: Seamless cross-platform sync with our React Native Expo mobile app, featuring biometrics, real-time debit alerts, and daily check-ins.
      - generic:
        - generic: Spring Boot 4.1.1 • Modern Web ES6+ • Tesseract WebAssembly
        - button "Close"
  - generic: Connecting to the server…
  - generic "Server Status" [ref=f1e232]: Waking up server...
```

# Test source

```ts
  228 |     await page.evaluate(() => {
  229 |       localStorage.setItem('token', 'fake-token');
  230 |       localStorage.setItem('userId', '1');
  231 |       localStorage.setItem('userName', 'Test User');
  232 |     });
  233 |     await page.goto('/dashboard.html');
  234 |     await page.waitForTimeout(2000);
  235 |   });
  236 | 
  237 |   test('has subscription tab buttons in modal', async ({ page }) => {
  238 |     await expect(page.locator('#subsTabExpensesBtn')).toBeAttached();
  239 |     await expect(page.locator('#subsTabIncomesBtn')).toBeAttached();
  240 |     await expect(page.locator('#subsTabSavingsBtn')).toBeAttached();
  241 |   });
  242 | });
  243 | 
  244 | test.describe('Profile menu', () => {
  245 | 
  246 |   test.beforeEach(async ({ page }) => {
  247 |     await page.goto('/index.html');
  248 |     await page.evaluate(() => {
  249 |       localStorage.setItem('token', 'fake-token');
  250 |       localStorage.setItem('userId', '1');
  251 |       localStorage.setItem('userName', 'Test User');
  252 |     });
  253 |     await page.goto('/dashboard.html');
  254 |     await page.waitForTimeout(2000);
  255 |   });
  256 | 
  257 |   test('can click the profile trigger', async ({ page }) => {
  258 |     await page.locator('#profileTrigger').click();
  259 |     await page.waitForTimeout(500);
  260 |     // The profile menu should become visible
  261 |     const menu = page.locator('#profileMenu');
  262 |     if (await menu.isVisible().catch(() => false)) {
  263 |       await expect(menu).toBeVisible();
  264 |     }
  265 |   });
  266 | 
  267 |   test('profile menu has delete account option', async ({ page }) => {
  268 |     await page.locator('#profileTrigger').click();
  269 |     await page.waitForTimeout(500);
  270 |     // Delete account button should be in the menu
  271 |     await expect(page.locator('#deleteAccountBtn')).toBeAttached();
  272 |   });
  273 | 
  274 |   test('profile menu has security PIN option', async ({ page }) => {
  275 |     await page.locator('#profileTrigger').click();
  276 |     await page.waitForTimeout(500);
  277 |     await expect(page.locator('#securityPinBtn')).toBeAttached();
  278 |   });
  279 | 
  280 |   test('profile menu has biometric auth option', async ({ page }) => {
  281 |     await page.locator('#profileTrigger').click();
  282 |     await page.waitForTimeout(500);
  283 |     await expect(page.locator('#biometricAuthBtn')).toBeAttached();
  284 |   });
  285 | });
  286 | 
  287 | test.describe('Currency selector', () => {
  288 | 
  289 |   test.beforeEach(async ({ page }) => {
  290 |     await page.goto('/index.html');
  291 |     await page.evaluate(() => {
  292 |       localStorage.setItem('token', 'fake-token');
  293 |       localStorage.setItem('userId', '1');
  294 |       localStorage.setItem('userName', 'Test User');
  295 |     });
  296 |     await page.goto('/dashboard.html');
  297 |     await page.waitForTimeout(2000);
  298 |   });
  299 | 
  300 |   test('can click the currency trigger', async ({ page }) => {
  301 |     await page.locator('#dashCurrencyTrigger').click();
  302 |     await page.waitForTimeout(500);
  303 |   });
  304 | 
  305 |   test('has currency wrapper', async ({ page }) => {
  306 |     await expect(page.locator('#dashCurrencyWrapper')).toBeVisible();
  307 |   });
  308 | 
  309 |   test('has currency label', async ({ page }) => {
  310 |     await expect(page.locator('#dashCurrencyLabel')).toBeVisible();
  311 |   });
  312 | });
  313 | 
  314 | test.describe('Report period', () => {
  315 | 
  316 |   test.beforeEach(async ({ page }) => {
  317 |     await page.goto('/index.html');
  318 |     await page.evaluate(() => {
  319 |       localStorage.setItem('token', 'fake-token');
  320 |       localStorage.setItem('userId', '1');
  321 |       localStorage.setItem('userName', 'Test User');
  322 |     });
  323 |     await page.goto('/dashboard.html');
  324 |     await page.waitForTimeout(2000);
  325 |   });
  326 | 
  327 |   test('can click change report period button', async ({ page }) => {
> 328 |     await page.locator('#changeReportPeriodBtn').click();
      |                                                  ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  329 |     await page.waitForTimeout(500);
  330 |   });
  331 | 
  332 |   test('can click view monthly report button', async ({ page }) => {
  333 |     await page.locator('#viewMonthlyReportBtn').click();
  334 |     await page.waitForTimeout(500);
  335 |   });
  336 | 
  337 |   test('has report period banner', async ({ page }) => {
  338 |     await expect(page.locator('#reportPeriodBanner')).toBeAttached();
  339 |   });
  340 | 
  341 |   test('has report selected period text', async ({ page }) => {
  342 |     await expect(page.locator('#reportSelectedPeriodText')).toBeAttached();
  343 |   });
  344 | });
  345 | 
```