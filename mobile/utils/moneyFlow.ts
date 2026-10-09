/**
 * Money-flow rules shared by the app's screens. Pure functions: no React, no network.
 * Mirrors IncomeRules.java and the website's money-flow.js so every surface agrees.
 *
 * - An income belongs to the month it COUNTS TOWARD (`countsTowardMonth`, "YYYY-MM"),
 *   which is the month of its date unless it was assigned elsewhere (next month's
 *   salary credited on the 30th).
 * - A REIMBURSEMENT is money handed back for something already paid. It is not income:
 *   it reduces what was spent.
 */

export type IncomeKind = 'SALARY' | 'OTHER' | 'REIMBURSEMENT';

export interface FlowIncome {
  amount?: number | string | null;
  source?: string | null;
  incomeDate?: string | null;
  kind?: string | null;
  countsTowardMonth?: string | null;
}

export interface FlowExpense {
  amount?: number | string | null;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function amountOf(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** "YYYY-MM" for a Date or a "YYYY-MM-DD…" string; "" when there is nothing usable. */
export function monthKey(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  const text = String(value).slice(0, 7);
  return MONTH_RE.test(text) ? text : '';
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** SALARY, OTHER or REIMBURSEMENT. Older records have no kind: "salary" in the source means salary. */
export function kindOf(income: FlowIncome): IncomeKind {
  const raw = String(income.kind || '').toUpperCase();
  if (raw === 'SALARY' || raw === 'OTHER' || raw === 'REIMBURSEMENT') return raw;
  return /salary/i.test(income.source || '') ? 'SALARY' : 'OTHER';
}

/** The month an income counts toward. */
export function effectiveMonth(income: FlowIncome): string {
  const stored = income.countsTowardMonth;
  if (typeof stored === 'string' && MONTH_RE.test(stored)) return stored;
  return monthKey(income.incomeDate);
}

/** Total of everything that is real income (reimbursements excluded). */
export function earnedTotal(incomes: FlowIncome[]): number {
  return incomes
    .filter((i) => kindOf(i) !== 'REIMBURSEMENT')
    .reduce((sum, i) => sum + amountOf(i.amount), 0);
}

/** Total of money handed back. */
export function reimbursedTotal(incomes: FlowIncome[]): number {
  return incomes
    .filter((i) => kindOf(i) === 'REIMBURSEMENT')
    .reduce((sum, i) => sum + amountOf(i.amount), 0);
}

/** Spending net of money that came back. A refund bigger than the spending never makes it negative. */
export function netSpent(expenses: FlowExpense[], incomes: FlowIncome[]): number {
  const gross = expenses.reduce((sum, e) => sum + amountOf(e.amount), 0);
  return Math.max(0, gross - reimbursedTotal(incomes));
}
