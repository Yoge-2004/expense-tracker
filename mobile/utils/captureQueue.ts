/**
 * Pure helpers for the notification-capture queue: parsing what the native service queued and
 * keeping the same transaction from being recorded twice. No React, no native calls.
 *
 * A transaction often reaches the phone twice (the bank's SMS and the UPI app's notification), so
 * besides dropping identical texts we treat the same direction + amount from a DIFFERENT app within a
 * few minutes as one transaction. Two real purchases of the same amount from the same app are kept.
 */

export interface CapturedItem {
  key: string;
  text: string;
  pkg: string;
  at: number;
}

export interface SeenEntry {
  key: string;
  fp: string;
  pkg: string;
  at: number;
}

export interface RetryEntry {
  text: string;
  at: number;
}

export const SEEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const SEEN_MAX = 300;
export const CROSS_SOURCE_WINDOW_MS = 10 * 60 * 1000;
export const RETRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const RETRY_MAX = 50;

/** Parses the JSON the native module returns; malformed input gives an empty list, never a throw. */
export function parseQueue(json: string | null | undefined): CapturedItem[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const items: CapturedItem[] = [];
  for (const entry of raw) {
    const e = entry as { k?: unknown; t?: unknown; p?: unknown; at?: unknown };
    if (!e || typeof e.t !== 'string' || !e.t.trim()) continue;
    const at = Number(e.at);
    items.push({
      key: typeof e.k === 'string' && e.k ? e.k : e.t.toLowerCase(),
      text: e.t,
      pkg: typeof e.p === 'string' ? e.p : '',
      at: Number.isFinite(at) && at > 0 ? at : 0,
    });
  }
  return items.sort((a, b) => a.at - b.at);
}

/** Direction + amount, the fingerprint used to spot the same transaction from two apps. */
export function fingerprint(direction: string | undefined, amount: number | undefined): string {
  if (!direction || !amount || !Number.isFinite(amount)) return '';
  return `${direction}|${amount}`;
}

export function pruneSeen(seen: SeenEntry[], now: number): SeenEntry[] {
  return seen.filter((s) => now - s.at <= SEEN_TTL_MS).slice(-SEEN_MAX);
}

export function isDuplicate(seen: SeenEntry[], item: CapturedItem, fp: string): boolean {
  return seen.some((s) => {
    if (s.key === item.key) return true;
    return (
      fp !== '' &&
      s.fp === fp &&
      s.pkg !== item.pkg &&
      Math.abs(s.at - item.at) <= CROSS_SOURCE_WINDOW_MS
    );
  });
}

export function addSeen(seen: SeenEntry[], item: CapturedItem, fp: string, now: number): SeenEntry[] {
  return pruneSeen([...seen, { key: item.key, fp, pkg: item.pkg, at: item.at || now }], now);
}

export function pruneRetry(list: RetryEntry[], now: number): RetryEntry[] {
  return list.filter((r) => now - r.at <= RETRY_MAX_AGE_MS).slice(-RETRY_MAX);
}
