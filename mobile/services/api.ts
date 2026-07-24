import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://yoge-2004-expense-tracker-backend.hf.space/api';
const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';
const NAME_KEY = 'user_name';

const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 15000; // 15 seconds TTL to reduce server queries

export async function saveSession(token: string, userId: string, name: string) {
  apiCache.clear();
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_ID_KEY, userId);
  await SecureStore.setItemAsync(NAME_KEY, name || 'Tracker');
}

export async function clearSession() {
  apiCache.clear();
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_ID_KEY);
  await SecureStore.deleteItemAsync(NAME_KEY);
}

export async function getSession() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  const userId = await SecureStore.getItemAsync(USER_ID_KEY);
  const name = await SecureStore.getItemAsync(NAME_KEY);
  return { token, userId, name };
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const method = (options.method || 'GET').toUpperCase();

  // Clear cache for write operations
  if (method !== 'GET') {
    apiCache.clear();
  }

  if (method === 'GET') {
    const cached = apiCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const { token } = await getSession();
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...options.headers,
  });

  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 503) {
    const text = await response.text();
    let msg = 'Database service is unavailable. Please try again later.';
    try {
      const err = JSON.parse(text);
      if (err.message) msg = err.message;
    } catch {}
    throw new Error(msg);
  }

  if (response.status === 401 && !endpoint.includes('/auth/login')) {
    await clearSession();
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (response.status === 204) return null;

  const text = await response.text();
  if (!response.ok) {
    try {
      const error = JSON.parse(text);
      throw new Error(error.message || error.error || 'Request failed.');
    } catch {
      throw new Error(text || 'An unexpected error occurred.');
    }
  }

  const data = text ? JSON.parse(text) : null;

  if (method === 'GET') {
    apiCache.set(endpoint, { data, timestamp: Date.now() });
  }

  return data;
}
