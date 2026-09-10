// Global test setup for mobile tests
// Suppress console.warn from mocked modules during tests
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress known noisy warnings from expo modules during testing
  if (typeof args[0] === 'string' && args[0].includes('[Currency]')) return;
  if (typeof args[0] === 'string' && args[0].includes('[AuthContext]')) return;
  originalWarn(...args);
};
