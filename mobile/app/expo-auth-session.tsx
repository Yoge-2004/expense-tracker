import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export default function ExpoAuthSessionScreen() {
  const router = useRouter();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    // Fallback: If not automatically handled, route back to login
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 1000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0C0E0A' }}>
      <ActivityIndicator size="large" color="#C79A3E" />
    </View>
  );
}
