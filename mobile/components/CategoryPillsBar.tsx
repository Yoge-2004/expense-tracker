/**
 * @file CategoryPillsBar.tsx
 * @description Horizontal pill chip selector for filtering dashboard transactions by
 * category and date presets (All Dates, Today, This Month, Last 30 Days, Custom Date Range).
 * Integrates interactive monthly calendar picker modal.
 */

import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from './ThemedText';
import { useAuth } from '../context/AuthContext';
import { Colors, getCategoryIconName } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CalendarPickerModal } from './CalendarPickerModal';

interface Category {
  id: number;
  name: string;
}

export type DatePresetType = 'all' | 'today' | 'month' | 'last30' | 'custom';

interface CategoryPillsBarProps {
  /** Array of available categories (global + user custom). */
  categories: Category[];
  /** Currently selected category name or 'all'. */
  selectedCategory: string;
  /** Invoked when a category pill is tapped. */
  onSelectCategory: (categoryName: string) => void;
  /** Active date range preset filter. */
  datePreset: DatePresetType;
  /** Invoked when a date preset tab is pressed. */
  onSelectDatePreset: (preset: DatePresetType) => void;
  /** Optional custom start date string (YYYY-MM-DD). */
  startDate?: string;
  /** Callback to set start date. */
  onStartDateChange?: (date: string) => void;
  /** Optional custom end date string (YYYY-MM-DD). */
  endDate?: string;
  /** Callback to set end date. */
  onEndDateChange?: (date: string) => void;
}

/**
 * Filter bar with interactive date presets, custom date range calendar picker, and scrollable category pills.
 */
export const CategoryPillsBar: React.FC<CategoryPillsBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  datePreset,
  onSelectDatePreset,
  startDate = '',
  onStartDateChange,
  endDate = '',
  onEndDateChange,
}) => {
  const {theme, themeColors} = useAuth();
  const c = themeColors || Colors[theme];
  const isLight = theme === 'light';
  const safeCategories = categories || [];

  // Calendar Picker state
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'end' | null>(null);

  const handleSelectCat = (catName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelectCategory(catName);
  };

  const handleSelectPreset = (preset: DatePresetType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelectDatePreset(preset);
  };

  return (
    <View style={styles.wrapper}>
      {/* 1-Tap Date Presets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetsRow}
      >
        {(
          [
            { id: 'all', label: 'All Dates' },
            { id: 'today', label: 'Today' },
            { id: 'month', label: 'This Month' },
            { id: 'last30', label: 'Last 30D' },
            { id: 'custom', label: 'Custom Range' },
          ] as const
        ).map((p) => {
          const isActive = datePreset === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              activeOpacity={0.8}
              onPress={() => handleSelectPreset(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`Date filter: ${p.label}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.presetChip,
                {
                  backgroundColor: isActive ? c.primary : c.inputBg,
                  borderColor: isActive ? c.primary : c.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  {
                    color: isActive ? (c.onPrimary) : c.textMuted,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Expandable Custom Date Inputs when 'custom' is active */}
      {datePreset === 'custom' && (
        <View style={[styles.customDateBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.dateInputCol}>
            <Text style={[styles.dateLabel, { color: c.textMuted }]}>FROM</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCalendarTarget('start')}
              style={[styles.dateInputWrap, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
              accessibilityRole="button"
              accessibilityLabel="Select start date"
            >
              <Ionicons name="calendar-outline" size={14} color={c.primary} />
              <Text
                style={[
                  styles.dateDisplayText,
                  { color: startDate ? c.text : c.textMuted },
                ]}
              >
                {startDate || 'YYYY-MM-DD'}
              </Text>
              {!!startDate && (
                <TouchableOpacity
                  onPress={() => onStartDateChange && onStartDateChange('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.clearDateButton}
                  accessibilityRole="button"
                  accessibilityLabel="Clear start date"
                >
                  <Ionicons name="close-circle" size={14} color={c.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.dateInputCol}>
            <Text style={[styles.dateLabel, { color: c.textMuted }]}>TO</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setCalendarTarget('end')}
              style={[styles.dateInputWrap, { backgroundColor: c.inputBg, borderColor: c.inputBorder }]}
              accessibilityRole="button"
              accessibilityLabel="Select end date"
            >
              <Ionicons name="calendar-outline" size={14} color={c.primary} />
              <Text
                style={[
                  styles.dateDisplayText,
                  { color: endDate ? c.text : c.textMuted },
                ]}
              >
                {endDate || 'YYYY-MM-DD'}
              </Text>
              {!!endDate && (
                <TouchableOpacity
                  onPress={() => onEndDateChange && onEndDateChange('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.clearDateButton}
                  accessibilityRole="button"
                  accessibilityLabel="Clear end date"
                >
                  <Ionicons name="close-circle" size={14} color={c.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleSelectCat('all')}
          accessibilityRole="button"
          accessibilityLabel="Category: All Categories"
          accessibilityState={{ selected: selectedCategory === 'all' }}
          style={[
            styles.catPill,
            {
              backgroundColor: selectedCategory === 'all' ? c.primary : c.card,
              borderColor: selectedCategory === 'all' ? c.primary : c.border,
            },
          ]}
        >
          <Ionicons
            name="layers-outline"
            size={14}
            color={selectedCategory === 'all' ? (c.onPrimary) : c.primary}
          />
          <Text
            style={[
              styles.catPillText,
              {
                color: selectedCategory === 'all' ? (c.onPrimary) : c.text,
                fontWeight: selectedCategory === 'all' ? '800' : '600',
              },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        {safeCategories.map((cat) => {
          const isActive = selectedCategory.toLowerCase() === (cat.name || '').toLowerCase();
          const iconColor = isActive ? (c.onPrimary) : c.primary;
          return (
            <TouchableOpacity
              key={cat.id}
              activeOpacity={0.8}
              onPress={() => handleSelectCat(cat.name)}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${cat.name}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.catPill,
                {
                  backgroundColor: isActive ? c.primary : c.card,
                  borderColor: isActive ? c.primary : c.border,
                },
              ]}
            >
              <Ionicons name={getCategoryIconName(cat.name)} size={14} color={iconColor} />
              <Text
                style={[
                  styles.catPillText,
                  {
                    color: isActive ? (c.onPrimary) : c.text,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={calendarTarget !== null}
        title={calendarTarget === 'start' ? 'Select Range Start Date' : 'Select Range End Date'}
        initialDate={calendarTarget === 'start' ? startDate : endDate}
        onClose={() => setCalendarTarget(null)}
        onSelectDate={(pickedDate) => {
          if (calendarTarget === 'start' && onStartDateChange) {
            onStartDateChange(pickedDate);
          } else if (calendarTarget === 'end' && onEndDateChange) {
            onEndDateChange(pickedDate);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
    gap: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  presetChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 11.5,
  },
  customDateBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 2,
  },
  dateInputCol: {
    flex: 1,
    gap: 4,
  },
  dateLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  dateInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 8,
    gap: 6,
    justifyContent: 'space-between',
  },
  clearDateButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplayText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 10,
  },
  catPill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 12,
  },
});
