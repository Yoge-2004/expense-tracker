/**
 * Pure helpers for comparing a ledger kept on this device with the one the server returns,
 * and for working out which device records the server is missing.
 *
 * Nothing here touches the network or storage, so every rule is unit-testable. The guiding rules:
 *  - records are matched by what they say (date, amount, text, category NAME), never by database id,
 *    because ids are reassigned when a database is restored;
 *  - matching is by multiset, so two genuinely identical records stay two records;
 *  - the plan only ever ADDS missing records; it never edits or deletes anything on the server.
 */

export interface LedgerData {
  expenses?: any[];
  incomes?: any[];
  budgets?: any[];
  categories?: any[];
  subscriptions?: any[];
  savingsGoals?: any[];
  loans?: any[];
  [key: string]: unknown;
}

export interface RestorePlan {
  categories: string[];
  expenses: any[];
  incomes: any[];
  goals: any[];
  loans: any[];
  budgets: any[];
  subscriptions: any[];
}

/** Lists that make up "the user's data" when deciding whether one copy is bigger than another. */
const COUNTED_LISTS = ['expenses', 'incomes', 'savingsGoals', 'loans', 'subscriptions', 'budgets'] as const;

/** A drop of more than this share between two copies is treated as a probable loss, not a normal edit. */
export const SUSPICIOUS_DROP_RATIO = 0.7;
/** Below this many records a drop is just normal editing. */
export const SUSPICIOUS_DROP_MIN_RECORDS = 5;

export function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

/** Accepts "2026-05-12", "2026-05-12T10:00:00" or Jackson's [2026,5,12] array form. */
export function isoDate(value: unknown): string {
  if (Array.isArray(value) && value.length >= 3) {
    return `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`;
  }
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function ledgerRichness(data: LedgerData | null | undefined): number {
  if (!data) return 0;
  return COUNTED_LISTS.reduce((sum, key) => sum + list(data[key]).length, 0);
}

/** True when `incoming` is so much smaller than `previous` that the earlier copy should be kept aside. */
export function isSuspiciousDrop(previous: LedgerData | null | undefined, incoming: LedgerData | null | undefined): boolean {
  const before = ledgerRichness(previous);
  const after = ledgerRichness(incoming);
  return before >= SUSPICIOUS_DROP_MIN_RECORDS && after < before * SUSPICIOUS_DROP_RATIO;
}

const categoryKey = (r: any): string => norm(r?.categoryName) || (r?.categoryId != null ? `#${r.categoryId}` : '');

export const signatures = {
  expense: (e: any) => [isoDate(e?.expenseDate), money(e?.amount), norm(e?.description), categoryKey(e)].join('|'),
  income: (i: any) =>
    [
      isoDate(i?.incomeDate), money(i?.amount), norm(i?.source) || 'other', norm(i?.description),
      norm(i?.kind), i?.isRecurring ? '1' : '0', norm(i?.frequency),
    ].join('|'),
  goal: (g: any) => norm(g?.name),
  loan: (l: any) => [norm(l?.counterparty), norm(l?.type), money(l?.amount), isoDate(l?.adjustmentDate)].join('|'),
  budget: (b: any) => [categoryKey(b), norm(b?.period)].join('|'),
  subscription: (s: any) =>
    [norm(s?.description), money(s?.amount), norm(s?.frequency), String(s?.intervalDays ?? ''), categoryKey(s)].join('|'),
};

/** Device records the server does not have, counting duplicates (3 on device vs 1 on server -> 2 missing). */
export function multisetMissing<T>(device: T[], server: T[], sig: (t: T) => string): T[] {
  const available = new Map<string, number>();
  for (const item of server) {
    const key = sig(item);
    available.set(key, (available.get(key) ?? 0) + 1);
  }
  const missing: T[] = [];
  for (const item of device) {
    const key = sig(item);
    const left = available.get(key) ?? 0;
    if (left > 0) available.set(key, left - 1);
    else missing.push(item);
  }
  return missing;
}

export function buildRestorePlan(device: LedgerData, server: LedgerData): RestorePlan {
  const serverCategoryNames = new Set(list(server.categories).map((c) => norm(c?.name)));
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const c of list(device.categories)) {
    const key = norm(c?.name);
    if (key && !serverCategoryNames.has(key) && !seen.has(key)) {
      seen.add(key);
      categories.push(String(c.name).trim());
    }
  }
  return {
    categories,
    expenses: multisetMissing(list(device.expenses), list(server.expenses), signatures.expense),
    incomes: multisetMissing(list(device.incomes), list(server.incomes), signatures.income),
    goals: multisetMissing(list(device.savingsGoals), list(server.savingsGoals), signatures.goal),
    loans: multisetMissing(list(device.loans), list(server.loans), signatures.loan),
    budgets: multisetMissing(list(device.budgets), list(server.budgets), signatures.budget),
    subscriptions: multisetMissing(list(device.subscriptions), list(server.subscriptions), signatures.subscription),
  };
}

export function planTotal(plan: RestorePlan): number {
  return (
    plan.categories.length + plan.expenses.length + plan.incomes.length + plan.goals.length +
    plan.loans.length + plan.budgets.length + plan.subscriptions.length
  );
}

/** Drops null/undefined/NaN so optional DTO fields are simply omitted. */
export function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

type CategoryIds = Map<string, number>;

export const bodies = {
  expense: (e: any, cats: CategoryIds) => {
    const categoryId = cats.get(norm(e?.categoryName));
    return categoryId == null
      ? null
      : { amount: Number(e.amount), description: e.description ?? '', expenseDate: isoDate(e.expenseDate), categoryId };
  },
  income: (i: any) =>
    clean({
      amount: Number(i.amount), source: String(i.source ?? '').trim() || 'Other', description: i.description ?? '',
      incomeDate: isoDate(i.incomeDate), isRecurring: !!i.isRecurring, frequency: i.frequency,
      intervalDays: i.intervalDays, kind: i.kind, countsTowardMonth: i.countsTowardMonth,
    }),
  goal: (g: any) =>
    clean({
      name: g.name, targetAmount: Number(g.targetAmount), currentAmount: Number(g.currentAmount ?? 0),
      targetDate: g.targetDate ? isoDate(g.targetDate) : undefined, status: g.status, isRecurring: g.isRecurring,
      recurringAmount: g.recurringAmount, frequency: g.frequency, intervalDays: g.intervalDays,
      nextDueDate: g.nextDueDate ? isoDate(g.nextDueDate) : undefined,
    }),
  // expenseId is deliberately left out: expense ids change when a database is restored.
  loan: (l: any) =>
    clean({
      counterparty: l.counterparty, type: l.type, amount: Number(l.amount), adjustmentDate: isoDate(l.adjustmentDate),
      dueDate: l.dueDate ? isoDate(l.dueDate) : undefined, notes: l.notes, isSettled: !!l.isSettled,
      reminderEnabled: l.reminderEnabled, reminderDate: l.reminderDate ? isoDate(l.reminderDate) : undefined,
      reminderTime: l.reminderTime,
    }),
  budget: (b: any, cats: CategoryIds) => {
    const categoryId = cats.get(norm(b?.categoryName));
    return categoryId == null
      ? null
      : clean({
          categoryId, limitAmount: Number(b.limit), period: b.period, intervalDays: b.intervalDays,
          startDate: b.startDate ? isoDate(b.startDate) : undefined,
        });
  },
  subscription: (s: any, cats: CategoryIds) => {
    const categoryId = cats.get(norm(s?.categoryName));
    return categoryId == null
      ? null
      : clean({
          amount: Number(s.amount), description: s.description ?? '', expenseDate: isoDate(s.expenseDate),
          categoryId, frequency: s.frequency, intervalDays: s.intervalDays, isRecurring: true,
        });
  },
};
