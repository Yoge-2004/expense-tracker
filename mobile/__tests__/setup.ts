// Global test setup for mobile tests

// Mock AsyncStorage using its official Jest mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

// Suppress console.warn from mocked modules during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress known noisy warnings from expo modules during testing
  if (typeof args[0] === 'string' && args[0].includes('[Currency]')) return;
  if (typeof args[0] === 'string' && args[0].includes('[AuthContext]')) return;
  originalWarn(...args);
};
