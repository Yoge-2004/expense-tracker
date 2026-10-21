jest.mock('expo-file-system/legacy', () => ({}));
jest.mock('expo-intent-launcher', () => ({}));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.4' } } }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    },
  };
});

import {
  APP_UPDATE_ROUTE,
  isNewerVersion,
  loadCachedUpdate,
  releaseInfoFromGitHub,
  saveCachedUpdate,
  summariseReleaseNotes,
  withCurrentVersion,
} from '../services/appUpdate';

const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'v1.0.5',
  name: 'Expense Tracker 1.0.5',
  html_url: 'https://github.com/Yoge-2004/expense-tracker/releases/tag/v1.0.5',
  body: '## What is new\n- Faster ledger\n- Update notices',
  published_at: '2026-10-21T10:00:00Z',
  assets: [
    { name: 'notes.txt', browser_download_url: 'https://example.test/notes.txt', size: 10 },
    { name: 'expense-tracker-1.0.5.apk', browser_download_url: 'https://example.test/app.apk', size: 52_428_800 },
  ],
  ...over,
});

describe('isNewerVersion', () => {
  it('compares numbers, not text', () => {
    expect(isNewerVersion('1.0.4', 'v1.0.5')).toBe(true);
    expect(isNewerVersion('1.9.9', 'v1.10.0')).toBe(true);
    expect(isNewerVersion('1.0.5', 'v1.0.5')).toBe(false);
    expect(isNewerVersion('1.0.5', 'v1.0.4')).toBe(false);
  });
});

describe('releaseInfoFromGitHub', () => {
  it('reports an update with the APK to install when the release is newer', () => {
    const info = releaseInfoFromGitHub(release(), '1.0.4');
    expect(info.hasUpdate).toBe(true);
    expect(info.latestVersion).toBe('v1.0.5');
    expect(info.apkDownloadUrl).toBe('https://example.test/app.apk');
    expect(info.apkSize).toBe(52_428_800);
  });

  it('reports no update when the installed version is current or newer', () => {
    expect(releaseInfoFromGitHub(release(), '1.0.5').hasUpdate).toBe(false);
    expect(releaseInfoFromGitHub(release(), '1.1.0').hasUpdate).toBe(false);
  });

  it('never offers a draft or pre-release', () => {
    expect(releaseInfoFromGitHub(release({ draft: true }), '1.0.4').hasUpdate).toBe(false);
    expect(releaseInfoFromGitHub(release({ prerelease: true }), '1.0.4').hasUpdate).toBe(false);
  });

  it('copes with a release that has no APK or no tag', () => {
    expect(releaseInfoFromGitHub(release({ assets: [] }), '1.0.4').apkDownloadUrl).toBeNull();
    expect(releaseInfoFromGitHub({}, '1.0.4').hasUpdate).toBe(false);
    expect(releaseInfoFromGitHub(null, '1.0.4').hasUpdate).toBe(false);
  });
});

describe('withCurrentVersion', () => {
  it('stops reporting an update once the app has been updated to that version', () => {
    const info = releaseInfoFromGitHub(release(), '1.0.4');
    expect(withCurrentVersion(info, '1.0.4').hasUpdate).toBe(true);
    expect(withCurrentVersion(info, '1.0.5').hasUpdate).toBe(false);
  });

  it('never reports an update from a failed check', () => {
    const failed = { ...releaseInfoFromGitHub(release(), '1.0.4'), checkFailed: true };
    expect(withCurrentVersion(failed, '1.0.4').hasUpdate).toBe(false);
  });
});

describe('update cache', () => {
  it('returns what was saved, so a known update still shows offline', async () => {
    expect(await loadCachedUpdate()).toBeNull();
    const info = releaseInfoFromGitHub(release(), '1.0.4');
    await saveCachedUpdate(info);
    expect(await loadCachedUpdate()).toEqual(info);
  });
});

describe('summariseReleaseNotes', () => {
  it('turns markdown into a few plain lines', () => {
    expect(summariseReleaseNotes('## What is new\n- Faster ledger\n* [Update notices](https://x.test)\n\n**Bold** `code`'))
      .toBe('What is new\n\u2022 Faster ledger\n\u2022 Update notices\nBold code');
  });

  it('keeps only the first lines and tolerates empty notes', () => {
    const many = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
    expect(summariseReleaseNotes(many, 3)).toBe('line 1\nline 2\nline 3');
    expect(summariseReleaseNotes('')).toBe('');
  });
});

describe('push route', () => {
  it('matches the route the server sends', () => {
    expect(APP_UPDATE_ROUTE).toBe('app-update');
  });
});
