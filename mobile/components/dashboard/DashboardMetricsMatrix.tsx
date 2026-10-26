import React, { memo, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeColors } from '../../constants/theme';
import { NumberTicker } from '../NumberTicker';
import { AnimatedCard } from '../AnimatedCard';
import { StaggeredView } from '../StaggeredView';
import { dashboardStyles as styles } from './dashboardStyles';

export interface DashboardMetricsMatrixProps {
  colors: ThemeColors;
  theme: 'light' | 'dark';
  currSymbol: string;
  isStealthMode: boolean;
  isLargeScreen: boolean;
  matrixCardWidth: number | string;
  netCashFlow: number;
  totalIncomeMonth: number;
  totalExpenseMonth: number;
  safeDailySpend: number;
  noSpendStreak: number;
  totalSpent: number;
  currentMonthSpent: number;
  currentMonthInflow: number;
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
  isLargeScreen,
  matrixCardWidth,
  netCashFlow,
  totalIncomeMonth,
  totalExpenseMonth,
  safeDailySpend,
  noSpendStreak,
  totalSpent,
  currentMonthSpent,
  currentMonthInflow,
  currentDay,
  daysInMonth,
  dailyBurn,
  monthEndForecast,
  highestCatName,
  highestCatAmt,
}: DashboardMetricsMatrixProps) {
  const matrixCardStyles = useMemo(
    () => ({
      cardPrimary: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.primary}40` }],
      badgePrimary: [styles.matrixBadge, { backgroundColor: `${c.primary}18` }],
      cardTeal: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.teal}40` }],
      badgeTeal: [styles.matrixBadge, { backgroundColor: `${c.teal}18` }],
      cardAccent: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.accent}40` }],
      badgeAccent: [styles.matrixBadge, { backgroundColor: `${c.accent}18` }],
      cardWarning: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.warning}40` }],
      badgeWarning: [styles.matrixBadge, { backgroundColor: `${c.warning}18` }],
    }),
    [matrixCardWidth, c.card, c.primary, c.teal, c.accent, c.warning]
  );

  return (
    <>
      {/* 1. EXECUTIVE CASH FLOW OVERVIEW */}
      <StaggeredView delay={40} direction="up">
        <AnimatedCard style={[styles.cashFlowCard, { backgroundColor: c.card, borderColor: c.border }]} scaleTo={0.98}>
          <View style={styles.cashFlowHeader}>
            <View style={styles.cashFlowHeaderLeft}>
              <Ionicons name="trending-up" size={16} color={c.primary} />
              <Text style={[styles.cashFlowTitle, { color: c.text }]}>Executive Cash Flow</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: netCashFlow >= 0 ? '#10B98120' : '#EF444420' }]}>
              <Text style={[styles.statusPillText, { color: netCashFlow >= 0 ? '#10B981' : '#EF4444' }]}>
                {netCashFlow >= 0 ? 'Surplus' : 'Deficit'}
              </Text>
            </View>
          </View>

          <View style={styles.cashFlowMetricsRow}>
            {/* Inflow */}
            <View style={styles.cashFlowCol}>
              <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Monthly Inflow</Text>
              <Text style={[styles.cashFlowAmount, { color: '#10B981' }]} numberOfLines={1}>
                {isStealthMode ? `${currSymbol}••••••` : `+${currSymbol}${Math.round(totalIncomeMonth).toLocaleString('en-IN')}`}
              </Text>
            </View>

            <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

            {/* Outflow */}
            <View style={styles.cashFlowCol}>
              <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Monthly Outflow</Text>
              <Text style={[styles.cashFlowAmount, { color: c.accent }]} numberOfLines={1}>
                {isStealthMode ? `${currSymbol}••••••` : `-${currSymbol}${Math.round(totalExpenseMonth).toLocaleString('en-IN')}`}
              </Text>
            </View>

            <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

            {/* Net */}
            <View style={styles.cashFlowCol}>
              <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Net Position</Text>
              <Text
                style={[
                  styles.cashFlowAmount,
                  { color: netCashFlow >= 0 ? '#10B981' : '#EF4444' },
                ]}
                numberOfLines={1}
              >
                {isStealthMode
                  ? `${currSymbol}••••••`
                  : `${netCashFlow >= 0 ? '+' : ''}${currSymbol}${Math.round(netCashFlow).toLocaleString('en-IN')}`}
              </Text>
            </View>
          </View>

          {/* Clean Separation Divider */}
          <View style={[styles.cashFlowHorizontalDivider, { backgroundColor: c.border }]} />

          {/* Micro Pro Metrics Row */}
          <View style={styles.proMetricsRow}>
            {/* Safe Daily Spend */}
            <View style={[styles.proMetricBadge, { backgroundColor: c.card, borderColor: safeDailySpend > 0 ? '#10B98150' : '#EF444450' }]}>
              <View style={[styles.proMetricIconCircle, { backgroundColor: safeDailySpend > 0 ? '#10B98120' : '#EF444420' }]}>
                <Ionicons name="shield-checkmark" size={13} color={safeDailySpend > 0 ? '#10B981' : '#EF4444'} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>Safe to Spend</Text>
                <Text style={[styles.proMetricVal, { color: safeDailySpend > 0 ? '#10B981' : '#EF4444' }]} numberOfLines={1}>
                  {isStealthMode ? currSymbol + '••••••' : currSymbol + Math.round(safeDailySpend).toLocaleString('en-IN')}
                  <Text style={{ fontSize: 10, color: c.textMuted }}> /day</Text>
                </Text>
              </View>
            </View>

            {/* No-Spend Streak */}
            <View style={[styles.proMetricBadge, { backgroundColor: c.card, borderColor: '#F59E0B50' }]}>
              <View style={[styles.proMetricIconCircle, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="flame" size={13} color="#F59E0B" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>No-Spend Streak</Text>
                <Text style={[styles.proMetricVal, { color: '#F59E0B' }]} numberOfLines={1}>
                  {noSpendStreak}{' '}
                  <Text style={{ fontSize: 11, fontWeight: '600', color: c.textMuted }}>
                    {'day' + (noSpendStreak === 1 ? '' : 's')}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </AnimatedCard>
      </StaggeredView>

      {/* 2. FOUR-METRIC MATRIX KPI GRID */}
      <StaggeredView delay={100} direction="up">
        <View style={[styles.matrixGrid, { gap: isLargeScreen ? 12 : 10 }]}>
          {/* Total Ledger Outflow */}
          <AnimatedCard style={matrixCardStyles.cardPrimary} scaleTo={0.96}>
            <View style={styles.matrixTop}>
              <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Total Outflow</Text>
              <View style={matrixCardStyles.badgePrimary}>
                <Ionicons name="wallet-outline" size={13} color={c.primary} />
              </View>
            </View>
            <NumberTicker
              value={totalSpent}
              isStealth={isStealthMode}
              prefix={currSymbol}
              decimals={0}
              style={[styles.matrixValue, { color: c.text }]}
            />
            <Text style={[styles.matrixSub, { color: c.textMuted }]}>All-time cumulative</Text>
          </AnimatedCard>

          {/* Current Month Burn */}
          <AnimatedCard style={matrixCardStyles.cardTeal} scaleTo={0.96}>
            <View style={styles.matrixTop}>
              <Text style={[styles.matrixLabel, { color: c.textMuted }]}>This Month</Text>
              <View style={matrixCardStyles.badgeTeal}>
                <Ionicons name="calendar-outline" size={13} color={c.teal} />
              </View>
            </View>
            <NumberTicker
              value={currentMonthSpent}
              isStealth={isStealthMode}
              prefix={currSymbol}
              decimals={0}
              style={[styles.matrixValue, { color: c.teal }]}
            />
            <Text style={[styles.matrixSub, { color: c.textMuted }]}>
              {currentMonthInflow > 0
                ? isStealthMode
                  ? `In: +${currSymbol}•••••• · `
                  : `In: +${currSymbol}${Math.round(currentMonthInflow).toLocaleString('en-IN')} · `
                : ''}
              Day {currentDay} of {daysInMonth}
            </Text>
          </AnimatedCard>

          {/* Daily Velocity / Burn Rate */}
          <AnimatedCard style={matrixCardStyles.cardAccent} scaleTo={0.96}>
            <View style={styles.matrixTop}>
              <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Daily Velocity</Text>
              <View style={matrixCardStyles.badgeAccent}>
                <Ionicons name="speedometer-outline" size={13} color={c.accent} />
              </View>
            </View>
            <NumberTicker
              value={dailyBurn}
              isStealth={isStealthMode}
              prefix={currSymbol}
              suffix="/d"
              decimals={0}
              style={[styles.matrixValue, { color: c.accent }]}
            />
            <Text style={[styles.matrixSub, { color: c.textMuted }]}>
              Proj:{' '}
              {isStealthMode
                ? `${currSymbol}••••••`
                : `${currSymbol}${Math.round(monthEndForecast).toLocaleString('en-IN')}`}
            </Text>
          </AnimatedCard>

          {/* Top Cost Driver */}
          <AnimatedCard style={matrixCardStyles.cardWarning} scaleTo={0.96}>
            <View style={styles.matrixTop}>
              <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Top Category</Text>
              <View style={matrixCardStyles.badgeWarning}>
                <Ionicons name="pie-chart-outline" size={13} color={c.warning} />
              </View>
            </View>
            <Text style={[styles.matrixValue, { color: c.text, fontSize: 16 }]} numberOfLines={1}>
              {highestCatName}
            </Text>
            <Text style={[styles.matrixSub, { color: c.textMuted }]}>
              {isStealthMode
                ? `${currSymbol}••••••`
                : `${currSymbol}${Math.round(highestCatAmt).toLocaleString('en-IN')}`}{' '}
              ({totalSpent > 0 ? ((highestCatAmt / totalSpent) * 100).toFixed(0) : 0}%)
            </Text>
          </AnimatedCard>
        </View>
      </StaggeredView>
    </>
  );
});
