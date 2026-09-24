import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface StaggeredViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  direction?: 'up' | 'down' | 'left' | 'right';
  scale?: boolean;
}

export const StaggeredView: React.FC<StaggeredViewProps> = ({
  children,
  delay = 0,
  duration = 450,
  style,
  direction = 'up',
  scale = true,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateAnim = useRef(new Animated.Value(getInitialTranslate(direction))).current;
  const scaleAnim = useRef(new Animated.Value(scale ? 0.94 : 1)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (reducedMotion) {
      fadeAnim.setValue(1);
      translateAnim.setValue(0);
      scaleAnim.setValue(1);
      return;
    }

    timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.spring(translateAnim, { toValue: 0, friction: 7, tension: 65, useNativeDriver: true }),
        ...(scale ? [Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true })] : []),
      ]).start();
    }, delay);

    return () => {
      if (timeout) clearTimeout(timeout);
      fadeAnim.stopAnimation();
      translateAnim.stopAnimation();
      scaleAnim.stopAnimation();
    };
  }, [delay, duration, fadeAnim, reducedMotion, scale, scaleAnim, translateAnim]);

  const isHorizontal = direction === 'left' || direction === 'right';

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: isHorizontal
            ? [{ translateX: translateAnim }, { scale: scaleAnim }]
            : [{ translateY: translateAnim }, { scale: scaleAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

function getInitialTranslate(direction: 'up' | 'down' | 'left' | 'right'): number {
  switch (direction) {
    case 'up': return 24;
    case 'down': return -24;
    case 'left': return 24;
    case 'right': return -24;
    default: return 24;
  }
}
