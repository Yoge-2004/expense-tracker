import * as SecureStore from 'expo-secure-store';
import {
  savedPinEmail,
  savePinForFingerprint,
  readPinWithFingerprint,
  clearSavedPin,
} from '../utils/pinVault';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) || null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

describe('pinVault', () => {
  beforeEach(async () => {
    await clearSavedPin();
    jest.clearAllMocks();
  });

  it('saves PIN and associated email securely', async () => {
    const success = await savePinForFingerprint('User@Test.COM', '123456');
    expect(success).toBe(true);

    const email = await savedPinEmail();
    expect(email).toBe('user@test.com'); // Lower-cased and trimmed

    const pin = await readPinWithFingerprint();
    expect(pin).toBe('123456');
  });

  it('returns null when no PIN has been saved', async () => {
    const email = await savedPinEmail();
    expect(email).toBeNull();

    const pin = await readPinWithFingerprint();
    expect(pin).toBeNull();
  });

  it('clears saved PIN and email completely', async () => {
    await savePinForFingerprint('test@example.com', '654321');
    expect(await savedPinEmail()).toBe('test@example.com');

    await clearSavedPin();
    expect(await savedPinEmail()).toBeNull();
    expect(await readPinWithFingerprint()).toBeNull();
  });
});
