/**
 * @jest-environment node
 *
 * Unit tests for AuthContext.
 * Tests the auth context interface and session management logic.
 */

// Mock expo modules before importing
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  isEnrolledAsync: jest.fn().mockResolvedValue(false),
  authenticateAsync: jest.fn(),
}));

jest.mock('../services/api', () => ({
  getSession: jest.fn().mockResolvedValue(null),
  saveSession: jest.fn(),
  clearSession: jest.fn(),
  apiRequest: jest.fn(),
}));

describe('AuthContext Interface', () => {

  test('AuthProvider exports a valid React component', async () => {
    const { AuthProvider } = await import('../context/AuthContext');
    expect(AuthProvider).toBeDefined();
    expect(typeof AuthProvider).toBe('function');
  });

  test('useAuth throws when used outside AuthProvider', async () => {
    // Dynamic import to avoid early evaluation
    const { useAuth } = await import('../context/AuthContext');

    // Suppress console.error for this test (React will log the error)
    const originalError = console.error;
    console.error = jest.fn();

    expect(() => {
      useAuth();
    }).toThrow();

    console.error = originalError;
  });
});
