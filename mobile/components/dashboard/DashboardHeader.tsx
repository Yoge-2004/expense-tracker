import React, { memo } from 'react';
import { View, TouchableOpacity, Pressable, Image, useWindowDimensions } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '../../constants/theme';
import { resolveAvatarUrl } from '../../services/api';
import { ThemeToggleBtn } from '../ThemeToggleBtn';
import { dashboardStyles as styles } from './dashboardStyles';

export interface DashboardHeaderProps {
  onPressNotifications: () => void;
  userName: string | null;
  profilePicture: string | null;
  unreadNotifications: number;
  isStealthMode: boolean;
  toggleStealthMode: () => Promise<void> | void;
  onOpenExportModal: () => void;
  onPressHelp?: () => void;
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
  onPressHelp,
  onPressNotifications,
  colors: c,
  theme,
}: DashboardHeaderProps) {
  const isLight = theme === 'light';
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const now = new Date();

  return (
    <View style={[styles.topBar, isCompact && styles.topBarCompact]}>
      <View style={[styles.userCol, isCompact && styles.userColCompact]}>
        <View style={[styles.avatarCircle, { backgroundColor: c.primary, borderColor: c.primary + '60' }]}>
          {profilePicture ? (
            <Image source={{ uri: resolveAvatarUrl(profilePicture) || undefined }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarLetter}>{(userName || 'U').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.userGreetingCol}>
          <Text style={[styles.greetingSubtitle, { color: c.textMuted }]}>
            Welcome back
          </Text>
          <Text
            style={[styles.greetingTitle, { color: c.text }]}
          >
            {userName || 'User'}
          </Text>
          <Text style={[styles.todayDate, { color: c.textMuted }]} numberOfLines={1}>
            {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </View>

      <View style={[styles.topBarRight, isCompact && styles.topBarRightCompact]}>
        {/* Help Guide & Gestures Button */}
        {onPressHelp && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={onPressHelp}
            style={[
              styles.topActionBtn,
              {
                backgroundColor: isLight ? '#FFFFFF' : c.card,
                borderColor: c.borderAccent,
                shadowColor: isLight ? 'transparent' : '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isLight ? 0 : 0.08,
                shadowRadius: 4,
                elevation: isLight ? 0 : 2,
              },
            ]}
            accessibilityLabel="User Guide & Gestures"
          >
            <Ionicons name="help-circle-outline" size={19} color={c.primary} />
          </TouchableOpacity>
        )}

        {/* Export / Data Hub Button */}
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onOpenExportModal}
          style={[
            styles.topActionBtn,
            {
              backgroundColor: isLight ? '#FFFFFF' : c.card,
              borderColor: c.borderAccent,
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
            onPress={onPressNotifications}
            style={[
              styles.topActionBtn,
              {
                backgroundColor: isLight ? '#FFFFFF' : c.card,
                borderColor: c.borderAccent,
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
                ? (pressed ? c.primary + '38' : c.primary + '2E')
                : (isLight ? (pressed ? '#F1F5F9' : '#FFFFFF') : (pressed ? c.cardHover : c.card)),
              borderColor: isStealthMode
                ? c.primary
                : c.border,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Toggle Privacy Mode"
        >
          <Ionicons
            name={isStealthMode ? 'eye-off' : 'eye-outline'}
            size={19}
            color={c.primary}
          />
        </Pressable>

        {/* Modern Instant-Feedback Theme Toggle Button */}
        <ThemeToggleBtn />
      </View>
    </View>
  );
});
