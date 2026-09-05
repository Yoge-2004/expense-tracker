/**
 * @file api.ts
 * @description Central networking, session management, and resilience architecture for ExpenseTracker.
 * Features:
 * - Enterprise ApiError typed exception model with status codes, error categorization, and validation breakdown.
 * - Hardware-backed SecureStore with automatic AsyncStorage fallback for resilience.
 * - In-memory GET query cache with dynamic mutation invalidation.
 * - Automated cold-start database recovery retries with exponential backoff.
 * - AbortController 15-second request timeouts.
 * - Automated session teardown and token purge on HTTP 401 Unauthorized.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ────────────────── API Configuration ──────────────────
const REMOTE_API_URL = 'https://yoge-2004-expense-tracker-backend.hf.space/api';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || REMOTE_API_URL;

// Storage Keys
const TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';
const NAME_KEY = 'user_name';

// Resilience & Network Constants
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000; // 15s timeout
const CACHE_TTL_MS = 15000; // 15s cache TTL

/**
 * Standardized API error categorization codes.
 */
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

/**
 * Custom typed exception class representing API, Network, or Server errors.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly endpoint: string;
  public readonly method: string;
  public readonly validationErrors?: Record<string, string>;
  public readonly isTimeout: boolean;
  public readonly isNetworkError: boolean;
  public readonly isUnauthorized: boolean;
  public readonly rawPayload?: any;

  constructor(params: {
    message: string;
    status?: number;
    code?: ApiErrorCode;
    endpoint?: string;
    method?: string;
    validationErrors?: Record<string, string>;
    rawPayload?: any;
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

    // Maintain standard prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * In-memory response cache for idempotent GET queries.
 */
const apiCache = new Map<string, { data: any; timestamp: number }>();

/**
 * Persists an item safely to SecureStore, falling back to AsyncStorage if hardware keystore fails.
 */
async function safeStorageSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (secureError) {
    console.warn(`[API] SecureStore setItem failed for ${key}, falling back to AsyncStorage:`, secureError);
    try {
      await AsyncStorage.setItem(`fallback_${key}`, value);
    } catch (asyncError) {
      console.error(`[API] Critical: Both SecureStore and AsyncStorage failed for ${key}:`, asyncError);
    }
  }
}

/**
 * Reads an item safely from SecureStore or AsyncStorage fallback.
 */
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

/**
 * Removes an item from both SecureStore and AsyncStorage fallback.
 */
async function safeStorageDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    // Ignore non-critical deletion errors
  }
  try {
    await AsyncStorage.removeItem(`fallback_${key}`);
  } catch (e) {
    // Ignore non-critical deletion errors
  }
}

/**
 * Persists the authenticated user session.
 *
 * @param token - Signed JWT bearer token.
 * @param userId - Unique user integer ID string.
 * @param name - Display name of the user.
 * @throws {ApiError} If persistence fails completely.
 */
export async function saveSession(token: string, userId: string, name: string): Promise<void> {
  try {
    apiCache.clear();
    await safeStorageSet(TOKEN_KEY, token);
    await safeStorageSet(USER_ID_KEY, userId);
    await safeStorageSet(NAME_KEY, name || 'Tracker');
  } catch (error: any) {
    console.error('[API] Failed to persist secure session:', error);
    throw new ApiError({
      message: 'Could not securely save authentication credentials.',
      code: 'UNKNOWN',
    });
  }
}

/**
 * Clears all cached tokens and session state.
 */
export async function clearSession(): Promise<void> {
  apiCache.clear();
  await safeStorageDelete(TOKEN_KEY);
  await safeStorageDelete(USER_ID_KEY);
  await safeStorageDelete(NAME_KEY);
}

/**
 * Retrieves the currently active user session.
 */
export async function getSession(): Promise<{
  token: string | null;
  userId: string | null;
  name: string | null;
}> {
  const token = await safeStorageGet(TOKEN_KEY);
  const userId = await safeStorageGet(USER_ID_KEY);
  const name = await safeStorageGet(NAME_KEY);
  return { token, userId, name };
}

/**
 * Clears in-memory GET query cache.
 */
export function invalidateApiCache(): void {
  apiCache.clear();
}

/**
 * Extracts and formats user-friendly error messages and validation fields from backend error payloads.
 */
function extractErrorDetails(
  text: string,
  status: number
): { message: string; code: ApiErrorCode; validationErrors?: Record<string, string>; payload?: any } {
  let message = '';
  let code: ApiErrorCode = 'UNKNOWN';
  let validationErrors: Record<string, string> | undefined;
  let parsedJson: any = null;

  if (text) {
    try {
      parsedJson = JSON.parse(text);
      if (parsedJson) {
        if (parsedJson.message) message = parsedJson.message;
        else if (parsedJson.error) message = parsedJson.error;

        // Parse nested Spring Boot field validation errors
        if (Array.isArray(parsedJson.errors)) {
          validationErrors = {};
          parsedJson.errors.forEach((err: any) => {
            if (err.field && err.defaultMessage) {
              validationErrors![err.field] = err.defaultMessage;
            }
          });
          const fieldMsgs = Object.values(validationErrors).join(', ');
          if (fieldMsgs) {
            message = message ? `${message}: ${fieldMsgs}` : fieldMsgs;
          }
        } else if (typeof parsedJson.errors === 'object' && parsedJson.errors !== null) {
          validationErrors = parsedJson.errors;
        }
      }
    } catch {
      // Non-JSON response text
      if (text.length > 0 && text.length < 250 && !text.includes('<!DOCTYPE') && !text.includes('<html>')) {
        message = text;
      }
    }
  }

  // Categorize code based on HTTP status
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

  return { message: message || `Server returned error (${status}).`, code, validationErrors, payload: parsedJson };
}

/**
 * Dispatches an HTTP request with built-in timeout, retry, caching, and ApiError handling.
 *
 * @param endpoint - Relative endpoint path (e.g. `/expenses/user/1`).
 * @param options - Standard fetch RequestInit configuration.
 * @param attempt - Internal retry counter.
 * @returns Parsed JSON or null for 204 No Content.
 * @throws {ApiError}
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  attempt = 0
): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();

  // Cache handling
  if (method !== 'GET') {
    apiCache.clear();
  } else {
    const cached = apiCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Retrieve token
  const session = await getSession();
  const token = session.token;

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...options.headers,
  });

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // AbortController setup
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (networkError: any) {
    clearTimeout(timeoutId);

    // Timeout
    if (networkError.name === 'AbortError') {
      throw new ApiError({
        message: 'The network request timed out after 15 seconds. Please check your connection.',
        status: 0,
        code: 'TIMEOUT',
        endpoint,
        method,
      });
    }

    // Network reachability / Offline
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
  }

  // Retry logic for DB Cold-Start (503)
  if (response.status === 503 && attempt < MAX_RETRIES) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    return apiRequest(endpoint, options, attempt + 1);
  }

  // HTTP 204 No Content
  if (response.status === 204) {
    return null;
  }

  const text = await response.text();

  if (!response.ok) {
    const { message, code, validationErrors, payload } = extractErrorDetails(text, response.status);

    // Auto purge session on unauthenticated 401 (unless logging in or re-authenticating/deleting account)
    const isDeleteAccount = method === "DELETE" && endpoint.includes("/users/");
    const isLoginOrVerify = endpoint.includes("/auth/login") || endpoint.includes("/verify-security-pin");
    const shouldSkipPurge = (options as any)?.skipAuthRedirect || isDeleteAccount || isLoginOrVerify;
    if (response.status === 401 && !shouldSkipPurge) {
      await clearSession();
    }

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

  if (method === 'GET' && responseData) {
    apiCache.set(endpoint, { data: responseData, timestamp: Date.now() });
  }

  return responseData;
}
