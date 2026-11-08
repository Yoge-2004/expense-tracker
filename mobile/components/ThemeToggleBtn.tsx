/**
 * @file ThemeToggleBtn.tsx
 * @description Modern haptic-enabled theme switcher button with instant touch responsiveness.
 * Adapts seamlessly across all screens and headers in the mobile app.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePreferences } from '../context/PreferencesContext';
import { Colors } from '../constants/theme';

interface ThemeToggleBtnProps {
  style?: StyleProp<ViewStyle>;
}

export const ThemeToggleBtn: React.FC<ThemeToggleBtnProps> = React.memo(({ style }) => {
  const { theme, toggleTheme, themeColors } = usePreferences();
  const isLight = theme === 'light';
  const c = themeColors || Colors[theme];

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    void toggleTheme();
  }, [toggleTheme]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isLight ? 'Dark' : 'Light'} Theme`}
      style={({ pressed }) => [
        styles.toggleBtn,
        {
          backgroundColor: c.card,
          borderColor: c.borderAccent,
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Ionicons
        name={isLight ? 'sunny' : 'moon'}
        size={19}
        color={c.primary}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  toggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

ThemeToggleBtn.displayName = 'ThemeToggleBtn';
