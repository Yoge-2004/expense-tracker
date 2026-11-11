import {
  forecastMonth,
  isSubscriptionExpense,
  upcomingSubscriptionCharges,
} from '../utils/subscriptionPlan';

// 10 Nov 2026 (30-day month, 20 days left after today)
const TODAY = new Date(2026, 10, 10);

describe('upcomingSubscriptionCharges', () => {
  it('counts a monthly charge due later this month', () => {
    const r = upcomingSubscriptionCharges(
      [{ amount: 499, frequency: 'MONTHLY', nextDueDate: '2026-11-25' }],
      TODAY
    );
    expect(r).toEqual({ total: 499, count: 1 });
  });

  it('ignores charges due today or earlier (already recorded as expenses) and next month', () => {
    const r = upcomingSubscriptionCharges(
      [
        { amount: 100, frequency: 'MONTHLY', nextDueDate: '2026-11-10' },
        { amount: 200, frequency: 'MONTHLY', nextDueDate: '2026-11-01' },
        { amount: 300, frequency: 'MONTHLY', nextDueDate: '2026-12-02' },
      ],
      TODAY
    );
    expect(r.total).toBe(0);
  });

  it('counts every weekly occurrence left in the month', () => {
    const r = upcomingSubscriptionCharges(
      [{ amount: 50, frequency: 'WEEKLY', nextDueDate: '2026-11-12' }],
      TODAY
    );
    expect(r).toEqual({ total: 150, count: 3 }); // 12th, 19th, 26th
  });

  it('honours custom intervals and skips yearly plans not due this month', () => {
    const r = upcomingSubscriptionCharges(
      [
        { amount: 10, frequency: 'CUSTOM', intervalDays: 10, nextDueDate: '2026-11-11' },
        { amount: 5000, frequency: 'YEARLY', nextDueDate: '2027-02-01' },
      ],
      TODAY
    );
    expect(r).toEqual({ total: 20, count: 2 }); // 11th and 21st; 1 Dec is next month
  });
});

describe('forecastMonth', () => {
  it('adds upcoming subscriptions without extrapolating the ones already paid', () => {
    const monthExpenses = [
      { amount: 900, description: 'Groceries' },
      { amount: 500, description: 'Netflix (Auto)' },
    ];
    const r = forecastMonth(
      monthExpenses,
      1400,
      [{ amount: 300, frequency: 'MONTHLY', nextDueDate: '2026-11-20' }],
      TODAY
    );
    // everyday pace = 900 / 10 = 90 per day, 20 days left
    expect(r.everydayPace).toBe(90);
    expect(r.forecast).toBe(1400 + 90 * 20 + 300);
    expect(r.upcomingSubscriptions).toBe(300);
  });

  it('with no subscriptions it is spent so far plus the daily pace', () => {
    const r = forecastMonth([{ amount: 1000, description: 'Rent' }], 1000, [], TODAY);
    expect(r.forecast).toBe(1000 + 100 * 20);
  });
});

describe('isSubscriptionExpense', () => {
  it('recognises flagged and auto-created expenses', () => {
    expect(isSubscriptionExpense({ description: 'Gym (Auto)' })).toBe(true);
    expect(isSubscriptionExpense({ description: 'Gym', recurring: true })).toBe(true);
    expect(isSubscriptionExpense({ description: 'Coffee' })).toBe(false);
  });
});
