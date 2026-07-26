import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ActivityIndicator, View, Text, Animated, StyleSheet, StatusBar } from 'react-native';

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
      <StatusBar barStyle="light-content" backgroundColor="#080B12" />
      <View style={splashStyles.iconWrapper}>
        <View style={splashStyles.iconGlow} />
        <Text style={splashStyles.icon}>💎</Text>
      </View>
      <Text style={splashStyles.brand}>ExpenseTracker</Text>
      <Text style={splashStyles.pro}>PRO</Text>
      <Animated.View style={[splashStyles.loadingBar, { opacity: pulseAnim }]}>
        <ActivityIndicator size="small" color="#00D4AA" />
      </Animated.View>
    </Animated.View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080B12',
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
    backgroundColor: 'rgba(0,212,170,0.15)',
    top: -10,
    left: -10,
  },
  icon: {
    fontSize: 56,
  },
  brand: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F0F4FF',
    letterSpacing: -0.5,
  },
  pro: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00D4AA',
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
        contentStyle: { backgroundColor: '#080B12' },
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
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
