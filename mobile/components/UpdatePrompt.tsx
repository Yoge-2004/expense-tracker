/**
 * @file UpdatePrompt.tsx
 * @description The "Update available" popup shown when the app launches (and when the banner or the push
 * notification is tapped). On Android it downloads the APK inside the app in the background and offers
 * clear choices: "Install Now" or "Install Later (on exit)". Allows closing or running in the background anytime.
 */

import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { FormattedReleaseNotes } from './FormattedReleaseNotes';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useUpdate } from '../context/UpdateContext';
import {
  AppReleaseInfo,
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
  const { theme, themeColors } = useAuth();
  const c = themeColors || Colors[theme];
  const { height: windowHeight } = useWindowDimensions();

  const {
    isDownloading,
    downloadProgress,
    downloadError,
    readyFileUri,
    startDownload,
    installNow,
    installLater,
    dismissError,
  } = useUpdate();

  const handleClose = () => {
    dismissError();
    onClose();
  };

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
  const size = formatSize(info.apkSize);
  const percent = downloadProgress?.percent || 0;
  const bytesDone = downloadProgress?.downloadedBytes || 0;
  const bytesTotal = downloadProgress?.totalBytes || info.apkSize || 0;

  const openReleasePage = () => {
    Linking.openURL(info.releaseUrl).catch(() => undefined);
    handleClose();
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
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderAccent }]}>
          {/* Header Icon */}
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: readyFileUri ? c.teal : c.primary },
            ]}
          >
            <Ionicons
              name={
                readyFileUri
                  ? 'checkmark-circle-outline'
                  : isDownloading
                  ? 'cloud-download-outline'
                  : 'sparkles-outline'
              }
              size={26}
              color={BUTTON_INK}
            />
          </View>

          {/* Title and version */}
          <Text style={[styles.title, { color: c.ink }]}>
            {readyFileUri
              ? 'Update Ready to Install'
              : isDownloading
              ? 'Downloading Update…'
              : 'Update Available'}
          </Text>

          <Text style={[styles.versions, { color: c.inkDim }]}>
            v{info.currentVersion} → {info.latestVersion}
            {size ? `  ·  ${size}` : ''}
          </Text>

          {/* Release Notes */}
          {info.releaseNotes && !isDownloading ? (
            <FormattedReleaseNotes
              rawNotes={info.releaseNotes}
              colors={c}
              maxHeight={Math.max(140, Math.round(windowHeight * 0.32))}
            />
          ) : null}

          {/* State 1: Active Background Download with Live Progress */}
          {isDownloading ? (
            <View style={styles.progress} accessibilityLiveRegion="polite">
              <ActivityIndicator color={c.primary} />
              <Text style={[styles.progressText, { color: c.ink }]}>
                {bytesDone > 0
                  ? `Downloading… ${Math.round(percent)}%  ·  ${formatSize(bytesDone)}${bytesTotal > 0 ? ` of ${formatSize(bytesTotal)}` : ''}`
                  : 'Connecting to GitHub CDN…'}
              </Text>
              <View style={[styles.bar, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: c.primary,
                      width: `${Math.min(100, Math.max(5, percent))}%`,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.bgNotice, { color: c.inkDim }]}>
                This download continues automatically in the background. You can close this window anytime.
              </Text>

              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: c.fillStrong, marginTop: 12 }]}
              >
                <Text style={[styles.primaryText, { color: c.ink }]}>Run in Background</Text>
              </Pressable>
            </View>
          ) : readyFileUri ? (
            /* State 2: Download complete, prompt to install now or later */
            <View style={styles.actionSection}>
              <Text style={[styles.hint, { color: c.ink }]}>
                The latest release has been downloaded and verified on your device. Would you like to install now or keep using the app and install later?
              </Text>

              {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}

              <Pressable
                onPress={installNow}
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: c.primary }]}
              >
                <Text style={styles.primaryText}>Install Now</Text>
              </Pressable>

              <Pressable
                onPress={installLater}
                accessibilityRole="button"
                style={[styles.secondaryButton, { marginTop: 6 }]}
              >
                <Text style={[styles.secondaryText, { color: c.primary, fontWeight: '800' }]}>
                  Install Later (on exit)
                </Text>
              </Pressable>

              <Pressable onPress={allowInstalls} accessibilityRole="button" style={styles.linkButton}>
                <Text style={[styles.linkText, { color: c.inkDim }]}>App install permissions</Text>
              </Pressable>
            </View>
          ) : (
            /* State 3: Ready to initiate update */
            <View style={styles.actionSection}>
              {downloadError ? <Text style={styles.error}>{downloadError}</Text> : null}

              <Pressable
                onPress={canInstallInApp ? startDownload : openReleasePage}
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: c.primary }]}
              >
                <Text style={styles.primaryText}>
                  {downloadError ? 'Try again' : canInstallInApp ? 'Download & Update' : 'Open Download Page'}
                </Text>
              </Pressable>

              {downloadError ? (
                <>
                  {canInstallInApp ? (
                    <Pressable onPress={downloadInBrowser} accessibilityRole="button" style={styles.secondaryButton}>
                      <Text style={[styles.secondaryText, { color: c.primary }]}>Download in browser</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={openReleasePage} accessibilityRole="button" style={styles.secondaryButton}>
                    <Text style={[styles.secondaryText, { color: c.primary }]}>Open release page</Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable onPress={handleClose} accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={[styles.secondaryText, { color: c.inkDim }]}>Later</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    maxHeight: '92%',
    borderRadius: 24,
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
  actionSection: {
    gap: 6,
    marginTop: 8,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 12,
  },
  bgNotice: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
    paddingHorizontal: 8,
  },
  progress: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  bar: {
    alignSelf: 'stretch',
    height: 7,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 7,
    borderRadius: 999,
  },
  error: {
    color: '#C0584B',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: BUTTON_INK,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  linkButton: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
