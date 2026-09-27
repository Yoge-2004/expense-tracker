/**
 * @file HelpGuideModal.tsx
 * @description In-app interactive user guide and feature walkthrough modal.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface HelpGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

interface GuideSection {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  badge: string;
  summary: string;
  bullets: string[];
}

const SECTIONS: GuideSection[] = [
  {
    id: 'dashboard',
    icon: 'speedometer-outline',
    title: '1. Dashboard & Cash Flow Matrix',
    badge: 'Basics',
    summary: 'The dashboard gives you an instant, high-level pulse of your financial position.',
    bullets: [
      'Total Inflow: Sum of all salaries, freelance payouts, and dividends.',
      'Total Outflow: Sum of all expenses, bills, and recurring subscriptions.',
      'Net Cash Flow: Your surplus or deficit (Inflow minus Outflow). Positive is green, deficit is red.',
      'Interactive Charts: Switch between daily spending trends and category breakdown donuts.'
    ]
  },
  {
    id: 'transactions',
    icon: 'swap-horizontal-outline',
    title: '2. Logging Inflows & Expenses',
    badge: 'Transactions',
    summary: 'Effortlessly track every cent with dedicated streams and quick inline actions.',
    bullets: [
      'Floating (+) Action Button: Tap anywhere on the home screen to quickly record an expense or income.',
      'Inline Actions: Tap the mini pencil or trash can directly on transaction cards for instant 1-tap edit and delete.',
      'Stream Toggles: Switch between "Expenses" and "Incomes" above the ledger to isolate inflows.',
      'Recurring Subscriptions: Flag recurring bills to track renewal schedules and prevent surprises.'
    ]
  },
  {
    id: 'notifications',
    icon: 'notifications-outline',
    title: '3. Alerts & Smart Debit Tracking',
    badge: 'Automation',
    summary: 'Stay on top of your wallet without having to remember manual entries.',
    bullets: [
      'Daily 2x Check-ins: Automated friendly prompts at 1:30 PM & 8:30 PM to log daily coffee and meals.',
      'Real-Time Debit Alerts: Instant notifications dispatch when bank debit alerts or SMS are processed.',
      'One-Tap Simulation: Test your alert pipeline directly from your Profile settings.'
    ]
  },
  {
    id: 'envelopes',
    icon: 'wallet-outline',
    title: '4. Budgets & Savings Envelopes',
    badge: 'Planning',
    summary: 'Enforce spending discipline and build long-term wealth.',
    bullets: [
      'Category Budgets: Assign monthly spending limits (e.g., Dining, Groceries, Travel).',
      'Usage Warnings: Progress bars dynamically change from gold to amber and crimson when limits approach.',
      'Savings Goals: Define milestones (Emergency Fund, New Laptop) and record deposits anytime.'
    ]
  },
  {
    id: 'exports',
    icon: 'document-text-outline',
    title: '5. Executive Spreadsheets & Backups',
    badge: 'Reporting',
    summary: 'Generate institutional-grade financial statements for auditing or personal archiving.',
    bullets: [
      'Executive Excel Workbook: Multi-sheet workbook featuring native Excel formulas (=SUM), freeze panes, and AutoFilters.',
      'PDF Financial Statement: Clean, printable report of monthly performance.',
      'Two-Way CSV/Excel Backups: Export your records anytime and re-import them with fuzzy header matching.'
    ]
  },
  {
    id: 'security',
    icon: 'shield-checkmark-outline',
    title: '6. Biometrics & Zero-Email Security',
    badge: 'Security',
    summary: 'Bank-grade protection keeping your financial data exclusively yours.',
    bullets: [
      'Biometric Unlock: Protect your ledger using Apple Face ID or Android Fingerprint.',
      '6-Digit Security PIN: Cryptographic zero-email fallback allows offline password resets without external servers.'
    ]
  }
];

export const HelpGuideModal: React.FC<HelpGuideModalProps> = ({ visible, onClose }) => {
  const { theme } = useAuth();
  const c = Colors[theme];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [expandedId, setExpandedId] = useState<string>('dashboard');

  const toggleSection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setExpandedId((prev) => (prev === id ? '' : id));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: c.bg,
              borderColor: c.border,
              paddingTop: Math.max(16, insets.top),
              paddingBottom: Math.max(16, insets.bottom),
              maxHeight: height * 0.92,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconBox, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="book-outline" size={20} color={c.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: c.text }]}>User Guide & Help</Text>
                <Text style={[styles.subtitle, { color: c.textMuted }]}>
                  Master your financial command center
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: c.card }]}
              accessibilityLabel="Close help guide"
            >
              <Ionicons name="close" size={20} color={c.text} />
            </TouchableOpacity>
          </View>

          {/* Guide Sections List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {SECTIONS.map((sec) => {
              const isExpanded = expandedId === sec.id;
              return (
                <View
                  key={sec.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: c.card,
                      borderColor: isExpanded ? c.primary : c.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => toggleSection(sec.id)}
                    style={styles.cardHeader}
                  >
                    <View style={styles.cardHeaderLeft}>
                      <View
                        style={[
                          styles.secIconBox,
                          { backgroundColor: isExpanded ? c.primary + '20' : c.inputBg },
                        ]}
                      >
                        <Ionicons
                          name={sec.icon}
                          size={18}
                          color={isExpanded ? c.primary : c.textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: c.text }]}>{sec.title}</Text>
                        <Text style={[styles.cardBadge, { color: c.primary }]}>{sec.badge}</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={c.textMuted}
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.cardBody, { borderTopColor: c.border }]}>
                      <Text style={[styles.summaryText, { color: c.text }]}>{sec.summary}</Text>
                      <View style={styles.bulletsList}>
                        {sec.bullets.map((b, idx) => (
                          <View key={idx} style={styles.bulletRow}>
                            <Text style={[styles.bulletDot, { color: c.primary }]}>•</Text>
                            <Text style={[styles.bulletText, { color: c.textMuted }]}>{b}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onClose();
              }}
              style={[styles.gotItBtn, { backgroundColor: c.primary }]}
            >
              <Text style={[styles.gotItText, { color: theme === 'light' ? '#FFF' : '#10120E' }]}>
                Got It!
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 18,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  secIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardBadge: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    textTransform: 'uppercase',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  bulletsList: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
  },
  bulletText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  gotItBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
