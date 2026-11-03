import React, { memo, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/theme';
import { AnimatedCard } from '../AnimatedCard';
import { StaggeredView } from '../StaggeredView';
import { dashboardStyles as styles } from './dashboardStyles';

export interface DashboardMetricsMatrixProps {
  colors: ThemeColors;
  theme: 'light' | 'dark';
  currSymbol: string;
  isStealthMode: boolean;
  isLargeScreen: boolean;
  matrixCardWidth?: number | string;
  monthlyNet: number;
  monthlyInflow: number;
  monthlyOutflow: number;
  allTimeNet: number;
  totalIncome: number;
  totalSpent: number;
  safeDailySpend: number;
  noSpendStreak: number;
  currentDay: number;
  daysInMonth: number;
  dailyBurn: number;
  monthEndForecast: number;
  highestCatName: string;
  highestCatAmt: number;
}

export const DashboardMetricsMatrix = memo(function DashboardMetricsMatrix({
  colors: c,
  currSymbol,
  isStealthMode,
  monthlyNet,
  monthlyInflow,
  monthlyOutflow,
  allTimeNet,
  totalIncome,
  totalSpent,
  safeDailySpend,
  dailyBurn,
  highestCatName,
  highestCatAmt,
}: DashboardMetricsMatrixProps) {
  const [period, setPeriod] = useState<'month' | 'all'>('month');

  const activeInflow = period === 'month' ? monthlyInflow : totalIncome;
  const activeOutflow = period === 'month' ? monthlyOutflow : totalSpent;
  const activeNet = period === 'month' ? monthlyNet : allTimeNet;
  const isSurplus = activeNet >= 0;

  return (
    <StaggeredView delay={40} direction="up">
      <AnimatedCard style={[styles.cashFlowCard, { backgroundColor: c.card, borderColor: c.border }]} scaleTo={0.99}>
        {/* Header with Title and Segmented Period Toggle */}
        <View style={styles.cashFlowHeader}>
          <View style={styles.cashFlowHeaderLeft}>
            <Ionicons name="wallet-outline" size={17} color={c.primary} />
            <Text style={[styles.cashFlowTitle, { color: c.text }]}>
              {period === 'month' ? 'Monthly Cash Flow' : 'All-Time Standing'}
            </Text>
          </View>

          {/* Interactive Segmented Switch */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: c.inputBg,
              borderRadius: 20,
              padding: 2,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <TouchableOpacity
              onPress={() => setPeriod('month')}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: period === 'month' ? c.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: period === 'month' ? c.onPrimary : c.textMuted,
                }}
              >
                This Month
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPeriod('all')}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: period === 'all' ? c.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: period === 'all' ? c.onPrimary : c.textMuted,
                }}
              >
                All-Time
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Cash Flow Row: Inflow | Outflow | Net Position */}
        <View style={styles.cashFlowMetricsRow}>
          {/* Inflow */}
          <View style={styles.cashFlowCol}>
            <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>
              {period === 'month' ? 'Monthly Inflow' : 'Total Inflow'}
            </Text>
            <Text style={[styles.cashFlowAmount, { color: c.success }]} numberOfLines={1}>
              {isStealthMode ? `${currSymbol}••••••` : `+${currSymbol}${Math.round(activeInflow).toLocaleString('en-IN')}`}
            </Text>
          </View>

          <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

          {/* Outflow */}
          <View style={styles.cashFlowCol}>
            <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>
              {period === 'month' ? 'Monthly Outflow' : 'Total Outflow'}
            </Text>
            <Text style={[styles.cashFlowAmount, { color: c.accent }]} numberOfLines={1}>
              {isStealthMode ? `${currSymbol}••••••` : `-${currSymbol}${Math.round(activeOutflow).toLocaleString('en-IN')}`}
            </Text>
          </View>

          <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

          {/* Net Position */}
          <View style={styles.cashFlowCol}>
            <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Net Position</Text>
            <Text
              style={[
                styles.cashFlowAmount,
                { color: isSurplus ? c.success : c.danger },
              ]}
              numberOfLines={1}
            >
              {isStealthMode
                ? `${currSymbol}••••••`
                : `${isSurplus ? '+' : ''}${currSymbol}${Math.round(activeNet).toLocaleString('en-IN')}`}
            </Text>
          </View>
        </View>

        {/* Horizontal Divider */}
        <View style={[styles.cashFlowHorizontalDivider, { backgroundColor: c.border }]} />

        {/* Secondary Intelligence Micro Row */}
        <View style={styles.proMetricsRow}>
          {/* Safe Daily Spend */}
          <View
            style={[
              styles.proMetricBadge,
              {
                backgroundColor: c.fillSubtle,
                borderColor: safeDailySpend > 0 ? c.success + '40' : c.border,
              },
            ]}
          >
            <View
              style={[
                styles.proMetricIconCircle,
                { backgroundColor: safeDailySpend > 0 ? c.success + '20' : c.danger + '20' },
              ]}
            >
              <Ionicons name="shield-checkmark" size={13} color={safeDailySpend > 0 ? c.success : c.danger} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>Safe / Day</Text>
              <Text
                style={[styles.proMetricVal, { color: safeDailySpend > 0 ? c.success : c.danger }]}
                numberOfLines={1}
              >
                {isStealthMode
                  ? currSymbol + '••••••'
                  : currSymbol + Math.round(safeDailySpend).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Daily Velocity */}
          <View
            style={[
              styles.proMetricBadge,
              { backgroundColor: c.fillSubtle, borderColor: c.border },
            ]}
          >
            <View
              style={[
                styles.proMetricIconCircle,
                { backgroundColor: c.highlight + '20' },
              ]}
            >
              <Ionicons name="speedometer" size={13} color={c.highlight} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>Burn / Day</Text>
              <Text style={[styles.proMetricVal, { color: c.text }]} numberOfLines={1}>
                {isStealthMode
                  ? currSymbol + '••••••'
                  : currSymbol + Math.round(dailyBurn).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>

          {/* Top Category */}
          <View
            style={[
              styles.proMetricBadge,
              { backgroundColor: c.fillSubtle, borderColor: c.border },
            ]}
          >
            <View
              style={[
                styles.proMetricIconCircle,
                { backgroundColor: c.warning + '20' },
              ]}
            >
              <Ionicons name="pie-chart-outline" size={13} color={c.warning} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.proMetricLabel, { color: c.textMuted }]} numberOfLines={1}>
                {highestCatName || 'Category'}
              </Text>
              <Text style={[styles.proMetricVal, { color: c.text }]} numberOfLines={1}>
                {isStealthMode
                  ? currSymbol + '••••••'
                  : currSymbol + Math.round(highestCatAmt).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>
      </AnimatedCard>
    </StaggeredView>
  );
});
