import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function ExpoAuthSessionScreen() {
  const router = useRouter();
  const { theme, themeColors } = useAuth();
  const c = themeColors || Colors[theme];

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    // Fallback: If not automatically handled, route back to login
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 1000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}
