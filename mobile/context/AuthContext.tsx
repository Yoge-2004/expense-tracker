/**
 * @file AuthContext.tsx
 * @description React Context Provider managing identity state, secure token lifecycle,
 * global currency preference, UI theme switching (Dark / Light), and Biometrics (Face ID / Fingerprint).
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { getSession, saveSession, clearSession, apiRequest, safeStorageGet, safeStorageSet, safeStorageDelete, readSavedTheme, persistSavedTheme } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useColorScheme } from 'react-native';
import { registerPushToken, unregisterPushToken } from '../services/notifications';

interface AuthContextType {
  isLoading: boolean;
  token: string | null;
  userId: string | null;
  userName: string | null;
  profilePicture: string | null;
  currency: string;
  theme: 'dark' | 'light';
  toggleTheme: () => Promise<void>;
  updateUserName: (name: string) => Promise<void>;
  updateUserProfile: (params: { name?: string; profilePictureUrl?: string }) => Promise<void>;
  refreshUserProfile: (targetUserId?: string) => Promise<void>;
  updateCurrency: (currency: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  sendSignupOtp: (email: string, name: string) => Promise<void>;
  register: (name: string, username: string, email: string, password: string, otp: string, currency?: string, securityPin?: string) => Promise<void>;
  logout: () => Promise<void>;
  isBiometricsAvailable: boolean;
  isBiometricEnabled: boolean;
  loginWithBiometrics: () => Promise<boolean>;
  toggleBiometrics: (enabled: boolean) => Promise<boolean>;
  isStealthMode: boolean;
  toggleStealthMode: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: 'dark' | 'light';
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const systemScheme = useColorScheme();
  const [currency, setCurrency] = useState<string>('INR');
  const [theme, setTheme] = useState<'dark' | 'light'>(
    initialTheme ?? (systemScheme === 'light' ? 'light' : 'dark')
  );
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isStealthMode, setIsStealthMode] = useState(false);
  const userToggledThemeRef = useRef(false);

  useEffect(() => {
    if (initialTheme && !userToggledThemeRef.current && initialTheme !== theme) {
      setTheme(initialTheme);
    }
  }, [initialTheme]);

  const checkBiometricsSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricsAvailable(hasHardware && isEnrolled);

      const savedPref = await safeStorageGet('biometric_enabled');
      const savedToken = await safeStorageGet('biometric_saved_token');
      setIsBiometricEnabled(savedPref === 'true' && !!savedToken);
    } catch (e) {
      console.warn('[AuthContext] Error checking biometrics support:', e);
    }
  };

  useEffect(() => {
    async function loadSession() {
      try {
        // Fast-path theme load first so UI state aligns before heavyweight crypto/network
        readSavedTheme()
          .then((savedTheme) => {
            if (!userToggledThemeRef.current && (savedTheme === 'light' || savedTheme === 'dark')) {
              setTheme(savedTheme);
            }
          })
          .catch(() => {});

        const [session, savedCurrency, savedStealth] = await Promise.all([
          getSession(),
          safeStorageGet('user_currency'),
          safeStorageGet('app_stealth_mode'),
        ]);

        if (savedStealth === 'true') {
          setIsStealthMode(true);
        }

        if (session.token && session.userId) {
          setToken(session.token);
          setUserId(session.userId);
          setUserName(session.name);
          setProfilePicture(session.photo || null);

          // Proactively sync latest profile picture and profile info from server (matches website behavior)
          refreshUserProfile(session.userId).catch(() => {});
        }

        if (savedCurrency) {
          setCurrency(savedCurrency);
        }

        // Biometrics check runs non-blockingly
        checkBiometricsSupport().catch(() => {});
      } catch (e) {
        console.error('[AuthContext] Critical failure loading session:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  /**
   * Stores a separate credential for biometric unlock.
   * This is called only after the user explicitly enables biometrics.
   */
  const saveBiometricCredentials = async (jwtToken: string, uid: string, name: string) => {
    try {
      await safeStorageSet('biometric_saved_token', jwtToken);
      await safeStorageSet('biometric_saved_userId', uid);
      await safeStorageSet('biometric_saved_name', name || 'User');
      await safeStorageSet('biometric_enabled', 'true');
      setIsBiometricEnabled(true);
    } catch (e) {
      console.warn('[AuthContext] Could not store biometric credentials:', e);
      throw e;
    }
  };

  /**
   * Removes the biometric unlock credential and preference completely.
   */
  const clearBiometricCredentials = async () => {
    await Promise.all([
      safeStorageDelete('biometric_saved_token'),
      safeStorageDelete('biometric_saved_userId'),
      safeStorageDelete('biometric_saved_name'),
      safeStorageDelete('biometric_enabled'),
    ]);
    setIsBiometricEnabled(false);
  };

  const loginWithGoogle = async (idToken: string): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });

      if (data && data.token && data.userId) {
        const photo = data.profilePictureUrl || null;
        await saveSession(data.token, data.userId.toString(), data.name, photo);
        setToken(data.token);
        setUserId(data.userId.toString());
        setUserName(data.name);
        setProfilePicture(photo);

        if (data.currency) {
          setCurrency(data.currency);
          try {
            await safeStorageSet('user_currency', data.currency);
          } catch (e) {
            console.warn('[AuthContext] Failed saving currency preference:', e);
          }
        }
      } else {
        throw new Error('Google OAuth failed: Incomplete response credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (data && data.token && data.userId) {
        const photo = data.profilePictureUrl || null;
        await saveSession(data.token, data.userId.toString(), data.name, photo);
        setToken(data.token);
        setUserId(data.userId.toString());
        setUserName(data.name);
        setProfilePicture(photo);

        if (data.currency) {
          setCurrency(data.currency);
          try {
            await safeStorageSet('user_currency', data.currency);
          } catch (e) {
            console.warn('[AuthContext] Failed saving currency preference:', e);
          }
        }
      } else {
        throw new Error('Authentication response was missing security credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithBiometrics = async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return false;

      const savedToken = await safeStorageGet('biometric_saved_token');
      const savedUserId = await safeStorageGet('biometric_saved_userId');
      const savedName = await safeStorageGet('biometric_saved_name');
      const savedPref = await safeStorageGet('biometric_enabled');

      if (savedPref !== 'true' || !savedToken || !savedUserId) return false;

      const authRes = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Expense Tracker',
        fallbackLabel: 'Use password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (authRes.success) {
        await saveSession(savedToken, savedUserId, savedName || 'User');
        setToken(savedToken);
        setUserId(savedUserId);
        setUserName(savedName || 'User');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[AuthContext] Biometric login error:', e);
      return false;
    }
  };

  const toggleBiometrics = async (enabled: boolean): Promise<boolean> => {
    try {
      if (enabled) {
        if (!token || !userId) return false;

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) return false;

        const authRes = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm biometrics to enable quick unlock',
        });
        if (!authRes.success) return false;

        await saveBiometricCredentials(token, userId, userName || 'User');
        return true;
      }

      await clearBiometricCredentials();
      return true;
    } catch (e) {
      console.warn('[AuthContext] Error toggling biometrics:', e);
      return false;
    }
  };

  const sendSignupOtp = async (email: string, name: string): Promise<void> => {
    await apiRequest('/auth/signup/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), name: name.trim() }),
    });
  };

  const register = async (
    name: string,
    username: string,
    email: string,
    password: string,
    otp: string,
    userCurrency: string = 'INR',
    securityPin?: string
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const sanitizedUsername = (username || name.toLowerCase().replace(/[^a-z0-9_.]/g, '')).trim();
      const payload: Record<string, any> = {
        name: name.trim(),
        username: sanitizedUsername,
        email: email.trim(),
        password,
        otp: (otp || "").trim(),
        currency: userCurrency,
      };
      if (securityPin && securityPin.trim().length === 6) {
        payload.securityPin = securityPin.trim();
      }
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCurrency(userCurrency);
      try {
        await safeStorageSet('user_currency', userCurrency);
      } catch (e) {
        console.warn('[AuthContext] Failed to persist currency:', e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logs out the active session. Biometric unlock remains enabled so the user
   * can unlock the saved credential again without re-entering the password.
   */
  // Register this phone for push once signed in. It never prompts: permission is asked at sign-up.
  useEffect(() => {
    if (userId) registerPushToken(userId);
  }, [userId]);

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Needs the session, so it must run before the session is cleared.
      if (userId) await unregisterPushToken(userId);
      await clearSession();
      setToken(null);
      setUserId(null);
      setUserName(null);
      setProfilePicture(null);
    } catch (e) {
      console.error('[AuthContext] Error during logout:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStealthMode = useCallback(async (): Promise<void> => {
    setIsStealthMode((prev) => {
      const next = !prev;
      safeStorageSet('app_stealth_mode', next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  const toggleTheme = useCallback(async (): Promise<void> => {
    userToggledThemeRef.current = true;
    startTransition(() => {
      setTheme((prevTheme) => {
        const nextTheme = prevTheme === 'dark' ? 'light' : 'dark';
        persistSavedTheme(nextTheme).catch((e) => {
          console.warn('[AuthContext] Failed to persist theme preference:', e);
        });
        return nextTheme;
      });
    });
  }, []);

  const refreshUserProfile = useCallback(async (targetUserId?: string): Promise<void> => {
    const uid = targetUserId || userId;
    if (!uid) return;
    try {
      const profile = await apiRequest(`/users/${uid}`, { skipCache: true });
      if (profile) {
        if (profile.profilePictureUrl !== undefined) {
          const photo = profile.profilePictureUrl || null;
          setProfilePicture(photo);
          if (photo) {
            await safeStorageSet('user_photo', photo);
          } else {
            await safeStorageDelete('user_photo');
          }
        }
        if (profile.name) {
          setUserName(profile.name);
          await safeStorageSet('user_name', profile.name);
        }
        if (profile.currency) {
          setCurrency(profile.currency);
          await safeStorageSet('user_currency', profile.currency);
        }
      }
    } catch (e) {
      console.warn('[AuthContext] Could not refresh user profile:', e);
    }
  }, [userId]);

  const updateUserProfile = useCallback(async ({ name, profilePictureUrl }: { name?: string; profilePictureUrl?: string }): Promise<void> => {
    if (!userId) return;
    const body: Record<string, any> = {
      name: (name ?? userName ?? 'User').trim(),
    };
    if (profilePictureUrl !== undefined) {
      body.profilePictureUrl = profilePictureUrl.trim();
    }
    const updated = await apiRequest(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (updated) {
      if (updated.name) {
        setUserName(updated.name);
        await safeStorageSet('user_name', updated.name);
      }
      if (updated.profilePictureUrl !== undefined) {
        const photo = updated.profilePictureUrl || null;
        setProfilePicture(photo);
        if (photo) {
          await safeStorageSet('user_photo', photo);
        } else {
          await safeStorageDelete('user_photo');
        }
      }
    }
  }, [userId, userName]);

  const updateUserName = async (newName: string): Promise<void> => {
    const cleanName = newName.trim();
    if (!cleanName) return;

    if (userId) {
      await apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: cleanName }),
      });
    }

    try {
      await safeStorageSet('user_name', cleanName);
      setUserName(cleanName);
    } catch (e) {
      console.warn('[AuthContext] Failed to save display name:', e);
    }
  };

  const updateCurrency = async (newCurrency: string): Promise<void> => {
    const code = newCurrency.trim().toUpperCase();
    if (!code) return;

    // When authenticated, commit the change remotely before changing local state.
    // This prevents the mobile UI from showing a currency the backend rejected.
    if (userId) {
      await apiRequest(`/users/${userId}/currency`, {
        method: 'PUT',
        body: JSON.stringify({ currency: code }),
      });
    }

    setCurrency(code);
    try {
      await safeStorageSet('user_currency', code);
    } catch (e) {
      console.warn('[AuthContext] Failed to persist currency code:', e);
    }
  };

  const authContextValue = useMemo(() => ({
    isLoading,
    token,
    userId,
    userName,
    profilePicture,
    currency,
    theme,
    toggleTheme,
    updateUserName,
    updateUserProfile,
    refreshUserProfile,
    updateCurrency,
    login,
    loginWithGoogle,
    sendSignupOtp,
    register,
    logout,
    isBiometricsAvailable,
    isBiometricEnabled,
    loginWithBiometrics,
    toggleBiometrics,
    isStealthMode,
    toggleStealthMode,
  }), [
    isLoading,
    token,
    userId,
    userName,
    profilePicture,
    currency,
    theme,
    toggleTheme,
    updateUserName,
    updateUserProfile,
    refreshUserProfile,
    updateCurrency,
    login,
    loginWithGoogle,
    sendSignupOtp,
    register,
    logout,
    isBiometricsAvailable,
    isBiometricEnabled,
    loginWithBiometrics,
    toggleBiometrics,
    isStealthMode,
    toggleStealthMode,
  ]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
