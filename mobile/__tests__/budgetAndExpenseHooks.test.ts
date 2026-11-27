/**
 * @jest-environment node
 *
 * Tests useBudgetForm payload contract (limitAmount & intervalDays)
 * and useExpenseForm duplicate detection cache lookup & request cancellation.
 */

const mockHookRuntime = {
  states: [] as unknown[],
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<{ deps?: unknown[]; cleanup?: (() => void) | void }>,
  stateIdx: 0,
  refIdx: 0,
  effectIdx: 0,
};

function resetHookRuntime() {
  for (const eff of mockHookRuntime.effects) {
    if (typeof eff.cleanup === 'function') eff.cleanup();
  }
  mockHookRuntime.states.length = 0;
  mockHookRuntime.refs.length = 0;
  mockHookRuntime.effects.length = 0;
  mockHookRuntime.stateIdx = 0;
  mockHookRuntime.refIdx = 0;
  mockHookRuntime.effectIdx = 0;
}

function beginRender() {
  mockHookRuntime.stateIdx = 0;
  mockHookRuntime.refIdx = 0;
  mockHookRuntime.effectIdx = 0;
}

jest.mock('react', () => {
  const actual = jest.requireActual('react');
  return {
    ...actual,
    useState: (initial: unknown) => {
      const idx = mockHookRuntime.stateIdx++;
      if (!(idx in mockHookRuntime.states)) {
        mockHookRuntime.states[idx] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
      }
      const setter = (next: unknown) => {
        const updater = next as ((...mockArgs: unknown[]) => unknown);
        mockHookRuntime.states[idx] = typeof next === 'function'
          ? updater(mockHookRuntime.states[idx])
          : next;
      };
      return [mockHookRuntime.states[idx], setter];
    },
    useRef: (initial: unknown) => {
      const idx = mockHookRuntime.refIdx++;
      if (!(idx in mockHookRuntime.refs)) {
        mockHookRuntime.refs[idx] = { current: initial };
      }
      return mockHookRuntime.refs[idx];
    },
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
      const idx = mockHookRuntime.effectIdx++;
      const prev = mockHookRuntime.effects[idx];
      const changed = !prev || !deps || !prev.deps || deps.some((d, i) => !Object.is(d, prev.deps![i]));
      if (changed) {
        if (typeof prev?.cleanup === 'function') prev.cleanup();
        const cleanup = effect();
        mockHookRuntime.effects[idx] = { deps, cleanup };
      }
    },
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

jest.mock('../services/notifications', () => ({
  notifyTransactionRecorded: jest.fn().mockResolvedValue(true),
  parseFinancialMessage: jest.fn(),
  formatNotificationAmount: jest.fn((a: number) => `₹${a}`),
}));

jest.mock('../services/receiptOcr', () => ({
  parseReceiptText: jest.fn(),
  scanReceiptWithOcr: jest.fn(),
  SAMPLE_RECEIPTS: [],
}));

const mockSetBudget = jest.fn().mockResolvedValue({ categoryId: 1, limit: 5000 });
const mockGetStatusByUserId = jest.fn().mockResolvedValue([]);

jest.mock('../services/repositories', () => ({
  budgetRepository: {
    setBudget: mockSetBudget,
    getStatusByUserId: mockGetStatusByUserId,
    deleteById: jest.fn(),
    deleteByUserAndCategory: jest.fn(),
  },
  expenseRepository: {
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const mockApiRequest = jest.fn();
jest.mock('../services/api', () => {
  const actual = jest.requireActual('../services/api');
  return {
    ...actual,
    apiRequest: mockApiRequest,
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBudgetForm } from '../hooks/useBudgetForm';
import { useExpenseForm } from '../hooks/useExpenseForm';

describe('Form Hooks Contract & Robustness', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetHookRuntime();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetHookRuntime();
  });

  it('useBudgetForm submits limitAmount and includes intervalDays only for CUSTOM budgets', async () => {
    const showAlert = jest.fn();
    const onSuccess = jest.fn();
    const categories = [{ id: 1, name: 'Food' }];

    beginRender();
    const hookCustom = useBudgetForm({
      userId: 10,
      categories,
      isEditMode: false,
      initialParams: {
        categoryId: '1',
        amount: '5000',
        period: 'CUSTOM',
        intervalDays: '14',
      },
      onSuccess,
      showAlert,
    });

    await hookCustom.handleSaveBudget();

    expect(mockSetBudget).toHaveBeenCalledWith(10, {
      categoryId: 1,
      limitAmount: 5000,
      period: 'CUSTOM',
      intervalDays: 14,
    });

    resetHookRuntime();
    jest.clearAllMocks();
    beginRender();
    const hookMonthly = useBudgetForm({
      userId: 10,
      categories,
      isEditMode: false,
      initialParams: {
        categoryId: '1',
        amount: '8000',
        period: 'MONTHLY',
        intervalDays: '14',
      },
      onSuccess,
      showAlert,
    });

    await hookMonthly.handleSaveBudget();

    expect(mockSetBudget).toHaveBeenCalledWith(10, {
      categoryId: 1,
      limitAmount: 8000,
      period: 'MONTHLY',
    });
  });

  it('useExpenseForm queries expense_cache_v4_${userId} for duplicate detection and aborts in-flight ML signals on unmount', async () => {
    jest.useFakeTimers();
    await AsyncStorage.setItem(
      'expense_cache_v4_42',
      JSON.stringify([
        { description: 'Blue Tokai Cold Brew', amount: 280 },
        { description: 'Metro Card Topup', amount: 500 },
      ])
    );

    let capturedDupSignal: AbortSignal | undefined;
    mockApiRequest.mockImplementation(async (endpoint: string, init?: RequestInit) => {
      if (endpoint === '/ml/duplicates/check') {
        capturedDupSignal = init?.signal ?? undefined;
        return { matches: [{ text: 'Blue Tokai Cold Brew', similarity: 0.91 }] };
      }
      return null;
    });

    beginRender();
    useExpenseForm({
      userId: 42,
      currSymbol: '₹',
      categories: [{ id: 1, name: 'Food' }],
      isEditMode: false,
      initialParams: {
        description: 'Blue Tokai Coffee',
        amount: '280',
        categoryId: '1',
        date: '2026-11-26',
      },
      onSuccess: jest.fn(),
      showAlert: jest.fn(),
    });

    await jest.advanceTimersByTimeAsync(500);

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/ml/duplicates/check',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          query: 'Blue Tokai Coffee',
          candidates: ['Blue Tokai Cold Brew'],
          threshold: 0.65,
        }),
      })
    );
    expect(capturedDupSignal).toBeDefined();
    expect(capturedDupSignal?.aborted).toBe(false);

    resetHookRuntime();
    expect(capturedDupSignal?.aborted).toBe(true);
  });
});
