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

  test('loads and applies the web fonts', async ({ page }) => {
    const fontState = await page.evaluate(async () => {
      await document.fonts.ready;
      const body = getComputedStyle(document.body).fontFamily;
      const metricStyle = getComputedStyle(document.querySelector('.metric-value')!);
      const numeric = metricStyle.fontFamily;
      const bodyFontLoaded = document.fonts.check('16px "Hanken Grotesk"');
      // Browsers only fetch the faces text actually uses, so check the weight the numbers render in.
      const monoFontLoaded = document.fonts.check(`${metricStyle.fontWeight} 16px "IBM Plex Mono"`);
      const fontLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[href*="fonts.googleapis.com/css2"]'))
        .map(link => link.href);
      return { body, numeric, bodyFontLoaded, monoFontLoaded, fontLinks };
    });

    expect(fontState.body).toContain('Hanken Grotesk');
    expect(fontState.numeric).toContain('IBM Plex Mono');
    expect(fontState.bodyFontLoaded).toBe(true);
    expect(fontState.monoFontLoaded).toBe(true);
    expect(fontState.fontLinks.length).toBeGreaterThan(0);
    expect(fontState.fontLinks.every(href => href.includes('fonts.googleapis.com'))).toBe(true);
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
    // Layout size rather than getBoundingClientRect: the modal is still scaling in when it first appears.
    const layoutSize = (element: Element) => ({
      width: (element as HTMLElement).offsetWidth,
      height: (element as HTMLElement).offsetHeight,
    });

    await page.locator('#profileTrigger').click();
    await expect(page.locator('#profileMenu')).toBeVisible();
    await page.locator('#manageSubsBtn').click();
    await expect(expenses).toBeVisible();
    await expect(incomes).toBeVisible();

    const before = await Promise.all([
      expenses.evaluate(layoutSize),
      incomes.evaluate(layoutSize),
    ]);

    await incomes.click();
    await expect(incomes).toHaveClass(/active/);
    const afterIncome = await Promise.all([
      expenses.evaluate(layoutSize),
      incomes.evaluate(layoutSize),
    ]);

    await expenses.click();
    await expect(expenses).toHaveClass(/active/);
    const afterExpense = await expenses.evaluate(layoutSize);

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

  test('default look leaves every colour to the stylesheet, so each theme uses its own tokens', async ({ page }) => {
    const result = await page.evaluate(() => {
      const root = document.documentElement;
      const vars = ['--card-bg', '--bg-dark', '--text-main', '--text-muted', '--primary', '--metric-subs', '--metric-outflow', '--danger', '--success'];
      const snap = () => ({
        inline: vars.filter((v) => root.style.getPropertyValue(v) !== ''),
        card: getComputedStyle(root).getPropertyValue('--card-bg').trim(),
        text: getComputedStyle(root).getPropertyValue('--text-main').trim(),
      });
      const dark = snap();
      root.setAttribute('data-theme', 'light');
      const light = snap();
      root.setAttribute('data-theme', 'dark');
      return { dark, light };
    });

    // Nothing is written inline, so the stylesheet's [data-theme] blocks decide, instantly, in both directions.
    expect(result.dark.inline).toEqual([]);
    expect(result.light.inline).toEqual([]);
    expect(result.light.card).not.toBe(result.dark.card);
    expect(result.light.text).not.toBe(result.dark.text);
  });

  test('a customised palette is recomputed for the active theme and never drifts', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('app_custom_palette', JSON.stringify({
        primary: '#8B5CF6', primaryGradientEnd: '#7C3AED', accent: '#EC4899', highlight: '#A855F7',
      }));
    });
    await page.reload();
    await page.waitForSelector('.top-bar', { state: 'visible', timeout: 5000 });

    const run = await page.evaluate(async () => {
      const root = document.documentElement;
      const read = () => ({
        card: root.style.getPropertyValue('--card-bg').toLowerCase(),
        text: root.style.getPropertyValue('--text-main').toLowerCase(),
        primary: root.style.getPropertyValue('--primary').toLowerCase(),
      });
      const settle = () => new Promise((resolve) => setTimeout(resolve, 80));
      const dark = read();
      root.setAttribute('data-theme', 'light');
      await settle();
      const light = read();
      root.setAttribute('data-theme', 'dark');
      await settle();
      const darkAgain = read();
      return { dark, light, darkAgain, stored: localStorage.getItem('app_custom_palette') };
    });

    expect(run.dark.card).not.toBe('');
    // The light theme gets a light surface with dark text, not the dark palette left behind by the toggle.
    expect(run.light.card).toBe('#ffffff');
    expect(run.light.text).toBe('#0f172a');
    // Going back restores exactly what the dark theme had: the chosen colours are not rewritten by the toggle.
    expect(run.darkAgain).toEqual(run.dark);
    expect(JSON.parse(run.stored as string).primary).toBe('#8B5CF6');
  });

  test('calculator, charts and category colours follow a customised palette', async ({ page }) => {
    // On the light theme a very dark primary stays dark, so its readable label is white and a hard-coded dark
    // label would fail. (On the dark theme the studio lightens such a primary, so the label correctly stays dark.)
    await page.evaluate(() => {
      localStorage.setItem('app_custom_palette', JSON.stringify({
        primary: '#1E1B4B', primaryGradientEnd: '#312E81', accent: '#BE185D', highlight: '#0F766E',
      }));
    });
    await page.reload();
    await page.waitForSelector('.top-bar', { state: 'visible', timeout: 5000 });

    const result = await page.evaluate(async () => {
      const root = document.documentElement;
      root.setAttribute('data-theme', 'light');
      await new Promise((done) => setTimeout(done, 120));
      const resolve = (property: string, value: string) => {
        const el = document.createElement('i');
        document.body.appendChild(el);
        (el.style as any)[property] = value;
        const out = getComputedStyle(el)[property as any];
        el.remove();
        return out;
      };
      const probe = (cls: string) => {
        const el = document.createElement('button');
        el.className = cls;
        document.body.appendChild(el);
        const cs = getComputedStyle(el);
        const out = { color: cs.color, background: cs.backgroundColor };
        el.remove();
        return out;
      };
      const w = window as any;
      return {
        inlinePrimary: root.style.getPropertyValue('--primary').toLowerCase(),
        eqKey: probe('floating-calc-key is-eq'),
        useBtn: probe('floating-calc-use-btn'),
        plainKey: probe('floating-calc-key'),
        onPrimary: resolve('color', 'var(--on-primary)'),
        fillSubtle: resolve('backgroundColor', 'var(--fill-subtle)'),
        categoryFirst: w.DashboardUtils.getCategoryColor('anything', 0).color.toLowerCase(),
        chartPrimary: w.DashboardCharts.chartColors().primary.toLowerCase(),
        chartAccent: w.DashboardCharts.chartColors().accent.toLowerCase(),
        accentVar: root.style.getPropertyValue('--accent').toLowerCase(),
      };
    });

    expect(result.inlinePrimary).not.toBe('');
    // The calculator labels use the readable on-primary colour, not a fixed dark one.
    expect(result.eqKey.color).toBe(result.onPrimary);
    expect(result.useBtn.color).toBe(result.onPrimary);
    expect(result.onPrimary).not.toBe('rgb(16, 18, 14)');
    expect(result.eqKey.color).not.toBe('rgb(16, 18, 14)');
    // Neutral keys use the palette-derived fill instead of a fixed white overlay.
    expect(result.plainKey.background).toBe(result.fillSubtle);
    // Category and chart colours come from the live theme, never from the wallpaper.
    expect(result.categoryFirst).toBe(result.inlinePrimary);
    expect(result.chartPrimary).toBe(result.inlinePrimary);
    expect(result.chartAccent).toBe(result.accentVar);
  });
});
