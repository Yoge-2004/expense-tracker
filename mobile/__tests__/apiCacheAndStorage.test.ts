/**
 * @jest-environment node
 *
 * Tests API caching semantics, custom server URL cache scoping/clearing,
 * custom request option stripping, and storage lock deadlock safety.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiRequest,
  clearSession,
  invalidateApiCache,
  safeStorageDelete,
  safeStorageGet,
  setCustomServerUrl,
} from '../services/api';

const makeJsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

describe('API Cache & Serialized Storage Resilience', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    invalidateApiCache();
    await setCustomServerUrl(null);
    await AsyncStorage.clear();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('bypasses GET cache when skipCache is true and strips custom flags from fetch init', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ items: [1] }))
      .mockResolvedValueOnce(makeJsonResponse({ items: [1, 2] }));
    globalThis.fetch = fetchMock;

    const first = await apiRequest('/expenses/user/1');
    expect(first).toEqual({ items: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Cached hit
    const cached = await apiRequest('/expenses/user/1');
    expect(cached).toEqual({ items: [1] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Explicit skipCache bypasses cache and strips non-fetch flags
    const fresh = await apiRequest('/expenses/user/1', {
      skipCache: true,
      skipAuthRedirect: true,
    });
    expect(fresh).toEqual({ items: [1, 2] });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const fetchInit = fetchMock.mock.calls[1][1] as Record<string, unknown>;
    expect(fetchInit).not.toHaveProperty('skipCache');
    expect(fetchInit).not.toHaveProperty('skipAuthRedirect');
  });

  it('clears cache when switching custom server URL and targets the new base URL', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ env: 'default' }))
      .mockResolvedValueOnce(makeJsonResponse({ env: 'custom' }));
    globalThis.fetch = fetchMock;

    const defaultResp = await apiRequest('/categories/global');
    expect(defaultResp).toEqual({ env: 'default' });

    await setCustomServerUrl('https://staging.example.com');

    const customResp = await apiRequest('/categories/global');
    expect(customResp).toEqual({ env: 'custom' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://staging.example.com/api/categories/global');
  });

  it('preserves GET cache on read-only ML POST endpoints but invalidates on mutating POSTs', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(makeJsonResponse([{ id: 1 }]))
      .mockResolvedValueOnce(makeJsonResponse({ category: 'food_dining', confidence: 0.9 }))
      .mockResolvedValueOnce(makeJsonResponse({ id: 2 }))
      .mockResolvedValueOnce(makeJsonResponse([{ id: 1 }, { id: 2 }]));
    globalThis.fetch = fetchMock;

    await apiRequest('/expenses/user/1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Read-only ML POST should NOT clear GET cache
    await apiRequest('/ml/classify', {
      method: 'POST',
      body: JSON.stringify({ description: 'Coffee' }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const stillCached = await apiRequest('/expenses/user/1');
    expect(stillCached).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Mutating POST MUST clear GET cache
    await apiRequest('/expenses/user/1', {
      method: 'POST',
      body: JSON.stringify({ description: 'Lunch', amount: 150 }),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const refetched = await apiRequest('/expenses/user/1');
    expect(refetched).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('executes concurrent clearSession, safeStorageGet, and safeStorageDelete without re-entrant deadlock', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('cached_val');

    const results = await Promise.all([
      clearSession(),
      safeStorageGet('user_name'),
      safeStorageDelete('user_photo'),
      clearSession(),
    ]);

    expect(results[1]).toBe('cached_val');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalled();
  });
});
