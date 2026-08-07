import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ─── API Base URL ──────────────────────────────────────────────────────────────
// In __DEV__ mode, automatically detect your machine's LAN IP from Expo Constants
// or use EXPO_PUBLIC_API_URL / local machine IP.
const REMOTE_API_URL = 'https://yoge-2004-expense-tracker-backend.hf.space/api';

function getLocalApiUrl(): string {
  try {
    // 1. Explicit env var override (e.g. EXPO_PUBLIC_API_URL in .env)
    if (process.env.EXPO_PUBLIC_API_URL) {
      return process.env.EXPO_PUBLIC_API_URL;
    }

    // 2. Expo hostUri (Expo SDK 49+ / SDK 54)
    const hostUri =
      Constants.expoConfig?.hostUri ??
      Constants.manifest2?.extra?.expoClient?.hostUri ??
      (Constants as any).manifest2?.debuggerHost ??
      (Constants as any).manifest?.debuggerHost;

    if (hostUri) {
      const host = hostUri.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return `http://${host}:8080/api`;
      }
    }

    // 3. Fallback to linkingUri
    const linkingUri = Constants.linkingUri || (Constants as any).experienceUrl;
    if (linkingUri && typeof linkingUri === 'string' && linkingUri.includes('://')) {
      const match = linkingUri.match(/\/\/(.*?):/);
      if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1') {
        return `http://${match[1]}:8080/api`;
      }
    }
  } catch (e) {
    // ignore — fall through
  }
  // Default to machine local LAN IP for local dev if auto-detection is unavailable
  return 'http://192.168.29.88:8080/api';
}

const API_BASE_URL = __DEV__ ? getLocalApiUrl() : REMOTE_API_URL;

const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';
const NAME_KEY = 'user_name';

// Maximum number of automatic retries for 503 (DB cold-start) responses
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

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

export async function apiRequest(endpoint: string, options: RequestInit = {}, attempt = 0): Promise<any> {
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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    // Network-level failure (no internet / server down)
    if (__DEV__) {
      throw new Error(
        `Cannot reach the server at ${API_BASE_URL}.\n` +
        `Make sure:\n` +
        `  1. Spring Boot is running (./mvnw spring-boot:run)\n` +
        `  2. Your phone/emulator is on the same Wi-Fi as this machine`
      );
    }
    throw new Error('Unable to connect. Please check your internet connection.');
  }

  if (response.status === 503) {
    if (attempt < MAX_RETRIES) {
      // DB is cold-starting — wait and retry automatically
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      return apiRequest(endpoint, options, attempt + 1);
    }
    const text = await response.text();
    let msg = 'The database is waking up — please wait a moment and try again.';
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

