import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '../../constants/theme';
import { resolveAvatarUrl } from '../../services/api';
import { ThemeToggleBtn } from '../ThemeToggleBtn';
import { dashboardStyles as styles } from './dashboardStyles';

export interface DashboardHeaderProps {
  userName: string | null;
  profilePicture: string | null;
  unreadNotifications: number;
  isStealthMode: boolean;
  toggleStealthMode: () => Promise<void> | void;
  onOpenExportModal: () => void;
  colors: ThemeColors;
  theme: 'light' | 'dark';
}

export const DashboardHeader = memo(function DashboardHeader({
  userName,
  profilePicture,
  unreadNotifications,
  isStealthMode,
  toggleStealthMode,
  onOpenExportModal,
  colors: c,
  theme,
}: DashboardHeaderProps) {
  const router = useRouter();
  const isLight = theme === 'light';
  const now = new Date();

  return (
    <View style={styles.topBar}>
      <View style={styles.userCol}>
        <View style={[styles.avatarCircle, { backgroundColor: c.primary, borderColor: c.primary + '60' }]}>
          {profilePicture ? (
            <Image source={{ uri: resolveAvatarUrl(profilePicture) || undefined }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarLetter}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.userGreetingCol}>
          <Text style={[styles.greetingSubtitle, { color: c.textMuted }]}>
            Welcome back 👋
          </Text>
          <Text
            style={[styles.greetingTitle, { color: c.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {userName || 'User'}
          </Text>
          <Text style={[styles.todayDate, { color: c.textMuted }]} numberOfLines={1}>
            {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </View>

      <View style={styles.topBarRight}>
        {/* Export / Data Hub Button */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onOpenExportModal}
          style={[
            styles.topActionBtn,
            {
              backgroundColor: isLight ? '#FFFFFF' : c.card,
              borderColor: isLight ? 'rgba(212, 175, 55, 0.45)' : c.border,
              shadowColor: isLight ? 'transparent' : '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isLight ? 0 : 0.08,
              shadowRadius: 4,
              elevation: isLight ? 0 : 2,
            },
          ]}
          accessibilityLabel="Export Data"
        >
          <Ionicons name="share-outline" size={18} color={c.primary} />
        </TouchableOpacity>

        {/* Notification inbox with unread badge */}
        <View style={styles.bellBtnWrapper}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push('/notifications' as any)}
            style={[
              styles.topActionBtn,
              {
                backgroundColor: isLight ? '#FFFFFF' : c.card,
                borderColor: isLight ? 'rgba(212, 175, 55, 0.45)' : c.border,
                shadowColor: isLight ? 'transparent' : '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isLight ? 0 : 0.08,
                shadowRadius: 4,
                elevation: isLight ? 0 : 2,
              },
            ]}
            accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
          >
            <Ionicons name="notifications-outline" size={18} color={c.primary} />
          </TouchableOpacity>
          {unreadNotifications > 0 && (
            <View
              pointerEvents="none"
              style={[
                styles.bellBadge,
                {
                  borderColor: isLight ? '#FFFFFF' : (c.card || '#171A14'),
                },
              ]}
            >
              <Text style={styles.bellBadgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
            </View>
          )}
        </View>

        {/* Privacy / Stealth Mode Toggle Button */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            void toggleStealthMode();
          }}
          style={({ pressed }) => [
            styles.topActionBtn,
            {
              backgroundColor: isStealthMode
                ? (isLight ? (pressed ? 'rgba(212, 175, 55, 0.28)' : 'rgba(212, 175, 55, 0.18)') : 'rgba(199, 154, 62, 0.22)')
                : (isLight ? (pressed ? '#F1F5F9' : '#FFFFFF') : (pressed ? c.cardHover : c.card)),
              borderColor: isStealthMode
                ? (isLight ? '#B8860B' : c.primary)
                : (isLight ? 'rgba(212, 175, 55, 0.45)' : c.border),
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Toggle Privacy Mode"
        >
          <Ionicons
            name={isStealthMode ? 'eye-off' : 'eye-outline'}
            size={19}
            color={
              isStealthMode
                ? (isLight ? '#B8860B' : c.primary)
                : (isLight ? '#D4AF37' : c.primary)
            }
          />
        </Pressable>

        {/* Modern Instant-Feedback Theme Toggle Button */}
        <ThemeToggleBtn />
      </View>
    </View>
  );
});
