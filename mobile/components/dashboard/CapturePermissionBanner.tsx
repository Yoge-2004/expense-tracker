/**
 * @file CapturePermissionBanner.tsx
 * @description Dashboard banner prompting Android users to enable automatic transaction
 * detection for Bank SMS and UPI apps (Google Pay, PhonePe, Paytm, CRED).
 */

import React, { memo, useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { useAlert } from '../../context/AlertContext';
import {
  hasSmsPermission,
  isNotificationAccessGranted,
  openCaptureAccessSettings,
  requestSmsPermission,
} from '../../services/notificationCapture';

const DISMISSED_KEY = 'notifCapture.dismissedBanner.v1';

export const CapturePermissionBanner = memo(function CapturePermissionBanner({
  colors: c,
}: {
  colors: ThemeColors;
}) {
  const { showAlert } = useAlert();
  const [visible, setVisible] = useState(false);
  const [hasSms, setHasSms] = useState(false);
  const [hasNotif, setHasNotif] = useState(false);

  const checkStatus = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setVisible(false);
      return;
    }
    try {
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      if (dismissed === 'true') {
        setVisible(false);
        return;
      }
      const sms = await hasSmsPermission();
      const notif = isNotificationAccessGranted();
      setHasSms(sms);
      setHasNotif(notif);
      setVisible(!sms || !notif);
    } catch {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      /* best effort */
    }
  }, []);

  const handleEnable = useCallback(async () => {
    // 1. Request SMS permission first
    let smsGranted = hasSms;
    if (!smsGranted) {
      smsGranted = await requestSmsPermission();
      setHasSms(smsGranted);
    }

    // 2. Guide user for Notification Access (for UPI apps like GPay, PhonePe, Paytm)
    if (!hasNotif) {
      showAlert(
        'Enable UPI Notification Reading',
        'To automatically capture payments from Google Pay, PhonePe, Paytm, and banking apps, please switch on Notification Access for Expense Tracker in the next screen.',
        [
          { text: 'Maybe Later', style: 'cancel', onPress: () => void checkStatus() },
          {
            text: 'Open Settings',
            onPress: () => {
              openCaptureAccessSettings();
            },
          },
        ],
        'info'
      );
    } else {
      showAlert(
        'Auto-Capture Enabled',
        'Expense Tracker will now automatically record your bank debit SMS and UPI payments!',
        undefined,
        'success'
      );
      setVisible(false);
    }
  }, [hasSms, hasNotif, showAlert, checkStatus]);

  if (!visible || Platform.OS !== 'android') return null;

  return (
    <View style={[styles.container, { backgroundColor: c.card, borderColor: c.primary + '55' }]}>
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { backgroundColor: c.primary + '18' }]}>
          <Ionicons name="flash-outline" size={20} color={c.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: c.text }]}>Auto-Capture Bank & UPI Debits</Text>
          <Text style={[styles.description, { color: c.textMuted }]}>
            Never manually enter transactions again. Enable SMS & notification access to record GPay, PhonePe, Paytm, and bank alerts automatically.
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Dismiss banner"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={18} color={c.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleEnable}
          style={[styles.enableBtn, { backgroundColor: c.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Enable automatic transaction capture"
        >
          <Ionicons name="shield-checkmark-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.enableText}>Enable Auto-Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleDismiss}
          style={styles.dismissBtn}
          accessibilityRole="button"
        >
          <Text style={[styles.dismissText, { color: c.textMuted }]}>Not Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  content: {
    flex: 1,
    marginRight: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  enableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  enableText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  dismissBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dismissText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
