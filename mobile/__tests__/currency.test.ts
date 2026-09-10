/**
 * @jest-environment node
 *
 * Unit tests for the currency service.
 * Tests currency symbol resolution, formatting, and edge cases.
 */

import {
  WORLD_CURRENCIES,
  getCurrencySymbol,
  formatCurrencyAmount,
} from '../services/currency';

describe('Currency Service', () => {

  describe('WORLD_CURRENCIES', () => {
    test('contains a comprehensive list of currencies (65+)', () => {
      expect(WORLD_CURRENCIES.length).toBeGreaterThan(60);
    });

    test('every currency has code, symbol, name, and flag', () => {
      for (const c of WORLD_CURRENCIES) {
        expect(c.code).toBeDefined();
        expect(c.code).toHaveLength(3);
        expect(c.symbol).toBeDefined();
        expect(c.name).toBeDefined();
        expect(c.flag).toBeDefined();
      }
    });

    test('includes major currencies', () => {
      const codes = WORLD_CURRENCIES.map(c => c.code);
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
      expect(codes).toContain('INR');
      expect(codes).toContain('JPY');
      expect(codes).toContain('AED');
    });

    test('currency codes are all uppercase 3-letter strings', () => {
      for (const c of WORLD_CURRENCIES) {
        expect(c.code).toMatch(/^[A-Z]{3}$/);
      }
    });
  });

  describe('getCurrencySymbol', () => {
    test('returns correct symbol for USD', () => {
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    test('returns correct symbol for INR', () => {
      expect(getCurrencySymbol('INR')).toBe('₹');
    });

    test('returns correct symbol for EUR', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    test('returns correct symbol for JPY', () => {
      expect(getCurrencySymbol('JPY')).toBe('¥');
    });

    test('returns correct symbol for GBP', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
    });

    test('is case-insensitive', () => {
      expect(getCurrencySymbol('usd')).toBe('$');
      expect(getCurrencySymbol('Usd')).toBe('$');
      expect(getCurrencySymbol('inr')).toBe('₹');
    });

    test('trims whitespace', () => {
      expect(getCurrencySymbol('  USD  ')).toBe('$');
    });

    test('returns ₹ (INR default) for null/undefined', () => {
      expect(getCurrencySymbol(null)).toBe('₹');
      expect(getCurrencySymbol(undefined)).toBe('₹');
    });

    test('returns ₹ for empty string', () => {
      expect(getCurrencySymbol('')).toBe('₹');
    });

    test('returns the uppercase code for unknown currencies', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ');
      expect(getCurrencySymbol('abc')).toBe('ABC');
    });
  });

  describe('formatCurrencyAmount', () => {
    test('formats INR amount with symbol', () => {
      const result = formatCurrencyAmount(24800, 'INR');
      expect(result).toContain('₹');
      expect(result).toContain('24,800');
    });

    test('formats USD amount with $ symbol', () => {
      const result = formatCurrencyAmount(1000, 'USD');
      expect(result).toContain('$');
      expect(result).toContain('1,000');
    });

    test('handles string input', () => {
      const result = formatCurrencyAmount('1500', 'USD');
      expect(result).toContain('1,500');
    });

    test('handles null input gracefully', () => {
      const result = formatCurrencyAmount(null, 'INR');
      expect(result).toContain('0');
    });

    test('handles undefined input gracefully', () => {
      const result = formatCurrencyAmount(undefined, 'INR');
      expect(result).toContain('0');
    });

    test('handles NaN string input', () => {
      const result = formatCurrencyAmount('not-a-number', 'INR');
      expect(result).toContain('0');
    });

    test('defaults to INR when no currency code provided', () => {
      const result = formatCurrencyAmount(500);
      expect(result).toContain('₹');
    });

    test('respects decimal places parameter', () => {
      const result = formatCurrencyAmount(99.999, 'USD', 2);
      expect(result).toContain('100.00');
    });

    test('handles negative amounts', () => {
      const result = formatCurrencyAmount(-500, 'USD');
      // Should contain the symbol and the number (may have minus sign)
      expect(result).toMatch(/-?\$/);
    });

    test('handles zero', () => {
      const result = formatCurrencyAmount(0, 'INR');
      expect(result).toContain('0');
    });

    test('handles large numbers', () => {
      const result = formatCurrencyAmount(1000000, 'USD');
      expect(result).toContain('1,000,000');
    });

    test('uses unknown currency code as symbol', () => {
      const result = formatCurrencyAmount(100, 'XYZ');
      expect(result).toContain('XYZ');
      expect(result).toContain('100');
    });
  });
});
