/**
 * @file _layout.tsx
 * @description Top-level Expo Router Layout and Navigation Graph.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { AlertProvider, useAlert } from '../context/AlertContext';
import { UpdateProvider, useUpdate } from '../context/UpdateContext';
import UpdateBanner from '../components/UpdateBanner';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, Animated, StyleSheet, StatusBar, Easing, useColorScheme, AppState, AppStateStatus } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
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
import { Colors } from '../constants/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FloatingCalculator } from '../components/FloatingCalculator';
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
import { useReducedMotion } from '../hooks/useReducedMotion';
import { readSavedTheme } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

interface SplashLoaderProps {
  theme?: 'dark' | 'light';
}

function SplashLoader({ theme: themeProp }: SplashLoaderProps = {}) {
  const systemScheme = useColorScheme();
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>(() => {
    if (themeProp === 'light' || themeProp === 'dark') return themeProp;
    return systemScheme === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    if (themeProp === 'light' || themeProp === 'dark') {
      setResolvedTheme(themeProp);
      return;
    }
    readSavedTheme()
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setResolvedTheme(saved);
        }
      })
      .catch(() => {});
  }, [themeProp]);

  const isLight = resolvedTheme === 'light';
  const c = Colors[resolvedTheme];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(-80)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: reducedMotion ? 0 : 350,
      useNativeDriver: true,
    }).start();

    if (reducedMotion) {
      pulseAnim.setValue(1);
      shimmerAnim.setValue(40);
      return;
    }

    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 160,
        duration: 1300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );

    rotateLoop.start();
    pulseLoop.start();
    shimmerLoop.start();

    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
      shimmerLoop.stop();
    };
  }, [fadeAnim, pulseAnim, rotateAnim, shimmerAnim, reducedMotion]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const auraScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.2],
  });

  const auraOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  const logoScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1.03],
  });

  return (
    <Animated.View style={[splashStyles.container, { opacity: fadeAnim, backgroundColor: c.bg }]}>
      <StatusBar
        barStyle={isLight ? 'dark-content' : 'light-content'}
        {...({ backgroundColor: c.bg } as any)}
      />

      {/* Bespoke animated brand aura & rotating orbital halo */}
      <View style={splashStyles.coreContainer}>
        <Animated.View
          style={[
            splashStyles.auraGlow,
            {
              backgroundColor: isLight ? 'rgba(212, 175, 55, 0.16)' : 'rgba(245, 200, 66, 0.18)',
              transform: [{ scale: auraScale }],
              opacity: auraOpacity,
            },
          ]}
        />

        <Animated.View
          style={[
            splashStyles.orbitalRing,
            {
              borderColor: isLight ? 'rgba(212, 175, 55, 0.2)' : 'rgba(245, 200, 66, 0.15)',
              borderTopColor: isLight ? '#D4AF37' : '#F5C842',
              borderRightColor: isLight ? '#B8860B' : '#E6A817',
              transform: [{ rotate: spin }],
            },
          ]}
        />

        <Animated.View
          style={[
            splashStyles.logoBox,
            {
              backgroundColor: isLight ? '#D4AF37' : '#F5C842',
              shadowColor: isLight ? '#D4AF37' : '#F5C842',
              shadowOpacity: isLight ? 0.35 : 0.45,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Ionicons name="wallet" size={32} color={isLight ? '#FFFFFF' : '#10120E'} />
        </Animated.View>
      </View>

      <Text style={[splashStyles.brandName, { color: isLight ? '#0F172A' : '#F9F6EF' }]}>ExpenseTracker</Text>
      <View
        style={[
          splashStyles.badge,
          {
            backgroundColor: isLight ? 'rgba(212, 175, 55, 0.12)' : 'rgba(245, 200, 66, 0.14)',
            borderColor: isLight ? 'rgba(212, 175, 55, 0.35)' : 'rgba(245, 200, 66, 0.3)',
          },
        ]}
      >
        <Text style={[splashStyles.badgeText, { color: isLight ? '#996515' : '#F5C842' }]}>
          EXECUTIVE COMMAND CENTER
        </Text>
      </View>

      {/* Custom Shimmer Progress Beam */}
      <View
        style={[
          splashStyles.loadingTrack,
          {
            backgroundColor: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.1)',
          },
        ]}
      >
        <Animated.View
          style={[
            splashStyles.shimmerBeam,
            {
              backgroundColor: isLight ? '#D4AF37' : '#F5C842',
              transform: [{ translateX: shimmerAnim }],
            },
          ]}
        />
      </View>
      <Text style={[splashStyles.statusText, { color: isLight ? '#475569' : '#8A8E85' }]}>
        AUTHENTICATING SECURE LEDGER
      </Text>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  coreContainer: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  auraGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 200, 66, 0.18)',
  },
  orbitalRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
    borderColor: 'rgba(245, 200, 66, 0.15)',
    borderTopColor: '#F5C842',
    borderRightColor: '#E6A817',
  },
  logoBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5C842',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F5C842',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F9F6EF',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  badge: {
    backgroundColor: 'rgba(245, 200, 66, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 200, 66, 0.3)',
    marginBottom: 28,
  },
  badgeText: {
    color: '#F5C842',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  loadingTrack: {
    width: 140,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  shimmerBeam: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F5C842',
  },
  statusText: {
    color: '#8A8E85',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

function RootLayoutNav() {
  const { token, userId, isLoading, theme } = useAuth();
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

        const parsed = parseFinancialMessage(text);
        if (parsed.isFinancial && parsed.amount != null && parsed.amount > 0) {
          const amountVal = parsed.amount;
          lastProcessedClipRef.current = text;

          const formattedAmt = formatNotificationAmount(amountVal, parsed.currency, 2);
          if (parsed.direction === 'DEBIT') {
            const merchantStr = parsed.merchant ? ` at ${parsed.merchant}` : '';
            const accStr = parsed.accountTail ? ` (A/c xx${parsed.accountTail})` : '';
            showAlert(
              '⚡ Bank SMS Detected',
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
                    showAlert('Recorded! ✅', `Added ${formattedAmt} to your expenses.`, undefined, 'success');
                  },
                },
              ],
              'info'
            );
          } else if (parsed.direction === 'CREDIT') {
            const srcStr = parsed.merchant ? ` from ${parsed.merchant}` : '';
            showAlert(
              '💰 Bank Credit Detected',
              `Found bank credit of ${formattedAmt}${srcStr}.\n\nWould you like to record this to your incomes?`,
              [
                { text: 'Dismiss', style: 'cancel' },
                {
                  text: 'Record Now',
                  onPress: async () => {
                    await detectAndAddCreditFromMessage(text, userId);
                    showAlert('Recorded! ✅', `Added ${formattedAmt} to your incomes.`, undefined, 'success');
                  },
                },
              ],
              'info'
            );
          }
        }
      } catch (_) {}
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

  if (isLoading) return <SplashLoader theme={theme} />;

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
                contentStyle: { backgroundColor: Colors[theme].bg },
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
  const [initialTheme, setInitialTheme] = useState<'dark' | 'light'>(
    systemScheme === 'light' ? 'light' : 'dark'
  );

  useEffect(() => {
    readSavedTheme()
      .then((saved) => {
        if (saved === 'light' || saved === 'dark') {
          setInitialTheme(saved);
        }
      })
      .catch(() => {});
  }, []);

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

  if (!fontsLoaded) return <SplashLoader theme={initialTheme} />;

  return (
    <ErrorBoundary>
      <AuthProvider initialTheme={initialTheme}>
        <AlertProvider>
          <UpdateProvider>
            <RootLayoutNav />
          </UpdateProvider>
        </AlertProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
