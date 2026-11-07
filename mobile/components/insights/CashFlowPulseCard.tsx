/**
 * @file CashFlowPulseCard.tsx
 * @description Hero card synthesizing cross-domain cash flow: monthly inflows vs outflows, net surplus/deficit,
 * and savings retention velocity.
 */

import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';

interface CashFlowPulseCardProps {
  activeInflow: number;
  currentMonthSpent: number;
  netCashFlow: number;
  savingsRate: number;
  formatAmt: (val: number) => string;
  onPress: () => void;
  colors: ThemeColors;
}

export const CashFlowPulseCard: React.FC<CashFlowPulseCardProps> = React.memo(({
  activeInflow,
  currentMonthSpent,
  netCashFlow,
  savingsRate,
  formatAmt,
  onPress,
  colors: c,
}) => {
  const isSurplus = netCashFlow >= 0;
  const statusColor = isSurplus ? c.success : c.danger;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.heroCard,
        {
          backgroundColor: c.card,
          borderColor: statusColor + '30',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Monthly Cash Flow Pulse"
    >
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: statusColor + '18' }]}>
            <Ionicons name="swap-horizontal-outline" size={20} color={statusColor} />
          </View>
          <View>
            <Text style={[styles.cardTag, { color: statusColor }]}>
              {isSurplus ? 'Net Surplus' : 'Net Deficit'} • Cash Flow Pulse
            </Text>
            <Text style={[styles.cardTitle, { color: c.text }]}>Monthly Cash Flow</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </View>

      <View style={styles.kpiRow}>
        <View>
          <Text style={[styles.primaryVal, { color: statusColor }]}>
            {isSurplus ? '+' : ''}{formatAmt(netCashFlow)}
          </Text>
          <Text style={[styles.subText, { color: c.textMuted }]}>
            {activeInflow > 0
              ? `${savingsRate}% of total revenue retained`
              : 'Log income entries to model savings rate'}
          </Text>
        </View>
        <View
          style={[
            styles.savingsPill,
            {
              backgroundColor: statusColor + '15',
              borderColor: statusColor + '30',
            },
          ]}
        >
          <Ionicons
            name={isSurplus ? 'trending-up-outline' : 'trending-down-outline'}
            size={14}
            color={statusColor}
          />
          <Text style={[styles.savingsPillText, { color: statusColor }]}>
            {activeInflow > 0 ? `${savingsRate}% Rate` : 'Track Income'}
          </Text>
        </View>
      </View>

      {/* Mini Flow Meter */}
      <View style={[styles.flowMeterBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
        <View style={styles.flowItem}>
          <View style={styles.flowLabelRow}>
            <View style={[styles.dot, { backgroundColor: c.success }]} />
            <Text style={[styles.flowLabel, { color: c.textMuted }]}>Inflows</Text>
          </View>
          <Text style={[styles.flowValue, { color: c.text }]}>+{formatAmt(activeInflow)}</Text>
        </View>

        <View style={[styles.flowDivider, { backgroundColor: c.border }]} />

        <View style={styles.flowItem}>
          <View style={styles.flowLabelRow}>
            <View style={[styles.dot, { backgroundColor: c.danger }]} />
            <Text style={[styles.flowLabel, { color: c.textMuted }]}>Outflows</Text>
          </View>
          <Text style={[styles.flowValue, { color: c.text }]}>-{formatAmt(currentMonthSpent)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

CashFlowPulseCard.displayName = 'CashFlowPulseCard';

const styles = StyleSheet.create({
  heroCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTag: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  primaryVal: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  savingsPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  flowMeterBox: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
  },
  flowItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  flowLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  flowLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  flowValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  flowDivider: {
    width: 1,
    height: 24,
  },
});
