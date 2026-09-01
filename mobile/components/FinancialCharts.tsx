/**
 * @file FinancialCharts.tsx
 * @description Suite of 5 SVG-rendered financial charts for the ExpenseTracker dashboard:
 * 1. CategoryDonutChart - Circular donut chart with percentage breakdown.
 * 2. SpendTrendChart - Continuous 90-day spend curve with linear gradient area fill.
 * 3. RecurringSplitChart - Horizontal proportional bar (Recurring vs Discretionary).
 * 4. DayOfWeekChart - Sunday-Saturday weekly spending habits bar chart.
 * 5. BudgetVsActualChart - Category-level limit vs actual spend comparison.
 */

import React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import Svg, {
  Path,
  Circle,
  G,
  Rect,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { Colors, getCategoryColor, getCategoryEmoji } from '../constants/theme';
import { getCurrencySymbol } from '../services/currency';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 40; // 20px padding on each side

/**
 * Formats a numeric value into a compact currency abbreviation (e.g. ₹1.2k, ₹3.5M).
 */
function formatCompact(num: number, symbol: string): string {
  try {
    if (isNaN(num)) return `${symbol}0`;
    if (num >= 1000000) return `${symbol}${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${symbol}${(num / 1000).toFixed(1)}k`;
    return `${symbol}${Math.round(num)}`;
  } catch {
    return `${symbol}0`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CATEGORY DONUT / RING CHART
// ─────────────────────────────────────────────────────────────────────────────

interface DonutChartProps {
  expenses: Array<{
    amount: number;
    categoryName?: string;
  }>;
}

/**
 * Renders a segmented circular SVG donut chart showing category spend distribution.
 */
export const CategoryDonutChart: React.FC<DonutChartProps> = ({ expenses }) => {
  const { theme, currency } = useAuth();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const safeExpenses = expenses || [];
  const categoryTotals: Record<string, number> = {};
  let total = 0;

  safeExpenses.forEach((e) => {
    const cat = e.categoryName || 'Other';
    const amt = Math.max(0, Number(e.amount || 0));
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    total += amt;
  });

  const categories = Object.entries(categoryTotals)
    .map(([name, amount]) => ({
      name,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
      color: getCategoryColor(name).color,
    }))
    .sort((a, b) => b.amount - a.amount);

  if (categories.length === 0 || total === 0) {
    return (
      <View style={[styles.emptyChartBox, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.emptyChartText, { color: c.textMuted }]}>No category spending recorded yet.</Text>
      </View>
    );
  }

  const size = 150;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentAngle = 0;

  return (
    <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.chartTitle, { color: c.text }]}>Spend by Category</Text>
      <Text style={[styles.chartSub, { color: c.textMuted }]}>Distribution across all transactions</Text>

      <View style={styles.donutRow}>
        <View style={styles.donutSvgWrap}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              {/* Background ring */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={c.trackBg}
                strokeWidth={strokeWidth}
                fill="none"
              />
              {/* Segments */}
              {categories.map((cat, i) => {
                const strokeDashoffset = circumference - (circumference * cat.pct) / 100;
                const angle = (currentAngle / 100) * 360;
                currentAngle += cat.pct;

                return (
                  <Circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={cat.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    transform={`rotate(${angle} ${size / 2} ${size / 2})`}
                    fill="none"
                    strokeLinecap="butt"
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.donutCenter}>
            <Text style={[styles.donutCenterLabel, { color: c.textMuted }]}>Total</Text>
            <Text style={[styles.donutCenterAmt, { color: c.text }]}>{formatCompact(total, currSym)}</Text>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendWrap}>
          {categories.slice(0, 5).map((cat, i) => (
            <View key={i} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.legendName, { color: c.text }]} numberOfLines={1}>
                {getCategoryEmoji(cat.name)} {cat.name}
              </Text>
              <Text style={[styles.legendPct, { color: c.textMuted }]}>{cat.pct.toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. SPEND TREND AREA CHART (Daily Spend over last N days)
// ─────────────────────────────────────────────────────────────────────────────

interface SpendTrendChartProps {
  expenses: Array<{
    amount: number;
    expenseDate: string;
  }>;
}

/**
 * Renders a smooth cubic SVG spline chart showing daily spend trends.
 */
export const SpendTrendChart: React.FC<SpendTrendChartProps> = ({ expenses }) => {
  const { theme, currency } = useAuth();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const safeExpenses = expenses || [];
  const days = 14;
  const now = new Date();
  const dayBuckets: { label: string; amount: number; dateStr: string }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { weekday: 'narrow' });
    dayBuckets.push({ label, amount: 0, dateStr });
  }

  safeExpenses.forEach((e) => {
    if (!e.expenseDate) return;
    const bucket = dayBuckets.find((b) => b.dateStr === e.expenseDate);
    if (bucket) {
      bucket.amount += Number(e.amount || 0);
    }
  });

  const maxVal = Math.max(...dayBuckets.map((d) => d.amount), 100);
  const chartHeight = 120;
  const chartInnerWidth = CHART_WIDTH - 48;
  const stepX = chartInnerWidth / (days - 1);

  const points = dayBuckets.map((d, i) => {
    const x = i * stepX;
    const y = chartHeight - (d.amount / maxVal) * (chartHeight - 20) - 10;
    return { x, y, amount: d.amount, label: d.label };
  });

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX1 = prev.x + (curr.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (curr.x - prev.x) / 2;
    const cpY2 = curr.y;
    linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.chartHeaderRow}>
        <View>
          <Text style={[styles.chartTitle, { color: c.text }]}>Spending Velocity</Text>
          <Text style={[styles.chartSub, { color: c.textMuted }]}>Daily outflow over the last 14 days</Text>
        </View>
        <Text style={[styles.peakBadge, { color: c.primary, backgroundColor: c.primary + '18' }]}>
          Peak: {formatCompact(maxVal, currSym)}
        </Text>
      </View>

      <View style={styles.svgWrap}>
        <Svg width={chartInnerWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.primary} stopOpacity="0.35" />
              <Stop offset="1" stopColor={c.primary} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          <Line x1="0" y1={chartHeight * 0.25} x2={chartInnerWidth} y2={chartHeight * 0.25} stroke={c.border} strokeDasharray="3,3" strokeWidth="1" />
          <Line x1="0" y1={chartHeight * 0.5} x2={chartInnerWidth} y2={chartHeight * 0.5} stroke={c.border} strokeDasharray="3,3" strokeWidth="1" />
          <Line x1="0" y1={chartHeight * 0.75} x2={chartInnerWidth} y2={chartHeight * 0.75} stroke={c.border} strokeDasharray="3,3" strokeWidth="1" />

          {/* Fill Area */}
          <Path d={areaPath} fill="url(#trendGrad)" />

          {/* Line Stroke */}
          <Path d={linePath} fill="none" stroke={c.primary} strokeWidth="2.5" />

          {/* Active Data Points */}
          {points.map((p, i) =>
            p.amount > 0 ? (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="3.5"
                fill={c.primary}
                stroke={c.card}
                strokeWidth="1.5"
              />
            ) : null
          )}
        </Svg>
      </View>

      {/* X Axis Day Labels */}
      <View style={styles.xAxisRow}>
        {dayBuckets.map((d, i) => (
          <Text
            key={i}
            style={[
              styles.xAxisLabel,
              { color: i === dayBuckets.length - 1 ? c.primary : c.textMuted },
            ]}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. RECURRING VS ONE-TIME SPLIT (Horizontal Bar)
// ─────────────────────────────────────────────────────────────────────────────

interface RecurringSplitProps {
  expenses: Array<{
    amount: number;
    isRecurring?: boolean;
    recurring?: boolean;
  }>;
}

/**
 * Renders a horizontal split bar comparing recurring subscription commitments vs discretionary one-off spend.
 */
export const RecurringSplitChart: React.FC<RecurringSplitProps> = ({ expenses }) => {
  const { theme, currency } = useAuth();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const safeExpenses = expenses || [];
  let recurring = 0;
  let onetime = 0;

  safeExpenses.forEach((e) => {
    const amt = Math.max(0, Number(e.amount || 0));
    if (e.isRecurring || e.recurring) {
      recurring += amt;
    } else {
      onetime += amt;
    }
  });

  const total = recurring + onetime;
  const recPct = total > 0 ? (recurring / total) * 100 : 0;
  const onePct = total > 0 ? (onetime / total) * 100 : 0;

  return (
    <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.chartTitle, { color: c.text }]}>Spend Composition</Text>
      <Text style={[styles.chartSub, { color: c.textMuted }]}>Recurring Subscriptions vs Discretionary</Text>

      {/* Horizontal Bar */}
      <View style={[styles.splitBarTrack, { backgroundColor: c.trackBg }]}>
        <View style={[styles.splitBarFill, { width: `${recPct}%`, backgroundColor: c.teal }]} />
        <View style={[styles.splitBarFill, { width: `${onePct}%`, backgroundColor: c.primary }]} />
      </View>

      {/* Stats row */}
      <View style={styles.splitLegendRow}>
        <View style={styles.splitLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: c.teal }]} />
          <View>
            <Text style={[styles.splitItemTitle, { color: c.text }]}>
              {currSym}{Math.round(recurring).toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.splitItemSub, { color: c.textMuted }]}>Recurring ({recPct.toFixed(0)}%)</Text>
          </View>
        </View>

        <View style={styles.splitLegendItem}>
          <View style={[styles.legendDot, { backgroundColor: c.primary }]} />
          <View>
            <Text style={[styles.splitItemTitle, { color: c.text }]}>
              {currSym}{Math.round(onetime).toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.splitItemSub, { color: c.textMuted }]}>One-time ({onePct.toFixed(0)}%)</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. DAY OF WEEK HABITS (Sun-Sat Bar Histogram)
// ─────────────────────────────────────────────────────────────────────────────

interface DayOfWeekProps {
  expenses: Array<{
    amount: number;
    expenseDate: string;
  }>;
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Renders weekly spending cadence across Sunday through Saturday.
 */
export const DayOfWeekChart: React.FC<DayOfWeekProps> = ({ expenses }) => {
  const { theme, currency } = useAuth();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const safeExpenses = expenses || [];
  const dowTotals = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts = [0, 0, 0, 0, 0, 0, 0];

  safeExpenses.forEach((e) => {
    if (!e.expenseDate) return;
    const day = new Date(e.expenseDate).getDay();
    if (day >= 0 && day <= 6) {
      dowTotals[day] += Math.max(0, Number(e.amount || 0));
      dowCounts[day]++;
    }
  });

  const maxDayVal = Math.max(...dowTotals, 100);
  const barMaxHeight = 80;

  return (
    <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.chartTitle, { color: c.text }]}>Weekly Spending Cadence</Text>
      <Text style={[styles.chartSub, { color: c.textMuted }]}>Total spend distributed by day of the week</Text>

      <View style={styles.dowRow}>
        {DOW_NAMES.map((name, i) => {
          const val = dowTotals[i];
          const heightPct = (val / maxDayVal) * barMaxHeight;
          const isHighest = val === maxDayVal && val > 0;

          return (
            <View key={i} style={styles.dowCol}>
              <Text style={[styles.dowValText, { color: isHighest ? c.primary : c.textMuted }]}>
                {val > 0 ? formatCompact(val, currSym) : '-'}
              </Text>
              <View style={[styles.dowBarBg, { height: barMaxHeight, backgroundColor: c.trackBg }]}>
                <View
                  style={[
                    styles.dowBarFill,
                    {
                      height: Math.max(heightPct, val > 0 ? 6 : 0),
                      backgroundColor: isHighest ? c.primary : c.teal,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.dowLabel, { color: isHighest ? c.primary : c.textMuted, fontWeight: isHighest ? '800' : '600' }]}>
                {name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. BUDGET VS ACTUAL GOVERNANCE DUAL BARS
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetVsActualProps {
  budgets: Array<{
    categoryName: string;
    limit: number;
    spent: number;
    percentage?: number;
  }>;
}

/**
 * Renders category-level limit vs actual spend comparisons with over-budget alerts.
 */
export const BudgetVsActualChart: React.FC<BudgetVsActualProps> = ({ budgets }) => {
  const { theme, currency } = useAuth();
  const c = Colors[theme];
  const currSym = getCurrencySymbol(currency);

  const safeBudgets = budgets || [];

  if (safeBudgets.length === 0) {
    return (
      <View style={[styles.emptyChartBox, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.emptyChartText, { color: c.textMuted }]}>
          No category budgets set. Define category limits in Add Expense.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.chartCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.chartTitle, { color: c.text }]}>Budget vs Actual Spend</Text>
      <Text style={[styles.chartSub, { color: c.textMuted }]}>Active category spending caps and utilization</Text>

      <View style={styles.budgetList}>
        {safeBudgets.slice(0, 6).map((b, i) => {
          const limit = Math.max(1, Number(b.limit || 0));
          const spent = Math.max(0, Number(b.spent || 0));
          const pct = Math.min(Math.round((spent / limit) * 100), 200);
          const isOver = spent > limit;
          const isNear = !isOver && pct >= 80;

          const barColor = isOver ? c.accent : isNear ? c.warning : c.success;

          return (
            <View key={i} style={styles.budgetRow}>
              <View style={styles.budgetMeta}>
                <Text style={[styles.budgetName, { color: c.text }]}>
                  {getCategoryEmoji(b.categoryName)} {b.categoryName}
                </Text>
                <Text style={[styles.budgetFigures, { color: isOver ? c.accent : c.textMuted }]}>
                  {currSym}{Math.round(spent).toLocaleString('en-IN')} / {currSym}{Math.round(limit).toLocaleString('en-IN')}
                </Text>
              </View>

              <View style={[styles.budgetTrack, { backgroundColor: c.trackBg }]}>
                <View
                  style={[
                    styles.budgetFill,
                    {
                      width: `${Math.min(pct, 100)}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>

              <View style={styles.budgetFootRow}>
                <Text style={[styles.budgetPctText, { color: barColor }]}>
                  {pct}% utilized {isOver ? '(Exceeded)' : isNear ? '(Warning)' : ''}
                </Text>
                <Text style={[styles.budgetRemaining, { color: c.textMuted }]}>
                  {isOver
                    ? `Over by ${currSym}${Math.round(spent - limit).toLocaleString('en-IN')}`
                    : `${currSym}${Math.round(limit - spent).toLocaleString('en-IN')} left`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyChartBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  chartSub: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  peakBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  donutSvgWrap: {
    position: 'relative',
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  donutCenterLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  donutCenterAmt: {
    fontSize: 15,
    fontWeight: '900',
  },
  legendWrap: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '800',
  },
  svgWrap: {
    alignItems: 'center',
    marginVertical: 6,
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  xAxisLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: 16,
  },
  splitBarTrack: {
    height: 16,
    borderRadius: 8,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 14,
  },
  splitBarFill: {
    height: '100%',
  },
  splitLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  splitLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  splitItemTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  splitItemSub: {
    fontSize: 11,
  },
  dowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 8,
  },
  dowCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dowValText: {
    fontSize: 9,
    fontWeight: '700',
  },
  dowBarBg: {
    width: 16,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  dowBarFill: {
    width: '100%',
    borderRadius: 8,
  },
  dowLabel: {
    fontSize: 11,
  },
  budgetList: {
    gap: 12,
  },
  budgetRow: {
    gap: 5,
  },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetName: {
    fontSize: 13,
    fontWeight: '700',
  },
  budgetFigures: {
    fontSize: 12,
    fontWeight: '600',
  },
  budgetTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  budgetFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFootRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetPctText: {
    fontSize: 11,
    fontWeight: '800',
  },
  budgetRemaining: {
    fontSize: 11,
  },
});
