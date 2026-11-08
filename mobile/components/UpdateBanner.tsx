/**
 * @file UpdateBanner.tsx
 * @description A slim bar at the very top of the app that says a newer version is available,
 * or indicates background download progress and install readiness. Follows dynamic theme colors.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpdate } from '../context/UpdateContext';
import { usePreferences } from '../context/PreferencesContext';
import { Colors, readableTextColor } from '../constants/theme';

export const UpdateBanner: React.FC = React.memo(() => {
  const { info, hasUpdate, openPrompt, isDownloading, downloadProgress, readyFileUri } = useUpdate();
  const { theme, themeColors } = usePreferences();
  const c = themeColors || Colors[theme || 'dark'];
  const bannerBg = readyFileUri ? c.teal : c.primary;
  const bannerInk = c.onPrimary || readableTextColor(bannerBg);
  const insets = useSafeAreaInsets();

  if (!hasUpdate || !info) {
    return null;
  }

  const percent = downloadProgress?.percent || 0;

  return (
    <Pressable
      onPress={openPrompt}
      accessibilityRole="button"
      accessibilityLabel={
        readyFileUri
          ? `Update ready to install, version ${info.latestVersion}. Tap to install.`
          : isDownloading
          ? `Downloading update, ${percent}% completed. Tap to view.`
          : `Update available, version ${info.latestVersion}. Tap to update.`
      }
      style={[styles.banner, { backgroundColor: bannerBg, paddingTop: insets.top + 8 }]}
    >
      <View style={styles.row}>
        <Ionicons
          name={
            readyFileUri
              ? 'checkmark-circle'
              : isDownloading
              ? 'cloud-download-outline'
              : 'sparkles-outline'
          }
          size={18}
          color={bannerInk}
        />
        <Text style={[styles.text, { color: bannerInk }]} numberOfLines={1}>
          {readyFileUri
            ? `Update ready · v${info.latestVersion}`
            : isDownloading
            ? `Downloading update… ${percent}%`
            : `Update available · v${info.latestVersion}`}
        </Text>
        <View style={[styles.cta, { backgroundColor: bannerInk }]}>
          <Text style={[styles.ctaText, { color: bannerBg }]}>
            {readyFileUri ? 'Install' : isDownloading ? 'View' : 'Update'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

UpdateBanner.displayName = 'UpdateBanner';

export default UpdateBanner;

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
