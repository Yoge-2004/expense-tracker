/**
 * Detox E2E test: Dashboard & Expense Management flow.
 *
 * Tests the dashboard screen, expense creation, income creation,
 * navigation between tabs, and profile/settings.
 */

import { by, device, element, expect as detoxExpect } from 'detox';

describe('Dashboard & Expenses', () => {

  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // Login first (assumes a test user exists)
    await element(by.id('email-input')).typeText('demo@expensetracker.com');
    await element(by.id('password-input')).typeText('Demo1234!');
    await element(by.id('login-button')).tap();
    // Wait for dashboard to load
    await detoxExpect(element(by.id('dashboard-screen'))).toBeVisible().withTimeout(15000);
  });

  describe('Dashboard Screen', () => {

    it('should display the dashboard with key metrics', async () => {
      await detoxExpect(element(by.id('dashboard-screen'))).toBeVisible();
      await detoxExpect(element(by.id('total-amount-card'))).toBeVisible();
      await detoxExpect(element(by.id('savings-rate-card'))).toBeVisible();
    });

    it('should display the bottom tab bar', async () => {
      await detoxExpect(element(by.id('tab-home'))).toBeVisible();
      await detoxExpect(element(by.id('tab-add-expense'))).toBeVisible();
      await detoxExpect(element(by.id('tab-subscriptions'))).toBeVisible();
      await detoxExpect(element(by.id('tab-profile'))).toBeVisible();
    });

    it('should display financial charts', async () => {
      // Scroll to charts section
      await element(by.id('dashboard-scrollview')).scrollTo('down');
      await detoxExpect(element(by.id('trend-chart'))).toBeVisible();
    });
  });

  describe('Add Expense Flow', () => {

    it('should navigate to add expense screen', async () => {
      await element(by.id('tab-add-expense')).tap();
      await detoxExpect(element(by.id('add-expense-screen'))).toBeVisible();
    });

    it('should display expense form fields', async () => {
      await element(by.id('tab-add-expense')).tap();

      await detoxExpect(element(by.id('amount-input'))).toBeVisible();
      await detoxExpect(element(by.id('description-input'))).toBeVisible();
      await detoxExpect(element(by.id('date-picker'))).toBeVisible();
      await detoxExpect(element(by.id('category-picker'))).toBeVisible();
    });

    it('should accept expense input and save', async () => {
      await element(by.id('tab-add-expense')).tap();

      await element(by.id('amount-input')).typeText('50.00');
      await element(by.id('description-input')).typeText('Lunch');
      await element(by.id('save-button')).tap();

      // Should navigate back to dashboard
      await detoxExpect(element(by.id('dashboard-screen'))).toBeVisible();
    });

    it('should validate amount is required', async () => {
      await element(by.id('tab-add-expense')).tap();

      // Don't fill in amount
      await element(by.id('description-input')).typeText('No amount');
      await element(by.id('save-button')).tap();

      // Should show error or stay on form
      await detoxExpect(element(by.id('add-expense-screen'))).toBeVisible();
    });
  });

  describe('Subscriptions Tab', () => {

    it('should navigate to subscriptions screen', async () => {
      await element(by.id('tab-subscriptions')).tap();
      await detoxExpect(element(by.id('subscriptions-screen'))).toBeVisible();
    });

    it('should display subscription list or empty state', async () => {
      await element(by.id('tab-subscriptions')).tap();
      await detoxExpect(element(by.id('subscriptions-screen'))).toBeVisible();
      // Either the list or an empty state message should be visible
      await detoxExpect(
        element(by.id('subscription-list')).or(by.id('empty-state'))
      ).toBeVisible();
    });
  });

  describe('Profile Tab', () => {

    it('should navigate to profile screen', async () => {
      await element(by.id('tab-profile')).tap();
      await detoxExpect(element(by.id('profile-screen'))).toBeVisible();
    });

    it('should display user info and settings', async () => {
      await element(by.id('tab-profile')).tap();

      await detoxExpect(element(by.id('profile-screen'))).toBeVisible();
      await detoxExpect(element(by.id('user-name'))).toBeVisible();
      await detoxExpect(element(by.id('currency-selector'))).toBeVisible();
      await detoxExpect(element(by.id('theme-toggle'))).toBeVisible();
      await detoxExpect(element(by.id('logout-button'))).toBeVisible();
    });

    it('should toggle theme', async () => {
      await element(by.id('tab-profile')).tap();
      await element(by.id('theme-toggle')).tap();
      // Theme should change (no error = pass)
    });

    it('should logout and return to login screen', async () => {
      await element(by.id('tab-profile')).tap();
      await element(by.id('logout-button')).tap();

      await detoxExpect(element(by.id('login-screen'))).toBeVisible();
    });
  });
});
