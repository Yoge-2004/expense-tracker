# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-regressions.spec.ts >> Targeted UI regressions >> pauses the expensive background renderer during the theme repaint
- Location: tests/ui-regressions.spec.ts:145:7

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1
Received:    8
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
          - button "Switch to Dark Theme" [ref=f1e24]
          - button "Open User Guide and Help" [ref=f1e27]
        - button "Account menu" [ref=f1e31]:
          - generic [ref=f1e32]: T
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
    - generic [ref=f1e33]:
      - generic: Total Inflow
      - generic: Total Outflow
      - generic:
        - generic: Net Cash Flow
        - generic: "Burn:"
      - generic: Savings Rate
      - generic:
        - generic: Subscriptions
        - generic:
          - link "Manage Subscriptions →":
            - /url: "#"
    - generic [ref=f1e35]:
      - generic [ref=f1e36]:
        - generic [ref=f1e37]: SMART INTELLIGENCE
        - heading "Financial Pulse & Insights" [level=2] [ref=f1e41]
      - generic [ref=f1e42]: 100% Budget Health
    - generic [ref=f1e49]:
      - generic [ref=f1e51]:
        - generic [ref=f1e52]:
          - text: Category Breakdown
          - heading "Outflow Distribution" [level=3] [ref=f1e53]
        - generic [ref=f1e54]: All Time
      - generic [ref=f1e58]:
        - generic [ref=f1e59]:
          - text: Cashflow Velocity
          - heading "Spending History & Trend" [level=3] [ref=f1e60]
        - generic [ref=f1e61]: Up to 90 days
      - generic [ref=f1e65]:
        - generic [ref=f1e66]:
          - text: Spend Composition
          - heading "Recurring vs. One-Time" [level=3] [ref=f1e67]
        - generic [ref=f1e68]: All Time
      - generic [ref=f1e72]:
        - generic [ref=f1e73]:
          - text: Spending Habits
          - heading "By Day of Week" [level=3] [ref=f1e74]
        - generic [ref=f1e75]: All Time
      - generic [ref=f1e79]:
        - generic [ref=f1e80]:
          - text: Budget Governance
          - heading "Budget vs. Actual" [level=3] [ref=f1e81]
        - generic [ref=f1e82]: This period
    - generic [ref=f1e86]:
      - generic [ref=f1e87]:
        - text: Budget Governance
        - heading "Monthly Category Limits" [level=3] [ref=f1e88]
      - button "New Budget" [ref=f1e89]
    - generic [ref=f1e97]:
      - generic [ref=f1e98]:
        - text: Wealth Accumulation
        - heading "Savings Goals & Milestones" [level=3] [ref=f1e99]
      - button "New Goal" [ref=f1e100]
    - generic [ref=f1e107]:
      - generic [ref=f1e108]:
        - generic [ref=f1e109]:
          - text: Audit Trail & Cash Flow
          - heading "Transactions & Inflows Ledger" [level=2] [ref=f1e110]
        - generic [ref=f1e111]:
          - button "Import (.csv/.xlsx)" [ref=f1e112]:
            - text: Import
            - generic [ref=f1e116]: (.csv/.xlsx)
          - button "Excel" [ref=f1e117]
          - button "Executive Report" [ref=f1e121]
          - button "Statement" [ref=f1e124]
          - button "CSV" [ref=f1e129]
          - button "JSON" [ref=f1e130]
          - button "PDF" [ref=f1e131]
          - button "Show advanced filters" [ref=f1e132]
          - button "Inflow" [ref=f1e135]
          - button "Record Expense" [ref=f1e138]
      - generic [ref=f1e141]:
        - button "All Activity 0" [ref=f1e142]:
          - generic [ref=f1e143]: All Activity
          - generic [ref=f1e144]: "0"
        - button "Outflows 0" [ref=f1e145]:
          - generic [ref=f1e146]: Outflows
          - generic [ref=f1e147]: "0"
        - button "Inflows 0" [ref=f1e148]:
          - generic [ref=f1e149]: Inflows
          - generic [ref=f1e150]: "0"
      - button "All Transactions" [ref=f1e153]
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
      - generic [ref=f1e154]:
        - generic [ref=f1e156]:
          - generic [ref=f1e157]: Outflows (Expenses)
          - generic [ref=f1e158]: 0 items
        - generic [ref=f1e166]:
          - generic [ref=f1e167]: Inflows (Earnings)
          - generic [ref=f1e168]: 0 items
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
      - iframe [ref=f1e175]
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
  - generic "Server Status" [ref=f1e176]: Waking up server...
```

# Test source

```ts
  69  |       return {
  70  |         buttonAnimation: button ? getComputedStyle(button).animationName : null,
  71  |         canvasAnimation: canvas ? getComputedStyle(canvas).animationName : null,
  72  |       };
  73  |     });
  74  | 
  75  |     expect(state.buttonAnimation).not.toContain('themeShiftGlow');
  76  |     expect(state.canvasAnimation).toBe('none');
  77  |   });
  78  | 
  79  |   test('defines lightweight CSS transitions for all five metric card variants', async ({ page }) => {
  80  |     const selectors = [
  81  |       '.metric-card-inflow',
  82  |       '.metric-card-outflow',
  83  |       '.metric-card-netflow',
  84  |       '.metric-card-savings',
  85  |       '.metric-card-subs',
  86  |     ];
  87  | 
  88  |     await expect(page.locator('.grid-4-metrics > .metric-card')).toHaveCount(5);
  89  | 
  90  |     const states = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
  91  |       const card = document.querySelector<HTMLElement>(selector);
  92  |       if (!card) return { selector, transitionProperty: null, transitionDuration: null };
  93  |       const style = getComputedStyle(card);
  94  |       return {
  95  |         selector,
  96  |         transitionProperty: style.transitionProperty,
  97  |         transitionDuration: style.transitionDuration,
  98  |       };
  99  |     }), selectors);
  100 | 
  101 |     expect(states).toHaveLength(5);
  102 |     for (const state of states) {
  103 |       expect(state.transitionProperty).toContain('transform');
  104 |       expect(state.transitionProperty).toContain('background-color');
  105 |       expect(state.transitionProperty).toContain('border-color');
  106 |       expect(state.transitionProperty).toContain('border-left-color');
  107 |       expect(state.transitionProperty).toContain('color');
  108 |       expect(state.transitionProperty).not.toContain('box-shadow');
  109 |       expect(state.transitionDuration).toContain('0.2s');
  110 |     }
  111 | 
  112 |     await page.locator('#themeToggle').click();
  113 |     await expect.poll(async () => page.locator('html').getAttribute('data-theme')).toBe('light');
  114 |   });
  115 | 
  116 |   test('visibly transforms all five metric cards during a theme toggle', async ({ page }) => {
  117 |     const selectors = [
  118 |       '.metric-card-inflow',
  119 |       '.metric-card-outflow',
  120 |       '.metric-card-netflow',
  121 |       '.metric-card-savings',
  122 |       '.metric-card-subs',
  123 |     ];
  124 | 
  125 |     const before = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
  126 |       const card = document.querySelector<HTMLElement>(selector);
  127 |       return card ? getComputedStyle(card).transform : null;
  128 |     }), selectors);
  129 | 
  130 |     await page.locator('#themeToggle').click();
  131 |     await expect.poll(async () => page.locator('html').getAttribute('data-theme')).toBe('light');
  132 |     await page.waitForTimeout(80);
  133 | 
  134 |     const during = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
  135 |       const card = document.querySelector<HTMLElement>(selector);
  136 |       return card ? getComputedStyle(card).transform : null;
  137 |     }), selectors);
  138 | 
  139 |     expect(during).toHaveLength(5);
  140 |     for (let i = 0; i < before.length; i += 1) {
  141 |       expect(during[i]).not.toBe(before[i]);
  142 |     }
  143 |   });
  144 | 
  145 |   test('pauses the expensive background renderer during the theme repaint', async ({ page }) => {
  146 |     const gradientCalls = await page.evaluate(() => new Promise<number>((resolve) => {
  147 |       const context = typeof CanvasRenderingContext2D !== 'undefined'
  148 |         ? CanvasRenderingContext2D.prototype
  149 |         : null;
  150 |       if (!context) {
  151 |         resolve(0);
  152 |         return;
  153 |       }
  154 | 
  155 |       const original = context.createRadialGradient;
  156 |       let calls = 0;
  157 |       context.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
  158 |         calls += 1;
  159 |         return original.call(this, x0, y0, r0, x1, y1, r1);
  160 |       };
  161 | 
  162 |       document.querySelector<HTMLElement>('#themeToggle')?.click();
  163 |       setTimeout(() => {
  164 |         context.createRadialGradient = original;
  165 |         resolve(calls);
  166 |       }, 220);
  167 |     }));
  168 | 
> 169 |     expect(gradientCalls).toBeLessThanOrEqual(1);
      |                           ^ Error: expect(received).toBeLessThanOrEqual(expected)
  170 |   });
  171 | 
  172 |   test('animates all five metric cards on dashboard entrance', async ({ page }) => {
  173 |     const selectors = [
  174 |       '.metric-card-inflow',
  175 |       '.metric-card-outflow',
  176 |       '.metric-card-netflow',
  177 |       '.metric-card-savings',
  178 |       '.metric-card-subs',
  179 |     ];
  180 | 
  181 |     const states = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
  182 |       const card = document.querySelector<HTMLElement>(selector);
  183 |       if (!card) return { selector, animationName: null, duration: null, delay: null };
  184 |       const style = getComputedStyle(card);
  185 |       return {
  186 |         selector,
  187 |         animationName: style.animationName,
  188 |         duration: style.animationDuration,
  189 |         delay: style.animationDelay,
  190 |       };
  191 |     }), selectors);
  192 | 
  193 |     expect(states).toHaveLength(5);
  194 |     for (const state of states) {
  195 |       expect(state.animationName).toContain('staggeredSlideIn');
  196 |       expect(state.duration).toContain('0.75s');
  197 |       expect(state.delay).toMatch(/^(0s|0\.15s|0\.3s|0\.45s|0\.6s)$/);
  198 |     }
  199 |   });
  200 | 
  201 |   test('keeps both record controls on their intended primary gradients', async ({ page }) => {
  202 |     const backgrounds = await page.locator('#openModalBtn, #openIncomeModalBtn').evaluateAll((elements) =>
  203 |       elements.map(element => getComputedStyle(element).backgroundImage),
  204 |     );
  205 | 
  206 |     expect(backgrounds).toHaveLength(2);
  207 |     expect(backgrounds.every(value => value.includes('linear-gradient'))).toBe(true);
  208 |   });
  209 | 
  210 |   test('removes redundant income inline handlers while preserving the global API', async ({ page }) => {
  211 |     for (const selector of ['#openIncomeModalBtn', '#addIncomeTableBtn']) {
  212 |       await expect.poll(async () => page.locator(selector).getAttribute('onclick')).toBeNull();
  213 |     }
  214 | 
  215 |     await expect.poll(async () => page.evaluate(() => typeof window.openNewIncomeModal)).toBe('function');
  216 |   });
  217 | });
  218 | 
```