/**
 * @file profile.tsx
 * @description Settings, preferences, and account management screen.
 * Handles:
 * - Nickname and profile avatar customization.
 * - Global ledger currency selection (65+ world currencies).
 * - Theme switching (light / dark).
 * - Custom category manager modal.
 * - Monthly Financial Summary Modal (Month & Year picker, HTML View/Share, SMTP email).
 * - Safe permanent account deletion requiring explicit "DELETE" typed confirmation.
 * - In-app modern custom alert dialogs.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError, checkServerHealth, resolveAvatarUrl } from '../../services/api';
import { OfflineBanner } from '../../components/OfflineBanner';
import { WORLD_CURRENCIES } from '../../services/currency';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Clipboard from 'expo-clipboard';
import { clearSavedPin, savedPinEmail, savePinForFingerprint } from '../../utils/pinVault';

import { AmbientAura } from '../../components/AmbientAura';
import { StaggeredView } from '../../components/StaggeredView';
import { ManageCategoriesModal } from '../../components/ManageCategoriesModal';
import { ThemedScrollView } from '../../components/ThemedScrollbar';
import { MonthlyReportModal } from '../../components/MonthlyReportModal';
import { HelpGuideModal } from '../../components/HelpGuideModal';
import { AboutModal } from '../../components/AboutModal';
import { ThemeToggleBtn } from '../../components/ThemeToggleBtn';
import { checkForAppUpdate, AppReleaseInfo, DISPLAY_VERSION } from '../../services/appUpdate';
import {
  enableSmartReminders,
  disableSmartReminders,
  getSmartRemindersEnabled,
  getTransactionAlertsEnabled,
  setTransactionAlertsEnabled,
  getInstantDebitAlertsEnabled,
  setInstantDebitAlertsEnabled,
  scheduleDailyExpenseReminders,
  cancelDailyExpenseReminders,
  getDailyRemindersEnabled,
  processIncomingMessageForDebitNotification,
  detectAndAddExpenseFromMessage,
} from '../../services/notifications';

export default function ProfileScreen() {
  const {
    userId,
    userName,
    theme,
    toggleTheme,
    currency,
    updateCurrency,
    logout,
    updateUserName,
    isBiometricsAvailable,
    isBiometricEnabled,
    toggleBiometrics,
    profilePicture,
    updateUserProfile,
    refreshUserProfile,
  } = useAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const isLight = theme === 'light';
  const c = Colors[theme];

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 700;
  const isDesktopOrTV = width >= 1024;

  const [nickname, setNickname] = useState(userName || '');
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  // Profile Avatar Modal State
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState(profilePicture || '');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  const [updateInfo, setUpdateInfo] = useState<AppReleaseInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [retryingProfile, setRetryingProfile] = useState(false);

  const checkConnectivity = async () => {
    try {
      const healthy = await checkServerHealth();
      setIsOffline(!healthy);
    } catch {
      setIsOffline(true);
    }
  };

  const handleRetryProfile = async () => {
    setRetryingProfile(true);
    try {
      const healthy = await checkServerHealth();
      setIsOffline(!healthy);
      if (healthy) {
        void checkForAppUpdate().then((info) => setUpdateInfo(info)).catch(() => {});
      }
    } finally {
      setRetryingProfile(false);
    }
  };

  React.useEffect(() => {
    void checkConnectivity();
    void checkForAppUpdate().then((info) => setUpdateInfo(info)).catch(() => {});
  }, []);

  const handleCheckUpdate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCheckingUpdate(true);
    const info = await checkForAppUpdate();
    setUpdateInfo(info);
    setCheckingUpdate(false);
    if (info.hasUpdate) {
      showAlert(
        'Update Available 🚀',
        'A new version (' + info.latestVersion + ') is available.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Update Now',
            onPress: () => {
              setShowAboutModal(true);
            },
          },
        ],
        'info'
      );
    } else {
      showAlert(
        'Up to Date 🎉',
        'ExpenseTracker is on the latest release (' + DISPLAY_VERSION + ').',
        undefined,
        'success'
      );
    }
  };

  const [smartRemindersEnabled, setSmartRemindersEnabled] = useState(true);
  const [transactionAlertsEnabled, setTransactionAlertsOn] = useState(true);

  React.useEffect(() => {
    void getDailyRemindersEnabled().then((enabled) => setRemindersEnabled(enabled)).catch(() => {});
    void getSmartRemindersEnabled().then((enabled) => setSmartRemindersEnabled(enabled)).catch(() => {});
    void getTransactionAlertsEnabled().then((enabled) => setTransactionAlertsOn(enabled)).catch(() => {});
    void getInstantDebitAlertsEnabled().then((enabled) => setInstantDebitEnabled(enabled)).catch(() => {});
  }, []);

  const handleToggleTransactionAlerts = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = !transactionAlertsEnabled;
    await setTransactionAlertsEnabled(next);
    setTransactionAlertsOn(next);
    showAlert(
      next ? 'Confirmations On' : 'Confirmations Off',
      next
        ? 'You will get a notification each time you record a debit or a credit.'
        : 'You will no longer get a notification when you record a transaction.',
      undefined,
      next ? 'success' : 'info'
    );
  };

  const handleToggleSmartReminders = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (smartRemindersEnabled) {
      await disableSmartReminders();
      setSmartRemindersEnabled(false);
      showAlert(
        'Reminders Paused',
        'Bill, salary, weekly and monthly reminders have been turned off.',
        undefined,
        'info'
      );
    } else {
      const success = await enableSmartReminders();
      if (success) {
        setSmartRemindersEnabled(true);
        showAlert(
          'Reminders Active ⏰',
          'You will get a morning plan, bill and salary reminders, a Sunday-evening review, and month-start and month-end check-ins.',
          undefined,
          'success'
        );
      } else {
        showAlert(
          'Permission Needed',
          'Please allow notification permissions in your device settings to receive reminders.',
          undefined,
          'warning'
        );
      }
    }
  };

  const [instantDebitEnabled, setInstantDebitEnabled] = useState(true);

  const handleToggleInstantDebit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = !instantDebitEnabled;
    await setInstantDebitAlertsEnabled(next);
    setInstantDebitEnabled(next);
    showAlert(
      next ? 'Debit Detection Active ⚡' : 'Debit Detection Paused',
      next
        ? 'Bank debit SMS and transaction notifications will be automatically detected and added to your ledger.'
        : 'Automatic expense creation from debit alerts is paused.',
      undefined,
      next ? 'success' : 'info'
    );
  };

  const handleSimulateDebit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const sampleSms =
      'Alert: Your A/c ending 4589 debited by INR 350.00 on 24-Sep-26 at Starbucks Coffee ref txn882910.';
    const result = await detectAndAddExpenseFromMessage(sampleSms, userId);
    if (result) {
      if (result.duplicate) {
        showAlert(
          'Duplicate Suppressed 🛡️',
          `This debit (${result.currency} ${result.amount?.toFixed(2)} at ${result.merchant}) was already recorded recently and was suppressed to prevent duplicates.`,
          undefined,
          'info'
        );
      } else {
        showAlert(
          'Instant Debit Triggered 💸',
          `Parsed & added expense to ledger: ${result.currency} ${result.amount?.toFixed(2)} at ${result.merchant}.`,
          undefined,
          'success'
        );
      }
    } else {
      showAlert(
        'Simulation Result',
        'Debit detection is currently disabled in your preferences, or message could not be parsed.',
        undefined,
        'info'
      );
    }
  };

  const handlePasteAndIngestSms = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const hasStr = await Clipboard.hasStringAsync();
      if (!hasStr) {
        showAlert(
          'Clipboard Empty',
          'Please copy a bank transaction SMS from your SMS app first, then tap here to ingest.',
          undefined,
          'info'
        );
        return;
      }
      const text = await Clipboard.getStringAsync();
      if (!text || text.trim().length === 0) {
        showAlert(
          'Clipboard Empty',
          'Please copy a bank transaction SMS from your SMS app first, then tap here to ingest.',
          undefined,
          'info'
        );
        return;
      }
      const result = await detectAndAddExpenseFromMessage(text, userId);
      if (result) {
        if (result.duplicate) {
          showAlert(
            'Duplicate Suppressed 🛡️',
            `This transaction (${result.currency} ${result.amount?.toFixed(2)} at ${result.merchant || 'merchant'}) was already recorded recently.`,
            undefined,
            'info'
          );
        } else {
          showAlert(
            'Expense Recorded! ⚡',
            `Successfully captured ${result.currency} ${result.amount?.toFixed(2)} at ${result.merchant || 'merchant'} to your expense ledger.`,
            undefined,
            'success'
          );
        }
      } else {
        showAlert(
          'No Debit Found',
          'The copied text did not contain a recognizable bank debit message or amount.',
          undefined,
          'warning'
        );
      }
    } catch (err: any) {
      showAlert('Error Reading SMS', err?.message || 'Could not access clipboard.');
    }
  };

  const handleOpenNotificationAccess = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (Platform.OS === 'android') {
      try {
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.NOTIFICATION_LISTENER_SETTINGS);
      } catch (_) {
        try {
          await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
            data: 'package:com.expense.tracker',
          });
        } catch (e: any) {
          showAlert('Notification Settings', 'Open your device Settings -> Apps -> ExpenseTracker -> Notifications.', undefined, 'info');
        }
      }
    } else {
      showAlert('Notification Settings', 'Please manage ExpenseTracker notification permissions in iOS Settings.', undefined, 'info');
    }
  };

  const handleToggleReminders = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (remindersEnabled) {
      await cancelDailyExpenseReminders();
      setRemindersEnabled(false);
      showAlert(
        'Reminders Paused',
        'Daily 2x expense notifications have been turned off.',
        undefined,
        'info'
      );
    } else {
      const success = await scheduleDailyExpenseReminders();
      if (success) {
        setRemindersEnabled(true);
        showAlert(
          'Reminders Active ⏰',
          'You will receive reminders twice daily at 1:30 PM (lunch) and 8:30 PM (evening wrap-up) to log your expenses.',
          undefined,
          'success'
        );
      } else {
        showAlert(
          'Permission Needed',
          'Please allow notification permissions in your device settings to receive expense reminders.',
          undefined,
          'warning'
        );
      }
    }
  };

  // Security PIN setup state
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasSecurityPin, setHasSecurityPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  /** A fingerprint-protected copy of the PIN is saved on this phone for this account. */
  const [fingerprintResetEnabled, setFingerprintResetEnabled] = useState(false);
  /** Set when the switch was turned on: the next PIN save also stores it behind the fingerprint. */
  const [enableFingerprintOnSave, setEnableFingerprintOnSave] = useState(false);

  React.useEffect(() => {
    if (!userId) return;
    apiRequest(`/users/${userId}`)
      .then((u) => {
        if (u && u.hasSecurityPin) setHasSecurityPin(true);
        if (u && u.email) {
          setAccountEmail(u.email);
          void savedPinEmail().then((saved) =>
            setFingerprintResetEnabled(!!saved && saved === String(u.email).trim().toLowerCase())
          ).catch(() => {});
        }
      })
      .catch(() => {});
  }, [userId]);

  const closePinModal = () => {
    setShowPinModal(false);
    setEnableFingerprintOnSave(false);
  };

  const handleSavePin = async () => {
    if (!/^[0-9]{6}$/.test(newPin.trim())) {
      showAlert('Invalid PIN', 'PIN must be exactly 6 numeric digits.', undefined, 'warning');
      return;
    }
    if (newPin.trim() !== confirmPin.trim()) {
      showAlert('Mismatch', 'PIN entries do not match.', undefined, 'warning');
      return;
    }
    setIsSavingPin(true);
    try {
      await apiRequest(`/users/${userId}/security-pin`, {
        method: 'PUT',
        body: JSON.stringify({ securityPin: newPin.trim() }),
      });
      const savedPin = newPin.trim();
      setHasSecurityPin(true);
      setShowPinModal(false);
      setNewPin('');
      setConfirmPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      let fingerprintNote = '';
      if ((fingerprintResetEnabled || enableFingerprintOnSave) && accountEmail) {
        const stored = await savePinForFingerprint(accountEmail, savedPin);
        setFingerprintResetEnabled(stored);
        fingerprintNote = stored
          ? ' Your fingerprint can now fill it in when you reset your password.'
          : ' Your fingerprint could not be linked on this device.';
      }
      setEnableFingerprintOnSave(false);
      showAlert(
        'Security PIN Saved 🔒',
        `Your 6-digit recovery PIN has been configured successfully.${fingerprintNote}`,
        undefined,
        'success'
      );
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not save Security PIN.';
      showAlert('Save Failed', msg, undefined, 'error');
    } finally {
      setIsSavingPin(false);
    }
  };

    // Avatar Management
  const handleOpenAvatarModal = () => {
    setAvatarUrlInput(profilePicture || "");
    setShowAvatarModal(true);
  };

  const handlePickLocalAvatar = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }
      const asset = res.assets[0];
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        showAlert("File Too Large", "Please select an image smaller than 5MB.", undefined, "warning");
        return;
      }
      setIsSavingAvatar(true);
      const formData = new FormData();
      if (Platform.OS === "web" && (asset as any).file) {
        formData.append("file", (asset as any).file);
      } else {
        formData.append("file", {
          uri: asset.uri,
          name: asset.name || "avatar.jpg",
          type: asset.mimeType || "image/jpeg",
        } as any);
      }
      await apiRequest<{ profilePictureUrl: string; message: string }>(
        `/users/${userId}/avatar`,
        {
          method: "POST",
          body: formData,
        }
      );
      await refreshUserProfile();
      setShowAvatarModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        "Profile Picture Updated 📸",
        "Your profile picture has been updated from your device and synced.",
        undefined,
        "success"
      );
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "Could not upload photo from device.";
      showAlert("Upload Failed", msg, undefined, "error");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSaveAvatar = async () => {
    const cleanUrl = avatarUrlInput.trim();
    if (cleanUrl && !cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      showAlert(
        "Invalid URL",
        "Please enter a valid web image URL (starting with https:// or http://).",
        undefined,
        "warning"
      );
      return;
    }
    if (cleanUrl.length > 512) {
      showAlert("URL Too Long", "Profile image URL cannot exceed 512 characters.", undefined, "warning");
      return;
    }
    setIsSavingAvatar(true);
    try {
      await updateUserProfile({ profilePictureUrl: cleanUrl });
      await refreshUserProfile();
      setShowAvatarModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        "Profile Picture Updated",
        cleanUrl
          ? "Your new profile picture has been synced and applied."
          : "Profile picture has been reset to default monogram.",
        undefined,
        "success"
      );
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "Could not save profile picture.";
      showAlert("Update Failed", msg, undefined, "error");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleClearAvatar = async () => {
    setIsSavingAvatar(true);
    try {
      if (userId) {
        try {
          await apiRequest(`/users/${userId}/avatar`, { method: "DELETE" });
        } catch {
          await updateUserProfile({ profilePictureUrl: "" });
        }
      } else {
        await updateUserProfile({ profilePictureUrl: "" });
      }
      await refreshUserProfile();
      setAvatarUrlInput("");
      setShowAvatarModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert(
        "Avatar Removed",
        "Your profile picture has been reset to the default monogram.",
        undefined,
        "info"
      );
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : "Could not reset avatar.";
      showAlert("Reset Failed", msg, undefined, "error");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  // Delete account typed confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const currItem = WORLD_CURRENCIES.find((item) => item.code === currency);

  /**
   * Updates user display name with validation.
   */
  const handleSaveNickname = async () => {
    const cleanName = nickname.trim();
    if (!cleanName) {
      showAlert('Invalid Name', 'Display name cannot be empty.', undefined, 'warning');
      return;
    }
    if (cleanName.length < 2 || cleanName.length > 50) {
      showAlert('Invalid Name', 'Display name must be between 2 and 50 characters.', undefined, 'warning');
      return;
    }
    try {
      await updateUserName(cleanName);
      setIsEditing(false);
      showAlert('Profile Updated', `Your display name has been saved as "${cleanName}".`, undefined, 'success');
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : 'Could not save profile name.';
      showAlert('Update Failed', msg, undefined, 'error');
    }
  };

  /**
   * Executes permanent account deletion once confirmation text matches "DELETE".
   */
  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== 'DELETE' || !deletePassword.trim()) {
      return;
    }
    setIsDeletingAccount(true);
    try {
      await apiRequest(`/users/${userId}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword.trim() }),
        skipAuthRedirect: true,
      } as any);
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      setDeletePassword('');
      await logout();
    } catch (err: any) {
      setDeletePassword('');
      const msg = err instanceof ApiError ? err.message : 'Could not delete account.';
      showAlert('Deletion Error', msg, undefined, 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const filteredCurrencies = WORLD_CURRENCIES.filter(
    (item) =>
      item.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
      item.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
      item.symbol.includes(currencySearch)
  );

  return (
    <View style={[styles.screenWrapper, { backgroundColor: c.bg }]}>
      <AmbientAura />

      <ThemedScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 48),
            maxWidth: isDesktopOrTV ? 960 : isLargeScreen ? 720 : undefined,
            alignSelf: isLargeScreen ? 'center' : undefined,
            width: isLargeScreen ? '100%' : undefined,
            paddingLeft: Math.max(16, insets.left),
            paddingRight: Math.max(16, insets.right),
            paddingBottom: Math.max(insets.bottom + 20, 36),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Offline Banner */}
        {isOffline && (
          <View style={{ marginBottom: 16 }}>
            <OfflineBanner
              message="Server is offline · profile changes will sync when connected"
              onRetry={handleRetryProfile}
              retrying={retryingProfile}
            />
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: c.text }]}>Settings & Profile</Text>
          <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>
            Preferences, categories, currency, and security
          </Text>
        </View>

        {/* User Card */}
        <StaggeredView delay={100} direction="up">
          <View style={[styles.userCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.userCardTop}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleOpenAvatarModal}
                style={styles.avatarWrapper}
                accessibilityRole="button"
                accessibilityLabel="Update profile picture"
              >
                <View style={[styles.bigAvatar, { backgroundColor: c.primary, borderColor: c.primary + '60' }]}>
                  {profilePicture ? (
                    <Image source={{ uri: resolveAvatarUrl(profilePicture) || undefined }} style={styles.bigAvatarImg} />
                  ) : (
                    <Text style={styles.avatarLetter}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={[styles.avatarEditBadge, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Ionicons name="camera" size={12} color={c.primary} />
                </View>
              </TouchableOpacity>
              <View style={styles.userMeta}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[
                        styles.editInput,
                        { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
                      ]}
                      value={nickname}
                      onChangeText={setNickname}
                      maxLength={50}
                      autoFocus
                    />
                    <TouchableOpacity
                      onPress={handleSaveNickname}
                      style={[styles.saveNickBtn, { backgroundColor: c.primary }]}
                    >
                      <Ionicons name="checkmark" size={16} color={isLight ? '#FFF' : '#10120E'} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.nameRow}>
                    <Text style={[styles.userNameText, { color: c.text }]}>{userName || 'User'}</Text>
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                      <Ionicons name="pencil" size={16} color={c.textMuted} />
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={[styles.memberBadgeText, { color: c.primary }]}>Active Account</Text>
              </View>
            </View>
          </View>
        </StaggeredView>

        {/* Preferences Section */}
        <StaggeredView delay={150} direction="up">
          <Text style={[styles.sectionTitle, { color: c.textMuted }]}>PREFERENCES</Text>
          <View style={[styles.menuBlock, { backgroundColor: c.card, borderColor: c.border }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                void toggleTheme();
              }}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name={isLight ? 'sunny' : 'moon'} size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Appearance Theme</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Currently: {isLight ? 'Light Elegance' : 'Dark Obsidian'}
                  </Text>
                </View>
              </View>
              <ThemeToggleBtn />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowCurrencyModal(true);
              }}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.teal + '18' }]}>
                  <Text style={[styles.menuCurrencySymbol, { color: c.teal }]}>
                    {currItem?.symbol || '₹'}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Primary Currency</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    {currItem ? `${currItem.code} (${currItem.name})` : currency}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowCategoryModal(true);
              }}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="pricetags-outline" size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Manage Categories</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Create, rename, or color custom categories
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowReportModal(true);
              }}
              style={styles.menuRow}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.accent + '18' }]}>
                  <Ionicons name="document-text-outline" size={18} color={c.accent} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Monthly Financial Report</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Generate, share, and email executive statements
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        </StaggeredView>

        {/* Notifications & Reminders */}
        <StaggeredView delay={200} direction="up">
          <Text style={[styles.sectionTitle, { color: c.textMuted }]}>NOTIFICATIONS & AUTOMATION</Text>
          <View style={[styles.menuBlock, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="notifications-outline" size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Daily Reminders</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Twice-daily check-ins (1:30 PM & 8:30 PM)
                  </Text>
                </View>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={handleToggleReminders}
                trackColor={{ false: c.border, true: c.primary }}
              />
            </View>

            <View style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.teal + '18' }]}>
                  <Ionicons name="sparkles-outline" size={18} color={c.teal} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Smart Insights & Schedule</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Morning plan, bills, weekend & monthly reviews
                  </Text>
                </View>
              </View>
              <Switch
                value={smartRemindersEnabled}
                onValueChange={handleToggleSmartReminders}
                trackColor={{ false: c.border, true: c.primary }}
              />
            </View>

            <View style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="checkmark-done-circle-outline" size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Transaction Confirmations</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    In-app notification upon recording debits or credits
                  </Text>
                </View>
              </View>
              <Switch
                value={transactionAlertsEnabled}
                onValueChange={handleToggleTransactionAlerts}
                trackColor={{ false: c.border, true: c.primary }}
              />
            </View>

            <View style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.accent + '18' }]}>
                  <Ionicons name="flash-outline" size={18} color={c.accent} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Instant Bank Debit Detection</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Auto-capture expenses from SMS alerts
                  </Text>
                </View>
              </View>
              <Switch
                value={instantDebitEnabled}
                onValueChange={handleToggleInstantDebit}
                trackColor={{ false: c.border, true: c.primary }}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSimulateDebit}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.accent + '18' }]}>
                  <Ionicons name="play-outline" size={18} color={c.accent} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Test Debit Simulation</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Simulate receiving a bank debit SMS
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePasteAndIngestSms}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="clipboard-outline" size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Ingest Copied Bank SMS</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Parse & record SMS text currently on clipboard
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenNotificationAccess}
              style={styles.menuRow}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.accent + '18' }]}>
                  <Ionicons name="notifications-outline" size={18} color={c.accent} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>System Notification Settings</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Configure system notification & listener access
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <View style={{ padding: 12, backgroundColor: isLight ? 'rgba(212, 175, 55, 0.08)' : 'rgba(245, 200, 66, 0.08)', borderRadius: 10, margin: 12, borderWidth: 1, borderColor: isLight ? 'rgba(212, 175, 55, 0.25)' : 'rgba(245, 200, 66, 0.2)' }}>
              <Text style={{ fontSize: 11.5, lineHeight: 17, color: isLight ? '#78350F' : '#F5C842' }}>
                💡 <Text style={{ fontWeight: '700' }}>How Bank SMS capture works:</Text> Whenever you receive a bank debit SMS, copy it. ExpenseTracker automatically parses the amount & merchant the moment you switch to the app or tap "Paste SMS" on the Record screen!
              </Text>
            </View>
          </View>
        </StaggeredView>

        {/* Support & About Section */}
        <StaggeredView delay={240} direction="up">
          <Text style={[styles.sectionTitle, { color: c.textMuted }]}>SUPPORT & ABOUT</Text>
          <View style={[styles.menuBlock, { backgroundColor: c.card, borderColor: c.border }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowHelpModal(true);
              }}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="book-outline" size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>User Guide & Help</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    How to use features, logging, and shortcuts
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCheckUpdate}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="cloud-download-outline" size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>Check for Updates</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    {checkingUpdate
                      ? 'Checking GitHub releases...'
                      : updateInfo?.hasUpdate
                      ? 'New release available (' + updateInfo.latestVersion + ')'
                      : 'Version ' + DISPLAY_VERSION + ' • Latest'}
                  </Text>
                </View>
              </View>
              {checkingUpdate ? (
                <ActivityIndicator size="small" color={c.primary} />
              ) : updateInfo?.hasUpdate ? (
                <View style={[styles.updateBadge, { backgroundColor: c.accent }]}>
                  <Text style={styles.updateBadgeText}>UPDATE</Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowAboutModal(true);
              }}
              style={styles.menuRow}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.teal + '18' }]}>
                  <Ionicons name="information-circle-outline" size={18} color={c.teal} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>About ExpenseTracker</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    Executive Edition • {DISPLAY_VERSION}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        </StaggeredView>

        {/* Account Governance */}
        <StaggeredView delay={270} direction="up">
          <Text style={[styles.sectionTitle, { color: c.textMuted }]}>ACCOUNT</Text>
          <View style={[styles.menuBlock, { backgroundColor: c.card, borderColor: c.border }]}>
            {isBiometricsAvailable && (
              <View
                style={[
                  styles.menuRow,
                  { borderBottomColor: c.border, justifyContent: 'space-between' },
                ]}
              >
                <View style={styles.menuRowLeft}>
                  <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                    <Ionicons name="finger-print-outline" size={18} color={c.primary} />
                  </View>
                  <View>
                    <Text style={[styles.menuRowTitle, { color: c.text }]}>Biometric Unlock</Text>
                    <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                      {isBiometricEnabled
                        ? 'Enabled (Face ID / Fingerprint active)'
                        : 'Disabled (Tap to enable)'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isBiometricEnabled}
                  onValueChange={async (val) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    const ok = await toggleBiometrics(val);
                    if (!ok) showAlert('Biometrics', 'Biometric authentication failed or was cancelled.');
                  }}
                  trackColor={{ false: c.border, true: c.primary }}
                />
              </View>
            )}

            {isBiometricsAvailable && hasSecurityPin && (
              <View
                style={[
                  styles.menuRow,
                  { borderBottomColor: c.border, justifyContent: 'space-between' },
                ]}
              >
                <View style={styles.menuRowLeft}>
                  <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                    <Ionicons name="finger-print-outline" size={18} color={c.primary} />
                  </View>
                  <View>
                    <Text style={[styles.menuRowTitle, { color: c.text }]}>Fingerprint password reset</Text>
                    <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                      Fill in your PIN with your fingerprint
                    </Text>
                  </View>
                </View>
                <Switch
                  value={fingerprintResetEnabled}
                  onValueChange={async (on) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    if (on) {
                      setEnableFingerprintOnSave(true);
                      setShowPinModal(true);
                    } else {
                      await clearSavedPin();
                      setFingerprintResetEnabled(false);
                    }
                  }}
                  trackColor={{ false: c.border, true: c.primary }}
                />
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowPinModal(true);
              }}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={c.primary} />
                </View>
                <View>
                  <Text style={[styles.menuRowTitle, { color: c.text }]}>6-Digit Security PIN</Text>
                  <Text style={[styles.menuRowSub, { color: c.textMuted }]}>
                    {hasSecurityPin
                      ? 'Active (Zero-email recovery enabled)'
                      : 'Not configured (Tap to setup)'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                showAlert(
                  'Sign Out',
                  'Are you sure you want to sign out of your account?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'default', onPress: () => logout() },
                  ],
                  'info'
                );
              }}
              style={[styles.menuRow, { borderBottomColor: c.border }]}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.textMuted + '18' }]}>
                  <Ionicons name="log-out-outline" size={18} color={c.textMuted} />
                </View>
                <Text style={[styles.menuRowTitle, { color: c.text }]}>Sign Out</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setDeleteConfirmText('');
                setShowDeleteModal(true);
              }}
              style={styles.menuRow}
            >
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.accent + '20' }]}>
                  <Ionicons name="trash-outline" size={18} color={c.accent} />
                </View>
                <Text style={[styles.menuRowTitle, { color: c.accent, fontWeight: '700' }]}>
                  Delete Account Permanently
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </StaggeredView>

        <View style={{ height: 40 }} />
      </ThemedScrollView>

      {/* Profile Picture Customization Modal */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: 420 }}
          >
            <View style={[styles.pinModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.pinHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="image-outline" size={20} color={c.primary} />
                  <Text style={[styles.pinModalTitle, { color: c.text }]}>Profile Picture</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowAvatarModal(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={[styles.pinCloseBtn, { backgroundColor: c.inputBg }]}
                >
                  <Ionicons name="close" size={18} color={c.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.pinModalDesc, { color: c.textMuted }]}>
                Update your profile picture by browsing your device files or entering a web image URL.
              </Text>

              {/* Preview */}
              <View style={{ alignItems: 'center', marginVertical: 12 }}>
                <View
                  style={[
                    styles.bigAvatar,
                    {
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: c.primary,
                      borderColor: c.primary + '60',
                    },
                  ]}
                >
                  {resolveAvatarUrl(avatarUrlInput.trim() || profilePicture) ? (
                    <Image
                      source={{ uri: resolveAvatarUrl(avatarUrlInput.trim() || profilePicture)! }}
                      style={[styles.bigAvatarImg, { borderRadius: 40 }]}
                    />
                  ) : (
                    <Text style={[styles.avatarLetter, { fontSize: 32 }]}>
                      {(userName || 'U').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </View>

              {/* Local File Browser Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePickLocalAvatar}
                disabled={isSavingAvatar}
                style={[
                  styles.savePinBtn,
                  {
                    backgroundColor: c.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginBottom: 16,
                    opacity: isSavingAvatar ? 0.7 : 1,
                  },
                ]}
              >
                {isSavingAvatar ? (
                  <ActivityIndicator size="small" color={isLight ? '#FFF' : '#10120E'} />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={18} color={isLight ? '#FFF' : '#10120E'} />
                    <Text style={[styles.savePinBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                      Browse Files & Photos
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Or paste image URL
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              </View>

              <View style={styles.pinFieldWrap}>
                <Text style={[styles.pinFieldLabel, { color: c.textMuted }]}>IMAGE URL</Text>
                <TextInput
                  style={[
                    styles.pinTextInput,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: c.border,
                      color: c.text,
                      fontSize: 13,
                    },
                  ]}
                  placeholder="https://example.com/avatar.jpg"
                  placeholderTextColor={c.textMuted}
                  value={avatarUrlInput}
                  onChangeText={setAvatarUrlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveAvatar}
                disabled={isSavingAvatar}
                style={[
                  styles.savePinBtn,
                  { backgroundColor: c.inputBg, borderColor: c.border, borderWidth: 1, opacity: isSavingAvatar ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.savePinBtnText, { color: c.text }]}>
                  Save URL
                </Text>
              </TouchableOpacity>

              {profilePicture ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleClearAvatar}
                  disabled={isSavingAvatar}
                  style={[
                    styles.savePinBtn,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: c.accent,
                      marginTop: 8,
                    },
                  ]}
                >
                  <Text style={[styles.savePinBtnText, { color: c.accent }]}>
                    Remove Current Avatar
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.currModalContent, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.currModalHeader}>
              <Text style={[styles.currModalTitle, { color: c.text }]}>
                Select Currency ({WORLD_CURRENCIES.length})
              </Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <Ionicons name="close-circle" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.currSearchBox,
                { backgroundColor: c.inputBg, borderColor: c.border },
              ]}
            >
              <Ionicons name="search" size={16} color={c.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.currSearchInput, { color: c.text }]}
                placeholder="Search by code, symbol, or country..."
                placeholderTextColor={c.textMuted}
                value={currencySearch}
                onChangeText={setCurrencySearch}
              />
              {currencySearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setCurrencySearch('')}
                  onPressIn={() => setCurrencySearch('')}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Clear search"
                  accessibilityRole="button"
                >
                  <Ionicons name="close-circle" size={16} color={c.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = item.code === currency;
                return (
                  <TouchableOpacity
                    style={[
                      styles.currItemRow,
                      { borderBottomColor: c.border },
                      isSelected && { backgroundColor: c.primary + '18' },
                    ]}
                    onPress={async () => {
                      try {
                        await updateCurrency(item.code);
                        setShowCurrencyModal(false);
                        Haptics.selectionAsync().catch(() => {});
                      } catch (e: any) {
                        const msg =
                          e instanceof ApiError ? e.message : 'Could not update your currency.';
                        showAlert('Currency Update Failed', msg, undefined, 'error');
                      }
                    }}
                  >
                    <View style={styles.currItemLeft}>
                      <Text style={styles.currFlag}>{item.flag}</Text>
                      <View>
                        <Text style={[styles.currCodeText, { color: c.text }]}>{item.code}</Text>
                        <Text style={[styles.currNameText, { color: c.textMuted }]}>
                          {item.name}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.currItemRight}>
                      <Text
                        style={[
                          styles.currSymbolText,
                          { color: isSelected ? c.primary : c.textMuted },
                        ]}
                      >
                        {item.symbol}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={c.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Security PIN Setup Modal */}
      <Modal
        visible={showPinModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closePinModal}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%', maxWidth: 420 }}
          >
            <View style={[styles.pinModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={styles.pinHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={20} color={c.primary} />
                  <Text style={[styles.pinModalTitle, { color: c.text }]}>Security PIN Setup</Text>
                </View>
                <TouchableOpacity
                  onPress={closePinModal}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={[styles.pinCloseBtn, { backgroundColor: c.inputBg }]}
                >
                  <Ionicons name="close" size={18} color={c.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.pinModalDesc, { color: c.textMuted }]}>
                Configure a 6-digit numeric PIN for instant zero-email account recovery. You can reset your password anytime even if email OTP is unavailable.
              </Text>

              {/* New PIN Input Field */}
              <View style={styles.pinFieldWrap}>
                <Text style={[styles.pinFieldLabel, { color: c.textMuted }]}>NEW 6-DIGIT PIN</Text>
                <TextInput
                  style={[
                    styles.pinTextInput,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: c.border,
                      color: c.text,
                      letterSpacing: newPin.length > 0 ? 4 : 0,
                    },
                  ]}
                  placeholder="Enter 6-digit PIN"
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  value={newPin}
                  onChangeText={setNewPin}
                />
              </View>

              {/* Confirm PIN Input Field */}
              <View style={styles.pinFieldWrap}>
                <Text style={[styles.pinFieldLabel, { color: c.textMuted }]}>CONFIRM 6-DIGIT PIN</Text>
                <TextInput
                  style={[
                    styles.pinTextInput,
                    {
                      backgroundColor: c.inputBg,
                      borderColor: c.border,
                      color: c.text,
                      letterSpacing: confirmPin.length > 0 ? 4 : 0,
                    },
                  ]}
                  placeholder="Confirm 6-digit PIN"
                  placeholderTextColor={c.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSavePin}
                disabled={isSavingPin}
                style={[
                  styles.savePinBtn,
                  { backgroundColor: c.primary, opacity: isSavingPin ? 0.7 : 1 },
                ]}
              >
                {isSavingPin ? (
                  <ActivityIndicator size="small" color="#10120E" />
                ) : (
                  <Text style={[styles.savePinBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>
                    Save Security PIN
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText('');
          setDeletePassword('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.deleteModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.deleteIconBox, { backgroundColor: c.accent + '20' }]}>
              <Ionicons name="warning" size={32} color={c.accent} />
            </View>
            <Text style={[styles.deleteModalTitle, { color: c.text }]}>Permanently Delete Account?</Text>
            <Text style={[styles.deleteModalDesc, { color: c.textMuted }]}>
              This action cannot be undone. All your expenses, budgets, recurring subscriptions, and categories will be permanently erased.
            </Text>
            <Text style={[styles.deleteConfirmLabel, { color: c.text }]}>
              Enter your current account password:
            </Text>
            <TextInput
              style={[
                styles.deleteInput,
                { backgroundColor: c.inputBg, borderColor: c.border, color: c.text, marginBottom: 12 },
              ]}
              placeholder="Current Password"
              placeholderTextColor={c.textMuted}
              secureTextEntry={true}
              value={deletePassword}
              onChangeText={setDeletePassword}
            />
            <Text style={[styles.deleteConfirmLabel, { color: c.text }]}>
              To confirm, type <Text style={{ color: c.accent, fontWeight: '900' }}>DELETE</Text> below:
            </Text>
            <TextInput
              style={[
                styles.deleteInput,
                { backgroundColor: c.inputBg, borderColor: c.border, color: c.text },
              ]}
              placeholder="Type DELETE"
              placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
            />
            <View style={styles.deleteBtnRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeletePassword('');
                }}
                style={[styles.cancelBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.cancelBtnText, { color: c.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={
                  deleteConfirmText.trim() !== 'DELETE' || !deletePassword.trim() || isDeletingAccount
                }
                onPress={handleExecuteDeleteAccount}
                style={[
                  styles.confirmDeleteBtn,
                  {
                    backgroundColor:
                      deleteConfirmText.trim() === 'DELETE' && deletePassword.trim().length > 0
                        ? c.accent
                        : c.inputBg,
                    opacity:
                      deleteConfirmText.trim() === 'DELETE' && deletePassword.trim().length > 0
                        ? 1
                        : 0.45,
                  },
                ]}
              >
                {isDeletingAccount ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <MonthlyReportModal visible={showReportModal} onClose={() => setShowReportModal(false)} />
      <ManageCategoriesModal
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoriesUpdated={() => {}}
      />
      <HelpGuideModal visible={showHelpModal} onClose={() => setShowHelpModal(false)} />
      <AboutModal visible={showAboutModal} onClose={() => setShowAboutModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 30 },
  header: { marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 13, marginTop: 4 },
  userCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrapper: {
    position: 'relative',
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  bigAvatarImg: { width: '100%', height: '100%', borderRadius: 26 },
  avatarLetter: { color: '#10120E', fontSize: 22, fontWeight: '900' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2.5,
    elevation: 4,
    zIndex: 10,
  },
  userMeta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userNameText: { fontSize: 18, fontWeight: '800' },
  memberBadgeText: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
  },
  saveNickBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuBlock: { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuCurrencySymbol: { fontSize: 16, fontWeight: '800' },
  menuRowTitle: { fontSize: 14, fontWeight: '700' },
  menuRowSub: { fontSize: 11.5, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  currModalContent: { width: '100%', maxHeight: '75%', borderRadius: 24, borderWidth: 1, padding: 16 },
  currModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currModalTitle: { fontSize: 17, fontWeight: '800' },
  currSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  currSearchInput: { flex: 1, fontSize: 13, height: '100%' },
  currItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderRadius: 10,
  },
  currItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currFlag: { fontSize: 22 },
  currCodeText: { fontSize: 14, fontWeight: '800' },
  currNameText: { fontSize: 11.5 },
  currItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currSymbolText: { fontSize: 16, fontWeight: '700' },
  deleteModalCard: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center' },
  deleteIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  deleteModalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  deleteModalDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  deleteConfirmLabel: { fontSize: 13, marginBottom: 8, textAlign: 'center' },
  deleteInput: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 18,
  },
  deleteBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  confirmDeleteBtn: { flex: 1.2, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmDeleteBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  pinModalCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  pinHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  pinModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pinCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinModalDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 18,
  },
  pinFieldWrap: {
    width: '100%',
    marginBottom: 14,
  },
  pinFieldLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  pinTextInput: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '700',
  },
  savePinBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  savePinBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  updateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  updateBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
