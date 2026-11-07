/**
 * @file SubscriptionsSegmentFilter.tsx
 * @description Accessible segmented filter tabs for Subscriptions and Commitments.
 * Allows instant 1-tap switching between All, Subscriptions, Inflows, and Chits/RDs
 * with Fitts's Law compliant hit targets and haptic feedback.
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ThemedText as Text } from '../ThemedText';
import { ThemeColors } from '../../constants/theme';
import { SubscriptionFilterTab } from './subscriptionsTypes';

export interface SubscriptionsSegmentFilterProps {
  activeTab: SubscriptionFilterTab;
  onSelectTab: (tab: SubscriptionFilterTab) => void;
  totalCount: number;
  subscriptionsCount: number;
  incomesCount: number;
  savingsCount: number;
  colors: ThemeColors;
}

export const SubscriptionsSegmentFilter = memo(function SubscriptionsSegmentFilter({
  activeTab,
  onSelectTab,
  totalCount,
  subscriptionsCount,
  incomesCount,
  savingsCount,
  colors: c,
}: SubscriptionsSegmentFilterProps) {
  const tabs: Array<{ id: SubscriptionFilterTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: totalCount },
    { id: 'expenses', label: 'Subscriptions', count: subscriptionsCount },
    { id: 'incomes', label: 'Inflows', count: incomesCount },
    { id: 'savings', label: 'Chits & RDs', count: savingsCount },
  ];

  const handlePress = (tabId: SubscriptionFilterTab) => {
    if (tabId !== activeTab) {
      Haptics.selectionAsync().catch(() => {});
      onSelectTab(tabId);
    }
  };

  return (
    <View
      style={[
        styles.filterBar,
        {
          backgroundColor: c.fillSubtle,
          borderColor: c.border,
        },
      ]}
      accessibilityRole="tablist"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.8}
              onPress={() => handlePress(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} filter, ${tab.count} items`}
              style={[
                styles.filterTab,
                isActive && [
                  styles.filterTabActive,
                  {
                    backgroundColor: c.card,
                    borderColor: c.primary,
                    shadowColor: c.primary,
                  },
                ],
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  { color: isActive ? c.text : c.textMuted },
                  isActive && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isActive ? c.primary : c.inputBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    { color: isActive ? c.onPrimary : c.textMuted },
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

SubscriptionsSegmentFilter.displayName = 'SubscriptionsSegmentFilter';

const styles = StyleSheet.create({
  filterBar: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44, // Fitts's Law minimum touch height
    gap: 6,
  },
  filterTabActive: {
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  filterTabText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  filterTabTextActive: {
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
