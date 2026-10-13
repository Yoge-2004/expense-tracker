/**
 * OfflineBanner
 *
 * Inline notice for "couldn't reach the server / showing saved data" with an
 * explicit Retry button. Only the button is pressable: the message is plain
 * text inside a plain View, so the bar itself no longer reacts to touches, and
 * the button carries an icon, a label and an outline so it reads as a button.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export function OfflineBanner({ message, onRetry, retrying = false, tone = '#C79A3E' }: OfflineBannerProps) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: tone + '18', borderColor: tone + '40' }]}
    >
      <Ionicons name="cloud-offline" size={16} color={tone} />
      <Text style={[styles.message, { color: tone }]} numberOfLines={2}>
        {message}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={retrying}
        onPress={onRetry}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Retry loading data"
        style={[styles.retryButton, { backgroundColor: tone, borderColor: tone }]}
      >
        {retrying ? (
          <ActivityIndicator size="small" color="#10120E" />
        ) : (
          <>
            <Ionicons name="refresh" size={14} color="#10120E" />
            <Text style={styles.retryText}>Retry</Text>
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
