/**
 * Detox E2E test: Login & Authentication flow.
 *
 * Tests the login screen, registration screen, and forgot-password screen
 * on the mobile app (iOS simulator / Android emulator).
 */

import { by, device, element, expect as detoxExpect } from 'detox';

describe('Login & Authentication', () => {

  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Login Screen', () => {

    it('should display the login screen with email and password fields', async () => {
      // Look for the login form elements
      await detoxExpect(element(by.id('login-screen'))).toBeVisible();
      await detoxExpect(element(by.id('email-input'))).toBeVisible();
      await detoxExpect(element(by.id('password-input'))).toBeVisible();
    });

    it('should display the login button', async () => {
      await detoxExpect(element(by.id('login-button'))).toBeVisible();
    });

    it('should display Google OAuth button', async () => {
      await detoxExpect(element(by.id('google-oauth-button'))).toBeVisible();
    });

    it('should display biometric login button', async () => {
      await detoxExpect(element(by.id('biometric-login-button'))).toBeVisible();
    });

    it('should accept email input', async () => {
      await element(by.id('email-input')).typeText('test@example.com');
      await detoxExpect(element(by.id('email-input'))).toHaveText('test@example.com');
    });

    it('should accept password input', async () => {
      await element(by.id('password-input')).typeText('Password123!');
    });

    it('should show error for invalid credentials', async () => {
      await element(by.id('email-input')).typeText('wrong@test.com');
      await element(by.id('password-input')).typeText('wrongpassword');
      await element(by.id('login-button')).tap();

      // Should stay on login screen (not navigate to dashboard)
      await detoxExpect(element(by.id('login-screen'))).toBeVisible();
    });

    it('should navigate to register screen', async () => {
      await element(by.id('register-link')).tap();
      await detoxExpect(element(by.id('register-screen'))).toBeVisible();
    });

    it('should navigate to forgot password screen', async () => {
      await element(by.id('forgot-password-link')).tap();
      await detoxExpect(element(by.id('forgot-password-screen'))).toBeVisible();
    });
  });

  describe('Registration Screen', () => {

    it('should display all registration form fields', async () => {
      await element(by.id('register-link')).tap();
      await detoxExpect(element(by.id('register-screen'))).toBeVisible();

      await detoxExpect(element(by.id('name-input'))).toBeVisible();
      await detoxExpect(element(by.id('username-input'))).toBeVisible();
      await detoxExpect(element(by.id('email-input'))).toBeVisible();
      await detoxExpect(element(by.id('password-input'))).toBeVisible();
    });

    it('should accept registration input', async () => {
      await element(by.id('register-link')).tap();

      await element(by.id('name-input')).typeText('Test User');
      await element(by.id('username-input')).typeText('testuser123');
      await element(by.id('email-input')).typeText('test@example.com');
      await element(by.id('password-input')).typeText('SecurePass123!');
    });
  });

  describe('Forgot Password Screen', () => {

    it('should display the forgot password form', async () => {
      await element(by.id('forgot-password-link')).tap();
      await detoxExpect(element(by.id('forgot-password-screen'))).toBeVisible();
      await detoxExpect(element(by.id('email-input'))).toBeVisible();
    });
  });
});
