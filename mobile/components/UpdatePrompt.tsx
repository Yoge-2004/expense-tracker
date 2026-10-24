/**
 * @file UpdatePrompt.tsx
 * @description The "Update available" popup shown when the app launches (and when the banner or the push
 * notification is tapped). On Android it downloads the APK inside the app and hands it to the installer, with
 * progress; if that is not possible (iOS, no APK attached, a failed download) it offers the release page.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  AppReleaseInfo,
  downloadAndInstallApk,
  formatReleaseNotes,
  launchApkInstaller,
  openInstallPermissionSettings,
  warmUpDownload,
} from '../services/appUpdate';

interface UpdatePromptProps {
  visible: boolean;
  info: AppReleaseInfo | null;
  onClose: () => void;
}

const BUTTON_INK = '#14110A';

function formatSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UpdatePrompt({ visible, info, onClose }: UpdatePromptProps) {
  const { theme } = useAuth();
  const c = Colors[theme];
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [bytes, setBytes] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [installerFile, setInstallerFile] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();

  useEffect(() => {
    if (!visible) {
      setBusy(false);
      setPercent(0);
      setBytes({ done: 0, total: 0 });
      setError(null);
      setInstallerFile(null);
    }
  }, [visible]);

  const apkUrl = info?.apkDownloadUrl;
  useEffect(() => {
    if (visible && apkUrl && Platform.OS === 'android') {
      warmUpDownload(apkUrl);
    }
  }, [visible, apkUrl]);

  if (!info) {
    return null;
  }

  const canInstallInApp = Platform.OS === 'android' && !!info.apkDownloadUrl;
  const notes = formatReleaseNotes(info.releaseNotes);
  const size = formatSize(info.apkSize);

  const openReleasePage = () => {
    Linking.openURL(info.releaseUrl).catch(() => undefined);
    onClose();
  };

  const startUpdate = async () => {
    if (!canInstallInApp || !info.apkDownloadUrl) {
      openReleasePage();
      return;
    }
    setBusy(true);
    setError(null);
    setPercent(0);
    setBytes({ done: 0, total: 0 });
    try {
      const localFile = await downloadAndInstallApk(
        info.apkDownloadUrl,
        (progress) => {
          setPercent(progress.percent);
          setBytes({ done: progress.downloadedBytes, total: progress.totalBytes });
        },
        info.apkSize
      );
      // Stay open: if Android did not show its installer the person needs the options below.
      setInstallerFile(localFile);
      setBusy(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The download did not finish.');
      setBusy(false);
    }
  };

  const reopenInstaller = async () => {
    if (!installerFile) return;
    setError(null);
    try {
      await launchApkInstaller(installerFile);
    } catch {
      setError('Android could not open the installer. Use "Download in browser" instead.');
    }
  };

  const allowInstalls = () => {
    openInstallPermissionSettings().catch(() => undefined);
  };

  const downloadInBrowser = () => {
    if (info.apkDownloadUrl) {
      Linking.openURL(info.apkDownloadUrl).catch(() => undefined);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={busy ? undefined : onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderAccent }]}>
          <View style={[styles.iconWrap, { backgroundColor: c.primary }]}>
            <Ionicons name="cloud-download-outline" size={26} color={BUTTON_INK} />
          </View>

          <Text style={[styles.title, { color: c.ink }]}>Update available</Text>
          <Text style={[styles.versions, { color: c.inkDim }]}>
            v{info.currentVersion} → {info.latestVersion}
            {size ? `  ·  ${size}` : ''}
          </Text>

          {notes ? (
            <View style={[styles.notes, { backgroundColor: c.bg, borderColor: c.border }]}>
              <ScrollView
                style={{ maxHeight: Math.max(120, Math.round(windowHeight * 0.32)) }}
                nestedScrollEnabled
                persistentScrollbar
                showsVerticalScrollIndicator
                accessibilityLabel="Release notes"
              >
                <Text style={[styles.notesText, { color: c.inkDim }]} selectable>
                  {notes}
                </Text>
              </ScrollView>
            </View>
          ) : null}

          {busy ? (
            <View style={styles.progress} accessibilityLiveRegion="polite">
              <ActivityIndicator color={c.primary} />
              <Text style={[styles.progressText, { color: c.ink }]}>
                {bytes.done > 0
                  ? `Downloading… ${Math.round(percent)}%  ·  ${formatSize(bytes.done)}${bytes.total > 0 ? ` of ${formatSize(bytes.total)}` : ''}`
                  : 'Connecting to GitHub…'}
              </Text>
              <View style={[styles.bar, { backgroundColor: c.border }]}>
                <View style={[styles.barFill, { backgroundColor: c.primary, width: `${Math.min(100, Math.max(0, percent))}%` }]} />
              </View>
            </View>
          ) : installerFile ? (
            <>
              <Text style={[styles.hint, { color: c.ink }]}>
                The installer should be open now. If nothing appeared, Android needs your permission
                to install updates from this app.
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={reopenInstaller}
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: c.primary }]}
              >
                <Text style={styles.primaryText}>Open installer again</Text>
              </Pressable>
              <Pressable onPress={allowInstalls} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={[styles.secondaryText, { color: c.primary }]}>Allow installs from this app</Text>
              </Pressable>
              <Pressable onPress={downloadInBrowser} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={[styles.secondaryText, { color: c.primary }]}>Download in browser</Text>
              </Pressable>
              <Pressable onPress={onClose} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={[styles.secondaryText, { color: c.inkDim }]}>Close</Text>
              </Pressable>
            </>
          ) : (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={startUpdate}
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: c.primary }]}
              >
                <Text style={styles.primaryText}>
                  {error ? 'Try again' : canInstallInApp ? 'Update now' : 'Open download page'}
                </Text>
              </Pressable>
              {error ? (
                <>
                  {canInstallInApp ? (
                    <Pressable onPress={downloadInBrowser} accessibilityRole="button" style={styles.secondaryButton}>
                      <Text style={[styles.secondaryText, { color: c.primary }]}>Download in browser</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={openReleasePage} accessibilityRole="button" style={styles.secondaryButton}>
                    <Text style={[styles.secondaryText, { color: c.primary }]}>Open the release page</Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable onPress={onClose} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={[styles.secondaryText, { color: c.inkDim }]}>Later</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxHeight: '92%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: 'stretch',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  versions: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  notes: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 12,
  },
  progress: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bar: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 999,
  },
  error: {
    color: '#C0584B',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: {
    color: BUTTON_INK,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
