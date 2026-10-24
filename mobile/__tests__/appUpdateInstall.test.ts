import { Platform } from 'react-native';

const mockStartActivity = jest.fn();
const mockGetInfo = jest.fn();
const mockContentUri = jest.fn();
const mockCreateDownload = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///docs/',
  getInfoAsync: (...args: unknown[]) => mockGetInfo(...args),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  getContentUriAsync: (...args: unknown[]) => mockContentUri(...args),
  createDownloadResumable: (...args: unknown[]) => mockCreateDownload(...args),
}));
jest.mock('expo-intent-launcher', () => ({
  startActivityAsync: (...args: unknown[]) => mockStartActivity(...args),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.4', android: { package: 'com.example.expensetracker' } } },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

import { downloadAndInstallApk, openInstallPermissionSettings } from '../services/appUpdate';

const APK_BYTES = 52_000_000;

function downloadReturns(status: number) {
  mockCreateDownload.mockReturnValue({ downloadAsync: jest.fn().mockResolvedValue({ status }) });
}

describe('in-app APK install', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'android';
    mockStartActivity.mockResolvedValue({ resultCode: 0 });
    mockContentUri.mockResolvedValue('content://provider/expense-tracker-update.apk');
    downloadReturns(200);
  });

  it('opens the package installer for the downloaded file', async () => {
    mockGetInfo
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: APK_BYTES });

    const file = await downloadAndInstallApk('https://x.test/app.apk', undefined, APK_BYTES);

    expect(file).toBe('file:///cache/expense-tracker-update.apk');
    expect(mockStartActivity).toHaveBeenCalledWith('android.intent.action.VIEW', {
      data: 'content://provider/expense-tracker-update.apk',
      flags: 1,
      type: 'application/vnd.android.package-archive',
    });
  });

  it('does not open the installer for a file that is not a complete APK', async () => {
    mockGetInfo
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: 4_000 });

    await expect(downloadAndInstallApk('https://x.test/app.apk', undefined, APK_BYTES)).rejects.toThrow(/incomplete/i);
    expect(mockStartActivity).not.toHaveBeenCalled();
  });

  it('rejects a download whose size differs from the release asset', async () => {
    mockGetInfo
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: true, size: APK_BYTES - 10 });

    await expect(downloadAndInstallApk('https://x.test/app.apk', undefined, APK_BYTES)).rejects.toThrow(/did not finish/i);
    expect(mockStartActivity).not.toHaveBeenCalled();
  });

  it('reports a failed HTTP download', async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    downloadReturns(404);

    await expect(downloadAndInstallApk('https://x.test/app.apk')).rejects.toThrow(/HTTP 404/);
  });

  it('opens the "install unknown apps" settings for this app', async () => {
    await openInstallPermissionSettings();

    expect(mockStartActivity).toHaveBeenCalledWith('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: 'package:com.example.expensetracker',
    });
  });
});
