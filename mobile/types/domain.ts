/**
 * @file domain.ts
 * @description Central Domain Entities and Models for the Expense Tracker Mobile Application.
 * Follows DDD and SOLID principles (Interface Segregation, Type Safety).
 */

export type CurrencyCode = string;

// --- Category ---
export interface Category {
  id: number;
  name: string;
  isCustom?: boolean;
  userId?: number | string | null;
  icon?: string;
  color?: string;
}

export interface CategoryRequest {
  name: string;
  icon?: string;
  color?: string;
}

// --- Expense ---
export interface Expense {
  id: number;
  description: string;
  amount: number;
  expenseDate: string;
  categoryId?: number;
  categoryName?: string;
  userId?: number | string;
  isRecurring?: boolean;
  recurring?: boolean;
  notes?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExpenseRequest {
  description: string;
  amount: number;
  expenseDate: string;
  categoryId?: number | string;
  isRecurring?: boolean;
  notes?: string;
}

export interface RecurringExpense {
  id: number;
  description: string;
  amount: number;
  nextDueDate: string;
  frequency: string;
  categoryId: number;
  categoryName?: string;
  intervalDays?: number;
  userId?: number | string;
  isActive?: boolean;
}

// --- Income ---
export type IncomeKind = 'SALARY' | 'FREELANCE' | 'INVESTMENT' | 'REIMBURSEMENT' | 'GIFT' | 'OTHER';

export interface Income {
  id: number;
  source: string;
  amount: number;
  incomeDate: string;
  description?: string;
  isRecurring?: boolean;
  frequency?: string;
  intervalDays?: number | string;
  kind?: IncomeKind | string | null;
  countsTowardMonth?: string | null;
  reimbursedCategoryId?: number | string | null;
  userId?: number | string;
}

export interface IncomeRequest {
  source: string;
  amount: number;
  incomeDate: string;
  description?: string;
  isRecurring?: boolean;
  frequency?: string | null;
  intervalDays?: number | null;
  kind?: IncomeKind | string | null;
  countsTowardMonth?: string | null;
  reimbursedCategoryId?: number | string | null;
}

// --- Budget ---
export interface Budget {
  budgetId?: number;
  id?: number;
  categoryId: number;
  categoryName?: string;
  amount: number;
  spent?: number;
  remaining?: number;
  percentage?: number;
  period?: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  userId?: number | string;
}

export interface BudgetStatus {
  budgetId?: number;
  categoryId: number;
  categoryName: string;
  budgetAmount: number;
  currentSpending: number;
  percentageSpent: number;
  status: 'SAFE' | 'WARNING' | 'EXCEEDED';
  remaining: number;
}

export interface BudgetRequest {
  categoryId: number | string;
  amount: number;
  period?: string;
}

// --- Savings Goal ---
export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  recurringAmount?: number;
  frequency?: string;
  intervalDays?: number;
  nextDueDate?: string;
  status?: string;
  progressPercentage?: number;
  isRecurring?: boolean;
  userId?: number | string;
}

export interface SavingsGoalRequest {
  name: string;
  targetAmount: number;
  currentAmount?: number | null;
  targetDate?: string | null;
  recurringAmount?: number | null;
  frequency?: string | null;
  intervalDays?: number | null;
  nextDueDate?: string | null;
  isRecurring?: boolean;
}

// --- User Profile & Appearance ---
export interface UserProfile {
  id: number | string;
  username: string;
  email: string;
  fullName?: string;
  profilePictureUrl?: string | null;
  currency?: string;
  theme?: 'light' | 'dark';
  hasPin?: boolean;
  role?: string;
  createdAt?: string;
}

export interface UserAppearance {
  theme: 'light' | 'dark';
  fontChoice?: string;
  customPalette?: Record<string, string> | null;
  backgroundAsset?: Record<string, unknown> | null;
}

// --- Loan & Adjustments ---
export type LoanType = 'LENT' | 'BORROWED';

export interface LoanAdjustment {
  id: number;
  counterparty: string;
  type: LoanType;
  amount: number;
  adjustmentDate: string;
  dueDate?: string | null;
  notes?: string | null;
  isSettled: boolean;
  settledDate?: string | null;
  expenseId?: number | null;
  expenseDescription?: string | null;
  expenseAmount?: number | null;
  reminderEnabled?: boolean;
  reminderDate?: string | null;
  reminderTime?: string | null;
  reminderFrequency?: string | null;
  createdAt?: string;
}

export interface LoanAdjustmentRequest {
  counterparty: string;
  type: LoanType;
  amount: number;
  adjustmentDate: string;
  dueDate?: string | null;
  notes?: string | null;
  isSettled?: boolean;
  expenseId?: number | null;
  reminderEnabled?: boolean;
  reminderDate?: string | null;
  reminderTime?: string | null;
  reminderFrequency?: string | null;
}

export interface LoanMetrics {
  totalLent: number;
  totalBorrowed: number;
  lentPending: number;
  borrowedPending: number;
  netBalance: number;
  totalCount: number;
  pendingCount: number;
  settledCount: number;
}
