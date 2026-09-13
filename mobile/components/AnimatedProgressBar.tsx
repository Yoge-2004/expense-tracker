import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface AnimatedProgressBarProps {
  progress: number;
  height?: number;
  backgroundColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  progress,
  height = 8,
  backgroundColor = 'rgba(255, 255, 255, 0.1)',
  fillColor,
  style,
}) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const numericProgress = Number(progress);
  const clampedProgress = Number.isFinite(numericProgress) ? Math.min(Math.max(numericProgress, 0), 100) : 0;

  useEffect(() => {
    animatedWidth.stopAnimation();

    if (reducedMotion) {
      animatedWidth.setValue(clampedProgress);
      return;
    }

    const animation = Animated.timing(animatedWidth, {
      toValue: clampedProgress,
      duration: 800,
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [animatedWidth, clampedProgress, reducedMotion]);

  const getDynamicColor = () => {
    if (fillColor) return fillColor;
    if (clampedProgress >= 100) return '#A23E32';
    if (clampedProgress >= 80) return '#C9932E';
    return '#5B8C5A';
  };

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clampedProgress }}
      style={[styles.container, { height, backgroundColor }, style]}
    >
      <Animated.View
        style={[styles.fill, { height, backgroundColor: getDynamicColor(), width: widthInterpolated }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', borderRadius: 999, overflow: 'hidden' },
  fill: { borderRadius: 999 },
});
