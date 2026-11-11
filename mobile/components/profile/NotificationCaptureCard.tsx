/**
 * @file NotificationCaptureCard.tsx
 * @description Profile card for automatic bank / UPI notification capture (Android only).
 * Explains exactly what is read, then opens Android's Notification access screen on this app's own
 * switch. Shows the current state with Enable / Pause / Resume.
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { useAlert } from '../../context/AlertContext';
import {
  CaptureState,
  getCaptureState,
  openCaptureAccessSettings,
  openCaptureAppInfo,
  setCapturePaused,
} from '../../services/notificationCapture';

const SUBTITLE: Record<Exclude<CaptureState, 'unsupported'>, string> = {
  'needs-access': 'Off. Record bank and UPI debits automatically.',
  paused: 'Paused. Nothing is being read.',
  active: 'On. Recorded the next time you open the app.',
};

export const NotificationCaptureCard = memo(function NotificationCaptureCard({
  colors: c,
}: {
  colors: ThemeColors;
}) {
  const { showAlert } = useAlert();
  const [state, setState] = useState<CaptureState>(() => getCaptureState());
  const waitingForGrant = useRef(false);

  const refresh = useCallback(() => setState(getCaptureState()), []);

  const showRestrictedHelp = useCallback(() => {
    showAlert(
      'Switch is greyed out?',
      'Apps installed outside the Play Store are restricted by Android. Open App info, tap the three-dot menu, choose "Allow restricted settings", then try again.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open App info', onPress: () => { openCaptureAppInfo(); } },
      ],
      'info'
    );
  }, [showAlert]);

  // On return from Settings: re-check, and if access still is not on, offer the restricted-settings help.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = getCaptureState();
      setState(now);
      if (waitingForGrant.current) {
        waitingForGrant.current = false;
        if (now === 'needs-access') showRestrictedHelp();
        else if (now === 'active') {
          showAlert('Capture is on', 'Bank and UPI debits will be recorded the next time you open the app.', undefined, 'success');
        }
      }
    });
    return () => sub.remove();
  }, [showAlert, showRestrictedHelp]);

  const enable = useCallback(() => {
    showAlert(
      'Record transactions automatically?',
      'Android will ask you to switch on Notification access for this app. Only notifications that mention an amount and a payment (for example "Rs 450 debited") are kept. One-time codes, chat and social apps are ignored. Nothing else is stored and nothing leaves your phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            waitingForGrant.current = true;
            openCaptureAccessSettings();
          },
        },
      ],
      'info'
    );
  }, [showAlert]);

  const togglePause = useCallback(() => {
    setCapturePaused(state === 'active');
    refresh();
  }, [state, refresh]);

  if (state === 'unsupported') return null;

  const action =
    state === 'needs-access'
      ? { label: 'Enable', onPress: enable }
      : { label: state === 'active' ? 'Pause' : 'Resume', onPress: togglePause };

  return (
    <View style={[styles.block, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={[styles.iconBox, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="notifications-circle-outline" size={20} color={c.primary} />
          </View>
          <View style={styles.texts}>
            <Text style={[styles.title, { color: c.text }]}>Automatic transaction capture</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>{SUBTITLE[state]}</Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${action.label} automatic transaction capture`}
          style={[styles.button, { backgroundColor: c.primary + '18', borderColor: c.primary + '55' }]}
        >
          <Text style={[styles.buttonText, { color: c.primary }]}>{action.label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  block: { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  texts: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11.5, marginTop: 2 },
  button: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  buttonText: { fontSize: 12.5, fontWeight: '700' },
});
