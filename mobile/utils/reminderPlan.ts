/**
 * Plans the on-device reminders that are tied to a date: bills, salary and savings top-ups.
 * Pure functions (no Expo, no React) so the plan can be checked on its own; notifications.ts turns the
 * plan into scheduled local notifications, the same way the 1:30 PM and 8:30 PM reminders are.
 */

/** Every reminder this plan creates has an id with this prefix, so they can be found and replaced together. */
export const REMINDER_ID_PREFIX = 'smart_';

export interface PlannedReminder {
  id: string;
  title: string;
  body: string;
  /** When to fire (local time). */
  date: Date;
  /** Screen to open when the notification is tapped. */
  screen: string;
}

export interface ReminderSources {
  currency?: string;
  subscriptions?: { id: number; description?: string; amount?: number; nextDueDate?: string | null }[];
  incomes?: {
    id: number;
    source?: string;
    amount?: number;
    isRecurring?: boolean;
    recurring?: boolean;
    nextDueDate?: string | null;
  }[];
  goals?: {
    id: number;
    name?: string;
    status?: string;
    isRecurring?: boolean;
    recurringAmount?: number;
    nextDueDate?: string | null;
  }[];
}

const DAY_MS = 86_400_000;
/** Do not fire anything that is due in under a minute; it would be scheduled in the past. */
const MIN_LEAD_MS = 60_000;

/** "YYYY-MM-DD…" to a local date at midnight; null when it is not a date. */
function parseDay(value?: string | null): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function atHour(day: Date, offsetDays: number, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offsetDays, hour, 0, 0);
}

function dayKey(day: Date): string {
  return `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
}

function dayLabel(day: Date): string {
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatReminderMoney(currency: string, amount?: number): string {
  const c = (currency || '₹').trim();
  const isAlpha = /^[A-Z]{3}$/.test(c);
  return `${c}${isAlpha ? ' ' : ''}${Math.round(Number(amount) || 0).toLocaleString()}`;
}

function whenLabel(offset: number): string {
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  return `in ${offset} days`;
}

/**
 * The next {@code count} LAST days of a month at {@code hour}:00. Months end on the 28th, 29th, 30th or
 * 31st, so the date is computed per month instead of repeating on a fixed day.
 */
export function planMonthEndReminders(now: Date = new Date(), hour = 9, count = 3): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  for (let i = 0; planned.length < count && i < count + 2; i++) {
    // Day 0 of the following month is the last day of this one.
    const lastDay = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    const date = atHour(lastDay, 0, hour);
    if (date.getTime() <= now.getTime() + MIN_LEAD_MS) continue;
    planned.push({
      id: `${REMINDER_ID_PREFIX}month_end_${dayKey(lastDay).slice(0, 6)}`,
      title: '⏳ Last day of the month',
      body: 'Check your budgets and top up your savings goals before the month closes.',
      date,
      screen: '/(tabs)',
    });
  }
  return planned;
}

/**
 * Reminders for what is coming up in the next {@code lookaheadDays}:
 * - a bill: 3 days before, 1 day before and on the day (9:00)
 * - a recurring salary or income: on the day
 * - a recurring savings top-up: 1 day before and on the day
 * Sorted by time and capped at {@code max}, because iOS keeps at most 64 pending notifications.
 */
export function planDueReminders(
  sources: ReminderSources,
  now: Date = new Date(),
  hour = 9,
  lookaheadDays = 14,
  max = 30
): PlannedReminder[] {
  const currency = sources.currency ?? '₹';
  const horizon = now.getTime() + lookaheadDays * DAY_MS;
  const planned: PlannedReminder[] = [];

  const add = (reminder: PlannedReminder) => {
    const t = reminder.date.getTime();
    if (t > now.getTime() + MIN_LEAD_MS && t <= horizon) planned.push(reminder);
  };

  for (const bill of sources.subscriptions ?? []) {
    const due = parseDay(bill.nextDueDate);
    if (!due) continue;
    const name = (bill.description ?? '').trim() || 'A bill';
    for (const offset of [3, 1, 0]) {
      add({
        id: `${REMINDER_ID_PREFIX}bill_${bill.id}_${dayKey(due)}_${offset}`,
        title: `💳 ${name} is due ${whenLabel(offset)}`,
        body: `${formatReminderMoney(currency, bill.amount)} is due on ${dayLabel(due)}. Make sure your balance can cover it.`,
        date: atHour(due, -offset, hour),
        screen: '/(tabs)/subscriptions',
      });
    }
  }

  for (const income of sources.incomes ?? []) {
    if (!(income.isRecurring || income.recurring)) continue;
    const due = parseDay(income.nextDueDate);
    if (!due) continue;
    const name = (income.source ?? '').trim() || 'Income';
    add({
      id: `${REMINDER_ID_PREFIX}income_${income.id}_${dayKey(due)}`,
      title: `💰 ${name} is expected today`,
      body: `${formatReminderMoney(currency, income.amount)} is due today. Open the app to check that it arrived.`,
      date: atHour(due, 0, hour),
      screen: '/(tabs)',
    });
  }

  for (const goal of sources.goals ?? []) {
    if (!goal.isRecurring || !(Number(goal.recurringAmount) > 0) || goal.status === 'COMPLETED') continue;
    const due = parseDay(goal.nextDueDate);
    if (!due) continue;
    const name = (goal.name ?? '').trim() || 'your goal';
    for (const offset of [1, 0]) {
      add({
        id: `${REMINDER_ID_PREFIX}goal_${goal.id}_${dayKey(due)}_${offset}`,
        title: `🎯 Savings top-up due ${whenLabel(offset)}`,
        body: `Put ${formatReminderMoney(currency, goal.recurringAmount)} toward ${name}.`,
        date: atHour(due, -offset, hour),
        screen: '/(tabs)',
      });
    }
  }

  return planned.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, max);
}
