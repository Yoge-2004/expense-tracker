import {
  CROSS_SOURCE_WINDOW_MS,
  RETRY_MAX_AGE_MS,
  SEEN_TTL_MS,
  addSeen,
  fingerprint,
  isDuplicate,
  parseQueue,
  pruneRetry,
  pruneSeen,
} from '../utils/captureQueue';

const NOW = 1_800_000_000_000;
const item = (over: Partial<{ key: string; text: string; pkg: string; at: number }> = {}) => ({
  key: 'k1',
  text: 'Rs 450 debited',
  pkg: 'com.sms',
  at: NOW,
  ...over,
});

describe('parseQueue', () => {
  it('parses items and sorts oldest first', () => {
    const json = JSON.stringify([
      { k: 'b', t: 'second', p: 'x', at: 20 },
      { k: 'a', t: 'first', p: 'y', at: 10 },
    ]);
    expect(parseQueue(json).map((i) => i.text)).toEqual(['first', 'second']);
  });

  it('survives bad input', () => {
    expect(parseQueue(null)).toEqual([]);
    expect(parseQueue('')).toEqual([]);
    expect(parseQueue('not json')).toEqual([]);
    expect(parseQueue('{"a":1}')).toEqual([]);
    expect(parseQueue(JSON.stringify([{ t: '  ' }, { x: 1 }, null]))).toEqual([]);
  });
});

describe('duplicates', () => {
  it('drops an identical key', () => {
    const seen = addSeen([], item(), fingerprint('DEBIT', 450), NOW);
    expect(isDuplicate(seen, item(), fingerprint('DEBIT', 450))).toBe(true);
  });

  it('treats the same amount from a different app within the window as one transaction', () => {
    const seen = addSeen([], item(), fingerprint('DEBIT', 450), NOW);
    const upi = item({ key: 'k2', pkg: 'com.gpay', at: NOW + 60_000 });
    expect(isDuplicate(seen, upi, fingerprint('DEBIT', 450))).toBe(true);
  });

  it('keeps two purchases of the same amount from the same app', () => {
    const seen = addSeen([], item(), fingerprint('DEBIT', 20), NOW);
    const second = item({ key: 'k2', at: NOW + 60_000 });
    expect(isDuplicate(seen, second, fingerprint('DEBIT', 20))).toBe(false);
  });

  it('keeps the same amount from another app once the window has passed', () => {
    const seen = addSeen([], item(), fingerprint('DEBIT', 450), NOW);
    const later = item({ key: 'k2', pkg: 'com.gpay', at: NOW + CROSS_SOURCE_WINDOW_MS + 1 });
    expect(isDuplicate(seen, later, fingerprint('DEBIT', 450))).toBe(false);
  });

  it('never matches on an empty fingerprint', () => {
    const seen = addSeen([], item(), '', NOW);
    expect(isDuplicate(seen, item({ key: 'k2', pkg: 'com.gpay' }), '')).toBe(false);
  });
});

describe('pruning', () => {
  it('forgets old seen entries', () => {
    const seen = [
      { key: 'old', fp: '', pkg: '', at: NOW - SEEN_TTL_MS - 1 },
      { key: 'new', fp: '', pkg: '', at: NOW },
    ];
    expect(pruneSeen(seen, NOW).map((s) => s.key)).toEqual(['new']);
  });

  it('drops retries older than a day', () => {
    const list = [
      { text: 'old', at: NOW - RETRY_MAX_AGE_MS - 1 },
      { text: 'fresh', at: NOW },
    ];
    expect(pruneRetry(list, NOW).map((r) => r.text)).toEqual(['fresh']);
  });
});

describe('fingerprint', () => {
  it('combines direction and amount', () => {
    expect(fingerprint('DEBIT', 450)).toBe('DEBIT|450');
    expect(fingerprint(undefined, 450)).toBe('');
    expect(fingerprint('DEBIT', 0)).toBe('');
  });
});
