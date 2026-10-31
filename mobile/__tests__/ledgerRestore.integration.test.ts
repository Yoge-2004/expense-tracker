/**
 * Runs the real restore code against a REAL backend (booted by CI), not a fake one.
 * Skipped unless RESTORE_TEST_BACKEND_URL is set, so normal local runs are unaffected.
 *
 * Scenario: account A holds a varied ledger. Its data is read back exactly as the dashboard would cache it and
 * used as the "device copy" of a brand-new, empty account B (standing in for a restored-but-empty server).
 * Restoring must recreate everything in B, verify itself, and be a no-op the second time.
 */
const mockCtx = { base: '', token: '' };

/** Real HTTP via Node's http module: the project's Jest setup replaces global fetch with a stub. */
function mockHttp(method: string, url: string, headers: Record<string, string>, body?: string): Promise<{ ok: boolean; status: number; text: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const http = require('http');
  const m = /^http:\/\/([^:/]+):?(\d*)(\/.*)?$/.exec(url);
  if (!m) return Promise.reject(new Error(`bad url ${url}`));
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: m[1], port: m[2] || 80, path: m[3] || '/', method, headers: body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers },
      (res: any) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => { data += c; });
        res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: '/tmp/', documentDirectory: '/tmp/', writeAsStringAsync: jest.fn() }));
jest.mock('../utils/fileDownloader', () => ({ saveFileToDevice: jest.fn() }));
jest.mock('../services/api', () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
  }
  return {
    ApiError,
    invalidateApiCache: jest.fn(),
    apiRequest: async (endpoint: string, opts: any = {}) => {
      const res = await mockHttp(opts.method || 'GET', `${mockCtx.base}/api${endpoint}`,
        { 'Content-Type': 'application/json', Authorization: `Bearer ${mockCtx.token}` }, opts.body);
      if (!res.ok) throw new ApiError(`${res.status} ${endpoint}: ${res.text.slice(0, 200)}`, res.status);
      return res.text ? JSON.parse(res.text) : null;
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyRestore, captureVaultIfMissing, computeRestorePlan, fetchServerLedger } from '../services/ledgerVault';
import { LedgerData, signatures } from '../utils/ledgerReconcile';

const BASE = process.env.RESTORE_TEST_BACKEND_URL;
const suite = BASE ? describe : describe.skip;

async function raw(token: string, method: string, path: string, body?: unknown): Promise<any> {
  const res = await mockHttp(method, `${BASE}/api${path}`,
    { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body === undefined ? undefined : JSON.stringify(body));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${res.text.slice(0, 300)}`);
  return res.text ? JSON.parse(res.text) : null;
}

async function newUser(tag: string): Promise<{ id: number; token: string }> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `restore_${tag}_${stamp}@example.com`;
  const body = { name: `Restore ${tag}`, username: `rt${tag}${stamp}`.slice(0, 20), email, password: 'Passw0rd!x' };
  const json = { 'Content-Type': 'application/json' };
  const reg = await mockHttp('POST', `${BASE}/api/auth/register`, json, JSON.stringify(body));
  if (!reg.ok) throw new Error(`register failed ${reg.status} ${reg.text.slice(0, 300)}`);
  const login = await mockHttp('POST', `${BASE}/api/auth/login`, json, JSON.stringify({ email, password: body.password }));
  if (!login.ok) throw new Error(`login failed ${login.status} ${login.text.slice(0, 300)}`);
  const j: any = JSON.parse(login.text);
  return { id: j.userId, token: j.token };
}

const sigSet = (items: any[], sig: (x: any) => string) => items.map(sig).sort();

suite('restore against a real backend', () => {
  jest.setTimeout(120_000);

  it('recreates a varied ledger in an empty account, verifies itself, and is idempotent', async () => {
    mockCtx.base = BASE as string;
    const a = await newUser('a');
    const b = await newUser('b');

    // ---- build account A with raw requests written independently of the restore code ----
    const globals: any[] = await raw(a.token, 'GET', '/categories/global');
    expect(globals.length).toBeGreaterThanOrEqual(2);
    const food = globals[0];
    const other = globals[1];
    const pets = await raw(a.token, 'POST', `/categories/user/${a.id}`, { name: 'Pets & Vets' });
    const cats = [food, other, pets];
    for (let i = 0; i < 24; i++) {
      const c = cats[i % 3];
      await raw(a.token, 'POST', `/expenses/user/${a.id}`, {
        amount: 5 + i * 1.25, description: i % 6 === 0 ? 'Duplicate lunch' : `Item ${i} – café “quote” ₹`,
        expenseDate: `2026-0${1 + (i % 9)}-1${i % 9}`, categoryId: c.id,
      });
    }
    await raw(a.token, 'POST', `/incomes/user/${a.id}`, { amount: 5000, source: 'Salary', description: 'May pay', incomeDate: '2026-05-01', kind: 'SALARY' });
    await raw(a.token, 'POST', `/incomes/user/${a.id}`, { amount: 120.5, source: 'Gift', description: '', incomeDate: '2026-05-09', kind: 'OTHER' });
    await raw(a.token, 'POST', `/savings/goals/user/${a.id}`, { name: 'New bike', targetAmount: 900, currentAmount: 150, targetDate: '2027-01-01' });
    await raw(a.token, 'POST', `/loans/user/${a.id}`, { counterparty: 'Sam', type: 'LENT', amount: 75, adjustmentDate: '2026-04-02', notes: 'dinner' });
    await raw(a.token, 'POST', `/expenses/budget/user/${a.id}`, { categoryId: food.id, limitAmount: 300, period: 'MONTHLY' });
    await raw(a.token, 'POST', `/expenses/recurring/user/${a.id}`, {
      amount: 99, description: 'Music plan', expenseDate: '2026-05-01', categoryId: other.id, frequency: 'MONTHLY',
    });

    // ---- the "device copy": A's data read back as the dashboard would cache it ----
    mockCtx.token = a.token;
    const deviceCopy: LedgerData = await fetchServerLedger(a.id);
    // 24 plain expenses + the first occurrence the server records for the recurring item
    expect(deviceCopy.expenses!.length).toBe(25);
    await AsyncStorage.setItem(`expense_cache_v4_${b.id}`, JSON.stringify({ savedAt: Date.now(), ...deviceCopy }));
    await captureVaultIfMissing(String(b.id), deviceCopy);

    // B stands in for a restored Neon: it already holds exact copies of some records, EDITED versions of others,
    // and a record of its own. None of that may be duplicated or overwritten.
    mockCtx.token = b.token;
    const plain = deviceCopy.expenses!.filter((e) => e.description !== 'Music plan' && e.description !== 'Duplicate lunch' && e.categoryName !== 'Pets & Vets');
    const exact = plain.slice(0, 6);
    const edited = plain.slice(6, 8);
    for (const e of exact) await raw(b.token, 'POST', `/expenses/user/${b.id}`, { amount: e.amount, description: e.description, expenseDate: e.expenseDate, categoryId: e.categoryId });
    for (const e of edited) await raw(b.token, 'POST', `/expenses/user/${b.id}`, { amount: Number(e.amount) + 1000, description: e.description, expenseDate: e.expenseDate, categoryId: e.categoryId });
    await raw(b.token, 'POST', `/expenses/user/${b.id}`, { amount: 1.5, description: 'server-only record', expenseDate: '2026-02-02', categoryId: food.id });
    await raw(b.token, 'POST', `/incomes/user/${b.id}`, { amount: 5000, source: 'Salary', description: 'May pay', incomeDate: '2026-05-01', kind: 'SALARY' });
    await raw(b.token, 'POST', `/savings/goals/user/${b.id}`, { name: 'New bike', targetAmount: 900, currentAmount: 150, targetDate: '2027-01-01' });

    const before = await computeRestorePlan(String(b.id));
    // 17 expenses (25 - 6 exact copies - 2 edited look-alikes) + Gift income + loan + budget + recurring + 'Pets & Vets'
    expect(before!.total).toBe(22);
    expect(before!.conflicts).toBe(2);

    const result = await applyRestore(String(b.id));
    expect(result.failures).toEqual([]);
    expect(result.verified).toBe(true);
    expect(result.remainingAfterVerify).toBe(0);
    expect(result.conflicts).toBe(2);

    // ---- independent check: compare B's server data with A's, record by record ----
    const restored = await fetchServerLedger(b.id);
    const editedIds = new Set(edited.map((e) => e.id));
    const expected = [
      ...deviceCopy.expenses!.filter((e) => !editedIds.has(e.id)),
      ...edited.map((e) => ({ ...e, amount: Number(e.amount) + 1000 })), // the server's edited version is kept
    ];
    expect(sigSet(restored.expenses!.filter((e) => e.description !== 'server-only record'), signatures.expense))
      .toEqual(sigSet(expected, signatures.expense));
    // no duplicates anywhere: exactly the device records + the server-only one
    expect(restored.expenses!.length).toBe(deviceCopy.expenses!.length + 1);
    expect(restored.incomes!.filter((i) => i.source === 'Salary')).toHaveLength(1);
    expect(restored.savingsGoals!.filter((g) => g.name === 'New bike')).toHaveLength(1);
    expect(restored.expenses!.filter((e) => e.description === 'server-only record')).toHaveLength(1);
    expect(sigSet(restored.incomes!, signatures.income)).toEqual(sigSet(deviceCopy.incomes!, signatures.income));
    expect(sigSet(restored.savingsGoals!, signatures.goal)).toEqual(sigSet(deviceCopy.savingsGoals!, signatures.goal));
    expect(sigSet(restored.loans!, signatures.loan)).toEqual(sigSet(deviceCopy.loans!, signatures.loan));
    expect(sigSet(restored.budgets!, signatures.budget)).toEqual(sigSet(deviceCopy.budgets!, signatures.budget));
    expect(sigSet(restored.subscriptions!, signatures.subscription)).toEqual(sigSet(deviceCopy.subscriptions!, signatures.subscription));
    expect(restored.savingsGoals![0].currentAmount).toBe(deviceCopy.savingsGoals![0].currentAmount);

    // ---- running it again must send nothing ----
    const again = await applyRestore(String(b.id));
    expect(again.attempted).toBe(0);
    expect((await fetchServerLedger(b.id)).expenses!.length).toBe(restored.expenses!.length);
  });
});
