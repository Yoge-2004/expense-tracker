import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Switch, TextInput } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { userId, userName, logout, theme, toggleTheme, updateUserName } = useAuth();
  const router = useRouter();

  const isLight = theme === 'light';

  // Display Name editing state
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(userName || '');

  // Get active colors based on theme
  const getThemeColors = () => {
    if (theme === 'light') {
      return {
        bg: '#F5F7FA',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: '#0F172A',
        textMuted: '#64748B',
        inputBg: '#FFFFFF',
        inputBorder: '#E2E8F0',
        accent: '#FF9F6E',
      };
    }
    return {
      bg: '#05070D',
      card: '#121624',
      border: 'rgba(255, 255, 255, 0.08)',
      text: '#E6E8EC',
      textMuted: '#9AA0AE',
      inputBg: 'rgba(255, 255, 255, 0.03)',
      inputBorder: 'rgba(255, 255, 255, 0.08)',
      accent: '#FF9F6E',
    };
  };

  const c = getThemeColors();

  const handleSaveNickname = async () => {
    if (!nickname.trim()) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }
    try {
      await updateUserName(nickname.trim());
      setIsEditing(false);
      Alert.alert('Success', 'Display name updated successfully.');
    } catch (e) {
      Alert.alert('Error', 'Could not save display name.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and will delete all your expenses, budgets, and subscriptions. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/users/${userId}`, { method: 'DELETE' });
              Alert.alert('Deleted', 'Your account has been deleted.');
              logout();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete account.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Profile Details section */}
      <View style={[styles.profileCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.avatar, { backgroundColor: c.accent }]}>
          <Text style={styles.avatarText}>{userName ? userName.charAt(0).toUpperCase() : 'U'}</Text>
        </View>
        
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              style={[styles.nicknameInput, { color: c.text, borderColor: c.inputBorder, backgroundColor: c.inputBg }]}
              value={nickname}
              onChangeText={setNickname}
              placeholder="Enter name"
              placeholderTextColor={c.textMuted}
            />
            <TouchableOpacity style={styles.saveNickBtn} onPress={handleSaveNickname}>
              <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelNickBtn} onPress={() => { setNickname(userName || ''); setIsEditing(false); }}>
              <Ionicons name="close" size={20} color={c.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={[styles.userName, { color: c.text }]}>{userName || 'Tracker User'}</Text>
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editIconBtn}>
              <Ionicons name="pencil-outline" size={16} color={c.accent} />
            </TouchableOpacity>
          </View>
        )}
        <Text style={[styles.userMeta, { color: c.textMuted }]}>ID: {userId}</Text>
      </View>

      {/* Settings Options List */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Preferences</Text>
        
        {/* Light Theme switch */}
        <View style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.optionLeft}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
              <Ionicons name={isLight ? "sunny" : "moon"} size={20} color={c.accent} />
            </View>
            <Text style={[styles.optionText, { color: c.text }]}>Light Mode Theme</Text>
          </View>
          <Switch
            value={isLight}
            onValueChange={toggleTheme}
            trackColor={{ false: '#1E293B', true: '#6366F1' }}
            thumbColor={isLight ? '#FFFFFF' : '#94A3B8'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: c.text }]}>Account</Text>

        {/* Manage subscriptions option */}
        <TouchableOpacity 
          style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => router.push('/(tabs)/subscriptions')}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
              <Ionicons name="repeat" size={20} color={c.accent} />
            </View>
            <Text style={[styles.optionText, { color: c.text }]}>Manage Subscriptions</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </TouchableOpacity>

        {/* Logout option */}
        <TouchableOpacity 
          style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={logout}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
              <Ionicons name="log-out-outline" size={20} color="#FF6B50" />
            </View>
            <Text style={[styles.optionText, { color: '#FF6B50' }]}>Sign Out</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </TouchableOpacity>

        {/* Delete account option */}
        <TouchableOpacity 
          style={[styles.optionRow, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={handleDeleteAccount}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(255,107,80,0.1)' }]}>
              <Ionicons name="trash-outline" size={20} color="#FF6B50" />
            </View>
            <Text style={[styles.optionText, { color: '#FF6B50' }]}>Delete Account Permanently</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#05070D',
    fontSize: 32,
    fontWeight: 'bold',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  editIconBtn: {
    padding: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  nicknameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    height: 38,
  },
  saveNickBtn: {
    backgroundColor: '#FF9F6E',
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelNickBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMeta: {
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
