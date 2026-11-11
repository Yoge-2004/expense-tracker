/**
 * Automatic capture of bank / UPI transaction notifications (Android only).
 *
 * The native service (modules/notification-capture) queues only notifications that look like a money
 * transaction. This file drains that queue while the app is open and records each one through the same
 * pipeline as pasted messages. Nothing leaves the device except the expense / income the user's own
 * account records. While the app is closed the service only queues; recording happens at the next open.
 */
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import native from '../modules/notification-capture';
import { parseFinancialMessage } from './debitParser';
import { processIncomingFinancialMessage } from './notifications';
import {
  CapturedItem,
  RetryEntry,
  SeenEntry,
  addSeen,
  fingerprint,
  isDuplicate,
  parseQueue,
  pruneRetry,
  pruneSeen,
} from '../utils/captureQueue';

export type CaptureState = 'unsupported' | 'needs-access' | 'paused' | 'active';

const SEEN_KEY = 'notifCapture.seen.v1';
const RETRY_KEY = 'notifCapture.retry.v1';
const POLL_MS = 20_000;

export function getCaptureState(): CaptureState {
  if (!native) return 'unsupported';
  try {
    if (!native.isAccessGranted()) return 'needs-access';
    return native.isPaused() ? 'paused' : 'active';
  } catch {
    return 'unsupported';
  }
}

/** Opens Android's Notification access screen. Returns which screen opened, or null when unsupported. */
export function openCaptureAccessSettings(): 'detail' | 'list' | 'app' | null {
  try {
    return native ? native.openAccessSettings() : null;
  } catch {
    return null;
  }
}

/** Opens this app's App info page (for "Allow restricted settings" on sideloaded builds). */
export function openCaptureAppInfo(): boolean {
  try {
    return native ? native.openAppInfo() : false;
  } catch {
    return false;
  }
}

export function setCapturePaused(paused: boolean): void {
  try {
    native?.setPaused(paused);
  } catch {
    /* best effort */
  }
}

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, list: unknown[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* best effort */
  }
}

let running = false;

/**
 * Drains the queue and records each captured transaction. Returns how many were recorded.
 * A transaction that could not be recorded (offline, server error) is kept and retried later.
 */
export async function processCapturedNotifications(userId?: string | null): Promise<number> {
  if (running || !native || getCaptureState() !== 'active') return 0;
  running = true;
  let recorded = 0;
  try {
    const now = Date.now();
    let seen = pruneSeen(await readList<SeenEntry>(SEEN_KEY), now);
    const retries = pruneRetry(await readList<RetryEntry>(RETRY_KEY), now);
    const fresh = parseQueue(native.drainQueue());
    if (fresh.length === 0 && retries.length === 0) return 0;

    const stillFailing: RetryEntry[] = [];
    const attempt = async (text: string, at: number) => {
      const res = await processIncomingFinancialMessage(text, userId, { capturedAt: at || undefined });
      if (!res) return; // not a transaction, or alerts are switched off: drop it
      if (res.addedToExpense || res.addedToIncome) recorded++;
      else if (!res.duplicate) stillFailing.push({ text, at: at || now });
    };

    for (const entry of retries) await attempt(entry.text, entry.at);

    for (const item of fresh as CapturedItem[]) {
      const parsed = parseFinancialMessage(item.text);
      const fp = fingerprint(parsed.direction, parsed.amount ?? undefined);
      if (isDuplicate(seen, item, fp)) continue;
      seen = addSeen(seen, item, fp, now);
      await attempt(item.text, item.at);
    }

    await writeList(SEEN_KEY, seen);
    await writeList(RETRY_KEY, pruneRetry(stillFailing, now));
  } catch (err) {
    console.warn('[NotificationCapture] Processing failed:', err);
  } finally {
    running = false;
  }
  return recorded;
}

/** Processes the queue now, whenever the app comes to the foreground, and about every 20 s while active. */
export function startCapturePolling(userId?: string | null): () => void {
  if (!native) return () => {};
  const run = () => {
    void processCapturedNotifications(userId).catch(() => {});
  };
  let timer: ReturnType<typeof setInterval> | null = null;
  const start = () => {
    run();
    if (!timer) timer = setInterval(run, POLL_MS);
  };
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
  start();
  const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'active') start();
    else stop();
  });
  return () => {
    stop();
    sub.remove();
  };
}
