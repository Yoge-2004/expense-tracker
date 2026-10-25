import { parseNotificationDate, formatNotificationTime } from '../utils/notificationDate';

describe('Notification timing & timezone handling', () => {
  it('normalizes ISO string lacking trailing Z to UTC', () => {
    const rawNoZ = '2026-10-24T10:00:00';
    const parsed = parseNotificationDate(rawNoZ);

    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.toISOString()).toBe('2026-10-24T10:00:00.000Z');
  });

  it('keeps ISO string already having trailing Z as UTC', () => {
    const rawWithZ = '2026-10-24T10:00:00Z';
    const parsed = parseNotificationDate(rawWithZ);

    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.toISOString()).toBe('2026-10-24T10:00:00.000Z');
  });

  it('handles null, empty, and invalid dates gracefully', () => {
    expect(Number.isNaN(parseNotificationDate(null).getTime())).toBe(true);
    expect(Number.isNaN(parseNotificationDate('').getTime())).toBe(true);
    expect(formatNotificationTime(null)).toBe('');
    expect(formatNotificationTime('')).toBe('');
  });

  it('formats recent notifications accurately as relative time with local time', () => {
    const now = Date.now();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const formatted = formatNotificationTime(tenMinutesAgo);

    expect(formatted).toContain('10m ago');
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats just now for transactions occurring within the minute', () => {
    const now = Date.now();
    const tenSecondsAgo = new Date(now - 10 * 1000).toISOString();
    const formatted = formatNotificationTime(tenSecondsAgo);

    expect(formatted).toContain('just now');
  });
});
