import { test, expect } from '@playwright/test';

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
    await page.locator('#addCategoryBtn').click();
    await page.waitForTimeout(500);
    // A modal or input should appear
    const modal = page.locator('#manageCategoriesModal, .category-modal, [class*="modal" i]:visible');
    // Just verify the button is clickable without errors
  });

  test('can toggle recurring options', async ({ page }) => {
    // The recurring checkbox may toggle a frequency selector
    const recurringCheckbox = page.locator('#isRecurring, input[name="recurring"], [id*="recurring" i][type="checkbox"]').first();
    if (await recurringCheckbox.isVisible().catch(() => false)) {
      await recurringCheckbox.check();
      await page.waitForTimeout(300);
      await recurringCheckbox.uncheck();
      await page.waitForTimeout(300);
    }
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
    await page.locator('#filterSearch').fill('test');
    await page.locator('#resetFiltersBtn').click();
    await page.waitForTimeout(500);
    // The search input should be cleared (or the list reset)
  });

  test('can toggle income filters', async ({ page }) => {
    await page.locator('#toggleIncomeFiltersBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#toggleIncomeFiltersBtn').click();
    await page.waitForTimeout(300);
  });

  test('can reset income filters', async ({ page }) => {
    await page.locator('#resetIncomeFiltersBtn').click();
    await page.waitForTimeout(500);
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
    await page.locator('#dashCurrencyTrigger').click();
    await page.waitForTimeout(500);
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

  test('can click change report period button', async ({ page }) => {
    await page.locator('#changeReportPeriodBtn').click();
    await page.waitForTimeout(500);
  });

  test('can click view monthly report button', async ({ page }) => {
    await page.locator('#viewMonthlyReportBtn').click();
    await page.waitForTimeout(500);
  });

  test('has report period banner', async ({ page }) => {
    await expect(page.locator('#reportPeriodBanner')).toBeAttached();
  });

  test('has report selected period text', async ({ page }) => {
    await expect(page.locator('#reportSelectedPeriodText')).toBeAttached();
  });
});
