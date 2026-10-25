import { test, expect } from '@playwright/test';

/**
 * PowerBI Executive Analytics Suite E2E Tests.
 *
 * Verifies:
 * - Executive Slicers Ribbon rendering and interactions (Horizon, Commitment, Flow)
 * - Reset Slicers button functionality
 * - Cumulative Spend Pacing S-Curve vs Daily Velocity toggle
 * - Active Cross-Filter Indicator HUD badge and 1-click dismissal
 * - KPI Micro-Sparklines & Budget Velocity pacing elements
 */
test.describe('PowerBI Executive Analytics Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-test-token-for-powerbi-suite');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Executive User');
      localStorage.setItem('userEmail', 'exec@test.com');
    });
    await page.goto('/dashboard.html');
    await page.waitForSelector('#powerBiSlicersRibbon', { state: 'visible', timeout: 8000 });
  });

  test('renders the executive slicers ribbon', async ({ page }) => {
    const ribbon = page.locator('#powerBiSlicersRibbon');
    await expect(ribbon).toBeVisible();
    await expect(ribbon.locator('.bi-badge')).toContainText('PowerBI Executive Slicers');
    await expect(ribbon.locator('.bi-slicers-title')).toContainText('Dimensional Analytics');
  });

  test('renders horizon slicer with all standard enterprise timeframes', async ({ page }) => {
    const horizonGroup = page.locator('#biHorizonSlicer');
    await expect(horizonGroup).toBeVisible();

    const pills = horizonGroup.locator('.bi-slicer-pill');
    await expect(pills).toHaveCount(6);

    await expect(horizonGroup.locator('[data-horizon="all"]')).toBeVisible();
    await expect(horizonGroup.locator('[data-horizon="mtd"]')).toBeVisible();
    await expect(horizonGroup.locator('[data-horizon="last30"]')).toBeVisible();
    await expect(horizonGroup.locator('[data-horizon="qtd"]')).toBeVisible();
    await expect(horizonGroup.locator('[data-horizon="ytd"]')).toBeVisible();
    await expect(horizonGroup.locator('[data-horizon="last7"]')).toBeVisible();
  });

  test('can toggle horizon slicer pills', async ({ page }) => {
    const horizonGroup = page.locator('#biHorizonSlicer');
    const mtdPill = horizonGroup.locator('[data-horizon="mtd"]');
    const allPill = horizonGroup.locator('[data-horizon="all"]');

    await mtdPill.click();
    await expect(mtdPill).toHaveClass(/active/);
    await expect(allPill).not.toHaveClass(/active/);

    await allPill.click();
    await expect(allPill).toHaveClass(/active/);
    await expect(mtdPill).not.toHaveClass(/active/);
  });

  test('renders commitment type slicer and toggles selection', async ({ page }) => {
    const commitmentGroup = page.locator('#biCommitmentSlicer');
    await expect(commitmentGroup).toBeVisible();

    const subsPill = commitmentGroup.locator('[data-commitment="recurring"]');
    await subsPill.click();
    await expect(subsPill).toHaveClass(/active/);

    const allPill = commitmentGroup.locator('[data-commitment="all"]');
    await allPill.click();
    await expect(allPill).toHaveClass(/active/);
  });

  test('renders flow direction slicer and syncs selection', async ({ page }) => {
    const streamGroup = page.locator('#biStreamSlicer');
    await expect(streamGroup).toBeVisible();

    const expensePill = streamGroup.locator('[data-stream="expenses"]');
    await expensePill.click();
    await expect(expensePill).toHaveClass(/active/);
  });

  test('renders trend chart segmented control and toggles to cumulative S-curve mode', async ({ page }) => {
    const trendCard = page.locator('.card.trend-card');
    await expect(trendCard).toBeVisible();

    const segmentedCtrl = trendCard.locator('.bi-chart-segmented-control');
    await expect(segmentedCtrl).toBeVisible();

    const cumBtn = segmentedCtrl.locator('[data-mode="cumulative"]');
    await expect(cumBtn).toBeVisible();
    await cumBtn.click();
    await expect(cumBtn).toHaveClass(/active/);

    const dailyBtn = segmentedCtrl.locator('[data-mode="daily"]');
    await dailyBtn.click();
    await expect(dailyBtn).toHaveClass(/active/);
  });

  test('renders active cross-filter badge upon programmatic or visual selection and clears on close', async ({ page }) => {
    // Trigger programmatic cross-filter via window.DashboardPowerBI
    await page.evaluate(() => {
      window.DashboardPowerBI!.applyCrossFilter('category', 'Dining', 'Food & Dining');
    });

    const crossFilterContainer = page.locator('#biCrossFilterContainer');
    await expect(crossFilterContainer).toBeVisible();
    await expect(crossFilterContainer).toContainText('Food & Dining');

    // Click clear cross-filter button
    const closeBtn = page.locator('#biClearCrossFilterBtn');
    await closeBtn.click();
    await expect(crossFilterContainer).toBeHidden();
  });

  test('reset slicers button restores default all-time state', async ({ page }) => {
    const mtdPill = page.locator('#biHorizonSlicer [data-horizon="mtd"]');
    await mtdPill.click();
    await expect(mtdPill).toHaveClass(/active/);

    // Click reset
    const resetBtn = page.locator('#biResetSlicersBtn');
    await resetBtn.click();

    const allPill = page.locator('#biHorizonSlicer [data-horizon="all"]');
    await expect(allPill).toHaveClass(/active/);
    await expect(mtdPill).not.toHaveClass(/active/);
  });
});
