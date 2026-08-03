import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Alert, Switch, TextInput, Animated,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AnimatedCard } from '../../components/AnimatedCard';

const MENU_ITEMS = [
  {
    icon: 'repeat',
    label: 'Manage Subscriptions',
    sub: 'View recurring expenses',
    color: '#4C7A78',
    route: '/(tabs)/subscriptions' as const,
    danger: false,
  },
];

const DANGER_ITEMS = [
  {
    icon: 'log-out-outline',
    label: 'Sign Out',
    sub: 'Log out of your account',
    color: '#A23E32',
    action: 'logout' as const,
  },
  {
    icon: 'trash-outline',
    label: 'Delete Account',
    sub: 'Permanently remove all data',
    color: '#A23E32',
    action: 'delete' as const,
  },
];

export default function ProfileScreen() {
  const { userId, userName, logout, theme, toggleTheme, updateUserName } = useAuth();
  const router = useRouter();

  const isLight = theme === 'light';
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(userName || '');

  const c = {
    bg: isLight ? '#EDEAE0' : '#10120E',
    card: isLight ? '#FFFFFF' : 'rgba(13,18,30,0.9)',
    card2: isLight ? '#FCFBF6' : 'rgba(18,26,44,0.7)',
    border: isLight ? '#DAD4C1' : 'rgba(255,255,255,0.07)',
    text: isLight ? '#171A14' : '#ECE7D8',
    textMuted: isLight ? '#A8A395' : '#A8A395',
    inputBg: isLight ? '#FCFBF6' : 'rgba(10,16,30,0.8)',
    accent: '#C79A3E',
    orange: '#A23E32',
  };

  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }
    try {
      await updateUserName(nickname.trim());
      setIsEditing(false);
      Alert.alert('✅ Saved', 'Display name updated.');
    } catch {
      Alert.alert('Error', 'Could not save display name.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account',
      'This will permanently delete all your expenses, budgets, and subscriptions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/users/${userId}`, { method: 'DELETE' });
              logout();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete account.');
            }
          },
        },
      ]
    );
  };

  const initial = (userName || 'U').charAt(0).toUpperCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── HERO PROFILE CARD ── */}
      <View style={[styles.heroCard, { backgroundColor: c.card, borderColor: c.accent + '35' }]}>
        {/* Glow blobs */}
        <View style={[styles.blob1, { backgroundColor: c.accent + '15' }]} />
        <View style={[styles.blob2, { backgroundColor: c.orange + '10' }]} />

        <View style={styles.avatarSection}>
          <View style={[styles.avatarRing, { borderColor: c.accent + '50' }]}>
            <View style={[styles.avatar, { backgroundColor: c.accent }]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          </View>
          <View style={[styles.onlineDot, { borderColor: c.card }]} />
        </View>

        {isEditing ? (
          <View style={styles.editNameRow}>
            <View style={[styles.nameInput, { backgroundColor: c.inputBg, borderColor: c.accent }]}>
              <TextInput
                style={[styles.nameInputText, { color: c.text }]}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Enter display name"
                placeholderTextColor={c.textMuted}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.editActionBtn, { backgroundColor: c.accent }]}
              onPress={handleSaveNickname}
            >
              <Ionicons name="checkmark" size={18} color="#10120E" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.editActionBtn, { backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border }]}
              onPress={() => { setNickname(userName || ''); setIsEditing(false); }}
            >
              <Ionicons name="close" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={[styles.displayName, { color: c.text }]}>{userName || 'Tracker User'}</Text>
            <TouchableOpacity
              style={[styles.pencilBtn, { backgroundColor: c.accent + '18', borderColor: c.accent + '40' }]}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="pencil" size={12} color={c.accent} />
            </TouchableOpacity>
          </View>
        )}
        <Text style={[styles.userIdText, { color: c.textMuted }]}>User ID #{userId}</Text>

        {/* Stat pills */}
        <View style={styles.statRow}>
          <View style={[styles.statPill, { backgroundColor: c.accent + '12', borderColor: c.accent + '30' }]}>
            <Ionicons name="wallet-outline" size={13} color={c.accent} />
            <Text style={[styles.statLabel, { color: c.accent }]}>Expense Tracker</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: c.orange + '12', borderColor: c.orange + '30' }]}>
            <Ionicons name="star-outline" size={13} color={c.orange} />
            <Text style={[styles.statLabel, { color: c.orange }]}>Pro Member</Text>
          </View>
        </View>
      </View>

      {/* ── PREFERENCES ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Preferences</Text>

        <View style={[styles.settingRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={[styles.settingIconBox, { backgroundColor: (isLight ? '#C9932E' : '#4C7A78') + '18' }]}>
            <Ionicons name={isLight ? 'sunny' : 'moon'} size={18} color={isLight ? '#C9932E' : '#4C7A78'} />
          </View>
          <View style={styles.settingTextGroup}>
            <Text style={[styles.settingTitle, { color: c.text }]}>
              {isLight ? 'Light Mode' : 'Dark Mode'}
            </Text>
            <Text style={[styles.settingSub, { color: c.textMuted }]}>
              {isLight ? 'Switch to dark theme' : 'Switch to light theme'}
            </Text>
          </View>
          <Switch
            value={isLight}
            onValueChange={toggleTheme}
            trackColor={{ false: '#1D2117', true: '#C79A3E' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      {/* ── ACCOUNT ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>Account</Text>

        {MENU_ITEMS.map((item, i) => (
          <AnimatedCard
            key={i}
            style={[styles.settingRow, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[styles.settingIconBox, { backgroundColor: item.color + '18' }]}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
            </View>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.settingTitle, { color: c.text }]}>{item.label}</Text>
              <Text style={[styles.settingSub, { color: c.textMuted }]}>{item.sub}</Text>
            </View>
            <View style={[styles.chevronBox, { backgroundColor: c.inputBg }]}>
              <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
            </View>
          </AnimatedCard>
        ))}
      </View>

      {/* ── DANGER ZONE ── */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.sectionLabel, { color: '#A23E32' }]}>Danger Zone</Text>

        {DANGER_ITEMS.map((item, i) => (
          <AnimatedCard
            key={i}
            style={[styles.settingRow, styles.dangerRow, { backgroundColor: 'rgba(255,71,87,0.05)', borderColor: 'rgba(255,71,87,0.2)' }]}
            onPress={item.action === 'logout' ? logout : handleDeleteAccount}
          >
            <View style={[styles.settingIconBox, { backgroundColor: 'rgba(255,71,87,0.12)' }]}>
              <Ionicons name={item.icon as any} size={18} color="#A23E32" />
            </View>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.settingTitle, { color: '#A23E32' }]}>{item.label}</Text>
              <Text style={[styles.settingSub, { color: '#A23E3280' }]}>{item.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#A23E3260" />
          </AnimatedCard>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: c.textMuted }]}>ExpenseTracker v1.0 · Made with ♥</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* HERO */
  heroCard: {
    margin: 20,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  blob1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -60,
    right: -40,
  },
  blob2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    bottom: -20,
    left: -20,
  },
  avatarSection: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C79A3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '900',
    color: '#10120E',
  },
  onlineDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C79A3E',
    borderWidth: 3,
    bottom: 2,
    right: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  pencilBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    width: '100%',
    paddingHorizontal: 8,
  },
  nameInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
  },
  nameInputText: {
    fontSize: 15,
    fontWeight: '600',
  },
  editActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userIdText: {
    fontSize: 12,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* SECTIONS */
  section: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  dangerSection: {
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  dangerRow: {},
  settingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  settingTextGroup: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* FOOTER */
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 12,
  },
});
