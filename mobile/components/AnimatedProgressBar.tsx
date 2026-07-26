import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface AnimatedProgressBarProps {
  progress: number; // Percentage value between 0 and 100
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

  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: clampedProgress,
      duration: 800,
      useNativeDriver: false, // width animation requires layout driver
    }).start();
  }, [clampedProgress]);

  const getDynamicColor = () => {
    if (fillColor) return fillColor;
    if (clampedProgress >= 100) return '#EF4444'; // Red alert
    if (clampedProgress >= 80) return '#F59E0B'; // Warning amber
    return '#10B981'; // Healthy green
  };

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { height, backgroundColor }, style]}>
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            backgroundColor: getDynamicColor(),
            width: widthInterpolated,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
});
