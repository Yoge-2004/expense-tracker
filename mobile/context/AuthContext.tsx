/**
 * @file AuthContext.tsx
 * @description React Context Provider managing identity state, secure token lifecycle,
 * global currency preference, and UI theme switching (Dark / Light).
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSession, saveSession, clearSession, apiRequest } from '../services/api';
import * as SecureStore from 'expo-secure-store';

/**
 * Shape of the authentication context exposed to child screens.
 */
interface AuthContextType {
  /** Indicates whether initial session hydration from SecureStore is underway. */
  isLoading: boolean;
  /** Active signed JWT bearer token (null if unauthenticated). */
  token: string | null;
  /** Primary key user identifier on the server. */
  userId: string | null;
  /** Current display name of the user. */
  userName: string | null;
  /** ISO currency code (default: 'INR'). */
  currency: string;
  /** Active UI color palette mode. */
  theme: 'dark' | 'light';
  /** Toggles between 'dark' and 'light' theme and persists to storage. */
  toggleTheme: () => Promise<void>;
  /** Updates the local display name in state and secure storage. */
  updateUserName: (name: string) => Promise<void>;
  /** Updates preferred currency code locally and syncs with backend. */
  updateCurrency: (currency: string) => Promise<void>;
  /** Authenticates user with credentials and initializes session. */
  login: (email: string, password: string) => Promise<void>;
  /** Authenticates user via Google OAuth idToken. */
  loginWithGoogle: (idToken: string) => Promise<void>;
  /** Dispatches a 6-digit signup OTP to the prospective user's email. */
  sendSignupOtp: (email: string, name: string) => Promise<void>;
  /** Completes registration and stores preferred currency. */
  register: (name: string, username: string, email: string, password: string, otp: string, currency?: string) => Promise<void>;
  /** Destroys active session, clears caches, and resets auth state. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Global Authentication and Settings Provider.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('INR');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Hydrate auth session, theme, and currency from secure storage on startup
  useEffect(() => {
    async function loadSession() {
      try {
        const session = await getSession();
        if (session.token && session.userId) {
          setToken(session.token);
          setUserId(session.userId);
          setUserName(session.name);
        }

        // Hydrate persisted theme mode
        try {
          const savedTheme = await SecureStore.getItemAsync('app_theme');
          if (savedTheme === 'light' || savedTheme === 'dark') {
            setTheme(savedTheme);
          }
        } catch (themeErr) {
          console.warn('[AuthContext] Could not load persisted theme:', themeErr);
        }

        // Hydrate persisted currency code
        try {
          const savedCurrency = await SecureStore.getItemAsync('user_currency');
          if (savedCurrency) {
            setCurrency(savedCurrency);
          }
        } catch (currErr) {
          console.warn('[AuthContext] Could not load persisted currency:', currErr);
        }
      } catch (e) {
        console.error('[AuthContext] Critical failure loading session:', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  /**
   * Logs in a user with email and password credentials.
   * Persists JWT token, userId, and name to secure storage.
   */
  /**
   * Logs in a user with Google OAuth ID token.
   */
  const loginWithGoogle = async (idToken: string): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await apiRequest('/auth/oauth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });

      if (data && data.token && data.userId) {
        await saveSession(data.token, data.userId.toString(), data.name);
        setToken(data.token);
        setUserId(data.userId.toString());
        setUserName(data.name);

        if (data.currency) {
          setCurrency(data.currency);
          try {
            await SecureStore.setItemAsync('user_currency', data.currency);
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
        await saveSession(data.token, data.userId.toString(), data.name);
        setToken(data.token);
        setUserId(data.userId.toString());
        setUserName(data.name);

        if (data.currency) {
          setCurrency(data.currency);
          try {
            await SecureStore.setItemAsync('user_currency', data.currency);
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

  /**
   * Triggers a signup verification email OTP request.
   */
  const sendSignupOtp = async (email: string, name: string): Promise<void> => {
    await apiRequest('/auth/signup/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), name: name.trim() }),
    });
  };

  /**
   * Completes registration with full credentials and verification code (or BYPASS).
   */
  const register = async (
    name: string,
    username: string,
    email: string,
    password: string,
    otp: string,
    userCurrency: string = 'INR'
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const sanitizedUsername = (username || name.toLowerCase().replace(/[^a-z0-9_.]/g, '')).trim();
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          username: sanitizedUsername,
          email: email.trim(),
          password,
          otp: otp.trim(),
          currency: userCurrency,
        }),
      });

      setCurrency(userCurrency);
      try {
        await SecureStore.setItemAsync('user_currency', userCurrency);
      } catch (e) {
        console.warn('[AuthContext] Failed to persist currency:', e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logs out the user and cleans up all credentials and state.
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await clearSession();
      setToken(null);
      setUserId(null);
      setUserName(null);
    } catch (e) {
      console.error('[AuthContext] Error during logout:', e);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Switches theme between dark and light, persisting the preference.
   */
  const toggleTheme = async (): Promise<void> => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      await SecureStore.setItemAsync('app_theme', nextTheme);
    } catch (e) {
      console.warn('[AuthContext] Failed to persist theme preference:', e);
    }
  };

  /**
   * Updates display name in state and secure storage.
   */
  const updateUserName = async (newName: string): Promise<void> => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    try {
      await SecureStore.setItemAsync('user_name', cleanName);
      setUserName(cleanName);
    } catch (e) {
      console.warn('[AuthContext] Failed to save display name:', e);
    }
  };

  /**
   * Updates preferred currency locally and synchronizes with the server.
   */
  const updateCurrency = async (newCurrency: string): Promise<void> => {
    const code = newCurrency.trim().toUpperCase();
    if (!code) return;
    setCurrency(code);
    try {
      await SecureStore.setItemAsync('user_currency', code);
    } catch (e) {
      console.warn('[AuthContext] Failed to persist currency code:', e);
    }

    if (userId) {
      try {
        await apiRequest(`/users/${userId}/currency`, {
          method: 'PUT',
          body: JSON.stringify({ currency: code }),
        });
      } catch (e) {
        console.warn('[AuthContext] Non-critical: Could not sync currency to backend:', e);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        token,
        userId,
        userName,
        currency,
        theme,
        toggleTheme,
        updateUserName,
        updateCurrency,
        login,
        loginWithGoogle,
        sendSignupOtp,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume the active Authentication and Settings Context.
 *
 * @throws {Error} If called outside of an `AuthProvider` tree.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be consumed within an AuthProvider component.');
  }
  return context;
}
