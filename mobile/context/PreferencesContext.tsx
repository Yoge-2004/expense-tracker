/**
 * @file PreferencesContext.tsx
 * @description React Context Provider managing UI preferences:
 * - Theme selection (dark / light) with system color scheme detection and persistence
 * - Stealth mode toggle for privacy in public spaces
 * - Currency preference (e.g. INR, USD, EUR)
 *
 * Decoupled from AuthContext so UI cosmetic toggles do not trigger cascading
 * re-renders of authentication-dependent components.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { useColorScheme } from 'react-native';
import { safeStorageGet, safeStorageSet, readSavedTheme, persistSavedTheme, apiRequest } from '../services/api';

export interface PreferencesContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => Promise<void>;
  isStealthMode: boolean;
  toggleStealthMode: () => Promise<void>;
  currency: string;
  updateCurrency: (currency: string, userId?: string | null) => Promise<void>;
  setCurrencyState: (currency: string) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: 'dark' | 'light';
}) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<'dark' | 'light'>(
    initialTheme ?? (systemScheme === 'light' ? 'light' : 'dark')
  );
  const [isStealthMode, setIsStealthMode] = useState(false);
  const [currency, setCurrency] = useState<string>('INR');
  const userToggledThemeRef = useRef(false);

  useEffect(() => {
    if (initialTheme && !userToggledThemeRef.current && initialTheme !== theme) {
      setTheme(initialTheme);
    }
  }, [initialTheme, theme]);

  useEffect(() => {
    let mounted = true;

    // Fast-path theme load first so UI state aligns before heavyweight crypto/network
    readSavedTheme()
      .then((savedTheme) => {
        if (mounted && !userToggledThemeRef.current && (savedTheme === 'light' || savedTheme === 'dark')) {
          setTheme(savedTheme);
        }
      })
      .catch(() => {});

    // Hydrate saved currency and stealth preferences
    Promise.all([
      safeStorageGet('user_currency'),
      safeStorageGet('app_stealth_mode'),
    ])
      .then(([savedCurrency, savedStealth]) => {
        if (!mounted) return;
        if (savedStealth === 'true') {
          setIsStealthMode(true);
        }
        if (savedCurrency) {
          setCurrency(savedCurrency);
        }
      })
      .catch((e) => {
        console.warn('[PreferencesContext] Error hydrating preferences:', e);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const toggleTheme = useCallback(async (): Promise<void> => {
    userToggledThemeRef.current = true;
    setTheme((prevTheme) => {
      const nextTheme = prevTheme === 'dark' ? 'light' : 'dark';
      persistSavedTheme(nextTheme).catch((e) => {
        console.warn('[PreferencesContext] Failed to persist theme preference:', e);
      });
      return nextTheme;
    });
  }, []);

  const toggleStealthMode = useCallback(async (): Promise<void> => {
    setIsStealthMode((prev) => {
      const next = !prev;
      safeStorageSet('app_stealth_mode', next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  const updateCurrency = useCallback(async (newCurrency: string, userId?: string | null): Promise<void> => {
    const code = newCurrency.trim().toUpperCase();
    if (!code) return;

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
      console.warn('[PreferencesContext] Failed to persist currency code:', e);
    }
  }, []);

  const setCurrencyState = useCallback((code: string) => {
    setCurrency(code);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      isStealthMode,
      toggleStealthMode,
      currency,
      updateCurrency,
      setCurrencyState,
    }),
    [theme, toggleTheme, isStealthMode, toggleStealthMode, currency, updateCurrency, setCurrencyState]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
