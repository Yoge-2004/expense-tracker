import { test, expect, type Page } from '@playwright/test';

const emptyApi = async (page: Page) => {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const headers = { 'content-type': 'application/json; charset=utf-8' };

    if (url.includes('/api/health')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ status: 'UP', database: 'UP' }) });
      return;
    }
    if (url.includes('/api/auth/config')) {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ googleClientId: '' }) });
      return;
    }
    await route.fulfill({ status: 200, headers, body: '[]' });
  });
};

test.describe('Feature Phone & Button Mobile Support (240x320 & 320x240)', () => {
  test('renders Sign In without horizontal overflow at 240x320', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await emptyApi(page);
    await page.goto('/index.html');

    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });

    expect(overflow).toBe(false);
  });

  test('renders Register page without horizontal overflow at 240x320', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await emptyApi(page);
    await page.goto('/register.html');

    const overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });

    expect(overflow).toBe(false);
  });

  test('renders Dashboard without horizontal overflow at 240x320 portrait and 320x240 landscape', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'KaiOS User');
      localStorage.setItem('role', 'ROLE_USER');
    });

    await emptyApi(page);
    await page.goto('/dashboard.html');
    await expect(page.locator('.top-bar')).toBeVisible();

    // Verify 240x320 Portrait
    let overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);

    // Verify 320x240 Landscape
    await page.setViewportSize({ width: 320, height: 240 });
    await page.waitForTimeout(200);

    overflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyW = document.body.scrollWidth;
      return scrollW > docW || bodyW > docW;
    });
    expect(overflow).toBe(false);
  });

  test('activates Softkey Bar and supports D-Pad arrow navigation on button mobiles', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.goto('/index.html');
    await emptyApi(page);

    const softkeyBar = page.locator('.feature-phone-softkeys');
    await expect(softkeyBar).toBeVisible();

    const lsk = page.locator('.fp-lsk');
    const csk = page.locator('.fp-csk');
    const rsk = page.locator('.fp-rsk');

    await expect(lsk).toBeVisible();
    await expect(csk).toBeVisible();
    await expect(rsk).toBeVisible();

    // Test ArrowDown navigation moves focus and applies .fp-focused
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);

    const focusedTag = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, hasFpFocus: el.classList.contains('fp-focused') } : null;
    });

    expect(focusedTag).not.toBeNull();
    expect(focusedTag?.hasFpFocus).toBe(true);
  });

  test('opens Expense modal via physical SoftLeft (F1) key', async ({ page }) => {
    await page.setViewportSize({ width: 240, height: 320 });
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('userId', '1');
      localStorage.setItem('userName', 'KaiOS User');
      localStorage.setItem('role', 'ROLE_USER');
    });

    await emptyApi(page);
    await page.goto('/dashboard.html');
    await expect(page.locator('.top-bar')).toBeVisible();

    // Press SoftLeft key (F1)
    await page.keyboard.press('F1');
    await page.waitForTimeout(200);

    const modal = page.locator('#expenseModal');
    await expect(modal).toBeVisible();

    // Press Escape/Back to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(modal).not.toBeVisible();
  });
});
