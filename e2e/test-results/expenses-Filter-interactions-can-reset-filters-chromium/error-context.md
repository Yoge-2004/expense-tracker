# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: expenses.spec.ts >> Filter interactions >> can reset filters
- Location: tests/expenses.spec.ts:132:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('#resetFiltersBtn')
    - locator resolved to <button type="button" id="resetFiltersBtn" title="Clear all filters" class="btn-icon btn-text-icon touch-pressable">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <section id="unifiedLedgerCard" class="card recent-transactions unified-ledger-card animate-cascade delay-6 touch-pressable">…</section> intercepts pointer events
  - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <section id="unifiedLedgerCard" class="card recent-transactions unified-ledger-card animate-cascade delay-6 touch-pressable">…</section> intercepts pointer events
    - retrying click action
      - waiting 100ms
    5 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <section id="unifiedLedgerCard" class="card recent-transactions unified-ledger-card animate-cascade delay-6 touch-pressable">…</section> intercepts pointer events
    - retrying click action
      - waiting 500ms

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
          - textbox "Search expenses and incomes" [active] [ref=f1e15]:
            - /placeholder: Search expenses & incomes (Press / or Ctrl+K)...
            - text: test
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
        - generic [ref=f1e46]: ₹0.00
        - generic [ref=f1e47]: 0 recurring streams
      - generic [ref=f1e48]:
        - generic [ref=f1e49]:
          - generic [ref=f1e50]: Total Outflow
          - generic [ref=f1e51]: Offline
        - generic [ref=f1e52]: ₹0.00
        - generic [ref=f1e53]: 0 transactions recorded
      - generic [ref=f1e54]:
        - generic [ref=f1e55]:
          - generic [ref=f1e56]: Net Cash Flow
          - generic [ref=f1e57]: Offline
        - generic [ref=f1e58]: +₹0.00
        - generic [ref=f1e59]: "Burn: ₹0.00 / day"
      - generic [ref=f1e61]:
        - generic [ref=f1e62]:
          - generic [ref=f1e63]: Savings Rate
          - generic [ref=f1e64]: Offline
        - generic [ref=f1e65]: 0.0%
        - generic [ref=f1e66]: "Saved: ₹0.00"
      - generic [ref=f1e67]:
        - generic [ref=f1e68]:
          - generic [ref=f1e69]: Subscriptions
          - generic [ref=f1e70]: Offline
        - generic [ref=f1e71]: Unavailable
        - link "Manage Subscriptions →" [ref=f1e74]:
          - /url: "#"
    - generic [ref=f1e76]:
      - generic [ref=f1e77]:
        - generic [ref=f1e78]: SMART INTELLIGENCE
        - heading "Financial Pulse & Insights" [level=2] [ref=f1e82]
      - generic [ref=f1e83]: 100% Budget Health
    - generic [ref=f1e90]:
      - generic [ref=f1e92]:
        - generic [ref=f1e93]:
          - text: Category Breakdown
          - heading "Outflow Distribution" [level=3] [ref=f1e94]
        - generic [ref=f1e95]: All Time
      - generic [ref=f1e99]:
        - generic [ref=f1e100]:
          - text: Cashflow Velocity
          - heading "Spending History & Trend" [level=3] [ref=f1e101]
        - generic [ref=f1e102]: Up to 90 days
      - generic [ref=f1e106]:
        - generic [ref=f1e107]:
          - text: Spend Composition
          - heading "Recurring vs. One-Time" [level=3] [ref=f1e108]
        - generic [ref=f1e109]: All Time
      - generic [ref=f1e113]:
        - generic [ref=f1e114]:
          - text: Spending Habits
          - heading "By Day of Week" [level=3] [ref=f1e115]
        - generic [ref=f1e116]: All Time
      - generic [ref=f1e120]:
        - generic [ref=f1e121]:
          - text: Budget Governance
          - heading "Budget vs. Actual" [level=3] [ref=f1e122]
        - generic [ref=f1e123]: This period
    - generic [ref=f1e127]:
      - generic [ref=f1e128]:
        - text: Budget Governance
        - heading "Monthly Category Limits" [level=3] [ref=f1e129]
      - button "New Budget" [ref=f1e130]
    - generic [ref=f1e137]:
      - generic [ref=f1e138]:
        - generic [ref=f1e139]:
          - text: Wealth Accumulation
          - heading "Savings Goals & Milestones" [level=3] [ref=f1e140]
        - button "New Goal" [ref=f1e141]
      - generic [ref=f1e145]:
        - generic [ref=f1e146]: ⚠️
        - paragraph [ref=f1e147]: Server Connection Failed
        - generic [ref=f1e148]: Could not reach the server to load your savings goals.
        - button "Retry Connection" [ref=f1e149]
    - generic [ref=f1e151]:
      - generic [ref=f1e152]:
        - generic [ref=f1e153]:
          - text: Audit Trail & Cash Flow
          - heading "Transactions & Inflows Ledger" [level=2] [ref=f1e154]
        - generic [ref=f1e155]:
          - button "Import (.csv/.xlsx)" [ref=f1e156]:
            - text: Import
            - generic [ref=f1e160]: (.csv/.xlsx)
          - button "Excel" [ref=f1e161]
          - button "Executive Report" [ref=f1e165]
          - button "Statement" [ref=f1e168]
          - button "CSV" [ref=f1e173]
          - button "JSON" [ref=f1e174]
          - button "PDF" [ref=f1e175]
          - button "Show advanced filters" [ref=f1e176]
          - button "Inflow" [ref=f1e179]
          - button "Record Expense" [ref=f1e182]
      - generic [ref=f1e185]:
        - button "All Activity 0" [ref=f1e186]:
          - generic [ref=f1e187]: All Activity
          - generic [ref=f1e188]: "0"
        - button "Outflows 0" [ref=f1e189]:
          - generic [ref=f1e190]: Outflows
          - generic [ref=f1e191]: "0"
        - button "Inflows 0" [ref=f1e192]:
          - generic [ref=f1e193]: Inflows
          - generic [ref=f1e194]: "0"
      - button "All Transactions" [ref=f1e197]
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
      - generic [ref=f1e198]:
        - generic [ref=f1e199]:
          - generic [ref=f1e200]:
            - generic [ref=f1e201]: Outflows (Expenses)
            - generic [ref=f1e202]: 0 items
          - generic [ref=f1e204]:
            - generic [ref=f1e205]: ⚠️
            - generic [ref=f1e206]: Server Connection Failed
            - generic [ref=f1e207]: Could not reach the server to load your transactions.
            - button "Retry Connection" [ref=f1e208]
        - generic [ref=f1e209]:
          - generic [ref=f1e210]:
            - generic [ref=f1e211]: Inflows (Earnings)
            - generic [ref=f1e212]: 0 items
          - generic [ref=f1e214]:
            - generic [ref=f1e215]: ⚠️
            - generic [ref=f1e216]: Server Connection Failed
            - generic [ref=f1e217]: Could not reach the server to load your income records.
            - button "Retry Connection" [ref=f1e218]
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
          - spinbutton "0.00"
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
      - iframe [ref=f1e219]
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
  - generic "Server Status" [ref=f1e220]: Waking up server...
```

# Test source

```ts
  34  | 
  35  |   test('can fill the date field', async ({ page }) => {
  36  |     await page.locator('#date').fill('2026-09-10');
  37  |     await expect(page.locator('#date')).toHaveValue('2026-09-10');
  38  |   });
  39  | 
  40  |   test('can open the add category flow', async ({ page }) => {
  41  |     await page.locator('#addCategoryBtn').click();
  42  |     await page.waitForTimeout(500);
  43  |     // A modal or input should appear
  44  |     const modal = page.locator('#manageCategoriesModal, .category-modal, [class*="modal" i]:visible');
  45  |     // Just verify the button is clickable without errors
  46  |   });
  47  | 
  48  |   test('can toggle recurring options', async ({ page }) => {
  49  |     // The recurring checkbox may toggle a frequency selector
  50  |     const recurringCheckbox = page.locator('#isRecurring, input[name="recurring"], [id*="recurring" i][type="checkbox"]').first();
  51  |     if (await recurringCheckbox.isVisible().catch(() => false)) {
  52  |       await recurringCheckbox.check();
  53  |       await page.waitForTimeout(300);
  54  |       await recurringCheckbox.uncheck();
  55  |       await page.waitForTimeout(300);
  56  |     }
  57  |   });
  58  | 
  59  |   test('can select a recurring frequency', async ({ page }) => {
  60  |     const freqSelect = page.locator('#recurringFrequency');
  61  |     if (await freqSelect.isVisible().catch(() => false)) {
  62  |       // Just verify it's a select element
  63  |       const tagName = await freqSelect.evaluate(el => el.tagName);
  64  |       expect(tagName).toBe('SELECT');
  65  |     }
  66  |   });
  67  | });
  68  | 
  69  | test.describe('Tab interactions', () => {
  70  | 
  71  |   test.beforeEach(async ({ page }) => {
  72  |     await page.goto('/index.html');
  73  |     await page.evaluate(() => {
  74  |       localStorage.setItem('token', 'fake-token');
  75  |       localStorage.setItem('userId', '1');
  76  |       localStorage.setItem('userName', 'Test User');
  77  |     });
  78  |     await page.goto('/dashboard.html');
  79  |     await page.waitForTimeout(2000);
  80  |   });
  81  | 
  82  |   test('can switch to expenses tab', async ({ page }) => {
  83  |     await page.locator('#tabBtnExpenses').click();
  84  |     await page.waitForTimeout(500);
  85  |   });
  86  | 
  87  |   test('can switch to incomes tab', async ({ page }) => {
  88  |     await page.locator('#tabBtnIncomes').click();
  89  |     await page.waitForTimeout(500);
  90  |   });
  91  | 
  92  |   test('can switch to all tab', async ({ page }) => {
  93  |     await page.locator('#tabBtnAll').click();
  94  |     await page.waitForTimeout(500);
  95  |   });
  96  | 
  97  |   test('can cycle through all tabs', async ({ page }) => {
  98  |     await page.locator('#tabBtnExpenses').click();
  99  |     await page.waitForTimeout(300);
  100 |     await page.locator('#tabBtnIncomes').click();
  101 |     await page.waitForTimeout(300);
  102 |     await page.locator('#tabBtnAll').click();
  103 |     await page.waitForTimeout(300);
  104 |   });
  105 | });
  106 | 
  107 | test.describe('Filter interactions', () => {
  108 | 
  109 |   test.beforeEach(async ({ page }) => {
  110 |     await page.goto('/index.html');
  111 |     await page.evaluate(() => {
  112 |       localStorage.setItem('token', 'fake-token');
  113 |       localStorage.setItem('userId', '1');
  114 |       localStorage.setItem('userName', 'Test User');
  115 |     });
  116 |     await page.goto('/dashboard.html');
  117 |     await page.waitForTimeout(2000);
  118 |   });
  119 | 
  120 |   test('can type in the filter search', async ({ page }) => {
  121 |     await page.locator('#filterSearch').fill('lunch');
  122 |     await expect(page.locator('#filterSearch')).toHaveValue('lunch');
  123 |   });
  124 | 
  125 |   test('can toggle filters panel', async ({ page }) => {
  126 |     await page.locator('#toggleFiltersBtn').click();
  127 |     await page.waitForTimeout(300);
  128 |     await page.locator('#toggleFiltersBtn').click();
  129 |     await page.waitForTimeout(300);
  130 |   });
  131 | 
  132 |   test('can reset filters', async ({ page }) => {
  133 |     await page.locator('#filterSearch').fill('test');
> 134 |     await page.locator('#resetFiltersBtn').click();
      |                                            ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  135 |     await page.waitForTimeout(500);
  136 |     // The search input should be cleared (or the list reset)
  137 |   });
  138 | 
  139 |   test('can toggle income filters', async ({ page }) => {
  140 |     await page.locator('#toggleIncomeFiltersBtn').click();
  141 |     await page.waitForTimeout(300);
  142 |     await page.locator('#toggleIncomeFiltersBtn').click();
  143 |     await page.waitForTimeout(300);
  144 |   });
  145 | 
  146 |   test('can reset income filters', async ({ page }) => {
  147 |     await page.locator('#resetIncomeFiltersBtn').click();
  148 |     await page.waitForTimeout(500);
  149 |   });
  150 | });
  151 | 
  152 | test.describe('Budget creation', () => {
  153 | 
  154 |   test.beforeEach(async ({ page }) => {
  155 |     await page.goto('/index.html');
  156 |     await page.evaluate(() => {
  157 |       localStorage.setItem('token', 'fake-token');
  158 |       localStorage.setItem('userId', '1');
  159 |       localStorage.setItem('userName', 'Test User');
  160 |     });
  161 |     await page.goto('/dashboard.html');
  162 |     await page.waitForTimeout(2000);
  163 |   });
  164 | 
  165 |   test('can open the budget modal', async ({ page }) => {
  166 |     await page.locator('#addBudgetBtn').click();
  167 |     await page.waitForTimeout(500);
  168 |     // The budget modal should become visible
  169 |     const modal = page.locator('#budgetModal');
  170 |     if (await modal.isVisible().catch(() => false)) {
  171 |       await expect(modal).toBeVisible();
  172 |     }
  173 |   });
  174 | 
  175 |   test('budget modal has form fields', async ({ page }) => {
  176 |     await page.locator('#addBudgetBtn').click();
  177 |     await page.waitForTimeout(500);
  178 |     // Verify the form fields exist (may be in a hidden modal)
  179 |     await expect(page.locator('#budgetCategorySelect')).toBeAttached();
  180 |     await expect(page.locator('#budgetLimit')).toBeAttached();
  181 |     await expect(page.locator('#budgetPeriod')).toBeAttached();
  182 |   });
  183 | 
  184 |   test('can close the budget modal', async ({ page }) => {
  185 |     await page.locator('#addBudgetBtn').click();
  186 |     await page.waitForTimeout(500);
  187 |     const closeBtn = page.locator('#closeBudgetModalBtn');
  188 |     if (await closeBtn.isVisible().catch(() => false)) {
  189 |       await closeBtn.click();
  190 |       await page.waitForTimeout(300);
  191 |     }
  192 |   });
  193 | });
  194 | 
  195 | test.describe('Savings goals', () => {
  196 | 
  197 |   test.beforeEach(async ({ page }) => {
  198 |     await page.goto('/index.html');
  199 |     await page.evaluate(() => {
  200 |       localStorage.setItem('token', 'fake-token');
  201 |       localStorage.setItem('userId', '1');
  202 |       localStorage.setItem('userName', 'Test User');
  203 |     });
  204 |     await page.goto('/dashboard.html');
  205 |     await page.waitForTimeout(2000);
  206 |   });
  207 | 
  208 |   test('can open the savings goal modal', async ({ page }) => {
  209 |     await page.locator('#addGoalBtn').click();
  210 |     await page.waitForTimeout(500);
  211 |     const modal = page.locator('#savingsGoalModal');
  212 |     if (await modal.isVisible().catch(() => false)) {
  213 |       await expect(modal).toBeVisible();
  214 |     }
  215 |   });
  216 | 
  217 |   test('savings goal modal has form', async ({ page }) => {
  218 |     await page.locator('#addGoalBtn').click();
  219 |     await page.waitForTimeout(500);
  220 |     await expect(page.locator('#savingsGoalForm')).toBeAttached();
  221 |   });
  222 | });
  223 | 
  224 | test.describe('Subscriptions management', () => {
  225 | 
  226 |   test.beforeEach(async ({ page }) => {
  227 |     await page.goto('/index.html');
  228 |     await page.evaluate(() => {
  229 |       localStorage.setItem('token', 'fake-token');
  230 |       localStorage.setItem('userId', '1');
  231 |       localStorage.setItem('userName', 'Test User');
  232 |     });
  233 |     await page.goto('/dashboard.html');
  234 |     await page.waitForTimeout(2000);
```