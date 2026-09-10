import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const base64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');

async function installVirtualAuthenticator(context: BrowserContext, page: Page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const result = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId: result.authenticatorId };
}

test.describe('WebAuthn biometrics', () => {
  test('diagnoses WebAuthn capability without requiring a registered credential', async ({ page }) => {
    await page.goto('/index.html');

    const diagnostics = await page.evaluate(async () => {
      if (!window.WebBiometrics?.getDiagnostics) throw new Error('WebBiometrics diagnostics are not loaded');
      return await window.WebBiometrics.getDiagnostics();
    });

    expect(diagnostics.webAuthnApi).toBe(true);
    expect(diagnostics.secureContext).toBe(true);
    expect(typeof diagnostics.reason).toBe('string');
    expect(diagnostics.origin).toMatch(/^https?:\/\//);
  });

  test('completes register and authenticate ceremonies with a virtual platform authenticator', async ({ page, context }) => {
    await page.goto('/index.html');
    await page.evaluate(() => {
      localStorage.setItem('token', 'webauthn-e2e-token');
      localStorage.setItem('userId', '7');
      localStorage.setItem('userName', 'WebAuthn Test');
      localStorage.setItem('userEmail', 'webauthn@example.com');
    });

    await installVirtualAuthenticator(context, page);

    const registerFinish = new Promise<{ transactionId: string; credential: any }>(resolve => {
      page.route('**/api/webauthn/register/options', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transactionId: 'register-tx',
            publicKey: {
              rp: { id: 'localhost', name: 'Expense Tracker Pro' },
              user: {
                id: base64Url('user-7'),
                name: 'webauthn@example.com',
                displayName: 'WebAuthn Test',
              },
              challenge: base64Url('register-challenge'),
              pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
              timeout: 60000,
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                residentKey: 'required',
                userVerification: 'required',
              },
              attestation: 'none',
            },
          }),
        });
      });

      page.route('**/api/webauthn/register/finish', async route => {
        const body = JSON.parse(route.request().postData() || '{}');
        const credential = JSON.parse(body.credential || '{}');
        resolve({ transactionId: body.transactionId, credential });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Biometric sign-in is now enabled on this device.' }),
        });
      });
    });

    const enrollResult = await page.evaluate(async () => {
      return await window.WebBiometrics.enroll('webauthn@example.com', 'webauthn-e2e-token');
    });

    const registered = await registerFinish;
    expect(enrollResult.message).toContain('Biometric sign-in');
    expect(registered.transactionId).toBe('register-tx');
    expect(registered.credential.id).toBeTruthy();
    expect(registered.credential.rawId).toBeTruthy();
    expect(registered.credential.response.clientDataJSON).toBeTruthy();
    expect(registered.credential.response.attestationObject).toBeTruthy();

    const credentialId = registered.credential.rawId;

    let authenticationFinish: any = null;
    await page.route('**/api/webauthn/login/options', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          transactionId: 'login-tx',
          publicKey: {
            rpId: 'localhost',
            challenge: base64Url('login-challenge'),
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: [{ type: 'public-key', id: credentialId }],
          },
        }),
      });
    });

    await page.route('**/api/webauthn/login/finish', async route => {
      const body = JSON.parse(route.request().postData() || '{}');
      authenticationFinish = {
        transactionId: body.transactionId,
        credential: JSON.parse(body.credential || '{}'),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'verified-jwt', userId: 7, name: 'WebAuthn Test', email: 'webauthn@example.com' }),
      });
    });

    const authResult = await page.evaluate(async () => {
      return await window.WebBiometrics.authenticate();
    });

    expect(authResult.token).toBe('verified-jwt');
    expect(authResult.userId).toBe(7);
    expect(authenticationFinish.transactionId).toBe('login-tx');
    expect(authenticationFinish.credential.response.clientDataJSON).toBeTruthy();
    expect(authenticationFinish.credential.response.authenticatorData).toBeTruthy();
    expect(authenticationFinish.credential.response.signature).toBeTruthy();
  });
});
