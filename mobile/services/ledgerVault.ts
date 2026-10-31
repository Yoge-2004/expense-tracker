/**
 * Keeps a safety copy ("vault") of the ledger cached on this device and lets the owner push whatever the
 * server is missing back to it, using only the server's existing authenticated endpoints.
 *
 * Why: the dashboard cache is replaced by every successful server fetch, so if the server ever returns less
 * than the device already holds, the device's only surviving copy would be overwritten. The vault keeps the
 * larger copy aside (and survives logout), and the restore functions compare it with the server record by
 * record before adding anything.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { apiRequest, ApiError, invalidateApiCache } from './api';
import { getLoans } from './loans';
import { saveFileToDevice } from '../utils/fileDownloader';
import {
  LedgerData, RestorePlan, bodies, buildRestorePlan, isSuspiciousDrop, ledgerRichness, norm, planTotal,
} from '../utils/ledgerReconcile';

export const cacheKeyFor = (userId: string | number) => `expense_cache_v4_${userId}`;
export const vaultKeyFor = (userId: string | number) => `expense_vault_v1_${userId}`;

export interface Vault {
  savedAt: number;
  reason: string;
  data: LedgerData;
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const readVault = (userId: string | number) => readJson<Vault>(vaultKeyFor(userId));

async function writeVault(userId: string | number, data: LedgerData, reason: string): Promise<void> {
  const vault: Vault = { savedAt: Date.now(), reason, data };
  await AsyncStorage.setItem(vaultKeyFor(userId), JSON.stringify(vault));
}

/** First run with this build: whatever is cached right now is the copy worth protecting. */
export async function captureVaultIfMissing(userId: string | number, cached: LedgerData | null): Promise<void> {
  try {
    if (!cached || ledgerRichness(cached) === 0) return;
    if (await readVault(userId)) return;
    await writeVault(userId, cached, 'first-run');
  } catch {
    /* the vault is a safety net; it must never break the dashboard */
  }
}

/**
 * Called right before the cache is overwritten with `incoming` (fresh server data). If the server now returns
 * far less than the device held, the previous copy is moved into the vault, unless the vault already holds more.
 */
export async function preserveBeforeOverwrite(userId: string | number, incoming: LedgerData): Promise<boolean> {
  try {
    const previous = await readJson<LedgerData & { savedAt?: number }>(cacheKeyFor(userId));
    if (!previous || !isSuspiciousDrop(previous, incoming)) return false;
    const vault = await readVault(userId);
    if (vault && ledgerRichness(vault.data) >= ledgerRichness(previous)) return false;
    await writeVault(userId, previous, 'before-suspicious-overwrite');
    return true;
  } catch {
    return false;
  }
}

/** The richer of the vault and the live cache: the best copy this device has. */
export async function getDeviceLedger(
  userId: string | number
): Promise<{ data: LedgerData; source: 'vault' | 'cache' } | null> {
  const [vault, cache] = await Promise.all([readVault(userId), readJson<LedgerData>(cacheKeyFor(userId))]);
  const vaultData = vault?.data ?? null;
  if (vaultData && ledgerRichness(vaultData) >= ledgerRichness(cache)) return { data: vaultData, source: 'vault' };
  if (cache && ledgerRichness(cache) > 0) return { data: cache, source: 'cache' };
  return null;
}

/** Writes the device copy to a JSON file the owner can keep. Works fully offline. */
export async function exportDeviceCopy(userId: string | number): Promise<{ ok: boolean; records: number }> {
  const device = await getDeviceLedger(userId);
  if (!device) return { ok: false, records: 0 };
  const filename = `expense-tracker-device-copy-${new Date().toISOString().slice(0, 10)}.json`;
  const uri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${filename}`;
  const payload = {
    format: 'expense-tracker-device-copy', version: 1, exportedAt: new Date().toISOString(),
    userId: String(userId), source: device.source, data: device.data,
  };
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
  await saveFileToDevice(uri, filename, 'application/json');
  return { ok: true, records: ledgerRichness(device.data) };
}

/** Reads the whole server ledger. Throws if ANY list fails, because "failed" must never look like "empty". */
export async function fetchServerLedger(userId: string | number): Promise<LedgerData> {
  invalidateApiCache();
  const [expenses, budgets, globalCats, userCats, subscriptions, incomes, savingsGoals, loans] = await Promise.all([
    apiRequest(`/expenses/user/${userId}`),
    apiRequest(`/expenses/budget/status/user/${userId}`),
    apiRequest(`/categories/global`),
    apiRequest(`/categories/user/${userId}`),
    apiRequest(`/expenses/recurring/user/${userId}`),
    apiRequest(`/incomes/user/${userId}`),
    apiRequest(`/savings/goals/user/${userId}`),
    getLoans(userId),
  ]);
  const lists = { expenses, budgets, globalCats, userCats, subscriptions, incomes, savingsGoals, loans };
  for (const [name, value] of Object.entries(lists)) {
    if (!Array.isArray(value)) throw new Error(`The server did not return a valid ${name} list; nothing was changed.`);
  }
  return {
    expenses, budgets, subscriptions, incomes, savingsGoals, loans,
    categories: [...(globalCats as any[]), ...(userCats as any[])],
  };
}

export interface PlanResult {
  plan: RestorePlan;
  device: LedgerData;
  total: number;
  deviceRecords: number;
  source: 'vault' | 'cache';
}

/** Read-only: what would be uploaded. */
export async function computeRestorePlan(userId: string | number): Promise<PlanResult | null> {
  const device = await getDeviceLedger(userId);
  if (!device) return null;
  const server = await fetchServerLedger(userId);
  const plan = buildRestorePlan(device.data, server);
  return { plan, device: device.data, total: planTotal(plan), deviceRecords: ledgerRichness(device.data), source: device.source };
}

export interface RestoreFailure {
  kind: string;
  label: string;
  error: string;
}

export interface RestoreResult {
  attempted: number;
  created: number;
  failures: RestoreFailure[];
  /** Records the device has that the server still lacks after a fresh re-read. 0 together with no failures = in sync. */
  remainingAfterVerify: number;
  verified: boolean;
}

let restoreInFlight: Promise<RestoreResult> | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(endpoint: string, body: unknown): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) });
      return;
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if ((status === 429 || status === 503) && attempt < 4) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

/**
 * Uploads only what the server lacks. Safe to run again after any interruption: every run starts from a fresh
 * comparison, so already-uploaded records are never sent twice. Never edits or deletes server data.
 */
export function applyRestore(
  userId: string | number,
  onProgress?: (done: number, total: number, stage: string) => void
): Promise<RestoreResult> {
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = (async () => {
    try {
      const first = await computeRestorePlan(userId);
      if (!first || first.total === 0) {
        return { attempted: 0, created: 0, failures: [], remainingAfterVerify: 0, verified: !!first };
      }
      const { plan: initial, total, device } = first;
      let plan = initial;
      const failures: RestoreFailure[] = [];
      let done = 0;
      let created = 0;
      const step = async (kind: string, label: string, run: () => Promise<void>) => {
        try {
          await run();
          created++;
        } catch (e: any) {
          failures.push({ kind, label, error: String(e?.message ?? e).slice(0, 160) });
        }
        done++;
        onProgress?.(done, total, kind);
      };

      for (const name of plan.categories) {
        await step('category', name, () => post(`/categories/user/${userId}`, { name }));
      }
      // Category ids are looked up by NAME on the server as it is now; old ids are meaningless after a restore.
      let catIds = new Map<string, number>();
      if (initial.expenses.length || initial.budgets.length || initial.subscriptions.length) {
        invalidateApiCache();
        const [g, u] = await Promise.all([apiRequest(`/categories/global`), apiRequest(`/categories/user/${userId}`)]);
        for (const c of [...(Array.isArray(g) ? g : []), ...(Array.isArray(u) ? u : [])]) {
          if (c?.name && c?.id != null) catIds.set(norm(c.name), Number(c.id));
        }
      }
      const unmapped = (kind: string, label: string) => {
        failures.push({ kind, label, error: 'category not found on server' });
        done++;
        onProgress?.(done, total, kind);
      };

      // Creating a recurring item makes the server record its first occurrence as an ordinary expense, and the
      // device cache holds that expense too. So recurring items go first, then the server is re-read and the
      // remaining work is planned against what it now holds, which prevents a duplicate of that expense.
      for (const s of initial.subscriptions) {
        const body = bodies.subscription(s, catIds);
        if (!body) { unmapped('subscription', String(s?.description ?? '')); continue; }
        await step('subscription', String(s?.description ?? ''), () => post(`/expenses/recurring/user/${userId}`, body));
      }
      plan = buildRestorePlan(device, await fetchServerLedger(userId));

      for (const e of plan.expenses) {
        const body = bodies.expense(e, catIds);
        if (!body) { unmapped('expense', String(e?.description ?? '')); continue; }
        await step('expense', String(e?.description ?? ''), () => post(`/expenses/user/${userId}`, body));
      }
      for (const i of plan.incomes) {
        await step('income', String(i?.source ?? ''), () => post(`/incomes/user/${userId}`, bodies.income(i)));
      }
      for (const g of plan.goals) {
        await step('goal', String(g?.name ?? ''), () => post(`/savings/goals/user/${userId}`, bodies.goal(g)));
      }
      for (const b of plan.budgets) {
        const body = bodies.budget(b, catIds);
        if (!body) { unmapped('budget', String(b?.categoryName ?? '')); continue; }
        await step('budget', String(b?.categoryName ?? ''), () => post(`/expenses/budget/user/${userId}`, body));
      }
      for (const l of plan.loans) {
        await step('loan', String(l?.counterparty ?? ''), () => post(`/loans/user/${userId}`, bodies.loan(l)));
      }

      // Verification: re-read the server and compare again. Only an empty diff counts as "in sync".
      let remaining = -1;
      try {
        const after = await computeRestorePlan(userId);
        remaining = after ? after.total : 0;
      } catch {
        remaining = -1;
      }
      return {
        attempted: total, created, failures, remainingAfterVerify: Math.max(remaining, 0),
        verified: remaining === 0 && failures.length === 0,
      };
    } finally {
      restoreInFlight = null;
    }
  })();
  return restoreInFlight;
}
