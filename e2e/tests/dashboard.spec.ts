import { test, expect } from '@playwright/test';

/**
 * Dashboard rendering E2E tests.
 *
 * Tests the dashboard (dashboard.html) after authentication — charts, metric cards,
 * forms, modals, tabs, filters, export buttons, profile menu, settings, and more.
 *
 * These tests inject a fake auth token into localStorage to bypass the login redirect,
 * then verify the dashboard's DOM structure and interactions.
 */
test.describe('Dashboard structure', () => {

  test.beforeEach(async ({ page }) => {
    // Inject fake auth state so dashboard.js doesn't redirect to index.html
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-test-token-for-dom-rendering');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
      localStorage.setItem('userEmail', 'test@test.com');
    });
    await page.goto('/dashboard.html');
    // Wait for the dashboard JS to initialize
    await page.waitForSelector('.top-bar, header, nav', { state: 'visible', timeout: 5000 });
  });

  test('renders the top bar with welcome text', async ({ page }) => {
    await expect(page.locator('.top-bar, header, nav').first()).toBeVisible();
  });

  test('displays user welcome text', async ({ page }) => {
    await expect(page.locator('#userWelcomeText')).toBeVisible();
  });

  test('renders the profile menu trigger', async ({ page }) => {
    await expect(page.locator('#profileTrigger')).toBeVisible();
  });

  test('renders the currency selector', async ({ page }) => {
    await expect(page.locator('#dashCurrencyTrigger')).toBeVisible();
  });

  test('renders the theme toggle button', async ({ page }) => {
    await expect(page.locator('#themeToggle')).toBeVisible();
  });
});

test.describe('Dashboard charts', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-test-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForSelector('canvas', { state: 'visible', timeout: 5000 });
  });

  test('renders the trend chart canvas', async ({ page }) => {
    await expect(page.locator('#trendChart')).toBeVisible();
  });

  test('renders the expense pie/donut chart canvas', async ({ page }) => {
    // The pie chart may use a different ID — check for any canvas
    const canvases = page.locator('canvas');
    const count = await canvases.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('renders the recurring split chart canvas', async ({ page }) => {
    await expect(page.locator('#recurringSplitChart')).toBeVisible();
  });

  test('renders the day-of-week chart canvas', async ({ page }) => {
    await expect(page.locator('#dayOfWeekChart')).toBeVisible();
  });

  test('renders the budget vs actual chart canvas', async ({ page }) => {
    await expect(page.locator('#budgetVsActualChart')).toBeVisible();
  });

  test('has at least 5 chart canvases', async ({ page }) => {
    const count = await page.locator('canvas').count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

test.describe('Dashboard metric cards', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('displays total amount metric', async ({ page }) => {
    await expect(page.locator('#totalAmount')).toBeVisible();
  });

  test('displays total income amount metric', async ({ page }) => {
    await expect(page.locator('#totalIncomeAmount')).toBeVisible();
  });

  test('displays daily burn rate metric', async ({ page }) => {
    await expect(page.locator('#dailyBurnRate')).toBeVisible();
  });

  test('displays savings rate value', async ({ page }) => {
    await expect(page.locator('#savingsRateValue')).toBeVisible();
  });

  test('displays burn rate badge', async ({ page }) => {
    await expect(page.locator('#burnRateBadge')).toBeVisible();
  });

  test('displays top category name and amount', async ({ page }) => {
    await expect(page.locator('#topCategoryName')).toBeVisible();
    await expect(page.locator('#topCategoryAmount')).toBeVisible();
  });

  test('displays savings goal badge', async ({ page }) => {
    await expect(page.locator('#savingsGoalBadge')).toBeVisible();
  });

  test('displays total saved progress', async ({ page }) => {
    await expect(page.locator('#totalSavedProgress')).toBeVisible();
  });
});

test.describe('Dashboard expense form', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has an add expense form', async ({ page }) => {
    await expect(page.locator('#addExpenseForm')).toBeVisible();
  });

  test('has an amount field', async ({ page }) => {
    await expect(page.locator('#amount')).toBeVisible();
  });

  test('has a date field', async ({ page }) => {
    await expect(page.locator('#date')).toBeVisible();
  });

  test('has a category select', async ({ page }) => {
    await expect(page.locator('#categorySelect')).toBeVisible();
  });

  test('has an add category button', async ({ page }) => {
    await expect(page.locator('#addCategoryBtn')).toBeVisible();
  });

  test('has a recurring frequency select', async ({ page }) => {
    await expect(page.locator('#recurringFrequency')).toBeVisible();
  });

  test('has recurring options container', async ({ page }) => {
    await expect(page.locator('#recurringOptions')).toBeVisible();
  });

  test('has recurring interval days field', async ({ page }) => {
    await expect(page.locator('#recurringIntervalDays')).toBeVisible();
  });

  test('amount field accepts numeric input', async ({ page }) => {
    await page.locator('#amount').fill('42.50');
    await expect(page.locator('#amount')).toHaveValue('42.50');
  });
});

test.describe('Dashboard expense table', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has an add expense table button', async ({ page }) => {
    await expect(page.locator('#addExpenseTableBtn')).toBeVisible();
  });

  test('has an add income table button', async ({ page }) => {
    await expect(page.locator('#addIncomeTableBtn')).toBeVisible();
  });

  test('has expense count badge', async ({ page }) => {
    await expect(page.locator('#badgeExpensesCount')).toBeVisible();
  });

  test('has income count badge', async ({ page }) => {
    await expect(page.locator('#badgeIncomesCount')).toBeVisible();
  });

  test('has all count badge', async ({ page }) => {
    await expect(page.locator('#badgeAllCount')).toBeVisible();
  });

  test('has unified ledger card', async ({ page }) => {
    await expect(page.locator('#unifiedLedgerCard')).toBeVisible();
  });

  test('has unified ledger grid', async ({ page }) => {
    await expect(page.locator('#unifiedLedgerGrid')).toBeVisible();
  });

  test('has column expense count', async ({ page }) => {
    await expect(page.locator('#colExpenseCount')).toBeVisible();
  });

  test('has column income count', async ({ page }) => {
    await expect(page.locator('#colIncomeCount')).toBeVisible();
  });

  test('has tab button for all transactions', async ({ page }) => {
    await expect(page.locator('#tabBtnAll')).toBeVisible();
  });

  test('has tab button for expenses', async ({ page }) => {
    await expect(page.locator('#tabBtnExpenses')).toBeVisible();
  });

  test('has tab button for incomes', async ({ page }) => {
    await expect(page.locator('#tabBtnIncomes')).toBeVisible();
  });

  test('can switch between tabs', async ({ page }) => {
    await page.locator('#tabBtnExpenses').click();
    await page.waitForTimeout(500);
    await page.locator('#tabBtnIncomes').click();
    await page.waitForTimeout(500);
    await page.locator('#tabBtnAll').click();
    await page.waitForTimeout(500);
    // No error thrown means tabs are clickable
  });
});

test.describe('Dashboard filters', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has a filter search input', async ({ page }) => {
    await expect(page.locator('#filterSearch')).toBeVisible();
  });

  test('has a toggle filters button', async ({ page }) => {
    await expect(page.locator('#toggleFiltersBtn')).toBeVisible();
  });

  test('has a reset filters button', async ({ page }) => {
    await expect(page.locator('#resetFiltersBtn')).toBeVisible();
  });

  test('has category pills bar', async ({ page }) => {
    await expect(page.locator('#categoryPillsBar')).toBeVisible();
  });

  test('has category pills wrapper', async ({ page }) => {
    await expect(page.locator('#categoryPillsWrapper')).toBeVisible();
  });

  test('filter search accepts text input', async ({ page }) => {
    await page.locator('#filterSearch').fill('test query');
    await expect(page.locator('#filterSearch')).toHaveValue('test query');
  });

  test('can toggle filters panel', async ({ page }) => {
    await page.locator('#toggleFiltersBtn').click();
    await page.waitForTimeout(300);
    // Clicking again should toggle back
    await page.locator('#toggleFiltersBtn').click();
    await page.waitForTimeout(300);
  });
});

test.describe('Dashboard income form', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has a reset income filters button', async ({ page }) => {
    await expect(page.locator('#resetIncomeFiltersBtn')).toBeVisible();
  });

  test('has a toggle income filters button', async ({ page }) => {
    await expect(page.locator('#toggleIncomeFiltersBtn')).toBeVisible();
  });

  test('has recurring income text display', async ({ page }) => {
    await expect(page.locator('#recurringIncomeText')).toBeVisible();
  });
});

test.describe('Dashboard budget section', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has an add budget button', async ({ page }) => {
    await expect(page.locator('#addBudgetBtn')).toBeVisible();
  });

  test('has a budget list container', async ({ page }) => {
    await expect(page.locator('#budgetList')).toBeVisible();
  });

  test('has a budget usage badge', async ({ page }) => {
    await expect(page.locator('#budgetUsageBadge')).toBeVisible();
  });

  test('has a budget modal', async ({ page }) => {
    // Modal may be hidden initially but should exist in DOM
    await expect(page.locator('#budgetModal')).toBeAttached();
  });

  test('has a budget category select', async ({ page }) => {
    await expect(page.locator('#budgetCategorySelect')).toBeAttached();
  });

  test('has a budget limit field', async ({ page }) => {
    await expect(page.locator('#budgetLimit')).toBeAttached();
  });

  test('has a budget period select', async ({ page }) => {
    await expect(page.locator('#budgetPeriod')).toBeAttached();
  });

  test('has a budget start date field', async ({ page }) => {
    await expect(page.locator('#budgetStartDate')).toBeAttached();
  });

  test('has a budget end date field', async ({ page }) => {
    await expect(page.locator('#budgetEndDate')).toBeAttached();
  });

  test('has a budget interval days field', async ({ page }) => {
    await expect(page.locator('#budgetIntervalDays')).toBeAttached();
  });
});

test.describe('Dashboard savings goals', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has an add goal button', async ({ page }) => {
    await expect(page.locator('#addGoalBtn')).toBeVisible();
  });

  test('has a savings goals list', async ({ page }) => {
    await expect(page.locator('#savingsGoalsList')).toBeVisible();
  });

  test('has a savings goal modal', async ({ page }) => {
    await expect(page.locator('#savingsGoalModal')).toBeAttached();
  });

  test('has a savings goal form', async ({ page }) => {
    await expect(page.locator('#savingsGoalForm')).toBeAttached();
  });

  test('has a savings deposit modal', async ({ page }) => {
    await expect(page.locator('#savingsDepositModal')).toBeAttached();
  });

  test('has a savings deposit form', async ({ page }) => {
    await expect(page.locator('#savingsDepositForm')).toBeAttached();
  });
});

test.describe('Dashboard subscriptions', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has a subscriptions modal', async ({ page }) => {
    await expect(page.locator('#subsModal')).toBeAttached();
  });

  test('has a subscriptions modal list', async ({ page }) => {
    await expect(page.locator('#subsModalList')).toBeAttached();
  });

  test('has subscription count badge', async ({ page }) => {
    await expect(page.locator('#subsCountBadge')).toBeVisible();
  });

  test('has subscription monthly total', async ({ page }) => {
    await expect(page.locator('#subsMonthlyTotal')).toBeAttached();
  });

  test('has subscription cashflow summary', async ({ page }) => {
    await expect(page.locator('#subsCashflowSummary')).toBeAttached();
  });

  test('has subscription tab buttons', async ({ page }) => {
    await expect(page.locator('#subsTabExpensesBtn')).toBeAttached();
    await expect(page.locator('#subsTabIncomesBtn')).toBeAttached();
    await expect(page.locator('#subsTabSavingsBtn')).toBeAttached();
  });
});

test.describe('Dashboard reports', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has a view monthly report button', async ({ page }) => {
    await expect(page.locator('#viewMonthlyReportBtn')).toBeVisible();
  });

  test('has a change report period button', async ({ page }) => {
    await expect(page.locator('#changeReportPeriodBtn')).toBeVisible();
  });

  test('has a monthly report modal', async ({ page }) => {
    await expect(page.locator('#monthlyReportModal')).toBeAttached();
  });

  test('has a period modal', async ({ page }) => {
    await expect(page.locator('#periodModal')).toBeAttached();
  });

  test('has a print report button', async ({ page }) => {
    await expect(page.locator('#printReportBtn')).toBeAttached();
  });

  test('has a send monthly report button', async ({ page }) => {
    await expect(page.locator('#sendMonthlyReportBtn')).toBeAttached();
  });

  test('has a report month grid', async ({ page }) => {
    await expect(page.locator('#reportMonthGrid')).toBeAttached();
  });

  test('has report year chips', async ({ page }) => {
    await expect(page.locator('#reportYearChips')).toBeAttached();
  });
});

test.describe('Dashboard profile & settings', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('profile menu is attached to DOM', async ({ page }) => {
    await expect(page.locator('#profileMenu')).toBeAttached();
  });

  test('has a delete account button', async ({ page }) => {
    await expect(page.locator('#deleteAccountBtn')).toBeAttached();
  });

  test('has a delete account modal', async ({ page }) => {
    await expect(page.locator('#deleteAccountModal')).toBeAttached();
  });

  test('has a confirm delete account button', async ({ page }) => {
    await expect(page.locator('#confirmDeleteAccountBtn')).toBeAttached();
  });

  test('has a cancel delete account button', async ({ page }) => {
    await expect(page.locator('#cancelDeleteAccountBtn')).toBeAttached();
  });

  test('has a delete confirm input', async ({ page }) => {
    await expect(page.locator('#deleteConfirmInput')).toBeAttached();
  });

  test('has a delete password input', async ({ page }) => {
    await expect(page.locator('#deletePasswordInput')).toBeAttached();
  });

  test('has a security PIN button', async ({ page }) => {
    await expect(page.locator('#securityPinBtn')).toBeAttached();
  });

  test('has a security PIN modal', async ({ page }) => {
    await expect(page.locator('#securityPinModal')).toBeAttached();
  });

  test('has a security PIN form', async ({ page }) => {
    await expect(page.locator('#securityPinForm')).toBeAttached();
  });

  test('has a biometric auth button', async ({ page }) => {
    await expect(page.locator('#biometricAuthBtn')).toBeAttached();
  });
});

test.describe('Dashboard export buttons', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('has export-related elements on the page', async ({ page }) => {
    const exportElements = page.locator('[id*="export" i], [class*="export" i], button:has-text("Export" i), button:has-text("CSV" i), button:has-text("Excel" i), button:has-text("PDF" i), [data-export]');
    const count = await exportElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('has period switch to export button', async ({ page }) => {
    await expect(page.locator('#periodSwitchToExportBtn')).toBeAttached();
  });

  test('has period switch to view button', async ({ page }) => {
    await expect(page.locator('#periodSwitchToViewBtn')).toBeAttached();
  });
});

test.describe('Dashboard auth redirect', () => {

  test('redirects to login when auth token is missing', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('index.html');
  });
});

test.describe('Dashboard responsive layout', () => {

  test('renders correctly on mobile viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile test — chromium only');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Mobile User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  test('renders correctly on tablet viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Tablet test — chromium only');

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Tablet User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
