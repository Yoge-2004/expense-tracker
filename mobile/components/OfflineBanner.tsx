/**
 * OfflineBanner
 *
 * Inline notice for "couldn't reach the server / showing saved data" with an
 * explicit Retry button. Only the button is pressable: the message is plain
 * text inside a plain View, so the bar itself no longer reacts to touches, and
 * the button carries an icon, a label and an outline so it reads as a button.
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Colors, readableTextColor } from '../constants/theme';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';

interface OfflineBannerProps {
  /** What the user is looking at, e.g. "Offline mode · Cached at 10:42". */
  message: string;
  /** Called when the Retry button is pressed. */
  onRetry: () => void;
  /** Shows a spinner in the button and ignores presses while a retry runs. */
  retrying?: boolean;
  /** Accent colour; defaults to the app's gold. */
  tone?: string;
}

export function OfflineBanner({ message, onRetry, retrying = false, tone }: OfflineBannerProps) {
  const { theme, themeColors } = useAuth();
  const c = themeColors || Colors[theme];
  const bannerTone = tone || c.primary;
  const onTone = readableTextColor(bannerTone);
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: bannerTone + '18', borderColor: bannerTone + '40' }]}
    >
      <Ionicons name="cloud-offline" size={16} color={bannerTone} />
      <Text style={[styles.message, { color: bannerTone }]} numberOfLines={2}>
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
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  message: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 76,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
  },
  retryText: {
    color: '#10120E',
    fontWeight: '800',
    fontSize: 12,
  },
});
