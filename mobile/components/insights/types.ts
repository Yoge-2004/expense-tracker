import { Ionicons } from '@expo/vector-icons';
/**
 * @file types.ts
 * @description Type definitions for financial intelligence and ML insight components.
 */

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

export interface IncomeItem {
  id: number;
  source: string;
  amount: number;
  incomeDate: string;
  description?: string;
  isRecurring?: boolean;
  recurring?: boolean;
  kind?: string | null;
  countsTowardMonth?: string | null;
}

export interface SavingsGoalItem {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  isRecurring?: boolean;
  recurringAmount?: number;
}

export interface DetailedInsightModalData {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  headline: string;
  metrics: { label: string; value: string }[];
  advice: string;
}

export interface ForecastPoint {
  date: string;
  amount: number;
}

export interface MlForecastData {
  total: number;
  days: number;
  points: ForecastPoint[];
}

export interface MlForecastStatus {
  isCalibrated: boolean;
  daysRecorded: number;
  requiredDays: number;
}

export interface AnomalyOutlier {
  id?: number;
  desc: string;
  amount: number;
  score: number;
  date?: string;
  category?: string;
}

export interface MlAnomalyData {
  count: number;
  topOutlier?: AnomalyOutlier;
  allOutliers?: AnomalyOutlier[];
}

export interface BurnoutCandidate {
  categoryName: string;
  spent: number;
  limit: number;
  daysRemainingUntilDepletion: number;
  dailyCategoryRate: number;
}

export interface InsightMetrics {
  currentMonthSpent: number;
  dailyBurn: number;
  projectedSpent: number;
  essentialSpent: number;
  discretionarySpent: number;
  discretionaryPct: number;
  potentialSavings: number;
  weekendSpent: number;
  weekdaySpent: number;
  avgWeekendTx: number;
  avgWeekdayTx: number;
  weekendMultiplier: string;
  governanceScore: number;
  breachedBudgetsCount: number;
  warningBudgetsCount: number;
  burnout: BurnoutCandidate | null;
  txCount: number;
  avgTicketSize: number;
  txPerDay: string;
  peak: ExpenseItem | null;
  recurringTotal: number;
  recurringRatio: number;
  activeInflow: number;
  netCashFlow: number;
  savingsRate: number;
  totalGoalsTarget: number;
  totalGoalsCurrent: number;
  totalGoalsRemaining: number;
  goalsFundingPct: number;
  monthsToFundGoals: number | null;
  recurringChitTotal: number;
  totalCommittedOverhead: number;
  commitmentAutonomyRatio: number;
  salaryInflow: number;
  otherInflow: number;
  salarySharePct: number;
  salaryCoverageRatio: number;
  emergencyRunwayMonths: string;
}

export interface InsightCardsProps {
  /** Array of expense transactions. */
  expenses: ExpenseItem[];
  /** Array of budget limits with spent amounts. */
  budgets: BudgetStatus[];
  /** Inflow transaction collection. */
  incomes?: IncomeItem[];
  /** Savings milestones and targets. */
  savingsGoals?: SavingsGoalItem[];
}
