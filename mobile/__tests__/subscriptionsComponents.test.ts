import {
  toMonthlyRate,
  getDaysUntil,
} from '../components/subscriptions/subscriptionsTypes';
import { SubscriptionsKpiCards } from '../components/subscriptions/SubscriptionsKpiCards';
import { SubscriptionsSegmentFilter } from '../components/subscriptions/SubscriptionsSegmentFilter';
import { RecurringItemCard } from '../components/subscriptions/RecurringItemCard';
import { QuickDepositModal } from '../components/subscriptions/QuickDepositModal';

describe('Subscriptions & Recurring Components and Utilities', () => {
  describe('toMonthlyRate run-rate calculations', () => {
    it('calculates monthly amount for monthly frequency', () => {
      expect(toMonthlyRate(1000, 'MONTHLY')).toBe(1000);
      expect(toMonthlyRate(500, undefined)).toBe(500);
    });

    it('calculates run-rate for daily frequency', () => {
      expect(toMonthlyRate(10, 'DAILY')).toBe(300);
    });

    it('calculates run-rate for weekly frequency', () => {
      expect(toMonthlyRate(100, 'WEEKLY')).toBe(433);
    });

    it('calculates run-rate for biweekly frequency', () => {
      expect(toMonthlyRate(200, 'BI_WEEKLY')).toBe(432);
      expect(toMonthlyRate(200, 'BIWEEKLY')).toBe(432);
    });

    it('calculates run-rate for yearly frequency', () => {
      expect(toMonthlyRate(1200, 'YEARLY')).toBe(100);
    });

    it('calculates run-rate for custom interval days', () => {
      expect(toMonthlyRate(100, 'CUSTOM', 15)).toBe(200);
      expect(toMonthlyRate(100, 'CUSTOM', 0)).toBe(100);
    });

    it('handles negative or invalid values gracefully', () => {
      expect(toMonthlyRate(-50, 'MONTHLY')).toBe(0);
      expect(toMonthlyRate(0, 'MONTHLY')).toBe(0);
    });
  });

  describe('getDaysUntil calendar calculation', () => {
    it('returns 999 for empty or null dates', () => {
      expect(getDaysUntil(undefined)).toBe(999);
      expect(getDaysUntil('')).toBe(999);
    });

    it('returns 0 for today', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(getDaysUntil(today)).toBe(0);
    });

    it('returns positive days for future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      const futureStr = future.toISOString().split('T')[0];
      expect(getDaysUntil(futureStr)).toBe(5);
    });

    it('returns negative days for overdue dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      const pastStr = past.toISOString().split('T')[0];
      expect(getDaysUntil(pastStr)).toBe(-3);
    });
  });

  describe('Component exports', () => {
    it('SubscriptionsKpiCards exports a valid memo component', () => {
      expect(SubscriptionsKpiCards).toBeDefined();
      expect(typeof SubscriptionsKpiCards).toBe('object');
    });

    it('SubscriptionsSegmentFilter exports a valid memo component', () => {
      expect(SubscriptionsSegmentFilter).toBeDefined();
      expect(typeof SubscriptionsSegmentFilter).toBe('object');
    });

    it('RecurringItemCard exports a valid memo component', () => {
      expect(RecurringItemCard).toBeDefined();
      expect(typeof RecurringItemCard).toBe('object');
    });

    it('QuickDepositModal exports a valid memo component', () => {
      expect(QuickDepositModal).toBeDefined();
      expect(typeof QuickDepositModal).toBe('object');
    });
  });
});
