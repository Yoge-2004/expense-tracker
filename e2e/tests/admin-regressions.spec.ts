import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The admin console: every tab must actually show, and the calls it makes must match the backend.
 *
 * Two regressions this guards:
 *  - the HTML moved to `.d-none` (display: none !important) while the tab switcher kept setting an inline
 *    `style.display = "block"`, so every tab except Mission Control stayed hidden and looked empty;
 *  - three admin calls used the wrong HTTP method / path (status PUT instead of PATCH, role PUT instead of
 *    POST, ML sandbox under /sandbox/predict) and sent or read the wrong field names.
 */

const users = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: `User ${index + 1}`,
  username: `user${index + 1}`,
  email: `u${index + 1}@example.com`,
  role: 'ROLE_USER',
  accountLocked: false,
  expenseCount: (index + 1) * 3,
  createdAt: '2026-10-01T10:00:00',
}));

type Written = { method: string; path: string; body: string | null };

/** Answers every admin endpoint with the shape the backend's DTOs actually have. */
const mockAdminApi = async (page: Page): Promise<Written[]> => {
  const written: Written[] = [];
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^.*\/api/, '');
    const method = request.method();
    const reply = (body: unknown) =>
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
        body: JSON.stringify(body),
      });

    if (path.startsWith('/webauthn/')) return route.continue();
    if (method !== 'GET' && method !== 'OPTIONS') written.push({ method, path, body: request.postData() });

    if (path === '/health') return reply({ status: 'UP' });
    if (path === '/admin/me/permissions') {
      return reply({ role: 'ROLE_SUPER_ADMIN', username: 'admin', canModifyRoles: true, canTriggerFailover: true, canBroadcastNotifications: true });
    }
    if (path === '/admin/metrics/summary') return reply({ totalUsers: users.length });
    if (path === '/admin/users') return reply({ content: users, totalPages: 1, totalElements: users.length });
    if (path === '/admin/ml/stats') {
      return reply({ totalFeedbackCount: 1234, pendingFeedbackCount: 7, reviewedFeedbackCount: 1227, activeModelVersion: 'tfidf-v9', averageConfidence: 0.8, status: 'OK' });
    }
    if (path === '/admin/ml/test-prediction') {
      return reply({ category: 'Food', confidence: 0.91, topK: [{ category: 'Food', confidence: 0.91 }, { category: 'Shopping', confidence: 0.05 }], modelRevision: 'r1', modelType: 'tfidf' });
    }
    if (path === '/admin/ml/feedback/pending') return reply({ content: [], totalPages: 0 });
    if (path === '/admin/ml/retrain/logs') return reply({ runs: [], terminalLogs: [] });
    if (path === '/admin/resilience/status') return reply({ space: 'owner/space', isConfigured: true, statusMessage: 'ok' });
    return reply({});
  });
  return written;
};

const openAdmin = async (page: Page) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/index.html');
  await page.evaluate(() => {
    localStorage.setItem('token', 'admin-regression-token');
    localStorage.setItem('userId', '1');
    localStorage.setItem('userRole', 'ROLE_SUPER_ADMIN');
  });
  const written = await mockAdminApi(page);
  await page.goto('/admin.html');
  await expect(page.locator('#overviewTab')).toBeVisible();
  return written;
};

const openTab = (page: Page, tab: string) =>
  page.evaluate((id) => {
    document.querySelector<HTMLElement>(`.admin-nav-item[data-tab="${id}"]`)!.click();
  }, tab);

test.describe('Admin console', () => {
  test('every tab becomes visible when selected and the others hide', async ({ page }) => {
    await openAdmin(page);
    const tabs = await page.$$eval('.admin-nav-item[data-tab]', (items) => items.map((item) => item.getAttribute('data-tab') as string));
    expect(tabs.length).toBeGreaterThanOrEqual(7);

    for (const tab of tabs) {
      await openTab(page, tab);
      await expect(page.locator(`#${tab}`)).toBeVisible();
      const visibleViews = await page.$$eval('.admin-content-view', (views) =>
        views.filter((view) => getComputedStyle(view).display !== 'none').map((view) => view.id));
      expect(visibleViews).toEqual([tab]);
    }
  });

  test('User Intelligence lists the users instead of an empty pane', async ({ page }) => {
    await openAdmin(page);
    await openTab(page, 'usersTab');
    await expect(page.locator('#userTableBody tr')).toHaveCount(users.length);
    await expect(page.locator('#userTableBody')).toBeVisible();
  });

  test('ML tab shows the real stats and the sandbox uses the backend contract', async ({ page }) => {
    const written = await openAdmin(page);
    await openTab(page, 'mlTab');
    await expect(page.locator('#mlActiveModel')).toHaveText('tfidf-v9');
    await expect(page.locator('#mlPendingFeedback')).toContainText('7');
    await expect(page.locator('#mlTotalFeedback')).toHaveText('1,234');

    await page.fill('#sandboxTextInput', 'swiggy dinner');
    await page.click('#runSandboxInferenceBtn');
    await expect(page.locator('#sandboxTopCategory')).toHaveText('Food');
    await expect(page.locator('#sandboxCandidateBars .sandbox-cand-row')).toHaveCount(2);

    const call = written.find((entry) => entry.path === '/admin/ml/test-prediction');
    expect(call?.method).toBe('POST');
    expect(JSON.parse(call?.body ?? '{}')).toEqual({ description: 'swiggy dinner' });
  });

  test('account lock uses PATCH and role change uses POST', async ({ page }) => {
    const written = await openAdmin(page);
    await openTab(page, 'usersTab');
    await expect(page.locator('#userTableBody tr')).toHaveCount(users.length);

    await page.evaluate(() => document.querySelector<HTMLElement>('#userTableBody [data-action="inspect"][data-id="3"]')!.click());
    await page.evaluate(() => document.getElementById('drawerToggleLockBtn')!.click());
    await page.fill('#stepUpModalPinInput', '123456');
    await page.evaluate(() => document.getElementById('stepUpConfirmBtn')!.click());
    await expect.poll(() => written.some((entry) => entry.path === '/admin/users/3/status')).toBe(true);

    await page.evaluate(() => document.getElementById('drawerApplyRoleBtn')!.click());
    await page.fill('#stepUpModalPinInput', '123456');
    await page.evaluate(() => document.getElementById('stepUpConfirmBtn')!.click());
    await expect.poll(() => written.some((entry) => entry.path === '/admin/users/3/role')).toBe(true);

    expect(written.find((entry) => entry.path === '/admin/users/3/status')?.method).toBe('PATCH');
    expect(written.find((entry) => entry.path === '/admin/users/3/role')?.method).toBe('POST');
  });
});
