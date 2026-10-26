/**
 * @file notificationDate.ts
 * @description Safe date parsing and localization for notifications across timezones.
 */

/**
 * Parses notification timestamps safely into client-local Date objects.
 * If an ISO string without timezone or 'Z' is received, normalizes by appending 'Z'
 * so JavaScript parses as UTC and displays in the user device's local timezone.
 */
export function parseNotificationDate(value: string | number | Date | null | undefined): Date {
  if (!value) return new Date(Number.NaN);
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str) && !/(?:[Zz]|[+-]\d{2}(?::?\d{2})?)$/.test(str)) {
    return new Date(str + 'Z');
  }
  return new Date(str);
}

/**
 * Formats a notification date accurately using the user device's local timezone.
 * Returns relative time ("just now", "5m ago", "2h ago", "yesterday") combined with
 * the client device's localized time (e.g. "2:30 PM") so the user gets both relative context
 * and exact local time.
 */
export function formatNotificationTime(value: string | number | Date | null | undefined): string {
  const then = parseNotificationDate(value);
  if (Number.isNaN(then.getTime())) return '';
  const now = Date.now();
  const diffMs = now - then.getTime();
  const minutes = Math.round(diffMs / 60000);
  const timeStr = then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (minutes < 1) return `just now · ${timeStr}`;
  if (minutes < 60) return `${minutes}m ago · ${timeStr}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago · ${timeStr}`;
  const days = Math.round(hours / 24);
  if (days === 1) return `yesterday · ${timeStr}`;
  return `${then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${timeStr}`;
}
