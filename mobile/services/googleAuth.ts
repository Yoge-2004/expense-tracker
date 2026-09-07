import { Platform } from 'react-native';
import Constants, { AppOwnership, ExecutionEnvironment } from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import { GOOGLE_OAUTH_CONFIG } from '../constants/auth';

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

/**
 * Google authentication for the supported app targets.
 *
 * Native Android/iOS builds use the native Google Sign-In SDK. This is required
 * for standalone EAS builds and avoids the deprecated auth.expo.io proxy.
 * Web uses OAuth through expo-auth-session with the web client ID.
 */
export async function performGoogleSignIn(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return performWebGoogleSignIn();
  }

  const module = getNativeGoogleSigninModule();
  if (!module?.GoogleSignin) {
    const isExpoGo =
      Constants.appOwnership === AppOwnership.Expo ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    if (isExpoGo) {
      throw new Error('Google Sign-In requires the installed EAS Android/iOS build. Expo Go does not include the native Google Sign-In module.');
    }

    throw new Error('Google Sign-In native module is unavailable in this build. Please rebuild the EAS application after verifying the Google Sign-In configuration.');
  }

  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = module;

  try {
    GoogleSignin.configure({
      // This must be the WEB OAuth client ID because the backend verifies the ID token audience.
      webClientId: GOOGLE_OAUTH_CONFIG.webClientId,
      iosClientId: GOOGLE_OAUTH_CONFIG.iosClientId,
      offlineAccess: false,
    });

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();

    if (isSuccessResponse && isSuccessResponse(response)) {
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In completed without an ID token. Verify that the configured web OAuth client ID is correct.');
      }
      return idToken;
    }

    return null;
  } catch (error: any) {
    if (isErrorWithCode && isErrorWithCode(error)) {
      const code = error.code;

      if (code === statusCodes?.SIGN_IN_CANCELLED) {
        return null;
      }

      if (code === statusCodes?.IN_PROGRESS) {
        throw new Error('Google Sign-In is already in progress.');
      }

      if (code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is unavailable or outdated on this device.');
      }

      // Google Android code 10 / DEVELOPER_ERROR almost always means the
      // release APK SHA-1 and package name are not registered in Google Cloud.
      if (code === 10 || String(code).toUpperCase() === 'DEVELOPER_ERROR') {
        throw new Error('Google Sign-In is not configured for this Android build. Add the EAS release SHA-1 for com.yoge.expensetracker to the Android OAuth client in Google Cloud, then rebuild the APK.');
      }

      throw new Error(`Google Sign-In failed (${code}): ${error.message || 'Unknown error'}`);
    }

    throw error;
  }
}

function getNativeGoogleSigninModule(): any {
  try {
    // Dynamic require keeps Expo Go/web from loading the native TurboModule.
    return require('@react-native-google-signin/google-signin');
  } catch {
    return null;
  }
}

async function performWebGoogleSignIn(): Promise<string | null> {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'expensetracker',
  });
  const nonce = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const authRequest = new AuthSession.AuthRequest({
    clientId: GOOGLE_OAUTH_CONFIG.webClientId,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    redirectUri,
    usePKCE: false,
    extraParams: {
      nonce,
      prompt: 'select_account',
    },
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
