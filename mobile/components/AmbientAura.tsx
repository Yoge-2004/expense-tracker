/**
 * @file AmbientAura.tsx
 * @description Atmospheric glowing gradient background with smooth drifting organic orbs.
 * Matches the website's dark/light mesh glow effects without taxing GPU performance.
 * Integrates dynamic theme palettes and custom user wallpaper background assets.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, Animated, useWindowDimensions, Image } from 'react-native';
import { usePreferences } from '../context/PreferencesContext';

interface AmbientAuraProps {
  /** Optional touch pass-through configuration (defaults to 'none'). */
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

/**
 * Atmospheric ambient aura background mesh with custom wallpaper and dynamic orbs.
 */
export const AmbientAura: React.FC<AmbientAuraProps> = React.memo(({ pointerEvents = 'none' }) => {
  const { theme, themeColors, backgroundAsset } = usePreferences();
  const { width, height } = useWindowDimensions();
  const isLight = theme === 'light';
  const [reduceMotion, setReduceMotion] = useState(false);

  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const orb3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      orb1Anim.stopAnimation();
      orb2Anim.stopAnimation();
      orb3Anim.stopAnimation();
      return;
    }

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
  }, [reduceMotion, orb1Anim, orb2Anim, orb3Anim]);

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

  // Dynamic orb colors derived from the active theme or auto-extracted palette
  const orb1Color = themeColors.primary + (isLight ? '28' : '1E');
  const orb2Color = themeColors.accent + (isLight ? '22' : '22');
  const orb3Color = themeColors.highlight + (isLight ? '22' : '20');
  const hasCustomBg = backgroundAsset.type === 'custom' && !!backgroundAsset.uri;
  const showAmbientOrbs = backgroundAsset.type === 'preset';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={pointerEvents}>
      {/* Optional Custom Background Image / Wallpaper */}
      {hasCustomBg && (
        <>
          <Image
            source={{ uri: backgroundAsset.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isLight ? '#FFFFFF' : '#000000',
                opacity: backgroundAsset.overlayOpacity ?? 0.35,
              },
            ]}
          />
        </>
      )}

      {/* Keep the selected wallpaper clear; use palette orbs for ambient presets. */}
      {showAmbientOrbs && <>
      {/* Orb 1 - Primary / Luxury Highlight Glow */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: Math.min(width, height) * 1.15,
            height: Math.min(width, height) * 1.15,
            top: -Math.min(width, height) * 0.35,
            right: -Math.min(width, height) * 0.25,
            backgroundColor: orb1Color,
            transform: [
              { translateX: orb1TranslateX },
              { translateY: orb1TranslateY },
              { scale: orb1Scale },
            ],
          },
        ]}
      />

      {/* Orb 2 - Accent Glow */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: Math.min(width, height) * 0.75,
            height: Math.min(width, height) * 0.75,
            top: height * 0.25,
            left: -Math.min(width, height) * 0.25,
            backgroundColor: orb2Color,
            transform: [
              { translateX: orb2TranslateX },
              { translateY: orb2TranslateY },
              { scale: orb2Scale },
            ],
          },
        ]}
      />

      {/* Orb 3 - Secondary Highlight Glow */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: Math.min(width, height) * 0.65,
            height: Math.min(width, height) * 0.65,
            bottom: height * 0.1,
            right: -Math.min(width, height) * 0.15,
            backgroundColor: orb3Color,
            transform: [
              { translateX: orb3TranslateX },
              { translateY: orb3TranslateY },
            ],
          },
        ]}
      />
      </>}
    </View>
  );
});

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
});
