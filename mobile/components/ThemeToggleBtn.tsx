/**
 * @file ThemeToggleBtn.tsx
 * @description Modern haptic-enabled theme switcher button with instant touch-down responsiveness.
 * Adapts seamlessly across all screens and headers in the mobile app.
 */

import React, { useRef, useCallback } from 'react';
import { Animated, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePreferences } from '../context/PreferencesContext';
import { Colors } from '../constants/theme';

interface ThemeToggleBtnProps {
  style?: StyleProp<ViewStyle>;
}

export const ThemeToggleBtn: React.FC<ThemeToggleBtnProps> = React.memo(({ style }) => {
  const { theme, toggleTheme } = usePreferences();
  const isLight = theme === 'light';
  const c = Colors[theme];
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    // 1. Immediately toggle theme state with zero touch-up or gesture delay
    void toggleTheme();
    // 2. Fire physical tactile feedback at the exact millisecond of contact
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // 3. Crisp, hardware-accelerated icon micro-spin
    rotateAnim.setValue(0);
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [toggleTheme, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Pressable
      onPressIn={handlePressIn}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isLight ? 'Dark' : 'Light'} Theme`}
      style={({ pressed }) => [
        styles.toggleBtn,
        {
          backgroundColor: isLight ? '#FFFFFF' : c.card,
          borderColor: isLight ? 'rgba(212, 175, 55, 0.45)' : 'rgba(199, 154, 62, 0.35)',
          opacity: pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          transform: [{ rotate: spin }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={isLight ? 'sunny' : 'moon'}
          size={19}
          color={c.primary}
        />
      </Animated.View>
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
