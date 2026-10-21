/**
 * @file UpdateBanner.tsx
 * @description A slim bar at the very top of the app that says a newer version is available.
 * It stays for as long as the update is pending and opens the update popup when tapped.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpdate } from '../context/UpdateContext';

const BANNER_BG = '#C79A3E';
const BANNER_INK = '#14110A';

export default function UpdateBanner() {
  const { info, hasUpdate, openPrompt } = useUpdate();
  const insets = useSafeAreaInsets();

  if (!hasUpdate || !info) {
    return null;
  }

  return (
    <Pressable
      onPress={openPrompt}
      accessibilityRole="button"
      accessibilityLabel={`Update available, version ${info.latestVersion}. Tap to update.`}
      style={[styles.banner, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.row}>
        <Ionicons name="cloud-download-outline" size={18} color={BANNER_INK} />
        <Text style={styles.text} numberOfLines={1}>
          Update available · {info.latestVersion}
        </Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Update</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: BANNER_BG,
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
    color: BANNER_INK,
    fontSize: 13,
    fontWeight: '700',
  },
  cta: {
    backgroundColor: BANNER_INK,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  ctaText: {
    color: BANNER_BG,
    fontSize: 12,
    fontWeight: '800',
  },
});
