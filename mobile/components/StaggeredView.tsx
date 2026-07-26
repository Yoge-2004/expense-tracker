import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface StaggeredViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export const StaggeredView: React.FC<StaggeredViewProps> = ({
  children,
  delay = 0,
  duration = 500,
  style,
  direction = 'up',
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(getInitialTranslate(direction))).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
        Animated.spring(translateAnim, {
          toValue: 0,
          friction: 8,
          tension: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timeout);
  }, []);

  const isHorizontal = direction === 'left' || direction === 'right';

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: isHorizontal
            ? [{ translateX: translateAnim }]
            : [{ translateY: translateAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

function getInitialTranslate(direction: string): number {
  switch (direction) {
    case 'up': return 24;
    case 'down': return -24;
    case 'left': return 30;
    case 'right': return -30;
    default: return 24;
  }
}
