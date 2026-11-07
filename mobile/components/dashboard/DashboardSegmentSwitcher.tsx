import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';

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

  const handlePress = (segment: DashboardSegment) => {
    if (segment !== activeSegment) {
      Haptics.selectionAsync().catch(() => {});
      onSelectSegment(segment);
    }
  };

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

  return (
    <View
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
            style={[
              styles.tabBtn,
              isActive && [
                styles.tabBtnActive,
                {
                  backgroundColor: c.card,
                  borderColor: c.primary,
                  shadowColor: c.primary,
                },
              ],
            ]}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? c.primary : c.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? c.text : c.textMuted },
                isActive && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>

            {tab.badge !== undefined && tab.badge > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isActive ? c.primary : c.border,
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
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44, // Fitts's Law touch target minimum
    gap: 6,
  },
  tabBtnActive: {
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
