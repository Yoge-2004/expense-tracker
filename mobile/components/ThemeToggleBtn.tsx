/**
 * @file ThemeToggleBtn.tsx
 * @description Modern haptic-enabled theme switcher button with spring rotation animation.
 * Adapts seamlessly across all screens and headers in the mobile app.
 */

import React, { useRef } from 'react';
import { Animated, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';

interface ThemeToggleBtnProps {
  style?: StyleProp<ViewStyle>;
}

export const ThemeToggleBtn: React.FC<ThemeToggleBtnProps> = React.memo(({ style }) => {
  const { theme, toggleTheme } = useAuth();
  const isLight = theme === 'light';
  const c = Colors[theme];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const handlePress = () => {
    toggleTheme();
    rotateAnim.setValue(0);
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isLight ? 'Dark' : 'Light'} Theme`}
      style={[
        styles.toggleBtn,
        {
          backgroundColor: c.card,
          borderColor: isLight ? 'rgba(212, 175, 55, 0.45)' : 'rgba(199, 154, 62, 0.35)',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          transform: [{ scale: scaleAnim }, { rotate: spin }],
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
    </TouchableOpacity>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
});
