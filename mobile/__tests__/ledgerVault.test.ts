const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
    setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
  },
}));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: '/tmp/', documentDirectory: '/tmp/', writeAsStringAsync: jest.fn() }));
jest.mock('../utils/fileDownloader', () => ({ saveFileToDevice: jest.fn() }));

// A tiny in-memory "mockServer": GET returns lists, POST appends with a fresh id.
const mockServer: any = { expenses: [], incomes: [], goals: [], loans: [], subs: [], budgets: [], user: [], global: [{ id: 1, name: 'Food' }] };
let mockFailList: string | null = null;
const mockPosts: string[] = [];
let mockNextId = 1000;
jest.mock('../services/api', () => {
  class ApiError extends Error { status = 0; }
  return {
    ApiError,
    invalidateApiCache: jest.fn(),
    apiRequest: jest.fn(async (endpoint: string, opts: any = {}) => {
      const method = (opts.method || 'GET').toUpperCase();
      const cat = (id: number) => [...mockServer.global, ...mockServer.user].find((c: any) => c.id === id)?.name;
      if (method === 'POST') {
        mockPosts.push(endpoint);
        const body = JSON.parse(opts.body);
        const id = mockNextId++;
        if (endpoint.includes('/categories/user')) mockServer.user.push({ id, name: body.name });
        else if (endpoint.includes('/expenses/recurring')) {
          mockServer.subs.push({ ...body, id, categoryName: cat(body.categoryId) });
          // the real server also records the first occurrence as an ordinary expense
          mockServer.expenses.push({ amount: body.amount, description: body.description, expenseDate: body.expenseDate, categoryId: body.categoryId, id: mockNextId++, categoryName: cat(body.categoryId) });
        }
        else if (endpoint.includes('/expenses/budget')) mockServer.budgets.push({ ...body, id, categoryName: cat(body.categoryId), limit: body.limitAmount });
        else if (endpoint.includes('/expenses/user')) mockServer.expenses.push({ ...body, id, categoryName: cat(body.categoryId) });
        else if (endpoint.includes('/incomes')) mockServer.incomes.push({ ...body, id });
        else if (endpoint.includes('/savings')) mockServer.goals.push({ ...body, id });
        else if (endpoint.includes('/loans')) mockServer.loans.push({ ...body, id });
        return {};
      }
      const map: Record<string, string> = {
        '/expenses/budget/status': 'budgets', '/categories/global': 'global', '/categories/user': 'user',
        '/expenses/recurring': 'subs', '/expenses/user': 'expenses', '/incomes/user': 'incomes', '/savings/goals': 'goals',
      };
      const key = Object.keys(map).find((p) => endpoint.startsWith(p))!;
      if (mockFailList === map[key]) throw new Error('network down');
      return mockServer[map[key]];
    }),
  };
});
jest.mock('../services/loans', () => ({
  getLoans: jest.fn(async () => { if (mockFailList === 'loans') throw new Error('network down'); return mockServer.loans; }),
}));

import {
  applyRestore, captureVaultIfMissing, computeRestorePlan, getDeviceLedger, preserveBeforeOverwrite, readVault,
} from '../services/ledgerVault';

const e = (i: number, over: any = {}) => ({ id: i, amount: 10 + i, description: `item ${i}`, expenseDate: '2026-05-01', categoryName: 'Food', categoryId: 1, ...over });
const ledger = (n: number) => ({
  expenses: [...Array.from({ length: n }, (_, i) => e(i)), { id: 999, amount: 99, description: 'Music', expenseDate: '2026-05-01', categoryName: 'Food', categoryId: 1 }],
  incomes: [{ id: 1, amount: 500, source: 'Salary', incomeDate: '2026-05-01', isRecurring: false }],
  savingsGoals: [{ id: 1, name: 'Bike', targetAmount: 900, currentAmount: 100 }],
  loans: [{ id: 1, counterparty: 'Sam', type: 'LENT', amount: 5, adjustmentDate: '2026-04-01', expenseId: 3 }],
  budgets: [{ budgetId: 1, categoryName: 'Food', period: 'MONTHLY', limit: 200, startDate: '2026-05-01' }],
  subscriptions: [{ id: 1, amount: 99, description: 'Music', frequency: 'MONTHLY', categoryName: 'Food', expenseDate: '2026-05-01' }],
  categories: [{ id: 1, name: 'Food' }, { id: 77, name: 'Pets' }],
});

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  Object.assign(mockServer, { expenses: [], incomes: [], goals: [], loans: [], subs: [], budgets: [], user: [], global: [{ id: 1, name: 'Food' }] });
  mockFailList = null; mockPosts.length = 0; mockNextId = 1000;
});

describe('device vault', () => {
  it('captures the cached ledger once and keeps it when the server later returns far less', async () => {
    await captureVaultIfMissing('u1', ledger(30));
    await captureVaultIfMissing('u1', ledger(2)); // must not replace
    expect((await readVault('u1'))!.data.expenses).toHaveLength(31);
    mockStore['expense_cache_v4_u1'] = JSON.stringify(ledger(30));
    const kept = await preserveBeforeOverwrite('u1', ledger(3));
    expect(kept).toBe(false); // vault already holds an equal copy, nothing to move
    delete mockStore['expense_vault_v1_u1'];
    expect(await preserveBeforeOverwrite('u1', ledger(3))).toBe(true);
    expect((await getDeviceLedger('u1'))!.data.expenses).toHaveLength(31);
  });

  it('does not touch the vault for a normal small change', async () => {
    mockStore['expense_cache_v4_u1'] = JSON.stringify(ledger(30));
    expect(await preserveBeforeOverwrite('u1', ledger(28))).toBe(false);
    expect(await readVault('u1')).toBeNull();
  });
});

describe('restore to server', () => {
  it('uploads everything missing to an emptied server, verifies, and a second run sends nothing', async () => {
    await captureVaultIfMissing('u1', ledger(12));
    const r = await applyRestore('u1');
    expect(r.failures).toEqual([]);
    expect(r.verified).toBe(true);
    expect(r.remainingAfterVerify).toBe(0);
    expect(mockServer.expenses).toHaveLength(13);
    expect(mockServer.user.map((c: any) => c.name)).toEqual(['Pets']);
    const before = mockPosts.length;
    const again = await applyRestore('u1');
    expect(again.attempted).toBe(0);
    expect(mockPosts.length).toBe(before);
  });

  it('only adds what is missing when the server already has part of the data', async () => {
    mockServer.expenses = ledger(12).expenses.slice(0, 5).map((x, i) => ({ ...x, id: 500 + i }));
    await captureVaultIfMissing('u1', ledger(12));
    const plan = await computeRestorePlan('u1');
    expect(plan!.plan.expenses).toHaveLength(8);
    await applyRestore('u1');
    expect(mockServer.expenses).toHaveLength(13);
  });

  it('fails closed: if any server list cannot be read, nothing is uploaded', async () => {
    await captureVaultIfMissing('u1', ledger(12));
    for (const list of ['expenses', 'incomes', 'goals', 'budgets', 'subs', 'loans', 'user']) {
      mockFailList = list;
      await expect(applyRestore('u1')).rejects.toThrow();
    }
    expect(mockPosts).toHaveLength(0);
  });

  it('reports records it cannot map and does not claim verification', async () => {
    const data: any = ledger(2);
    data.expenses.push(e(9, { categoryName: 'Gone' }));
    data.categories = [{ id: 1, name: 'Food' }];
    await captureVaultIfMissing('u1', data);
    const r = await applyRestore('u1');
    expect(r.failures.some((f) => f.kind === 'expense')).toBe(true);
    expect(r.verified).toBe(false);
  });
});
