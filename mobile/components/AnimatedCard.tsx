import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';

interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  scaleTo?: number;
  disabled?: boolean;
  enableHaptics?: boolean;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  style,
  onPress,
  scaleTo = 0.97,
  disabled = false,
  enableHaptics = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      useNativeDriver: true,
      tension: 120,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};
