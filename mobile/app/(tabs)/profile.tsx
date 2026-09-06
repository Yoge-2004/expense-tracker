/**
 * @file profile.tsx
 * @description Settings, preferences, and account management screen.
 * Handles:
 * - Nickname customization.
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { apiRequest, ApiError } from '../../services/api';
import { WORLD_CURRENCIES } from '../../services/currency';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AmbientAura } from '../../components/AmbientAura';
import { StaggeredView } from '../../components/StaggeredView';
import { ManageCategoriesModal } from '../../components/ManageCategoriesModal';
import { MonthlyReportModal } from '../../components/MonthlyReportModal';
import { scheduleDailyExpenseReminders, cancelDailyExpenseReminders, getDailyRemindersEnabled } from '../../services/notifications';

export default function ProfileScreen() {
  const { userId, userName, theme, toggleTheme, currency, updateCurrency, logout, updateUserName, isBiometricsAvailable, isBiometricEnabled, toggleBiometrics } = useAuth();
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
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  React.useEffect(() => {
    getDailyRemindersEnabled().then((enabled) => setRemindersEnabled(enabled));
  }, []);

  const handleToggleReminders = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (remindersEnabled) {
      await cancelDailyExpenseReminders();
      setRemindersEnabled(false);
      showAlert('Reminders Paused', 'Daily 2x expense notifications have been turned off.', undefined, 'info');
    } else {
      const success = await scheduleDailyExpenseReminders();
      if (success) {
        setRemindersEnabled(true);
        showAlert('Reminders Active ⏰', 'You will receive reminders twice daily at 1:30 PM (lunch) and 8:30 PM (evening wrap-up) to log your expenses.', undefined, 'success');
      } else {
        showAlert('Permission Needed', 'Please allow notification permissions in your device settings to receive expense reminders.', undefined, 'warning');
      }
    }
  };

  // Security PIN setup state
  const [showPinModal, setShowPinModal] = useState(false);
  const [hasSecurityPin, setHasSecurityPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  React.useEffect(() => {
    if (!userId) return;
    apiRequest(`/users/${userId}`)
      .then((u) => {
        if (u && u.hasSecurityPin) setHasSecurityPin(true);
      })
      .catch(() => {});
  }, [userId]);

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
      setHasSecurityPin(true);
      setShowPinModal(false);
      setNewPin('');
      setConfirmPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showAlert('Security PIN Saved 🔒', 'Your 6-digit recovery PIN has been configured successfully.', undefined, 'success');
    } catch (e: any) {
      const msg = e instanceof ApiError ? e.message : 'Could not save Security PIN.';
      showAlert('Save Failed', msg, undefined, 'error');
    } finally {
      setIsSavingPin(false);
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
      logout();
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top + 10, 48),
            maxWidth: 900,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: isDesktopOrTV ? 36 : (isLargeScreen ? 24 : 16),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: c.text }]}>Settings & Account</Text>
          <Text style={[styles.pageSubtitle, { color: c.textMuted }]}>Personalize preferences, themes, and global currency</Text>
        </View>

        {/* User Card (Without User ID) */}
        <StaggeredView delay={100} direction="up">
          <View style={[styles.userCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.userCardTop}>
              <View style={[styles.bigAvatar, { backgroundColor: c.primary, borderColor: c.primary + '60' }]}>
                <Text style={styles.avatarLetter}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.userMeta}>
                {isEditing ? (
                  <View style={styles.editRow}>
                    <TextInput style={[styles.editInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]} value={nickname} onChangeText={setNickname} maxLength={50} autoFocus />
                    <TouchableOpacity onPress={handleSaveNickname} style={[styles.saveNickBtn, { backgroundColor: c.primary }]}>
                      <Ionicons name="checkmark" size={16} color={isLight ? '#FFF' : '#10120E'} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.nameRow}>
                    <Text style={[styles.userNameText, { color: c.text }]}>{userName || 'User'}</Text>
                    <TouchableOpacity onPress={() => setIsEditing(true)}><Ionicons name="pencil" size={16} color={c.textMuted} /></TouchableOpacity>
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
            <TouchableOpacity activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); toggleTheme(); }} style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}><Ionicons name={isLight ? 'sunny' : 'moon'} size={18} color={c.primary} /></View>
                <View><Text style={[styles.menuRowTitle, { color: c.text }]}>Appearance Theme</Text><Text style={[styles.menuRowSub, { color: c.textMuted }]}>Currently: {isLight ? 'Light Elegance' : 'Dark Obsidian'}</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowCurrencyModal(true)} style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.teal + '18' }]}><Text style={[styles.menuCurrencySymbol, { color: c.teal }]}>{currItem?.symbol || '$'}</Text></View>
                <View><Text style={[styles.menuRowTitle, { color: c.text }]}>Ledger Currency</Text><Text style={[styles.menuRowSub, { color: c.textMuted }]}>{currItem?.flag} {currItem?.name || 'Indian Rupee'} ({currItem?.code || 'INR'})</Text></View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={handleToggleReminders} style={styles.menuRow}>
              <View style={styles.menuRowLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}><Ionicons name="notifications-outline" size={18} color={c.primary} /></View>
                <View><Text style={[styles.menuRowTitle, { color: c.text }]}>Daily Reminders (2x Daily)</Text><Text style={[styles.menuRowSub, { color: c.textMuted }]}>{remindersEnabled ? 'Enabled: 1:30 PM & 8:30 PM check-ins' : 'Disabled'}</Text></View>
              </View>
              <Ionicons name={remindersEnabled ? 'checkbox' : 'square-outline'} size={22} color={remindersEnabled ? c.primary : c.textMuted} />
            </TouchableOpacity>
          </View>
        </StaggeredView>

        {/* Management Section */}
        <StaggeredView delay={200} direction="up">
          <Text style={[styles.sectionTitle, { color: c.textMuted }]}>MANAGEMENT</Text>
          <View style={[styles.menuBlock, { backgroundColor: c.card, borderColor: c.border }]}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowCategoryModal(true)} style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}><View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}><Ionicons name="pricetags-outline" size={18} color={c.primary} /></View><View><Text style={[styles.menuRowTitle, { color: c.text }]}>Manage Categories</Text><Text style={[styles.menuRowSub, { color: c.textMuted }]}>Create and delete custom categories</Text></View></View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setShowReportModal(true); }} style={styles.menuRow}>
              <View style={styles.menuRowLeft}><View style={[styles.menuIconBox, { backgroundColor: c.accent + '18' }]}><Ionicons name="document-text-outline" size={18} color={c.accent} /></View><View><Text style={[styles.menuRowTitle, { color: c.text }]}>Financial Summary Reports</Text><Text style={[styles.menuRowSub, { color: c.textMuted }]}>Select month/year, view HTML statement, or send email</Text></View></View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        </StaggeredView>

        {/* Account Governance */}
        <StaggeredView delay={250} direction="up">
          <Text style={[styles.sectionTitle, { color: c.textMuted }]}>ACCOUNT</Text>
          <View style={[styles.menuBlock, { backgroundColor: c.card, borderColor: c.border }]}>
            {isBiometricsAvailable && (
              <View style={[styles.menuRow, { borderBottomColor: c.border, justifyContent: 'space-between' }]}>
                <View style={styles.menuRowLeft}><View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}><Ionicons name="finger-print-outline" size={18} color={c.primary} /></View><View><Text style={[styles.menuRowTitle, { color: c.text }]}>Biometric Unlock</Text><Text style={[styles.menuRowSub, { color: c.textMuted }]}>{isBiometricEnabled ? 'Enabled (Face ID / Fingerprint active)' : 'Disabled (Tap to enable)'}</Text></View></View>
                <Switch value={isBiometricEnabled} onValueChange={async (val) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); const ok = await toggleBiometrics(val); if (!ok) showAlert('Biometrics', 'Biometric authentication failed or was cancelled.'); }} trackColor={{ false: c.border, true: c.primary }} />
              </View>
            )}

            <TouchableOpacity activeOpacity={0.8} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setShowPinModal(true); }} style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}><View style={[styles.menuIconBox, { backgroundColor: c.primary + '18' }]}><Ionicons name="shield-checkmark-outline" size={18} color={c.primary} /></View><View><Text style={[styles.menuRowTitle, { color: c.text }]}>6-Digit Security PIN</Text><Text style={[styles.menuRowSub, { color: c.textMuted }]}>{hasSecurityPin ? 'Active (Zero-email recovery enabled)' : 'Not configured (Tap to setup)'}</Text></View></View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={() => { showAlert('Sign Out', 'Are you sure you want to sign out of your account?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'default', onPress: () => logout() }], 'info'); }} style={[styles.menuRow, { borderBottomColor: c.border }]}>
              <View style={styles.menuRowLeft}><View style={[styles.menuIconBox, { backgroundColor: c.textMuted + '18' }]}><Ionicons name="log-out-outline" size={18} color={c.textMuted} /></View><Text style={[styles.menuRowTitle, { color: c.text }]}>Sign Out</Text></View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.8} onPress={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }} style={styles.menuRow}>
              <View style={styles.menuRowLeft}><View style={[styles.menuIconBox, { backgroundColor: c.accent + '20' }]}><Ionicons name="trash-outline" size={18} color={c.accent} /></View><Text style={[styles.menuRowTitle, { color: c.accent, fontWeight: '700' }]}>Delete Account Permanently</Text></View>
            </TouchableOpacity>
          </View>
        </StaggeredView>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyModal} animationType="slide" transparent={true} onRequestClose={() => setShowCurrencyModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.currModalContent, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.currModalHeader}>
              <Text style={[styles.currModalTitle, { color: c.text }]}>Select Currency ({WORLD_CURRENCIES.length})</Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}><Ionicons name="close-circle" size={24} color={c.textMuted} /></TouchableOpacity>
            </View>
            <View style={[styles.currSearchBox, { backgroundColor: c.inputBg, borderColor: c.border }]}>
              <Ionicons name="search" size={16} color={c.textMuted} style={{ marginRight: 8 }} />
              <TextInput style={[styles.currSearchInput, { color: c.text }]} placeholder="Search by code, symbol, or country..." placeholderTextColor={c.textMuted} value={currencySearch} onChangeText={setCurrencySearch} />
              {currencySearch.length > 0 && <TouchableOpacity onPress={() => setCurrencySearch('')}><Ionicons name="close-circle" size={16} color={c.textMuted} /></TouchableOpacity>}
            </View>
            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = item.code === currency;
                return (
                  <TouchableOpacity
                    style={[styles.currItemRow, { borderBottomColor: c.border }, isSelected && { backgroundColor: c.primary + '18' }]}
                    onPress={async () => {
                      try {
                        await updateCurrency(item.code);
                        setShowCurrencyModal(false);
                        Haptics.selectionAsync().catch(() => {});
                      } catch (e: any) {
                        const msg = e instanceof ApiError ? e.message : 'Could not update your currency.';
                        showAlert('Currency Update Failed', msg, undefined, 'error');
                      }
                    }}
                  >
                    <View style={styles.currItemLeft}><Text style={styles.currFlag}>{item.flag}</Text><View><Text style={[styles.currCodeText, { color: c.text }]}>{item.code}</Text><Text style={[styles.currNameText, { color: c.textMuted }]}>{item.name}</Text></View></View>
                    <View style={styles.currItemRight}><Text style={[styles.currSymbolText, { color: isSelected ? c.primary : c.textMuted }]}>{item.symbol}</Text>{isSelected && <Ionicons name="checkmark-circle" size={20} color={c.primary} />}</View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Security PIN Setup Modal */}
      <Modal visible={showPinModal} transparent={true} animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxWidth: 400 }}>
            <View style={[styles.deleteModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Text style={{ fontSize: 18, fontWeight: '800', color: c.text }}>Account Security PIN 🔒</Text><TouchableOpacity onPress={() => setShowPinModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="close" size={22} color={c.textMuted} /></TouchableOpacity></View>
              <Text style={{ fontSize: 13, color: c.textMuted, lineHeight: 18, marginBottom: 16 }}>Configure a 6-digit numeric PIN for instant zero-email account recovery. You can reset your password anytime even if email OTP is unavailable.</Text>
              <View style={{ marginBottom: 12 }}><Text style={{ fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 6 }}>NEW 6-DIGIT PIN</Text><TextInput style={[styles.deleteInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text, letterSpacing: 4, textAlign: 'center', fontSize: 18, fontWeight: '700' }]} placeholder="••••••" placeholderTextColor={c.textMuted} keyboardType="number-pad" maxLength={6} secureTextEntry value={newPin} onChangeText={setNewPin} /></View>
              <View style={{ marginBottom: 16 }}><Text style={{ fontSize: 12, fontWeight: '700', color: c.textMuted, marginBottom: 6 }}>CONFIRM 6-DIGIT PIN</Text><TextInput style={[styles.deleteInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text, letterSpacing: 4, textAlign: 'center', fontSize: 18, fontWeight: '700' }]} placeholder="••••••" placeholderTextColor={c.textMuted} keyboardType="number-pad" maxLength={6} secureTextEntry value={confirmPin} onChangeText={setConfirmPin} /></View>
              <TouchableOpacity activeOpacity={0.85} onPress={handleSavePin} disabled={isSavingPin} style={[styles.confirmDeleteBtn, { backgroundColor: c.primary, opacity: isSavingPin ? 0.7 : 1 }]}>{isSavingPin ? <ActivityIndicator size="small" color="#10120E" /> : <Text style={[styles.confirmDeleteBtnText, { color: isLight ? '#FFF' : '#10120E' }]}>Save Security PIN</Text>}</TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Delete Account Modal (Requires Password & Typing "DELETE") */}
      <Modal visible={showDeleteModal} animationType="fade" transparent={true} onRequestClose={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeletePassword(''); }}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.deleteModalCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.deleteIconBox, { backgroundColor: c.accent + '20' }]}><Ionicons name="warning" size={32} color={c.accent} /></View>
            <Text style={[styles.deleteModalTitle, { color: c.text }]}>Permanently Delete Account?</Text>
            <Text style={[styles.deleteModalDesc, { color: c.textMuted }]}>This action cannot be undone. All your expenses, budgets, recurring subscriptions, and categories will be permanently erased.</Text>
            <Text style={[styles.deleteConfirmLabel, { color: c.text }]}>Enter your current account password:</Text>
            <TextInput style={[styles.deleteInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text, marginBottom: 12 }]} placeholder="Current Password" placeholderTextColor={c.textMuted} secureTextEntry={true} value={deletePassword} onChangeText={setDeletePassword} />
            <Text style={[styles.deleteConfirmLabel, { color: c.text }]}>To confirm, type <Text style={{ color: c.accent, fontWeight: '900' }}>DELETE</Text> below:</Text>
            <TextInput style={[styles.deleteInput, { backgroundColor: c.inputBg, borderColor: c.border, color: c.text }]} placeholder="Type DELETE" placeholderTextColor={c.textMuted} autoCapitalize="characters" value={deleteConfirmText} onChangeText={setDeleteConfirmText} />
            <View style={styles.deleteBtnRow}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeletePassword(''); }} style={[styles.cancelBtn, { borderColor: c.border }]}><Text style={[styles.cancelBtnText, { color: c.text }]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} disabled={deleteConfirmText.trim() !== 'DELETE' || !deletePassword.trim() || isDeletingAccount} onPress={handleExecuteDeleteAccount} style={[styles.confirmDeleteBtn, { backgroundColor: (deleteConfirmText.trim() === 'DELETE' && deletePassword.trim().length > 0) ? c.accent : c.inputBg, opacity: (deleteConfirmText.trim() === 'DELETE' && deletePassword.trim().length > 0) ? 1 : 0.45 }]}>{isDeletingAccount ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmDeleteBtnText}>Delete Account</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <MonthlyReportModal visible={showReportModal} onClose={() => setShowReportModal(false)} />
      <ManageCategoriesModal visible={showCategoryModal} onClose={() => setShowCategoryModal(false)} onCategoriesUpdated={() => {}} />
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
  userCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  userCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bigAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  avatarLetter: { color: '#10120E', fontSize: 22, fontWeight: '900' },
  userMeta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userNameText: { fontSize: 18, fontWeight: '800' },
  memberBadgeText: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: { flex: 1, height: 36, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, fontSize: 14 },
  saveNickBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  menuBlock: { borderRadius: 18, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuCurrencySymbol: { fontSize: 16, fontWeight: '800' },
  menuRowTitle: { fontSize: 14, fontWeight: '700' },
  menuRowSub: { fontSize: 11.5, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  currModalContent: { width: '100%', maxHeight: '75%', borderRadius: 24, borderWidth: 1, padding: 16 },
  currModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  currModalTitle: { fontSize: 17, fontWeight: '800' },
  currSearchBox: { flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, marginBottom: 12 },
  currSearchInput: { flex: 1, fontSize: 13, height: '100%' },
  currItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 0.5, borderRadius: 10 },
  currItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currFlag: { fontSize: 22 },
  currCodeText: { fontSize: 14, fontWeight: '800' },
  currNameText: { fontSize: 11.5 },
  currItemRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currSymbolText: { fontSize: 16, fontWeight: '700' },
  deleteModalCard: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 24, alignItems: 'center' },
  deleteIconBox: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  deleteModalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  deleteModalDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  deleteConfirmLabel: { fontSize: 13, marginBottom: 8, textAlign: 'center' },
  deleteInput: { width: '100%', height: 44, borderRadius: 12, borderWidth: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', letterSpacing: 2, marginBottom: 18 },
  deleteBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  cancelBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '700' },
  confirmDeleteBtn: { flex: 1.2, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmDeleteBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
