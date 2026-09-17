import { test, expect } from '@playwright/test';

/**
 * Income management flow E2E tests.
 *
 * Tests the complete lifecycle of income management in the UI:
 * - Opening and closing the Record Income modal
 * - Validating form fields (source, amount, date, description)
 * - Toggling recurring income commitments and frequency choices
 * - Custom interval day selection for recurring incomes
 * - Switching to the Incomes tab
 * - Interacting with income filters (date range, cadence, sort order)
 * - Resetting income filters
 */
test.describe('Income management interactions', () => {

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

  test('can open income modal from top-bar action button', async ({ page }) => {
    const openBtn = page.locator('#openIncomeModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator('#incomeModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#incomeSource')).toBeAttached();
    await expect(page.locator('#incomeAmount')).toBeAttached();
    await expect(page.locator('#incomeDate')).toBeAttached();
  });

  test('can fill income details in modal form', async ({ page }) => {
    await page.locator('#openIncomeModalBtn').click();
    await page.waitForTimeout(400);

    await page.locator('#incomeSource').fill('Consulting Client');
    await expect(page.locator('#incomeSource')).toHaveValue('Consulting Client');

    await page.locator('#incomeAmount').fill('4500.00');
    await expect(page.locator('#incomeAmount')).toHaveValue('4500.00');

    await page.locator('#incomeDate').fill('2026-09-18');
    await expect(page.locator('#incomeDate')).toHaveValue('2026-09-18');

    await page.locator('#incomeDesc').fill('Q3 retainer payment');
    await expect(page.locator('#incomeDesc')).toHaveValue('Q3 retainer payment');
  });

  test('can close income modal via close button', async ({ page }) => {
    await page.locator('#openIncomeModalBtn').click();
    await page.waitForTimeout(400);

    const closeBtn = page.locator('#closeIncomeModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator('#incomeModal');
    await expect(modal).not.toHaveClass(/active/);
  });

  test('toggling recurring checkbox displays recurring cadence options', async ({ page }) => {
    await page.locator('#openIncomeModalBtn').click();
    await page.waitForTimeout(400);

    const recurringCheck = page.locator('#incomeIsRecurring');
    await recurringCheck.check();
    await page.waitForTimeout(300);

    const optionsBox = page.locator('#incomeRecurringOptions');
    await expect(optionsBox).toBeVisible();

    const freqSelect = page.locator('#incomeRecurringFrequency');
    await expect(freqSelect).toBeVisible();

    await recurringCheck.uncheck();
    await page.waitForTimeout(300);
    await expect(optionsBox).toBeHidden();
  });

  test('selecting CUSTOM frequency in income modal reveals custom interval input', async ({ page }) => {
    await page.locator('#openIncomeModalBtn').click();
    await page.waitForTimeout(400);

    await page.locator('#incomeIsRecurring').check();
    await page.waitForTimeout(300);

    const freqSelect = page.locator('#incomeRecurringFrequency');
    await freqSelect.selectOption('CUSTOM');
    await page.waitForTimeout(300);

    const customWrap = page.locator('#incomeCustomIntervalWrap');
    await expect(customWrap).toBeVisible();
    await expect(page.locator('#incomeRecurringIntervalDays')).toBeVisible();

    await page.locator('#incomeRecurringIntervalDays').fill('14');
    await expect(page.locator('#incomeRecurringIntervalDays')).toHaveValue('14');
  });

  test('switching to incomes tab displays income list and filter controls', async ({ page }) => {
    const tabBtn = page.locator('#tabBtnIncomes');
    await expect(tabBtn).toBeVisible();
    await tabBtn.click();
    await page.waitForTimeout(400);

    await expect(page.locator('#incomeList')).toBeAttached();
    await expect(page.locator('#incomeCountBadge')).toBeAttached();
  });

  test('can toggle and interact with income filter panel', async ({ page }) => {
    await page.locator('#tabBtnIncomes').click();
    await page.waitForTimeout(300);

    const toggleFilterBtn = page.locator('#toggleIncomeFiltersBtn');
    await toggleFilterBtn.click();
    await page.waitForTimeout(300);

    const filterPanel = page.locator('#incomeFilterPanel');
    await expect(filterPanel).toBeVisible();

    await expect(page.locator('#incomeFilterStartDate')).toBeVisible();
    await expect(page.locator('#incomeFilterEndDate')).toBeVisible();
    await expect(page.locator('#incomeFilterFrequency')).toBeVisible();
    await expect(page.locator('#incomeFilterSort')).toBeVisible();

    await page.locator('#resetIncomeFiltersBtn').click();
    await page.waitForTimeout(300);
  });
});
