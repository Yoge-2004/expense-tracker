import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
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
  isLargeScreen,
  matrixCardWidth,
  monthlyNet,
  monthlyInflow,
  monthlyOutflow,
  allTimeNet,
  totalIncome,
  totalSpent,
  safeDailySpend,
  noSpendStreak,
  currentDay,
  daysInMonth,
  dailyBurn,
  monthEndForecast,
  highestCatName,
  highestCatAmt,
}: DashboardMetricsMatrixProps) {
  const matrixCardStyles = useMemo(
    () => ({
      cardSuccess: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.success}40` }],
      badgeSuccess: [styles.matrixBadge, { backgroundColor: `${c.success}18` }],
      cardAccent: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.accent}40` }],
      badgeAccent: [styles.matrixBadge, { backgroundColor: `${c.accent}18` }],
      cardPrimary: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.primary}40` }],
      badgePrimary: [styles.matrixBadge, { backgroundColor: `${c.primary}18` }],
      cardWarning: [styles.matrixCard, { width: matrixCardWidth as any, backgroundColor: c.card, borderColor: `${c.warning}40` }],
      badgeWarning: [styles.matrixBadge, { backgroundColor: `${c.warning}18` }],
    }),
    [matrixCardWidth, c.card, c.success, c.accent, c.primary, c.warning]
  );

  return (
    <>
      {/* 1. EXECUTIVE MONTHLY CASH FLOW OVERVIEW */}
      <StaggeredView delay={40} direction="up">
        <AnimatedCard style={[styles.cashFlowCard, { backgroundColor: c.card, borderColor: c.border }]} scaleTo={0.98}>
          <View style={styles.cashFlowHeader}>
            <View style={styles.cashFlowHeaderLeft}>
              <Ionicons name="trending-up" size={16} color={c.primary} />
              <Text style={[styles.cashFlowTitle, { color: c.text }]}>Monthly Cash Flow</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: monthlyNet >= 0 ? c.success + '20' : c.danger + '20' }]}>
              <Text style={[styles.statusPillText, { color: monthlyNet >= 0 ? c.success : c.danger }]}>
                {monthlyNet >= 0 ? 'Surplus' : 'Deficit'}
              </Text>
            </View>
          </View>

          <View style={styles.cashFlowMetricsRow}>
            {/* Monthly Inflow */}
            <View style={styles.cashFlowCol}>
              <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Monthly Inflow</Text>
              <Text style={[styles.cashFlowAmount, { color: c.success }]} numberOfLines={1}>
                {isStealthMode ? `${currSymbol}••••••` : `+${currSymbol}${Math.round(monthlyInflow).toLocaleString('en-IN')}`}
              </Text>
            </View>

            <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

            {/* Monthly Outflow */}
            <View style={styles.cashFlowCol}>
              <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Monthly Outflow</Text>
              <Text style={[styles.cashFlowAmount, { color: c.accent }]} numberOfLines={1}>
                {isStealthMode ? `${currSymbol}••••••` : `-${currSymbol}${Math.round(monthlyOutflow).toLocaleString('en-IN')}`}
              </Text>
            </View>

            <View style={[styles.cashFlowDivider, { backgroundColor: c.border }]} />

            {/* Monthly Net */}
            <View style={styles.cashFlowCol}>
              <Text style={[styles.cashFlowLabel, { color: c.textMuted }]}>Net Position</Text>
              <Text
                style={[
                  styles.cashFlowAmount,
                  { color: monthlyNet >= 0 ? c.success : c.danger },
                ]}
                numberOfLines={1}
              >
                {isStealthMode
                  ? `${currSymbol}••••••`
                  : `${monthlyNet >= 0 ? '+' : ''}${currSymbol}${Math.round(monthlyNet).toLocaleString('en-IN')}`}
              </Text>
            </View>
          </View>

          {/* Clean Separation Divider */}
          <View style={[styles.cashFlowHorizontalDivider, { backgroundColor: c.border }]} />

          {/* Micro Pro Metrics Row */}
          <View style={styles.proMetricsRow}>
            {/* Safe Daily Spend */}
            <View style={[styles.proMetricBadge, { backgroundColor: c.card, borderColor: safeDailySpend > 0 ? c.success + '50' : c.danger + '50' }]}>
              <View style={[styles.proMetricIconCircle, { backgroundColor: safeDailySpend > 0 ? c.success + '20' : c.danger + '20' }]}>
                <Ionicons name="shield-checkmark" size={13} color={safeDailySpend > 0 ? c.success : c.danger} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>Safe to Spend</Text>
                <Text style={[styles.proMetricVal, { color: safeDailySpend > 0 ? c.success : c.danger }]} numberOfLines={1}>
                  {isStealthMode ? currSymbol + '••••••' : currSymbol + Math.round(safeDailySpend).toLocaleString('en-IN')}
                  <Text style={{ fontSize: 10, color: c.textMuted }}> /d</Text>
                </Text>
              </View>
            </View>

            {/* Daily Velocity */}
            <View style={[styles.proMetricBadge, { backgroundColor: c.card, borderColor: c.teal + '50' }]}>
              <View style={[styles.proMetricIconCircle, { backgroundColor: c.teal + '20' }]}>
                <Ionicons name="speedometer" size={13} color={c.teal} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>Daily Burn</Text>
                <Text style={[styles.proMetricVal, { color: c.teal }]} numberOfLines={1}>
                  {isStealthMode ? currSymbol + '••••••' : currSymbol + Math.round(dailyBurn).toLocaleString('en-IN')}
                  <Text style={{ fontSize: 10, color: c.textMuted }}> /d</Text>
                </Text>
              </View>
            </View>

            {/* No-Spend Streak */}
            <View style={[styles.proMetricBadge, { backgroundColor: c.card, borderColor: c.warning + '50' }]}>
              <View style={[styles.proMetricIconCircle, { backgroundColor: c.warning + '20' }]}>
                <Ionicons name="flame" size={13} color={c.warning} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.proMetricLabel, { color: c.textMuted }]}>Streak</Text>
                <Text style={[styles.proMetricVal, { color: c.warning }]} numberOfLines={1}>
                  {noSpendStreak}{' '}
                  <Text style={{ fontSize: 10, fontWeight: '600', color: c.textMuted }}>
                    {'d' + (noSpendStreak === 1 ? '' : 's')}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </AnimatedCard>
      </StaggeredView>

      {/* 2. BALANCED FOUR-METRIC MATRIX KPI GRID (ALL-TIME STANDING) */}
      <StaggeredView delay={100} direction="up">
        <View style={[styles.matrixGrid, { gap: isLargeScreen ? 12 : 10 }]}>
          {/* 1. Total Inflow (All-time) */}
          <AnimatedCard style={matrixCardStyles.cardSuccess} scaleTo={0.96}>
            <View style={styles.matrixTop}>
              <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Total Inflow</Text>
              <View style={matrixCardStyles.badgeSuccess}>
                <Ionicons name="arrow-down-circle-outline" size={13} color={c.success} />
              </View>
            </View>
            <NumberTicker
              value={totalIncome}
              isStealth={isStealthMode}
              prefix={currSymbol}
              decimals={0}
              style={[styles.matrixValue, { color: c.success }]}
            />
            <Text style={[styles.matrixSub, { color: c.textMuted }]}>All-time earnings</Text>
          </AnimatedCard>

          {/* 2. Total Outflow (All-time) */}
          <AnimatedCard style={matrixCardStyles.cardAccent} scaleTo={0.96}>
            <View style={styles.matrixTop}>
              <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Total Outflow</Text>
              <View style={matrixCardStyles.badgeAccent}>
                <Ionicons name="arrow-up-circle-outline" size={13} color={c.accent} />
              </View>
            </View>
            <NumberTicker
              value={totalSpent}
              isStealth={isStealthMode}
              prefix={currSymbol}
              decimals={0}
              style={[styles.matrixValue, { color: c.text }]}
            />
            <Text style={[styles.matrixSub, { color: c.textMuted }]}>All-time expenses</Text>
          </AnimatedCard>

          {/* 3. Net Balance (All-time) */}
          <AnimatedCard style={matrixCardStyles.cardPrimary} scaleTo={0.96}>
            <View style={styles.matrixTop}>
              <Text style={[styles.matrixLabel, { color: c.textMuted }]}>Net Balance</Text>
              <View style={matrixCardStyles.badgePrimary}>
                <Ionicons name="wallet-outline" size={13} color={c.primary} />
              </View>
            </View>
            <NumberTicker
              value={allTimeNet}
              isStealth={isStealthMode}
              prefix={currSymbol}
              decimals={0}
              style={[styles.matrixValue, { color: allTimeNet >= 0 ? c.primary : c.danger }]}
            />
            <Text style={[styles.matrixSub, { color: c.textMuted }]}>
              {allTimeNet >= 0 ? 'Cumulative surplus' : 'Cumulative deficit'}
            </Text>
          </AnimatedCard>

          {/* 4. Top Category */}
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
