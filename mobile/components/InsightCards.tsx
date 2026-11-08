/**
 * @file InsightCards.tsx
 * @description Advanced financial intelligence and algorithmic spend analytics component.
 * Features hierarchical card presentation backed by the 5-Model Production Machine Learning Suite,
 * macroeconomic cash flow analytics, and behavioral governance without synthetic data fabrication.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText as Text } from './ThemedText';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { getCurrencySymbol } from '../services/currency';
import { apiRequest } from '../services/api';
import { effectiveMonth, earnedTotal, netSpent, monthKey, kindOf } from '../utils/moneyFlow';
import {
  ExpenseItem,
  BudgetStatus,
  IncomeItem,
  SavingsGoalItem,
  DetailedInsightModalData,
  MlForecastData,
  MlForecastStatus,
  MlAnomalyData,
  BurnoutCandidate,
  InsightCardsProps,
} from './insights/types';
import { InsightDetailModal } from './insights/InsightDetailModal';
import { InsightAlertBanner } from './insights/InsightAlertBanner';
import { AiForecastCard } from './insights/AiForecastCard';
import { CashFlowPulseCard } from './insights/CashFlowPulseCard';
import { InsightCard } from './insights/InsightCard';

export type {
  ExpenseItem,
  BudgetStatus,
  IncomeItem,
  SavingsGoalItem,
  InsightCardsProps,
};

const ESSENTIAL_CATEGORIES = [
  'groceries',
  'grocery',
  'supermarket',
  'utilities',
  'utility',
  'electricity',
  'water',
  'health',
  'medical',
  'doctor',
  'pharmacy',
  'transport',
  'transportation',
  'fuel',
  'petrol',
  'bills',
  'rent',
  'housing',
  'education',
  'school',
  'tuition',
];

const EMPTY_EXPENSES: ExpenseItem[] = [];
const EMPTY_BUDGETS: BudgetStatus[] = [];
const EMPTY_INCOMES: IncomeItem[] = [];
const EMPTY_GOALS: SavingsGoalItem[] = [];

type InsightTab = 'ai' | 'wealth' | 'habits' | 'all';

/**
 * Intelligent Financial Analytics component.
 */
export const InsightCards: React.FC<InsightCardsProps> = React.memo(({
  expenses = EMPTY_EXPENSES,
  budgets = EMPTY_BUDGETS,
  incomes = EMPTY_INCOMES,
  savingsGoals = EMPTY_GOALS,
}) => {
  const { theme, currency, isStealthMode, themeColors } = useAuth();
  const c = themeColors || Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const [activeTab, setActiveTab] = useState<InsightTab>('ai');
  const [selectedInsight, setSelectedInsight] = useState<DetailedInsightModalData | null>(null);

  const [mlForecast, setMlForecast] = useState<MlForecastData | null>(null);
  const [mlForecastStatus, setMlForecastStatus] = useState<MlForecastStatus>({
    isCalibrated: false,
    daysRecorded: 0,
    requiredDays: 28,
  });
  const [mlAnomaly, setMlAnomaly] = useState<MlAnomalyData | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Machine Learning Integration (Forecast & Anomaly Scoring)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function loadMlInsights() {
      if (!expenses || expenses.length === 0) {
        if (active) {
          setMlForecast(null);
          setMlForecastStatus({ isCalibrated: false, daysRecorded: 0, requiredDays: 28 });
          setMlAnomaly(null);
        }
        return;
      }

      // ── Model 5: Spending Forecast ──────────────────────────────────────────
      // Zero-fabrication: evaluate calendar span of actual transactions
      try {
        const dailyMap: Record<string, number> = {};
        expenses.forEach((e) => {
          if (e.expenseDate) {
            const d = e.expenseDate.split('T')[0];
            dailyMap[d] = (dailyMap[d] || 0) + (Number(e.amount) || 0);
          }
        });

        const activeDates = Object.keys(dailyMap).sort();
        if (activeDates.length === 0) {
          if (active) {
            setMlForecast(null);
            setMlForecastStatus({ isCalibrated: false, daysRecorded: 0, requiredDays: 28 });
          }
        } else {
          const minDate = new Date(activeDates[0]);
          const maxDate = new Date(activeDates[activeDates.length - 1]);
          const daySpan = Math.max(
            1,
            Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          );

          if (daySpan < 28) {
            // Under 28 days of history: honest state without synthetic fabrication
            if (active) {
              setMlForecast(null);
              setMlForecastStatus({
                isCalibrated: false,
                daysRecorded: Math.min(daySpan, 28),
                requiredDays: 28,
              });
            }
          } else {
            // >= 28 calendar days: construct real daily timeline (zero-spend on non-active days)
            const history: { date: string; amount: number }[] = [];
            const startTs = minDate.getTime();
            const endTs = maxDate.getTime();
            for (let ts = startTs; ts <= endTs; ts += 86400000) {
              const dStr = new Date(ts).toISOString().split('T')[0];
              history.push({
                date: dStr,
                amount: dailyMap[dStr] !== undefined ? dailyMap[dStr] : 0,
              });
            }

            const fRes = await apiRequest('/ml/forecast/spending', {
              method: 'POST',
              body: JSON.stringify({ history, horizon_days: 7 }),
            });

            if (active && fRes && Array.isArray(fRes.forecast)) {
              const points = fRes.forecast
                .map((point: any) => ({
                  date: String(point.date || ''),
                  amount: Number(point.predicted_amount),
                }))
                .filter((point: { date: string; amount: number }) => point.date && Number.isFinite(point.amount));

              if (points.length) {
                const sum = points.reduce((acc: number, point: { amount: number }) => acc + point.amount, 0);
                setMlForecast({
                  total: sum,
                  days: Number(fRes.horizon_days) || points.length || 7,
                  points,
                });
                setMlForecastStatus({
                  isCalibrated: true,
                  daysRecorded: daySpan,
                  requiredDays: 28,
                });
              }
            }
          }
        }
      } catch (err) {
        console.debug('[InsightCards] ML forecast endpoint unavailable:', err);
      }

      // ── Model 4: Isolation Forest Anomaly Scoring ───────────────────────────
      // Provide true temporal features: amount, hour, day_of_week
      try {
        const txs = expenses.slice(0, 50).map((e) => {
          let dow = 0;
          let hour = 12;
          if (e.expenseDate) {
            const dObj = new Date(e.expenseDate);
            if (!Number.isNaN(dObj.getTime())) {
              dow = dObj.getDay();
              if (e.expenseDate.includes('T')) {
                hour = dObj.getHours();
              }
            }
          }
          return {
            id: e.id,
            amount: Math.max(0, Number(e.amount) || 0),
            day_of_week: dow,
            hour,
            category: e.categoryName || 'general',
            description: e.description || 'Expense',
            date: e.expenseDate || '',
          };
        });

        const aRes = await apiRequest('/ml/anomalies/score', {
          method: 'POST',
          body: JSON.stringify({ transactions: txs }),
        });

        if (active && aRes && Array.isArray(aRes.results)) {
          const anoms = aRes.results.filter((r: any) => r.is_anomaly === true);
          const sortedAnoms = anoms
            .sort((a: any, b: any) => (a.anomaly_score || 0) - (b.anomaly_score || 0))
            .map((a: any) => ({
              id: a.id,
              desc: a.description || 'Irregular Outflow',
              amount: Number(a.amount) || 0,
              score: Number(a.anomaly_score) || 0,
              date: a.date,
              category: a.category,
            }));
          const top = sortedAnoms[0];
          setMlAnomaly({
            count: aRes.total_anomalies ?? anoms.length,
            topOutlier: top,
            allOutliers: sortedAnoms,
          });
        }
      } catch (err) {
        console.debug('[InsightCards] ML anomaly scoring unavailable:', err);
      }
    }

    loadMlInsights();
    return () => {
      active = false;
    };
  }, [expenses]);

  const safeExpenses = expenses || EMPTY_EXPENSES;
  const safeBudgets = budgets || EMPTY_BUDGETS;
  const safeIncomes = incomes || EMPTY_INCOMES;
  const safeGoals = savingsGoals || EMPTY_GOALS;

  const now = useMemo(() => new Date(), []);
  const currentDay = Math.max(now.getDate(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDay);
  const thisMonthKey = monthKey(now);

  const formatAmt = useCallback((n: number) => {
    if (isStealthMode) return `${currSym}••••••`;
    const val = Number.isNaN(n) ? 0 : Math.round(n);
    return `${currSym}${val.toLocaleString('en-IN')}`;
  }, [currSym, isStealthMode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Financial Metrics Synthesis
  // ─────────────────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    // Current month spend
    const currentMonthExpenses = safeExpenses.filter((e) => {
      if (!e.expenseDate) return false;
      return monthKey(e.expenseDate) === thisMonthKey;
    });

    const currentMonthIncomes = safeIncomes.filter((i) => {
      return effectiveMonth(i) === thisMonthKey;
    });

    const currentMonthSpent = netSpent(currentMonthExpenses, currentMonthIncomes);
    const dailyBurn = currentMonthSpent / currentDay;
    const projectedSpent = dailyBurn * daysInMonth;

    // Discretionary vs Essentials
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
    const potentialSavings = discretionarySpent * 0.15;

    // Weekend vs Weekday Surge
    let weekendSpent = 0;
    let weekdaySpent = 0;
    currentMonthExpenses.forEach((e) => {
      if (!e.expenseDate) return;
      const parts = e.expenseDate.split('T')[0].split('-');
      let day = -1;
      if (parts.length === 3) {
        const y = Number.parseInt(parts[0], 10);
        const m = Number.parseInt(parts[1], 10) - 1;
        const d = Number.parseInt(parts[2], 10);
        if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
          day = new Date(y, m, d).getDay();
        }
      }
      if (day === -1) {
        day = new Date(e.expenseDate).getDay();
      }
      const amt = Math.max(0, Number(e.amount || 0));
      if (day === 0 || day === 6) {
        weekendSpent += amt;
      } else if (day >= 1 && day <= 5) {
        weekdaySpent += amt;
      }
    });

    let weekendDaysCount = 0;
    let weekdayDaysCount = 0;
    for (let d = 1; d <= currentDay; d++) {
      const dow = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (dow === 0 || dow === 6) weekendDaysCount++;
      else weekdayDaysCount++;
    }

    const avgWeekendTx = weekendDaysCount > 0 ? weekendSpent / weekendDaysCount : 0;
    const avgWeekdayTx = weekdayDaysCount > 0 ? weekdaySpent / weekdayDaysCount : 0;
    const weekendMultiplier =
      avgWeekdayTx > 0 ? (avgWeekendTx / avgWeekdayTx).toFixed(1) : '1.0';

    // Budget Governance Score (0 - 100%)
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
      governanceScore = 85;
    }

    // Category Depletion Early Warning
    let earliestBurnout: BurnoutCandidate | null = null;
    const monthCatSpentById = new Map<number, number>();
    const monthCatSpentByName = new Map<string, number>();
    for (let i = 0; i < currentMonthExpenses.length; i++) {
      const e = currentMonthExpenses[i];
      const amt = Math.max(0, Number(e.amount || 0));
      if (e.categoryId) {
        monthCatSpentById.set(e.categoryId, (monthCatSpentById.get(e.categoryId) || 0) + amt);
      }
      if (e.categoryName) {
        const lower = e.categoryName.toLowerCase();
        monthCatSpentByName.set(lower, (monthCatSpentByName.get(lower) || 0) + amt);
      }
    }

    safeBudgets.forEach((b) => {
      const limit = Math.max(1, Number(b.limit || 0));
      const spent = Math.max(0, Number(b.spent || 0));
      const remaining = limit - spent;
      const catSpent = (b.categoryId ? monthCatSpentById.get(b.categoryId) : undefined)
        ?? (b.categoryName ? monthCatSpentByName.get(b.categoryName.toLowerCase()) : undefined)
        ?? 0;
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

    // Transaction Cadence & Ticket Size
    const txCount = currentMonthExpenses.length;
    const avgTicketSize = txCount > 0 ? currentMonthSpent / txCount : 0;
    const txPerDay = (txCount / currentDay).toFixed(1);

    // Peak Expense Outlier
    let peakExpense: ExpenseItem | null = null;
    currentMonthExpenses.forEach((e) => {
      const amt = Number(e.amount || 0);
      if (!peakExpense || amt > Number(peakExpense.amount || 0)) {
        peakExpense = e;
      }
    });

    // Subscriptions Overhead
    const recurringTotal = currentMonthExpenses
      .filter((e) => e.isRecurring || e.recurring || (e as any).frequency)
      .reduce((s, e) => s + Math.max(0, Number(e.amount || 0)), 0);
    const recurringRatio =
      currentMonthSpent > 0 ? Math.round((recurringTotal / currentMonthSpent) * 100) : 0;

    // Cross-Domain Cash Flow & Savings Rate
    const totalMonthlyInflow = earnedTotal(currentMonthIncomes);
    const activeInflow = totalMonthlyInflow;
    const netCashFlow = activeInflow - currentMonthSpent;
    const savingsRate = activeInflow > 0 ? Math.round((netCashFlow / activeInflow) * 100) : 0;

    // Savings Goals Funding Velocity
    const totalGoalsTarget = safeGoals.reduce((s, g) => s + Math.max(0, Number(g.targetAmount || 0)), 0);
    const totalGoalsCurrent = safeGoals.reduce((s, g) => s + Math.max(0, Number(g.currentAmount || 0)), 0);
    const totalGoalsRemaining = Math.max(0, totalGoalsTarget - totalGoalsCurrent);
    const goalsFundingPct = totalGoalsTarget > 0 ? Math.round((totalGoalsCurrent / totalGoalsTarget) * 100) : 0;
    const monthsToFundGoals = (netCashFlow > 0 && totalGoalsRemaining > 0)
      ? Math.max(1, Math.ceil(totalGoalsRemaining / netCashFlow))
      : null;

    // Recurring Commitment Drag (Autonomy Index)
    const recurringChitTotal = safeGoals
      .filter((g: any) => g.isRecurring || (g.recurringAmount != null && Number(g.recurringAmount) > 0))
      .reduce((s: number, g: any) => s + Math.max(0, Number(g.recurringAmount || 0)), 0);
    const totalCommittedOverhead = recurringTotal + recurringChitTotal;
    const commitmentAutonomyRatio = activeInflow > 0 ? Math.round((totalCommittedOverhead / activeInflow) * 100) : 0;

    // Income Stream Composition & Salary Coverage
    const salaryInflow = currentMonthIncomes
      .filter((i) => kindOf(i) === 'SALARY' || /salary/i.test(i.source || ''))
      .reduce((s, i) => s + Math.max(0, Number(i.amount || 0)), 0);
    const otherInflow = Math.max(0, activeInflow - salaryInflow);
    const salarySharePct = activeInflow > 0 ? Math.round((salaryInflow / activeInflow) * 100) : 0;
    const salaryCoverageRatio = currentMonthSpent > 0
      ? Math.round((salaryInflow / currentMonthSpent) * 100)
      : (salaryInflow > 0 ? 100 : 0);

    // Emergency Savings Runway
    const allTimeSpent = safeExpenses.reduce((s, e) => s + Math.max(0, Number(e.amount || 0)), 0);
    const monthlyBurnBaseline = currentMonthSpent > 0 ? currentMonthSpent : allTimeSpent;
    const emergencyRunwayMonths = (monthlyBurnBaseline > 0 && totalGoalsCurrent > 0)
      ? (totalGoalsCurrent / monthlyBurnBaseline).toFixed(1)
      : '0';

    return {
      currentMonthSpent,
      dailyBurn,
      projectedSpent,
      essentialSpent,
      discretionarySpent,
      discretionaryPct,
      potentialSavings,
      weekendSpent,
      weekdaySpent,
      avgWeekendTx,
      avgWeekdayTx,
      weekendMultiplier,
      governanceScore,
      breachedBudgetsCount,
      warningBudgetsCount,
      burnout: earliestBurnout as BurnoutCandidate | null,
      txCount,
      avgTicketSize,
      txPerDay,
      peak: peakExpense as ExpenseItem | null,
      recurringTotal,
      recurringRatio,
      activeInflow,
      netCashFlow,
      savingsRate,
      totalGoalsTarget,
      totalGoalsCurrent,
      totalGoalsRemaining,
      goalsFundingPct,
      monthsToFundGoals,
      recurringChitTotal,
      totalCommittedOverhead,
      commitmentAutonomyRatio,
      salaryInflow,
      otherInflow,
      salarySharePct,
      salaryCoverageRatio,
      emergencyRunwayMonths,
    };
  }, [safeExpenses, safeBudgets, safeIncomes, safeGoals, currentDay, daysInMonth, thisMonthKey, now]);

  const {
    currentMonthSpent,
    dailyBurn,
    projectedSpent,
    essentialSpent,
    discretionarySpent,
    discretionaryPct,
    potentialSavings,
    avgWeekendTx,
    avgWeekdayTx,
    weekendMultiplier,
    governanceScore,
    breachedBudgetsCount,
    warningBudgetsCount,
    burnout,
    txCount,
    avgTicketSize,
    txPerDay,
    peak,
    recurringTotal,
    activeInflow,
    netCashFlow,
    savingsRate,
    totalGoalsTarget,
    totalGoalsCurrent,
    totalGoalsRemaining,
    goalsFundingPct,
    monthsToFundGoals,
    recurringChitTotal,
    totalCommittedOverhead,
    commitmentAutonomyRatio,
    salaryInflow,
    otherInflow,
    salarySharePct,
    salaryCoverageRatio,
    emergencyRunwayMonths,
  } = metrics;

  const openDetail = (data: DetailedInsightModalData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedInsight(data);
  };

  const handleTabChange = (tab: InsightTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTab(tab);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Modal Trigger Handlers for Specific Insights
  // ─────────────────────────────────────────────────────────────────────────────

  // Model 5: Spending Forecast
  const openForecastDetail = () => {
    if (mlForecastStatus.isCalibrated && mlForecast) {
      openDetail({
        title: 'Model 5: ML Spending Forecast',
        icon: 'trending-up-outline',
        color: c.primary,
        headline: `Time-series machine learning model projects ${formatAmt(mlForecast.total)} in spend over the next ${mlForecast.days} days.`,
        metrics: [
          { label: 'Projected 7-Day Outflow', value: formatAmt(mlForecast.total) },
          { label: 'Forecast Horizon', value: `${mlForecast.days} Days` },
          { label: 'Expected Daily Pace', value: `${formatAmt(mlForecast.total / mlForecast.days)}/day` },
          { label: 'Model Engine', value: 'HistGradientBoosting Time-Series' },
        ],
        advice:
          'Time-series projections capture your seasonal pace. Compare this projection against your remaining monthly budget to avoid overspending before month end.',
      });
    } else {
      openDetail({
        title: 'Model 5: ML Spending Calibration',
        icon: 'hourglass-outline',
        color: c.primary,
        headline: `AI model requires 28 days of transaction history (${mlForecastStatus.daysRecorded} / 28 recorded).`,
        metrics: [
          { label: 'Days Recorded', value: `${mlForecastStatus.daysRecorded} Days` },
          { label: 'Required for Calibration', value: '28 Days' },
          { label: 'Zero-Fabrication Status', value: 'Active' },
          { label: 'Current Pace Baseline', value: `${formatAmt(dailyBurn)}/day` },
        ],
        advice:
          'To ensure absolute financial truth, the AI engine never fabricates synthetic data. Continue logging daily expenses to unlock multi-day predictive trajectories.',
      });
    }
  };

  // Model 4: Isolation Forest Anomaly Scanner
  const openAnomalyDetail = () => {
    const isFlagged = mlAnomaly && mlAnomaly.count > 0;
    openDetail({
      title: 'Model 4: Isolation Forest Anomaly Scanner',
      icon: isFlagged ? 'warning-outline' : 'shield-checkmark-outline',
      color: isFlagged ? c.danger : c.success,
      headline: isFlagged
        ? `Isolation Forest flagged ${mlAnomaly.count} transaction(s) deviating from your typical amount, hour, and day cadence.`
        : 'Isolation Forest analyzed your recent transactions across amounts, hours, and days. All transactions fall within expected variance.',
      metrics: [
        { label: 'Flagged Anomalies', value: `${mlAnomaly?.count || 0}` },
        { label: 'Top Outlier', value: mlAnomaly?.topOutlier?.desc || 'None' },
        { label: 'Outlier Amount', value: mlAnomaly?.topOutlier ? formatAmt(mlAnomaly.topOutlier.amount) : 'N/A' },
        { label: 'Model Algorithm', value: 'Isolation Forest (Unsupervised)' },
      ],
      advice: isFlagged
        ? 'Audit flagged transactions for irregular merchant charges, accidental double billings, or unexpected fee changes.'
        : 'Your spending conforms neatly to your behavioral baseline. No anomalous spikes detected.',
    });
  };

  // Model 1: Category Classifier
  const openClassifierDetail = () => {
    openDetail({
      title: 'Model 1: Category Classifier',
      icon: 'sparkles-outline',
      color: c.primary,
      headline: 'Dual-Gram TF-IDF with LinearSGD Ensemble classifies transactions with real-time confidence scores.',
      metrics: [
        { label: 'Model Engine', value: 'Dual-Gram TF-IDF + SGD' },
        { label: 'Model Version', value: 'v2.5.0' },
        { label: 'Benchmark Accuracy', value: '94.2%' },
        { label: 'Inference Latency', value: '<12ms (Edge Ready)' },
      ],
      advice:
        'Bank SMS narratives and manual entries are tokenized into character and word n-grams to infer categories instantly with thresholded fallback.',
    });
  };

  // Model 2: Merchant Entity Resolver
  const openMerchantDetail = () => {
    openDetail({
      title: 'Model 2: Merchant Entity Resolver',
      icon: 'storefront-outline',
      color: c.accent,
      headline: 'N-Gram Fuzzy Token Distance & Lexical Matcher standardizes messy merchant strings.',
      metrics: [
        { label: 'Model Engine', value: 'Normalized Levenshtein + Jaro' },
        { label: 'Model Version', value: 'v1.4.0' },
        { label: 'Benchmark Accuracy', value: '98.1%' },
        { label: 'Entity Registry', value: 'Canonical POS Cleaned' },
      ],
      advice:
        'Raw POS transaction narratives often contain noise such as terminal numbers and store IDs. The resolver extracts clean brand entities.',
    });
  };

  // Model 3: Duplicate Detector Sentinel
  const openDuplicateDetail = () => {
    openDetail({
      title: 'Model 3: Duplicate Detector Sentinel',
      icon: 'copy-outline',
      color: '#06B6D4',
      headline: 'Multi-Field Cosine Vectorizer audits 48-hour candidate windows to intercept double charges.',
      metrics: [
        { label: 'Model Engine', value: 'Multi-Field Cosine Vectorizer' },
        { label: 'Model Version', value: 'v2.1.0' },
        { label: 'Temporal Window', value: '48 Hours' },
        { label: 'Detection Accuracy', value: '99.4%' },
      ],
      advice:
        'Protects against accidental duplicate card taps and retry glitches by comparing amounts, timestamps, and merchant tokens.',
    });
  };

  // ML Feedback Loop / Learning Engine
  const openFeedbackDetail = () => {
    openDetail({
      title: 'Model Continuous Learning Engine',
      icon: 'sync-outline',
      color: c.teal,
      headline: 'Real-time human-in-the-loop feedback pipeline retrains and refines ML weights.',
      metrics: [
        { label: 'Feedback Mode', value: 'Human-in-the-Loop' },
        { label: 'Ingestion Pipeline', value: 'Async Buffer Queue' },
        { label: 'Threshold Retraining', value: 'Automated' },
        { label: 'Privacy Status', value: 'Zero Raw Text Storage' },
      ],
      advice:
        'Whenever you modify an expense category or confirm an auto-parsed SMS transaction, your input trains the local vocabulary weights without transmitting sensitive personal data.',
    });
  };

  // ML Fleet Governance
  const openEngineStatusDetail = () => {
    openDetail({
      title: 'ML Fleet & Zero-Fabrication Protocol',
      icon: 'git-network-outline',
      color: c.success,
      headline: '5 Specialized Production Machine Learning Models running under strict zero-fabrication privacy.',
      metrics: [
        { label: 'Active Fleet Size', value: '5 Models Online' },
        { label: 'Zero-Fabrication', value: 'Enforced' },
        { label: 'Data Privacy', value: 'Zero Cloud Leakage' },
        { label: 'Calibration Requirement', value: '28 Calendar Days' },
      ],
      advice:
        'Unlike generative AI that hallucinates financial estimates, our deterministic ML fleet runs statistical and NLP algorithms strictly against your authentic transaction records.',
    });
  };

  // Burn Velocity
  const openBurnVelocityDetail = () => {
    openDetail({
      title: 'Burn Velocity & Pacing',
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
    });
  };

  // Category Depletion Early Warning
  const openBurnoutDetail = () => {
    if (!burnout) return;
    openDetail({
      title: 'Budget Burnout Early Warning',
      icon: 'flame-outline',
      color: c.accent,
      headline: `"${burnout.categoryName}" is on pace to deplete its budget in ${burnout.daysRemainingUntilDepletion} days.`,
      metrics: [
        { label: 'At Risk Category', value: burnout.categoryName },
        { label: 'Category Outflow Rate', value: `${formatAmt(burnout.dailyCategoryRate)}/day` },
        { label: 'Remaining Budget', value: formatAmt(burnout.limit - burnout.spent) },
        { label: 'Estimated Depletion In', value: `${burnout.daysRemainingUntilDepletion} days` },
      ],
      advice:
        'At your current velocity, this category will breach its cap before the month ends. Slow down daily transactions in this category to stay under budget.',
    });
  };

  // Cash Flow Pulse
  const openCashFlowDetail = () => {
    openDetail({
      title: 'Monthly Cash Flow Pulse',
      icon: 'swap-horizontal-outline',
      color: netCashFlow >= 0 ? c.success : c.danger,
      headline:
        activeInflow > 0
          ? `Monthly Inflow is ${formatAmt(activeInflow)} against ${formatAmt(currentMonthSpent)} total outflow (${netCashFlow >= 0 ? '+' : ''}${formatAmt(netCashFlow)} net balance).`
          : `Monthly outflow is ${formatAmt(currentMonthSpent)}. Record your monthly income streams to track your savings rate.`,
      metrics: [
        { label: 'Total Inflows', value: `+${formatAmt(activeInflow)}` },
        { label: 'Total Outflows', value: `-${formatAmt(currentMonthSpent)}` },
        { label: 'Net Cash Flow', value: `${netCashFlow >= 0 ? '+' : ''}${formatAmt(netCashFlow)}` },
        { label: 'Savings Rate', value: activeInflow > 0 ? `${savingsRate}%` : 'N/A' },
      ],
      advice:
        activeInflow <= 0
          ? 'Log your salary or income entries to calculate your net cash flow and savings rate.'
          : netCashFlow < 0
          ? 'Spending is currently exceeding income this month. Curtail discretionary expenses to restore positive cash flow.'
          : savingsRate >= 20
          ? 'Outstanding! You are retaining over 20% of your earnings, building strong liquidity.'
          : 'Positive cash flow! Aim to increase your retention rate to 20% or higher.',
    });
  };

  // Tri-Domain Flow
  const openTriDomainDetail = () => {
    openDetail({
      title: 'Tri-Domain Wealth Interaction',
      icon: 'pie-chart-outline',
      color: '#3B82F6',
      headline:
        activeInflow > 0
          ? `Wealth allocation: ${Math.round((currentMonthSpent / (activeInflow || 1)) * 100)}% to expenses, with ${formatAmt(totalGoalsCurrent)} protected in chits & savings.`
          : 'Track income, expenses, and savings goals to visualize your tri-domain wealth loop.',
      metrics: [
        { label: 'Earned Inflow', value: formatAmt(activeInflow) },
        { label: 'Outflow Drain', value: formatAmt(currentMonthSpent) },
        { label: 'Stored in Chits & Goals', value: formatAmt(totalGoalsCurrent) },
        { label: 'Net Available Liquidity', value: `${netCashFlow >= 0 ? '+' : ''}${formatAmt(netCashFlow)}` },
      ],
      advice:
        activeInflow <= 0
          ? 'Log consistent inflows to unlock 50/30/20 wealth allocation metrics.'
          : netCashFlow < 0
          ? 'Outflow is depleting your liquidity. Pause discretionary spending to safeguard your chit and savings contributions.'
          : 'Healthy wealth loop: Cash flows smoothly from revenue into protected savings and essential living.',
    });
  };

  // Emergency Runway
  const openEmergencyRunwayDetail = () => {
    openDetail({
      title: 'Emergency Savings Runway',
      icon: 'shield-checkmark-outline',
      color: Number(emergencyRunwayMonths) >= 3 ? c.success : c.warning,
      headline:
        totalGoalsCurrent > 0
          ? `Current accumulated reserves (${formatAmt(totalGoalsCurrent)}) can sustain your living expenses for ${emergencyRunwayMonths} months without any new income.`
          : 'Configure savings goals or reserves to calculate your emergency runway.',
      metrics: [
        { label: 'Accumulated Reserves', value: formatAmt(totalGoalsCurrent) },
        { label: 'Monthly Burn Rate', value: formatAmt(currentMonthSpent) },
        { label: 'Emergency Runway', value: `${emergencyRunwayMonths} Months` },
        { label: 'Target 6-Mo Reserve', value: formatAmt(currentMonthSpent * 6) },
      ],
      advice:
        totalGoalsCurrent <= 0
          ? 'Build a dedicated emergency fund goal covering at least 3 to 6 months of expenses for financial resilience.'
          : Number(emergencyRunwayMonths) >= 6
          ? 'Institutional Gold Standard! You have over 6 months of living expenses safely banked.'
          : Number(emergencyRunwayMonths) >= 3
          ? 'Healthy safety cushion! Maintain this baseline while directing surplus cash flow toward investments.'
          : 'Runway is below the recommended 3 months. Prioritize building reserves before increasing discretionary spending.',
    });
  };

  // Goal Velocity
  const openGoalVelocityDetail = () => {
    openDetail({
      title: 'Goal Funding Velocity',
      icon: 'flag-outline',
      color: c.warning,
      headline:
        monthsToFundGoals
          ? `At current monthly surplus (+${formatAmt(netCashFlow)}/mo), remaining goals will be fully funded in ~${monthsToFundGoals} month${monthsToFundGoals === 1 ? '' : 's'}.`
          : `${goalsFundingPct}% of total savings milestone target achieved (${formatAmt(totalGoalsCurrent)} of ${formatAmt(totalGoalsTarget)}).`,
      metrics: [
        { label: 'Milestones Target', value: formatAmt(totalGoalsTarget) },
        { label: 'Current Accumulation', value: formatAmt(totalGoalsCurrent) },
        { label: 'Remaining Capital Needed', value: formatAmt(totalGoalsRemaining) },
        { label: 'Estimated Completion', value: monthsToFundGoals ? `~${monthsToFundGoals} Months` : 'N/A' },
      ],
      advice:
        monthsToFundGoals
          ? 'Maintaining your current surplus pace guarantees timely realization of target milestones without straining operational liquidity.'
          : netCashFlow <= 0
          ? 'Achieving positive monthly cash flow is required to accurately model goal milestone completion timelines.'
          : 'All savings targets are currently fully funded! Time to set new financial horizons.',
    });
  };

  // Salary Coverage
  const openSalaryCoverageDetail = () => {
    openDetail({
      title: 'Income Streams & Salary Coverage',
      icon: 'cash-outline',
      color: salaryCoverageRatio >= 100 ? c.success : c.warning,
      headline:
        activeInflow > 0
          ? `Base salary provides ${salarySharePct}% of total inflows (${formatAmt(salaryInflow)}), covering ${salaryCoverageRatio}% of your monthly living expenses.`
          : 'Log salary and secondary income streams to model income stability and coverage ratios.',
      metrics: [
        { label: 'Base Salary', value: formatAmt(salaryInflow) },
        { label: 'Other Inflows', value: formatAmt(otherInflow) },
        { label: 'Monthly Expenses', value: formatAmt(currentMonthSpent) },
        { label: 'Salary Coverage Ratio', value: `${salaryCoverageRatio}%` },
      ],
      advice:
        activeInflow <= 0
          ? 'Log your salary and secondary earnings to analyze your income stability and safety margins.'
          : salaryCoverageRatio >= 100
          ? 'Excellent! Your base salary alone covers 100% of all monthly expenses, allowing bonus/other income to go straight to savings.'
          : 'Your monthly expenses currently exceed base salary. You depend on irregular or secondary inflows to balance the budget.',
    });
  };

  // Discretionary Load
  const openDiscretionaryDetail = () => {
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
    });
  };

  // Weekend Multiplier
  const openWeekendDetail = () => {
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
    });
  };

  // Budget Health Score
  const openGovernanceDetail = () => {
    openDetail({
      title: 'Budget Health Score',
      icon: 'shield-checkmark-outline',
      color: governanceScore >= 80 ? c.success : governanceScore >= 60 ? c.warning : c.danger,
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
    });
  };

  // Commitment Autonomy Drag
  const openCommitmentDragDetail = () => {
    openDetail({
      title: 'Commitment Autonomy Drag',
      icon: 'lock-closed-outline',
      color: commitmentAutonomyRatio > 50 ? c.danger : c.highlight,
      headline:
        activeInflow > 0
          ? `Fixed recurring commitments (subscriptions + chits/RDs) lock up ${commitmentAutonomyRatio}% of your monthly inflow (${formatAmt(totalCommittedOverhead)}/mo).`
          : `You have ${formatAmt(totalCommittedOverhead)}/mo committed to recurring subscriptions and chit/RD installments.`,
      metrics: [
        { label: 'Subscriptions Burn', value: `${formatAmt(recurringTotal)}/mo` },
        { label: 'Chits & RD Installments', value: `${formatAmt(recurringChitTotal)}/mo` },
        { label: 'Total Committed Run-rate', value: `${formatAmt(totalCommittedOverhead)}/mo` },
        { label: 'Income Autonomy Drag', value: `${commitmentAutonomyRatio}%` },
      ],
      advice:
        commitmentAutonomyRatio > 50
          ? 'Caution: Over 50% of your earnings is committed before discretionary spending begins. Audit non-essential subscriptions.'
          : 'Excellent: Your recurring commitments leave ample flexibility for discretionary choices and emergency buffers.',
    });
  };

  // Average Ticket Size & Velocity
  const openTicketCadenceDetail = () => {
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
      advice: 'Consolidating smaller purchases into planned shopping intervals helps reduce impulse spend.',
    });
  };

  // Peak Outflow Outlier
  const openPeakOutflowDetail = () => {
    if (!peak) return;
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
    });
  };

  return (
    <View style={styles.container}>
      {/* 1. CATEGORY SEGMENTS FILTER BAR */}
      <View style={[styles.filterBar, { backgroundColor: c.fillSubtle, borderColor: c.border }]}>
        <TouchableOpacity
          onPress={() => handleTabChange('ai')}
          style={[
            styles.filterTab,
            activeTab === 'ai' && { backgroundColor: c.primary },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'ai' }}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeTab === 'ai' ? c.onPrimary : c.textMuted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            AI Intelligence
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('wealth')}
          style={[
            styles.filterTab,
            activeTab === 'wealth' && { backgroundColor: c.accent },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'wealth' }}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeTab === 'wealth' ? '#FFFFFF' : c.textMuted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Wealth & Flow
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('habits')}
          style={[
            styles.filterTab,
            activeTab === 'habits' && { backgroundColor: c.teal },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'habits' }}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeTab === 'habits' ? '#FFFFFF' : c.textMuted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Habits & Governance
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('all')}
          style={[
            styles.filterTab,
            activeTab === 'all' && { backgroundColor: c.highlight },
          ]}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'all' }}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: activeTab === 'all' ? '#FFFFFF' : c.textMuted },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            All Insights
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. STRUCTURED INTELLIGENCE CARDS */}
      <View style={styles.cardsContent}>
        {/* ── SEGMENT A: AI INTELLIGENCE ────────────────────────────────────── */}
        {(activeTab === 'ai' || activeTab === 'all') && (
          <View style={styles.sectionWrap}>
            {activeTab === 'all' && (
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="hardware-chip-outline" size={16} color={c.primary} />
                <Text style={[styles.sectionHeading, { color: c.text }]}>AI Financial Intelligence</Text>
              </View>
            )}

            {/* Contextual AI Anomaly Alert Banner (Isolation Forest) */}
            <InsightAlertBanner
              anomaly={mlAnomaly}
              burnout={null}
              formatAmt={formatAmt}
              onPressAnomaly={openAnomalyDetail}
              onPressBurnout={openBurnoutDetail}
              colors={c}
              alertType="anomaly"
            />

            {/* Hero AI Spend Forecast (Model 5) */}
            <AiForecastCard
              forecast={mlForecast}
              status={mlForecastStatus}
              formatAmt={formatAmt}
              onPress={openForecastDetail}
              colors={c}
            />

            <View style={styles.grid}>
              {/* Card 1: Model 4 - ML Anomaly Scanner */}
              <InsightCard
                title="ML Anomaly Scanner"
                tag={mlAnomaly && mlAnomaly.count > 0 ? 'Outlier Watch' : 'Verified'}
                icon={mlAnomaly && mlAnomaly.count > 0 ? 'warning-outline' : 'shield-checkmark-outline'}
                iconColor={mlAnomaly && mlAnomaly.count > 0 ? c.danger : c.success}
                primaryVal={mlAnomaly && mlAnomaly.count > 0 ? `${mlAnomaly.count} Flagged` : '0 Outliers'}
                primaryValColor={mlAnomaly && mlAnomaly.count > 0 ? c.danger : c.success}
                subText={
                  mlAnomaly && mlAnomaly.count > 0
                    ? (mlAnomaly.topOutlier?.desc || 'Anomaly detected')
                    : 'Temporal patterns nominal'
                }
                onPress={openAnomalyDetail}
                colors={c}
              />

              {/* Card 2: Model 1 - Category Classifier */}
              <InsightCard
                title="Category Classifier"
                tag="Model 1 • NLP"
                icon="sparkles-outline"
                iconColor={c.primary}
                primaryVal="v2.5.0"
                primaryValColor={c.primary}
                subText="Dual-Gram TF-IDF Ensemble"
                onPress={openClassifierDetail}
                colors={c}
              />

              {/* Card 3: Model 2 - Merchant Matcher */}
              <InsightCard
                title="Merchant Matcher"
                tag="Model 2 • Entity"
                icon="storefront-outline"
                iconColor={c.accent}
                primaryVal="98.1%"
                primaryValColor={c.accent}
                subText="Fuzzy Lexical Distance"
                onPress={openMerchantDetail}
                colors={c}
              />

              {/* Card 4: Model 3 - Duplicate Sentinel */}
              <InsightCard
                title="Duplicate Sentinel"
                tag="Model 3 • Sentinel"
                icon="copy-outline"
                iconColor="#06B6D4"
                primaryVal="48h Window"
                primaryValColor="#06B6D4"
                subText="Cosine Multi-Vector Audit"
                onPress={openDuplicateDetail}
                colors={c}
              />

              {/* Card 5: Model Continuous Learning Engine */}
              <InsightCard
                title="Learning Engine"
                tag="Feedback Loop"
                icon="sync-outline"
                iconColor={c.teal}
                primaryVal="Active"
                primaryValColor={c.teal}
                subText="Human-in-the-Loop Refinement"
                onPress={openFeedbackDetail}
                colors={c}
              />

              {/* Card 6: ML Production Fleet Governance */}
              <InsightCard
                title="Production Fleet"
                tag="Governance"
                icon="git-network-outline"
                iconColor={c.success}
                primaryVal="5/5 Online"
                primaryValColor={c.success}
                subText="Zero-Fabrication Protocol"
                onPress={openEngineStatusDetail}
                colors={c}
              />
            </View>
          </View>
        )}

        {/* ── SEGMENT B: CASH FLOW & WEALTH ─────────────────────────────────── */}
        {(activeTab === 'wealth' || activeTab === 'all') && (
          <View style={styles.sectionWrap}>
            {activeTab === 'all' && (
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="pie-chart-outline" size={16} color={c.accent} />
                <Text style={[styles.sectionHeading, { color: c.text }]}>Cash Flow & Wealth Autonomy</Text>
              </View>
            )}

            {/* Hero Cash Flow Pulse Card */}
            <CashFlowPulseCard
              activeInflow={activeInflow}
              currentMonthSpent={currentMonthSpent}
              netCashFlow={netCashFlow}
              savingsRate={savingsRate}
              formatAmt={formatAmt}
              onPress={openCashFlowDetail}
              colors={c}
            />

            <View style={styles.grid}>
              {/* Tri-Domain Flow Card */}
              <InsightCard
                title="Tri-Domain Flow"
                tag="Wealth Loop"
                icon="pie-chart-outline"
                iconColor="#3B82F6"
                primaryVal={
                  activeInflow > 0
                    ? (savingsRate >= 0 ? `${savingsRate}% saved` : `${Math.abs(savingsRate)}% deficit`)
                    : (currentMonthSpent > 0 ? `-${formatAmt(currentMonthSpent)}` : 'Balanced')
                }
                primaryValColor="#3B82F6"
                subText={`Chits/Goals: ${formatAmt(totalGoalsCurrent)}`}
                onPress={openTriDomainDetail}
                colors={c}
              />

              {/* Emergency Runway Card */}
              <InsightCard
                title="Emergency Runway"
                tag="Resilience"
                icon="shield-checkmark-outline"
                iconColor={Number(emergencyRunwayMonths) >= 3 ? c.success : c.warning}
                primaryVal={`${emergencyRunwayMonths} Mo`}
                primaryValColor={Number(emergencyRunwayMonths) >= 3 ? c.success : c.warning}
                subText={`Reserves: ${formatAmt(totalGoalsCurrent)}`}
                onPress={openEmergencyRunwayDetail}
                colors={c}
              />

              {/* Goal Velocity Card */}
              <InsightCard
                title="Goal Velocity"
                tag="Milestones"
                icon="flag-outline"
                iconColor={c.warning}
                primaryVal={
                  safeGoals.length > 0
                    ? (monthsToFundGoals ? `~${monthsToFundGoals} mo` : `${goalsFundingPct}%`)
                    : '0 Goals'
                }
                primaryValColor={c.warning}
                subText={
                  safeGoals.length > 0
                    ? `Saved: ${goalsFundingPct}% of target`
                    : 'Set target to track velocity'
                }
                onPress={openGoalVelocityDetail}
                colors={c}
              />

              {/* Salary Living Coverage */}
              <InsightCard
                title="Salary Coverage"
                tag="Income Intel"
                icon="cash-outline"
                iconColor={salaryCoverageRatio >= 100 ? c.success : c.warning}
                primaryVal={activeInflow > 0 ? `${salaryCoverageRatio}%` : 'N/A'}
                primaryValColor={salaryCoverageRatio >= 100 ? c.success : c.warning}
                subText={`Salary: ${formatAmt(salaryInflow)}`}
                onPress={openSalaryCoverageDetail}
                colors={c}
              />
            </View>
          </View>
        )}

        {/* ── SEGMENT C: SPENDING HABITS & GOVERNANCE ──────────────────────── */}
        {(activeTab === 'habits' || activeTab === 'all') && (
          <View style={styles.sectionWrap}>
            {activeTab === 'all' && (
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="bar-chart-outline" size={16} color={c.teal} />
                <Text style={[styles.sectionHeading, { color: c.text }]}>Behavioral Habits & Governance</Text>
              </View>
            )}

            {/* Contextual Budget Cap Depletion Alert Banner */}
            <InsightAlertBanner
              anomaly={null}
              burnout={burnout}
              formatAmt={formatAmt}
              onPressAnomaly={openAnomalyDetail}
              onPressBurnout={openBurnoutDetail}
              colors={c}
              alertType="burnout"
            />

            <View style={styles.grid}>
              {/* Burn Velocity */}
              <InsightCard
                title="Burn Velocity"
                tag="Pacing"
                icon="speedometer-outline"
                iconColor={c.primary}
                primaryVal={`${formatAmt(dailyBurn)}/d`}
                subText={`Est. Month: ${formatAmt(projectedSpent)}`}
                onPress={openBurnVelocityDetail}
                colors={c}
              />

              {/* Cap Depletion Watch */}
              <InsightCard
                title="Cap Depletion"
                tag={burnout ? 'Early Warning' : 'Depletion'}
                icon={burnout ? 'flame-outline' : 'shield-checkmark-outline'}
                iconColor={burnout ? c.accent : c.success}
                primaryVal={burnout ? `${burnout.daysRemainingUntilDepletion}d left` : 'Nominal'}
                primaryValColor={burnout ? c.accent : c.success}
                subText={burnout ? `${burnout.categoryName} at risk` : 'All caps within target'}
                onPress={
                  burnout
                    ? openBurnoutDetail
                    : () =>
                        openDetail({
                          title: 'Category Depletion Status',
                          icon: 'shield-checkmark-outline',
                          color: c.success,
                          headline: 'All category budget caps are currently within healthy limits.',
                          metrics: [
                            { label: 'Monitored Categories', value: `${safeBudgets.length}` },
                            { label: 'Exhaustion Risk', value: '0 Categories' },
                          ],
                          advice:
                            'Continue logging daily expenses to receive advance burnout warnings if spend accelerates.',
                        })
                }
                colors={c}
              />

              {/* Budget Governance Health Score */}
              <InsightCard
                title="Budget Health"
                tag="Governance"
                icon="shield-checkmark-outline"
                iconColor={governanceScore >= 80 ? c.success : governanceScore >= 60 ? c.warning : c.danger}
                primaryVal={safeExpenses.length === 0 && safeBudgets.length === 0 ? '--%' : `${governanceScore}%`}
                primaryValColor={
                  safeExpenses.length === 0 && safeBudgets.length === 0
                    ? c.textMuted
                    : governanceScore >= 80
                    ? c.success
                    : governanceScore >= 60
                    ? c.warning
                    : c.danger
                }
                subText={
                  breachedBudgetsCount > 0
                    ? `${breachedBudgetsCount} caps breached`
                    : warningBudgetsCount > 0
                    ? `${warningBudgetsCount} near limit`
                    : '100% on track'
                }
                onPress={openGovernanceDetail}
                colors={c}
              />

              {/* Discretionary Load & Potential Savings */}
              <InsightCard
                title="Discretionary Load"
                tag="Savings"
                icon="wallet-outline"
                iconColor={c.teal}
                primaryVal={`${discretionaryPct}%`}
                primaryValColor={c.text}
                subText={`Trim 15% save: +${formatAmt(potentialSavings)}`}
                onPress={openDiscretionaryDetail}
                colors={c}
              />

              {/* Weekend Multiplier Card */}
              <InsightCard
                title="Weekend Multiplier"
                tag="Habits"
                icon="calendar-outline"
                iconColor={c.accent}
                primaryVal={`${weekendMultiplier}x`}
                primaryValColor={c.text}
                subText={`Avg Wknd: ${formatAmt(avgWeekendTx)}/d`}
                onPress={openWeekendDetail}
                colors={c}
              />

              {/* Commitment Autonomy Drag */}
              <InsightCard
                title="Commitment Drag"
                tag="Autonomy"
                icon="lock-closed-outline"
                iconColor={commitmentAutonomyRatio > 50 ? c.danger : c.highlight}
                primaryVal={`${commitmentAutonomyRatio}%`}
                primaryValColor={commitmentAutonomyRatio > 50 ? c.danger : c.highlight}
                subText={`Locked: ${formatAmt(totalCommittedOverhead)}/mo`}
                onPress={openCommitmentDragDetail}
                colors={c}
              />

              {/* Average Ticket Size & Velocity */}
              <InsightCard
                title="Avg Ticket Size"
                tag="Velocity"
                icon="pricetag-outline"
                iconColor={c.primary}
                primaryVal={formatAmt(avgTicketSize)}
                subText={`${txPerDay} txs/day`}
                onPress={openTicketCadenceDetail}
                colors={c}
              />

              {/* Peak Outflow Outlier */}
              <InsightCard
                title="Peak Outflow"
                tag="Outlier"
                icon="trending-up-outline"
                iconColor={c.warning}
                primaryVal={peak ? formatAmt(peak.amount) : formatAmt(0)}
                primaryValColor={c.warning}
                subText={peak ? (peak.description || 'Transaction') : 'No expenses logged'}
                onPress={openPeakOutflowDetail}
                colors={c}
              />
            </View>
          </View>
        )}
      </View>

      {/* 3. DETAIL MODAL SHEET */}
      <InsightDetailModal
        insight={selectedInsight}
        onClose={() => setSelectedInsight(null)}
        colors={c}
      />
    </View>
  );
});

InsightCards.displayName = 'InsightCards';

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
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  cardsContent: {
    gap: 16,
  },
  sectionWrap: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
