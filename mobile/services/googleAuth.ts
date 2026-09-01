import { Platform } from 'react-native';
import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_OAUTH_CONFIG } from '../constants/auth';

WebBrowser.maybeCompleteAuthSession();

let isNativeConfigured = false;

const isExpoGo =
  Constants.appOwnership === AppOwnership.Expo ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Lazy loads the native Google Sign-In module only when running in a standalone/dev build.
 * Prevents Invariant Violation crashes when running inside Expo Go.
 */
function getNativeGoogleSigninModule(): any {
  if (isExpoGo || Platform.OS === 'web') {
    return null;
  }
  try {
    // Dynamic require so TurboModuleRegistry does not execute on Expo Go load
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

export function configureGoogleSignIn(): void {
  if (isNativeConfigured || Platform.OS === 'web' || isExpoGo) return;

  const module = getNativeGoogleSigninModule();
  if (!module?.GoogleSignin) return;

  try {
    module.GoogleSignin.configure({
      webClientId: GOOGLE_OAUTH_CONFIG.webClientId,
      iosClientId: GOOGLE_OAUTH_CONFIG.iosClientId,
      offlineAccess: false,
    });
    isNativeConfigured = true;
  } catch (err) {
    console.warn('[GoogleAuth] Native GoogleSignin.configure error:', err);
  }
}

/**
 * Fallback OAuth flow for Expo Go and Web environments using expo-auth-session and the Expo auth proxy.
 */
async function performExpoGoAuth(): Promise<string | null> {
  const isWeb = Platform.OS === 'web';
  const owner = Constants.expoConfig?.owner || 'anonymous';
  const slug = Constants.expoConfig?.slug || 'expense-tracker-mobile';
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  if (isWeb) {
    const redirectUri = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    const authRequest = new AuthSession.AuthRequest({
      clientId: GOOGLE_OAUTH_CONFIG.webClientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri,
      usePKCE: false,
      extraParams: { nonce, prompt: 'select_account' },
    });

    const result = await authRequest.promptAsync(GOOGLE_DISCOVERY);
    if (result.type === 'success') {
      const idToken = result.params?.id_token || (result as any).authentication?.idToken;
      if (idToken) return idToken;
      throw new Error('Google Sign-In completed but no ID token was returned.');
    }
    if (result.type === 'error') {
      const desc = result.error?.message || result.params?.error_description || result.params?.error || 'OAuth error';
      throw new Error(`Google Sign-In Error: ${desc}`);
    }
    return null;
  }

  // Running inside Expo Go on Android / iOS device:
  // Must use the Expo Auth Proxy /start endpoint so auth.expo.io sets the session returnUrl cookie!
  const proxyRedirectUri = `https://auth.expo.io/@${owner}/${slug}`;
  const returnUrl = AuthSession.getDefaultReturnUrl();

  console.log('[GoogleAuth] Starting Expo Go proxy auth with redirectUri:', proxyRedirectUri, 'and returnUrl:', returnUrl);

  const authRequest = new AuthSession.AuthRequest({
    clientId: GOOGLE_OAUTH_CONFIG.webClientId,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    redirectUri: proxyRedirectUri,
    usePKCE: false,
    extraParams: {
      nonce,
      prompt: 'select_account',
    },
  });

  const authUrl = await authRequest.makeAuthUrlAsync(GOOGLE_DISCOVERY);

  // Construct startUrl for auth.expo.io proxy
  const startUrl = `${proxyRedirectUri}/start?${new URLSearchParams({
    authUrl,
    returnUrl,
  }).toString()}`;

  console.log('[GoogleAuth] Opening proxy startUrl via WebBrowser:', startUrl);

  const browserResult = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);

  if (browserResult.type === 'success' && browserResult.url) {
    const parsed = authRequest.parseReturnUrl(browserResult.url);
    const idToken = (parsed as any).params?.id_token || (parsed as any).authentication?.idToken;
    if (idToken) {
      return idToken;
    }
    throw new Error('Authentication succeeded but no ID token was found in redirect URL.');
  }

  if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
    return null;
  }

  throw new Error('Google Sign-In was cancelled or not completed.');
}

/**
 * Initiates Google Sign-In and returns the Google ID Token for backend verification.
 * Automatically chooses:
 * - Native Google Play Services / GoogleSignIn in custom Development Builds and Production Builds.
 * - Expo AuthSession proxy in Expo Go and Web environments.
 */
export async function performGoogleSignIn(): Promise<string | null> {
  // If running in Expo Go or Web, use the AuthSession proxy
  if (isExpoGo || Platform.OS === 'web') {
    return performExpoGoAuth();
  }

  const module = getNativeGoogleSigninModule();
  if (!module?.GoogleSignin) {
    console.warn('[GoogleAuth] Native module unavailable, falling back to AuthSession proxy...');
    return performExpoGoAuth();
  }

  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = module;

  // Running in standalone / custom development build
  try {
    configureGoogleSignIn();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();

    if (isSuccessResponse && isSuccessResponse(response)) {
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token received from Google. Please ensure Google Sign-In is configured correctly.');
      }
      return idToken;
    }

    return null;
  } catch (error: any) {
    // If native module is missing (e.g. running inside Expo Go without dev client), fallback to AuthSession
    if (
      error?.message?.includes('RNGoogleSignin') ||
      error?.message?.includes('TurboModuleRegistry') ||
      error?.message?.includes('Native module cannot be null')
    ) {
      console.warn('[GoogleAuth] Native module unavailable, falling back to AuthSession proxy...');
      return performExpoGoAuth();
    }

    if (isErrorWithCode && isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes?.SIGN_IN_CANCELLED:
          return null; // User cancelled
        case statusCodes?.IN_PROGRESS:
          throw new Error('Sign-in operation is already in progress.');
        case statusCodes?.PLAY_SERVICES_NOT_AVAILABLE:
          throw new Error('Google Play Services is not available or outdated on this device.');
        default:
          throw new Error(`Google Sign-In failed (${error.code}): ${error.message || 'Unknown error'}`);
      }
    }
    throw error;
  }
}
