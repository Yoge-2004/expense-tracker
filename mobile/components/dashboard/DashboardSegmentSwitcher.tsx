import React, { memo, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { useReducedMotion } from '../../hooks/useReducedMotion';

export type DashboardSegment = 'overview' | 'analytics' | 'goals';

export interface DashboardSegmentSwitcherProps {
  activeSegment: DashboardSegment;
  onSelectSegment: (segment: DashboardSegment) => void;
  colors: ThemeColors;
  theme: 'dark' | 'light';
  goalsCount?: number;
  loansCount?: number;
  style?: StyleProp<ViewStyle>;
}

const TAB_GAP = 5;
const CONTAINER_PADDING = 4;

export const DashboardSegmentSwitcher = memo(function DashboardSegmentSwitcher({
  activeSegment,
  onSelectSegment,
  colors: c,
  theme: _theme,
  goalsCount = 0,
  loansCount = 0,
  style,
}: DashboardSegmentSwitcherProps) {
  const totalCommitments = (goalsCount || 0) + (loansCount || 0);
  const reducedMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);

  const tabs: Array<{
    id: DashboardSegment;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    badge?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: 'grid-outline' },
    { id: 'analytics', label: 'Analytics', icon: 'pie-chart-outline' },
    {
      id: 'goals',
      label: 'Goals & Loans',
      icon: 'flag-outline',
      badge: totalCommitments > 0 ? totalCommitments : undefined,
    },
  ];

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeSegment));
  const availableWidth = containerWidth > CONTAINER_PADDING * 2 ? containerWidth - CONTAINER_PADDING * 2 : 0;
  const totalGaps = (tabs.length - 1) * TAB_GAP;
  const tabWidth = availableWidth > totalGaps ? (availableWidth - totalGaps) / tabs.length : 0;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tabWidth <= 0) return;
    const targetOffset = activeIndex * (tabWidth + TAB_GAP);

    if (reducedMotion) {
      slideAnim.setValue(targetOffset);
    } else {
      Animated.spring(slideAnim, {
        toValue: targetOffset,
        tension: 70,
        friction: 11,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex, tabWidth, reducedMotion, slideAnim]);

  const handlePress = (segment: DashboardSegment) => {
    if (segment !== activeSegment) {
      Haptics.selectionAsync().catch(() => {});
      onSelectSegment(segment);
    }
  };

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
      style={[
        styles.container,
        {
          backgroundColor: c.fillSubtle,
          borderColor: c.border,
        },
        style,
      ]}
      accessibilityRole="tablist"
    >
      {/* Sliding Active Pill Background - Guaranteed clear gap prevents outline collision */}
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            {
              width: tabWidth,
              backgroundColor: c.card,
              borderColor: c.borderAccent,
              shadowColor: c.primary,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        />
      )}

      {tabs.map((tab) => {
        const isActive = activeSegment === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.8}
            onPress={() => handlePress(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
            style={styles.tabBtn}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={isActive ? c.primary : c.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? c.text : c.textMuted },
                isActive && styles.tabLabelActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {tab.label}
            </Text>

            {tab.badge !== undefined && tab.badge > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isActive ? c.primary : c.fillStrong,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: isActive ? c.onPrimary : c.textMuted },
                  ]}
                >
                  {tab.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

DashboardSegmentSwitcher.displayName = 'DashboardSegmentSwitcher';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: CONTAINER_PADDING,
    gap: TAB_GAP,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 0,
    marginBottom: 16,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: CONTAINER_PADDING,
    bottom: CONTAINER_PADDING,
    left: CONTAINER_PADDING,
    borderRadius: 10,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    minHeight: 44, // Fitts's Law touch target minimum
    gap: 4,
    zIndex: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 4,
    height: 16,
    minWidth: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
});
