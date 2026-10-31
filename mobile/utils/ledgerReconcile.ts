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
  /**
   * Device records that look like a record the server already has in a changed form (same date and text but a
   * different amount, or the reverse). They are NOT uploaded: the server's version wins, and uploading would
   * create a near-duplicate or bring back something that was edited or deleted elsewhere.
   */
  conflicts: { expenses: any[]; incomes: any[]; loans: any[]; subscriptions: any[] };
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

/** Looser keys, tried in order, that identify "the same record, edited" for each entity. */
export const looseSignatures = {
  expense: [
    (e: any) => [isoDate(e?.expenseDate), norm(e?.description), categoryKey(e)].join('|'), // amount edited
    (e: any) => [isoDate(e?.expenseDate), money(e?.amount), categoryKey(e)].join('|'), // description edited
  ],
  income: [
    (i: any) => [isoDate(i?.incomeDate), norm(i?.source) || 'other', norm(i?.description), norm(i?.kind)].join('|'),
    (i: any) => [isoDate(i?.incomeDate), money(i?.amount), norm(i?.source) || 'other'].join('|'),
  ],
  loan: [(l: any) => [norm(l?.counterparty), norm(l?.type), isoDate(l?.adjustmentDate)].join('|')],
  subscription: [(s: any) => [norm(s?.description), norm(s?.frequency), categoryKey(s)].join('|')],
};

/** Exact multiset diff that also returns the server records no device record matched. */
export function multisetDiff<T>(device: T[], server: T[], sig: (t: T) => string): { missing: T[]; unmatchedServer: T[] } {
  const buckets = new Map<string, T[]>();
  for (const item of server) {
    const key = sig(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  const missing: T[] = [];
  for (const item of device) {
    const bucket = buckets.get(sig(item));
    if (bucket && bucket.length > 0) bucket.pop();
    else missing.push(item);
  }
  return { missing, unmatchedServer: [...buckets.values()].flat() };
}

/** Splits `missing` into records that are really absent and records that look like edited server records. */
function separateConflicts<T>(
  missing: T[],
  unmatchedServer: T[],
  passes: Array<(t: T) => string>
): { missing: T[]; conflicts: T[] } {
  let remaining = missing;
  let leftover = unmatchedServer;
  const conflicts: T[] = [];
  for (const key of passes) {
    const pool = new Map<string, number>();
    for (const item of leftover) pool.set(key(item), (pool.get(key(item)) ?? 0) + 1);
    const stillMissing: T[] = [];
    const used = new Map<string, number>();
    for (const item of remaining) {
      const k = key(item);
      const available = (pool.get(k) ?? 0) - (used.get(k) ?? 0);
      if (available > 0) {
        used.set(k, (used.get(k) ?? 0) + 1);
        conflicts.push(item);
      } else {
        stillMissing.push(item);
      }
    }
    // server records consumed by this pass cannot be claimed again by the next one
    const consumed = new Map(used);
    leftover = leftover.filter((item) => {
      const k = key(item);
      const c = consumed.get(k) ?? 0;
      if (c > 0) { consumed.set(k, c - 1); return false; }
      return true;
    });
    remaining = stillMissing;
  }
  return { missing: remaining, conflicts };
}

function diffWithConflicts<T>(device: T[], server: T[], sig: (t: T) => string, passes: Array<(t: T) => string>) {
  const { missing, unmatchedServer } = multisetDiff(device, server, sig);
  return separateConflicts(missing, unmatchedServer, passes);
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
  const expenses = diffWithConflicts(list(device.expenses), list(server.expenses), signatures.expense, looseSignatures.expense);
  const incomes = diffWithConflicts(list(device.incomes), list(server.incomes), signatures.income, looseSignatures.income);
  const loans = diffWithConflicts(list(device.loans), list(server.loans), signatures.loan, looseSignatures.loan);
  const subscriptions = diffWithConflicts(
    list(device.subscriptions), list(server.subscriptions), signatures.subscription, looseSignatures.subscription
  );
  return {
    categories,
    expenses: expenses.missing,
    incomes: incomes.missing,
    goals: multisetMissing(list(device.savingsGoals), list(server.savingsGoals), signatures.goal),
    loans: loans.missing,
    budgets: multisetMissing(list(device.budgets), list(server.budgets), signatures.budget),
    subscriptions: subscriptions.missing,
    conflicts: {
      expenses: expenses.conflicts, incomes: incomes.conflicts, loans: loans.conflicts, subscriptions: subscriptions.conflicts,
    },
  };
}

/** Treats look-alike records as missing too: for when the owner chooses to upload them anyway. */
export function withConflictsIncluded(plan: RestorePlan): RestorePlan {
  const c = plan.conflicts;
  return {
    ...plan,
    expenses: [...plan.expenses, ...c.expenses],
    incomes: [...plan.incomes, ...c.incomes],
    loans: [...plan.loans, ...c.loans],
    subscriptions: [...plan.subscriptions, ...c.subscriptions],
    conflicts: { expenses: [], incomes: [], loans: [], subscriptions: [] },
  };
}

export function conflictTotal(plan: RestorePlan): number {
  const c = plan.conflicts;
  return c.expenses.length + c.incomes.length + c.loans.length + c.subscriptions.length;
}

/** Adds to `base` every record of `extra` it does not already contain (used when importing a device-copy file). */
export function mergeLedgers(base: LedgerData, extra: LedgerData): LedgerData {
  const merged: LedgerData = { ...base };
  const sigs: Record<string, (t: any) => string> = {
    expenses: signatures.expense, incomes: signatures.income, savingsGoals: signatures.goal, loans: signatures.loan,
    budgets: signatures.budget, subscriptions: signatures.subscription, categories: (c: any) => norm(c?.name),
  };
  for (const [key, sig] of Object.entries(sigs)) {
    const have = list(base[key]);
    merged[key] = [...have, ...multisetMissing(list(extra[key]), have, sig)];
  }
  return merged;
}

const labelOf = (kind: string, r: any): string => {
  const text = r?.description || r?.source || r?.name || r?.counterparty || r?.categoryName || kind;
  const date = isoDate(r?.expenseDate) || isoDate(r?.incomeDate) || isoDate(r?.adjustmentDate) || isoDate(r?.nextDueDate);
  const amount = r?.amount ?? r?.targetAmount ?? r?.limit;
  return [date, String(text).slice(0, 28), amount != null ? money(amount) : ''].filter(Boolean).join(' · ');
};

/** A few example lines per kind so a person can see what is about to be uploaded. */
export function planSamples(plan: RestorePlan, perKind = 2): string[] {
  const lines: string[] = [];
  const add = (kind: string, items: any[]) => items.slice(0, perKind).forEach((r) => lines.push(`${kind}: ${labelOf(kind, r)}`));
  add('Expense', plan.expenses);
  add('Income', plan.incomes);
  add('Goal', plan.goals);
  add('Loan', plan.loans);
  add('Budget', plan.budgets);
  add('Recurring', plan.subscriptions);
  return lines;
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

const toUtc = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Same clamping as Java's LocalDate.plusMonths: Jan 31 + 1 month = Feb 28/29. */
function shiftMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(ny, nm, Math.min(d, lastDay)));
}

/** Moves a date by `direction` (+1/-1) recurrence periods, matching the server's own nextOccurrence rules. */
export function shiftPeriod(iso: string, frequency: unknown, intervalDays: unknown, direction: 1 | -1): string {
  const f = String(frequency ?? 'MONTHLY').trim().toUpperCase();
  const day = 24 * 3600 * 1000;
  if (f === 'DAILY') return fromUtc(toUtc(iso) + direction * day);
  if (f === 'WEEKLY') return fromUtc(toUtc(iso) + direction * 7 * day);
  if (f === 'YEARLY') return shiftMonths(iso, direction * 12);
  if (f === 'CUSTOM') return fromUtc(toUtc(iso) + direction * Math.max(1, Number(intervalDays) || 1) * day);
  return shiftMonths(iso, direction);
}

/**
 * The server stores a recurring item's next due date as (start date + one period), and the list endpoint only
 * returns that next due date. To get the same next due date back, the start date to send is one period earlier.
 */
export function recurringStartDate(nextDue: string, frequency: unknown, intervalDays: unknown): string {
  const base = shiftPeriod(nextDue, frequency, intervalDays, -1);
  for (const delta of [0, 1, -1, 2, -2, 3, -3]) {
    const candidate = fromUtc(toUtc(base) + delta * 24 * 3600 * 1000);
    if (shiftPeriod(candidate, frequency, intervalDays, 1) === nextDue) return candidate;
  }
  return base;
}

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
          amount: Number(s.amount), description: s.description ?? '',
          expenseDate: isoDate(s.nextDueDate)
            ? recurringStartDate(isoDate(s.nextDueDate), s.frequency, s.intervalDays)
            : isoDate(s.expenseDate) || new Date().toISOString().slice(0, 10),
          categoryId, frequency: String(s.frequency ?? 'MONTHLY').toUpperCase(), intervalDays: s.intervalDays,
        });
  },
};
