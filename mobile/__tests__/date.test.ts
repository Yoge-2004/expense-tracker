import {
  isValidCalendarDate,
  parseLocalDate,
  toDateOnly,
  toLocalDateString,
  toLocalMonthKey,
} from '../utils/date';

describe('utils/date', () => {
  describe('toLocalDateString', () => {
    it('formats a Date as local YYYY-MM-DD without UTC shift', () => {
      const localLateNight = new Date(2026, 4, 15, 23, 55, 0);
      expect(toLocalDateString(localLateNight)).toBe('2026-05-15');

      const localEarlyMorning = new Date(2026, 0, 5, 0, 10, 0);
      expect(toLocalDateString(localEarlyMorning)).toBe('2026-01-05');
    });
  });

  describe('toDateOnly', () => {
    it('extracts YYYY-MM-DD prefix from dates and ISO timestamps', () => {
      expect(toDateOnly('2026-11-26')).toBe('2026-11-26');
      expect(toDateOnly('2026-11-26T23:59:59.000Z')).toBe('2026-11-26');
      expect(toDateOnly('  2026-02-28T05:30:00+05:30  ')).toBe('2026-02-28');
    });

    it('returns empty string for null, undefined, or invalid prefixes', () => {
      expect(toDateOnly(null)).toBe('');
      expect(toDateOnly(undefined)).toBe('');
      expect(toDateOnly('')).toBe('');
      expect(toDateOnly('26-11-2026')).toBe('');
    });
  });

  describe('parseLocalDate', () => {
    it('parses valid YYYY-MM-DD and ISO strings into local midnight Date', () => {
      const d1 = parseLocalDate('2026-07-04');
      expect(d1).not.toBeNull();
      expect(d1?.getFullYear()).toBe(2026);
      expect(d1?.getMonth()).toBe(6);
      expect(d1?.getDate()).toBe(4);
      expect(d1?.getHours()).toBe(0);

      const d2 = parseLocalDate('2024-02-29T18:30:00Z');
      expect(d2).not.toBeNull();
      expect(d2?.getFullYear()).toBe(2024);
      expect(d2?.getMonth()).toBe(1);
      expect(d2?.getDate()).toBe(29);
    });

    it('rejects calendar rollovers and invalid dates', () => {
      expect(parseLocalDate('2026-02-30')).toBeNull();
      expect(parseLocalDate('2025-02-29')).toBeNull();
      expect(parseLocalDate('2026-04-31')).toBeNull();
      expect(parseLocalDate('2026-13-01')).toBeNull();
      expect(parseLocalDate('2026-00-10')).toBeNull();
      expect(parseLocalDate('')).toBeNull();
      expect(parseLocalDate(null)).toBeNull();
    });
  });

  describe('isValidCalendarDate', () => {
    it('strictly validates YYYY-MM-DD calendar dates', () => {
      expect(isValidCalendarDate('2024-02-29')).toBe(true);
      expect(isValidCalendarDate('2026-12-31')).toBe(true);
      expect(isValidCalendarDate('2026-02-30')).toBe(false);
      expect(isValidCalendarDate('2026-11-26T10:00:00Z')).toBe(false);
    });
  });

  describe('toLocalMonthKey', () => {
    it('returns YYYY-MM for Date instances, date strings, and month keys', () => {
      expect(toLocalMonthKey(new Date(2026, 0, 15))).toBe('2026-01');
      expect(toLocalMonthKey('2026-11-26T22:00:00Z')).toBe('2026-11');
      expect(toLocalMonthKey('2026-08')).toBe('2026-08');
      expect(toLocalMonthKey('invalid')).toBe('');
    });
  });
});
