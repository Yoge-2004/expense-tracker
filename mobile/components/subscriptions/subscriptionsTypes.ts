/**
 * @file subscriptionsTypes.ts
 * @description Type definitions and pure calculation utilities for Subscriptions
 * and Recurring financial commitments (Expenses, Incomes, Chit Funds / Savings).
 */

export interface Subscription {
  id: number;
  description: string;
  amount: number;
  nextDueDate: string;
  frequency: string;
  categoryId: number;
  categoryName?: string;
  intervalDays?: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface RecurringIncome {
  id: number;
  source: string;
  amount: number;
  frequency: string;
  intervalDays?: number;
  nextDueDate?: string;
  incomeDate?: string;
  description?: string;
  isRecurring?: boolean;
}

export interface RecurringSavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  recurringAmount: number;
  frequency: string;
  intervalDays?: number;
  nextDueDate?: string;
  targetDate?: string;
  status: string;
  progressPercentage?: number;
  isRecurring?: boolean;
}

export type SubscriptionFilterTab = 'all' | 'expenses' | 'incomes' | 'savings';

/**
 * Calculates calendar days remaining until the target due date.
 */
export function getDaysUntil(dateStr?: string): number {
  if (!dateStr) return 999;
  try {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
    let target: Date;
    if (match) {
      target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    } else {
      target = new Date(dateStr);
    }
    if (isNaN(target.getTime())) return 999;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

/**
 * Normalizes any frequency string to an approximate monthly run-rate.
 */
export function toMonthlyRate(amt: number, frequency?: string, intervalDays?: number): number {
  const safeAmt = Math.max(0, Number(amt || 0));
  const freq = (frequency || 'MONTHLY').toUpperCase();
  if (freq === 'DAILY') return safeAmt * 30;
  if (freq === 'WEEKLY') return safeAmt * 4.33;
  if (freq === 'BI_WEEKLY' || freq === 'BIWEEKLY') return safeAmt * 2.16;
  if (freq === 'YEARLY') return safeAmt / 12;
  if (freq === 'CUSTOM' && intervalDays && intervalDays > 0) return (safeAmt / intervalDays) * 30;
  return safeAmt;
}
