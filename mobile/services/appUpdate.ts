/**
 * @file appUpdate.ts
 * @description Service to query GitHub releases for mobile app updates and handle
 * in-app APK downloading with live progress tracking and native installation.
 */

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
}

export interface DownloadProgress {
  totalBytes: number;
  downloadedBytes: number;
  percent: number;
}

export const CURRENT_APP_VERSION = Constants.expoConfig?.version || '1.0.3';
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

export async function checkForAppUpdate(): Promise<AppReleaseInfo> {
  const fallbackUrl = 'https://github.com/Yoge-2004/expense-tracker/releases';
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

    const data = await response.json();
    const latestTag = data.tag_name || 'v1.0.3';
    const releaseName = data.name || latestTag;
    const releaseUrl = data.html_url || fallbackUrl;
    const releaseNotes = (data.body || '').trim();
    const publishedAt = data.published_at || '';

    const apkAsset = Array.isArray(data.assets)
      ? data.assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk'))
      : null;
    const apkDownloadUrl = apkAsset?.browser_download_url || null;
    const apkSize = apkAsset?.size || null;
    const apkName = apkAsset?.name || 'expense-tracker.apk';

    const hasUpdate = isNewerVersion(CURRENT_APP_VERSION, latestTag);

    return {
      hasUpdate,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: latestTag,
      releaseName,
      releaseUrl,
      apkDownloadUrl,
      apkSize,
      apkName,
      releaseNotes,
      publishedAt,
    };
  } catch (error) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      releaseName: 'Latest Release',
      releaseUrl: fallbackUrl,
      apkDownloadUrl: null,
      apkSize: null,
      apkName: null,
      releaseNotes: '',
      publishedAt: '',
    };
  }
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
