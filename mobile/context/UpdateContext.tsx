/**
 * @file UpdateContext.tsx
 * @description Knows whether a newer version of the app has been published and decides when to tell the user.
 *
 * - On launch it checks GitHub Releases (falling back to the last known answer when offline) and, if an update
 *   exists, opens the update popup once for that launch.
 * - While an update exists the banner at the top of the app stays visible; tapping it reopens the popup.
 * - It re-checks quietly when the app returns to the foreground after a while, and opens the popup when the
 *   user taps the server's "update available" push notification.
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
} from '../services/appUpdate';
import { registerAppUpdateTapListener } from '../services/notifications';

const RECHECK_AFTER_MS = 30 * 60 * 1000;

interface UpdateContextValue {
  /** Details of the newer version, or null when the app is up to date (or nothing is known yet). */
  info: AppReleaseInfo | null;
  hasUpdate: boolean;
  openPrompt: () => void;
  closePrompt: () => void;
}

const UpdateContext = createContext<UpdateContextValue>({
  info: null,
  hasUpdate: false,
  openPrompt: () => undefined,
  closePrompt: () => undefined,
});

export const useUpdate = (): UpdateContextValue => useContext(UpdateContext);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [info, setInfo] = useState<AppReleaseInfo | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
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

  const value = useMemo<UpdateContextValue>(
    () => ({ info, hasUpdate: !!info, openPrompt, closePrompt }),
    [info, openPrompt, closePrompt]
  );

  return (
    <UpdateContext.Provider value={value}>
      {children}
      <UpdatePrompt visible={promptVisible && !!info} info={info} onClose={closePrompt} />
    </UpdateContext.Provider>
  );
}
