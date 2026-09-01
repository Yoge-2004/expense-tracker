/**
 * @file InsightCards.tsx
 * @description Advanced financial intelligence and algorithmic spend analytics component.
 * Calculates 8 metrics with interactive filter tabs and a modal recommendation sheet:
 * 1. Burn Velocity & Month-End Outflow Forecast
 * 2. Discretionary Load & Potential Savings
 * 3. Weekend Surge vs Weekday Spending Habits
 * 4. Budget Governance & Financial Health Index (0-100%)
 * 5. Budget Burnout Early Warning Watch (Depletion days)
 * 6. Transaction Frequency & Average Ticket Size
 * 7. Peak Single Outflow Alert
 * 8. Fixed Recurring Overhead Ratio
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { getCurrencySymbol } from '../services/currency';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface ExpenseItem {
  id: number;
  description: string;
  amount: number;
  expenseDate: string;
  categoryId: number;
  categoryName: string;
  isRecurring?: boolean;
  recurring?: boolean;
}

export interface BudgetStatus {
  budgetId?: number;
  categoryId: number;
  categoryName: string;
  limit: number;
  spent: number;
  percentage: number;
  period?: string;
}

interface InsightCardsProps {
  /** Array of expense transactions. */
  expenses: ExpenseItem[];
  /** Array of budget limits with spent amounts. */
  budgets: BudgetStatus[];
}

interface DetailedInsightModalData {
  title: string;
  icon: any;
  color: string;
  headline: string;
  metrics: { label: string; value: string }[];
  advice: string;
}

const ESSENTIAL_CATEGORIES = [
  'groceries',
  'utilities',
  'health',
  'medical',
  'transport',
  'bills',
  'rent',
  'education',
];

/**
 * Intelligent Financial Analytics component.
 */
export const InsightCards: React.FC<InsightCardsProps> = ({ expenses, budgets }) => {
  const { theme, currency } = useAuth();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const [activeTab, setActiveTab] = useState<'all' | 'habits' | 'forecasts'>('all');
  const [selectedInsight, setSelectedInsight] = useState<DetailedInsightModalData | null>(null);

  const safeExpenses = expenses || [];
  const safeBudgets = budgets || [];

  const now = new Date();
  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  const formatAmt = (n: number) => {
    const val = isNaN(n) ? 0 : Math.round(n);
    return `${currSym}${val.toLocaleString('en-IN')}`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Burn Velocity & Projections
  // ─────────────────────────────────────────────────────────────────────────────
  const currentMonthExpenses = safeExpenses.filter((e) => {
    if (!e.expenseDate) return false;
    try {
      const d = new Date(e.expenseDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch {
      return false;
    }
  });

  const currentMonthSpent = currentMonthExpenses.reduce(
    (acc, curr) => acc + Math.max(0, Number(curr.amount || 0)),
    0
  );
  const dailyBurn = currentMonthSpent / currentDay;
  const projectedSpent = dailyBurn * daysInMonth;

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Discretionary vs Essentials
  // ─────────────────────────────────────────────────────────────────────────────
  let essentialSpent = 0;
  let discretionarySpent = 0;

  currentMonthExpenses.forEach((e) => {
    const amt = Math.max(0, Number(e.amount || 0));
    const cat = (e.categoryName || '').toLowerCase();
    if (ESSENTIAL_CATEGORIES.some((k) => cat.includes(k))) {
      essentialSpent += amt;
    } else {
      discretionarySpent += amt;
    }
  });

  const discretionaryPct =
    currentMonthSpent > 0 ? Math.round((discretionarySpent / currentMonthSpent) * 100) : 0;
  const potentialSavings = discretionarySpent * 0.15; // 15% reduction potential

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Weekend vs Weekday Surge
  // ─────────────────────────────────────────────────────────────────────────────
  let weekendSpent = 0;
  let weekendDaysCount = 0;
  let weekdaySpent = 0;
  let weekdayDaysCount = 0;

  currentMonthExpenses.forEach((e) => {
    if (!e.expenseDate) return;
    const day = new Date(e.expenseDate).getDay();
    const amt = Math.max(0, Number(e.amount || 0));
    if (day === 0 || day === 6) {
      weekendSpent += amt;
      weekendDaysCount++;
    } else {
      weekdaySpent += amt;
      weekdayDaysCount++;
    }
  });

  const avgWeekendTx = weekendDaysCount > 0 ? weekendSpent / weekendDaysCount : 0;
  const avgWeekdayTx = weekdayDaysCount > 0 ? weekdaySpent / weekdayDaysCount : 0;
  const weekendMultiplier =
    avgWeekdayTx > 0 ? (avgWeekendTx / avgWeekdayTx).toFixed(1) : '1.0';

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Budget Governance Score (0 - 100%)
  // ─────────────────────────────────────────────────────────────────────────────
  let governanceScore = 100;
  let breachedBudgetsCount = 0;
  let warningBudgetsCount = 0;

  if (safeBudgets.length > 0) {
    safeBudgets.forEach((b) => {
      const limit = Math.max(1, Number(b.limit || 0));
      const spent = Math.max(0, Number(b.spent || 0));
      const pct = (spent / limit) * 100;
      if (pct >= 100) {
        breachedBudgetsCount++;
        governanceScore -= 25;
      } else if (pct >= 80) {
        warningBudgetsCount++;
        governanceScore -= 10;
      }
    });
    governanceScore = Math.max(0, Math.min(100, governanceScore));
  } else {
    governanceScore = 85; // Baseline when no budgets are defined
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Category Burnout Watch (First category to breach limit)
  // ─────────────────────────────────────────────────────────────────────────────
  interface BurnoutCandidate {
    categoryName: string;
    spent: number;
    limit: number;
    daysRemainingUntilDepletion: number;
    dailyCategoryRate: number;
  }

  let earliestBurnout: BurnoutCandidate | null = null;

  safeBudgets.forEach((b) => {
    const limit = Math.max(1, Number(b.limit || 0));
    const spent = Math.max(0, Number(b.spent || 0));
    const remaining = limit - spent;
    const catExpenses = currentMonthExpenses.filter(
      (e) => e.categoryId === b.categoryId || e.categoryName === b.categoryName
    );
    const catSpent = catExpenses.reduce((s, e) => s + Math.max(0, Number(e.amount || 0)), 0);
    const dailyRate = catSpent / currentDay;

    if (remaining > 0 && dailyRate > 0) {
      const daysToExhaust = Math.round(remaining / dailyRate);
      if (!earliestBurnout || daysToExhaust < earliestBurnout.daysRemainingUntilDepletion) {
        earliestBurnout = {
          categoryName: b.categoryName,
          spent,
          limit,
          daysRemainingUntilDepletion: daysToExhaust,
          dailyCategoryRate: dailyRate,
        };
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Frequency & Average Ticket Size
  // ─────────────────────────────────────────────────────────────────────────────
  const txCount = currentMonthExpenses.length;
  const avgTicketSize = txCount > 0 ? currentMonthSpent / txCount : 0;
  const txPerDay = (txCount / currentDay).toFixed(1);

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Peak Single Expense Outlier
  // ─────────────────────────────────────────────────────────────────────────────
  let peakExpense: ExpenseItem | null = null;
  currentMonthExpenses.forEach((e) => {
    const amt = Number(e.amount || 0);
    if (!peakExpense || amt > Number(peakExpense.amount || 0)) {
      peakExpense = e;
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Recurring Subscriptions Overhead Ratio
  // ─────────────────────────────────────────────────────────────────────────────
  const recurringTotal = currentMonthExpenses
    .filter((e) => e.isRecurring || e.recurring)
    .reduce((s, e) => s + Math.max(0, Number(e.amount || 0)), 0);
  const recurringRatio =
    currentMonthSpent > 0 ? Math.round((recurringTotal / currentMonthSpent) * 100) : 0;

  const openDetail = (data: DetailedInsightModalData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedInsight(data);
  };

  const burnout = earliestBurnout as BurnoutCandidate | null;
  const peak = peakExpense as ExpenseItem | null;

  return (
    <View style={styles.container}>
      {/* Scope Filter Tabs */}
      <View style={[styles.filterBar, { backgroundColor: c.card, borderColor: c.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab('all')}
          style={[
            styles.filterTab,
            activeTab === 'all' && { backgroundColor: c.primary },
          ]}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeTab === 'all' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
            ]}
          >
            All Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('habits')}
          style={[
            styles.filterTab,
            activeTab === 'habits' && { backgroundColor: c.primary },
          ]}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeTab === 'habits' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
            ]}
          >
            Habits & Savings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('forecasts')}
          style={[
            styles.filterTab,
            activeTab === 'forecasts' && { backgroundColor: c.primary },
          ]}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeTab === 'forecasts' ? (theme === 'light' ? '#FFF' : '#10120E') : c.textMuted },
            ]}
          >
            Alerts & Forecast
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cards Grid */}
      <View style={styles.grid}>
        {/* CARD 1: Burn Velocity & Projection */}
        {(activeTab === 'all' || activeTab === 'forecasts') && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Burn Velocity & Forecast',
                icon: 'speedometer-outline',
                color: c.primary,
                headline: `Your projected month-end outflow is ${formatAmt(projectedSpent)}.`,
                metrics: [
                  { label: 'Current Outflow', value: formatAmt(currentMonthSpent) },
                  { label: 'Daily Outflow Rate', value: `${formatAmt(dailyBurn)}/day` },
                  { label: 'Days Remaining in Month', value: `${daysRemaining} days` },
                  { label: 'Projected Total', value: formatAmt(projectedSpent) },
                ],
                advice:
                  dailyBurn > 0
                    ? `To reduce your month-end projection by 10%, target an average daily spend of ${formatAmt(dailyBurn * 0.9)}.`
                    : 'Maintain regular tracking to refine projection accuracy.',
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="speedometer-outline" size={18} color={c.primary} />
              </View>
              <Text style={[styles.cardTag, { color: c.primary }]}>Forecast</Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Burn Velocity</Text>
            <Text style={[styles.cardPrimaryVal, { color: c.text }]}>{formatAmt(dailyBurn)}/day</Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]}>
              Est. Month Total: <Text style={{ color: c.primary, fontWeight: '700' }}>{formatAmt(projectedSpent)}</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* CARD 2: Discretionary Load & Savings */}
        {(activeTab === 'all' || activeTab === 'habits') && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Discretionary Load & Savings',
                icon: 'wallet-outline',
                color: c.teal,
                headline: `${discretionaryPct}% of your spend was allocated to non-essential lifestyle categories.`,
                metrics: [
                  { label: 'Essential Spend', value: formatAmt(essentialSpent) },
                  { label: 'Discretionary Spend', value: formatAmt(discretionarySpent) },
                  { label: 'Discretionary Ratio', value: `${discretionaryPct}%` },
                  { label: 'Potential 15% Cut', value: formatAmt(potentialSavings) },
                ],
                advice: `Trimming just 15% from non-essential spending could retain ${formatAmt(potentialSavings)} in monthly savings.`,
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.teal + '18' }]}>
                <Ionicons name="wallet-outline" size={18} color={c.teal} />
              </View>
              <Text style={[styles.cardTag, { color: c.teal }]}>Savings</Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Discretionary Load</Text>
            <Text style={[styles.cardPrimaryVal, { color: c.text }]}>{discretionaryPct}%</Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]}>
              Trim 15% to save: <Text style={{ color: c.teal, fontWeight: '700' }}>+{formatAmt(potentialSavings)}</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* CARD 3: Weekend Multiplier */}
        {(activeTab === 'all' || activeTab === 'habits') && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Weekend vs Weekday Spend',
                icon: 'calendar-outline',
                color: c.accent,
                headline: `Weekend spending averages ${weekendMultiplier}x higher per day than weekdays.`,
                metrics: [
                  { label: 'Weekend Daily Average', value: formatAmt(avgWeekendTx) },
                  { label: 'Weekday Daily Average', value: formatAmt(avgWeekdayTx) },
                  { label: 'Weekend Multiplier', value: `${weekendMultiplier}x` },
                ],
                advice:
                  Number(weekendMultiplier) > 1.5
                    ? 'Weekend activities drive significant cash outflow. Pre-allocating weekend allowances can help stabilize your balance.'
                    : 'Your weekend spending is well-balanced with weekday habits.',
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.accent + '18' }]}>
                <Ionicons name="calendar-outline" size={18} color={c.accent} />
              </View>
              <Text style={[styles.cardTag, { color: c.accent }]}>Habits</Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Weekend Multiplier</Text>
            <Text style={[styles.cardPrimaryVal, { color: c.text }]}>{weekendMultiplier}x</Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]}>
              Avg Weekend: <Text style={{ color: c.accent, fontWeight: '700' }}>{formatAmt(avgWeekendTx)}/day</Text>
            </Text>
          </TouchableOpacity>
        )}

        {/* CARD 4: Budget Governance Score */}
        {(activeTab === 'all' || activeTab === 'forecasts') && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Budget Health Score',
                icon: 'shield-checkmark-outline',
                color: governanceScore >= 80 ? c.success : governanceScore >= 60 ? c.warning : c.accent,
                headline: `Financial Governance Index: ${governanceScore}/100`,
                metrics: [
                  { label: 'Overall Health Index', value: `${governanceScore}%` },
                  { label: 'Breached Category Caps', value: `${breachedBudgetsCount}` },
                  { label: 'Warning Caps (≥80%)', value: `${warningBudgetsCount}` },
                  { label: 'Total Monitored Categories', value: `${safeBudgets.length}` },
                ],
                advice:
                  breachedBudgetsCount > 0
                    ? `You have ${breachedBudgetsCount} category limit(s) exceeded. Review spending under breached caps immediately.`
                    : 'All budgets are within healthy operational thresholds.',
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor:
                      (governanceScore >= 80 ? c.success : governanceScore >= 60 ? c.warning : c.accent) + '18',
                  },
                ]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={governanceScore >= 80 ? c.success : governanceScore >= 60 ? c.warning : c.accent}
                />
              </View>
              <Text
                style={[
                  styles.cardTag,
                  {
                    color: governanceScore >= 80 ? c.success : governanceScore >= 60 ? c.warning : c.accent,
                  },
                ]}
              >
                Health
              </Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Budget Governance</Text>
            <Text
              style={[
                styles.cardPrimaryVal,
                {
                  color: governanceScore >= 80 ? c.success : governanceScore >= 60 ? c.warning : c.accent,
                },
              ]}
            >
              {governanceScore}%
            </Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]}>
              {breachedBudgetsCount > 0
                ? `${breachedBudgetsCount} limits breached`
                : warningBudgetsCount > 0
                ? `${warningBudgetsCount} near limit`
                : '100% on track'}
            </Text>
          </TouchableOpacity>
        )}

        {/* CARD 5: Category Depletion Early Warning */}
        {(activeTab === 'all' || activeTab === 'forecasts') && burnout && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Burnout Early Warning',
                icon: 'flame-outline',
                color: c.accent,
                headline: `"${burnout.categoryName}" is on pace to deplete its budget in ${burnout.daysRemainingUntilDepletion} days.`,
                metrics: [
                  { label: 'At Risk Category', value: burnout.categoryName },
                  { label: 'Category Outflow Rate', value: `${formatAmt(burnout.dailyCategoryRate)}/day` },
                  { label: 'Remaining Budget', value: formatAmt(burnout.limit - burnout.spent) },
                  { label: 'Estimated Depletion In', value: `${burnout.daysRemainingUntilDepletion} days` },
                ],
                advice: `At your current velocity, this category will breach its cap before the month ends. Slow down daily transactions in this category to stay under budget.`,
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.accent + '18' }]}>
                <Ionicons name="flame-outline" size={18} color={c.accent} />
              </View>
              <Text style={[styles.cardTag, { color: c.accent }]}>Early Warning</Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Cap Depletion</Text>
            <Text style={[styles.cardPrimaryVal, { color: c.accent }]}>
              {burnout.daysRemainingUntilDepletion}d left
            </Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]} numberOfLines={1}>
              {burnout.categoryName} cap at risk
            </Text>
          </TouchableOpacity>
        )}

        {/* CARD 6: Average Ticket Size & Velocity */}
        {(activeTab === 'all' || activeTab === 'habits') && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Average Ticket & Velocity',
                icon: 'pricetag-outline',
                color: c.primary,
                headline: `You average ${formatAmt(avgTicketSize)} per transaction across ${txCount} orders.`,
                metrics: [
                  { label: 'Average Ticket Size', value: formatAmt(avgTicketSize) },
                  { label: 'Monthly Transactions', value: `${txCount} txs` },
                  { label: 'Purchase Cadence', value: `${txPerDay} txs/day` },
                ],
                advice:
                  'Consolidating smaller purchases into planned shopping intervals helps reduce impulse spend.',
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.primary + '18' }]}>
                <Ionicons name="pricetag-outline" size={18} color={c.primary} />
              </View>
              <Text style={[styles.cardTag, { color: c.primary }]}>Velocity</Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Avg Ticket Size</Text>
            <Text style={[styles.cardPrimaryVal, { color: c.text }]}>{formatAmt(avgTicketSize)}</Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]}>
              {txPerDay} transactions/day
            </Text>
          </TouchableOpacity>
        )}

        {/* CARD 7: Peak Outlier Transaction */}
        {(activeTab === 'all' || activeTab === 'forecasts') && peak && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Peak Expense Outlier',
                icon: 'trending-up-outline',
                color: c.warning,
                headline: `Largest single outflow this month: ${formatAmt(peak.amount)} (${peak.description}).`,
                metrics: [
                  { label: 'Peak Amount', value: formatAmt(peak.amount) },
                  { label: 'Category', value: peak.categoryName || 'General' },
                  { label: 'Date', value: peak.expenseDate || '-' },
                  {
                    label: 'Share of Monthly Spend',
                    value:
                      currentMonthSpent > 0
                        ? `${Math.round((Number(peak.amount || 0) / currentMonthSpent) * 100)}%`
                        : '0%',
                  },
                ],
                advice:
                  'Large isolated expenses disproportionately impact monthly runway. Plan and set sinking funds for upcoming big purchases.',
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.warning + '18' }]}>
                <Ionicons name="trending-up-outline" size={18} color={c.warning} />
              </View>
              <Text style={[styles.cardTag, { color: c.warning }]}>Outlier</Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Peak Outflow</Text>
            <Text style={[styles.cardPrimaryVal, { color: c.warning }]}>
              {formatAmt(peak.amount)}
            </Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]} numberOfLines={1}>
              {peak.description || 'Transaction'}
            </Text>
          </TouchableOpacity>
        )}

        {/* CARD 8: Recurring Subscriptions Overhead */}
        {(activeTab === 'all' || activeTab === 'habits') && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() =>
              openDetail({
                title: 'Recurring Fixed Load',
                icon: 'repeat-outline',
                color: c.teal,
                headline: `Fixed subscriptions account for ${recurringRatio}% (${formatAmt(recurringTotal)}) of your monthly spend.`,
                metrics: [
                  { label: 'Total Recurring Load', value: formatAmt(recurringTotal) },
                  { label: 'Overhead Percentage', value: `${recurringRatio}%` },
                  { label: 'Discretionary Cashflow Left', value: formatAmt(currentMonthSpent - recurringTotal) },
                ],
                advice:
                  recurringRatio > 30
                    ? 'Recurring commitments exceed 30% of total outflow. Review and audit dormant memberships in Subscriptions.'
                    : 'Fixed subscription load is kept low and manageable.',
              })
            }
            style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: c.teal + '18' }]}>
                <Ionicons name="repeat-outline" size={18} color={c.teal} />
              </View>
              <Text style={[styles.cardTag, { color: c.teal }]}>Fixed Load</Text>
            </View>
            <Text style={[styles.cardTitle, { color: c.text }]}>Subscriptions Load</Text>
            <Text style={[styles.cardPrimaryVal, { color: c.text }]}>{recurringRatio}%</Text>
            <Text style={[styles.cardSubText, { color: c.textMuted }]}>
              {formatAmt(recurringTotal)} monthly commitment
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* DETAIL MODAL SHEET */}
      {selectedInsight && (
        <Modal
          visible={!!selectedInsight}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedInsight(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: selectedInsight.color + '20', width: 38, height: 38 },
                    ]}
                  >
                    <Ionicons
                      name={selectedInsight.icon}
                      size={20}
                      color={selectedInsight.color}
                    />
                  </View>
                  <Text style={[styles.modalTitle, { color: c.text }]}>
                    {selectedInsight.title}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedInsight(null)}
                  style={[styles.closeModalBtn, { backgroundColor: c.inputBg }]}
                >
                  <Ionicons name="close" size={18} color={c.text} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <Text style={[styles.modalHeadline, { color: c.text }]}>
                  {selectedInsight.headline}
                </Text>

                {/* Metrics Breakdown */}
                <View style={[styles.metricsTable, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                  {selectedInsight.metrics.map((m, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.metricRow,
                        idx !== selectedInsight.metrics.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.metricLabel, { color: c.textMuted }]}>{m.label}</Text>
                      <Text style={[styles.metricValue, { color: c.text }]}>{m.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Strategic Financial Recommendation */}
                <View
                  style={[
                    styles.adviceBox,
                    {
                      backgroundColor: selectedInsight.color + '15',
                      borderColor: selectedInsight.color + '35',
                    },
                  ]}
                >
                  <View style={styles.adviceTitleRow}>
                    <Ionicons name="bulb-outline" size={16} color={selectedInsight.color} />
                    <Text style={[styles.adviceTitle, { color: selectedInsight.color }]}>
                      Strategic Financial Recommendation
                    </Text>
                  </View>
                  <Text style={[styles.adviceBody, { color: c.text }]}>
                    {selectedInsight.advice}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  filterBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
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
    marginBottom: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardPrimaryVal: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  cardSubText: {
    fontSize: 10.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    marginBottom: 10,
  },
  modalHeadline: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 18,
  },
  metricsTable: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 18,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  metricLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  adviceBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  adviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adviceTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adviceBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
});
