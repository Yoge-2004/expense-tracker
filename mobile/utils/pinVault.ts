/**
 * Fingerprint-gated storage for the account's 6-digit Security PIN.
 *
 * Why the PIN and not a "fingerprint token": the server cannot see a fingerprint check done on the
 * phone, so a phone-side "fingerprint passed" flag would prove nothing. Instead the fingerprint only
 * RELEASES the Security PIN from the phone's secure store, and the server still verifies that PIN
 * through the normal password-reset path (with its attempt limits and lockout). Nothing new is
 * trusted on the device.
 *
 * The PIN is stored with `requireAuthentication`, so the OS releases it only after a successful
 * biometric prompt. A separate, non-secret entry remembers which account it belongs to, so the UI can
 * offer the fingerprint option without prompting first.
 */
import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'recovery_pin_v1';
const EMAIL_KEY = 'recovery_pin_email_v1';
const PROMPT = 'Confirm it is you to reset your password';

/** Email (lower-cased) of the account whose PIN is saved, or null when nothing is saved. */
export async function savedPinEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EMAIL_KEY);
  } catch {
    return null;
  }
}

/** Saves the PIN behind the fingerprint. Returns false when the device refuses (no biometrics, Expo Go…). */
export async function savePinForFingerprint(email: string, pin: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(PIN_KEY, pin, { requireAuthentication: true, authenticationPrompt: PROMPT });
    await SecureStore.setItemAsync(EMAIL_KEY, email.trim().toLowerCase());
    return true;
  } catch {
    return false;
  }
}

/** Prompts for the fingerprint and returns the PIN, or null if cancelled, failed or invalidated. */
export async function readPinWithFingerprint(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PIN_KEY, { requireAuthentication: true, authenticationPrompt: PROMPT });
  } catch {
    return null;
  }
}

export async function clearSavedPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(EMAIL_KEY);
  } catch {
    // nothing to clear
  }
}
