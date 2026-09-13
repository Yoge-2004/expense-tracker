/**
 * @file api.ts
 * @description Central networking, session management, and resilience architecture for ExpenseTracker.
 * Features:
 * - Enterprise ApiError typed exception model with status codes, error categorization, and validation breakdown.
 * - Hardware-backed SecureStore with automatic AsyncStorage fallback for resilience.
 * - In-memory GET query cache with dynamic mutation invalidation.
 * - Automated cold-start database recovery retries with exponential backoff.
 * - AbortController request timeouts and caller cancellation support.
 * - Automated session teardown and token purge on HTTP 401 Unauthorized.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REMOTE_API_URL = 'https://yoge-2004-expense-tracker-backend.hf.space/api';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || REMOTE_API_URL;

const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';
const NAME_KEY = 'user_name';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 15000;

/** Optional application-specific request flags layered on top of RequestInit. */
export type ApiRequestOptions = RequestInit & {
  skipAuthRedirect?: boolean;
};

export type ApiErrorCode =
  | 'TIMEOUT'
  | 'NETWORK_OFFLINE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'DATABASE_WARMUP'
  | 'UNKNOWN';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly endpoint: string;
  public readonly method: string;
  public readonly validationErrors?: Record<string, string>;
  public readonly isTimeout: boolean;
  public readonly isNetworkError: boolean;
  public readonly isUnauthorized: boolean;
  public readonly rawPayload?: unknown;

  constructor(params: {
    message: string;
    status?: number;
    code?: ApiErrorCode;
    endpoint?: string;
    method?: string;
    validationErrors?: Record<string, string>;
    rawPayload?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status ?? 0;
    this.code = params.code ?? 'UNKNOWN';
    this.endpoint = params.endpoint ?? '';
    this.method = params.method ?? 'GET';
    this.validationErrors = params.validationErrors;
    this.rawPayload = params.rawPayload;
    this.isTimeout = params.code === 'TIMEOUT';
    this.isNetworkError = params.code === 'NETWORK_OFFLINE';
    this.isUnauthorized = params.status === 401;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const apiCache = new Map<string, { data: any; timestamp: number }>();

async function safeStorageSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
    return;
  } catch (secureError) {
    console.warn(`[API] SecureStore setItem failed for ${key}, falling back to AsyncStorage:`, secureError);
  }

  try {
    await AsyncStorage.setItem(`fallback_${key}`, value);
  } catch (asyncError) {
    console.error(`[API] Critical: Both SecureStore and AsyncStorage failed for ${key}:`, asyncError);
    throw asyncError;
  }
}

async function safeStorageGet(key: string): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val !== null) return val;
  } catch (secureError) {
    console.warn(`[API] SecureStore getItem failed for ${key}:`, secureError);
  }

  try {
    return await AsyncStorage.getItem(`fallback_${key}`);
  } catch (asyncError) {
    console.warn(`[API] AsyncStorage fallback getItem failed for ${key}:`, asyncError);
    return null;
  }
}

async function safeStorageDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Best-effort cleanup.
  }
  try {
    await AsyncStorage.removeItem(`fallback_${key}`);
  } catch {
    // Best-effort cleanup.
  }
}

export async function saveSession(token: string, userId: string, name: string): Promise<void> {
  try {
    apiCache.clear();
    await safeStorageSet(TOKEN_KEY, token);
    await safeStorageSet(USER_ID_KEY, userId);
    await safeStorageSet(NAME_KEY, name || 'Tracker');
  } catch (error) {
    console.error('[API] Failed to persist secure session:', error);
    throw new ApiError({
      message: 'Could not securely save authentication credentials.',
      code: 'UNKNOWN',
    });
  }
}

export async function clearSession(): Promise<void> {
  apiCache.clear();
  await Promise.all([safeStorageDelete(TOKEN_KEY), safeStorageDelete(USER_ID_KEY), safeStorageDelete(NAME_KEY)]);
}

export async function getSession(): Promise<{
  token: string | null;
  userId: string | null;
  name: string | null;
}> {
  const [token, userId, name] = await Promise.all([
    safeStorageGet(TOKEN_KEY),
    safeStorageGet(USER_ID_KEY),
    safeStorageGet(NAME_KEY),
  ]);
  return { token, userId, name };
}

export function invalidateApiCache(): void {
  apiCache.clear();
}

function extractErrorDetails(
  text: string,
  status: number
): { message: string; code: ApiErrorCode; validationErrors?: Record<string, string>; payload?: unknown } {
  let message = '';
  let code: ApiErrorCode = 'UNKNOWN';
  let validationErrors: Record<string, string> | undefined;
  let parsedJson: unknown = null;

  if (text) {
    try {
      parsedJson = JSON.parse(text) as unknown;
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        const payload = parsedJson as Record<string, unknown>;
        if (typeof payload.message === 'string') message = payload.message;
        else if (typeof payload.error === 'string') message = payload.error;

        if (Array.isArray(payload.errors)) {
          validationErrors = {};
          for (const err of payload.errors) {
            if (typeof err !== 'object' || err === null) continue;
            const item = err as Record<string, unknown>;
            if (typeof item.field === 'string' && typeof item.defaultMessage === 'string') {
              validationErrors[item.field] = item.defaultMessage;
            }
          }
          const fieldMsgs = Object.values(validationErrors).join(', ');
          if (fieldMsgs) message = message ? `${message}: ${fieldMsgs}` : fieldMsgs;
        } else if (typeof payload.errors === 'object' && payload.errors !== null) {
          const fieldErrors = payload.errors as Record<string, unknown>;
          const stringErrors: Record<string, string> = {};
          for (const [field, value] of Object.entries(fieldErrors)) {
            if (typeof value === 'string') stringErrors[field] = value;
          }
          if (Object.keys(stringErrors).length > 0) validationErrors = stringErrors;
        }
      }
    } catch {
      if (text.length > 0 && text.length < 250 && !text.includes('<!DOCTYPE') && !text.includes('<html>')) {
        message = text;
      }
    }
  }

  if (status === 400) {
    code = validationErrors ? 'VALIDATION_ERROR' : 'UNKNOWN';
    if (!message) message = 'Invalid request payload or parameters.';
  } else if (status === 401) {
    code = 'UNAUTHORIZED';
    if (!message) message = 'Session has expired or authentication is invalid.';
  } else if (status === 403) {
    code = 'FORBIDDEN';
    if (!message) message = 'Access denied. You do not have permission for this resource.';
  } else if (status === 404) {
    code = 'NOT_FOUND';
    if (!message) message = 'The requested resource was not found.';
  } else if (status === 503) {
    code = 'DATABASE_WARMUP';
    if (!message) message = 'Database service is warming up. Please retry in a moment.';
  } else if (status >= 500) {
    code = 'SERVER_ERROR';
    if (!message) message = 'Internal server error occurred. Please try again later.';
  }

  return {
    message: message || `Server returned error (${status}).`,
    code,
    validationErrors,
    payload: parsedJson,
  };
}

export async function apiRequest(
  endpoint: string,
  options: ApiRequestOptions = {},
  attempt = 0
): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    apiCache.clear();
  } else {
    const cached = apiCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const session = await getSession();
  const token = session.token;

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...options.headers,
  });

  if (token) headers.set('Authorization', `Bearer ${token}`);

  const controller = new AbortController();
  const externalSignal = options.signal;
  const handleExternalAbort = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers,
    });
  } catch (networkError: unknown) {
    const errorName = networkError instanceof Error ? networkError.name : '';
    const wasCallerCancelled = externalSignal?.aborted === true;

    if (errorName === 'AbortError') {
      throw new ApiError({
        message: wasCallerCancelled ? 'The network request was cancelled.' : 'The network request timed out after 15 seconds. Please check your connection.',
        status: 0,
        code: wasCallerCancelled ? 'UNKNOWN' : 'TIMEOUT',
        endpoint,
        method,
      });
    }

    const devMessage = __DEV__
      ? `Cannot reach backend at ${API_BASE_URL}. Ensure server is running.`
      : 'Unable to connect to server. Please check your internet connection.';

    throw new ApiError({
      message: devMessage,
      status: 0,
      code: 'NETWORK_OFFLINE',
      endpoint,
      method,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', handleExternalAbort);
  }

  // Only retry idempotent reads after a 503. Never replay a write automatically.
  const retryableMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  if (response.status === 503 && retryableMethod && attempt < MAX_RETRIES) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    return apiRequest(endpoint, options, attempt + 1);
  }

  if (response.status === 204) return null;

  const text = await response.text();

  if (!response.ok) {
    const { message, code, validationErrors, payload } = extractErrorDetails(text, response.status);
    const isDeleteAccount = method === 'DELETE' && endpoint.includes('/users/');
    const isLoginOrVerify = endpoint.includes('/auth/login') || endpoint.includes('/verify-security-pin');
    const shouldSkipPurge = options.skipAuthRedirect || isDeleteAccount || isLoginOrVerify;

    if (response.status === 401 && !shouldSkipPurge) await clearSession();

    throw new ApiError({
      message,
      status: response.status,
      code,
      endpoint,
      method,
      validationErrors,
      rawPayload: payload,
    });
  }

  let responseData: any = null;
  if (text) {
    try {
      responseData = JSON.parse(text);
    } catch {
      responseData = text;
    }
  }

  if (method === 'GET' && responseData !== null) {
    apiCache.set(endpoint, { data: responseData, timestamp: Date.now() });
  }

  return responseData;
}
