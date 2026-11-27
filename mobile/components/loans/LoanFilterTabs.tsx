/**
 * @file LoanFilterTabs.tsx
 * @description Horizontal scrollable filter pills for peer loans.
 * Adheres to Single Responsibility Principle (SRP).
 */

import React from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../ThemedText';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '../../constants/theme';
import { LoanFilterTab } from './loansTypes';
import { loansStyles as styles } from './loansStyles';

interface LoanFilterTabsProps {
  activeFilter: LoanFilterTab;
  onSelectFilter: (tab: LoanFilterTab) => void;
  colors: ThemeColors;
  theme: 'light' | 'dark';
}

const TABS: { key: LoanFilterTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'LENT', label: 'Owed to You' },
  { key: 'BORROWED', label: 'You Owe' },
  { key: 'PENDING', label: 'Pending' },
];

export const LoanFilterTabs: React.FC<LoanFilterTabsProps> = React.memo(({
  activeFilter,
  onSelectFilter,
  colors: c,
  theme: _theme,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterBarScroll}
      style={styles.filterBarScrollContainer}
    >
      {TABS.map((tab) => {
        const isSelected = activeFilter === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${tab.label}`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onSelectFilter(tab.key);
            }}
            style={[
              styles.filterTab,
              {
                backgroundColor: isSelected ? c.primary : c.inputBg,
                borderColor: isSelected ? c.primary : c.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterTabText,
                {
                  color: isSelected ? c.onPrimary : c.textMuted,
                  fontWeight: isSelected ? '800' : '600',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

LoanFilterTabs.displayName = 'LoanFilterTabs';
