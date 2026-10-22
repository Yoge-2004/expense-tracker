/**
 * @file appUpdate.ts
 * @description Service to query GitHub releases for mobile app updates and handle
 * in-app APK downloading with live progress tracking and native installation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform, Linking } from 'react-native';

export interface AppReleaseInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
  apkDownloadUrl?: string | null;
  apkSize?: number | null;
  apkName?: string | null;
  releaseNotes: string;
  publishedAt: string;
  /** True when GitHub could not be reached, so the other fields are placeholders and not a real answer. */
  checkFailed?: boolean;
}

/** The `route` the server puts on its "update available" push notification. */
export const APP_UPDATE_ROUTE = 'app-update';

const UPDATE_CACHE_KEY = '@expense_tracker/app_update_cache';
const FALLBACK_RELEASES_URL = 'https://github.com/Yoge-2004/expense-tracker/releases';

export interface DownloadProgress {
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
}

export const CURRENT_APP_VERSION = Constants.expoConfig?.version || '1.0.7';
export const DISPLAY_VERSION = `v${CURRENT_APP_VERSION}`;

/**
 * Strips 'v' prefix and compares two semantic version strings.
 * Returns true if candidate > current.
 */
export function isNewerVersion(current: string, candidate: string): boolean {
  const parse = (v: string) =>
    v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const [cMaj = 0, cMin = 0, cPatch = 0] = parse(current);
  const [tMaj = 0, tMin = 0, tPatch = 0] = parse(candidate);

  if (tMaj > cMaj) return true;
  if (tMaj < cMaj) return false;
  if (tMin > cMin) return true;
  if (tMin < cMin) return false;
  return tPatch > cPatch;
}

/** Turns a GitHub "latest release" response into update info, judged against the installed version. */
export function releaseInfoFromGitHub(data: any, currentVersion: string): AppReleaseInfo {
  const latestTag: string = typeof data?.tag_name === 'string' ? data.tag_name : '';
  const apkAsset = Array.isArray(data?.assets)
    ? data.assets.find((a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk'))
    : null;
  const unfinished = data?.draft === true || data?.prerelease === true;

  return {
    hasUpdate: !!latestTag && !unfinished && isNewerVersion(currentVersion, latestTag),
    currentVersion,
    latestVersion: latestTag || currentVersion,
    releaseName: data?.name || latestTag || 'Latest Release',
    releaseUrl: data?.html_url || FALLBACK_RELEASES_URL,
    apkDownloadUrl: apkAsset?.browser_download_url || null,
    apkSize: apkAsset?.size || null,
    apkName: apkAsset?.name || 'expense-tracker.apk',
    releaseNotes: (data?.body || '').trim(),
    publishedAt: data?.published_at || '',
  };
}

/** Re-judges stored update info against the installed version, e.g. after the app itself was updated. */
export function withCurrentVersion(info: AppReleaseInfo, currentVersion: string): AppReleaseInfo {
  return {
    ...info,
    currentVersion,
    hasUpdate: !info.checkFailed && !!info.latestVersion && isNewerVersion(currentVersion, info.latestVersion),
  };
}

export async function checkForAppUpdate(): Promise<AppReleaseInfo> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/Yoge-2004/expense-tracker/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ExpenseTrackerMobileApp',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub releases returned HTTP ${response.status}`);
    }

    return releaseInfoFromGitHub(await response.json(), CURRENT_APP_VERSION);
  } catch (error) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      releaseName: 'Latest Release',
      releaseUrl: FALLBACK_RELEASES_URL,
      apkDownloadUrl: null,
      apkSize: null,
      apkName: null,
      releaseNotes: '',
      publishedAt: '',
      checkFailed: true,
    };
  }
}

/** The last successful check, so a known update still shows when the phone is offline. */
export async function loadCachedUpdate(): Promise<AppReleaseInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(UPDATE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.latestVersion === 'string' ? (parsed as AppReleaseInfo) : null;
  } catch {
    return null;
  }
}

export async function saveCachedUpdate(info: AppReleaseInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify(info));
  } catch {
    // The cache only helps offline starts; a failed write is harmless.
  }
}

/** A few readable lines of release notes for the popup: headings, bullets and links reduced to plain text. */
export function summariseReleaseNotes(notes: string, maxLines = 6): string {
  return (notes || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s*/, '')
        .replace(/^\s*[-*+]\s+/, '\u2022 ')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_`]/g, '')
        .trim()
    )
    .filter((line) => line.length > 0)
    .slice(0, maxLines)
    .join('\n');
}

/**
 * Downloads the APK directly inside the app with a real-time progress callback,
 * and launches Android's package installer to apply the update.
 */
export async function downloadAndInstallApk(
  downloadUrl: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<string> {
  const targetDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  const localFileUri = `${targetDir}expense-tracker-update.apk`;

  try {
    const fileInfo = await FileSystem.getInfoAsync(localFileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localFileUri, { idempotent: true });
    }
  } catch {
    // Non-blocking cleanup
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    downloadUrl,
    localFileUri,
    {},
    (downloadProgress) => {
      const total = downloadProgress.totalBytesExpectedToWrite;
      const written = downloadProgress.totalBytesWritten;
      const percent = total > 0 ? Math.round((written / total) * 100) : 0;
      onProgress?.({
        totalBytes: total,
        downloadedBytes: written,
        percent,
      });
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || result.status !== 200) {
    throw new Error(`Failed to download APK. Server returned HTTP ${result?.status || 500}`);
  }

  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(localFileUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
  } else {
    await Linking.openURL(downloadUrl);
  }

  return localFileUri;
}
