/**
 * OfflineBanner
 *
 * Inline notice for "couldn't reach the server / showing saved data" with an
 * explicit Retry button. Fully inherits the wallpaper theme engine tokens
 * (c.fillSubtle, c.text, c.primary, c.onPrimary) for high-contrast WCAG readability.
 */
import React from 'react';
import { usePreferences } from '../context/PreferencesContext';
import { Colors, readableTextColor } from '../constants/theme';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';

interface OfflineBannerProps {
  /** What the user is looking at, e.g. "Offline mode · Cached at 10:42". */
  message: string;
  /** Called when the Retry button is pressed. */
  onRetry: () => void;
  /** Shows a spinner in the button and ignores presses while a retry runs. */
  retrying?: boolean;
  /** Accent colour; defaults to the app's gold / theme primary. */
  tone?: string;
  /** Optional layout style overrides, e.g. marginHorizontal */
  style?: StyleProp<ViewStyle>;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = React.memo(({
  message,
  onRetry,
  retrying = false,
  tone,
  style,
}) => {
  const { theme, themeColors } = usePreferences();
  const c = themeColors || Colors[theme || 'dark'];
  const bannerTone = tone || c.primary;
  const onTone = c.onPrimary || readableTextColor(bannerTone);

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.banner,
        {
          backgroundColor: c.fillSubtle,
          borderColor: bannerTone + '4D',
        },
        style,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: bannerTone + '22' }]}>
        <Ionicons name="cloud-offline" size={16} color={bannerTone} />
      </View>
      <Text style={[styles.message, { color: c.text }]} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={retrying}
        onPress={onRetry}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Retry loading data"
        style={[styles.retryButton, { backgroundColor: bannerTone, borderColor: bannerTone }]}
      >
        {retrying ? (
          <ActivityIndicator size="small" color={onTone} />
        ) : (
          <>
            <Ionicons name="refresh" size={14} color={onTone} />
            <Text style={[styles.retryText, { color: onTone }]}>Retry</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
});

OfflineBanner.displayName = 'OfflineBanner';

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 72,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  retryText: {
    fontWeight: '700',
    fontSize: 12,
  },
});
