import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text, Animated, StyleSheet, StatusBar } from 'react-native';
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

function SplashLoader() {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[splashStyles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.dark.bg} />
      <View style={splashStyles.iconWrapper}>
        <View style={splashStyles.iconGlow} />
        <Text style={splashStyles.icon}>📒</Text>
      </View>
      <Text style={splashStyles.brand}>ExpenseTracker</Text>
      <Text style={splashStyles.pro}>PRO</Text>
      <Animated.View style={[splashStyles.loadingBar, { opacity: pulseAnim }]}>
        <ActivityIndicator size="small" color={Colors.dark.gold} />
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.dark.bg,
    gap: 8,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  iconGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(199,154,62,0.15)',
    top: -10,
    left: -10,
  },
  icon: {
    fontSize: 56,
  },
  brand: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.dark.ink,
    letterSpacing: -0.5,
  },
  pro: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.dark.gold,
    letterSpacing: 2,
    marginTop: -2,
  },
  loadingBar: {
    marginTop: 24,
  },
});

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';

    if (!token && inAuthGroup) {
      router.replace('/login');
    } else if (token && !inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [token, isLoading, segments]);

  if (isLoading) {
    return <SplashLoader />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.dark.bg },
        animation: 'fade_from_bottom',
        animationDuration: 250,
      }}
    >
      <Stack.Screen
        name="login"
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="register"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{ animation: 'fade' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
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

  // Hold the splash screen until the type system is ready — screens further
  // down assume these font families exist and don't fall back gracefully.
  if (!fontsLoaded) {
    return <SplashLoader />;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
