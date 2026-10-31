import {
  conflictTotal, mergeLedgers, planSamples,
  recurringStartDate, shiftPeriod,
  bodies, buildRestorePlan, isSuspiciousDrop, isoDate, ledgerRichness, multisetMissing, planTotal, signatures,
} from '../utils/ledgerReconcile';

const exp = (over: any = {}) => ({
  id: 1, amount: 10, description: 'Tea', expenseDate: '2026-05-01', categoryName: 'Food', categoryId: 3, ...over,
});

describe('ledgerReconcile', () => {
  it('matches by content, not by id, ignoring case and spacing', () => {
    const device = [exp({ id: 7, description: ' tea  ' })];
    const server = [exp({ id: 99, description: 'Tea', amount: '10.00' })];
    expect(multisetMissing(device, server, signatures.expense)).toEqual([]);
  });

  it('keeps genuine duplicates: 3 on device vs 1 on server leaves 2 missing', () => {
    const device = [exp({ id: 1 }), exp({ id: 2 }), exp({ id: 3 })];
    expect(multisetMissing(device, [exp({ id: 9 })], signatures.expense)).toHaveLength(2);
  });

  it('never reports server-only records and a second run after adding finds nothing', () => {
    const device = { expenses: [exp()] };
    const server = { expenses: [exp({ description: 'Other', expenseDate: '2026-05-02' })], categories: [] };
    expect(buildRestorePlan(device, server).expenses).toHaveLength(1);
    const afterRestore = { expenses: [exp({ description: 'Other', expenseDate: '2026-05-02' }), exp({ id: 50 })], categories: [] };
    expect(planTotal(buildRestorePlan(device, afterRestore))).toBe(0);
  });

  it('plans missing custom categories once, by name', () => {
    const plan = buildRestorePlan(
      { categories: [{ id: 1, name: 'Food' }, { id: 2, name: 'Pets' }, { id: 3, name: 'pets' }] },
      { categories: [{ id: 10, name: 'food' }] }
    );
    expect(plan.categories).toEqual(['Pets']);
  });

  it('treats budgets by category+period and loans/goals by their own keys', () => {
    const device = {
      budgets: [{ categoryName: 'Food', period: 'MONTHLY', limit: 100 }],
      savingsGoals: [{ name: 'Bike' }], loans: [{ counterparty: 'Sam', type: 'LENT', amount: 5, adjustmentDate: '2026-01-02' }],
    };
    const plan = buildRestorePlan(device, { budgets: [], savingsGoals: [{ name: ' bike ' }], loans: [], categories: [] });
    expect(plan.budgets).toHaveLength(1);
    expect(plan.goals).toHaveLength(0);
    expect(plan.loans).toHaveLength(1);
  });

  it('flags a large drop but not normal edits or tiny ledgers', () => {
    const big = { expenses: new Array(100).fill(exp()) };
    expect(isSuspiciousDrop(big, { expenses: new Array(40).fill(exp()) })).toBe(true);
    expect(isSuspiciousDrop(big, { expenses: new Array(90).fill(exp()) })).toBe(false);
    expect(isSuspiciousDrop({ expenses: [exp(), exp()] }, { expenses: [] })).toBe(false);
    expect(ledgerRichness(null)).toBe(0);
  });

  it('builds request bodies by category name and refuses unmapped categories', () => {
    const cats = new Map([['food', 42]]);
    expect(bodies.expense(exp({ categoryId: 3 }), cats)).toMatchObject({ categoryId: 42, amount: 10, expenseDate: '2026-05-01' });
    expect(bodies.expense(exp({ categoryName: 'Gone' }), cats)).toBeNull();
    expect(bodies.loan({ counterparty: 'A', type: 'LENT', amount: 1, adjustmentDate: '2026-01-01', expenseId: 5 })).not.toHaveProperty('expenseId');
    expect(bodies.income({ amount: 5, source: '  ', incomeDate: '2026-01-01' })).toMatchObject({ source: 'Other' });
  });

  it('reads Jackson array dates', () => {
    expect(isoDate([2026, 5, 1])).toBe('2026-05-01');
  });

  it('derives the start date that makes the server compute the same next due date', () => {
    expect(recurringStartDate('2026-06-01', 'MONTHLY', null)).toBe('2026-05-01');
    expect(recurringStartDate('2026-01-01', 'MONTHLY', null)).toBe('2025-12-01');
    expect(recurringStartDate('2026-06-08', 'WEEKLY', null)).toBe('2026-06-01');
    expect(recurringStartDate('2027-03-05', 'YEARLY', null)).toBe('2026-03-05');
    expect(recurringStartDate('2026-06-11', 'CUSTOM', 10)).toBe('2026-06-01');
    expect(recurringStartDate('2026-03-01', 'DAILY', null)).toBe('2026-02-28');
    // the server's forward rule applied to the result lands on the original next due date
    for (const [due, f, n] of [['2026-06-01', 'MONTHLY', null], ['2026-06-08', 'WEEKLY', null], ['2026-06-11', 'CUSTOM', 10]] as const) {
      expect(shiftPeriod(recurringStartDate(due, f, n), f, n, 1)).toBe(due);
    }
  });

  it('builds the recurring body from nextDueDate and omits fields the server does not need', () => {
    const body: any = bodies.subscription(
      { amount: 99, description: 'Music', nextDueDate: '2026-06-01', frequency: 'monthly', intervalDays: null, categoryName: 'Food' },
      new Map([['food', 3]])
    );
    expect(body).toEqual({ amount: 99, description: 'Music', expenseDate: '2026-05-01', categoryId: 3, frequency: 'MONTHLY' });
  });

  it('does not upload a record the server already has with an edited amount or text', () => {
    const device = { expenses: [exp({ id: 1, amount: 10 }), exp({ id: 2, description: 'Coffee', amount: 4 }), exp({ id: 3, description: 'New one', amount: 7 })] };
    const server = {
      expenses: [exp({ id: 11, amount: 99 }), exp({ id: 12, description: 'Coffee beans', amount: 4 })], // amount edited / text edited
      categories: [],
    };
    const plan = buildRestorePlan(device, server);
    expect(plan.expenses.map((e) => e.description)).toEqual(['New one']);
    expect(conflictTotal(plan)).toBe(2);
    expect(planTotal(plan)).toBe(1);
  });

  it('lets one server record excuse only one device record, and exact matches win first', () => {
    const device = { expenses: [exp({ id: 1, amount: 10 }), exp({ id: 2, amount: 10 }), exp({ id: 3, amount: 20 })] };
    const server = { expenses: [exp({ id: 11, amount: 10 }), exp({ id: 12, amount: 55 })], categories: [] };
    const plan = buildRestorePlan(device, server);
    // one exact match (10); the second 10 is an edit-conflict with the 55 record; the 20 is genuinely missing
    expect(plan.conflicts.expenses).toHaveLength(1);
    expect(plan.expenses.map((e) => e.amount)).toEqual([20]);
  });

  it('merges a device-copy file into an existing copy without duplicating', () => {
    const base = { expenses: [exp({ id: 1 })], categories: [{ id: 1, name: 'Food' }] };
    const extra = { expenses: [exp({ id: 9 }), exp({ id: 10, description: 'Lunch' })], categories: [{ id: 5, name: 'food' }, { id: 6, name: 'Pets' }] };
    const merged: any = mergeLedgers(base, extra);
    expect(merged.expenses).toHaveLength(2);
    expect(merged.categories.map((c: any) => c.name)).toEqual(['Food', 'Pets']);
  });

  it('shows readable example lines', () => {
    const plan = buildRestorePlan({ expenses: [exp({ description: 'Tea', amount: 12.5 })] }, { expenses: [], categories: [] });
    expect(planSamples(plan)).toEqual(['Expense: 2026-05-01 · Tea · 12.50']);
  });
});
