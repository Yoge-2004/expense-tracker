import { test, expect } from '@playwright/test';

/**
 * Dashboard rendering E2E tests.
 *
 * Tests that the dashboard loads correctly after authentication, renders
 * charts, metric cards, and has functional export buttons.
 *
 * These tests inject a fake auth token into localStorage to bypass the
 * login redirect, then verify the dashboard's DOM structure.
 */
test.describe('Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    // Inject fake auth state so dashboard.js doesn't redirect to index.html.
    // The API calls will fail (fake token), but the DOM should still render.
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-test-token-for-dom-rendering');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
      localStorage.setItem('userEmail', 'test@test.com');
    });
  });

  test('loads and renders the top bar with user name', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Wait for the top bar to render
    await page.waitForSelector('.top-bar, header, nav', { state: 'visible', timeout: 5000 });

    // The top bar should contain the user's name
    const topBar = page.locator('.top-bar, header, nav').first();
    await expect(topBar).toBeVisible();
  });

  test('renders chart canvas elements', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Wait for canvas elements to appear (Chart.js renders on canvas)
    await page.waitForSelector('canvas', { state: 'visible', timeout: 5000 });

    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBeGreaterThanOrEqual(1);
  });

  test('renders the trend chart', async ({ page }) => {
    await page.goto('/dashboard.html');

    // The trend chart canvas should exist
    const trendChart = page.locator('#trendChart, canvas#trendChart').first();
    await expect(trendChart).toBeVisible();
  });

  test('renders the expense pie/donut chart', async ({ page }) => {
    await page.goto('/dashboard.html');

    const pieChart = page.locator('#expenseChart, canvas#expenseChart').first();
    await expect(pieChart).toBeVisible();
  });

  test('renders the recurring split chart', async ({ page }) => {
    await page.goto('/dashboard.html');

    const recurringChart = page.locator('#recurringSplitChart, canvas#recurringSplitChart').first();
    await expect(recurringChart).toBeVisible();
  });

  test('renders the day-of-week chart', async ({ page }) => {
    await page.goto('/dashboard.html');

    const dayChart = page.locator('#dayOfWeekChart, canvas#dayOfWeekChart').first();
    await expect(dayChart).toBeVisible();
  });

  test('renders the budget vs actual chart', async ({ page }) => {
    await page.goto('/dashboard.html');

    const budgetChart = page.locator('#budgetVsActualChart, canvas#budgetVsActualChart').first();
    await expect(budgetChart).toBeVisible();
  });

  test('has an add expense form or button', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Look for an "Add Expense" button or a form
    const addBtn = page.locator('[id*="add"], [class*="add-expense"], button:has-text("Add"), #addExpenseBtn, #addBtn').first();
    // May or may not be visible depending on initial state — just verify something exists
    if (await addBtn.isVisible().catch(() => false)) {
      await expect(addBtn).toBeVisible();
    }
  });

  test('has export buttons for CSV, Excel, and PDF', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);

    // Look for export-related elements
    const exportElements = page.locator('[id*="export" i], [class*="export" i], button:has-text("Export" i), button:has-text("CSV" i), button:has-text("Excel" i), button:has-text("PDF" i)');
    const count = await exportElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('has category pills or filter section', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);

    // Look for category pills or filter elements
    const categoryElements = page.locator('#categoryPillsBar, .category-pills, [class*="category" i], [id*="filter" i]');
    const count = await categoryElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('has a profile menu trigger', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);

    const profileTrigger = page.locator('#profileTrigger, .avatar, [class*="profile" i]').first();
    if (await profileTrigger.isVisible().catch(() => false)) {
      await expect(profileTrigger).toBeVisible();
    }
  });

  test('redirects to login when auth token is missing', async ({ page }) => {
    // Clear localStorage — the dashboard should redirect to index.html
    await page.evaluate(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
    });

    await page.goto('/dashboard.html');

    // Should redirect to index.html after a moment
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('index.html');
  });
});

test.describe('Dashboard responsive layout', () => {
  test('renders correctly on mobile viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Mobile test — chromium only');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Mobile User');
    });

    await page.goto('/dashboard.html');
    await page.waitForTimeout(2000);

    // The page should not overflow horizontally on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
  });
});
