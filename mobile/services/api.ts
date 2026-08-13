import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';

// ─── API Base URL ──────────────────────────────────────────────────────────────
// In __DEV__ mode, automatically detect your machine's LAN IP from Expo Constants,
// platform loopback (Android emulator / iOS simulator), or EXPO_PUBLIC_API_URL.
const REMOTE_API_URL = 'https://yoge-2004-expense-tracker-backend.hf.space/api';

// Use EXPO_PUBLIC_API_URL from .env, or hardcode the machine's LAN IP.
// On a physical phone, Expo's Constants.expoConfig.hostUri is unreliable,
// so we read the env var that Expo inlines at bundle time.
const LOCAL_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.88:8080/api';
const API_BASE_URL = __DEV__ ? LOCAL_API_URL : REMOTE_API_URL;

// Log at startup so you can verify in Expo terminal / device logs
console.log('[API] __DEV__=' + __DEV__ + '  API_BASE_URL=' + API_BASE_URL);


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
    if (__DEV__) {
      throw new Error(
        `Cannot reach the server at ${API_BASE_URL}.\n` +
        `Make sure:\n` +
        `  1. Spring Boot is running (./mvnw spring-boot:run)\n` +
        `  2. Your phone/emulator is on the same Wi-Fi network`
      );
    }
    throw new Error('Unable to connect to server. Please check your internet connection.');
  }

  if (response.status === 503 && attempt < MAX_RETRIES) {
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    return apiRequest(endpoint, options, attempt + 1);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let responseData: any = null;
  let serverMessage = '';

  if (text) {
    try {
      responseData = JSON.parse(text);
      if (responseData && (responseData.message || responseData.error)) {
        serverMessage = responseData.message || responseData.error;
      }
    } catch {
      // Non-JSON response
    }
  }

  if (!response.ok) {
    if (!serverMessage) {
      if (response.status === 401) {
        serverMessage = endpoint.includes('/auth/login')
          ? 'Invalid email or password.'
          : 'Your session has expired. Please sign in again.';
      } else if (response.status === 503) {
        serverMessage = 'Server or database is waking up. Please try again in a moment.';
      } else {
        serverMessage = text && text.length < 200 ? text : `Request failed with HTTP ${response.status}.`;
      }
    }

    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      await clearSession();
    }

    throw new Error(serverMessage);
  }

  if (method === 'GET' && responseData) {
    apiCache.set(endpoint, { data: responseData, timestamp: Date.now() });
  }

  return responseData;
}

