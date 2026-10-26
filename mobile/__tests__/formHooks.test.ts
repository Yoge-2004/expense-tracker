import { isValidDateString } from '../hooks/useExpenseForm';

describe('useExpenseForm and date validation', () => {
  it('validates correct calendar date strings', () => {
    expect(isValidDateString('2026-10-26')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true); // leap year
  });

  it('rejects invalid calendar dates', () => {
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-00-10')).toBe(false);
    expect(isValidDateString('not-a-date')).toBe(false);
    expect(isValidDateString('')).toBe(false);
  });
});
