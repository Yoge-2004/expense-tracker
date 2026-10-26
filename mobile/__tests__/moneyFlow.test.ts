import {
  monthKey,
  shiftMonth,
  monthLabel,
  kindOf,
  effectiveMonth,
  earnedTotal,
  reimbursedTotal,
  netSpent,
  FlowIncome,
  FlowExpense,
} from '../utils/moneyFlow';

describe('moneyFlow', () => {
  describe('monthKey', () => {
    it('extracts YYYY-MM from valid dates and strings', () => {
      expect(monthKey(new Date(2026, 4, 15))).toBe('2026-05');
      expect(monthKey('2026-08-20T12:00:00Z')).toBe('2026-08');
      expect(monthKey('2026-11')).toBe('2026-11');
    });

    it('returns empty string for invalid or falsy input', () => {
      expect(monthKey(null)).toBe('');
      expect(monthKey(undefined)).toBe('');
      expect(monthKey('invalid-date')).toBe('');
      expect(monthKey('99-99')).toBe('');
    });
  });

  describe('shiftMonth', () => {
    it('shifts months forward and backward accurately', () => {
      expect(shiftMonth('2026-03', 1)).toBe('2026-04');
      expect(shiftMonth('2026-03', -1)).toBe('2026-02');
      expect(shiftMonth('2026-12', 1)).toBe('2027-01');
      expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    });
  });

  describe('kindOf', () => {
    it('identifies explicit kinds correctly', () => {
      expect(kindOf({ kind: 'SALARY' })).toBe('SALARY');
      expect(kindOf({ kind: 'REIMBURSEMENT' })).toBe('REIMBURSEMENT');
      expect(kindOf({ kind: 'BORROWED' })).toBe('BORROWED');
      expect(kindOf({ kind: 'SETTLEMENT' })).toBe('SETTLEMENT');
      expect(kindOf({ kind: 'OTHER' })).toBe('OTHER');
    });

    it('infers salary from source string when kind is missing', () => {
      expect(kindOf({ source: 'Monthly salary from Google' })).toBe('SALARY');
      expect(kindOf({ source: 'Freelance design project' })).toBe('OTHER');
      expect(kindOf({})).toBe('OTHER');
    });
  });

  describe('effectiveMonth', () => {
    it('prefers countsTowardMonth when present and valid', () => {
      expect(effectiveMonth({ countsTowardMonth: '2026-04', incomeDate: '2026-03-30' })).toBe('2026-04');
    });

    it('falls back to month of incomeDate when countsTowardMonth is empty', () => {
      expect(effectiveMonth({ incomeDate: '2026-03-15' })).toBe('2026-03');
    });
  });

  describe('earnedTotal, reimbursedTotal and netSpent', () => {
    const incomes: FlowIncome[] = [
      { amount: 50000, kind: 'SALARY' },
      { amount: 15000, kind: 'OTHER' },
      { amount: 3000, kind: 'REIMBURSEMENT' }, // Refund / reimbursement
      { amount: 10000, kind: 'BORROWED' }, // Debt - not earned income
      { amount: 2000, kind: 'SETTLEMENT' }, // Settlement - not earned income
    ];

    it('calculates earned total excluding reimbursements, loans and settlements', () => {
      expect(earnedTotal(incomes)).toBe(65000); // 50000 + 15000
    });

    it('calculates reimbursed total accurately', () => {
      expect(reimbursedTotal(incomes)).toBe(3000);
    });

    it('calculates net spent after subtracting reimbursements without falling below zero', () => {
      const expenses: FlowExpense[] = [
        { amount: 12000 },
        { amount: 8000 },
      ]; // Gross = 20000
      expect(netSpent(expenses, incomes)).toBe(17000); // 20000 - 3000

      // When reimbursements exceed expenses, netSpent should clamp at 0
      const smallExpenses: FlowExpense[] = [{ amount: 1000 }];
      expect(netSpent(smallExpenses, incomes)).toBe(0);
    });

    it('handles null and string amounts safely', () => {
      const dirtyExpenses: FlowExpense[] = [{ amount: '500' }, { amount: null }, { amount: -50 }];
      const dirtyIncomes: FlowIncome[] = [{ amount: '200', kind: 'REIMBURSEMENT' }];
      expect(netSpent(dirtyExpenses, dirtyIncomes)).toBe(300); // 500 - 200
    });
  });
});
