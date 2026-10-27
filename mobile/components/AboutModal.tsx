/**
 * @file AboutModal.tsx
 * @description In-app modal detailing the ExpenseTracker platform mission, architecture, and version.
 * Includes live GitHub releases update checking and in-app APK downloading with installation.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  checkForAppUpdate,
  AppReleaseInfo,
  DISPLAY_VERSION,
  downloadAndInstallApk,
  DownloadProgress,
} from '../services/appUpdate';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ visible, onClose }) => {
  const {theme, themeColors} = useAuth();
  const c = themeColors || Colors[theme];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [updateInfo, setUpdateInfo] = useState<AppReleaseInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      void checkUpdate();
    }
  }, [visible]);

  const checkUpdate = async () => {
    setCheckingUpdate(true);
    setDownloadError(null);
    try {
      const info = await checkForAppUpdate();
      setUpdateInfo(info);
    } catch {
      // Keep silent on network error
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleOpenRelease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (updateInfo?.releaseUrl) {
      Linking.openURL(updateInfo.releaseUrl).catch(() => {});
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!updateInfo?.apkDownloadUrl) {
      handleOpenRelease();
      return;
    }
    setDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ percent: 0, downloadedBytes: 0, totalBytes: updateInfo.apkSize || 0 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      await downloadAndInstallApk(updateInfo.apkDownloadUrl, (p) => {
        setDownloadProgress(p);
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      setDownloadError(err.message || 'Download failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setDownloading(false);
    }
  };

  const apkSizeText = updateInfo?.apkSize
    ? `${(updateInfo.apkSize / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.card,
              borderColor: c.border,
              paddingTop: Math.max(20, insets.top),
              paddingBottom: Math.max(20, insets.bottom),
              maxHeight: height * 0.88,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: c.primary + '1A', borderColor: c.primary + '40' }]}>
                <Text style={[styles.badgeText, { color: c.primary }]}>EXECUTIVE EDITION &bull; {DISPLAY_VERSION}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.closeBtn, { backgroundColor: c.inputBg }]}
              accessibilityLabel="Close about modal"
            >
              <Ionicons name="close" size={18} color={c.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Logo / Title */}
            <View style={styles.heroSection}>
              <View style={[styles.logoIconBox, { backgroundColor: c.primary + '20', borderColor: c.primary }]}>
                <Ionicons name="wallet" size={32} color={c.primary} />
              </View>
              <Text style={[styles.appTitle, { color: c.text }]}>ExpenseTracker</Text>
              <Text style={[styles.tagline, { color: c.textMuted }]}>
                An executive-grade personal financial command center designed for complete financial sovereignty, privacy, and speed.
              </Text>
            </View>

            {/* Updates Banner */}
            <View style={[styles.updateCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <View style={styles.updateCardHeader}>
                <View style={styles.updateHeaderLeft}>
                  <Ionicons
                    name={updateInfo?.hasUpdate ? 'cloud-download' : 'shield-checkmark'}
                    size={20}
                    color={updateInfo?.hasUpdate ? c.primary : c.teal}
                  />
                  <Text style={[styles.updateTitle, { color: c.text }]}>
                    {updateInfo?.hasUpdate ? 'Update Available' : 'Release Status'}
                  </Text>
                </View>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color={c.primary} />
                ) : (
                  <TouchableOpacity
                    onPress={checkUpdate}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.refreshBtn}
                  >
                    <Ionicons name="refresh" size={16} color={c.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {updateInfo?.hasUpdate ? (
                <View style={styles.updateBody}>
                  <Text style={[styles.updateSub, { color: c.text }]}>
                    A new release ({updateInfo.latestVersion}) is ready to install.
                  </Text>
                  {!!updateInfo.releaseName && updateInfo.releaseName !== updateInfo.latestVersion && (
                    <Text style={[styles.releaseName, { color: c.primary }]}>
                      {updateInfo.releaseName}
                    </Text>
                  )}

                  {/* Real-time download progress */}
                  {downloading || downloadProgress ? (
                    <View style={styles.downloadProgressWrap}>
                      <View style={styles.downloadMetaRow}>
                        <Text style={[styles.downloadStageText, { color: c.text }]}>
                          {downloadProgress?.percent === 100
                            ? 'Opening Package Installer...'
                            : 'Downloading Update APK...'}
                        </Text>
                        <Text style={[styles.downloadPctText, { color: c.primary }]}>
                          {downloadProgress?.percent || 0}%
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: c.surface }]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(100, Math.max(5, downloadProgress?.percent || 0))}%`,
                              backgroundColor: downloadProgress?.percent === 100 ? '#10B981' : c.primary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.downloadBytesText, { color: c.textMuted }]}>
                        {downloadProgress?.totalBytes
                          ? `${(downloadProgress.downloadedBytes / (1024 * 1024)).toFixed(1)} MB / ${(downloadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                          : `${((downloadProgress?.downloadedBytes || 0) / (1024 * 1024)).toFixed(1)} MB downloaded`}
                      </Text>
                    </View>
                  ) : null}

                  {downloadError ? (
                    <View style={styles.errorBox}>
                      <Ionicons name="alert-circle" size={16} color="#EF4444" />
                      <Text style={styles.errorText}>{downloadError}</Text>
                    </View>
                  ) : null}

                  {/* Download and install button */}
                  {!downloading && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleDownloadAndInstall}
                      style={[styles.updateActionBtn, { backgroundColor: c.primary }]}
                    >
                      <Ionicons
                        name={Platform.OS === 'android' ? 'arrow-down-circle' : 'cloud-download'}
                        size={18}
                        color="#10120E"
                      />
                      <Text style={styles.updateActionBtnText}>
                        {Platform.OS === 'android'
                          ? `Download & Install Update${apkSizeText ? ` (${apkSizeText})` : ''}`
                          : 'Download Update'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleOpenRelease}
                    style={styles.githubLinkBtn}
                  >
                    <Ionicons name="logo-github" size={14} color={c.textMuted} />
                    <Text style={[styles.githubLinkText, { color: c.textMuted }]}>
                      View Release Notes on GitHub
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.updateBody}>
                  <Text style={[styles.updateSub, { color: c.textMuted }]}>
                    {checkingUpdate
                      ? 'Checking GitHub releases for latest version...'
                      : `You are running the latest version (${DISPLAY_VERSION}).`}
                  </Text>
                  {!checkingUpdate && (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={checkUpdate}
                      style={[styles.checkNowBtn, { borderColor: c.border }]}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color={c.teal} />
                      <Text style={[styles.checkNowText, { color: c.text }]}>Check for Updates</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Core Pillars */}
            <View style={styles.pillarsGrid}>
              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="lock-closed-outline" size={16} color={c.primary} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>100% Private Ledger</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Your data stays strictly under your control. No third-party data tracking, ad pixels, or receipt selling.
                </Text>
              </View>

              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="sparkles-outline" size={16} color={c.accent} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>Instant Tactile UI</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Crafted with 60 FPS physics animations, device haptics, and sub-16ms theme transitions.
                </Text>
              </View>

              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="stats-chart-outline" size={16} color={c.teal} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>Executive Accounting</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Native multi-sheet Excel workbooks with AutoFilters, live SUM formulas, and audit-ready PDF reports.
                </Text>
              </View>

              <View style={[styles.pillarBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
                <View style={styles.pillarTitleRow}>
                  <Ionicons name="sync-outline" size={16} color={c.primary} />
                  <Text style={[styles.pillarTitle, { color: c.text }]}>Real-Time Sync</Text>
                </View>
                <Text style={[styles.pillarDesc, { color: c.textMuted }]}>
                  Fluid parity between Web Dashboard and Mobile App, with offline fallback and proactive polling.
                </Text>
              </View>
            </View>

            {/* Tech Stack */}
            <View style={[styles.techCard, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Text style={[styles.techTitle, { color: c.text }]}>Core Architecture</Text>
              <Text style={[styles.techSub, { color: c.textMuted }]}>
                Spring Boot 4.1.1 (Java 27) &bull; React Native 0.88 (Expo SDK 58 &bull; React 19.3) &bull; TypeScript &bull; Apache POI &bull; Tesseract OCR
              </Text>
            </View>
          </ScrollView>

          {/* Action Button */}
          <View style={[styles.footer, { borderTopColor: c.border }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
              style={[styles.dismissBtn, { backgroundColor: c.inputBg, borderColor: c.border }]}
            >
              <Text style={[styles.dismissText, { color: c.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 14,
  },
  logoIconBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  updateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  updateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  updateTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  refreshBtn: {
    padding: 4,
  },
  updateBody: {
    marginTop: 8,
  },
  updateSub: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  releaseName: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  downloadProgressWrap: {
    marginTop: 10,
    marginBottom: 6,
  },
  downloadMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  downloadStageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  downloadPctText: {
    fontSize: 12,
    fontWeight: '900',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  downloadBytesText: {
    fontSize: 10.5,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 11.5,
    color: '#EF4444',
  },
  updateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  updateActionBtnText: {
    color: '#10120E',
    fontSize: 13,
    fontWeight: '800',
  },
  githubLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginTop: 6,
  },
  githubLinkText: {
    fontSize: 11.5,
    textDecorationLine: 'underline',
  },
  checkNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  checkNowText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pillarsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  pillarBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  pillarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pillarDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  techCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  techTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  techSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dismissBtn: {
    width: '100%',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
