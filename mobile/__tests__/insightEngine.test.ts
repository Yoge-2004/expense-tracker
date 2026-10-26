import {
  parseLocalDate,
  monthKey,
  monthOverMonth,
  categoryTrends,
  anomalies,
  detectRecurring,
  projection,
  generateInsights,
  ExpenseLike,
  IncomeLike,
  GoalLike,
} from '../utils/insightEngine';

describe('insightEngine', () => {
  describe('parseLocalDate', () => {
    it('parses YYYY-MM-DD date string as local date without UTC shift', () => {
      const date = parseLocalDate('2026-05-15');
      expect(date).not.toBeNull();
      expect(date?.getFullYear()).toBe(2026);
      expect(date?.getMonth()).toBe(4); // 0-indexed: May is 4
      expect(date?.getDate()).toBe(15);
    });

    it('returns null for null, undefined, or invalid date values', () => {
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate(undefined)).toBeNull();
      expect(parseLocalDate('not-a-date')).toBeNull();
    });

    it('returns same Date object when given a Date instance', () => {
      const original = new Date(2026, 3, 20);
      expect(parseLocalDate(original)).toBe(original);
    });
  });

  describe('monthKey', () => {
    it('formats date into YYYY-MM key', () => {
      expect(monthKey(new Date(2026, 0, 1))).toBe('2026-01');
      expect(monthKey(new Date(2026, 11, 31))).toBe('2026-12');
      expect(monthKey(null)).toBeNull();
    });
  });

  describe('projection', () => {
    it('projects monthly spend based on current pace', () => {
      const now = new Date(2026, 4, 15); // May 15 (15th day of 31 days)
      const expenses: ExpenseLike[] = [
        { amount: 1500, expenseDate: '2026-05-02' },
        { amount: 1500, expenseDate: '2026-05-10' },
      ]; // 3000 spent in 15 days -> ~200/day * 31 = 6200
      const insight = projection(expenses, now);
      expect(insight).toBeDefined();
      expect(insight.id).toBe('projection');
      expect(insight.projected).toBeGreaterThan(5000);
    });
  });

  describe('detectRecurring', () => {
    it('identifies repeating transactions across consecutive months', () => {
      const now = new Date(2026, 2, 20); // March 20, 2026
      const expenses: ExpenseLike[] = [
        { amount: 649, expenseDate: '2026-01-05', description: 'Netflix' },
        { amount: 649, expenseDate: '2026-02-05', description: 'Netflix' },
        { amount: 649, expenseDate: '2026-03-05', description: 'Netflix' },
      ];
      const recurring = detectRecurring(expenses, now);
      expect(recurring.length).toBeGreaterThan(0);
      expect(recurring[0].label).toContain('Netflix');
      expect(recurring[0].occurrences).toBe(3);
    });
  });

  describe('generateInsights', () => {
    it('returns a comprehensive insight portfolio', () => {
      const now = new Date(2026, 4, 20);
      const expenses: ExpenseLike[] = [
        { amount: 200, expenseDate: '2026-05-01', categoryName: 'Food' },
        { amount: 300, expenseDate: '2026-05-05', categoryName: 'Food' },
        { amount: 120, expenseDate: '2026-05-10', categoryName: 'Transport' },
      ];
      const incomes: IncomeLike[] = [
        { amount: 50000, incomeDate: '2026-05-01' },
      ];
      const goals: GoalLike[] = [
        { name: 'Vacation', targetAmount: 20000, currentAmount: 15000 },
      ];

      const portfolio = generateInsights({ expenses, incomes, goals }, now);
      expect(Array.isArray(portfolio)).toBe(true);
      expect(portfolio.length).toBeGreaterThan(0);
      expect(portfolio.some((i) => i.id === 'projection')).toBe(true);
    });
  });
});
