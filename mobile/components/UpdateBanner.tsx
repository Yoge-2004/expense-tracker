/**
 * @file UpdateBanner.tsx
 * @description A slim bar at the very top of the app that says a newer version is available.
 * It stays for as long as the update is pending and opens the update popup when tapped.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpdate } from '../context/UpdateContext';
import { usePreferences } from '../context/PreferencesContext';
import { Colors, readableTextColor } from '../constants/theme';

export default function UpdateBanner() {
  const { info, hasUpdate, openPrompt } = useUpdate();
  const { theme, themeColors } = usePreferences();
  const c = themeColors || Colors[theme || 'dark'];
  const bannerBg = c.primary;
  const bannerInk = c.onPrimary || readableTextColor(bannerBg);
  const insets = useSafeAreaInsets();

  if (!hasUpdate || !info) {
    return null;
  }

  return (
    <Pressable
      onPress={openPrompt}
      accessibilityRole="button"
      accessibilityLabel={`Update available, version ${info.latestVersion}. Tap to update.`}
      style={[styles.banner, { backgroundColor: bannerBg, paddingTop: insets.top + 8 }]}
    >
      <View style={styles.row}>
        <Ionicons name="cloud-download-outline" size={18} color={bannerInk} />
        <Text style={[styles.text, { color: bannerInk }]} numberOfLines={1}>
          Update available · {info.latestVersion}
        </Text>
        <View style={[styles.cta, { backgroundColor: bannerInk }]}>
          <Text style={[styles.ctaText, { color: bannerBg }]}>Update</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  cta: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
