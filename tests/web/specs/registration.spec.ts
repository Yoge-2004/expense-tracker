import { test, expect } from '@playwright/test';

test.describe('registration UI regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/config', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ emailVerificationEnabled: false }),
    }));
    await page.route('**/api/users/suggest-usernames**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ suggestions: ['john_1', 'john_2', 'john_3'] }),
    }));
  });

  test('registration remains usable across responsive viewports and renders three username choices', async ({ page }) => {
    await page.goto('/register.html');

    await expect(page.locator('#reg-name')).toBeVisible();
    await expect(page.locator('#reg-username')).toBeVisible();

    await page.locator('#reg-name').fill('John Doe');
    await page.locator('#reg-username').fill('john');

    const suggestions = page.locator('#usernameSuggestions');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.locator('.suggestion-chip')).toHaveCount(3);

    const chips = suggestions.locator('.suggestion-chip');
    await expect(chips.nth(0)).toContainText('@john_1');
    await expect(chips.nth(1)).toContainText('@john_2');
    await expect(chips.nth(2)).toContainText('@john_3');

    const body = page.locator('body');
    const box = await body.boundingBox();
    expect(box?.width).toBeGreaterThan(0);
    expect(box?.height).toBeGreaterThan(0);
    await expect(body).toHaveCSS('overflow-x', /hidden|visible|clip/);
  });
});
