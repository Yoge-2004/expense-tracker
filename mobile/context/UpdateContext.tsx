/**
 * @file UpdateContext.tsx
 * @description Knows whether a newer version of the app has been published and manages
 * the update lifecycle, including non-aborting background downloading, resume capability,
 * and user-controlled "Install Now" or "Install Later (on app exit)" options.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import UpdatePrompt from '../components/UpdatePrompt';
import {
  AppReleaseInfo,
  CURRENT_APP_VERSION,
  checkForAppUpdate,
  loadCachedUpdate,
  saveCachedUpdate,
  withCurrentVersion,
  DownloadProgress,
  downloadUpdateApk,
  installDownloadedApk,
  checkExistingCompleteApk,
} from '../services/appUpdate';
import { registerAppUpdateTapListener } from '../services/notifications';

const RECHECK_AFTER_MS = 30 * 60 * 1000;

export interface UpdateContextValue {
  /** Details of the newer version, or null when the app is up to date (or nothing is known yet). */
  info: AppReleaseInfo | null;
  hasUpdate: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
  // Resilient background download & install lifecycle
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  downloadError: string | null;
  readyFileUri: string | null;
  startDownload: () => Promise<void>;
  installNow: () => Promise<void>;
  installLater: () => void;
  dismissError: () => void;
}

const UpdateContext = createContext<UpdateContextValue>({
  info: null,
  hasUpdate: false,
  openPrompt: () => undefined,
  closePrompt: () => undefined,
  isDownloading: false,
  downloadProgress: null,
  downloadError: null,
  readyFileUri: null,
  startDownload: async () => undefined,
  installNow: async () => undefined,
  installLater: () => undefined,
  dismissError: () => undefined,
});

export const useUpdate = (): UpdateContextValue => useContext(UpdateContext);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<AppReleaseInfo | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [readyFileUri, setReadyFileUri] = useState<string | null>(null);

  const launchPromptDone = useRef(false);
  const lastCheckAt = useRef(0);
  const inFlight = useRef<Promise<AppReleaseInfo | null> | null>(null);

  /** Asks GitHub, or the cache when offline. Concurrent callers share one request. */
  const check = useCallback((): Promise<AppReleaseInfo | null> => {
    if (inFlight.current) {
      return inFlight.current;
    }
    const run = (async (): Promise<AppReleaseInfo | null> => {
      const result = await checkForAppUpdate();
      lastCheckAt.current = Date.now();
      let known: AppReleaseInfo | null;
      if (result.checkFailed) {
        const cached = await loadCachedUpdate();
        known = cached ? withCurrentVersion(cached, CURRENT_APP_VERSION) : null;
      } else {
        await saveCachedUpdate(result);
        known = result;
      }
      const pending = known && known.hasUpdate ? known : null;
      setInfo(pending);

      // Check if existing file is already complete on device
      if (pending?.apkSize) {
        const existing = await checkExistingCompleteApk(pending.apkSize);
        if (existing) {
          setReadyFileUri(existing);
        }
      }
      return pending;
    })().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }, []);

  // On launch: show a known update straight away from the cache, then confirm with a fresh check.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadCachedUpdate();
      if (!cancelled && cached) {
        const rebased = withCurrentVersion(cached, CURRENT_APP_VERSION);
        if (rebased.hasUpdate) {
          setInfo(rebased);
          if (rebased.apkSize) {
            const existing = await checkExistingCompleteApk(rebased.apkSize);
            if (existing && !cancelled) setReadyFileUri(existing);
          }
        }
      }
      const known = await check();
      if (!cancelled && known && !launchPromptDone.current) {
        launchPromptDone.current = true;
        setPromptVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [check]);

  // Coming back to the app after a while: refresh the banner quietly.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheckAt.current > RECHECK_AFTER_MS) {
        void check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  // Tapping the push notification opens the popup.
  useEffect(() => {
    const unsubscribe = registerAppUpdateTapListener(() => {
      void check().then((known) => {
        if (known) {
          setPromptVisible(true);
        }
      });
    });
    return () => unsubscribe?.();
  }, [check]);

  const openPrompt = useCallback(() => setPromptVisible(true), []);
  const closePrompt = useCallback(() => setPromptVisible(false), []);

  const startDownload = useCallback(async (): Promise<void> => {
    if (!info?.apkDownloadUrl) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const localFile = await downloadUpdateApk(
        info.apkDownloadUrl,
        (progress) => setDownloadProgress(progress),
        info.apkSize
      );
      setReadyFileUri(localFile);
      setIsDownloading(false);
      // Prompt user with choices when download completes
      setPromptVisible(true);
    } catch (e: unknown) {
      setDownloadError(e instanceof Error ? e.message : 'The download did not finish.');
      setIsDownloading(false);
    }
  }, [info]);

  const installNow = useCallback(async (): Promise<void> => {
    if (!readyFileUri) return;
    try {
      await installDownloadedApk(readyFileUri, info?.apkSize);
    } catch (e: unknown) {
      setDownloadError(e instanceof Error ? e.message : 'Could not launch package installer.');
    }
  }, [readyFileUri, info]);

  const installLater = useCallback((): void => {
    setPromptVisible(false);
  }, []);

  const dismissError = useCallback((): void => {
    setDownloadError(null);
  }, []);

  const value = useMemo<UpdateContextValue>(
    () => ({
      info,
      hasUpdate: !!info,
      openPrompt,
      closePrompt,
      isDownloading,
      downloadProgress,
      downloadError,
      readyFileUri,
      startDownload,
      installNow,
      installLater,
      dismissError,
    }),
    [
      info,
      openPrompt,
      closePrompt,
      isDownloading,
      downloadProgress,
      downloadError,
      readyFileUri,
      startDownload,
      installNow,
      installLater,
      dismissError,
    ]
  );

  return (
    <UpdateContext.Provider value={value}>
      {children}
      <UpdatePrompt visible={promptVisible && !!info} info={info} onClose={closePrompt} />
    </UpdateContext.Provider>
  );
}
