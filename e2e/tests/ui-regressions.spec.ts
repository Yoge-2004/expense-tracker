import { test, expect } from '@playwright/test';

/**
 * Targeted regressions for UI behavior that is easy to break during CSS/animation work.
 * These tests intentionally validate structure and computed layout rather than visuals.
 */
test.describe('Targeted UI regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-ui-regression-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
      localStorage.setItem('userEmail', 'test@test.com');
      localStorage.setItem('theme', 'dark');
    });
    await page.goto('/dashboard.html');
    await page.waitForSelector('.top-bar', { state: 'visible', timeout: 5000 });
  });

  test('keeps form input icons visible and positioned inside their wrappers', async ({ page }) => {
    const icons = page.locator('.input-wrapper > .input-icon, .input-wrapper > svg.input-icon');
    expect(await icons.count()).toBeGreaterThan(0);

    const firstIcon = icons.first();
    await expect(firstIcon).toBeVisible();

    const position = await firstIcon.evaluate((element) => getComputedStyle(element).position);
    expect(position).toBe('absolute');
  });

  test('keeps subscription modal tabs attached and usable', async ({ page }) => {
    await expect(page.locator('#manageSubsBtn')).toBeAttached();
    await expect(page.locator('#subsTabExpensesBtn')).toBeAttached();
    await expect(page.locator('#subsTabIncomesBtn')).toBeAttached();

    await page.locator('#manageSubsBtn').click();
    await expect(page.locator('#subsTabExpensesBtn')).toBeVisible();
    await expect(page.locator('#subsTabIncomesBtn')).toBeVisible();

    await page.locator('#subsTabIncomesBtn').click();
    await expect(page.locator('#subsTabIncomesBtn')).toHaveClass(/active/);
    await page.locator('#subsTabExpensesBtn').click();
    await expect(page.locator('#subsTabExpensesBtn')).toHaveClass(/active/);
  });

  test('switches theme without losing the explicit theme state', async ({ page }) => {
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', 'dark');

    await page.locator('#themeToggle').click();
    await expect.poll(async () => root.getAttribute('data-theme')).toBe('light');

    await page.locator('#themeToggle').click();
    await expect.poll(async () => root.getAttribute('data-theme')).toBe('dark');
  });

  test('animates all five metric card variants during a theme switch', async ({ page }) => {
    const expectedVariants = [
      ['.metric-card-inflow', 'metric-inflow'],
      ['.metric-card-outflow', 'metric-outflow'],
      ['.metric-card-netflow', 'metric-netflow'],
      ['.metric-card-savings', 'metric-savings'],
      ['.metric-card-subs', 'metric-subs'],
    ] as const;

    await expect(page.locator('.grid-4-metrics > .metric-card')).toHaveCount(5);

    const baseStates = await page.evaluate((variants) => variants.map(([selector, name]) => {
      const card = document.querySelector<HTMLElement>(selector);
      if (!card) return { selector, expected: name, actual: null };

      const style = getComputedStyle(card);
      return {
        selector,
        expected: name,
        actual: style.viewTransitionName,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
      };
    }), expectedVariants);

    expect(baseStates).toHaveLength(5);
    for (const state of baseStates) {
      expect(state.actual).toBe(state.expected);
      expect(state.transitionProperty).toContain('background-color');
      expect(state.transitionProperty).toContain('border-color');
      expect(state.transitionProperty).toContain('box-shadow');
      expect(state.transitionProperty).toContain('color');
      expect(state.transitionDuration).toContain('0.24s');
    }

    await page.locator('#themeToggle').evaluate((button) => (button as HTMLButtonElement).click());

    const switchingStates = await page.evaluate((variants) => variants.map(([selector]) => {
      const card = document.querySelector<HTMLElement>(selector);
      if (!card) return { selector, animationName: null, animationDuration: null };
      const style = getComputedStyle(card);
      return {
        selector,
        animationName: style.animationName,
        animationDuration: style.animationDuration,
      };
    }), expectedVariants);

    expect(switchingStates).toHaveLength(5);
    for (const state of switchingStates) {
      expect(state.animationName).toContain('metricThemeSwitch');
      expect(state.animationDuration).toContain('0.24');
    }

    await expect.poll(async () => page.locator('html').getAttribute('data-theme')).toBe('light');
  });

  test('keeps both record controls on their intended primary gradients', async ({ page }) => {
    const backgrounds = await page.locator('#openModalBtn, #openIncomeModalBtn').evaluateAll((elements) =>
      elements.map(element => getComputedStyle(element).backgroundImage),
    );

    expect(backgrounds).toHaveLength(2);
    expect(backgrounds.every(value => value.includes('linear-gradient'))).toBe(true);
  });

  test('removes redundant income inline handlers while preserving the global API', async ({ page }) => {
    for (const selector of ['#openIncomeModalBtn', '#addIncomeTableBtn']) {
      await expect.poll(async () => page.locator(selector).getAttribute('onclick')).toBeNull();
    }

    await expect.poll(async () => page.evaluate(() => typeof window.openNewIncomeModal)).toBe('function');
  });
});
