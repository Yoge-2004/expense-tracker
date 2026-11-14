/**
 * @file NotificationCaptureCard.tsx
 * @description Profile card for automatic bank / UPI notification & SMS capture (Android only).
 * Explains exactly what is read, and enables both SMS Read and Android Notification access.
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
  hasSmsPermission,
  isNotificationAccessGranted,
  openCaptureAccessSettings,
  openCaptureAppInfo,
  requestSmsPermission,
  setCapturePaused,
} from '../../services/notificationCapture';

export const NotificationCaptureCard = memo(function NotificationCaptureCard({
  colors: c,
}: {
  colors: ThemeColors;
}) {
  const { showAlert } = useAlert();
  const [state, setState] = useState<CaptureState>(() => getCaptureState());
  const [hasSms, setHasSms] = useState(false);
  const [hasNotif, setHasNotif] = useState(false);
  const waitingForGrant = useRef(false);

  const refresh = useCallback(async () => {
    setState(getCaptureState());
    setHasNotif(isNotificationAccessGranted());
    setHasSms(await hasSmsPermission());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  // On return from Settings: re-check
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void refresh().then(() => {
        const now = getCaptureState();
        if (waitingForGrant.current) {
          waitingForGrant.current = false;
          if (now === 'needs-access') showRestrictedHelp();
          else if (now === 'active') {
            showAlert('Capture is on', 'Bank SMS and UPI debits will be recorded automatically.', undefined, 'success');
          }
        }
      });
    });
    return () => sub.remove();
  }, [showAlert, showRestrictedHelp, refresh]);

  const enableAll = useCallback(async () => {
    // 1. Request SMS permission
    const smsOk = await requestSmsPermission();
    setHasSms(smsOk);

    // 2. Guide user to Notification Access for UPI apps
    showAlert(
      'Record UPI and Bank Debits?',
      'Android will ask you to switch on Notification access so Google Pay, PhonePe, and Paytm alerts can also be read. Only money transactions are kept; OTPs and personal chats are completely ignored. Nothing leaves your phone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => void refresh() },
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
  }, [showAlert, refresh]);

  const togglePause = useCallback(() => {
    setCapturePaused(state === 'active');
    void refresh();
  }, [state, refresh]);

  if (state === 'unsupported') return null;

  const isFullyActive = state === 'active' && hasSms;
  const isPartiallyActive = state === 'active' || hasSms;

  let subtitle = 'Off. Record bank SMS and UPI debits automatically.';
  if (state === 'paused') {
    subtitle = 'Paused. Detection is temporarily disabled.';
  } else if (isFullyActive) {
    subtitle = 'Active. Bank SMS and UPI payments are recorded automatically.';
  } else if (isPartiallyActive) {
    subtitle = hasNotif
      ? 'UPI apps active · Grant SMS permission for bank text alerts.'
      : 'Bank SMS active · Grant Notification access for UPI apps.';
  }

  return (
    <View style={[styles.block, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={[styles.iconBox, { backgroundColor: c.primary + '18' }]}>
            <Ionicons name="notifications-circle-outline" size={20} color={c.primary} />
          </View>
          <View style={styles.texts}>
            <Text style={[styles.title, { color: c.text }]}>Automatic transaction capture</Text>
            <Text style={[styles.sub, { color: c.textMuted }]}>{subtitle}</Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={!isPartiallyActive ? enableAll : togglePause}
          accessibilityRole="button"
          accessibilityLabel="Automatic transaction capture action"
          style={[styles.button, { backgroundColor: c.primary + '18', borderColor: c.primary + '55' }]}
        >
          <Text style={[styles.buttonText, { color: c.primary }]}>
            {!isPartiallyActive ? 'Enable' : state === 'active' ? 'Pause' : 'Resume'}
          </Text>
        </TouchableOpacity>
      </View>
      {isPartiallyActive && (!hasSms || !hasNotif) && (
        <View style={[styles.secondaryRow, { borderTopColor: c.border }]}>
          <Text style={[styles.partialNotice, { color: c.textMuted }]}>
            {!hasSms ? '• Bank SMS permission is missing' : '• UPI Notification access is missing'}
          </Text>
          <TouchableOpacity
            onPress={enableAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.completeBtnText, { color: c.primary }]}>Complete Setup</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  block: { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  texts: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11.5, marginTop: 2 },
  partialNotice: { fontSize: 11.5, fontWeight: '500' },
  completeBtnText: { fontSize: 12, fontWeight: '700' },
  button: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  buttonText: { fontSize: 12.5, fontWeight: '700' },
});
