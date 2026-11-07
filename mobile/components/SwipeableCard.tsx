import React, { useState, useMemo } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';

interface SwipeableCardProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
  editLabel?: string;
  deleteLabel?: string;
  editColor?: string;
  deleteColor?: string;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onEdit,
  onDelete,
  style,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  editColor,
  deleteColor,
}) => {
  const { theme, themeColors } = useAuth();
  const c = themeColors || Colors[theme];
  const isLight = theme === 'light';

  const [pan] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));

  const resolvedEditBg = editColor || c.primary;
  const resolvedEditColor = c.onPrimary;
  const resolvedDeleteBg = deleteColor || (isLight ? '#BE123C' : '#991B1B');
  const resolvedDeleteColor = '#FFFFFF';
  const troughBg = c.surfaceHover;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => {
          return Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
        },
        onPanResponderGrant: () => {},
        onPanResponderMove: (_, g) => {
          const minX = onDelete ? -110 : 0;
          const maxX = onEdit ? 110 : 0;
          const clampedX = Math.max(minX, Math.min(maxX, g.dx));
          pan.setValue({ x: clampedX, y: 0 });
        },
        onPanResponderRelease: (_, g) => {
          if (onDelete && g.dx < -70) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 50, useNativeDriver: true }).start(() => {
              onDelete();
            });
          } else if (onEdit && g.dx > 70) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 50, useNativeDriver: true }).start(() => {
              onEdit();
            });
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 60, useNativeDriver: true }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 60, useNativeDriver: true }).start();
        },
      }),
    [onDelete, onEdit, pan]
  );

  const bgOpacity = pan.x.interpolate({
    inputRange: [-50, -10, 0, 10, 50],
    outputRange: [1, 0.2, 0, 0.2, 1],
    extrapolate: 'clamp',
  });

  const deleteOpacity = pan.x.interpolate({
    inputRange: [-80, -25, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const deleteScale = pan.x.interpolate({
    inputRange: [-80, 0],
    outputRange: [1, 0.85],
    extrapolate: 'clamp',
  });

  const editOpacity = pan.x.interpolate({
    inputRange: [0, 25, 80],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  const editScale = pan.x.interpolate({
    inputRange: [0, 80],
    outputRange: [0.85, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.View style={[styles.background, { backgroundColor: troughBg, borderColor: c.border, opacity: bgOpacity }]}>
        {onEdit ? (
          <Animated.View style={[styles.actionLeft, { backgroundColor: resolvedEditBg, opacity: editOpacity, transform: [{ scale: editScale }] }]}>
            <Ionicons name="pencil" size={14} color={resolvedEditColor} />
            <Text style={[styles.actionText, { color: resolvedEditColor }]}>{editLabel}</Text>
          </Animated.View>
        ) : <View />}

        {onDelete ? (
          <Animated.View style={[styles.actionRight, { backgroundColor: resolvedDeleteBg, opacity: deleteOpacity, transform: [{ scale: deleteScale }] }]}>
            <Text style={[styles.actionText, { color: resolvedDeleteColor }]}>{deleteLabel}</Text>
            <Ionicons name="trash" size={14} color={resolvedDeleteColor} />
          </Animated.View>
        ) : <View />}
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX: pan.x }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    marginBottom: 8,
  },
  background: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
    marginLeft: 'auto',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
