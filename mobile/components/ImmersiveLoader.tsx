import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { AmbientAura } from './AmbientAura';

interface ImmersiveLoaderProps {
  message?: string;
  subMessage?: string;
  fullScreen?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ImmersiveLoader: React.FC<ImmersiveLoaderProps> = ({
  message = 'Synchronizing Ledger...',
  subMessage,
  fullScreen = true,
  compact = false,
  style,
}) => {
  const { theme } = useAuth();
  const c = Colors[theme];
  const reducedMotion = useReducedMotion();

  const spinOuter = useRef(new Animated.Value(0)).current;
  const spinInner = useRef(new Animated.Value(0)).current;
  const pulseCore = useRef(new Animated.Value(1)).current;
  const auraScale = useRef(new Animated.Value(0.9)).current;
  const shimmerTrack = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    if (reducedMotion) return;

    // Outer ring clockwise rotation
    const outerAnim = Animated.loop(
      Animated.timing(spinOuter, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Inner ring counter-clockwise rotation
    const innerAnim = Animated.loop(
      Animated.timing(spinInner, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Breathing pulse for central badge and radiant glow
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseCore, {
            toValue: 1.12,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(auraScale, {
            toValue: 1.25,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseCore, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(auraScale, {
            toValue: 0.9,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Sweep shimmer line
    const shimmerAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerTrack, {
          toValue: 60,
          duration: 1400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerTrack, {
          toValue: -60,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    outerAnim.start();
    innerAnim.start();
    pulseAnim.start();
    shimmerAnim.start();

    return () => {
      outerAnim.stop();
      innerAnim.stop();
      pulseAnim.stop();
      shimmerAnim.stop();
    };
  }, [reducedMotion]);

  const outerRotate = spinOuter.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerRotate = spinInner.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const size = compact ? 54 : 86;
  const ringSize = compact ? 50 : 78;
  const innerRingSize = compact ? 36 : 58;
  const coreSize = compact ? 26 : 40;

  const content = (
    <View style={[styles.centerBox, compact && styles.compactBox, style]}>
      <View style={[styles.haloContainer, { width: size, height: size }]}>
        {/* Ambient breathing glow behind rings */}
        <Animated.View
          style={[
            styles.radiantAura,
            {
              width: size * 1.15,
              height: size * 1.15,
              borderRadius: (size * 1.15) / 2,
              backgroundColor: c.primary + '18',
              transform: [{ scale: auraScale }],
            },
          ]}
        />

        {/* Outer orbital ring */}
        <Animated.View
          style={[
            styles.outerRing,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderColor: c.primary,
              borderTopColor: c.primary,
              borderRightColor: c.primary + '45',
              borderBottomColor: 'transparent',
              borderLeftColor: c.primary + '20',
              transform: [{ rotate: outerRotate }],
            },
          ]}
        />

        {/* Inner reverse orbital ring */}
        <Animated.View
          style={[
            styles.innerRing,
            {
              width: innerRingSize,
              height: innerRingSize,
              borderRadius: innerRingSize / 2,
              borderColor: c.highlight || '#4C7A78',
              borderTopColor: 'transparent',
              borderRightColor: (c.highlight || '#4C7A78') + '30',
              borderBottomColor: c.highlight || '#4C7A78',
              borderLeftColor: (c.highlight || '#4C7A78') + '85',
              transform: [{ rotate: innerRotate }],
            },
          ]}
        />

        {/* Breathing Luminary Core */}
        <Animated.View
          style={[
            styles.coreBadge,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: c.card,
              borderColor: c.borderAccent,
              transform: [{ scale: pulseCore }],
            },
          ]}
        >
          <Ionicons
            name="diamond"
            size={compact ? 13 : 19}
            color={c.primary}
          />
        </Animated.View>
      </View>

      {/* Elegant Shimmer Track */}
      {!compact && (
        <View style={[styles.shimmerTrack, { backgroundColor: c.border }]}>
          <Animated.View
            style={[
              styles.shimmerBar,
              {
                backgroundColor: c.primary,
                transform: [{ translateX: shimmerTrack }],
              },
            ]}
          />
        </View>
      )}

      {/* Typography */}
      {message ? (
        <Text
          style={[
            styles.messageText,
            compact ? styles.messageCompact : styles.messageFull,
            { color: c.text },
          ]}
        >
          {message}
        </Text>
      ) : null}

      {subMessage && !compact ? (
        <Text style={[styles.subMessageText, { color: c.textMuted }]}>
          {subMessage}
        </Text>
      ) : null}
    </View>
  );

  if (fullScreen) {
    return (
      <View style={[styles.fullScreenWrapper, { backgroundColor: c.bg }]}>
        <AmbientAura />
        {content}
      </View>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  fullScreenWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  compactBox: {
    gap: 8,
    paddingVertical: 12,
  },
  haloContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  radiantAura: {
    position: 'absolute',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  innerRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  coreBadge: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  shimmerTrack: {
    width: 90,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 4,
    position: 'relative',
  },
  shimmerBar: {
    width: 35,
    height: '100%',
    borderRadius: 2,
  },
  messageText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  messageFull: {
    fontSize: 14.5,
    letterSpacing: 0.3,
  },
  messageCompact: {
    fontSize: 12.5,
  },
  subMessageText: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 17,
  },
});
