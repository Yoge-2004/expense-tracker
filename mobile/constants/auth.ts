/**
 * Google OAuth Configuration for Expense Tracker Mobile.
 *
 * Supports:
 * - Web / Expo Go testing (Web Client ID)
 * - Standalone iOS production builds (iOS Client ID)
 * - Standalone Android production builds (Android Client ID)
 */
export const GOOGLE_OAUTH_CONFIG = {
  webClientId:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '487469737581-k1idcre171eknatam925igofmc6jtk00.apps.googleusercontent.com',
  iosClientId:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    '487469737581-p826efhglp29u44vvo2cl4focntjg8e6.apps.googleusercontent.com',
  androidClientId:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    '487469737581-iadvi7lcfbr57aj6c46t4dbu4906h21t.apps.googleusercontent.com',
};
