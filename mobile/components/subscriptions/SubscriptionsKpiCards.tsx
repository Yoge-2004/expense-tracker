/**
 * @file SubscriptionsKpiCards.tsx
 * @description 4 financial pillar KPI metric cards for Subscriptions & Recurring commitments:
 * 1. Guaranteed Inflow (Salary / Recurring Incomes)
 * 2. Fixed Outflow (Subscriptions)
 * 3. Committed Savings (Chit Funds / Recurring Deposits / SIPs)
 * 4. Net Free Cash Flow (Inflows - Outflows - Savings)
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText as Text } from '../ThemedText';
import { NumberTicker } from '../NumberTicker';
import { ThemeColors } from '../../constants/theme';
import { StaggeredView } from '../StaggeredView';

export interface SubscriptionsKpiCardsProps {
  monthlyIncomeTotal: number;
  monthlyExpenseTotal: number;
  monthlySavingsTotal: number;
  netRecurringFlow: number;
  currSym: string;
  isStealthMode: boolean;
  colors: ThemeColors;
}

export const SubscriptionsKpiCards = memo(function SubscriptionsKpiCards({
  monthlyIncomeTotal,
  monthlyExpenseTotal,
  monthlySavingsTotal,
  netRecurringFlow,
  currSym,
  isStealthMode,
  colors: c,
}: SubscriptionsKpiCardsProps) {
  const isNetPositive = netRecurringFlow >= 0;
  const netColor = isNetPositive ? c.success : c.danger;

  return (
    <StaggeredView delay={80} direction="up">
      <View style={styles.kpiGrid}>
        {/* 1. Recurring Inflow Stream */}
        <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: c.success + '35' }]}>
          <View style={styles.kpiHeader}>
            <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Recurring Inflow</Text>
            <View style={[styles.kpiBadge, { backgroundColor: c.success + '18' }]}>
              <Ionicons name="arrow-down-outline" size={13} color={c.success} />
            </View>
          </View>
          <NumberTicker
            value={monthlyIncomeTotal}
            isStealth={isStealthMode}
            prefix={'+' + currSym}
            decimals={0}
            style={[styles.kpiValue, { color: c.success }]}
          />
          <Text style={[styles.kpiSub, { color: c.textMuted }]}>Guaranteed / mo</Text>
        </View>

        {/* 2. Subscriptions Outflow */}
        <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: c.primary + '35' }]}>
          <View style={styles.kpiHeader}>
            <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Subscriptions</Text>
            <View style={[styles.kpiBadge, { backgroundColor: c.primary + '18' }]}>
              <Ionicons name="repeat" size={13} color={c.primary} />
            </View>
          </View>
          <NumberTicker
            value={monthlyExpenseTotal}
            isStealth={isStealthMode}
            prefix={'-' + currSym}
            decimals={0}
            style={[styles.kpiValue, { color: c.danger }]}
          />
          <Text style={[styles.kpiSub, { color: c.textMuted }]}>Fixed Outflow / mo</Text>
        </View>

        {/* 3. Chits & Savings Installments */}
        <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: c.warning + '35' }]}>
          <View style={styles.kpiHeader}>
            <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Chits & RDs</Text>
            <View style={[styles.kpiBadge, { backgroundColor: c.warning + '18' }]}>
              <Ionicons name="shield-checkmark-outline" size={13} color={c.warning} />
            </View>
          </View>
          <NumberTicker
            value={monthlySavingsTotal}
            isStealth={isStealthMode}
            prefix={currSym}
            decimals={0}
            style={[styles.kpiValue, { color: c.warning }]}
          />
          <Text style={[styles.kpiSub, { color: c.textMuted }]}>Committed Savings / mo</Text>
        </View>

        {/* 4. Net Recurring Autonomy */}
        <View style={[styles.kpiCard, { backgroundColor: c.card, borderColor: netColor + '35' }]}>
          <View style={styles.kpiHeader}>
            <Text style={[styles.kpiLabel, { color: c.textMuted }]}>Net Free Flow</Text>
            <View style={[styles.kpiBadge, { backgroundColor: netColor + '18' }]}>
              <Ionicons name="wallet-outline" size={13} color={netColor} />
            </View>
          </View>
          <NumberTicker
            value={Math.abs(netRecurringFlow)}
            isStealth={isStealthMode}
            prefix={(isNetPositive ? '+' : '-') + currSym}
            decimals={0}
            style={[styles.kpiValue, { color: netColor }]}
          />
          <Text style={[styles.kpiSub, { color: c.textMuted }]}>Inflows - Outflows - Chits</Text>
        </View>
      </View>
    </StaggeredView>
  );
});

SubscriptionsKpiCards.displayName = 'SubscriptionsKpiCards';

const styles = StyleSheet.create({
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  kpiBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 3,
  },
  kpiSub: {
    fontSize: 10.5,
    fontWeight: '500',
  },
});
