import { test, expect } from '@playwright/test';

/**
 * Budget management flow E2E tests.
 *
 * Tests the full lifecycle of category budget governance through the UI:
 * - Budget matrix display and configuration buttons
 * - Opening and closing budget configuration modal
 * - Form field validation and structure
 * - Period interval switching (Monthly, Weekly, Yearly, Custom)
 * - Custom interval day inputs and date ranges
 * - Budget usage indicators and visual charts
 */
test.describe('Budget governance and modal interactions', () => {

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

  test('budget matrix section and add budget button exist', async ({ page }) => {
    const budgetBtn = page.locator('#addBudgetBtn');
    await expect(budgetBtn).toBeVisible();
    await expect(page.locator('#budgetList')).toBeVisible();
  });

  test('can open budget configuration modal', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(400);

    const modal = page.locator('#budgetModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#budgetCategorySelect')).toBeAttached();
    await expect(page.locator('#budgetLimit')).toBeAttached();
    await expect(page.locator('#budgetPeriod')).toBeAttached();
  });

  test('can close budget modal via close button', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(400);

    const closeBtn = page.locator('#closeBudgetModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await page.waitForTimeout(400);

    const modal = page.locator('#budgetModal');
    await expect(modal).not.toHaveClass(/active/);
  });

  test('can fill budget limit amount', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(400);

    const limitInput = page.locator('#budgetLimit');
    await limitInput.fill('1500.50');
    await expect(limitInput).toHaveValue('1500.50');
  });

  test('selecting CUSTOM period displays custom interval and date inputs', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(400);

    const periodSelect = page.locator('#budgetPeriod');
    await periodSelect.selectOption('CUSTOM');
    await page.waitForTimeout(300);

    const customDates = page.locator('#customBudgetDates');
    await expect(customDates).toBeVisible();
    await expect(page.locator('#budgetIntervalDays')).toBeVisible();
    await expect(page.locator('#budgetStartDate')).toBeVisible();
    await expect(page.locator('#budgetEndDate')).toBeVisible();
  });

  test('switching back from CUSTOM to MONTHLY hides custom interval fields', async ({ page }) => {
    await page.locator('#addBudgetBtn').click();
    await page.waitForTimeout(400);

    const periodSelect = page.locator('#budgetPeriod');
    await periodSelect.selectOption('CUSTOM');
    await page.waitForTimeout(300);
    await expect(page.locator('#customBudgetDates')).toBeVisible();

    await periodSelect.selectOption('MONTHLY');
    await page.waitForTimeout(300);
    await expect(page.locator('#customBudgetDates')).toBeHidden();
  });

  test('budget vs actual chart canvas is attached', async ({ page }) => {
    await expect(page.locator('#budgetVsActualChart')).toBeAttached();
  });

  test('budget usage badge exists in dashboard header cards', async ({ page }) => {
    await expect(page.locator('#budgetUsageBadge')).toBeAttached();
  });
});
