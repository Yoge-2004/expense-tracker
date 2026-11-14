/**
 * @file LoanMetricsHeader.tsx
 * @description KPI Metrics Header displaying Owed to You, You Owe, and Net Position cards.
 * Adheres to Single Responsibility Principle (SRP).
 */

import React from 'react';
import { View } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedCard } from '../AnimatedCard';
import { ThemeColors } from '../../constants/theme';
import { LoanMetrics } from '../../types/domain';
import { loansStyles as styles } from './loansStyles';

interface LoanMetricsHeaderProps {
  loanMetrics: LoanMetrics | null;
  loansCount: number;
  currSymbol: string;
  isStealthMode: boolean;
  colors: ThemeColors;
}

export const LoanMetricsHeader: React.FC<LoanMetricsHeaderProps> = React.memo(({
  loanMetrics,
  loansCount,
  currSymbol,
  isStealthMode,
  colors: c,
}) => {
  const formatAmount = (val: number, prefix: string = '') => {
    if (isStealthMode) return `${prefix}${currSymbol}••••••`;
    return `${prefix}${currSymbol}${Number(val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  const lentPending = loanMetrics?.lentPending ?? 0;
  const borrowedPending = loanMetrics?.borrowedPending ?? 0;
  const netPosition = loanMetrics?.netBalance ?? (lentPending - borrowedPending);
  const isNoData = loanMetrics == null && loansCount === 0;

  return (
    <View style={styles.metricsGrid}>
      {/* Card 1: Owed to You */}
      <AnimatedCard
        style={[
          styles.metricCard,
          {
            backgroundColor: c.success + '12',
            borderColor: c.success + '40',
          },
        ]}
        scaleTo={0.97}
      >
        <View style={styles.metricTop}>
          <Text style={[styles.metricLabel, { color: c.success }]}>
            Owed to You
          </Text>
          <Ionicons name="arrow-down-circle" size={16} color={c.success} />
        </View>
        <Text style={[styles.metricValue, { color: c.success }]} numberOfLines={1}>
          {isNoData ? '--' : formatAmount(lentPending, '+')}
        </Text>
        <Text style={[styles.metricSub, { color: c.textMuted }]}>
          {isNoData ? '-- total lent' : `${formatAmount(loanMetrics?.totalLent ?? 0)} total lent`}
        </Text>
      </AnimatedCard>

      {/* Card 2: You Owe */}
      <AnimatedCard
        style={[
          styles.metricCard,
          {
            backgroundColor: c.danger + '12',
            borderColor: c.danger + '40',
          },
        ]}
        scaleTo={0.97}
      >
        <View style={styles.metricTop}>
          <Text style={[styles.metricLabel, { color: c.danger }]}>
            You Owe
          </Text>
          <Ionicons name="arrow-up-circle" size={16} color={c.danger} />
        </View>
        <Text style={[styles.metricValue, { color: c.danger }]} numberOfLines={1}>
          {isNoData ? '--' : formatAmount(borrowedPending, '-')}
        </Text>
        <Text style={[styles.metricSub, { color: c.textMuted }]}>
          {isNoData ? '-- borrowed' : `${formatAmount(loanMetrics?.totalBorrowed ?? 0)} borrowed`}
        </Text>
      </AnimatedCard>

      {/* Card 3: Net Balance Position */}
      <AnimatedCard
        style={[
          styles.metricCard,
          {
            backgroundColor: c.inputBg,
            borderColor: c.border,
          },
        ]}
        scaleTo={0.97}
      >
        <View style={styles.metricTop}>
          <Text style={[styles.metricLabel, { color: c.textMuted }]}>Net Position</Text>
          <Ionicons name="swap-horizontal" size={16} color={c.primary} />
        </View>
        <Text
          style={[
            styles.metricValue,
            { color: isNoData ? c.textMuted : netPosition >= 0 ? c.success : c.danger },
          ]}
          numberOfLines={1}
        >
          {isNoData ? '--' : formatAmount(Math.abs(netPosition), netPosition >= 0 ? '+' : '-')}
        </Text>
        <Text style={[styles.metricSub, { color: c.textMuted }]}>
          {isNoData
            ? '-- pending • -- settled'
            : `${loanMetrics?.pendingCount ?? 0} pending • ${loanMetrics?.settledCount ?? 0} settled`}
        </Text>
      </AnimatedCard>
    </View>
  );
});

LoanMetricsHeader.displayName = 'LoanMetricsHeader';
