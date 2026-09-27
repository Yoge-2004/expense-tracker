/**
 * @file AboutModal.tsx
 * @description In-app modal detailing the ExpenseTracker platform mission, architecture, and version.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ visible, onClose }) => {
  const { theme } = useAuth();
  const c = Colors[theme];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              paddingTop: Math.max(20, insets.top),
              paddingBottom: Math.max(20, insets.bottom),
              maxHeight: height * 0.88,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: c.primary + '1A', borderColor: c.primary + '40' }]}>
                <Text style={[styles.badgeText, { color: c.primary }]}>EXECUTIVE EDITION &bull; v1.4.0</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: c.inputBg }]}
              accessibilityLabel="Close about modal"
            >
              <Ionicons name="close" size={18} color={c.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Logo / Title */}
            <View style={styles.heroSection}>
              <View style={[styles.logoIconBox, { backgroundColor: c.primary + '20', borderColor: c.primary }]}>
                <Ionicons name="wallet" size={32} color={c.primary} />
              </View>
              <Text style={[styles.appTitle, { color: c.text }]}>ExpenseTracker</Text>
              <Text style={[styles.tagline, { color: c.textMuted }]}>
                An executive-grade personal financial command center designed for complete financial sovereignty, privacy, and speed.
              </Text>
            </View>

            {/* Core Pillars */}
            <View style={styles.pillarsGrid}>
              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={c.primary} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>100% Private Ledger</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Your data stays strictly under your control. No third-party data tracking, ad pixels, or receipt selling.
                </Text>
              </View>

              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="sparkles-outline" size={16} color={c.accent} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>Instant Tactile UI</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Crafted with 60 FPS physics animations, device haptics, and sub-16ms theme transitions.
                </Text>
              </View>

              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="stats-chart-outline" size={16} color={c.teal} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>Executive Accounting</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Native multi-sheet Excel workbooks with AutoFilters, live SUM formulas, and audit-ready PDF reports.
                </Text>
              </View>

              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="sync-outline" size={16} color={c.primary} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>Real-Time Sync</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Fluid parity between Web Dashboard and Mobile App, with offline fallback and proactive polling.
                </Text>
              </View>
            </View>

            {/* Tech Stack */}
            <View style={[styles.techCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Text style={[styles.techTitle, { color: c.text }]}>Core Architecture</Text>
              <Text style={[styles.techSub, { color: c.textMuted }]}>
                Spring Boot 4.1.1 (Java 26) &bull; React Native (Expo SDK 52) &bull; TypeScript &bull; Apache POI &bull; Tesseract OCR
              </Text>
            </View>
          </ScrollView>

          {/* Action Button */}
          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
              style={[styles.dismissBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
            >
              <Text style={[styles.dismissText, { color: c.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  badgeRow: {
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  logoIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  pillarsGrid: {
    gap: 10,
    marginVertical: 12,
  },
  pillarBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  pillarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pillarDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  techCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  techTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  techSub: {
    fontSize: 11,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  dismissBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
