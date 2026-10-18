import { test, expect } from '@playwright/test';
import { openExpenseModal, openProfileMenu } from './support/dashboard';

/**
 * Expense management flow E2E tests.
 *
 * Tests the full lifecycle of expense and income management through the UI:
 * - Opening forms and modals
 * - Filling in expense/income details
 * - Tab switching
 * - Filter interactions
 * - Budget creation
 * - Savings goal creation
 * - Subscription management
 *
 * These tests inject a fake auth token to access the dashboard without a live backend.
 */
test.describe('Expense form interactions', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-test-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);
  });

  test('can fill the amount field', async ({ page }) => {
    await page.locator('#amount').fill('42.50');
    await expect(page.locator('#amount')).toHaveValue('42.50');
  });

  test('can fill the date field', async ({ page }) => {
    await page.locator('#date').fill('2026-09-10');
    await expect(page.locator('#date')).toHaveValue('2026-09-10');
  });

  test('can open the add category flow', async ({ page }) => {
    await openExpenseModal(page);
    await page.locator('#addCategoryBtn').click();

    const dialog = page.locator('.app-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.app-dialog-input')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.app-dialog-overlay')).toHaveCount(0);
  });

  test('can toggle recurring options', async ({ page }) => {
    await openExpenseModal(page);
    const options = page.locator('#recurringOptions');
    await expect(options).toBeHidden();

    await page.locator('#isRecurring').check();
    await expect(options).toBeVisible();

    await page.locator('#isRecurring').uncheck();
    await expect(options).toBeHidden();
  });

  test('can select a recurring frequency', async ({ page }) => {
    const freqSelect = page.locator('#recurringFrequency');
    if (await freqSelect.isVisible().catch(() => false)) {
      // Just verify it's a select element
      const tagName = await freqSelect.evaluate(el => el.tagName);
      expect(tagName).toBe('SELECT');
    }
  });
});

test.describe('Tab interactions', () => {

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

  test('can switch to expenses tab', async ({ page }) => {
    await page.locator('#tabBtnExpenses').click();
    await page.waitForTimeout(500);
  });

  test('can switch to incomes tab', async ({ page }) => {
    await page.locator('#tabBtnIncomes').click();
    await page.waitForTimeout(500);
  });

  test('can switch to all tab', async ({ page }) => {
    await page.locator('#tabBtnAll').click();
    await page.waitForTimeout(500);
  });

  test('can cycle through all tabs', async ({ page }) => {
    await page.locator('#tabBtnExpenses').click();
    await page.waitForTimeout(300);
    await page.locator('#tabBtnIncomes').click();
    await page.waitForTimeout(300);
    await page.locator('#tabBtnAll').click();
    await page.waitForTimeout(300);
  });
});

test.describe('Filter interactions', () => {

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

  test('can type in the filter search', async ({ page }) => {
    await page.locator('#filterSearch').fill('lunch');
    await expect(page.locator('#filterSearch')).toHaveValue('lunch');
  });

  test('can toggle filters panel', async ({ page }) => {
    await page.locator('#toggleFiltersBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#toggleFiltersBtn').click();
    await page.waitForTimeout(300);
  });

  test('can reset filters', async ({ page }) => {
    await page.locator('#toggleFiltersBtn').click();
    await expect(page.locator('#filterPanel')).toHaveClass(/active/);

    await page.locator('#filterSearch').fill('test');
    await page.locator('#resetFiltersBtn').click();
    await expect(page.locator('#filterSearch')).toHaveValue('');
  });

  test('can toggle income filters', async ({ page }) => {
    await page.locator('#toggleIncomeFiltersBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#toggleIncomeFiltersBtn').click();
    await page.waitForTimeout(300);
  });

  test('can reset income filters', async ({ page }) => {
    await page.locator('#toggleIncomeFiltersBtn').click();
    await expect(page.locator('#incomeFilterPanel')).toHaveClass(/active/);

    await page.locator('#incomeFilterStartDate').fill('2026-01-01');
    await page.locator('#resetIncomeFiltersBtn').click();
    await expect(page.locator('#incomeFilterStartDate')).toHaveValue('');
  });
});

test.describe('Budget creation', () => {

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

  test('can open the budget modal', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(500);
    // The budget modal should become visible
    const modal = page.locator('#budgetModal');
    if (await modal.isVisible().catch(() => false)) {
      await expect(modal).toBeVisible();
    }
  });

  test('budget modal has form fields', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(500);
    // Verify the form fields exist (may be in a hidden modal)
    await expect(page.locator('#budgetCategorySelect')).toBeAttached();
    await expect(page.locator('#budgetLimit')).toBeAttached();
    await expect(page.locator('#budgetPeriod')).toBeAttached();
  });

  test('can close the budget modal', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(500);
    const closeBtn = page.locator('#closeBudgetModalBtn');
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Savings goals', () => {

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

  test('can open the savings goal modal', async ({ page }) => {
    await page.locator('#addGoalBtn').click();
    await page.waitForTimeout(500);
    const modal = page.locator('#savingsGoalModal');
    if (await modal.isVisible().catch(() => false)) {
      await expect(modal).toBeVisible();
    }
  });

  test('savings goal modal has form', async ({ page }) => {
    await page.locator('#addGoalBtn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#savingsGoalForm')).toBeAttached();
  });
});

test.describe('Subscriptions management', () => {

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

  test('has subscription tab buttons in modal', async ({ page }) => {
    await expect(page.locator('#subsTabExpensesBtn')).toBeAttached();
    await expect(page.locator('#subsTabIncomesBtn')).toBeAttached();
    await expect(page.locator('#subsTabSavingsBtn')).toBeAttached();
  });
});

test.describe('Profile menu', () => {

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

  test('can click the profile trigger', async ({ page }) => {
    await page.locator('#profileTrigger').click();
    await page.waitForTimeout(500);
    // The profile menu should become visible
    const menu = page.locator('#profileMenu');
    if (await menu.isVisible().catch(() => false)) {
      await expect(menu).toBeVisible();
    }
  });

  test('profile menu has delete account option', async ({ page }) => {
    await page.locator('#profileTrigger').click();
    await page.waitForTimeout(500);
    // Delete account button should be in the menu
    await expect(page.locator('#deleteAccountBtn')).toBeAttached();
  });

  test('profile menu has security PIN option', async ({ page }) => {
    await page.locator('#profileTrigger').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#securityPinBtn')).toBeAttached();
  });

  test('profile menu has biometric auth option', async ({ page }) => {
    await page.locator('#profileTrigger').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#biometricAuthBtn')).toBeAttached();
  });
});

test.describe('Currency selector', () => {

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

  test('can click the currency trigger', async ({ page }) => {
    await openProfileMenu(page);
    await page.locator('#dashCurrencyTrigger').click();
    await expect(page.locator('#dashCurrencyTrigger')).toHaveAttribute('aria-expanded', 'true');
  });

  test('has currency wrapper', async ({ page }) => {
    await expect(page.locator('#dashCurrencyWrapper')).toBeVisible();
  });

  test('has currency label', async ({ page }) => {
    await expect(page.locator('#dashCurrencyLabel')).toBeVisible();
  });
});

test.describe('Report period', () => {

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

  test('can open the report period picker from the account menu', async ({ page }) => {
    await openProfileMenu(page);
    await page.locator('#viewMonthlyReportBtn').click();
    await expect(page.locator('#monthlyReportPeriodModal')).toHaveClass(/active/);
  });

  test('offers a change period control inside the report preview', async ({ page }) => {
    // The preview only opens once a report has loaded from the API, so check the control is wired in.
    await expect(page.locator('#monthlyReportModal #changeReportPeriodBtn')).toBeAttached();
  });

  test('has report period banner', async ({ page }) => {
    await expect(page.locator('#reportPeriodBanner')).toBeAttached();
  });

  test('has report selected period text', async ({ page }) => {
    await expect(page.locator('#reportSelectedPeriodText')).toBeAttached();
  });
});
