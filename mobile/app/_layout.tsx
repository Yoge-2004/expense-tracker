/**
 * @file _layout.tsx
 * @description Top-level Expo Router Layout and Navigation Graph.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AlertProvider, useAlert } from '../context/AlertContext';
import { UpdateProvider, useUpdate } from '../context/UpdateContext';
import { UpdateBanner } from '../components/UpdateBanner';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, StatusBar, useColorScheme, AppState, AppStateStatus } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { ThemeColors } from '../constants/theme';
import { ExtractedPalette } from '../services/paletteExtractor';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FloatingCalculator } from '../components/FloatingCalculator';
import { ImmersiveLoader } from '../components/ImmersiveLoader';
import {
  scheduleDailyExpenseReminders,
  getDailyRemindersEnabled,
  scheduleSmartReminders,
  registerIncomingNotificationListener,
  getInstantDebitAlertsEnabled,
  parseFinancialMessage,
  detectAndAddExpenseFromMessage,
  detectAndAddCreditFromMessage,
  formatNotificationAmount,
} from '../services/notifications';
import { readSavedTheme, safeStorageGet } from '../services/api';
import { createThemeColors, usePreferences, BackgroundAssetConfig } from '../context/PreferencesContext';

WebBrowser.maybeCompleteAuthSession();


function RootLayoutNav() {
  const { token, userId, isLoading, theme, themeColors } = useAuth();
  const { appearanceLoaded, backgroundAsset } = usePreferences();
  const { showAlert } = useAlert();
  const { hasUpdate } = useUpdate();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const router = useRouter();
  const remindersInitialized = useRef(false);
  const lastProcessedClipRef = useRef<string>('');

  useEffect(() => {
    if (isLoading) return;

    const isPublicAuthRoute = ['login', 'register', 'forgot-password', 'expo-auth-session'].includes(segments[0] as string);
    if (!token && !isPublicAuthRoute) {
      remindersInitialized.current = false;
      router.replace('/login');
    } else if (token && isPublicAuthRoute) {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments, router]);

  useEffect(() => {
    if (isLoading || !token || remindersInitialized.current) return;

    remindersInitialized.current = true;
    void getDailyRemindersEnabled().then((enabled) => {
      if (enabled) scheduleDailyExpenseReminders().catch(() => {});
    }).catch(() => {});
    // The morning, weekly, month-start and month-end reminders (bills and salary follow once data loads).
    scheduleSmartReminders().catch(() => {});
  }, [isLoading, token]);

  useEffect(() => {
    if (isLoading || !token) return;
    const sub = registerIncomingNotificationListener(userId);
    return () => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    };
  }, [isLoading, token, userId]);

  useEffect(() => {
    if (isLoading || !token || !userId) return;

    const checkClipboardForSms = async () => {
      try {
        const enabled = await getInstantDebitAlertsEnabled();
        if (!enabled) return;

        const hasString = await Clipboard.hasStringAsync();
        if (!hasString) return;

        const text = await Clipboard.getStringAsync();
        if (!text || text.length < 12 || text.length > 600) return;
        if (text === lastProcessedClipRef.current) return;
        lastProcessedClipRef.current = text;

        const parsed = parseFinancialMessage(text);
        if (parsed.isFinancial && parsed.amount != null && parsed.amount > 0) {
          const amountVal = parsed.amount;

          const formattedAmt = formatNotificationAmount(amountVal, parsed.currency, 2);
          if (parsed.direction === 'DEBIT') {
            const merchantStr = parsed.merchant ? ` at ${parsed.merchant}` : '';
            const accStr = parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : '';
            showAlert(
              'Bank SMS Detected',
              `Found bank debit of ${formattedAmt}${merchantStr}${accStr}.\n\nWould you like to record this to your expense ledger?`,
              [
                { text: 'Dismiss', style: 'cancel' },
                {
                  text: 'Edit / Review',
                  onPress: () => {
                    router.push({
                      pathname: '/(tabs)/add-expense',
                      params: {
                        amount: String(amountVal),
                        description: parsed.merchant ? `${parsed.merchant}${parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : ''}` : `Bank Debit${parsed.accountTail ? ` xx${parsed.accountTail}` : ''}`,
                        merchant: parsed.merchant || '',
                      },
                    });
                  },
                },
                {
                  text: 'Record Now',
                  onPress: async () => {
                    await detectAndAddExpenseFromMessage(text, userId);
                    showAlert('Recorded!', `Added ${formattedAmt} to your expenses.`, undefined, 'success');
                  },
                },
              ],
              'info'
            );
          } else if (parsed.direction === 'CREDIT') {
            const srcStr = parsed.merchant ? ` from ${parsed.merchant}` : '';
            showAlert(
              'Bank Credit Detected',
              `Found bank credit of ${formattedAmt}${srcStr}.\n\nWould you like to record this to your incomes?`,
              [
                { text: 'Dismiss', style: 'cancel' },
                {
                  text: 'Record Now',
                  onPress: async () => {
                    await detectAndAddCreditFromMessage(text, userId);
                    showAlert('Recorded!', `Added ${formattedAmt} to your incomes.`, undefined, 'success');
                  },
                },
              ],
              'info'
            );
          }
        }
      } catch (err) {
        console.debug('[AppLayout] Clipboard check error:', err);
      }
    };

    const timer = setTimeout(checkClipboardForSms, 800);

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        void checkClipboardForSms();
      }
    });

    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [isLoading, token, userId, showAlert, router]);

  if (isLoading || !appearanceLoaded) {
    return (
      <ImmersiveLoader
        message="Synchronizing Ledger..."
        subMessage="Authenticating secure environment..."
        fullScreen
        customColors={themeColors}
        theme={theme}
        backgroundAsset={backgroundAsset}
      />
    );
  }

  return (
    <>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />
      <View style={{ flex: 1 }}>
        {/* The banner covers the status-bar area, so while it shows the screens get no extra top inset. */}
        <UpdateBanner />
        <SafeAreaInsetsContext.Provider value={hasUpdate ? { ...insets, top: 0 } : insets}>
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: themeColors.bg },
                animation: 'none',
              }}
            >
              <Stack.Screen name="login" options={{ animation: 'fade' }} />
              <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
              <Stack.Screen name="expo-auth-session" options={{ animation: 'none' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
            </Stack>
          </View>
        </SafeAreaInsetsContext.Provider>
      </View>
      <FloatingCalculator />
    </>
  );
}

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [initialTheme, setInitialTheme] = useState<'dark' | 'light'>(systemScheme === 'light' ? 'light' : 'dark');
  const [initialColors, setInitialColors] = useState<ThemeColors>(() => createThemeColors(systemScheme === 'light' ? 'light' : 'dark', null));
  const [initialPalette, setInitialPalette] = useState<ExtractedPalette | null>(null);
  const [initialBgAsset, setInitialBgAsset] = useState<BackgroundAssetConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      readSavedTheme().catch(() => null),
      safeStorageGet('app_custom_palette').catch(() => null),
      safeStorageGet('app_bg_asset').catch(() => null),
    ])
      .then(([saved, savedPalette, savedBackground]) => {
        if (!mounted) return;
        const resolvedTheme = saved === 'light' || saved === 'dark'
          ? saved
          : systemScheme === 'light' ? 'light' : 'dark';
        let palette: ExtractedPalette | null = null;
        let presetId = 'default';
        try {
          const parsed = savedPalette ? JSON.parse(savedPalette) : null;
          if (parsed && typeof parsed === 'object') palette = parsed as ExtractedPalette;
        } catch (e) {
          console.debug('[AppLayout] Failed parsing savedPalette:', e);
        }
        try {
          const parsed = savedBackground ? JSON.parse(savedBackground) : null;
          if (typeof parsed?.presetId === 'string') presetId = parsed.presetId;
        } catch (e) {
          console.debug('[AppLayout] Failed parsing savedBackground:', e);
        }
        setInitialTheme(resolvedTheme);
        setInitialPalette(palette);
        let bgConfig: BackgroundAssetConfig | null = null;
        try {
          if (savedBackground) bgConfig = JSON.parse(savedBackground);
        } catch { /* ignore */ }
        setInitialBgAsset(bgConfig);
        setInitialColors(createThemeColors(resolvedTheme, palette, presetId));
        setThemeLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        const fallbackTheme = systemScheme === 'light' ? 'light' : 'dark';
        setInitialTheme(fallbackTheme);
        setInitialColors(createThemeColors(fallbackTheme, null));
        setThemeLoaded(true);
      });
    return () => { mounted = false; };
  }, [systemScheme]);

  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  if (!fontsLoaded || !themeLoaded) {
    return (
      <ImmersiveLoader
        message="ExpenseTracker"
        subMessage="Initializing executive command center..."
        fullScreen
        customColors={initialColors}
        theme={initialTheme}
        backgroundAsset={initialBgAsset ?? undefined}
      />
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider
        initialTheme={initialTheme}
        initialPalette={initialPalette}
        initialBgAsset={initialBgAsset}
        initialColors={initialColors}
      >
        <AlertProvider>
          <UpdateProvider>
            <RootLayoutNav />
          </UpdateProvider>
        </AlertProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
