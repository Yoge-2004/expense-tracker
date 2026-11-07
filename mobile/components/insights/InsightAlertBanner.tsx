/**
 * @file InsightAlertBanner.tsx
 * @description Priority AI Alert Banner providing instant cognitive awareness of anomalies and budget depletion.
 */

import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { MlAnomalyData, BurnoutCandidate } from './types';

interface InsightAlertBannerProps {
  anomaly: MlAnomalyData | null;
  burnout: BurnoutCandidate | null;
  formatAmt: (val: number) => string;
  onPressAnomaly: () => void;
  onPressBurnout: () => void;
  colors: ThemeColors;
}

export const InsightAlertBanner: React.FC<InsightAlertBannerProps> = React.memo(({
  anomaly,
  burnout,
  formatAmt,
  onPressAnomaly,
  onPressBurnout,
  colors: c,
}) => {
  // 1. High Priority: ML Anomaly detected by Isolation Forest
  if (anomaly && anomaly.count > 0) {
    const outlierDesc = anomaly.topOutlier?.desc || 'Irregular Outflow';
    const outlierAmt = anomaly.topOutlier ? formatAmt(anomaly.topOutlier.amount) : '';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPressAnomaly}
        style={[
          styles.banner,
          {
            backgroundColor: c.danger + '14',
            borderColor: c.danger + '40',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Isolation Forest Anomaly Alert"
      >
        <View style={[styles.iconBox, { backgroundColor: c.danger + '22' }]}>
          <Ionicons name="warning-outline" size={20} color={c.danger} />
        </View>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.danger }]}>
              ML Anomaly Detected
            </Text>
            <View style={[styles.badge, { backgroundColor: c.danger + '25' }]}>
              <Text style={[styles.badgeText, { color: c.danger }]}>
                {anomaly.count} {anomaly.count === 1 ? 'Outlier' : 'Outliers'}
              </Text>
            </View>
          </View>
          <Text style={[styles.desc, { color: c.text }]} numberOfLines={2}>
            Isolation Forest flagged {anomaly.count} irregular transaction{anomaly.count === 1 ? '' : 's'}: {outlierDesc} ({outlierAmt})
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.danger} />
      </TouchableOpacity>
    );
  }

  // 2. Medium-High Priority: Budget Cap Depletion within 7 days
  if (burnout && burnout.daysRemainingUntilDepletion <= 7) {
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPressBurnout}
        style={[
          styles.banner,
          {
            backgroundColor: c.accent + '14',
            borderColor: c.accent + '40',
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Budget Cap Depletion Warning"
      >
        <View style={[styles.iconBox, { backgroundColor: c.accent + '22' }]}>
          <Ionicons name="flame-outline" size={20} color={c.accent} />
        </View>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.accent }]}>
              Budget Depletion Alert
            </Text>
            <View style={[styles.badge, { backgroundColor: c.accent + '25' }]}>
              <Text style={[styles.badgeText, { color: c.accent }]}>
                {burnout.daysRemainingUntilDepletion}d Left
              </Text>
            </View>
          </View>
          <Text style={[styles.desc, { color: c.text }]} numberOfLines={2}>
            {`"${burnout.categoryName}" cap will deplete in ${burnout.daysRemainingUntilDepletion} days at your current rate (${formatAmt(burnout.dailyCategoryRate)}/day).`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.accent} />
      </TouchableOpacity>
    );
  }

  // 3. Normal / Nominal status indicator
  return (
    <View
      style={[
        styles.nominalBadge,
        {
          backgroundColor: c.card,
          borderColor: c.border,
        },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: c.success }]} />
      <Text style={[styles.nominalText, { color: c.textMuted }]}>
        AI Financial Guard Active <Text style={{ color: c.success, fontWeight: '700' }}>• Nominal</Text>
      </Text>
    </View>
  );
});

InsightAlertBanner.displayName = 'InsightAlertBanner';

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  desc: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  nominalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  nominalText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
