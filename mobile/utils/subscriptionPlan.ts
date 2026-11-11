/**
 * Subscription (recurring expense) rules shared by the app's screens. Pure functions.
 * Mirrors the website's money-flow.js so both surfaces agree.
 *
 * Charges that are already due become real "(Auto)" expenses on the server, so they are in the
 * totals. These helpers cover the rest: the charges still due this month, and a month-end
 * forecast that includes them without extrapolating them or counting them twice.
 */

export interface PlanSubscription {
  amount?: number | string | null;
  nextDueDate?: string | null;
  frequency?: string | null;
  intervalDays?: number | null;
}

export interface PlanExpense {
  amount?: number | string | null;
  description?: string | null;
  recurring?: boolean;
  isRecurring?: boolean;
}

function amountOf(value: number | string | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function parseDay(value?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function nextOccurrence(date: Date, frequency?: string | null, intervalDays?: number | null): Date {
  const d = new Date(date.getTime());
  switch (String(frequency || 'MONTHLY').toUpperCase()) {
    case 'DAILY':
      d.setDate(d.getDate() + 1);
      break;
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      break;
    case 'BI_WEEKLY':
    case 'BIWEEKLY':
      d.setDate(d.getDate() + 14);
      break;
    case 'YEARLY':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'CUSTOM':
      d.setDate(d.getDate() + (Number(intervalDays) > 0 ? Number(intervalDays) : 30));
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/** Subscription charges still to come after today and up to the end of today's month. */
export function upcomingSubscriptionCharges(
  subscriptions: PlanSubscription[],
  today: Date = new Date()
): { total: number; count: number } {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  let total = 0;
  let count = 0;
  for (const sub of subscriptions || []) {
    let due = parseDay(sub?.nextDueDate);
    const amount = amountOf(sub?.amount);
    if (!due || amount <= 0) continue;
    for (let guard = 0; due <= monthEnd && guard < 400; guard++) {
      if (due > startOfToday) {
        total += amount;
        count++;
      }
      const next = nextOccurrence(due, sub.frequency, sub.intervalDays);
      if (next <= due) break;
      due = next;
    }
  }
  return { total, count };
}

/** True for expenses that came from a subscription (flagged, or auto-created by the scheduler). */
export function isSubscriptionExpense(expense: PlanExpense): boolean {
  return !!(
    expense &&
    (expense.recurring || expense.isRecurring || /\(Auto\)\s*$/.test(String(expense.description || '')))
  );
}

/**
 * Month-end forecast: spent so far, plus everyday spending at the current pace for the days left,
 * plus the subscription charges still due. Subscriptions stay out of the pace.
 */
export function forecastMonth(
  monthExpenses: PlanExpense[],
  spentSoFar: number,
  subscriptions: PlanSubscription[],
  today: Date = new Date()
): { forecast: number; upcomingSubscriptions: number; upcomingCount: number; everydayPace: number } {
  const day = Math.max(today.getDate(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const subsSoFar = (monthExpenses || [])
    .filter(isSubscriptionExpense)
    .reduce((sum, e) => sum + amountOf(e.amount), 0);
  const everydayPace = Math.max(0, spentSoFar - subsSoFar) / day;
  const upcoming = upcomingSubscriptionCharges(subscriptions, today);
  return {
    forecast: spentSoFar + everydayPace * (daysInMonth - day) + upcoming.total,
    upcomingSubscriptions: upcoming.total,
    upcomingCount: upcoming.count,
    everydayPace,
  };
}
