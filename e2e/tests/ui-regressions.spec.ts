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

  test('loads the dashboard utility contract used by the filter controller', async ({ page }) => {
    await expect.poll(async () => page.evaluate(() => typeof window.DashboardUtils?.debounce)).toBe('function');
    await expect.poll(async () => page.evaluate(() => typeof window.DashboardUtils?.getCategoryColor)).toBe('function');
    await expect.poll(async () => page.evaluate(() => typeof window.DashboardUtils?.getCategoryEmoji)).toBe('function');
    await expect.poll(async () => page.evaluate(() => typeof window.DashboardFilters?.createController)).toBe('function');
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

  test('does not stack expensive theme-click animations on the button or background canvas', async ({ page }) => {
    const state = await page.evaluate(() => {
      const button = document.querySelector<HTMLElement>('#themeToggle');
      const canvas = document.querySelector<HTMLElement>('.animated-mesh-canvas');
      return {
        buttonAnimation: button ? getComputedStyle(button).animationName : null,
        canvasAnimation: canvas ? getComputedStyle(canvas).animationName : null,
      };
    });

    expect(state.buttonAnimation).not.toContain('themeShiftGlow');
    expect(state.canvasAnimation).toBe('none');
  });

  test('defines lightweight CSS transitions for all five metric card variants', async ({ page }) => {
    const selectors = [
      '.metric-card-inflow',
      '.metric-card-outflow',
      '.metric-card-netflow',
      '.metric-card-savings',
      '.metric-card-subs',
    ];

    await expect(page.locator('.grid-4-metrics > .metric-card')).toHaveCount(5);

    const states = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
      const card = document.querySelector<HTMLElement>(selector);
      if (!card) return { selector, transitionProperty: null, transitionDuration: null };
      const style = getComputedStyle(card);
      return {
        selector,
        transitionProperty: style.transitionProperty,
        transitionDuration: style.transitionDuration,
      };
    }), selectors);

    expect(states).toHaveLength(5);
    for (const state of states) {
      expect(state.transitionProperty).toContain('transform');
      expect(state.transitionProperty).toContain('background-color');
      expect(state.transitionProperty).toContain('border-color');
      expect(state.transitionProperty).toContain('border-left-color');
      expect(state.transitionProperty).toContain('color');
      expect(state.transitionProperty).not.toContain('box-shadow');
      expect(state.transitionDuration).toContain('0.2s');
    }

    await page.locator('#themeToggle').click();
    await expect.poll(async () => page.locator('html').getAttribute('data-theme')).toBe('light');
  });

  test('visibly transforms all five metric cards during a theme toggle', async ({ page }) => {
    const selectors = [
      '.metric-card-inflow',
      '.metric-card-outflow',
      '.metric-card-netflow',
      '.metric-card-savings',
      '.metric-card-subs',
    ];

    const before = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
      const card = document.querySelector<HTMLElement>(selector);
      return card ? getComputedStyle(card).transform : null;
    }), selectors);

    await page.locator('#themeToggle').click();
    await expect.poll(async () => page.locator('html').getAttribute('data-theme')).toBe('light');
    await page.waitForTimeout(80);

    const during = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
      const card = document.querySelector<HTMLElement>(selector);
      return card ? getComputedStyle(card).transform : null;
    }), selectors);

    expect(during).toHaveLength(5);
    for (let i = 0; i < before.length; i += 1) {
      expect(during[i]).not.toBe(before[i]);
    }
  });

  test('pauses the expensive background renderer during the theme repaint', async ({ page }) => {
    const gradientCalls = await page.evaluate(() => new Promise<number>((resolve) => {
      const context = window.CanvasRenderingContext2D?.prototype;
      if (!context) {
        resolve(0);
        return;
      }

      const original = context.createRadialGradient;
      let calls = 0;
      context.createRadialGradient = function (...args) {
        calls += 1;
        return original.apply(this, args);
      };

      document.querySelector<HTMLElement>('#themeToggle')?.click();
      setTimeout(() => {
        context.createRadialGradient = original;
        resolve(calls);
      }, 220);
    }));

    expect(gradientCalls).toBeLessThanOrEqual(1);
  });

  test('animates all five metric cards on dashboard entrance', async ({ page }) => {
    const selectors = [
      '.metric-card-inflow',
      '.metric-card-outflow',
      '.metric-card-netflow',
      '.metric-card-savings',
      '.metric-card-subs',
    ];

    const states = await page.evaluate((cardSelectors) => cardSelectors.map((selector) => {
      const card = document.querySelector<HTMLElement>(selector);
      if (!card) return { selector, animationName: null, duration: null, delay: null };
      const style = getComputedStyle(card);
      return {
        selector,
        animationName: style.animationName,
        duration: style.animationDuration,
        delay: style.animationDelay,
      };
    }), selectors);

    expect(states).toHaveLength(5);
    for (const state of states) {
      expect(state.animationName).toContain('staggeredSlideIn');
      expect(state.duration).toContain('0.75s');
      expect(state.delay).toMatch(/^(0s|0\.15s|0\.3s|0\.45s|0\.6s)$/);
    }
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
