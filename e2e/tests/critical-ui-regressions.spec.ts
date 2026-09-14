import { test, expect } from '@playwright/test';

/**
 * High-value regressions that must exercise the actual dashboard DOM state,
 * not only CSS geometry.
 */
test.describe('Critical UI regressions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'fake-critical-ui-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'Test User');
      localStorage.setItem('userEmail', 'test@test.com');
      localStorage.setItem('theme', 'dark');
    });
    await page.goto('/dashboard.html');
    await page.waitForSelector('.top-bar', { state: 'visible', timeout: 5000 });
  });

  test('loads and applies the restored web fonts', async ({ page }) => {
    const fontState = await page.evaluate(async () => {
      await document.fonts.ready;
      const body = getComputedStyle(document.body).fontFamily;
      const display = getComputedStyle(document.querySelector('.metric-value')!).fontFamily;
      const bodyFontLoaded = document.fonts.check('16px "Hanken Grotesk"');
      const displayFontLoaded = document.fonts.check('16px "Fraunces"');
      const monoFontLoaded = document.fonts.check('16px "IBM Plex Mono"');
      const fontLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[href*="fonts.googleapis.com/css2"]'))
        .map(link => link.href);
      return { body, display, bodyFontLoaded, displayFontLoaded, monoFontLoaded, fontLinks };
    });

    expect(fontState.body).toContain('Hanken Grotesk');
    expect(fontState.display).toContain('Fraunces');
    expect(fontState.bodyFontLoaded).toBe(true);
    expect(fontState.displayFontLoaded).toBe(true);
    expect(fontState.monoFontLoaded).toBe(true);
    expect(fontState.fontLinks.length).toBeGreaterThan(0);
    expect(fontState.fontLinks.every(href => href.includes('v=20260914-font1'))).toBe(true);
  });

  test('opens and visibly renders the expense modal', async ({ page }) => {
    const modal = page.locator('#expenseModal');
    const dialog = modal.locator(':scope > .modal');

    await expect(modal).not.toHaveClass(/active/);
    await page.locator('#openModalBtn').click();
    await expect(modal).toHaveClass(/active/);
    await expect.poll(async () => dialog.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);
    await expect.poll(async () => page.evaluate(() => document.body.classList.contains('modal-open'))).toBe(true);

    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/active/);
    await expect.poll(async () => page.evaluate(() => document.body.classList.contains('modal-open'))).toBe(false);
  });

  test('opens and visibly renders the income modal without inline handlers', async ({ page }) => {
    const trigger = page.locator('#openIncomeModalBtn');
    const modal = page.locator('#incomeModal');
    const dialog = modal.locator(':scope > .modal');

    await expect(trigger).not.toHaveAttribute('onclick');
    await page.locator('#openIncomeModalBtn').click();
    await expect(modal).toHaveClass(/active/);
    await expect.poll(async () => dialog.evaluate(element => Number.parseFloat(getComputedStyle(element).opacity))).toBeGreaterThan(0.9);

    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/active/);
  });

  test('keeps subscription tabs the same size while switching state', async ({ page }) => {
    const expenses = page.locator('#subsTabExpensesBtn');
    const incomes = page.locator('#subsTabIncomesBtn');

    await page.locator('#profileTrigger').click();
    await expect(page.locator('#profileMenu')).toBeVisible();
    await page.locator('#manageSubsBtn').click();
    await expect(expenses).toBeVisible();
    await expect(incomes).toBeVisible();

    const before = await Promise.all([
      expenses.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
      incomes.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
    ]);

    await incomes.click();
    await expect(incomes).toHaveClass(/active/);
    const afterIncome = await Promise.all([
      expenses.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
      incomes.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })),
    ]);

    await expenses.click();
    await expect(expenses).toHaveClass(/active/);
    const afterExpense = await expenses.evaluate(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));

    expect(afterIncome[0]).toEqual(before[0]);
    expect(afterIncome[1]).toEqual(before[1]);
    expect(afterExpense).toEqual(before[0]);
  });

  test('switches theme atomically without animating the populated dashboard', async ({ page }) => {
    await page.locator('#themeToggle').click();

    const duringSwitch = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      const sample = document.querySelector<HTMLElement>('.expense-item, .metric-card, .card');
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        switching: document.documentElement.classList.contains('theme-switching'),
        sampleTransitionDuration: sample ? getComputedStyle(sample).transitionDuration : null,
        rootTransitionDuration: rootStyle.transitionDuration,
      };
    });

    expect(duringSwitch.theme).toBe('light');
    expect(duringSwitch.switching).toBe(true);
    expect(duringSwitch.sampleTransitionDuration).toBe('0s');
    expect(duringSwitch.rootTransitionDuration).toBe('0s');

    await page.waitForTimeout(50);
    await expect.poll(async () => page.evaluate(() => document.documentElement.classList.contains('theme-switching'))).toBe(false);
  });

  test('uses a non-purple subscription metric token in both themes', async ({ page }) => {
    const colors = await page.evaluate(() => {
      const root = document.documentElement;
      const read = () => getComputedStyle(root).getPropertyValue('--metric-subs').trim();
      const dark = read();
      root.setAttribute('data-theme', 'light');
      const light = read();
      root.setAttribute('data-theme', 'dark');
      return { dark, light };
    });

    expect(colors.dark).toBe('#C0565E');
    expect(colors.light).toBe('#B54858');
    expect(colors.dark).not.toBe('#8B5CF6');
    expect(colors.light).not.toBe('#7C3AED');
  });
});
