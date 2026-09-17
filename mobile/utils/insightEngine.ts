/**
 * INSIGHT ENGINE (mobile)
 *
 * Typed port of `frontend/js/modules/insight-engine.js`.
 *
 * ---------------------------------------------------------------------------
 * KEEP IN SYNC. These two files implement the same analyses and must stay
 * behaviourally identical — an insight that says one thing on the dashboard
 * and another in the app is worse than no insight.
 *
 * They are separate files rather than one shared module because Metro
 * resolves from the `mobile/` project root by default, and reaching
 * `../frontend/` requires a `watchFolders` config change that cannot be
 * verified without running the bundler. If that config is added later, this
 * file should be deleted in favour of importing the canonical one.
 *
 * What this port adds over the JS original: real types. The web version
 * takes `any[]`; this one will fail compilation if the API shape drifts.
 * ---------------------------------------------------------------------------
 *
 * Design rules carried over unchanged:
 *   1. Never assert more certainty than the data supports.
 *   2. Stay silent below each insight's minimum-evidence bar.
 *   3. No fabricated precision.
 */

export interface ExpenseLike {
  amount: number | string;
  expenseDate: string;
  categoryName?: string | null;
  description?: string | null;
  isRecurring?: boolean;
  recurring?: boolean;
}

export interface IncomeLike {
  amount: number | string;
  incomeDate: string;
}

export interface GoalLike {
  name: string;
  targetAmount: number | string;
  currentAmount?: number | string;
}

export type InsightKind = 'caution' | 'positive' | 'informational';
export type InsightConfidence = 'low' | 'moderate' | 'high';

export interface Insight {
  id: string;
  kind: InsightKind;
  confidence: InsightConfidence;
  summary: string;
  magnitude?: number;
  category?: string;
  amount?: number;
  categoryMean?: number;
  projected?: number;
  averageAmount?: number;
  label?: string;
  cadence?: string;
  occurrences?: number;
  goal?: string;
  monthsToGoal?: number | null;
}

/* ---------------------------------------------------------------------------
 * Date handling.
 * `new Date('2026-03-04')` parses as UTC midnight, which renders as the 3rd in
 * any timezone behind UTC — silently moving transactions across month
 * boundaries and corrupting every monthly bucket. Parse date-only as local.
 * ------------------------------------------------------------------------- */
export function parseLocalDate(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) return value;
  if (value == null) return null;
  const dateOnly = String(value).split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    if ([y, m, d].every(Number.isFinite)) return new Date(y, m - 1, d);
  }
  const fallback = new Date(String(value));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function monthKey(date: Date | null): string | null {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]): number => (xs.length ? sum(xs) / xs.length : 0);

const stdDev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(sum(xs.map((v) => (v - m) ** 2)) / (xs.length - 1));
};

interface Buckets<T> {
  totals: Map<string, number>;
  items: Map<string, T[]>;
}

/**
 * Buckets by month. Takes a date-extractor rather than a key name: the
 * original `keyof T` form forced callers to satisfy
 * `Record<string, unknown>`, which interfaces cannot do (no index
 * signature). A function keeps this fully typed with no casts.
 */
function bucketByMonth<T extends { amount: number | string }>(
  txs: T[],
  getDate: (tx: T) => string
): Buckets<T> {
  const totals = new Map<string, number>();
  const items = new Map<string, T[]>();
  for (const tx of txs) {
    const key = monthKey(parseLocalDate(getDate(tx)));
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + num(tx.amount));
    if (!items.has(key)) items.set(key, []);
    items.get(key)!.push(tx);
  }
  return { totals, items };
}

const completedMonths = (totals: Map<string, number>, now: Date): string[] => {
  const current = monthKey(now)!;
  return [...totals.keys()].filter((k) => k < current).sort();
};

/* --- I1: month-over-month vs trailing baseline (needs 2 completed months) - */
export function monthOverMonth(expenses: ExpenseLike[], now = new Date()): Insight | null {
  const { totals } = bucketByMonth(expenses, (t) => t.expenseDate);
  const done = completedMonths(totals, now);
  if (done.length < 2) return null;

  const keys = done.slice(-3);
  const baseline = mean(keys.map((k) => totals.get(k) ?? 0));
  if (baseline <= 0) return null;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsed = Math.min(now.getDate(), daysInMonth);
  // Compare like with like — a partial month against a full-month mean always
  // looks low, so pro-rate the baseline to the elapsed fraction.
  const proRated = baseline * (elapsed / daysInMonth);
  const current = totals.get(monthKey(now)!) ?? 0;
  if (proRated <= 0) return null;

  const delta = Math.round(((current - proRated) / Math.abs(proRated)) * 100);

  return {
    id: 'month-over-month',
    kind: delta > 0 ? 'caution' : 'positive',
    confidence: keys.length >= 3 ? 'high' : 'moderate',
    magnitude: Math.abs(delta),
    summary:
      Math.abs(delta) < 5
        ? `Spending is tracking in line with your ${keys.length}-month average.`
        : `Spending is running ${Math.abs(delta)}% ${delta > 0 ? 'above' : 'below'} your ${keys.length}-month average for this point in the month.`,
  };
}

/* --- I2: per-category trend (needs 3 completed months in that category) --- */
export function categoryTrends(expenses: ExpenseLike[], now = new Date(), limit = 3): Insight[] {
  const byCat = new Map<string, ExpenseLike[]>();
  for (const tx of expenses) {
    const name = tx.categoryName || 'Uncategorized';
    if (!byCat.has(name)) byCat.set(name, []);
    byCat.get(name)!.push(tx);
  }

  const out: Insight[] = [];
  for (const [name, txs] of byCat) {
    const { totals } = bucketByMonth(txs, (t) => t.expenseDate);
    const done = completedMonths(totals, now);
    if (done.length < 3) continue;

    const series = done.slice(-6).map((k) => totals.get(k) ?? 0);
    const avg = mean(series);
    if (avg <= 0) continue;

    // Least-squares slope, normalised against the category's own average so
    // large and small categories remain comparable.
    const n = series.length;
    const xMean = (n - 1) / 2;
    let numr = 0;
    let den = 0;
    series.forEach((y, x) => {
      numr += (x - xMean) * (y - avg);
      den += (x - xMean) ** 2;
    });
    if (den === 0) continue;

    const slopePct = Math.round((numr / den / avg) * 100);
    if (Math.abs(slopePct) < 8) continue; // below this it's noise, not a trend

    out.push({
      id: `category-trend:${name}`,
      kind: slopePct > 0 ? 'caution' : 'positive',
      confidence: n >= 5 ? 'high' : 'moderate',
      category: name,
      magnitude: Math.abs(slopePct),
      summary: `${name} is trending ${slopePct > 0 ? 'up' : 'down'} about ${Math.abs(slopePct)}% per month across your last ${n} months.`,
    });
  }

  return out.sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0)).slice(0, limit);
}

/* --- I3: anomaly vs the user's own category baseline (needs 6 samples) ---- */
export function anomalies(expenses: ExpenseLike[], now = new Date(), limit = 3): Insight[] {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const byCat = new Map<string, ExpenseLike[]>();
  for (const tx of expenses) {
    const name = tx.categoryName || 'Uncategorized';
    if (!byCat.has(name)) byCat.set(name, []);
    byCat.get(name)!.push(tx);
  }

  const out: Insight[] = [];
  for (const [name, txs] of byCat) {
    const amounts = txs.map((t) => num(t.amount)).filter((a) => a > 0);
    if (amounts.length < 6) continue;

    const m = mean(amounts);
    const sd = stdDev(amounts);
    // A near-constant category (a fixed subscription) has ~zero deviation, so
    // every tiny wobble would read as a multi-sigma event. Require spread.
    if (sd <= 0 || sd / m < 0.15) continue;

    for (const tx of txs) {
      const d = parseLocalDate(tx.expenseDate);
      if (!d || d < cutoff || d > now) continue;
      const amt = num(tx.amount);
      const z = (amt - m) / sd;
      if (z < 2) continue;

      out.push({
        id: `anomaly:${name}:${tx.expenseDate}:${amt}`,
        kind: 'caution',
        confidence: amounts.length >= 12 ? 'high' : 'moderate',
        category: name,
        amount: amt,
        categoryMean: m,
        magnitude: z,
        summary: `A ${name} charge came in well above your usual for that category.`,
      });
    }
  }

  return out.sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0)).slice(0, limit);
}

/* --- I4: recurring-charge detection (needs 3 occurrences) ----------------- */
const normalizeDescription = (text?: string | null): string =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[0-9]+/g, '') // strip invoice/order numbers
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function detectRecurring(expenses: ExpenseLike[], now = new Date(), limit = 3): Insight[] {
  const groups = new Map<string, ExpenseLike[]>();
  for (const tx of expenses) {
    const key = normalizeDescription(tx.description);
    if (key.length < 3) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const out: Insight[] = [];
  for (const [key, txs] of groups) {
    if (txs.length < 3) continue;
    if (txs.some((t) => t.isRecurring || t.recurring)) continue; // already flagged

    const dated = txs
      .map((tx) => ({ tx, date: parseLocalDate(tx.expenseDate) }))
      .filter((x): x is { tx: ExpenseLike; date: Date } => x.date !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (dated.length < 3) continue;

    const gaps: number[] = [];
    for (let i = 1; i < dated.length; i++) {
      gaps.push((dated[i].date.getTime() - dated[i - 1].date.getTime()) / 86400000);
    }
    const gapMean = mean(gaps);
    // Regular cadence within a plausible billing range (weekly -> quarterly).
    if (gapMean < 6 || gapMean > 95) continue;
    if (stdDev(gaps) / gapMean > 0.25) continue;

    const amounts = dated.map((x) => num(x.tx.amount));
    const amtMean = mean(amounts);
    if (amtMean <= 0 || stdDev(amounts) / amtMean > 0.12) continue; // near-constant

    const cadence =
      gapMean < 10 ? 'weekly' : gapMean < 18 ? 'fortnightly' : gapMean < 45 ? 'monthly' : 'quarterly';
    const label = dated[dated.length - 1].tx.description || key;

    out.push({
      id: `recurring:${key}`,
      kind: 'informational',
      confidence: dated.length >= 5 ? 'high' : 'moderate',
      label,
      cadence,
      occurrences: dated.length,
      averageAmount: amtMean,
      magnitude: amtMean,
      summary: `"${label}" looks like a ${cadence} charge you haven't marked as recurring — ${dated.length} occurrences so far.`,
    });
  }

  return out.sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0)).slice(0, limit);
}

/* --- I5: weekday-weighted month-end projection --------------------------- */
export function projection(expenses: ExpenseLike[], now = new Date()): Insight {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = Math.min(now.getDate(), daysInMonth);
  const { totals, items } = bucketByMonth(expenses, (t) => t.expenseDate);
  const spentSoFar = totals.get(monthKey(now)!) ?? 0;
  const done = completedMonths(totals, now);
  const linear = today > 0 ? (spentSoFar / today) * daysInMonth : 0;

  const fallback: Insight = {
    id: 'projection',
    kind: 'informational',
    confidence: 'low',
    projected: linear,
    summary: 'Not enough history yet for a weighted forecast — this is a simple straight-line pace.',
  };
  if (done.length < 1) return fallback;

  const dowTotals = new Array(7).fill(0) as number[];
  let historyTotal = 0;
  for (const key of done.slice(-6)) {
    for (const tx of items.get(key) ?? []) {
      const d = parseLocalDate(tx.expenseDate);
      if (!d) continue;
      dowTotals[d.getDay()] += num(tx.amount);
      historyTotal += num(tx.amount);
    }
  }
  if (historyTotal <= 0) return fallback;

  const dowWeight = dowTotals.map((t) => (t / historyTotal) * 7);
  let elapsedWeight = 0;
  let totalWeight = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const w = dowWeight[new Date(now.getFullYear(), now.getMonth(), day).getDay()] || 1;
    totalWeight += w;
    if (day <= today) elapsedWeight += w;
  }

  const projected = elapsedWeight > 0 ? spentSoFar * (totalWeight / elapsedWeight) : linear;

  return {
    id: 'projection',
    kind: 'informational',
    confidence: done.length >= 3 ? 'high' : 'moderate',
    projected,
    summary: 'On your current pace, this is roughly where the month lands — weighted by which days you actually tend to spend on.',
  };
}

/* --- I6: day-of-week concentration (needs 20 transactions) --------------- */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function temporalPattern(expenses: ExpenseLike[]): Insight | null {
  const dated = expenses
    .map((t) => ({ amt: num(t.amount), date: parseLocalDate(t.expenseDate) }))
    .filter((x): x is { amt: number; date: Date } => x.date !== null && x.amt > 0);
  if (dated.length < 20) return null;

  const dow = new Array(7).fill(0) as number[];
  for (const x of dated) dow[x.date.getDay()] += x.amt;
  const total = sum(dow);
  if (total <= 0) return null;

  const weekendShare = Math.round(((dow[0] + dow[6]) / total) * 100);
  let peak = 0;
  for (let i = 1; i < 7; i++) if (dow[i] > dow[peak]) peak = i;
  const peakShare = Math.round((dow[peak] / total) * 100);

  // Even split is ~14%/day and ~29% weekend — only speak up beyond chance.
  if (peakShare < 22 && weekendShare < 40) return null;

  return {
    id: 'temporal-pattern',
    kind: 'informational',
    confidence: dated.length >= 60 ? 'high' : 'moderate',
    magnitude: peakShare,
    summary:
      weekendShare >= 40
        ? `Weekends account for ${weekendShare}% of your spending.`
        : `${DAY_NAMES[peak]} is consistently your heaviest spending day, at ${peakShare}% of total.`,
  };
}

/* --- I7: goal feasibility from realized surplus (needs 2 months) --------- */
export function goalFeasibility(
  goals: GoalLike[],
  expenses: ExpenseLike[],
  incomes: IncomeLike[],
  now = new Date(),
  limit = 2
): Insight[] {
  if (!goals?.length) return [];

  const exp = bucketByMonth(expenses, (t) => t.expenseDate).totals;
  const inc = bucketByMonth(incomes, (t) => t.incomeDate).totals;
  const months = completedMonths(exp, now).filter((k) => inc.has(k));
  if (months.length < 2) return [];

  const recent = months.slice(-3);
  const surplus = mean(recent.map((k) => (inc.get(k) ?? 0) - (exp.get(k) ?? 0)));

  const out: Insight[] = [];
  for (const goal of goals) {
    const target = num(goal.targetAmount);
    const remaining = target - num(goal.currentAmount);
    if (target <= 0 || remaining <= 0) continue;

    if (surplus <= 0) {
      out.push({
        id: `goal:${goal.name}`,
        kind: 'caution',
        confidence: recent.length >= 3 ? 'high' : 'moderate',
        goal: goal.name,
        monthsToGoal: null,
        magnitude: remaining,
        summary: `"${goal.name}" isn't currently funded — recent months averaged no surplus to put toward it.`,
      });
      continue;
    }

    const monthsToGoal = Math.ceil(remaining / surplus);
    out.push({
      id: `goal:${goal.name}`,
      kind: monthsToGoal <= 12 ? 'positive' : 'informational',
      confidence: recent.length >= 3 ? 'high' : 'moderate',
      goal: goal.name,
      monthsToGoal,
      magnitude: -monthsToGoal,
      summary: `At your recent average surplus, "${goal.name}" is roughly ${monthsToGoal} ${monthsToGoal === 1 ? 'month' : 'months'} away.`,
    });
  }

  return out.sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0)).slice(0, limit);
}

export function generateInsights(
  data: { expenses?: ExpenseLike[]; incomes?: IncomeLike[]; goals?: GoalLike[] },
  now = new Date()
): Insight[] {
  const expenses = data.expenses ?? [];
  const incomes = data.incomes ?? [];
  const goals = data.goals ?? [];

  const out: Insight[] = [];
  const mom = monthOverMonth(expenses, now);
  if (mom) out.push(mom);
  out.push(projection(expenses, now));
  out.push(...categoryTrends(expenses, now));
  out.push(...anomalies(expenses, now));
  out.push(...detectRecurring(expenses, now));
  const temporal = temporalPattern(expenses);
  if (temporal) out.push(temporal);
  out.push(...goalFeasibility(goals, expenses, incomes, now));

  const rank: Record<InsightKind, number> = { caution: 0, positive: 1, informational: 2 };
  return out.sort((a, b) => {
    const r = rank[a.kind] - rank[b.kind];
    return r !== 0 ? r : (b.magnitude ?? 0) - (a.magnitude ?? 0);
  });
}
