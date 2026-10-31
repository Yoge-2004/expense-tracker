import {
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
    const server = { expenses: [exp({ description: 'Other' })], categories: [] };
    expect(buildRestorePlan(device, server).expenses).toHaveLength(1);
    const afterRestore = { expenses: [exp({ description: 'Other' }), exp({ id: 50 })], categories: [] };
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
});
