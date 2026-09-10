/**
 * @jest-environment node
 *
 * Unit tests for the API service.
 * Tests the ApiError class, error categorization, and utility functions.
 */

import { ApiError, type ApiErrorCode } from '../services/api';

describe('API Service', () => {

  describe('ApiError', () => {
    test('creates an ApiError with required fields', () => {
      const error = new ApiError({
        message: 'Test error',
        status: 400,
        code: 'VALIDATION_ERROR',
        endpoint: '/api/test',
        method: 'POST',
      });

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.endpoint).toBe('/api/test');
      expect(error.method).toBe('POST');
    });

    test('has correct name', () => {
      const error = new ApiError({ message: 'Test' });
      expect(error.name).toBe('ApiError');
    });

    test('is an instance of Error', () => {
      const error = new ApiError({ message: 'Test' });
      expect(error).toBeInstanceOf(Error);
    });

    test('defaults status to 0 when not provided', () => {
      const error = new ApiError({ message: 'Test' });
      expect(error.status).toBe(0);
    });

    test('defaults code to UNKNOWN when not provided', () => {
      const error = new ApiError({ message: 'Test' });
      expect(error.code).toBe('UNKNOWN');
    });

    test('defaults endpoint to empty string', () => {
      const error = new ApiError({ message: 'Test' });
      expect(error.endpoint).toBe('');
    });

    test('defaults method to GET', () => {
      const error = new ApiError({ message: 'Test' });
      expect(error.method).toBe('GET');
    });

    test('isTimeout is true when code is TIMEOUT', () => {
      const error = new ApiError({ message: 'Timeout', code: 'TIMEOUT' });
      expect(error.isTimeout).toBe(true);
    });

    test('isTimeout is false for non-TIMEOUT codes', () => {
      const error = new ApiError({ message: 'Error', code: 'SERVER_ERROR' });
      expect(error.isTimeout).toBe(false);
    });

    test('isNetworkError is true when code is NETWORK_OFFLINE', () => {
      const error = new ApiError({ message: 'Offline', code: 'NETWORK_OFFLINE' });
      expect(error.isNetworkError).toBe(true);
    });

    test('isNetworkError is false for non-network codes', () => {
      const error = new ApiError({ message: 'Error', code: 'SERVER_ERROR' });
      expect(error.isNetworkError).toBe(false);
    });

    test('isUnauthorized is true when status is 401', () => {
      const error = new ApiError({ message: 'Unauthorized', status: 401 });
      expect(error.isUnauthorized).toBe(true);
    });

    test('isUnauthorized is false for non-401 status', () => {
      const error = new ApiError({ message: 'Forbidden', status: 403 });
      expect(error.isUnauthorized).toBe(false);
    });

    test('preserves validationErrors', () => {
      const validationErrors = { email: 'Invalid email', password: 'Too short' };
      const error = new ApiError({
        message: 'Validation failed',
        validationErrors,
      });
      expect(error.validationErrors).toEqual(validationErrors);
    });

    test('preserves rawPayload', () => {
      const rawPayload = { custom: 'data', nested: { value: 42 } };
      const error = new ApiError({
        message: 'Server error',
        rawPayload,
      });
      expect(error.rawPayload).toEqual(rawPayload);
    });
  });

  describe('ApiErrorCode type', () => {
    test('supports all error codes', () => {
      const codes: ApiErrorCode[] = [
        'TIMEOUT',
        'NETWORK_OFFLINE',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'VALIDATION_ERROR',
        'SERVER_ERROR',
        'DATABASE_WARMUP',
        'UNKNOWN',
      ];

      for (const code of codes) {
        const error = new ApiError({ message: 'Test', code });
        expect(error.code).toBe(code);
      }
    });
  });
});
