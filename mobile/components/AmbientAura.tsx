/**
 * @file AmbientAura.tsx
 * @description Atmospheric glowing gradient background with smooth drifting organic orbs.
 * Matches the website's dark/light mesh glow effects without taxing GPU performance.
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

interface AmbientAuraProps {
  /** Optional touch pass-through configuration (defaults to 'none'). */
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

/**
 * Atmospheric ambient aura background mesh.
 */
export const AmbientAura: React.FC<AmbientAuraProps> = ({ pointerEvents = 'none' }) => {
  const { theme } = useAuth();
  const isLight = theme === 'light';

  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const orb3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDrift = (anim: Animated.Value, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const drift1 = createDrift(orb1Anim, 9000);
    const drift2 = createDrift(orb2Anim, 11000);
    const drift3 = createDrift(orb3Anim, 8000);

    drift1.start();
    drift2.start();
    drift3.start();

    return () => {
      drift1.stop();
      drift2.stop();
      drift3.stop();
    };
  }, []);

  const orb1TranslateX = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 30],
  });
  const orb1TranslateY = orb1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 40],
  });
  const orb1Scale = orb1Anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.15, 1],
  });

  const orb2TranslateX = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -35],
  });
  const orb2TranslateY = orb2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, -20],
  });
  const orb2Scale = orb2Anim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.2, 0.95],
  });

  const orb3TranslateX = orb3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-15, 25],
  });
  const orb3TranslateY = orb3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -25],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={pointerEvents}>
      {/* Orb 1 - Gold/Primary Glow */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          {
            backgroundColor: isLight ? 'rgba(212, 175, 55, 0.18)' : 'rgba(199, 154, 62, 0.16)',
            transform: [
              { translateX: orb1TranslateX },
              { translateY: orb1TranslateY },
              { scale: orb1Scale },
            ],
          },
        ]}
      />

      {/* Orb 2 - Accent/Oxblood Glow */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          {
            backgroundColor: isLight ? 'rgba(231, 76, 60, 0.12)' : 'rgba(162, 62, 50, 0.14)',
            transform: [
              { translateX: orb2TranslateX },
              { translateY: orb2TranslateY },
              { scale: orb2Scale },
            ],
          },
        ]}
      />

      {/* Orb 3 - Teal/Highlight Glow */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb3,
          {
            backgroundColor: isLight ? 'rgba(14, 165, 233, 0.12)' : 'rgba(76, 122, 120, 0.14)',
            transform: [
              { translateX: orb3TranslateX },
              { translateY: orb3TranslateY },
            ],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: width * 0.75,
    height: width * 0.75,
    top: -width * 0.25,
    right: -width * 0.2,
  },
  orb2: {
    width: width * 0.65,
    height: width * 0.65,
    top: height * 0.25,
    left: -width * 0.25,
  },
  orb3: {
    width: width * 0.55,
    height: width * 0.55,
    bottom: height * 0.1,
    right: -width * 0.15,
  },
});
