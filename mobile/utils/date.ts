/**
 * @file date.ts
 * @description Timezone-safe local calendar date utilities (YYYY-MM-DD / YYYY-MM).
 *
 * Avoids `Date.prototype.toISOString().slice(0, 10)` (UTC date) and `new Date('YYYY-MM-DD')`
 * (parsed as UTC midnight, which shifts backward by one day in UTC- timezones).
 */

/**
 * Formats a Date instance as a local calendar `YYYY-MM-DD` string.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts the `YYYY-MM-DD` calendar date prefix from a date or ISO timestamp string.
 */
export function toDateOnly(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match ? match[1] : '';
}

/**
 * Parses a `YYYY-MM-DD` (or ISO `YYYY-MM-DDTHH:...`) string into a local Date at midnight,
 * returning `null` if the string does not represent a valid calendar date.
 */
export function parseLocalDate(value?: string | null): Date | null {
  const datePart = toDateOnly(value);
  if (!datePart) return null;
  const [yStr, mStr, dStr] = datePart.split('-');
  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10);
  const d = Number.parseInt(dStr, 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const local = new Date(y, m - 1, d);
  if (local.getFullYear() !== y || local.getMonth() !== m - 1 || local.getDate() !== d) {
    return null;
  }
  return local;
}

/**
 * Returns true if `value` is a strictly valid `YYYY-MM-DD` calendar date (no rollover).
 */
export function isValidCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && parseLocalDate(value) !== null;
}

/**
 * Returns a local `YYYY-MM` month key for a Date or date string.
 */
export function toLocalMonthKey(value: Date | string = new Date()): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  const datePart = toDateOnly(value);
  if (datePart) return datePart.slice(0, 7);
  const ym = /^(\d{4}-\d{2})$/.exec(value.trim());
  return ym ? ym[1] : '';
}
